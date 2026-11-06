# Candidate-er job finder. Kono data save hoy na, company/admin kichu dekhe na.
import logging
from collections import Counter

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import Text, cast, or_
from sqlalchemy.orm import Session

from app.ai import recommender as rec
from app.ai.groq_client import AIUnavailable
from app.api.deps import get_current_candidate
from app.api.vacancies import _like, _public_query
from app.core.rate_limit import ai_limiter, topics_limiter
from app.database.session import get_db
from app.models import Application, Candidate, Vacancy
from app.schemas.vacancy import PublicVacancyOut

logger = logging.getLogger("recommender")
router = APIRouter(prefix="/api/recommend", tags=["job finder"])

RELAX_ORDER = ("experience", "location", "employment_type", "work_mode")


class FiltersIn(BaseModel):
    keywords: list[str] = Field(default_factory=list, max_length=10)
    location: str | None = Field(default=None, max_length=100)
    work_mode: str | None = Field(default=None, max_length=20)
    employment_type: str | None = Field(default=None, max_length=20)
    experience: str | None = Field(default=None, max_length=100)


class SearchIn(BaseModel):
    message: str | None = Field(default=None, max_length=300)
    filters: FiltersIn = Field(default_factory=FiltersIn)


class TopicsIn(BaseModel):
    vacancy_id: int | None = None


def _query(db: Session, f: dict) -> list[Vacancy]:
    q = _public_query(db)         # shudhu published + deadline pare ni + company approved
    if f["keywords"]:
        conds = []
        for k in f["keywords"]:
            p = _like(k)
            conds += [
                Vacancy.title.ilike(p, escape="\\"), Vacancy.department.ilike(p, escape="\\"),
                Vacancy.location.ilike(p, escape="\\"),
                cast(Vacancy.required_skills, Text).ilike(p, escape="\\"),
                cast(Vacancy.required_technologies, Text).ilike(p, escape="\\"),
            ]
        q = q.filter(or_(*conds))
    if f["location"]:
        q = q.filter(Vacancy.location.ilike(_like(f["location"]), escape="\\"))
    if f["work_mode"]:
        q = q.filter(Vacancy.work_mode == f["work_mode"])
    if f["employment_type"]:
        q = q.filter(Vacancy.employment_type == f["employment_type"])
    if f["experience"]:
        q = q.filter(Vacancy.experience_requirements.ilike(_like(f["experience"]), escape="\\"))
    return q.order_by(Vacancy.created_at.desc()).limit(80).all()


def _hits(v: Vacancy, kws: list[str]) -> int:
    hay = " ".join([v.title, v.department or "", *(v.required_skills or []),
                    *(v.required_technologies or [])]).lower()
    return sum(1 for k in kws if k.lower() in hay)


def _find(db: Session, f: dict) -> tuple[list[Vacancy], list[str]]:
    """Kichu na pele ek ek filter dhile kore (experience age, work mode shesh)."""
    cur, relaxed = dict(f), []
    rows = _query(db, cur)
    for key in RELAX_ORDER:
        if rows:
            break
        if cur.get(key):
            cur[key] = None
            relaxed.append(key)
            rows = _query(db, cur)
    rows.sort(key=lambda v: (-_hits(v, f["keywords"]), -v.created_at.timestamp()))
    return rows[:12], relaxed


def _scores(db: Session, candidate: Candidate, vacancies: list[Vacancy]) -> dict:
    """CV thakle match %. Kono karone fail hole match chhara-i result dei."""
    if not vacancies:
        return {}
    try:
        ctx = rec.cv_context(db, candidate.id)
        if not ctx or ctx.get("error"):
            return {}
        return rec.score_many(ctx, vacancies)
    except Exception:  # noqa: BLE001
        logger.exception("Match scoring failed")
        return {}


def _item(v: Vacancy, match: dict | None, applied: bool = False) -> dict:
    d = PublicVacancyOut.model_validate(v).model_dump(mode="json")
    d["match"] = match
    d["applied"] = applied
    return d


