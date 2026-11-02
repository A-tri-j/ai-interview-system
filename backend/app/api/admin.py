import html
import hmac
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.core.config import settings
from app.core.rate_limit import login_limiter
from app.core.security import create_access_token, verify_password
from app.database.session import get_db
from app.models import Application, AuditLog, Candidate, Company, Vacancy
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.company import CandidateAdminOut, CompanyAdminOut
from app.services.email_service import send_email

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.post("/login", response_model=TokenResponse)
def admin_login(data: LoginRequest, request: Request):
    """Admin id/password .env theke ashe. Database-e admin lagbe na."""
    key = f"admin:{request.client.host}"
    login_limiter.check(key)

    configured = bool(settings.ADMIN_EMAIL and settings.ADMIN_PASSWORD_HASH)
    # compare_digest timing attack theke bachay
    email_ok = hmac.compare_digest(
        data.email.encode(), settings.ADMIN_EMAIL.lower().encode()
    )
    # Email vul hole-o password check kori, jate response time ek-i thake
    pass_ok = verify_password(data.password, settings.ADMIN_PASSWORD_HASH or "x")
    if not (configured and email_ok and pass_ok):
        login_limiter.record(key)
        raise HTTPException(401, "Incorrect email or password")

    login_limiter.reset(key)
    return TokenResponse(access_token=create_access_token(0, "admin", minutes=120))


@router.get("/me")
def admin_me(_: dict = Depends(get_current_admin)):
    return {"role": "admin", "email": settings.ADMIN_EMAIL}


@router.get("/stats")
def admin_stats(_: dict = Depends(get_current_admin), db: Session = Depends(get_db)):
    by_status = dict(
        db.query(Company.status, func.count(Company.id)).group_by(Company.status).all()
    )
    return {
        "candidates": db.query(func.count(Candidate.id)).scalar(),
        "companies": db.query(func.count(Company.id)).scalar(),
        "companies_by_status": by_status,
        "vacancies": db.query(func.count(Vacancy.id)).scalar(),
        "applications": db.query(func.count(Application.id)).scalar(),
    }


@router.get("/companies")
def list_companies(
    status: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    q = db.query(Company)
    if status:
        q = q.filter(Company.status == status)
    total = q.count()
    rows = (
        q.order_by(Company.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "items": [CompanyAdminOut.model_validate(c) for c in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


class CompanyStatusUpdate(BaseModel):
    status: Literal["approved", "rejected", "suspended", "pending_approval"]


@router.patch("/companies/{company_id}/status", response_model=CompanyAdminOut)
def set_company_status(
    company_id: int,
    data: CompanyStatusUpdate,
    background: BackgroundTasks,
    _: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    company = db.get(Company, company_id)
    if not company:
        raise HTTPException(404, "Company not found")
    if data.status == "approved" and not company.is_email_verified:
        raise HTTPException(400, "Company email is not verified yet")

    # Status bodlay-ni hole kichu kori na (duplicate email thamate)
    if company.status != data.status:
        old = company.status
        company.status = data.status
        db.add(
            AuditLog(
                actor_role="admin",
                action="company_status_changed",
                entity_type="company",
                entity_id=company.id,
                details={"from": old, "to": data.status},
            )
        )
        db.commit()
        db.refresh(company)
        if data.status in ("approved", "rejected"):
            word = "approved" if data.status == "approved" else "not approved"
            background.add_task(
                send_email,
                company.email,
                f"Your company registration was {word}",
                f"<p>Hello {html.escape(company.manager_name)},</p>"
                f"<p>Your company registration for <b>{html.escape(company.company_name)}</b> "
                f"was <b>{word}</b>.</p>",
            )
    return company


@router.get("/candidates")
def list_candidates(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _: dict = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    q = db.query(Candidate)
    total = q.count()
    rows = (
        q.order_by(Candidate.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "items": [CandidateAdminOut.model_validate(c) for c in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }

