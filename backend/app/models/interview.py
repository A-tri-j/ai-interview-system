# AI interview-er sob table. Video file database-e na, shudhu storage_key thake.
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models.base import TimestampMixin


class InterviewSessionStatus:
    INVITED = "invited"
    CONSENTED = "consented"
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    EVALUATING = "evaluating"
    COMPLETED = "completed"
    FAILED = "failed"
    EXPIRED = "expired"


class InterviewSession(Base, TimestampMixin):
    """Ek application-er jonno ekta-i interview session."""
    __tablename__ = "interview_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    application_id: Mapped[int] = mapped_column(
        ForeignKey("applications.id", ondelete="CASCADE"), unique=True
    )
    status: Mapped[str] = mapped_column(
        String(20), default=InterviewSessionStatus.INVITED, index=True
    )
    target_minutes: Mapped[int] = mapped_column(Integer, default=6)
    consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    consent_version: Mapped[str | None] = mapped_column(String(20))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error: Mapped[str | None] = mapped_column(Text)

    application = relationship("Application")
    questions = relationship(
        "InterviewQuestion", back_populates="session",
        order_by="InterviewQuestion.order_index", cascade="all, delete-orphan",
    )


class InterviewQuestion(Base, TimestampMixin):
    __tablename__ = "interview_questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("interview_sessions.id", ondelete="CASCADE"), index=True
    )
    order_index: Mapped[int] = mapped_column(Integer)
    kind: Mapped[str] = mapped_column(String(15), default="initial")   # initial / followup
    category: Mapped[str] = mapped_column(String(20), default="technical")  # technical/project/role
    text: Mapped[str] = mapped_column(Text)
    difficulty: Mapped[str | None] = mapped_column(String(15))
    expected_points: Mapped[list | None] = mapped_column(JSONB)   # ki ki thaka uchit
    source_evidence: Mapped[str | None] = mapped_column(Text)     # CV/vacancy-r kon ongsho theke
    parent_question_id: Mapped[int | None] = mapped_column(
        ForeignKey("interview_questions.id", ondelete="SET NULL")
    )

    session = relationship("InterviewSession", back_populates="questions")
    answer = relationship(
        "InterviewAnswer", back_populates="question", uselist=False,
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        UniqueConstraint("session_id", "order_index", name="uq_question_order"),
    )


class InterviewAnswer(Base, TimestampMixin):
    """Transcript + rubric score. Score 0-10."""
    __tablename__ = "interview_answers"

    id: Mapped[int] = mapped_column(primary_key=True)
    question_id: Mapped[int] = mapped_column(
        ForeignKey("interview_questions.id", ondelete="CASCADE"), unique=True
    )
    transcript: Mapped[str | None] = mapped_column(Text)
    start_sec: Mapped[float | None] = mapped_column(Float)
    end_sec: Mapped[float | None] = mapped_column(Float)
    technical_score: Mapped[float | None] = mapped_column(Float)
    relevance_score: Mapped[float | None] = mapped_column(Float)
    problem_solving_score: Mapped[float | None] = mapped_column(Float)
    clarity_score: Mapped[float | None] = mapped_column(Float)
    overall_score: Mapped[float | None] = mapped_column(Float)
    feedback: Mapped[str | None] = mapped_column(Text)
    evidence: Mapped[list | None] = mapped_column(JSONB)   # transcript theke proman

    question = relationship("InterviewQuestion", back_populates="answer")


class InterviewRecording(Base, TimestampMixin):
    __tablename__ = "interview_recordings"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("interview_sessions.id", ondelete="CASCADE"), index=True
    )
    storage_key: Mapped[str] = mapped_column(String(500))
    content_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer)
    duration_seconds: Mapped[float | None] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(20), default="uploaded")
    transcript_text: Mapped[str | None] = mapped_column(Text)
    transcript_segments: Mapped[list | None] = mapped_column(JSONB)  # timestamp shoho
    delete_after: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class InterviewReport(Base, TimestampMixin):
    __tablename__ = "interview_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("interview_sessions.id", ondelete="CASCADE"), unique=True
    )
    overall_score: Mapped[float | None] = mapped_column(Float)
    summary: Mapped[str | None] = mapped_column(Text)
    strengths: Mapped[list | None] = mapped_column(JSONB)
    improvements: Mapped[list | None] = mapped_column(JSONB)
    limitations: Mapped[str | None] = mapped_column(Text)
    rubric_version: Mapped[str] = mapped_column(String(20), default="v1")
    model_name: Mapped[str | None] = mapped_column(String(100))
    raw_output: Mapped[dict | None] = mapped_column(JSONB)

