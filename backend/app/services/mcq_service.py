# MCQ-er timer, answer save, score. Shob somoy SERVER-er ghori onujayi.
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.ai import rag
from app.ai.mcq_service import generate_mcqs
from app.core.config import settings
from app.models import AuditLog, DocumentChunk, McqQuestion, McqStatus, McqTest


def _now() -> datetime:
    return datetime.now(timezone.utc)


def get_test(db: Session, application_id: int, lock: bool = False) -> McqTest | None:
    q = (
        db.query(McqTest).options(selectinload(McqTest.questions))
        .filter(McqTest.application_id == application_id)
    )
    if lock:
        q = q.with_for_update()   # submit ar auto-finalize ekshathe holeo ekbar-i hoy
    return q.first()


def remaining(test: McqTest) -> int:
    if test.deadline_at is None:
        return test.duration_seconds
    return max(0, int((test.deadline_at - _now()).total_seconds()))


def is_overdue(test: McqTest) -> bool:
    return bool(test.deadline_at and _now() > test.deadline_at)


def prepare_test(db: Session, application) -> McqTest:
    """Question toiri kore save kore. Age theke thakle abar toiri kore na."""
    existing = get_test(db, application.id)
    if existing:
        return existing

    vacancy, doc = application.vacancy, application.cv_document
    if not db.query(DocumentChunk.id).filter(DocumentChunk.vacancy_id == vacancy.id).first():
        rag.index_vacancy(db, vacancy)
    if doc is not None:
        try:
            rag.index_document(db, doc)
        except ValueError:
            doc = None          # CV porte pari ni: role-based question-i hobe
    db.commit()

    items = generate_mcqs(db, vacancy, doc, settings.MCQ_COUNT)
    test = McqTest(
        application_id=application.id, duration_seconds=settings.MCQ_SECONDS,
        total=len(items), model_name=settings.GROQ_MODEL,
    )
    for i, it in enumerate(items):
        test.questions.append(McqQuestion(order_index=i, **it))
    db.add(test)
    try:
        db.commit()
    except IntegrityError:       # duibar click: onno request age save korse
        db.rollback()
    return get_test(db, application.id)


def start_test(db: Session, test: McqTest) -> None:
    """Idempotent: ekbar shuru hole deadline r bodlay na (refresh dile timer reset hoy na)."""
    if test.status == McqStatus.READY:
        now = _now()
        test.status = McqStatus.IN_PROGRESS
        test.started_at = now
        test.deadline_at = now + timedelta(seconds=test.duration_seconds)
        db.commit()


def record_answers(db: Session, test: McqTest, items: list[tuple[int, int | None]]) -> None:
    by_id = {q.id: q for q in test.questions}
    now = _now()
    for qid, sel in items:
        q = by_id.get(qid)
        if q is None or (sel is not None and not 0 <= sel <= 3):
            continue
        q.selected_index = sel
        q.answered_at = now


def finalize(db: Session, test: McqTest, auto: bool) -> None:
    """Score hishab kore submit kore. Answer na dewa = vul. Duibar chalale kichu bodlay na."""
    if test.status == McqStatus.SUBMITTED:
        return
    breakdown: dict = defaultdict(lambda: {"correct": 0, "total": 0})
    correct = 0
    for q in test.questions:
        key = q.skill_focus or "general"
        breakdown[key]["total"] += 1
        if q.selected_index == q.correct_index:
            correct += 1
            breakdown[key]["correct"] += 1
    total = len(test.questions)
    now = _now()
    test.correct = correct
    test.total = total
    test.score = round(correct / total * 100, 1) if total else 0.0
    test.breakdown = {k: dict(v) for k, v in breakdown.items()}
    test.auto_submitted = auto
    # Time shesh-er por lazy finalize hole submit somoy = deadline
    test.submitted_at = min(now, test.deadline_at) if (auto and test.deadline_at) else now
    test.status = McqStatus.SUBMITTED
    db.add(AuditLog(actor_role="candidate", action="mcq_submitted", entity_type="application",
                    entity_id=test.application_id, details={"auto": auto, "score": test.score}))
    db.commit()


def expire_if_needed(db: Session, test: McqTest) -> None:
    """Browser bondho kore chole gele-o time shesh hole server nijei submit kore dey."""
    if test.status == McqStatus.IN_PROGRESS and test.deadline_at:
        if _now() > test.deadline_at + timedelta(seconds=settings.MCQ_GRACE_SECONDS):
            finalize(db, test, auto=True)

