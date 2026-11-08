import html
import re
from datetime import datetime, timezone
from typing import Literal
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_candidate, get_current_company
from app.api.vacancies import _public_query
from app.core.config import settings
from app.core.security import create_access_token
from app.database.session import get_db
from app.models import (
    Application,
    ApplicationStatus,
    AuditLog,
    Candidate,
    CandidateDocument,
    Company,
    CompanyStatus,
    Notification,
    Vacancy,
)
from app.services import storage
from app.services.email_service import send_email

candidate_router = APIRouter(prefix="/api/applications", tags=["applications"])
company_router = APIRouter(prefix="/api/company/applications", tags=["company applications"])

# Kon status theke kon status-e jawa jabe
ALLOWED_TRANSITIONS = {
    "submitted": {"under_review", "approved_for_interview", "rejected"},
    "under_review": {"approved_for_interview", "rejected"},
}


def _notify_once(db: Session, app: Application, kind: str, subject: str) -> bool:
    """Ek application-e ek kind-er notification ekbar-i. Duplicate email thamay."""
    exists = (
        db.query(Notification)
        .filter(
            Notification.related_application_id == app.id,
            Notification.kind == kind,
        )
        .first()
    )
    if exists:
        return False
    db.add(
        Notification(
            recipient_email=app.candidate.email,
            kind=kind,
            subject=subject,
            related_application_id=app.id,
            status="queued",
        )
    )
    return True


# ---------------- Candidate ----------------


@candidate_router.post("", status_code=201)
def apply_to_vacancy(
    background: BackgroundTasks,
    vacancy_id: int = Form(...),
    applicant_name: str = Form(..., min_length=2, max_length=150),
    applicant_email: EmailStr = Form(...),
    applicant_phone: str = Form(...),
    education: str = Form(..., min_length=2, max_length=3000),
    message: str | None = Form(None, max_length=3000),
    cv: UploadFile | None = File(None),
    candidate: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
):
    phone = re.sub(r"[\s\-]", "", applicant_phone)
    if not re.fullmatch(r"\+?[0-9]{7,15}", phone):
        raise HTTPException(422, "Enter a valid phone number")

    # Shudhu public-e dekhano vacancy-te apply kora jay
    vacancy = _public_query(db).filter(Vacancy.id == vacancy_id).first()
    if not vacancy:
        raise HTTPException(404, "Vacancy not found or no longer open")

    already = (
        db.query(Application)
        .filter(
            Application.vacancy_id == vacancy_id,
            Application.candidate_id == candidate.id,
        )
        .first()
    )
    if already:
        raise HTTPException(409, "You have already applied to this vacancy")

    new_key = None
    if cv is not None and cv.filename:
        saved = storage.save_cv(candidate.id, cv)
        new_key = saved["storage_key"]
        doc = CandidateDocument(candidate_id=candidate.id, kind="cv", **saved)
        db.add(doc)
        db.flush()
    else:
        # Notun CV na dile age upload kora sheshta-i
        doc = (
            db.query(CandidateDocument)
            .filter(CandidateDocument.candidate_id == candidate.id)
            .order_by(CandidateDocument.id.desc())
            .first()
        )
        if not doc:
            raise HTTPException(400, "Please upload your CV")

    application = Application(
        vacancy_id=vacancy.id,
        candidate_id=candidate.id,
        applicant_name=applicant_name.strip(),
        applicant_email=applicant_email.lower(),
        applicant_phone=phone,
        education=education.strip(),
        message=(message or "").strip() or None,
        cv_document_id=doc.id,
    )
    db.add(application)
    try:
        db.commit()
    except IntegrityError:
        # Ekshathe duibar click korle unique constraint ei dhore felbe
        db.rollback()
        if new_key:
            storage.delete_file(new_key)
        raise HTTPException(409, "You have already applied to this vacancy")
    except Exception:
        db.rollback()
        if new_key:
            storage.delete_file(new_key)
        raise

    background.add_task(
        send_email,
        candidate.email,
        f"Application received: {vacancy.title}",
        f"<p>Hello {html.escape(candidate.full_name)},</p>"
        f"<p>We received your application for <b>{html.escape(vacancy.title)}</b> at "
        f"<b>{html.escape(vacancy.company.company_name)}</b>. "
        f"You will be notified when the company reviews it.</p>",
    )
    return {"id": application.id, "status": application.status}


