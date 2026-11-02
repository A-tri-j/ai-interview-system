from datetime import datetime, timedelta, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.ai import rag
from app.ai.question_service import generate_initial
from app.core.config import settings
from app.models import Application, InterviewQuestion, InterviewSession


def prepare_session(db: Session, application: Application) -> InterviewSession:
    """Idempotent: question age-i thakle abar generate kore na (Groq quota bachay)."""
    existing = (
        db.query(InterviewSession).filter(InterviewSession.application_id == application.id).first()
    )
    if existing and existing.questions:
        return existing

    vacancy, doc = application.vacancy, application.cv_document
    rag.index_vacancy(db, vacancy)
    if doc is not None:
        try:
            rag.index_document(db, doc)
        except ValueError:
            doc = None  # CV porte pari ni: vacancy-based question-i hobe
    db.commit()

    questions = generate_initial(db, vacancy, doc)

    session = existing or InterviewSession(
        application_id=application.id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.INTERVIEW_LINK_DAYS),
    )
    for i, q in enumerate(questions):
        session.questions.append(InterviewQuestion(
            order_index=i, kind="initial", category=q.category, text=q.text,
            difficulty=q.difficulty, expected_points=q.expected_points,
            source_evidence=q.evidence,
        ))
    db.add(session)
    try:
        db.commit()
    except IntegrityError:
        # Ekshathe duibar prepare hole onno request age save korse
        db.rollback()
        return (
            db.query(InterviewSession)
            .filter(InterviewSession.application_id == application.id).one()
        )
    db.refresh(session)
    return session

