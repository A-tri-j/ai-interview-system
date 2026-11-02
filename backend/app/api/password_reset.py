import html
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.rate_limit import otp_limiter, reset_limiter
from app.core.security import hash_password
from app.database.session import get_db
from app.models import Candidate, Company
from app.schemas.auth import ForgotPasswordRequest, ResetPasswordRequest
from app.services.email_service import send_email
from app.services.reset_service import consume_reset_token, create_reset_token

router = APIRouter(prefix="/api/auth", tags=["password reset"])

Role = Literal["candidate", "company"]
MODELS = {"candidate": Candidate, "company": Company}


@router.post("/{role}/forgot-password")
def forgot_password(
    role: Role, data: ForgotPasswordRequest, request: Request,
    background: BackgroundTasks, db: Session = Depends(get_db),
):
    key = f"forgot:{request.client.host}:{data.email}"
    otp_limiter.check(key)
    otp_limiter.record(key)

    user = db.query(MODELS[role]).filter(MODELS[role].email == data.email).first()
    if user and user.is_email_verified:
        token = create_reset_token(db, user.email, role)
        link = f"{settings.PUBLIC_APP_URL}/reset-password?role={role}&token={token}"
        name = user.full_name if role == "candidate" else user.manager_name
        background.add_task(
            send_email, user.email, "Reset your password",
            f"<p>Hello {html.escape(name)},</p>"
            f"<p>Click the link below to set a new password. "
            f"It expires in {settings.RESET_TOKEN_MINUTES} minutes.</p>"
            f'<p><a href="{link}">Reset password</a></p>'
            f"<p>If you did not request this, ignore this email.</p>",
        )
    # Email ache kina ta bole dei na (privacy)
    return {"message": "If the account exists, a reset link has been sent."}


@router.post("/{role}/reset-password")
def reset_password(
    role: Role, data: ResetPasswordRequest, request: Request,
    db: Session = Depends(get_db),
):
    key = f"reset:{request.client.host}"
    reset_limiter.check(key)
    reset_limiter.record(key)

    email = consume_reset_token(db, data.token, role)
    user = db.query(MODELS[role]).filter(MODELS[role].email == email).first() if email else None
    if not user:
        db.rollback()
        raise HTTPException(400, "Invalid or expired reset link")

    user.password_hash = hash_password(data.new_password)
    user.password_changed_at = datetime.now(timezone.utc)  # purano login token batil
    db.commit()
    return {"message": "Password updated. You can log in now."}

