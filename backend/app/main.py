from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.session import get_db

app = FastAPI(title=settings.APP_NAME)

# Shudhu amader frontend-ke API use korte dibo
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "message": f"Welcome to {settings.APP_NAME} API",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
def health(db: Session = Depends(get_db)):
    """Server ar database thik ache kina check kore (Render health check-e kaje lagbe)."""
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected"}
