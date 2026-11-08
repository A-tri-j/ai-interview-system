from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_candidate
from app.api.vacancies import _public_query
from app.database.session import get_db
from app.models import (
    Application, Candidate, CompanyStatus, SavedJob, Vacancy, VacancyStatus,
)
from app.schemas.vacancy import PublicVacancyOut

router = APIRouter(prefix="/api/saved", tags=["saved jobs"])
MAX_SAVED = 200


def _is_open(v: Vacancy) -> bool:
    return (v.status == VacancyStatus.PUBLISHED and v.company.status == CompanyStatus.APPROVED
            and (v.deadline is None or v.deadline >= date.today()))


@router.get("/ids")
def saved_ids(c: Candidate = Depends(get_current_candidate), db: Session = Depends(get_db)):
    rows = db.query(SavedJob.vacancy_id).filter(SavedJob.candidate_id == c.id).all()
    return {"ids": [r[0] for r in rows]}


@router.get("")
def list_saved(c: Candidate = Depends(get_current_candidate), db: Session = Depends(get_db)):
    rows = (
        db.query(SavedJob, Vacancy)
        .join(Vacancy, SavedJob.vacancy_id == Vacancy.id)
        .options(joinedload(Vacancy.company))
        .filter(SavedJob.candidate_id == c.id)
        .order_by(SavedJob.id.desc()).limit(MAX_SAVED).all()
    )
    applied = {r[0] for r in db.query(Application.vacancy_id).filter(
        Application.candidate_id == c.id)}
    items = []
    for s, v in rows:
        if _is_open(v):
            d = PublicVacancyOut.model_validate(v).model_dump(mode="json")
            d.update(match=None, applied=v.id in applied, open=True)
        else:
            # Band/expired: shudhu naam dekhai (description-o na)
            d = {"id": v.id, "title": v.title, "open": False,
                 "company": {"company_name": v.company.company_name}}
        d["saved_at"] = s.created_at
        items.append(d)
    return {"items": items, "total": len(items)}


@router.post("/{vacancy_id}", status_code=201)
def save_job(
    vacancy_id: int, c: Candidate = Depends(get_current_candidate), db: Session = Depends(get_db),
):
    if not _public_query(db).filter(Vacancy.id == vacancy_id).first():
        raise HTTPException(404, "Vacancy not found or no longer open")
    q = db.query(SavedJob).filter(SavedJob.candidate_id == c.id)
    if q.filter(SavedJob.vacancy_id == vacancy_id).first():
        return {"saved": True}
    if q.count() >= MAX_SAVED:
        raise HTTPException(409, f"You can save up to {MAX_SAVED} jobs")
    db.add(SavedJob(candidate_id=c.id, vacancy_id=vacancy_id))
    try:
        db.commit()
    except IntegrityError:      # duibar click: onno request age save korse
        db.rollback()
    return {"saved": True}


@router.delete("/{vacancy_id}")
def unsave_job(
    vacancy_id: int, c: Candidate = Depends(get_current_candidate), db: Session = Depends(get_db),
):
    db.query(SavedJob).filter(
        SavedJob.candidate_id == c.id, SavedJob.vacancy_id == vacancy_id
    ).delete(synchronize_session=False)
    db.commit()
    return {"saved": False}
