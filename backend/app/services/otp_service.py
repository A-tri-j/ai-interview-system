import hmac
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import generate_otp, hash_otp
from app.models import EmailVerification


def create_otp(db: Session, email: str, role: str, purpose: str) -> str:
    """Notun OTP banay, purano unused OTP gulo batil kore."""
    now = datetime.now(timezone.utc)
    db.query(EmailVerification).filter(
        EmailVerification.email == email,
        EmailVerification.role == role,
        EmailVerification.purpose == purpose,
        EmailVerification.used_at.is_(None),
    ).update({"used_at": now})

    otp = generate_otp()
    db.add(
        EmailVerification(
            email=email,
            role=role,
            purpose=purpose,
            code_hash=hash_otp(otp),
            expires_at=now + timedelta(minutes=settings.OTP_MINUTES),
        )
    )
    db.commit()
    return otp


def check_otp(db: Session, email: str, role: str, purpose: str, otp: str) -> bool:
    now = datetime.now(timezone.utc)
    row = (
        db.query(EmailVerification)
        .filter(
            EmailVerification.email == email,
            EmailVerification.role == role,
            EmailVerification.purpose == purpose,
            EmailVerification.used_at.is_(None),
        )
        .order_by(EmailVerification.id.desc())
        .first()
    )
    if not row or row.expires_at < now or row.attempts >= settings.OTP_MAX_ATTEMPTS:
        return False

    row.attempts += 1
    # compare_digest: timing attack theke bachay
    if not hmac.compare_digest(row.code_hash, hash_otp(otp)):
        db.commit()
        return False

    row.used_at = now
    db.commit()
    return True

