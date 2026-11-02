from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.deps import get_current_company
from app.core.config import settings
from app.core.rate_limit import login_limiter, otp_limiter
from app.core.security import create_access_token, hash_password, verify_password
from app.database.session import get_db
from app.models import Company, CompanyStatus
from app.schemas.auth import LoginRequest, ResendOtpRequest, TokenResponse, VerifyEmailRequest
from app.schemas.company import CompanyOut, CompanyRegister
from app.services.email_service import otp_email_html, send_email
from app.services.otp_service import check_otp, create_otp

router = APIRouter(prefix="/api/auth/company", tags=["company auth"])

ROLE = "company"
VERIFY = "verify_email"
LOGIN = "company_login"


def _send_otp(db: Session, company: Company, purpose: str, background: BackgroundTasks):
    otp = create_otp(db, company.email, ROLE, purpose)
    subject = "Verify your company email" if purpose == VERIFY else "Your company login code"
    background.add_task(
        send_email,
        company.email,
        subject,
        otp_email_html(company.manager_name, otp, settings.OTP_MINUTES),
    )


def _check_can_login(company: Company) -> None:
    if not company.is_email_verified:
        raise HTTPException(403, "Please verify your company email first")
    if company.status == CompanyStatus.REJECTED:
        raise HTTPException(403, "This company registration was rejected")
    if company.status == CompanyStatus.SUSPENDED:
        raise HTTPException(403, "This company account is suspended")


@router.post("/register", status_code=201)
def register_company(
    data: CompanyRegister, background: BackgroundTasks, db: Session = Depends(get_db)
):
    existing = db.query(Company).filter(Company.email == data.email).first()
    if existing and existing.is_email_verified:
        raise HTTPException(409, "A company with this email already exists")

    # Same registration number onno email-e thakle block
    dup = (
        db.query(Company)
        .filter(
            Company.registration_number == data.registration_number,
            Company.email != data.email,
        )
        .first()
    )
    if dup:
        raise HTTPException(409, "This registration number is already used")

    fields = data.model_dump(exclude={"password", "confirm_password"})
    if existing:
        # Verify kora hoyni: tothyo update kore abar OTP pathai
        for key, value in fields.items():
            setattr(existing, key, value)
        existing.password_hash = hash_password(data.password)
        company = existing
    else:
        company = Company(**fields, password_hash=hash_password(data.password))
        db.add(company)
    db.commit()
    db.refresh(company)

    _send_otp(db, company, VERIFY, background)
    return {"message": "Registered. Check your email for the verification code."}


@router.post("/verify-email")
def verify_company_email(data: VerifyEmailRequest, db: Session = Depends(get_db)):
    company = db.query(Company).filter(Company.email == data.email).first()
    if not company or not check_otp(db, data.email, ROLE, VERIFY, data.otp):
        raise HTTPException(400, "Invalid or expired code")
    company.is_email_verified = True
    # Email verify holei admin approval-er line-e jay
    if company.status == CompanyStatus.PENDING_VERIFICATION:
        company.status = CompanyStatus.PENDING_APPROVAL
    db.commit()
    return {"message": "Email verified. Your company is waiting for admin approval."}


@router.post("/resend-otp")
def resend_company_otp(
    data: ResendOtpRequest,
    request: Request,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
):
    key = f"{request.client.host}:{data.email}"
    otp_limiter.check(key)
    otp_limiter.record(key)
    company = db.query(Company).filter(Company.email == data.email).first()
    if company and not company.is_email_verified:
        _send_otp(db, company, VERIFY, background)
    return {"message": "If the account exists, a new code has been sent."}


@router.post("/login")
def company_login_step1(
    data: LoginRequest,
    request: Request,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Step 1: email + password thik hole email-e login OTP pathai (token na)."""
    key = f"{request.client.host}:{data.email}"
    login_limiter.check(key)

    company = db.query(Company).filter(Company.email == data.email).first()
    if not company or not verify_password(data.password, company.password_hash):
        login_limiter.record(key)
        raise HTTPException(401, "Incorrect email or password")
    _check_can_login(company)

    otp_key = f"login-otp:{data.email}"
    otp_limiter.check(otp_key)
    otp_limiter.record(otp_key)
    login_limiter.reset(key)
    _send_otp(db, company, LOGIN, background)
    return {"message": "A login code has been sent to your company email."}


@router.post("/login/verify", response_model=TokenResponse)
def company_login_step2(data: VerifyEmailRequest, db: Session = Depends(get_db)):
    """Step 2: OTP thik hole 24 ghontar token dey."""
    company = db.query(Company).filter(Company.email == data.email).first()
    if not company or not check_otp(db, data.email, ROLE, LOGIN, data.otp):
        raise HTTPException(400, "Invalid or expired code")
    _check_can_login(company)

    company.last_login_at = datetime.now(timezone.utc)
    db.commit()
    token = create_access_token(
        company.id, ROLE, minutes=settings.COMPANY_SESSION_HOURS * 60
    )
    return TokenResponse(access_token=token)


@router.get("/me", response_model=CompanyOut)
def company_me(company: Company = Depends(get_current_company)):
    return company

