from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base
from app.models.base import TimestampMixin


class SavedJob(Base, TimestampMixin):
    """Candidate-er "pore dekhbo" list."""
    __tablename__ = "saved_jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_id: Mapped[int] = mapped_column(
        ForeignKey("candidates.id", ondelete="CASCADE"), index=True
    )
    vacancy_id: Mapped[int] = mapped_column(
        ForeignKey("vacancies.id", ondelete="CASCADE"), index=True
    )

    __table_args__ = (UniqueConstraint("candidate_id", "vacancy_id", name="uq_saved_once"),)

