# Password hash, JWT token, OTP: sob security-r kaj ekhane.
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import settings


def hash_password(password: str) -> str:
    # bcrypt maximum 72 byte nite pare, tai kete nilam
    return bcrypt.hashpw(password.encode()[:72], bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode()[:72], password_hash.encode())
    except ValueError:
        return False


def create_access_token(subject_id: int, role: str, minutes: int | None = None) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=minutes or settings.ACCESS_TOKEN_MINUTES)
    # iat = token kokhon toiri hoyeche. Password bodlar age-r token batil korte lage.
    payload = {"sub": str(subject_id), "role": role, "exp": expire, "iat": int(now.timestamp())}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def decode_token(token: str) -> dict | None:
    """Token thik ar expire hoyni hole data dey, noile None."""
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None


def generate_otp() -> str:
    # secrets module random-er jonno nirapod (random module na)
    return f"{secrets.randbelow(10**6):06d}"


def hash_otp(otp: str) -> str:
    # Database-e OTP nije rakhi na, shudhu hash rakhi
    return hmac.new(settings.JWT_SECRET.encode(), otp.encode(), hashlib.sha256).hexdigest()

