import logging
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_candidate
from app.core.config import settings
from app.core.rate_limit import login_limiter
from app.core.security import verify_password
from app.database.session import get_db
from app.models import (
    Application,
    AuditLog,
    Candidate,
    CandidateDocument,
    EmailVerification,
    InterviewRecording,
    InterviewReport,
    InterviewSession,
    InterviewSessionStatus,
    Notification,
    PasswordResetToken,
)
from app.services import recording_storage as rec
from app.services import storage

logger = logging.getLogger("privacy")
result_router = APIRouter(prefix="/api/interviews", tags=["candidate interview result"])
router = APIRouter(prefix="/api/candidates/me", tags=["candidate privacy"])


def _own_session(db: Session, c: Candidate, application_id: int):
    app = (
        db.query(Application)
        .filter(Application.id == application_id, Application.candidate_id == c.id)
        .first()
    )
    if not app:
        raise HTTPException(404, "Application not found")
    session = db.query(InterviewSession).filter(InterviewSession.application_id == app.id).first()
    if not session:
        raise HTTPException(404, "No interview for this application")
    return app, session


@result_router.get("/{application_id}/result")
def my_result(
    application_id: int,
    c: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
):
    """Candidate-er jonno shongkhipto result. Rubric/expected points dekhano hoy na."""
    app, session = _own_session(db, c, application_id)
    out = {
        "interview_status": session.status,
        "application_status": app.status,
        "report_available": False,
    }
    if session.status != InterviewSessionStatus.COMPLETED or not settings.CANDIDATE_SEE_REPORT:
        return out
    r = db.query(InterviewReport).filter(InterviewReport.session_id == session.id).first()
    if r:
        out.update(
            {
                "report_available": True,
                "overall_score": r.overall_score,
                "scale": "0-100",
                "summary": r.summary,
                "strengths": r.strengths or [],
                "improvements": r.improvements or [],
                "limitations": r.limitations,
            }
        )
    return out


@router.post("/interviews/{application_id}/delete-recordings")
def delete_my_recordings(
    application_id: int,
    c: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
):
    """Video/audio file ar timestamp muche dei. Likhito transcript ar report thake
    (shompurno muche felte account delete koro)."""
    app, session = _own_session(db, c, application_id)
    if session.status == InterviewSessionStatus.IN_PROGRESS:
        raise HTTPException(409, "Finish or leave the interview before deleting recordings")
    now = datetime.now(timezone.utc)
    rows = (
        db.query(InterviewRecording)
        .filter(
            InterviewRecording.session_id == session.id,
            InterviewRecording.deleted_at.is_(None),
        )
        .all()
    )
    for r in rows:
        try:
            rec.delete(r.storage_key)
        except Exception:  # noqa: BLE001
            logger.exception("Could not delete recording file %s", r.id)
            continue
        r.deleted_at = now
        r.status = "deleted"
        r.transcript_segments = None
    db.add(
        AuditLog(
            actor_role="candidate",
            actor_id=c.id,
            action="recordings_deleted_by_user",
            entity_type="application",
            entity_id=app.id,
            details={"count": len(rows)},
        )
    )
    db.commit()
    return {"deleted": len(rows)}


class DeleteAccount(BaseModel):
    password: str = Field(min_length=1, max_length=64)
    confirm: Literal["DELETE"]


@router.post("/delete-account")
def delete_account(
    data: DeleteAccount,
    request: Request,
    c: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
):
    """Account + application + CV + recording shob muche dei. Ferot ashe na."""
    key = f"delete:{c.id}"
    login_limiter.check(key)
    if not verify_password(data.password, c.password_hash):
        login_limiter.record(key)
        raise HTTPException(400, "Password is incorrect")

    rec_keys = [
        r[0]
        for r in (
            db.query(InterviewRecording.storage_key)
            .join(InterviewSession, InterviewRecording.session_id == InterviewSession.id)
            .join(Application, InterviewSession.application_id == Application.id)
            .filter(Application.candidate_id == c.id, InterviewRecording.deleted_at.is_(None))
        )
    ]
    doc_keys = [
        r[0]
        for r in db.query(CandidateDocument.storage_key).filter(
            CandidateDocument.candidate_id == c.id
        )
    ]
    email, cid = c.email, c.id

    # Age database, tarpor file. DB fail hole file hariye jabe na.
    db.query(Notification).filter(Notification.recipient_email == email).delete()
    db.query(EmailVerification).filter(
        EmailVerification.email == email,
        EmailVerification.role == "candidate",
    ).delete()
    db.query(PasswordResetToken).filter(
        PasswordResetToken.email == email,
        PasswordResetToken.role == "candidate",
    ).delete()
    db.add(
        AuditLog(
            actor_role="candidate",
            actor_id=cid,
            action="account_deleted",
            entity_type="candidate",
            entity_id=cid,
        )
    )  # email/name rakhi na
    db.delete(c)  # application, session, answer, recording, report, chunk: DB cascade
    db.commit()

    for k in rec_keys:
        try:
            rec.delete(k)
        except Exception:  # noqa: BLE001
            logger.exception("Orphan recording file left: %s", k)
    for k in doc_keys:
        try:
            storage.delete_file(k)
        except Exception:  # noqa: BLE001
            logger.exception("Orphan CV file left: %s", k)
    return {"message": "Your account and data have been deleted."}

