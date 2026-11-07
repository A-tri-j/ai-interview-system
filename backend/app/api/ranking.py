# Company-r vacancy-wise candidate ranking (Round 1 AI + Round 2 MCQ).
# Shudhu nijer vacancy. Score advisory, final decision manush-er.
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_company
from app.core.config import settings
from app.database.session import get_db
from app.models import (
    Application, Company, InterviewReport, InterviewSession, McqStatus, McqTest, Vacancy,
)

router = APIRouter(prefix="/api/company/vacancies", tags=["candidate ranking"])

MAX_ROWS = 500   # ekta vacancy-te eto-r beshi hole shudhu prothom 500 jon


def _weights() -> tuple[float, float]:
    w1, w2 = max(settings.COMBINED_W_R1, 0.0), max(settings.COMBINED_W_R2, 0.0)
    total = w1 + w2
    if total <= 0:
        return 0.5, 0.5
    return w1 / total, w2 / total


def combine(r1: float | None, r2: float | None) -> float | None:
    """Duto round-i shesh hole-i combined. Noyto None (ekta score-ke combined bola vul)."""
    if r1 is None or r2 is None:
        return None
    w1, w2 = _weights()
    return round(r1 * w1 + r2 * w2, 1)


def _assign_ranks(items: list[dict], key: str) -> None:
    """Same score = same rank (1, 2, 2, 4)."""
    last, rank = None, 0
    for i, it in enumerate(items, start=1):
        if it[key] != last:
            rank, last = i, it[key]
        it["rank"] = rank


@router.get("/{vacancy_id}/ranking")
def vacancy_ranking(
    vacancy_id: int,
    sort: str = Query("combined", pattern="^(combined|round1|round2)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db),
):
    # Onno company-r vacancy hole 404 (ID ache kina-o bojha jabe na)
    vacancy = db.query(Vacancy).filter(
        Vacancy.id == vacancy_id, Vacancy.company_id == company.id).first()
    if not vacancy:
        raise HTTPException(404, "Vacancy not found")

    rows = (
        db.query(
            Application, InterviewReport.overall_score, InterviewSession.status,
            McqTest.score, McqTest.status,
        )
        .outerjoin(InterviewSession, InterviewSession.application_id == Application.id)
        .outerjoin(InterviewReport, InterviewReport.session_id == InterviewSession.id)
        .outerjoin(McqTest, McqTest.application_id == Application.id)
        .filter(Application.vacancy_id == vacancy.id)
        .order_by(Application.id)
        .limit(MAX_ROWS).all()
    )

    items = []
    for app, r1, s1, r2, s2 in rows:
        r2 = r2 if s2 == McqStatus.SUBMITTED else None
        if r1 is None and r2 is None:
            continue    # kono round-er score nei, ranking-e dekhai na
        items.append({
            "application_id": app.id, "name": app.applicant_name, "email": app.applicant_email,
            "application_status": app.status,
            "round1": r1, "round1_status": s1, "round2": r2, "round2_status": s2,
            "combined": combine(r1, r2), "complete": r1 is not None and r2 is not None,
        })

    if sort == "combined":
        full = sorted((i for i in items if i["complete"]), key=lambda i: (-i["combined"], i["application_id"]))
        partial = sorted((i for i in items if not i["complete"]), key=lambda i: i["application_id"])
        _assign_ranks(full, "combined")
        for p in partial:
            p["rank"] = None
        ordered = full + partial
    else:
        field = "round1" if sort == "round1" else "round2"
        have = sorted((i for i in items if i[field] is not None), key=lambda i: (-i[field], i["application_id"]))
        none = [i for i in items if i[field] is None]
        _assign_ranks(have, field)
        for n in none:
            n["rank"] = None
        ordered = have + none

    total = len(ordered)
    w1, w2 = _weights()
    return {
        "vacancy": {"id": vacancy.id, "title": vacancy.title},
        "sort": sort, "weights": {"round1": round(w1, 2), "round2": round(w2, 2)},
        "total": total, "complete_count": sum(1 for i in items if i["complete"]),
        "page": page, "page_size": page_size,
        "items": ordered[(page - 1) * page_size: page * page_size],
        "notice": "Ranking is advisory. Round 1 is an AI evaluation of the transcript and Round 2 "
                  "is an automatic MCQ score whose answer key was AI-generated and can contain "
                  "mistakes. People make the hiring decision.",
    }

