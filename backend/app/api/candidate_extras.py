# Candidate-er recent activity (ager data theke, notun table nei) ar preference.
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_candidate
from app.database.session import get_db
from app.models import (
    Application, Candidate, InterviewSession, McqTest, SavedJob, Vacancy,
)

router = APIRouter(prefix="/api/candidates/me", tags=["candidate extras"])

STATUS_TEXT = {
    "approved_for_interview": "You were invited to interview for {t} at {c}",
    "under_review": "{c} is reviewing your application for {t}",
    "rejected": "Your application for {t} at {c} was not selected",
    "shortlisted": "You were shortlisted for {t} at {c}",
    "accepted": "Congratulations! {c} accepted you for {t}",
    "on_hold": "{c} put your application for {t} on hold",
    "final_rejected": "{c} will not move forward with {t}",
}


@router.get("/activity")
def activity(
    limit: int = Query(12, ge=1, le=30),
    c: Candidate = Depends(get_current_candidate), db: Session = Depends(get_db),
):
    events = []
    apps = (
        db.query(Application)
        .options(joinedload(Application.vacancy).joinedload(Vacancy.company))
        .filter(Application.candidate_id == c.id).order_by(Application.id.desc()).limit(40).all()
    )
    for a in apps:
        t, co = a.vacancy.title, a.vacancy.company.company_name
        events.append({"type": "applied", "text": f"You applied to {t} at {co}",
                       "at": a.created_at, "link": "/dashboard"})
        tpl = STATUS_TEXT.get(a.status)
        if tpl and a.status_changed_at:
            events.append({"type": "status", "text": tpl.format(t=t, c=co),
                           "at": a.status_changed_at, "link": "/dashboard"})

    for at, title in (
        db.query(InterviewSession.submitted_at, Vacancy.title)
        .join(Application, InterviewSession.application_id == Application.id)
        .join(Vacancy, Application.vacancy_id == Vacancy.id)
        .filter(Application.candidate_id == c.id, InterviewSession.submitted_at.isnot(None))
        .order_by(InterviewSession.submitted_at.desc()).limit(20)
    ):
        events.append({"type": "interview", "text": f"You submitted the video interview for {title}",
                       "at": at, "link": "/dashboard"})

    for at, title in (
        db.query(McqTest.submitted_at, Vacancy.title)
        .join(Application, McqTest.application_id == Application.id)
        .join(Vacancy, Application.vacancy_id == Vacancy.id)
        .filter(Application.candidate_id == c.id, McqTest.submitted_at.isnot(None))
        .order_by(McqTest.submitted_at.desc()).limit(20)
    ):
        events.append({"type": "mcq", "text": f"You completed the Round 2 MCQ test for {title}",
                       "at": at, "link": "/dashboard"})

    for at, vid, title in (
        db.query(SavedJob.created_at, Vacancy.id, Vacancy.title)
        .join(Vacancy, SavedJob.vacancy_id == Vacancy.id)
        .filter(SavedJob.candidate_id == c.id)
        .order_by(SavedJob.id.desc()).limit(20)
    ):
        events.append({"type": "saved", "text": f"You saved {title} for later",
                       "at": at, "link": f"/jobs/{vid}"})

    events.sort(key=lambda e: e["at"], reverse=True)
    return {"items": events[:limit]}


class PrefsIn(BaseModel):
    reminder_emails: bool


@router.get("/preferences")
def get_prefs(c: Candidate = Depends(get_current_candidate)):
    return {"reminder_emails": c.reminder_emails}


@router.put("/preferences")
def set_prefs(
    data: PrefsIn, c: Candidate = Depends(get_current_candidate), db: Session = Depends(get_db),
):
    c.reminder_emails = data.reminder_emails
    db.commit()
    return {"reminder_emails": c.reminder_emails}
