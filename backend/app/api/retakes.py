# Company candidate-ke Round 1 / Round 2 abar dite pare (technical somossa-r jonno).
# Purano data muche jay, tai audit log-e age-r score ar karon likhe rakhi.
import html
import logging
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from app.api.applications import _company_application
from app.api.deps import get_current_company
from app.core.config import settings
from app.database.session import get_db
from app.models import (
    ApplicationStatus, AuditLog, Company, CompanyStatus, InterviewRecording,
    InterviewReport, InterviewSession, McqTest, Notification,
)
from app.services import recording_storage as rec
from app.services.email_service import send_email

logger = logging.getLogger("retakes")
router = APIRouter(prefix="/api/company/applications", tags=["retakes"])

R1_ALLOWED = {ApplicationStatus.APPROVED_FOR_INTERVIEW, ApplicationStatus.INTERVIEW_COMPLETED}
R2_ALLOWED = {
    ApplicationStatus.INTERVIEW_COMPLETED, ApplicationStatus.SHORTLISTED, ApplicationStatus.ON_HOLD,
}


class ResetIn(BaseModel):
    reason: str

    @field_validator("reason")
    @classmethod
    def clean(cls, v: str) -> str:
        v = " ".join(v.split())
        if not 5 <= len(v) <= 300:
            raise ValueError("Please give a reason (5 to 300 characters)")
        return v


def _used(db: Session, app_id: int, action: str) -> int:
    return db.query(AuditLog.id).filter(
        AuditLog.action == action, AuditLog.entity_type == "application",
        AuditLog.entity_id == app_id).count()


def _check_company(company: Company) -> None:
    if company.status != CompanyStatus.APPROVED:
        raise HTTPException(403, "Your company must be approved")


def _inform(db: Session, a, kind: str, subject: str, body: str, background: BackgroundTasks) -> None:
    # kind-e random suffix: protita reset-e alada notification (ager-ta block kore na)
    db.add(Notification(
        recipient_email=a.candidate.email, kind=f"{kind}:{uuid4().hex[:8]}", subject=subject,
        related_application_id=a.id, status="queued"))
    background.add_task(send_email, a.candidate.email, subject, body)


@router.get("/{app_id}/retake-info")
def retake_info(
    app_id: int, company: Company = Depends(get_current_company), db: Session = Depends(get_db),
):
    a = _company_application(db, company, app_id)
    limit = settings.RETAKE_LIMIT
    session = db.query(InterviewSession.id).filter(InterviewSession.application_id == a.id).first()
    test = db.query(McqTest.id).filter(McqTest.application_id == a.id).first()
    u1, u2 = _used(db, a.id, "round1_reset"), _used(db, a.id, "round2_reset")

    def reason(allowed: bool, exists: bool, used: int, name: str) -> str | None:
        if not allowed:
            return "A final decision was already recorded." if name == "r1" else "Not available at this stage."
        if not exists:
            return "The candidate has not started this round." if name == "r1" else "The candidate has not opened Round 2."
        if used >= limit:
            return f"Reset limit reached ({limit})."
        return None

    b1 = reason(a.status in R1_ALLOWED, session is not None, u1, "r1")
    b2 = reason(a.status in R2_ALLOWED, test is not None, u2, "r2")
    return {
        "limit": limit,
        "round1": {"can_reset": b1 is None, "used": u1, "blocked_reason": b1},
        "round2": {"can_reset": b2 is None, "used": u2, "blocked_reason": b2},
    }


