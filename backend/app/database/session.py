# Database connection. Protita API request-e ekta session pabe.
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

# pool_pre_ping: Neon connection ghumiye gele auto reconnect kore
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    """Sob database model ei Base theke inherit korbe."""
    pass


def get_db():
    """FastAPI dependency: request shesh hole session auto close hoy."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
