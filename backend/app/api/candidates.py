from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_candidate
from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.database.session import get_db
from app.models import Candidate, CandidateDocument, CandidateProfile
from app.schemas.candidate import ChangePassword, ProfileUpdate
from app.services import storage

router = APIRouter(prefix="/api/candidates/me", tags=["candidate profile"])


def _profile_out(db: Session, c: Candidate) -> dict:
    if not c.profile:
        c.profile = CandidateProfile()
        db.commit()
        db.refresh(c)
    p = c.profile
    docs = (
        db.query(CandidateDocument)
        .filter(CandidateDocument.candidate_id == c.id)
        .order_by(CandidateDocument.id.desc())
        .all()
    )
    return {
        "full_name": c.full_name,
        "email": c.email,
        "phone": c.phone,
        "education": p.education,
        "skills": p.skills or [],
        "experience": p.experience,
        "projects": p.projects,
        "portfolio_url": p.portfolio_url,
        "documents": [
            {
                "id": d.id,
                "filename": d.original_filename,
                "size_bytes": d.size_bytes,
                "uploaded_at": d.created_at,
            }
            for d in docs
        ],
    }


@router.get("/profile")
def get_profile(
    c: Candidate = Depends(get_current_candidate), db: Session = Depends(get_db)
):
    return _profile_out(db, c)


@router.put("/profile")
def update_profile(
    data: ProfileUpdate,
    c: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
):
    changes = data.model_dump(exclude_unset=True)
    _profile_out(db, c)  # profile row ache kina nishchit kore
    for key in ("full_name", "phone"):
        if key in changes:
            if changes[key] is None:
                raise HTTPException(422, f"{key} cannot be empty")
            setattr(c, key, changes.pop(key))
    for key, value in changes.items():
        setattr(c.profile, key, value)
    db.commit()
    db.refresh(c)
    return _profile_out(db, c)


@router.post("/cv", status_code=201)
def upload_cv(
    cv: UploadFile = File(...),
    c: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
):
    saved = storage.save_cv(c.id, cv)
    doc = CandidateDocument(candidate_id=c.id, kind="cv", **saved)
    db.add(doc)
    try:
        db.commit()
    except Exception:
        db.rollback()
        storage.delete_file(saved["storage_key"])  # DB fail hole file-o muche felo
        raise
    return {
        "id": doc.id,
        "filename": doc.original_filename,
        "size_bytes": doc.size_bytes,
    }


@router.post("/change-password")
def change_password(
    data: ChangePassword,
    c: Candidate = Depends(get_current_candidate),
    db: Session = Depends(get_db),
):
    if data.new_password != data.confirm_password:
        raise HTTPException(422, "Passwords do not match")
    if not verify_password(data.current_password, c.password_hash):
        raise HTTPException(400, "Current password is incorrect")
    c.password_hash = hash_password(data.new_password)
    c.password_changed_at = datetime.now(timezone.utc)
    db.commit()
    # Purano token batil hoye gelo, tai notun token dei jate user logged in thake
    token = create_access_token(c.id, "candidate", settings.CANDIDATE_REFRESH_DAYS * 24 * 60)
    return {"message": "Password changed", "access_token": token, "token_type": "bearer"}

