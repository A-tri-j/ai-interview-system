from datetime import date

from sqlalchemy import Date, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models.base import TimestampMixin


class VacancyStatus:
    DRAFT = "draft"
    PUBLISHED = "published"
    CLOSED = "closed"


class Vacancy(Base, TimestampMixin):
    __tablename__ = "vacancies"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(200))
    department: Mapped[str | None] = mapped_column(String(150))
    description: Mapped[str] = mapped_column(Text)
    responsibilities: Mapped[str | None] = mapped_column(Text)
    required_skills: Mapped[list | None] = mapped_column(JSONB)
    required_technologies: Mapped[list | None] = mapped_column(JSONB)
    education_requirements: Mapped[str | None] = mapped_column(Text)
    experience_requirements: Mapped[str | None] = mapped_column(String(200))
    employment_type: Mapped[str] = mapped_column(String(50))   # full_time, part_time...
    salary_range: Mapped[str | None] = mapped_column(String(100))
    location: Mapped[str] = mapped_column(String(200))
    work_mode: Mapped[str] = mapped_column(String(20))         # remote, hybrid, onsite
    openings: Mapped[int] = mapped_column(Integer, default=1)
    deadline: Mapped[date | None] = mapped_column(Date)
    interview_instructions: Mapped[str | None] = mapped_column(Text)  # AI interview criteria
    status: Mapped[str] = mapped_column(String(20), default=VacancyStatus.DRAFT)

    company = relationship("Company")

    # Public list e status + deadline diye filter korbo, tai index
    __table_args__ = (Index("ix_vacancies_status_deadline", "status", "deadline"),)

