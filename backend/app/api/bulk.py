# Bulk status change ar CSV export. Shudhu nijer company-r application.
import csv
import html
import io
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session, joinedload

from app.api.applications import _notify_once
from app.api.ranking import combine
from app.api.deps import get_current_company
from app.core.config import settings
from app.database.session import get_db
from app.models import (
    Application, ApplicationStatus, AuditLog, Company, CompanyStatus, InterviewReport,
    InterviewSession, McqStatus, McqTest, Vacancy,
)
from app.services.email_service import send_email

router = APIRouter(prefix="/api/company", tags=["bulk actions and export"])

S = ApplicationStatus
# new status -> kon status theke jawa jabe
BULK_FROM = {
    "under_review": {S.SUBMITTED},
    "rejected": {S.SUBMITTED, S.UNDER_REVIEW},                       # interview-er age
    "shortlisted": {S.INTERVIEW_COMPLETED, S.ON_HOLD},
    "final_rejected": {S.INTERVIEW_COMPLETED, S.SHORTLISTED, S.ON_HOLD},  # interview-er por
}
MAX_EXPORT = 5000


class BulkIn(BaseModel):
    ids: list[int] = Field(min_length=1, max_length=100)
    status: Literal["under_review", "rejected", "shortlisted", "final_rejected"]

    @field_validator("ids")
    @classmethod
    def unique(cls, v: list[int]) -> list[int]:
        return list(dict.fromkeys(v))


@router.post("/bulk/applications/status")
def bulk_status(
    data: BulkIn, background: BackgroundTasks,
    company: Company = Depends(get_current_company), db: Session = Depends(get_db),
):
    if company.status != CompanyStatus.APPROVED:
        raise HTTPException(403, "Your company must be approved to review applications")

    # Onno company-r ID query-te-i ashe na, tai "not_found" hishebe skip hoy
    rows = (
        db.query(Application)
        .join(Vacancy, Application.vacancy_id == Vacancy.id)
        .options(joinedload(Application.vacancy), joinedload(Application.candidate))
        .filter(Application.id.in_(data.ids), Vacancy.company_id == company.id)
        .with_for_update(of=Application)      # ekshathe duita bulk chalale ekbar-i hoy
        .all()
    )
    by_id = {a.id: a for a in rows}
    allowed = BULK_FROM[data.status]
    now = datetime.now(timezone.utc)
    results, changed = [], 0

    for app_id in data.ids:
        a = by_id.get(app_id)
        if a is None:
            results.append({"id": app_id, "result": "skipped", "reason": "not_found"})
            continue
        if a.status == data.status:
            results.append({"id": app_id, "result": "skipped", "reason": "already"})
            continue
        if a.status not in allowed:
            results.append({"id": app_id, "result": "skipped", "reason": "not_allowed"})
            continue

        old = a.status
        a.status = data.status
        a.status_changed_at = now
        db.add(AuditLog(
            actor_role="company", actor_id=company.id, action=(
                "hiring_decision" if data.status in ("shortlisted", "final_rejected")
                else "application_status_changed"),
            entity_type="application", entity_id=a.id,
            details={"from": old, "to": data.status, "bulk": True}))

        # Reject-e email default-e jay na. Jele-o ekjon-ke ekbar-i.
        if data.status in ("rejected", "final_rejected") and settings.NOTIFY_ON_REJECTION:
            kind = "application_rejected" if data.status == "rejected" else "hiring_rejected"
            subject = f"Update on your application: {a.vacancy.title}"
            if _notify_once(db, a, kind, subject):
                background.add_task(
                    send_email, a.candidate.email, subject,
                    f"<p>Hello {html.escape(a.candidate.full_name)},</p>"
                    f"<p>Thank you for your interest in <b>{html.escape(a.vacancy.title)}</b> at "
                    f"<b>{html.escape(company.company_name)}</b>. Unfortunately we will not be "
                    f"moving forward.</p>")
        results.append({"id": app_id, "result": "changed", "reason": None})
        changed += 1

    db.commit()
    return {"requested": len(data.ids), "changed": changed,
            "skipped": len(data.ids) - changed, "results": results}


# ---------------- CSV export ----------------

def _safe(value) -> str:
    """CSV injection: Excel =, +, -, @ diye shuru text-ke formula bhabe. Age ' boshai."""
    if value is None:
        return ""
    s = str(value)
    return "'" + s if s[:1] in ("=", "+", "-", "@", "\t", "\r") else s


def _num(value) -> str:
    return "" if value is None else f"{float(value):.1f}"


@router.get("/exports/applications.csv")
def export_applications(
    vacancy_id: int | None = Query(None), status: str | None = Query(None, max_length=40),
    company: Company = Depends(get_current_company), db: Session = Depends(get_db),
):
    q = (
        db.query(Application, Vacancy.title, InterviewReport.overall_score,
                 McqTest.score, McqTest.status)
        .join(Vacancy, Application.vacancy_id == Vacancy.id)
        .outerjoin(InterviewSession, InterviewSession.application_id == Application.id)
        .outerjoin(InterviewReport, InterviewReport.session_id == InterviewSession.id)
        .outerjoin(McqTest, McqTest.application_id == Application.id)
        .filter(Vacancy.company_id == company.id)
    )
    if vacancy_id is not None:
        q = q.filter(Application.vacancy_id == vacancy_id)
    if status:
        q = q.filter(Application.status == status)
    rows = q.order_by(Application.id).limit(MAX_EXPORT).all()

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Application ID", "Vacancy", "Name", "Email", "Phone", "Education", "Applied on",
                "Status", "Round 1 AI score (0-100)", "Round 2 MCQ score (0-100)",
                "Combined score (0-100)"])
    for app, title, r1, r2, s2 in rows:
        r2 = r2 if s2 == McqStatus.SUBMITTED else None
        w.writerow([
            app.id, _safe(title), _safe(app.applicant_name), _safe(app.applicant_email),
            _safe(app.applicant_phone), _safe(app.education),
            app.created_at.date().isoformat() if app.created_at else "",
            app.status, _num(r1), _num(r2), _num(combine(r1, r2)),
        ])

    db.add(AuditLog(
        actor_role="company", actor_id=company.id, action="applications_exported",
        entity_type="company", entity_id=company.id,
        details={"rows": len(rows), "vacancy_id": vacancy_id, "status": status}))
    db.commit()

    name = f"applicants-{datetime.now(timezone.utc).date().isoformat()}.csv"
    return Response(
        content="\ufeff" + buf.getvalue(),            # BOM: Excel-e Bengali naam thik dekhay
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{name}"',
                 "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
    )

