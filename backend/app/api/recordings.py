# Company shudhu nijer vacancy-r applicant-er recording dekhte pare.
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.applications import _company_application
from app.api.deps import get_current_company
from app.database.session import get_db
from app.models import (
    Application,
    AuditLog,
    Company,
    InterviewQuestion,
    InterviewRecording,
    InterviewSession,
    InterviewSessionStatus,
    Vacancy,
)
from app.services import recording_storage as rec

router = APIRouter(prefix="/api/company", tags=["interview recordings"])

VISIBLE = (
    InterviewSessionStatus.SUBMITTED,
    InterviewSessionStatus.EVALUATING,
    InterviewSessionStatus.COMPLETED,
    InterviewSessionStatus.FAILED,
)


def _own_recording(db: Session, company: Company, rec_id: int) -> InterviewRecording:
    """Onno company-r recording hole 404."""
    row = (
        db.query(InterviewRecording)
        .join(InterviewSession, InterviewRecording.session_id == InterviewSession.id)
        .join(Application, InterviewSession.application_id == Application.id)
        .join(Vacancy, Application.vacancy_id == Vacancy.id)
        .filter(
            InterviewRecording.id == rec_id,
            Vacancy.company_id == company.id,
            InterviewRecording.deleted_at.is_(None),
        )
        .first()
    )
    if not row:
        raise HTTPException(404, "Recording not found")
    return row


@router.get("/applications/{app_id}/recordings")
def list_recordings(
    app_id: int,
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db),
):
    a = _company_application(db, company, app_id)
    session = db.query(InterviewSession).filter(InterviewSession.application_id == a.id).first()
    if not session or session.status not in VISIBLE:
        raise HTTPException(404, "No submitted interview for this application")
    rows = (
        db.query(InterviewRecording, InterviewQuestion)
        .join(InterviewQuestion, InterviewRecording.question_id == InterviewQuestion.id)
        .filter(
            InterviewRecording.session_id == session.id,
            InterviewRecording.deleted_at.is_(None),
        )
        .order_by(InterviewQuestion.order_index)
        .all()
    )
    return {
        "items": [
            {
                "recording_id": r.id,
                "question_order": q.order_index + 1,
                "kind": q.kind,
                "question": q.text,
                "duration_seconds": r.duration_seconds,
                "transcript": r.transcript_text,
            }
            for r, q in rows
        ]
    }


@router.get("/recordings/{rec_id}/url")
def recording_url(
    rec_id: int,
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db),
):
    r = _own_recording(db, company, rec_id)
    db.add(
        AuditLog(
            actor_role="company",
            actor_id=company.id,
            action="recording_viewed",
            entity_type="recording",
            entity_id=r.id,
        )
    )
    db.commit()
    url = rec.signed_url(r.storage_key)
    # R2 hole 10 minute-er signed URL. Local hole /file endpoint (Authorization lage).
    return {
        "url": url or f"/api/company/recordings/{r.id}/file",
        "signed": url is not None,
        "content_type": r.content_type,
    }


@router.get("/recordings/{rec_id}/file")
def recording_file(
    rec_id: int,
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db),
):
    """Shudhu local storage-er jonno. R2 use korle signed URL-i bebohar hoy."""
    r = _own_recording(db, company, rec_id)
    path = rec.local_path(r.storage_key)
    if not path.exists():
        raise HTTPException(404, "Recording file not found")
    return FileResponse(path, media_type=r.content_type, headers={"X-Content-Type-Options": "nosniff"})