@router.post("/search")
def search(
    data: SearchIn, c: Candidate = Depends(get_current_candidate), db: Session = Depends(get_db),
):
    f = rec.clean_filters(data.filters.model_dump())
    used_ai = False
    message = (data.message or "").strip()
    if message:
        key = f"rec:{c.id}"
        ai_limiter.check(key)
        ai_limiter.record(key)
        parsed, used_ai = rec.parse_message(message)
        f = rec.merge_filters(f, parsed)

    rows, relaxed = _find(db, f)
    scores = _scores(db, c, rows)
    applied = {r[0] for r in db.query(Application.vacancy_id).filter(
        Application.candidate_id == c.id, Application.vacancy_id.in_([v.id for v in rows]))}
    return {
        "understood": f, "relaxed": relaxed, "used_ai": used_ai, "personalized": bool(scores),
        "total": len(rows), "items": [_item(v, scores.get(v.id), v.id in applied) for v in rows],
    }


@router.get("/matches")
def matches(c: Candidate = Depends(get_current_candidate), db: Session = Depends(get_db)):
    ctx = rec.cv_context(db, c.id)
    if ctx is None:
        return {"has_cv": False}
    doc = ctx["doc"]
    base = {"has_cv": True, "cv_filename": doc.original_filename, "uploaded_at": doc.created_at}
    if ctx.get("error"):
        return {**base, "readable": False,
                "message": "We could not read text from this CV. Upload a text-based PDF or DOCX "
                           "(scanned images cannot be read)."}

    vacancies = _public_query(db).order_by(Vacancy.created_at.desc()).limit(300).all()
    extra = [t for v in vacancies for t in rec.vacancy_terms(v)][:400]
    skills_found = rec.detect_skills(ctx["lower"], extra)
    try:
        scores = rec.score_many(ctx, vacancies)
    except Exception:  # noqa: BLE001
        logger.exception("Matching failed")
        raise HTTPException(503, "Could not analyse your CV right now. Please try again.")

    ranked = sorted(vacancies, key=lambda v: -scores[v.id]["percent"])[:20]
    applied = {r[0] for r in db.query(Application.vacancy_id).filter(
        Application.candidate_id == c.id)}
    gaps = Counter(m for v in ranked[:10] for m in scores[v.id]["missing"])
    return {
        **base, "readable": True, "skills_found": skills_found,
        "skill_gaps": [{"skill": s, "jobs": n} for s, n in gaps.most_common(8)],
        "items": [_item(v, scores[v.id], v.id in applied) for v in ranked],
        "note": "Match % compares your CV text with each vacancy's requirements. It is an "
                "estimate to help you choose where to apply, not a hiring prediction.",
    }


@router.post("/cv-topics")
def cv_topics(
    data: TopicsIn, c: Candidate = Depends(get_current_candidate), db: Session = Depends(get_db),
):
    key = f"topics:{c.id}"
    topics_limiter.check(key)

    ctx = rec.cv_context(db, c.id, need_vec=False)
    if ctx is None:
        raise HTTPException(400, "Upload your CV first")
    if ctx.get("error"):
        raise HTTPException(400, "We could not read text from your CV. Upload a text-based PDF or DOCX.")

    vacancy, missing = None, []
    if data.vacancy_id is not None:
        vacancy = _public_query(db).filter(Vacancy.id == data.vacancy_id).first()
        if not vacancy:
            raise HTTPException(404, "Vacancy not found or no longer open")
        missing = [t for t in rec.vacancy_terms(vacancy) if not rec.has_skill(ctx["lower"], t)]

    topics_limiter.record(key)
    try:
        topics, gaps = rec.cv_topics(ctx["text"], vacancy, missing)
    except AIUnavailable:
        raise HTTPException(503, "The AI service is busy. Please try again in a minute.")
    except ValueError:
        raise HTTPException(502, "Could not prepare topics from this CV. Please try again.")
    return {
        "vacancy_title": vacancy.title if vacancy else None, "topics": topics, "gaps": gaps,
        "note": "These are likely topics based on your CV. Real interviews vary and these "
                "do not come from any company's interview.",
    }
