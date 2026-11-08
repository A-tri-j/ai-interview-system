# CV file save/read/delete. R2 set thakle R2 (production), noyto local folder (dev).
import tempfile
import uuid
from contextlib import contextmanager
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.core.config import settings

ALLOWED = {
    ".pdf": ("application/pdf", b"%PDF-"),
    ".docx": (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        b"PK\x03\x04",
    ),
}
BASE = Path(settings.UPLOAD_DIR).resolve()


def _client():
    import boto3
    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name="auto",
    )


def full_path(key: str) -> Path:
    """Local mode: folder-er baire jawa (../) block kore."""
    path = (BASE / key).resolve()
    if BASE not in path.parents:
        raise HTTPException(400, "Invalid file path")
    return path


def _put(key: str, data: bytes, content_type: str) -> None:
    if settings.r2_configured:
        _client().put_object(Bucket=settings.R2_BUCKET, Key=key, Body=data, ContentType=content_type)
    else:
        path = full_path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)


def read_bytes(key: str) -> bytes:
    """File na pele FileNotFoundError."""
    try:
        if settings.r2_configured:
            return _client().get_object(Bucket=settings.R2_BUCKET, Key=key)["Body"].read()
        return full_path(key).read_bytes()
    except FileNotFoundError:
        raise
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001  (R2: NoSuchKey ba network)
        raise FileNotFoundError(key) from exc


@contextmanager
def local_path(key: str):
    """Text extraction-er jonno ekta asol file path dey (R2 hole temp file)."""
    if not settings.r2_configured:
        yield full_path(key)
        return
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / f"cv{Path(key).suffix}"
        p.write_bytes(read_bytes(key))
        yield p


def save_cv(candidate_id: int, upload: UploadFile) -> dict:
    original = Path(upload.filename or "").name[:255]
    ext = Path(original).suffix.lower()
    if ext not in ALLOWED:
        raise HTTPException(400, "Only PDF or DOCX files are allowed")

    max_bytes = settings.MAX_CV_MB * 1024 * 1024
    data = upload.file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise HTTPException(413, f"File is too large (max {settings.MAX_CV_MB} MB)")
    if not data:
        raise HTTPException(400, "The file is empty")

    content_type, magic = ALLOWED[ext]
    if not data.startswith(magic):
        raise HTTPException(400, "File content does not match its type")

    key = f"cv/{candidate_id}/{uuid.uuid4().hex}{ext}"
    _put(key, data, content_type)
    return {"storage_key": key, "original_filename": original,
            "content_type": content_type, "size_bytes": len(data)}


def delete_file(key: str) -> None:
    if settings.r2_configured:
        _client().delete_object(Bucket=settings.R2_BUCKET, Key=key)
    else:
        full_path(key).unlink(missing_ok=True)
