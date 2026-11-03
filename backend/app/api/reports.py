# Company-r interview report. Shudhu nijer vacancy-r applicant-er.
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from app.ai.evaluation import run_evaluation
from app.api.applications import _company_application
from app.api.deps import get_current_company
from app.api.recordings import VISIBLE
from app.database.session import get_db
from app.models import (
    AuditLog,
    Company,
    CompanyStatus,
    InterviewQuestion,
    InterviewRecording,
    InterviewReport,
    InterviewSession,
    InterviewSessionStatus,
)

router = APIRouter(prefix="/api/company/applications", tags=["interview reports"])

STUCK_AFTER = timedelta(minutes=15)


def _session(db: Session, app_id: int):
    return (
        db.query(InterviewSession)
        .options(selectinload(InterviewSession.questions).joinedload(InterviewQuestion.answer))
        .filter(InterviewSession.application_id == app_id)
        .first()
    )


@router.get("/{app_id}/interview-status")
def interview_status(
    app_id: int,
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db),
):
    """Interview shuru hoyeche kina, consent decline korse kina."""
    a = _company_application(db, company, app_id)
    session = db.query(InterviewSession).filter(InterviewSession.application_id == a.id).first()
    declined = (
        db.query(AuditLog.id)
        .filter(
            AuditLog.action == "interview_consent_declined",
            AuditLog.entity_id == a.id,
        )
        .first()
        is not None
    )
    return {
        "application_status": a.status,
        "session_status": session.status if session else None,
        "recording_mode": session.recording_mode if session else None,
        "submitted_at": session.submitted_at if session else None,
        "consent_declined": declined,
        "error": session.error if session else None,
    }


@router.get("/{app_id}/report")
def get_report(
    app_id: int,
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db),
):
    a = _company_application(db, company, app_id)
    session = _session(db, a.id)
    if not session or session.status not in VISIBLE:
        raise HTTPException(404, "No submitted interview for this application")

    report = db.query(InterviewReport).filter(InterviewReport.session_id == session.id).first()
    rec_ids = {
        r.question_id: r.id
        for r in db.query(InterviewRecording).filter(
            InterviewRecording.session_id == session.id,
            InterviewRecording.deleted_at.is_(None),
        )
    }
    p = a.candidate.profile
    return {
        "advisory_notice": "AI scores are advisory only. The hiring decision is made by people.",
        "candidate": {
            "name": a.applicant_name,
            "email": a.applicant_email,
            "phone": a.applicant_phone,
            "education": a.education,
            "skills": (p.skills if p else None) or [],
            "experience": p.experience if p else None,
            "projects": p.projects if p else None,
        },
        "vacancy": {"id": a.vacancy_id, "title": a.vacancy.title},
        "application_status": a.status,
        "company_notes": a.company_notes,
        "session": {
            "status": session.status,
            "submitted_at": session.submitted_at,
            "recording_mode": session.recording_mode,
            "error": session.error,
        },
        "report": (
            None
            if not report
            else {
                "overall_score": report.overall_score,
                "scale": "0-100",
                "summary": report.summary,
                "strengths": report.strengths or [],
                "improvements": report.improvements or [],
                "limitations": report.limitations,
                "rubric_version": report.rubric_version,
                "model": report.model_name,
                "criteria": ["technical", "relevance", "problem_solving", "clarity"],
            }
        ),
        "questions": [
            {
                "order": q.order_index + 1,
                "kind": q.kind,
                "category": q.category,
                "question": q.text,
                "expected_points": q.expected_points or [],
                "transcript": q.answer.transcript if q.answer else None,
                "scores": (
                    None
                    if not (q.answer and q.answer.overall_score is not None)
                    else {
                        "technical": q.answer.technical_score,
                        "relevance": q.answer.relevance_score,
                        "problem_solving": q.answer.problem_solving_score,
                        "clarity": q.answer.clarity_score,
                        "overall": q.answer.overall_score,
                    }
                ),
                "feedback": q.answer.feedback if q.answer else None,
                "evidence": (q.answer.evidence if q.answer else None) or [],
                "recording_id": rec_ids.get(q.id),
            }
            for q in sorted(session.questions, key=lambda x: x.order_index)
        ],
    }


@router.post("/{app_id}/report/retry", status_code=202)
def retry_evaluation(
    app_id: int,
    background: BackgroundTasks,
    company: Company = Depends(get_current_company),
    db: Session = Depends(get_db),
):
    """AI evaluation fail korle (ba atke gele) abar chalay."""
    if company.status != CompanyStatus.APPROVED:
        raise HTTPException(403, "Your company must be approved")
    a = _company_application(db, company, app_id)
    session = _session(db, a.id)
    if not session or session.status not in VISIBLE:
        raise HTTPException(404, "No submitted interview for this application")

    stuck = (
        session.status == InterviewSessionStatus.EVALUATING
        and session.updated_at < datetime.now(timezone.utc) - STUCK_AFTER
    )
    if (
        session.status not in (InterviewSessionStatus.SUBMITTED, InterviewSessionStatus.FAILED)
        and not stuck
    ):
        raise HTTPException(409, "Evaluation is already running or finished")
    background.add_task(run_evaluation, session.id, True)
    return {"message": "Evaluation restarted"}
