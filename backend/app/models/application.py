from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models.base import TimestampMixin


class ApplicationStatus:
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    APPROVED_FOR_INTERVIEW = "approved_for_interview"
    REJECTED = "rejected"
    INTERVIEW_COMPLETED = "interview_completed"
    SHORTLISTED = "shortlisted"
    ACCEPTED = "accepted"
    ON_HOLD = "on_hold"
    FINAL_REJECTED = "final_rejected"


class CandidateDocument(Base, TimestampMixin):
    """CV-r metadata. Asol file object storage-e thakbe, database-e na."""
    __tablename__ = "candidate_documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_id: Mapped[int] = mapped_column(
        ForeignKey("candidates.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(30), default="cv")
    storage_key: Mapped[str] = mapped_column(String(500))
    original_filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int]


class Application(Base, TimestampMixin):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(primary_key=True)
    vacancy_id: Mapped[int] = mapped_column(
        ForeignKey("vacancies.id", ondelete="CASCADE"), index=True
    )
    candidate_id: Mapped[int] = mapped_column(
        ForeignKey("candidates.id", ondelete="CASCADE"), index=True
    )
    applicant_name: Mapped[str] = mapped_column(String(150))
    applicant_email: Mapped[str] = mapped_column(String(255))
    applicant_phone: Mapped[str] = mapped_column(String(30))
    education: Mapped[str] = mapped_column(Text)
    message: Mapped[str | None] = mapped_column(Text)          # query / msg box
    cv_document_id: Mapped[int | None] = mapped_column(ForeignKey("candidate_documents.id"))
    status: Mapped[str] = mapped_column(
        String(30), default=ApplicationStatus.SUBMITTED, index=True
    )
    status_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    company_notes: Mapped[str | None] = mapped_column(Text)   # internal note

    vacancy = relationship("Vacancy")
    candidate = relationship("Candidate")
    cv_document = relationship("CandidateDocument")

    # Ekjon candidate ek vacancy-te ekbar-i apply korte parbe
    __table_args__ = (
        UniqueConstraint("vacancy_id", "candidate_id", name="uq_application_once"),
    )

