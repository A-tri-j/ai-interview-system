# Sliding session: frontend active thakle ei API call kore notun token nei.
# Candidate: 30 din idle, Company: 24 ghonta idle.
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.api.deps import bearer, get_current_candidate, get_current_company
from app.core.config import settings
from app.core.security import create_access_token, decode_token
from app.database.session import get_db
from app.schemas.auth import TokenResponse

router = APIRouter(prefix="/api/auth", tags=["session"])


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
):
    payload = decode_token(creds.credentials) if creds else None
    if not payload:
        raise HTTPException(401, "Invalid or expired token")

    role = payload.get("role")
    if role == "candidate":
        c = get_current_candidate(creds, db)  # account/password check ekhane-o hobe
        minutes = settings.CANDIDATE_REFRESH_DAYS * 24 * 60
        return TokenResponse(access_token=create_access_token(c.id, "candidate", minutes))
    if role == "company":
        co = get_current_company(creds, db)
        minutes = settings.COMPANY_SESSION_HOURS * 60
        return TokenResponse(access_token=create_access_token(co.id, "company", minutes))
    # Admin ar interview token refresh hoy na
    raise HTTPException(401, "This token cannot be refreshed")

