# Interview recording save/read/delete. R2 set thakle R2, noyto local folder.
# Bucket private. Company shudhu time-limited signed URL pay.
import uuid
from pathlib import Path

from app.core.config import settings
from app.services import storage


def _client():
    import boto3

    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name="auto",
    )


def new_key(session_id: int, ext: str) -> str:
    # Random naam. User-er deya kono naam key-te jay na.
    return f"rec/{session_id}/{uuid.uuid4().hex}{ext}"


def save(key: str, data: bytes, content_type: str) -> None:
    if settings.r2_configured:
        _client().put_object(
            Bucket=settings.R2_BUCKET,
            Key=key,
            Body=data,
            ContentType=content_type,
        )
    else:
        path = storage.full_path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)


def delete(key: str) -> None:
    if settings.r2_configured:
        _client().delete_object(Bucket=settings.R2_BUCKET, Key=key)
    else:
        storage.full_path(key).unlink(missing_ok=True)


def signed_url(key: str) -> str | None:
    """R2 hole 10 minute-er signed URL. Local hole None (API diye stream hoy)."""
    if not settings.r2_configured:
        return None
    return _client().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.R2_BUCKET, "Key": key},
        ExpiresIn=settings.SIGNED_URL_SECONDS,
    )


def local_path(key: str) -> Path:
    return storage.full_path(key)


def sniff(data: bytes) -> tuple[str, str] | None:
    """File-er shurur byte dekhe dhoron chine (extension/content-type trust kori na)."""
    if data[:4] == b"\x1a\x45\xdf\xa3":
        return "video/webm", ".webm"
    if data[4:8] == b"ftyp":
        return "video/mp4", ".mp4"  # Safari/iPhone
    if data[:4] == b"OggS":
        return "audio/ogg", ".ogg"
    return None

