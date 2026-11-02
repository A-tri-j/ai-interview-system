# CV file save/read/delete. Pore R2/S3 nile shudhu ei file bodlabe.
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.core.config import settings

# Extension -> (content type, file-er shurur magic bytes)
ALLOWED = {
    ".pdf": ("application/pdf", b"%PDF-"),
    ".docx": (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        b"PK\x03\x04",
    ),
}
BASE = Path(settings.UPLOAD_DIR).resolve()


def full_path(key: str) -> Path:
    """Key theke asol path. Folder-er baire jawa (../) block kore."""
    path = (BASE / key).resolve()
    if BASE not in path.parents:
        raise HTTPException(400, "Invalid file path")
    return path


def save_cv(candidate_id: int, upload: UploadFile) -> dict:
    original = Path(upload.filename or "").name[:255]
    ext = Path(original).suffix.lower()
    if ext not in ALLOWED:
        raise HTTPException(400, "Only PDF or DOCX files are allowed")

    max_bytes = settings.MAX_CV_MB * 1024 * 1024
    data = upload.file.read(max_bytes + 1)  # 1 byte beshi pori, size check-er jonno
    if len(data) > max_bytes:
        raise HTTPException(413, f"File is too large (max {settings.MAX_CV_MB} MB)")
    if not data:
        raise HTTPException(400, "The file is empty")

    content_type, magic = ALLOWED[ext]
    # Extension-er shathe file-er asol dhoron mile kina (naam bodlano file dhorte)
    if not data.startswith(magic):
        raise HTTPException(400, "File content does not match its type")

    # Nijer banano random naam. User-er deya naam path-e jay na.
    key = f"cv/{candidate_id}/{uuid.uuid4().hex}{ext}"
    path = full_path(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return {
        "storage_key": key,
        "original_filename": original,
        "content_type": content_type,
        "size_bytes": len(data),
    }


def delete_file(key: str) -> None:
    full_path(key).unlink(missing_ok=True)

