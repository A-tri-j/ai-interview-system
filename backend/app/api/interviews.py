from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.ai.groq_client import AIUnavailable
from app.ai.question_service import QuestionGenerationError
from app.api.deps import get_current_candidate
from app.database.session import get_db
from app.models import Application, ApplicationStatus, Candidate
from app.services.interview_prep import prepare_session

router = APIRouter(prefix="/api/interviews", tags=["interviews"])


@router.post("/{application_id}/prepare")
def prepare(
    application_id: int,
    candidate: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
):
    """Candidate nijer approved application-er jonno question toiri/fetch kore."""
    app = (
        db.query(Application)
        .options(joinedload(Application.vacancy), joinedload(Application.cv_document))
        .filter(Application.id == application_id, Application.candidate_id == candidate.id)
        .first()
    )
    if not app:
        raise HTTPException(404, "Application not found")
    if app.status != ApplicationStatus.APPROVED_FOR_INTERVIEW:
        raise HTTPException(403, "You are not invited to an interview for this application")

    try:
        session = prepare_session(db, app)
    except AIUnavailable:
        raise HTTPException(503, "The AI service is busy. Please try again in a minute.")
    except QuestionGenerationError:
        raise HTTPException(502, "Could not prepare interview questions. Please try again.")

    if session.expires_at and session.expires_at < datetime.now(timezone.utc):
        raise HTTPException(410, "This interview link has expired")

    # expected_points (hidden rubric) candidate-ke kokhono dekhai na
    return {
        "session_id": session.id, "status": session.status,
        "target_minutes": session.target_minutes,
        "questions": [
            {"id": q.id, "order": q.order_index + 1, "text": q.text, "category": q.category}
            for q in session.questions if q.kind == "initial"
        ],
    }

