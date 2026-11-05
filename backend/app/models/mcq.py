# Round 2: MCQ test. Correct answer candidate-ke kokhono pathano hoy na.
from datetime import datetime

from sqlalchemy import (
    Boolean, CheckConstraint, DateTime, Float, ForeignKey, Integer, String, Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models.base import TimestampMixin


class McqStatus:
    READY = "ready"              # question toiri, candidate shuru kore ni
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"


class McqTest(Base, TimestampMixin):
    __tablename__ = "mcq_tests"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), unique=True
    )
    status: Mapped[str] = mapped_column(String(20), default=McqStatus.READY, index=True)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=180)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deadline_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    auto_submitted: Mapped[bool] = mapped_column(Boolean, default=False)
    total: Mapped[int] = mapped_column(Integer, default=0)
    correct: Mapped[int | None] = mapped_column(Integer)
    score: Mapped[float | None] = mapped_column(Float)          # 0-100
    breakdown: Mapped[dict | None] = mapped_column(JSONB)       # skill-wise
    model_name: Mapped[str | None] = mapped_column(String(100))

    questions = relationship(
        "McqQuestion", back_populates="test",
        order_by="McqQuestion.order_index", cascade="all, delete-orphan",
    )


class McqQuestion(Base, TimestampMixin):
    __tablename__ = "mcq_questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    test_id: Mapped[int] = mapped_column(
        ForeignKey("mcq_tests.id", ondelete="CASCADE"), index=True
    )
    order_index: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    options: Mapped[list] = mapped_column(JSONB)                # 4 ta string
    correct_index: Mapped[int] = mapped_column(Integer)
    explanation: Mapped[str | None] = mapped_column(Text)
    skill_focus: Mapped[str | None] = mapped_column(String(80))
    difficulty: Mapped[str | None] = mapped_column(String(15))
    source: Mapped[str] = mapped_column(String(10), default="role")   # role / cv
    selected_index: Mapped[int | None] = mapped_column(Integer)       # null = answer dey ni
    answered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    test = relationship("McqTest", back_populates="questions")

    __table_args__ = (
        UniqueConstraint("test_id", "order_index", name="uq_mcq_order"),
        CheckConstraint("correct_index BETWEEN 0 AND 3", name="ck_mcq_correct_range"),
        CheckConstraint(
            "selected_index IS NULL OR selected_index BETWEEN 0 AND 3", name="ck_mcq_selected_range"
        ),
    )