@candidate_router.get("/mine")
def my_applications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    candidate: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
):
    query = db.query(Application).filter(Application.candidate_id == candidate.id)
    total = query.count()
    rows = (
        query.options(joinedload(Application.vacancy).joinedload(Vacancy.company))
        .order_by(Application.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    # company_notes kokhono candidate-ke dekhai na
    return {
        "items": [
            {
                "id": a.id,
                "vacancy_id": a.vacancy_id,
                "job_title": a.vacancy.title,
                "company_name": a.vacancy.company.company_name,
                "status": a.status,
                "applied_at": a.created_at,
                "status_changed_at": a.status_changed_at,
            }
            for a in rows
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


# ---------------- Company ----------------


def _company_application(db: Session, company: Company, app_id: int) -> Application:
    """Onno company-r application hole 404 (ID ache kina-o bojha jabe na)."""
    app = (
        db.query(Application)
        .join(Vacancy, Application.vacancy_id == Vacancy.id)
        .options(
            joinedload(Application.vacancy),
            joinedload(Application.candidate).joinedload(Candidate.profile),
            joinedload(Application.cv_document),
        )
        .filter(Application.id == app_id, Vacancy.company_id == company.id)
        .first()
    )
    if not app:
        raise HTTPException(404, "Application not found")
    return app


@company_router.get("")
def list_company_applications(
    vacancy_id: int | None = None,
    status: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db),
):
    query = (
        db.query(Application)
        .join(Vacancy, Application.vacancy_id == Vacancy.id)
        .filter(Vacancy.company_id == company.id)
    )
    if vacancy_id:
        query = query.filter(Application.vacancy_id == vacancy_id)
    if status:
        query = query.filter(Application.status == status)
    total = query.count()
    rows = (
        query.options(joinedload(Application.vacancy))
        .order_by(Application.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "items": [
            {
                "id": a.id,
                "vacancy_id": a.vacancy_id,
                "vacancy_title": a.vacancy.title,
                "applicant_name": a.applicant_name,
                "applicant_email": a.applicant_email,
                "applicant_phone": a.applicant_phone,
                "status": a.status,
                "applied_at": a.created_at,
            }
            for a in rows
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@company_router.get("/{app_id}")
def get_company_application(
    app_id: int,
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db),
):
    a = _company_application(db, company, app_id)
    p = a.candidate.profile
    return {
        "id": a.id,
        "vacancy_id": a.vacancy_id,
        "vacancy_title": a.vacancy.title,
        "status": a.status,
        "applied_at": a.created_at,
        "applicant_name": a.applicant_name,
        "applicant_email": a.applicant_email,
        "applicant_phone": a.applicant_phone,
        "education": a.education,
        "message": a.message,
        "company_notes": a.company_notes,
        "cv_filename": a.cv_document.original_filename if a.cv_document else None,
        "profile": {
            "skills": (p.skills if p else None) or [],
            "experience": p.experience if p else None,
            "projects": p.projects if p else None,
            "portfolio_url": p.portfolio_url if p else None,
        },
    }


@company_router.get("/{app_id}/cv")
def download_cv(
    app_id: int,
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db),
):
    a = _company_application(db, company, app_id)
    if not a.cv_document:
        raise HTTPException(404, "No CV attached")
    try:
        data = storage.read_bytes(a.cv_document.storage_key)
    except FileNotFoundError:
        raise HTTPException(404, "CV file is missing")
    name = quote(a.cv_document.original_filename)
    return Response(
        content=data, media_type=a.cv_document.content_type,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{name}",
                 "X-Content-Type-Options": "nosniff"},
    )


class StatusUpdate(BaseModel):
    status: Literal["under_review", "approved_for_interview", "rejected"]
    note: str | None = Field(default=None, max_length=2000)


@company_router.patch("/{app_id}/status")
def update_application_status(
    app_id: int,
    data: StatusUpdate,
    background: BackgroundTasks,
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db),
):
    if company.status != CompanyStatus.APPROVED:
        raise HTTPException(403, "Your company must be approved to review applications")
    a = _company_application(db, company, app_id)

    if a.status == data.status:  # kono poriborton nai: kichu na kore, email-o na
        return {"id": a.id, "status": a.status, "changed": False}
    if data.status not in ALLOWED_TRANSITIONS.get(a.status, set()):
        raise HTTPException(400, f"Cannot change status from {a.status} to {data.status}")

    old = a.status
    a.status = data.status
    a.status_changed_at = datetime.now(timezone.utc)
    if data.note:
        a.company_notes = data.note
    db.add(
        AuditLog(
            actor_role="company",
            actor_id=company.id,
            action="application_status_changed",
            entity_type="application",
            entity_id=a.id,
            details={"from": old, "to": data.status},
        )
    )

    title = html.escape(a.vacancy.title)
    cname = html.escape(company.company_name)
    name = html.escape(a.candidate.full_name)
    if data.status == ApplicationStatus.APPROVED_FOR_INTERVIEW:
        subject = f"Interview invitation: {a.vacancy.title} at {company.company_name}"
        if _notify_once(db, a, "interview_invite", subject):
            # Ei link-er token ekta application-er jonno, 7 din valid
            token = create_access_token(
                a.id, "interview", minutes=settings.INTERVIEW_LINK_DAYS * 24 * 60
            )
            link = f"{settings.PUBLIC_APP_URL}/interview/{token}"
            background.add_task(
                send_email,
                a.candidate.email,
                subject,
                f"<p>Hello {name},</p>"
                f"<p>Good news! <b>{cname}</b> approved your application for <b>{title}</b>.</p>"
                f"<p>Next step: complete a short AI video interview (5-7 minutes). "
                f"Log in to your account, then open this link:</p>"
                f'<p><a href="{link}">Start your interview</a></p>'
                f"<p>The link is valid for {settings.INTERVIEW_LINK_DAYS} days.</p>",
            )
    elif data.status == ApplicationStatus.REJECTED and settings.NOTIFY_ON_REJECTION:
        subject = f"Update on your application: {a.vacancy.title}"
        if _notify_once(db, a, "application_rejected", subject):
            background.add_task(
                send_email,
                a.candidate.email,
                subject,
                f"<p>Hello {name},</p><p>Thank you for applying to <b>{title}</b> at "
                f"<b>{cname}</b>. Unfortunately we will not move forward.</p>",
            )

    db.commit()
    return {"id": a.id, "status": a.status, "changed": True}

