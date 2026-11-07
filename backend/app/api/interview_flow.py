# Candidate-er interview: link open, consent, start, answer upload, follow-up, submit.
import html
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
)
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from app.ai import transcribe as stt
from app.ai.evaluation import run_evaluation
from app.ai.groq_client import AIUnavailable
from app.ai.question_service import QuestionGenerationError, generate_followups
from app.api.applications import _notify_once
from app.api.deps import get_current_candidate
from app.core.config import settings
from app.core.security import decode_token
from app.database.session import get_db
from app.models import (
    Application,
    ApplicationStatus,
    AuditLog,
    Candidate,
    InterviewAnswer,
    InterviewQuestion,
    InterviewRecording,
    InterviewSession,
    InterviewSessionStatus,
    Vacancy,
)
from app.services import recording_storage as rec
from app.services.email_service import send_email

router = APIRouter(prefix="/api/interviews", tags=["interview flow"])


# ---------------- helpers ----------------


def _load(db: Session, candidate: Candidate, application_id: int, *, open_only: bool = True):
    """Nijer application + session. Onno-r application hole 404."""
    app = (
        db.query(Application)
        .options(
            joinedload(Application.vacancy).joinedload(Vacancy.company),
            joinedload(Application.candidate),
        )
        .filter(Application.id == application_id, Application.candidate_id == candidate.id)
        .first()
    )
    if not app:
        raise HTTPException(404, "Application not found")
    session = (
        db.query(InterviewSession)
        .options(selectinload(InterviewSession.questions).joinedload(InterviewQuestion.answer))
        .filter(InterviewSession.application_id == app.id)
        .first()
    )
    if not session:
        raise HTTPException(404, "Interview is not prepared yet")
    if open_only:
        if app.status != ApplicationStatus.APPROVED_FOR_INTERVIEW:
            raise HTTPException(403, "This interview is not open")
        if session.expires_at and session.expires_at < datetime.now(timezone.utc):
            raise HTTPException(410, "This interview link has expired")
    return app, session


def _question(db: Session, session: InterviewSession, question_id: int) -> InterviewQuestion:
    q = (
        db.query(InterviewQuestion)
        .options(joinedload(InterviewQuestion.answer))
        .filter(
            InterviewQuestion.id == question_id,
            InterviewQuestion.session_id == session.id,
        )
        .first()
    )
    if not q:
        raise HTTPException(404, "Question not found")
    return q


def _consent_notice() -> dict:
    d = settings.RECORDING_RETENTION_DAYS
    return {
        "version": settings.CONSENT_VERSION,
        "purpose": (
            "Your answers are recorded and converted to text so the AI can help the "
            "company evaluate your interview. The AI score is advisory only; people "
            "make the hiring decision."
        ),
        "access": "Only authorized staff of the company you applied to can view the recording.",
        "retention": f"Recordings are deleted automatically after {d} days.",
        "deletion": "You can ask for earlier deletion from your account settings.",
        "evaluation": (
            "Only the words you say are evaluated. Your face, voice tone, accent "
            "and appearance are not scored."
        ),
        "options": ["video", "audio", "decline"],
    }


def _state(app: Application, session: InterviewSession) -> dict:
    return {
        "session_id": session.id,
        "status": session.status,
        "job_title": app.vacancy.title,
        "company_name": app.vacancy.company.company_name,
        "recording_mode": session.recording_mode,
        "consent_given": session.recording_mode is not None,
        "consent_notice": _consent_notice(),
        "target_minutes": session.target_minutes,
        "max_answer_seconds": settings.MAX_ANSWER_SECONDS,
        # expected_points (hidden rubric) kokhono candidate-ke dei na
        "questions": [
            {
                "id": q.id,
                "order": q.order_index + 1,
                "kind": q.kind,
                "category": q.category,
                "text": q.text,
                "answered": q.answer is not None,
            }
            for q in session.questions
        ],
    }


def _make_followups(db: Session, session: InterviewSession) -> bool:
    """Follow-up toiri kore save kore. Notun toiri hole True, age theke thakle False."""
    initial = [q for q in session.questions if q.kind == "initial"]
    if len(session.questions) > len(initial):
        return False
    qa = [(q.text, (q.answer.transcript if q.answer else "") or "") for q in initial]
    generated = generate_followups(
        qa, [q.text for q in session.questions], count=settings.FOLLOWUP_COUNT
    )
    base = len(session.questions)
    for i, f in enumerate(generated):
        session.questions.append(
            InterviewQuestion(
                order_index=base + i,
                kind="followup",
                category=f.category,
                text=f.text,
                difficulty=f.difficulty,
                expected_points=f.expected_points,
                source_evidence=f.evidence,
                parent_question_id=initial[f.parent_index].id,
            )
        )
    try:
        db.commit()
    except IntegrityError:
        # ekshathe duibar call hole onno request age save korse
        db.rollback()
        return False
    db.refresh(session)
    return True


