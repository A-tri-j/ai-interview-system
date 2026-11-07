# GitHub Actions (ba onno scheduler) theke daily reminder chalanor jonno.
# Swagger-e dekha jay na. CRON_SECRET na thakle ei endpoint nei-i.
import hmac

from fastapi import APIRouter, Header, HTTPException, Request

from app.core.config import settings
from app.core.rate_limit import login_limiter
from app.services import reminders

router = APIRouter(prefix="/api/internal", include_in_schema=False)


@router.post("/run-reminders")
def run_reminders_endpoint(request: Request, x_cron_secret: str | None = Header(default=None)):
    if len(settings.CRON_SECRET) < 24:
        raise HTTPException(404, "Not found")
    key = f"cron:{request.client.host}"
    login_limiter.check(key)
    ok = bool(x_cron_secret) and hmac.compare_digest(
        x_cron_secret.encode(), settings.CRON_SECRET.encode())
    if not ok:
        login_limiter.record(key)
        raise HTTPException(401, "Unauthorized")
    return reminders.run_all()

