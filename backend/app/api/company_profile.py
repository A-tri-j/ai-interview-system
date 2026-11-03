import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_company
from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.database.session import get_db
from app.models import Application, Company, Vacancy
from app.schemas.candidate import ChangePassword

router = APIRouter(prefix="/api/company", tags=["company account"])


class CompanyProfileUpdate(BaseModel):
    """Company name, email, registration number admin chhara bodlano jay na."""

    manager_name: str | None = Field(default=None, min_length=2, max_length=150)
    manager_designation: str | None = Field(default=None, min_length=2, max_length=150)
    phone: str | None = None
    industry: str | None = Field(default=None, min_length=2, max_length=100)
    company_size: str | None = Field(default=None, min_length=1, max_length=50)
    address: str | None = Field(default=None, min_length=5, max_length=500)
    website: str | None = Field(default=None, max_length=300)
    description: str | None = Field(default=None, max_length=3000)

    @field_validator("phone")
    @classmethod
    def valid_phone(cls, v):
        if v is None:
            return v
        cleaned = re.sub(r"[\s\-]", "", v)
        if not re.fullmatch(r"\+?[0-9]{7,15}", cleaned):
            raise ValueError("Enter a valid phone number")
        return cleaned

    @field_validator("website")
    @classmethod
    def valid_site(cls, v):
        if v and not re.match(r"^https?://", v):
            raise ValueError("Website must start with http:// or https://")
        return v or None


def _out(c: Company) -> dict:
    return {
        "company_name": c.company_name,
        "email": c.email,
        "registration_number": c.registration_number,
        "manager_name": c.manager_name,
        "manager_designation": c.manager_designation,
        "phone": c.phone,
        "industry": c.industry,
        "company_size": c.company_size,
        "address": c.address,
        "website": c.website,
        "description": c.description,
        "status": c.status,
    }


@router.get("/profile")
def get_profile(company: Company = Depends(get_current_company)):
    return _out(company)


@router.put("/profile")
def update_profile(
    data: CompanyProfileUpdate,
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db),
):
    changes = data.model_dump(exclude_unset=True)
    for key, value in changes.items():
        if value is None and key not in ("website", "description"):
            raise HTTPException(422, f"{key} cannot be empty")
        setattr(company, key, value)
    db.commit()
    db.refresh(company)
    return _out(company)


@router.post("/change-password")
def change_password(
    data: ChangePassword,
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db),
):
    if data.new_password != data.confirm_password:
        raise HTTPException(422, "Passwords do not match")
    if not verify_password(data.current_password, company.password_hash):
        raise HTTPException(400, "Current password is incorrect")
    company.password_hash = hash_password(data.new_password)
    company.password_changed_at = datetime.now(timezone.utc)  # purano token batil
    db.commit()
    token = create_access_token(company.id, "company", settings.COMPANY_SESSION_HOURS * 60)
    return {"message": "Password changed", "access_token": token, "token_type": "bearer"}


@router.get("/dashboard")
def dashboard(
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db),
):
    """Hiring progress: vacancy ar application-er status gonona."""
    vac = dict(
        db.query(Vacancy.status, func.count(Vacancy.id))
        .filter(Vacancy.company_id == company.id)
        .group_by(Vacancy.status)
        .all()
    )
    apps = dict(
        db.query(Application.status, func.count(Application.id))
        .join(Vacancy, Application.vacancy_id == Vacancy.id)
        .filter(Vacancy.company_id == company.id)
        .group_by(Application.status)
        .all()
    )
    return {
        "company_status": company.status,
        "vacancies_by_status": vac,
        "applications_by_status": apps,
        "applications_total": sum(apps.values()),
    }