@router.post("/{app_id}/reset-round1")
def reset_round1(
    app_id: int, data: ResetIn, background: BackgroundTasks,
    company: Company = Depends(get_current_company), db: Session = Depends(get_db),
):
    _check_company(company)
    a = _company_application(db, company, app_id)
    if a.status not in R1_ALLOWED:
        raise HTTPException(409, "Round 1 can only be reset before a final decision is recorded")

    session = (
        db.query(InterviewSession).filter(InterviewSession.application_id == a.id)
        .with_for_update().first()
    )
    if not session:
        raise HTTPException(409, "The candidate has not started Round 1")
    used = _used(db, a.id, "round1_reset")
    if used >= settings.RETAKE_LIMIT:
        raise HTTPException(409, f"Reset limit reached ({settings.RETAKE_LIMIT})")

    keys = [r[0] for r in db.query(InterviewRecording.storage_key).filter(
        InterviewRecording.session_id == session.id, InterviewRecording.deleted_at.is_(None))]
    prev_score = db.query(InterviewReport.overall_score).filter(
        InterviewReport.session_id == session.id).scalar()
    prev = {"session_status": session.status, "ai_score": prev_score}

    # Reminder abar jate jete pare. Session delete-e question/answer/recording/report DB cascade-e jay.
    db.query(Notification).filter(
        Notification.related_application_id == a.id, Notification.kind == "reminder_interview"
    ).delete(synchronize_session=False)
    db.query(InterviewSession).filter(InterviewSession.id == session.id).delete(synchronize_session=False)

    a.status = ApplicationStatus.APPROVED_FOR_INTERVIEW
    a.status_changed_at = datetime.now(timezone.utc)
    db.add(AuditLog(
        actor_role="company", actor_id=company.id, action="round1_reset",
        entity_type="application", entity_id=a.id,
        details={"reason": data.reason, "attempt": used + 1, "previous": prev}))

    link = f"{settings.PUBLIC_APP_URL}/interview/start/{a.id}"
    _inform(db, a, "retake_round1", f"Your interview for {a.vacancy.title} was reopened",
            f"<p>Hello {html.escape(a.candidate.full_name)},</p>"
            f"<p><b>{html.escape(company.company_name)}</b> reopened the video interview for "
            f"<b>{html.escape(a.vacancy.title)}</b> so you can take it again. Your earlier "
            f"attempt was removed.</p>"
            f"<p>Please log in and open the link. It is valid for {settings.INTERVIEW_LINK_DAYS} days.</p>"
            f'<p><a href="{link}">Start your interview</a></p>', background)
    db.commit()

    for k in keys:          # file shesh-e: DB fail hole file hariye jabe na
        try:
            rec.delete(k)
        except Exception:  # noqa: BLE001
            logger.exception("Orphan recording file left: %s", k)
    return {"status": a.status, "remaining": settings.RETAKE_LIMIT - used - 1}


@router.post("/{app_id}/reset-round2")
def reset_round2(
    app_id: int, data: ResetIn, background: BackgroundTasks,
    company: Company = Depends(get_current_company), db: Session = Depends(get_db),
):
    _check_company(company)
    a = _company_application(db, company, app_id)
    if a.status not in R2_ALLOWED:
        raise HTTPException(409, "Round 2 cannot be reset at this stage")

    test = db.query(McqTest).filter(McqTest.application_id == a.id).with_for_update().first()
    if not test:
        raise HTTPException(409, "The candidate has not opened Round 2")
    used = _used(db, a.id, "round2_reset")
    if used >= settings.RETAKE_LIMIT:
        raise HTTPException(409, f"Reset limit reached ({settings.RETAKE_LIMIT})")

    prev = {"status": test.status, "score": test.score, "correct": test.correct,
            "total": test.total, "auto_submitted": test.auto_submitted}
    # Test muchle abar shuru-te notun question toiri hoy (prepare idempotent, test nei = notun)
    db.query(McqTest).filter(McqTest.id == test.id).delete(synchronize_session=False)
    db.add(AuditLog(
        actor_role="company", actor_id=company.id, action="round2_reset",
        entity_type="application", entity_id=a.id,
        details={"reason": data.reason, "attempt": used + 1, "previous": prev}))

    link = f"{settings.PUBLIC_APP_URL}/round2/{a.id}"
    _inform(db, a, "retake_round2", f"Round 2 for {a.vacancy.title} was reopened",
            f"<p>Hello {html.escape(a.candidate.full_name)},</p>"
            f"<p><b>{html.escape(company.company_name)}</b> reopened the Round 2 MCQ test for "
            f"<b>{html.escape(a.vacancy.title)}</b> so you can take it again. You will get a new "
            f"set of questions, and your earlier attempt was removed.</p>"
            f"<p>The timer starts only when you press Start.</p>"
            f'<p><a href="{link}">Open Round 2</a></p>', background)
    db.commit()
    return {"status": a.status, "remaining": settings.RETAKE_LIMIT - used - 1}

