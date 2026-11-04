from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from app.ai.groq_client import AIUnavailable
from app.ai.mcq_service import McqGenerationError
from app.api.applications import _company_application
from app.api.deps import get_current_candidate, get_current_company
from app.core.config import settings
from app.database.session import get_db
from app.models import Application, ApplicationStatus, Candidate, Company, McqStatus, McqTest
from app.services import mcq_service as svc

candidate_router = APIRouter(prefix="/api/mcq", tags=["round 2 mcq"])
company_router = APIRouter(prefix="/api/company/applications", tags=["round 2 mcq report"])

# Round 1 shesh hole round 2 kholay
ELIGIBLE = {
    ApplicationStatus.INTERVIEW_COMPLETED, ApplicationStatus.SHORTLISTED, ApplicationStatus.ON_HOLD,
}


def _own_app(db: Session, c: Candidate, application_id: int) -> Application:
    app = (
        db.query(Application)
        .options(joinedload(Application.vacancy), joinedload(Application.cv_document))
        .filter(Application.id == application_id, Application.candidate_id == c.id).first()
    )
    if not app:
        raise HTTPException(404, "Application not found")
    return app


def _state(test: McqTest) -> dict:
    """Candidate-ke correct_index ar explanation kokhono dei na."""
    out = {"status": test.status, "total": test.total,
           "duration_seconds": test.duration_seconds, "auto_submitted": test.auto_submitted}
    if test.status == McqStatus.IN_PROGRESS:
        out["remaining_seconds"] = svc.remaining(test)
        out["questions"] = [
            {"id": q.id, "order": q.order_index + 1, "text": q.text,
             "options": q.options, "selected_index": q.selected_index}
            for q in test.questions
        ]
    if test.status == McqStatus.SUBMITTED and settings.CANDIDATE_SEE_REPORT:
        out["result"] = {"correct": test.correct, "total": test.total, "score": test.score}
    return out


def _locked(db: Session, app_id: int) -> McqTest | None:
    test = svc.get_test(db, app_id, lock=True)
    if test:
        svc.expire_if_needed(db, test)
    return test


class AnswerIn(BaseModel):
    question_id: int
    selected_index: int | None = Field(default=None, ge=0, le=3)


class SubmitIn(BaseModel):
    answers: list[AnswerIn] = Field(default_factory=list, max_length=50)
    auto: bool = False


# ---------------- Candidate ----------------

@candidate_router.get("/{application_id}/state")
def mcq_state(application_id: int, c: Candidate = Depends(get_current_candidate),
              db: Session = Depends(get_db)):
    app = _own_app(db, c, application_id)
    test = _locked(db, app.id)
    if not test:
        return {"status": "not_prepared", "eligible": app.status in ELIGIBLE,
                "total": settings.MCQ_COUNT, "duration_seconds": settings.MCQ_SECONDS}
    return _state(test)


@candidate_router.post("/{application_id}/prepare")
def mcq_prepare(application_id: int, c: Candidate = Depends(get_current_candidate),
                db: Session = Depends(get_db)):
    app = _own_app(db, c, application_id)
    if not svc.get_test(db, app.id):
        if app.status not in ELIGIBLE:
            raise HTTPException(403, "Round 2 opens after you complete the video interview")
        try:
            svc.prepare_test(db, app)
        except AIUnavailable:
            raise HTTPException(503, "The AI service is busy. Please try again in a minute.")
        except McqGenerationError:
            raise HTTPException(502, "Could not prepare the test. Please try again.")
    return _state(_locked(db, app.id))


@candidate_router.post("/{application_id}/start")
def mcq_start(application_id: int, c: Candidate = Depends(get_current_candidate),
              db: Session = Depends(get_db)):
    app = _own_app(db, c, application_id)
    test = _locked(db, app.id)
    if not test:
        raise HTTPException(404, "The test is not prepared yet")
    if test.status == McqStatus.SUBMITTED:
        raise HTTPException(409, "This test was already submitted")
    svc.start_test(db, test)
    return _state(test)


@candidate_router.put("/{application_id}/answer")
def mcq_answer(application_id: int, data: AnswerIn,
               c: Candidate = Depends(get_current_candidate), db: Session = Depends(get_db)):
    app = _own_app(db, c, application_id)
    test = _locked(db, app.id)
    if not test:
        raise HTTPException(404, "Test not found")
    if test.status == McqStatus.SUBMITTED:
        raise HTTPException(410, "Time is up. Your test was submitted.")
    if test.status != McqStatus.IN_PROGRESS:
        raise HTTPException(409, "The test has not started")
    svc.record_answers(db, test, [(data.question_id, data.selected_index)])
    db.commit()
    return {"ok": True, "remaining_seconds": svc.remaining(test)}


@candidate_router.post("/{application_id}/submit")
def mcq_submit(application_id: int, data: SubmitIn,
               c: Candidate = Depends(get_current_candidate), db: Session = Depends(get_db)):
    """Idempotent: auto-submit ar manual submit ekshathe holeo ekbar-i score hoy."""
    app = _own_app(db, c, application_id)
    test = _locked(db, app.id)
    if not test:
        raise HTTPException(404, "Test not found")
    if test.status == McqStatus.READY:
        raise HTTPException(409, "The test has not started")
    if test.status == McqStatus.IN_PROGRESS:
        # Grace-er bhitor ashle shesh moment-er answer-o nei
        svc.record_answers(db, test, [(a.question_id, a.selected_index) for a in data.answers])
        svc.finalize(db, test, auto=data.auto or svc.is_overdue(test))
    return _state(test)


# ---------------- Company ----------------

@company_router.get("/{app_id}/mcq")
def company_mcq(app_id: int, company: Company = Depends(get_current_company),
                db: Session = Depends(get_db)):
    a = _company_application(db, company, app_id)    # onno company-r hole 404
    test = _locked(db, a.id)
    if not test:
        return {"status": "not_taken"}
    if test.status != McqStatus.SUBMITTED:
        return {"status": test.status}
    taken = None
    if test.started_at and test.submitted_at:
        taken = max(0, int((test.submitted_at - test.started_at).total_seconds()))
    return {
        "status": test.status, "score": test.score, "correct": test.correct, "total": test.total,
        "auto_submitted": test.auto_submitted, "duration_seconds": test.duration_seconds,
        "time_taken_seconds": taken, "breakdown": test.breakdown or {},
        "note": "Scored automatically against the answer key. Questions and key were generated "
                "by AI and cross-checked, but a key can still be wrong. Use as one input only.",
        "questions": [
            {"order": q.order_index + 1, "text": q.text, "options": q.options,
             "correct_index": q.correct_index, "selected_index": q.selected_index,
             "is_correct": q.selected_index == q.correct_index, "explanation": q.explanation,
             "skill_focus": q.skill_focus, "difficulty": q.difficulty, "source": q.source}
            for q in test.questions
        ],
    }
