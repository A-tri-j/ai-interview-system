# Reminder email. Daily chalate hobe: python -m app.services.reminders
# ba /api/internal/run-reminders (GitHub Actions theke).
# Duplicate thamano: Notification table + advisory lock.
import html
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.database.session import SessionLocal, engine
from app.models import (
    Application, ApplicationStatus, AuditLog, CompanyStatus, InterviewSession,
    McqStatus, McqTest, Notification, Vacancy,
)
from app.services.email_service import send_email

logger = logging.getLogger("reminders")

MAX_PER_RUN = 100      # ek run-e maximum koyta email (SMTP slow, timeout-er jonno)
MAX_FAILED_TRIES = 3   # ekoi email bar bar fail korle ar try kori na
LOCK_ID = 424243       # test-er lock (424242) theke alada
ROUND2_OPEN = (
    ApplicationStatus.INTERVIEW_COMPLETED, ApplicationStatus.SHORTLISTED, ApplicationStatus.ON_HOLD,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _done(db: Session, app_id: int, kind: str) -> bool:
    """Age pathano hoyeche (ba pathanor chesta chole), ba onek bar fail korse."""
    rows = [r[0] for r in db.query(Notification.status).filter(
        Notification.related_application_id == app_id, Notification.kind == kind)]
    if any(s != "failed" for s in rows):
        return True
    return len(rows) >= MAX_FAILED_TRIES


def _send_once(db: Session, app: Application, kind: str, subject: str, body: str) -> bool:
    if _done(db, app.id, kind):
        return False
    note = Notification(
        recipient_email=app.candidate.email, kind=kind, subject=subject,
        related_application_id=app.id, status="queued",
    )
    db.add(note)
    db.commit()                      # age record, tarpor pathai: crash holeo duplicate hobe na
    ok = send_email(app.candidate.email, subject, body)
    note.status = "sent" if ok else "failed"
    note.error = None if ok else "send failed"
    db.commit()
    return ok


def _fmt(d: datetime) -> str:
    return d.strftime("%d %b %Y")


def _interview_reminders(db: Session, budget: list[int]) -> dict:
    now = _now()
    cutoff = now - timedelta(days=settings.REMINDER_AFTER_DAYS)
    apps = (
        db.query(Application)
        .options(joinedload(Application.vacancy).joinedload(Vacancy.company),
                 joinedload(Application.candidate))
        .filter(Application.status == ApplicationStatus.APPROVED_FOR_INTERVIEW,
                Application.status_changed_at.isnot(None),
                Application.status_changed_at < cutoff)
        .order_by(Application.id).limit(500).all()
    )
    sent = skipped = 0
    for a in apps:
        if budget[0] <= 0:
            break
        if (not a.candidate.is_active or a.vacancy.company.status != CompanyStatus.APPROVED
                or _done(db, a.id, "reminder_interview")):
            skipped += 1
            continue
        session = db.query(InterviewSession).filter(InterviewSession.application_id == a.id).first()
        deadline = (session.expires_at if session and session.expires_at
                    else a.status_changed_at + timedelta(days=settings.INTERVIEW_LINK_DAYS))
        declined = db.query(AuditLog.id).filter(
            AuditLog.action == "interview_consent_declined", AuditLog.entity_id == a.id).first()
        if deadline <= now or declined:
            skipped += 1
            continue
        link = f"{settings.PUBLIC_APP_URL}/interview/start/{a.id}"
        subject = f"Reminder: your interview for {a.vacancy.title}"
        body = (
            f"<p>Hello {html.escape(a.candidate.full_name)},</p>"
            f"<p>This is a reminder that <b>{html.escape(a.vacancy.company.company_name)}</b> invited "
            f"you to a short AI video interview for <b>{html.escape(a.vacancy.title)}</b>. "
            f"You have not finished it yet.</p>"
            f"<p>It takes about 5 to 7 minutes. Your invitation is valid until "
            f"<b>{_fmt(deadline)}</b>.</p>"
            f'<p><a href="{link}">Continue your interview</a></p>'
        )
        if _send_once(db, a, "reminder_interview", subject, body):
            sent += 1
            budget[0] -= 1
    return {"sent": sent, "skipped": skipped}


def _round2_reminders(db: Session, budget: list[int]) -> dict:
    now = _now()
    cutoff = now - timedelta(days=settings.REMINDER_ROUND2_AFTER_DAYS)
    apps = (
        db.query(Application)
        .options(joinedload(Application.vacancy).joinedload(Vacancy.company),
                 joinedload(Application.candidate))
        .filter(Application.status.in_(ROUND2_OPEN))
        .order_by(Application.id).limit(500).all()
    )
    sent = skipped = 0
    for a in apps:
        if budget[0] <= 0:
            break
        if (not a.candidate.is_active or a.vacancy.company.status != CompanyStatus.APPROVED
                or _done(db, a.id, "reminder_round2")):
            skipped += 1
            continue
        test = db.query(McqTest).filter(McqTest.application_id == a.id).first()
        if test and test.status != McqStatus.READY:      # shuru ba submit hoye gese
            skipped += 1
            continue
        opened = db.query(Notification.created_at).filter(
            Notification.related_application_id == a.id, Notification.kind == "round2_open"
        ).order_by(Notification.id).first()
        since = opened[0] if opened else a.status_changed_at
        if since is None or since >= cutoff:
            skipped += 1
            continue
        link = f"{settings.PUBLIC_APP_URL}/round2/{a.id}"
        subject = f"Reminder: Round 2 MCQ test for {a.vacancy.title}"
        body = (
            f"<p>Hello {html.escape(a.candidate.full_name)},</p>"
            f"<p>Round 2 of your application for <b>{html.escape(a.vacancy.title)}</b> at "
            f"<b>{html.escape(a.vacancy.company.company_name)}</b> is still waiting for you.</p>"
            f"<p>It is {settings.MCQ_COUNT} multiple-choice questions in "
            f"{settings.MCQ_SECONDS // 60} minutes. The timer starts only when you press Start.</p>"
            f'<p><a href="{link}">Open Round 2</a></p>'
        )
        if _send_once(db, a, "reminder_round2", subject, body):
            sent += 1
            budget[0] -= 1
    return {"sent": sent, "skipped": skipped}


def run_reminders(db: Session) -> dict:
    budget = [MAX_PER_RUN]
    return {"interview": _interview_reminders(db, budget),
            "round2": _round2_reminders(db, budget)}


def run_all() -> dict:
    """Advisory lock niye chalay: ekshathe duita run holeo ekta-i email pathabe."""
    if not settings.NOTIFY_REMINDERS:
        return {"skipped": "reminders are turned off"}
    lock = engine.connect().execution_options(isolation_level="AUTOCOMMIT")
    try:
        if not lock.execute(text("SELECT pg_try_advisory_lock(:k)"), {"k": LOCK_ID}).scalar():
            return {"skipped": "another run is in progress"}
        try:
            with SessionLocal() as db:
                return run_reminders(db)
        finally:
            lock.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": LOCK_ID})
    finally:
        lock.close()


if __name__ == "__main__":
    print(run_all())