# ---------------- 1. Email-er link ----------------


class OpenIn(BaseModel):
    token: str = Field(min_length=20, max_length=2000)


@router.post("/open")
def open_link(
    data: OpenIn,
    candidate: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
):
    """Email-er link-er token check kore. Candidate-ke login-o thakte hobe."""
    payload = decode_token(data.token)
    if not payload or payload.get("role") != "interview":
        raise HTTPException(400, "Invalid or expired interview link")
    app = (
        db.query(Application)
        .options(joinedload(Application.vacancy).joinedload(Vacancy.company))
        .filter(Application.id == int(payload["sub"]), Application.candidate_id == candidate.id)
        .first()
    )
    if not app:
        raise HTTPException(404, "This interview belongs to a different account")
    return {
        "application_id": app.id,
        "status": app.status,
        "job_title": app.vacancy.title,
        "company_name": app.vacancy.company.company_name,
    }


# ---------------- 2. State, consent, start ----------------


@router.get("/{application_id}/state")
def get_state(
    application_id: int,
    candidate: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
):
    app, session = _load(db, candidate, application_id, open_only=False)
    return _state(app, session)


class ConsentIn(BaseModel):
    mode: Literal["video", "audio", "decline"]


@router.post("/{application_id}/consent")
def give_consent(
    application_id: int,
    data: ConsentIn,
    candidate: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
):
    app, session = _load(db, candidate, application_id)
    if data.mode == "decline":
        db.add(
            AuditLog(
                actor_role="candidate",
                actor_id=candidate.id,
                action="interview_consent_declined",
                entity_type="application",
                entity_id=app.id,
            )
        )
        db.commit()
        return {
            "declined": True,
            "message": (
                "No recording was made. Please contact the company to ask "
                "about an alternative way to complete this step."
            ),
        }
    session.consent_at = datetime.now(timezone.utc)
    session.consent_version = settings.CONSENT_VERSION
    session.recording_mode = data.mode
    if session.status == InterviewSessionStatus.INVITED:
        session.status = InterviewSessionStatus.CONSENTED
    db.commit()
    return {"declined": False, "recording_mode": session.recording_mode}


@router.post("/{application_id}/start")
def start_interview(
    application_id: int,
    candidate: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
):
    app, session = _load(db, candidate, application_id)
    if not session.recording_mode:
        raise HTTPException(409, "Please accept the recording consent first")
    if session.status in (InterviewSessionStatus.INVITED, InterviewSessionStatus.CONSENTED):
        session.status = InterviewSessionStatus.IN_PROGRESS
        session.started_at = datetime.now(timezone.utc)
        db.commit()
    return _state(app, session)


# ---------------- 3. Answer upload ----------------


