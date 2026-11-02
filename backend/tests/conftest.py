# Test-er age environment set kori, tarpor app import hoy.
# Ei file test DB chhara kokhono real DB-te lekhe na.
import os
import tempfile

import bcrypt
import pytest
from dotenv import dotenv_values

env = dotenv_values(".env")
test_url = os.environ.get("TEST_DATABASE_URL") or env.get("TEST_DATABASE_URL")
if not test_url:
    raise RuntimeError("Set TEST_DATABASE_URL in backend/.env (use a separate Neon branch)")
if test_url == env.get("DATABASE_URL"):
    raise RuntimeError("TEST_DATABASE_URL must NOT be the same as DATABASE_URL")

os.environ["DATABASE_URL"] = test_url
os.environ["ENVIRONMENT"] = "test"
os.environ["ADMIN_EMAIL"] = "admin@example.com"
os.environ["ADMIN_PASSWORD_HASH"] = bcrypt.hashpw(b"AdminPass123", bcrypt.gensalt()).decode()
os.environ["JWT_SECRET"] = "test-secret-for-pytest-only-1234567890"
os.environ["UPLOAD_DIR"] = tempfile.mkdtemp(prefix="cv_test_")
os.environ["NOTIFY_ON_REJECTION"] = "false"

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

import app.models  # noqa: F401, E402
from app.core.rate_limit import login_limiter, otp_limiter, reset_limiter  # noqa: E402
from app.database.session import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def db_lock():
    conn = engine.connect().execution_options(isolation_level="AUTOCOMMIT")
    locked = conn.execute(text("SELECT pg_try_advisory_lock(424242)")).scalar()
    if not locked:
        conn.close()
        raise RuntimeError(
            "Another pytest run is using the test database. Stop it and try again."
        )
    yield
    try:
        conn.execute(text("SELECT pg_advisory_unlock(424242)"))
    finally:
        conn.close()


@pytest.fixture(scope="session", autouse=True)
def tables():
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture(autouse=True)
def clean_state():
    login_limiter.hits.clear()
    otp_limiter.hits.clear()
    reset_limiter.hits.clear()
    yield
    names = ", ".join(t.name for t in Base.metadata.sorted_tables)
    with engine.begin() as conn:
        conn.execute(text("SET LOCAL lock_timeout = '10s'"))
        conn.execute(text(f"TRUNCATE {names} RESTART IDENTITY CASCADE"))
    engine.dispose()


@pytest.fixture(autouse=True)
def sent_emails(monkeypatch):
    """Real email pathabo na. Pathano email gulo list-e jomay."""
    sent = []

    def fake_send(to, subject, body):
        sent.append((to, subject, body))
        return True

    for module in (
        "app.api.auth",
        "app.api.company_auth",
        "app.api.admin",
        "app.api.applications",
        "app.api.password_reset",
        "app.api.decisions",
    ):
        monkeypatch.setattr(f"{module}.send_email", fake_send)
    # OTP sobsomoy 123456 hoye jak
    monkeypatch.setattr("app.services.otp_service.generate_otp", lambda: "123456")
    return sent


@pytest.fixture
def client():
    return TestClient(app)
