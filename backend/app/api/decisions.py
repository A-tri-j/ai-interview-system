# Interview-er por company-r final decision. AI shudhu suggest kore, decision manush-er.
import html
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.applications import _company_application, _notify_once
from app.api.deps import get_current_company
from app.core.config import settings
from app.database.session import get_db
from app.models import ApplicationStatus, AuditLog, Company, CompanyStatus
from app.services.email_service import send_email

router = APIRouter(prefix="/api/company/applications", tags=["hiring decisions"])

DECISION_TO_STATUS = {
    "shortlisted": ApplicationStatus.SHORTLISTED,
    "accepted": ApplicationStatus.ACCEPTED,
    "rejected": ApplicationStatus.FINAL_REJECTED,
    "on_hold": ApplicationStatus.ON_HOLD,
}
# Interview shesh hole-i decision deya jabe. Accepted/rejected final.
DECIDABLE_FROM = {
    ApplicationStatus.INTERVIEW_COMPLETED,
    ApplicationStatus.SHORTLISTED,
    ApplicationStatus.ON_HOLD,
}


class DecisionIn(BaseModel):
    decision: Literal["shortlisted", "accepted", "rejected", "on_hold"]
    note: str | None = Field(default=None, max_length=2000)       # internal note
    message: str | None = Field(default=None, max_length=2000)    # candidate-ke email-e jabe (accept)


class NotesIn(BaseModel):
    note: str = Field(max_length=5000)


@router.patch("/{app_id}/decision")
def record_decision(
    app_id: int, data: DecisionIn, background: BackgroundTasks,
    company: Company = Depends(get_current_company), db: Session = Depends(get_db),
):
    if company.status != CompanyStatus.APPROVED:
        raise HTTPException(403, "Your company must be approved to make decisions")
    a = _company_application(db, company, app_id)
    new_status = DECISION_TO_STATUS[data.decision]

    if a.status == new_status:  # kono poriborton nai: email-o na
        return {"id": a.id, "status": a.status, "changed": False}
    if a.status not in DECIDABLE_FROM:
        raise HTTPException(400, "A decision can be recorded only after the interview is completed")

    old = a.status
    a.status = new_status
    a.status_changed_at = datetime.now(timezone.utc)
    if data.note:
        a.company_notes = data.note
    db.add(AuditLog(
        actor_role="company", actor_id=company.id, action="hiring_decision",
        entity_type="application", entity_id=a.id,
        details={"from": old, "to": new_status},
    ))

    cname = html.escape(company.company_name)
    title = html.escape(a.vacancy.title)
    name = html.escape(a.candidate.full_name)

    if data.decision == "accepted":
        subject = f"Congratulations! {a.vacancy.title} at {company.company_name}"
        if _notify_once(db, a, "hiring_accepted", subject):
            extra = (f"<p>{html.escape(data.message)}</p>" if data.message
                     else "<p>The company will contact you soon with the next steps.</p>")
            background.add_task(
                send_email, a.candidate.email, subject,
                f"<p>Hello {name},</p>"
                f"<p>We are pleased to inform you that <b>{cname}</b> has accepted you "
                f"for the role of <b>{title}</b>.</p>{extra}",
            )
    elif data.decision == "rejected" and settings.NOTIFY_ON_REJECTION:
        # Default-e rejection-e kono email jay na
        subject = f"Update on your application: {a.vacancy.title}"
        if _notify_once(db, a, "hiring_rejected", subject):
            background.add_task(
                send_email, a.candidate.email, subject,
                f"<p>Hello {name},</p><p>Thank you for interviewing for <b>{title}</b> at "
                f"<b>{cname}</b>. We will not be moving forward.</p>",
            )

    db.commit()
    return {"id": a.id, "status": a.status, "changed": True}


@router.put("/{app_id}/notes")
def save_notes(
    app_id: int, data: NotesIn,
    company: Company = Depends(get_current_company), db: Session = Depends(get_db),
):
    a = _company_application(db, company, app_id)
    a.company_notes = data.note
    db.commit()
    return {"id": a.id, "company_notes": a.company_notes}