@router.post("/{application_id}/questions/{question_id}/answer")
def upload_answer(
    application_id: int,
    question_id: int,
    file: UploadFile = File(...),
    duration_seconds: float | None = Form(None, ge=0, le=600),
    candidate: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
):
    """Ekta question-er recording. Abar pathale purano-ta replace hoy (re-record)."""
    app, session = _load(db, candidate, application_id)
    if session.status != InterviewSessionStatus.IN_PROGRESS:
        raise HTTPException(409, "Start the interview first")
    q = _question(db, session, question_id)
    max_bytes = settings.MAX_RECORDING_MB * 1024 * 1024
    data = file.file.read(max_bytes + 1)
    if not data:
        raise HTTPException(400, "The recording is empty")
    if len(data) > max_bytes:
        raise HTTPException(413, f"Recording is too large (max {settings.MAX_RECORDING_MB} MB)")
    kind = rec.sniff(data)
    if not kind:
        raise HTTPException(400, "Unsupported recording format")
    content_type, ext = kind

    # Age transcribe kori. Fail hole kichu save hoy na, candidate abar pathate pare.
    try:
        text, segments = stt.transcribe(data, f"answer{ext}")
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    except AIUnavailable:
        raise HTTPException(503, "Transcription is busy. Please try uploading again.")

    key = rec.new_key(session.id, ext)
    rec.save(key, data, content_type)
    old = db.query(InterviewRecording).filter(InterviewRecording.question_id == q.id).first()
    old_key = old.storage_key if old else None
    try:
        if old:
            db.delete(old)
            db.flush()  # unique constraint-er age purano-ta muche nei
        answer = q.answer or InterviewAnswer(question_id=q.id)
        answer.transcript = text
        answer.start_sec = 0
        answer.end_sec = duration_seconds
        db.add(answer)
        db.add(
            InterviewRecording(
                session_id=session.id,
                question_id=q.id,
                storage_key=key,
                content_type=content_type,
                size_bytes=len(data),
                duration_seconds=duration_seconds,
                status="transcribed",
                transcript_text=text,
                transcript_segments=segments,
                delete_after=datetime.now(timezone.utc)
                + timedelta(days=settings.RECORDING_RETENTION_DAYS),
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        rec.delete(key)
        raise
    if old_key:
        rec.delete(old_key)
    return {"question_id": q.id, "transcript": text, "no_speech": not text}


@router.post("/{application_id}/questions/{question_id}/skip")
def skip_question(
    application_id: int,
    question_id: int,
    candidate: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
):
    app, session = _load(db, candidate, application_id)
    if session.status != InterviewSessionStatus.IN_PROGRESS:
        raise HTTPException(409, "Start the interview first")
    q = _question(db, session, question_id)
    if q.answer:
        raise HTTPException(409, "Already answered. Record again instead.")
    db.add(InterviewAnswer(question_id=q.id, transcript=""))
    db.commit()
    return {"question_id": q.id, "skipped": True}


# ---------------- 4. Follow-up question ----------------


@router.post("/{application_id}/followups")
def followups(
    application_id: int,
    candidate: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
):
    """5ta initial answer-er por AI follow-up toiri kore. Idempotent."""
    app, session = _load(db, candidate, application_id)
    if session.status != InterviewSessionStatus.IN_PROGRESS:
        raise HTTPException(409, "Start the interview first")
    if any(q.kind == "initial" and q.answer is None for q in session.questions):
        raise HTTPException(409, "Answer all initial questions first")
    try:
        _make_followups(db, session)
    except AIUnavailable:
        raise HTTPException(503, "The AI service is busy. Please try again in a minute.")
    except QuestionGenerationError:
        raise HTTPException(502, "Could not prepare follow-up questions. Please try again.")
    return _state(app, session)


# ---------------- 5. Submit ----------------


@router.post("/{application_id}/submit")
def submit_interview(
    application_id: int,
    background: BackgroundTasks,
    candidate: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
):
    app, session = _load(db, candidate, application_id)
    if session.status != InterviewSessionStatus.IN_PROGRESS:
        raise HTTPException(409, "This interview is not in progress")
    pending = [q for q in session.questions if q.answer is None]
    if pending:
        raise HTTPException(409, f"{len(pending)} question(s) are still unanswered")
    if not any(q.kind == "followup" for q in session.questions):
        try:
            if _make_followups(db, session):
                raise HTTPException(409, "Follow-up questions are ready. Please answer them.")
        except (AIUnavailable, QuestionGenerationError):
            pass  # AI down thakleo candidate-ke atkabo na

    now = datetime.now(timezone.utc)
    session.status = InterviewSessionStatus.SUBMITTED
    session.submitted_at = now
    app.status = ApplicationStatus.INTERVIEW_COMPLETED
    app.status_changed_at = now
    db.add(
        AuditLog(
            actor_role="candidate",
            actor_id=candidate.id,
            action="interview_submitted",
            entity_type="application",
            entity_id=app.id,
        )
    )
    if settings.NOTIFY_INTERVIEW_DONE:
        subject = f"Interview submitted: {app.vacancy.title}"
        if _notify_once(db, app, "interview_submitted", subject):
            background.add_task(
                send_email,
                candidate.email,
                subject,
                f"<p>Hello {html.escape(candidate.full_name)},</p>"
                f"<p>We received your interview for <b>{html.escape(app.vacancy.title)}</b>. "
                f"The company will review it and contact you.</p>",
            )
    if settings.NOTIFY_ROUND2_OPEN:
        subject2 = f"Next step: Round 2 MCQ test for {app.vacancy.title}"
        if _notify_once(db, app, "round2_open", subject2):
            link2 = f"{settings.PUBLIC_APP_URL}/round2/{app.id}"
            background.add_task(
                send_email, candidate.email, subject2,
                f"<p>Hello {html.escape(candidate.full_name)},</p>"
                f"<p>Thank you for completing the video interview for "
                f"<b>{html.escape(app.vacancy.title)}</b>. Round 2 is now open.</p>"
                f"<p>It is a short MCQ test: {settings.MCQ_COUNT} questions in "
                f"{settings.MCQ_SECONDS // 60} minutes. The timer starts only when you press "
                f"Start, and your answers are submitted automatically when time runs out.</p>"
                f'<p><a href="{link2}">Open Round 2</a></p>',
            )
    session_id = session.id
    db.commit()
    # Response-er por background-e evaluation chole. Fail hole company retry korte pare.
    background.add_task(run_evaluation, session_id)
    return {"status": InterviewSessionStatus.SUBMITTED,
            "message": "Interview submitted. Thank you!"}

