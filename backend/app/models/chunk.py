# RAG-er chunk + embedding. Ekta chunk hoy CV-r, noyto vacancy-r.
from pgvector.sqlalchemy import Vector
from sqlalchemy import CheckConstraint, ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.session import Base
from app.models.base import TimestampMixin

EMBED_DIM = 384  # BAAI/bge-small-en-v1.5


class DocumentChunk(Base, TimestampMixin):
    __tablename__ = "document_chunks"

    id: Mapped[int] = mapped_column(primary_key=True)
    # CV ba vacancy delete hole chunk-o auto delete (privacy)
    document_id: Mapped[int | None] = mapped_column(
        ForeignKey("candidate_documents.id", ondelete="CASCADE"), index=True
    )
    vacancy_id: Mapped[int | None] = mapped_column(
        ForeignKey("vacancies.id", ondelete="CASCADE"), index=True
    )
    chunk_index: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    embedding = mapped_column(Vector(EMBED_DIM))

    __table_args__ = (
        CheckConstraint(
            "(document_id IS NOT NULL) <> (vacancy_id IS NOT NULL)", name="ck_chunk_one_source"
        ),
    )

