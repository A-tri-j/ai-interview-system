# Password reset token. Database-e token-er hash thake, token nije na.
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_otp  # ei hash function ja-i string-e kaj kore
from app.models import PasswordResetToken


def create_reset_token(db: Session, email: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    # Purano unused token gulo batil
    db.query(PasswordResetToken).filter(
        PasswordResetToken.email == email,
        PasswordResetToken.role == role,
        PasswordResetToken.used_at.is_(None),
    ).update({"used_at": now})

    token = secrets.token_urlsafe(32)
    db.add(PasswordResetToken(
        email=email, role=role, token_hash=hash_otp(token),
        expires_at=now + timedelta(minutes=settings.RESET_TOKEN_MINUTES),
    ))
    db.commit()
    return token


def consume_reset_token(db: Session, token: str, role: str) -> str | None:
    """Token thik hole email dey ar token 'used' kore. Commit caller korbe."""
    row = db.query(PasswordResetToken).filter(
        PasswordResetToken.token_hash == hash_otp(token),
        PasswordResetToken.role == role,
        PasswordResetToken.used_at.is_(None),
    ).first()
    now = datetime.now(timezone.utc)
    if not row or row.expires_at < now:
        return None
    row.used_at = now
    return row.email

