from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api import (
    admin,
    applications,
    auth,
    candidates,
    company_auth,
    decisions,
    interview_flow,
    interviews,
    password_reset,
    recordings,
    session,
    vacancies,
)
from app.core.config import settings
from app.database.session import get_db

app = FastAPI(title=settings.APP_NAME)

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


@app.get("/")
def root():
    return {"name": settings.APP_NAME, "status": "running"}


@app.get("/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected"}
