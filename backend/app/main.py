from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api import (
    admin,
    admin_extra,
    applications,
    auth,
    bulk,
    candidate_extras,
    candidate_privacy,
    candidates,
    company_auth,
    company_profile,
    decisions,
    internal,
    interview_flow,
    interviews,
    mcq,
    password_reset,
    public_stats,
    ranking,
    recommend,
    recordings,
    reports,
    retakes,
    saved,
    session,
    vacancies,
)
from app.core.config import settings
from app.database.session import get_db

_prod = settings.ENVIRONMENT == "production"
app = FastAPI(
    title=settings.APP_NAME,
    docs_url=None if _prod else "/docs",
    redoc_url=None,
    openapi_url=None if _prod else "/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(company_auth.router)
app.include_router(password_reset.router)
app.include_router(session.router)
app.include_router(admin.router)
app.include_router(vacancies.public_router)
app.include_router(vacancies.company_router)
app.include_router(candidates.router)
app.include_router(applications.candidate_router)
app.include_router(applications.company_router)
app.include_router(decisions.router)
app.include_router(interviews.router)
app.include_router(interview_flow.router)
app.include_router(recordings.router)
app.include_router(reports.router)
app.include_router(candidate_privacy.router)
app.include_router(candidate_privacy.result_router)
app.include_router(company_profile.router)
app.include_router(admin_extra.router)
app.include_router(mcq.candidate_router)
app.include_router(mcq.company_router)
app.include_router(recommend.router)
app.include_router(ranking.router)
app.include_router(internal.router)
app.include_router(retakes.router)
app.include_router(bulk.router)
app.include_router(saved.router)
app.include_router(candidate_extras.router)
app.include_router(public_stats.router)


@app.get("/")
def root():
    return {"name": settings.APP_NAME, "status": "running"}


@app.get("/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected"}
