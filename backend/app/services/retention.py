# Meyad shesh hoyeche emon recording muche felo.
# Chalano: python -m app.services.retention (Render Cron Job-e daily chalano jay)
from datetime import datetime, timezone

from app.database.session import SessionLocal
from app.models import InterviewRecording
from app.services import recording_storage as rec


def purge_expired(db) -> int:
    now = datetime.now(timezone.utc)
    rows = (
        db.query(InterviewRecording)
        .filter(
            InterviewRecording.deleted_at.is_(None),
            InterviewRecording.delete_after.isnot(None),
            InterviewRecording.delete_after < now,
        )
        .all()
    )
    for r in rows:
        rec.delete(r.storage_key)
        r.deleted_at = now
        r.status = "deleted"
        r.transcript_segments = None
    db.commit()
    return len(rows)


if __name__ == "__main__":
    with SessionLocal() as session:
        print("Deleted recordings:", purge_expired(session))

