# Home page-er stats: login lagbe na, shudhu public data. 60 second cache.
import time
from collections import Counter
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models import Company, CompanyStatus, Vacancy, VacancyStatus

router = APIRouter(prefix="/api/public", tags=["public"])
_cache = {"at": 0.0, "data": None}
TTL = 60


def _open(db: Session):
    return (
        db.query(Vacancy).join(Company, Vacancy.company_id == Company.id)
        .filter(Vacancy.status == VacancyStatus.PUBLISHED,
                Company.status == CompanyStatus.APPROVED,
                or_(Vacancy.deadline.is_(None), Vacancy.deadline >= date.today()))
    )


@router.get("/stats")
def stats(db: Session = Depends(get_db)):
    if _cache["data"] and time.time() - _cache["at"] < TTL:
        return _cache["data"]
    base = _open(db)
    skills, names = Counter(), {}
    for rs, rt in base.with_entities(Vacancy.required_skills, Vacancy.required_technologies).limit(300):
        per = {}
        for s in (rs or []) + (rt or []):
            if s and s.strip():
                per.setdefault(s.strip().lower(), s.strip())
        for k, v in per.items():
            skills[k] += 1
            names.setdefault(k, v)
    data = {
        "open_jobs": base.count(),
        "companies_hiring": base.with_entities(func.count(func.distinct(Vacancy.company_id))).scalar() or 0,
        "by_work_mode": dict(base.with_entities(Vacancy.work_mode, func.count(Vacancy.id))
                             .group_by(Vacancy.work_mode).all()),
        "by_employment_type": dict(base.with_entities(Vacancy.employment_type, func.count(Vacancy.id))
                                   .group_by(Vacancy.employment_type).all()),
        "top_skills": [{"name": names[k], "count": n} for k, n in skills.most_common(8)],
    }
    _cache.update(at=time.time(), data=data)
    return data
