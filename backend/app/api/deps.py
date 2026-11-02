# Protected API-te "ke login ache" ber kore. Protita role-er alada dependency.
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decode_token
from app.database.session import get_db
from app.models import Candidate, Company

bearer = HTTPBearer(auto_error=False)


def _payload_for(creds: HTTPAuthorizationCredentials | None, role: str) -> dict:
    """Token thik, expire hoyni, ar role mile gele payload dey."""
    if not creds:
        raise HTTPException(401, "Not authenticated")
    payload = decode_token(creds.credentials)
    # Onno role-er token diye ei API use kora jabe na
    if not payload or payload.get("role") != role:
        raise HTTPException(401, "Invalid or expired token")
    return payload


def _token_is_stale(payload: dict, password_changed_at) -> bool:
    """Password bodlanor age toiri token hole true."""
    return bool(password_changed_at and payload.get("iat", 0) < int(password_changed_at.timestamp()))


def get_current_candidate(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> Candidate:
    payload = _payload_for(creds, "candidate")
    candidate = db.get(Candidate, int(payload["sub"]))
    if not candidate or not candidate.is_active or _token_is_stale(payload, candidate.password_changed_at):
        raise HTTPException(401, "Account not available")
    return candidate


def get_current_company(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> Company:
    payload = _payload_for(creds, "company")
    company = db.get(Company, int(payload["sub"]))
    if (not company or company.status in ("rejected", "suspended")
            or _token_is_stale(payload, company.password_changed_at)):
        raise HTTPException(401, "Account not available")
    return company


def get_current_admin(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> dict:
    payload = _payload_for(creds, "admin")
    # Admin env-te na thakle kono admin token-i kaj korbe na
    if not settings.ADMIN_EMAIL or not settings.ADMIN_PASSWORD_HASH:
        raise HTTPException(401, "Admin is not configured")
    return payload
