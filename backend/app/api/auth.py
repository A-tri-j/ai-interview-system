from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.deps import get_current_candidate
from app.core.config import settings
from app.core.rate_limit import login_limiter, otp_limiter
from app.core.security import create_access_token, hash_password, verify_password
from app.database.session import get_db
from app.models import Candidate, CandidateProfile
from app.schemas.auth import (
    CandidateOut,
    CandidateRegister,
    LoginRequest,
    ResendOtpRequest,
    TokenResponse,
    VerifyEmailRequest,
)
from app.services.email_service import otp_email_html, send_email
from app.services.otp_service import check_otp, create_otp

router = APIRouter(prefix="/api/auth", tags=["auth"])
ROLE = "candidate"
PURPOSE = "verify_email"


def _send_otp_mail(db: Session, candidate: Candidate, background: BackgroundTasks):
    otp = create_otp(db, candidate.email, ROLE, PURPOSE)
    # Email background-e jay, tai API fast response dey
    background.add_task(
        send_email,
        candidate.email,
        "Your verification code",
        otp_email_html(candidate.full_name, otp, settings.OTP_MINUTES),
    )


@router.post("/candidate/register", status_code=201)
def register_candidate(
    data: CandidateRegister, background: BackgroundTasks, db: Session = Depends(get_db)
):
    existing = db.query(Candidate).filter(Candidate.email == data.email).first()
    if existing and existing.is_email_verified:
        raise HTTPException(409, "An account with this email already exists")

    if existing:
        # Age register korse kintu verify kore ni: tothyo update kore abar OTP pathai
        existing.full_name = data.full_name
        existing.phone = data.phone
        existing.password_hash = hash_password(data.password)
        candidate = existing
    else:
        candidate = Candidate(
            full_name=data.full_name,
            email=data.email,
            phone=data.phone,
            password_hash=hash_password(data.password),
        )
        candidate.profile = CandidateProfile()
        db.add(candidate)

    db.commit()
    db.refresh(candidate)
    _send_otp_mail(db, candidate, background)
    return {"message": "Registered. Check your email for the verification code."}


@router.post("/candidate/verify-email")
def verify_email(data: VerifyEmailRequest, db: Session = Depends(get_db)):
    candidate = db.query(Candidate).filter(Candidate.email == data.email).first()
    if not candidate or not check_otp(db, data.email, ROLE, PURPOSE, data.otp):
        raise HTTPException(400, "Invalid or expired code")

    candidate.is_email_verified = True
    db.commit()
    return {"message": "Email verified. You can log in now."}


@router.post("/candidate/resend-otp")
def resend_otp(
    data: ResendOtpRequest,
    request: Request,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
):
    key = f"{request.client.host}:{data.email}"
    otp_limiter.check(key)
    otp_limiter.record(key)

    candidate = db.query(Candidate).filter(Candidate.email == data.email).first()
    if candidate and not candidate.is_email_verified:
        _send_otp_mail(db, candidate, background)

    # Email ache kina ta bole dilam na (privacy)
    return {"message": "If the account exists, a new code has been sent."}


@router.post("/candidate/login", response_model=TokenResponse)
def login_candidate(data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    key = f"{request.client.host}:{data.email}"
    login_limiter.check(key)

    candidate = db.query(Candidate).filter(Candidate.email == data.email).first()
    if not candidate or not verify_password(data.password, candidate.password_hash):
        login_limiter.record(key)
        raise HTTPException(401, "Incorrect email or password")

    if not candidate.is_email_verified:
        raise HTTPException(403, "Please verify your email first")
    if not candidate.is_active:
        raise HTTPException(403, "This account is disabled")

    login_limiter.reset(key)
    candidate.last_login_at = datetime.now(timezone.utc)
    db.commit()
    # Candidate session: 30 din. Active thakle /api/auth/refresh e barbe.
    token = create_access_token(candidate.id, ROLE, minutes=settings.CANDIDATE_REFRESH_DAYS * 24 * 60)
    return TokenResponse(access_token=token)


@router.get("/candidate/me", response_model=CandidateOut)
def candidate_me(candidate: Candidate = Depends(get_current_candidate)):
    return candidate

