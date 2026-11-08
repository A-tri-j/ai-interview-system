from langchain_text_splitters import RecursiveCharacterTextSplitter
from sqlalchemy.orm import Session

from app.ai.embeddings import embed_query, embed_texts
from app.core.config import settings
from app.models import CandidateDocument, DocumentChunk, Vacancy
from app.services import storage
from app.services.text_extract import extract_text


def _split(text: str) -> list[str]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.CHUNK_SIZE, chunk_overlap=settings.CHUNK_OVERLAP
    )
    return [c for c in splitter.split_text(text) if c.strip()]


def vacancy_text(v: Vacancy) -> str:
    """Vacancy-r sob requirement ek text-e (interview criteria shoho)."""
    parts = [
        f"Job title: {v.title}",
        f"Department: {v.department or ''}",
        f"Description: {v.description}",
        f"Responsibilities: {v.responsibilities or ''}",
        f"Required skills: {', '.join(v.required_skills or [])}",
        f"Required technologies: {', '.join(v.required_technologies or [])}",
        f"Education: {v.education_requirements or ''}",
        f"Experience: {v.experience_requirements or ''}",
        f"Interview criteria from company: {v.interview_instructions or ''}",
    ]
    return "\n".join(p for p in parts if not p.endswith(": "))


def _store(db: Session, texts: list[str], **owner) -> None:
    vectors = embed_texts(texts)
    for i, (t, vec) in enumerate(zip(texts, vectors)):
        db.add(DocumentChunk(chunk_index=i, text=t, embedding=vec, **owner))
    db.flush()


def index_vacancy(db: Session, v: Vacancy) -> None:
    """Vacancy bodle thakte pare, tai protibar purano chunk muche abar banai."""
    db.query(DocumentChunk).filter(DocumentChunk.vacancy_id == v.id).delete()
    _store(db, _split(vacancy_text(v)), vacancy_id=v.id)


def index_document(db: Session, doc: CandidateDocument) -> None:
    """CV-r content bodlay na, tai ekbar index korlei hoy. Text na pele ValueError."""
    already = db.query(DocumentChunk.id).filter(DocumentChunk.document_id == doc.id).first()
    if already:
        return
    try:
        with storage.local_path(doc.storage_key) as path:
            text = extract_text(path)
    except FileNotFoundError:
        raise ValueError("The CV file is missing")
    _store(db, _split(text), document_id=doc.id)


def document_text(db: Session, document_id: int) -> str:
    rows = (
        db.query(DocumentChunk.text)
        .filter(DocumentChunk.document_id == document_id)
        .order_by(DocumentChunk.chunk_index).all()
    )
    return " ".join(r[0] for r in rows)


def retrieve(
    db: Session, query: str, *, vacancy_id: int | None = None,
    document_id: int | None = None, k: int | None = None,
) -> list[str]:
    """Query-r shobcheye kachhakachhi chunk gulo (cosine distance) ber kore."""
    q = db.query(DocumentChunk)
    if vacancy_id is not None:
        q = q.filter(DocumentChunk.vacancy_id == vacancy_id)
    if document_id is not None:
        q = q.filter(DocumentChunk.document_id == document_id)
    qv = embed_query(query)
    rows = (
        q.order_by(DocumentChunk.embedding.cosine_distance(qv))
        .limit(k or settings.RAG_TOP_K).all()
    )
    return [r.text for r in rows]

