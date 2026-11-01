from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base
from app.models.base import TimestampMixin


class CompanyStatus:
    PENDING_VERIFICATION = "pending_verification"  # email verify hoyni
    PENDING_APPROVAL = "pending_approval"          # admin approval baki
    APPROVED = "approved"
    REJECTED = "rejected"
    SUSPENDED = "suspended"


class Company(Base, TimestampMixin):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    registration_number: Mapped[str] = mapped_column(String(100), unique=True)
    manager_name: Mapped[str] = mapped_column(String(150))
    manager_designation: Mapped[str] = mapped_column(String(150))
    phone: Mapped[str] = mapped_column(String(30))
    industry: Mapped[str] = mapped_column(String(100))
    company_size: Mapped[str] = mapped_column(String(50))
    address: Mapped[str] = mapped_column(Text)
    website: Mapped[str | None] = mapped_column(String(300))
    description: Mapped[str | None] = mapped_column(Text)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(
        String(30), default=CompanyStatus.PENDING_VERIFICATION, index=True
    )
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

