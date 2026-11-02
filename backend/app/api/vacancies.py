from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Text, cast, or_
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_company
from app.database.session import get_db
from app.models import AuditLog, Company, CompanyStatus, Vacancy, VacancyStatus
from app.schemas.vacancy import PublicVacancyOut, VacancyCreate, VacancyOut, VacancyUpdate

public_router = APIRouter(prefix="/api/vacancies", tags=["public vacancies"])
company_router = APIRouter(prefix="/api/company/vacancies", tags=["company vacancies"])


# ---------------- Public (login lagbe na) ----------------

def _like(text: str) -> str:
    """User-er %, _ jate wildcard hishebe kaj na kore."""
    escaped = text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def _public_query(db: Session):
    """Public-e shudhu: published + deadline pare ni + company approved."""
    return (
        db.query(Vacancy)
        .join(Company, Vacancy.company_id == Company.id)
        .options(joinedload(Vacancy.company))
        .filter(
            Vacancy.status == VacancyStatus.PUBLISHED,
            Company.status == CompanyStatus.APPROVED,
            or_(Vacancy.deadline.is_(None), Vacancy.deadline >= date.today()),
        )
    )


@public_router.get("")
def list_public_vacancies(
    q: str | None = Query(None, max_length=100, description="title, company, skill, location"),
    location: str | None = Query(None, max_length=100),
    employment_type: str | None = None,
    work_mode: str | None = None,
    experience: str | None = Query(None, max_length=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=50),
    db: Session = Depends(get_db),
):
    query = _public_query(db)
    if q:
        pattern = _like(q.strip())
        query = query.filter(
            or_(
                Vacancy.title.ilike(pattern, escape="\\"),
                Company.company_name.ilike(pattern, escape="\\"),
                Vacancy.location.ilike(pattern, escape="\\"),
                cast(Vacancy.required_skills, Text).ilike(pattern, escape="\\"),
                cast(Vacancy.required_technologies, Text).ilike(pattern, escape="\\"),
            )
        )
    if location:
        query = query.filter(Vacancy.location.ilike(_like(location.strip()), escape="\\"))
    if employment_type:
        query = query.filter(Vacancy.employment_type == employment_type)
    if work_mode:
        query = query.filter(Vacancy.work_mode == work_mode)
    if experience:
        query = query.filter(
            Vacancy.experience_requirements.ilike(_like(experience.strip()), escape="\\")
        )

    total = query.count()
    rows = (
        query.order_by(Vacancy.created_at.desc(), Vacancy.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "items": [PublicVacancyOut.model_validate(v) for v in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@public_router.get("/{vacancy_id}", response_model=PublicVacancyOut)
def get_public_vacancy(vacancy_id: int, db: Session = Depends(get_db)):
    vacancy = _public_query(db).filter(Vacancy.id == vacancy_id).first()
    if not vacancy:
        raise HTTPException(404, "Vacancy not found")
    return vacancy


# ---------------- Company (nijer vacancy-ই shudhu) ----------------

def _own_vacancy(db: Session, company: Company, vacancy_id: int) -> Vacancy:
    """Onno company-r vacancy hole-o 404 dei, jate ID-ta ache kina-o bojha na jay."""
    vacancy = (
        db.query(Vacancy)
        .filter(Vacancy.id == vacancy_id, Vacancy.company_id == company.id)
        .first()
    )
    if not vacancy:
        raise HTTPException(404, "Vacancy not found")
    return vacancy


def _audit(db: Session, company: Company, action: str, vacancy: Vacancy, **details):
    db.add(
        AuditLog(
            actor_role="company",
            actor_id=company.id,
            action=action,
            entity_type="vacancy",
            entity_id=vacancy.id,
            details=details or None,
        )
    )


@company_router.post("", response_model=VacancyOut, status_code=201)
def create_vacancy(
    data: VacancyCreate,
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db),
):
    # Sob vacancy draft hishebe shuru hoy. Publish alada step.
    vacancy = Vacancy(
        **data.model_dump(), company_id=company.id, status=VacancyStatus.DRAFT
    )
    db.add(vacancy)
    db.commit()
    db.refresh(vacancy)
    return vacancy


@company_router.get("")
def list_own_vacancies(
    status: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db),
):
    query = db.query(Vacancy).filter(Vacancy.company_id == company.id)
    if status:
        query = query.filter(Vacancy.status == status)
    total = query.count()
    rows = (
        query.order_by(Vacancy.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "items": [VacancyOut.model_validate(v) for v in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@company_router.get("/{vacancy_id}", response_model=VacancyOut)
def get_own_vacancy(
    vacancy_id: int,
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db),
):
    return _own_vacancy(db, company, vacancy_id)


@company_router.patch("/{vacancy_id}", response_model=VacancyOut)
def update_vacancy(
    vacancy_id: int,
    data: VacancyUpdate,
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db),
):
    vacancy = _own_vacancy(db, company, vacancy_id)
    if vacancy.status == VacancyStatus.CLOSED:
        raise HTTPException(
            400, "A closed vacancy cannot be edited. Re-publish it first."
        )

    changes = data.model_dump(exclude_unset=True)
    # Je field null pathano jabe na (database-e NOT NULL)
    for required in (
        "title",
        "description",
        "employment_type",
        "location",
        "work_mode",
        "openings",
    ):
        if required in changes and changes[required] is None:
            raise HTTPException(422, f"{required} cannot be empty")
    for key, value in changes.items():
        setattr(vacancy, key, value)
    _audit(db, company, "vacancy_updated", vacancy, fields=sorted(changes))
    db.commit()
    db.refresh(vacancy)
    return vacancy


@company_router.post("/{vacancy_id}/publish", response_model=VacancyOut)
def publish_vacancy(
    vacancy_id: int,
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db),
):
    # Shudhu approved company publish korte parbe
    if company.status != CompanyStatus.APPROVED:
        raise HTTPException(
            403, "Your company must be approved by admin before publishing"
        )
    vacancy = _own_vacancy(db, company, vacancy_id)
    if vacancy.deadline and vacancy.deadline < date.today():
        raise HTTPException(400, "The application deadline is in the past")
    if vacancy.status != VacancyStatus.PUBLISHED:
        vacancy.status = VacancyStatus.PUBLISHED
        _audit(db, company, "vacancy_published", vacancy)
        db.commit()
        db.refresh(vacancy)
    return vacancy


@company_router.post("/{vacancy_id}/close", response_model=VacancyOut)
def close_vacancy(
    vacancy_id: int,
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db),
):
    vacancy = _own_vacancy(db, company, vacancy_id)
    if vacancy.status != VacancyStatus.CLOSED:
        vacancy.status = VacancyStatus.CLOSED
        _audit(db, company, "vacancy_closed", vacancy)
        db.commit()
        db.refresh(vacancy)
    return vacancy

