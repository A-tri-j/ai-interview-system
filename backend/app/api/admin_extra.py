from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_admin
from app.database.session import get_db
from app.models import Application, AuditLog, InterviewSession, Vacancy

router = APIRouter(
    prefix="/api/admin",
    tags=["admin extra"],
    dependencies=[Depends(get_current_admin)],
)


@router.get("/vacancies")
def admin_vacancies(
    status: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    q = db.query(Vacancy).options(joinedload(Vacancy.company))
    if status:
        q = q.filter(Vacancy.status == status)
    total = q.count()
    rows = q.order_by(Vacancy.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [
            {
                "id": v.id,
                "title": v.title,
                "company": v.company.company_name,
                "status": v.status,
                "deadline": v.deadline,
                "created_at": v.created_at,
            }
            for v in rows
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/activity")
def admin_activity(db: Session = Depends(get_db)):
    """Application ar interview-er status gonona (dashboard card-er jonno)."""
    apps = dict(
        db.query(Application.status, func.count(Application.id))
        .group_by(Application.status)
        .all()
    )
    interviews = dict(
        db.query(InterviewSession.status, func.count(InterviewSession.id))
        .group_by(InterviewSession.status)
        .all()
    )
    return {"applications_by_status": apps, "interviews_by_status": interviews}


@router.get("/audit-logs")
def admin_audit_logs(
    action: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    q = db.query(AuditLog)
    if action:
        q = q.filter(AuditLog.action == action)
    total = q.count()
    rows = q.order_by(AuditLog.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [
            {
                "id": r.id,
                "actor_role": r.actor_role,
                "actor_id": r.actor_id,
                "action": r.action,
                "entity_type": r.entity_type,
                "entity_id": r.entity_id,
                "details": r.details,
                "created_at": r.created_at,
            }
            for r in rows
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }

