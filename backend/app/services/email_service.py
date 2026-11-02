# Gmail SMTP diye email pathanor reusable service.
import html
import logging
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr

from app.core.config import settings

logger = logging.getLogger("email")


def send_email(to: str, subject: str, html_body: str) -> bool:
    """Email pathay. Safol hole True, fail hole False (app crash korbe na)."""
    if not settings.smtp_configured:
        # SMTP set na thakle development-e console-e dekhai
        if settings.ENVIRONMENT == "development":
            print(f"\n[DEV EMAIL] To: {to}\nSubject: {subject}\n{html_body}\n")
            return True
        logger.error("SMTP is not configured")
        return False

    msg = EmailMessage()
    msg["From"] = formataddr((settings.EMAIL_FROM_NAME, settings.SMTP_EMAIL))
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content("Please open this email in an HTML-compatible email client.")
    msg.add_alternative(html_body, subtype="html")

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as server:
            server.starttls(context=ssl.create_default_context())
            server.login(settings.SMTP_EMAIL, settings.SMTP_APP_PASSWORD)
            server.send_message(msg)
        return True
    except Exception as exc:  # noqa: BLE001
        logger.error("Email failed: %s", exc)
        return False


def otp_email_html(name: str, otp: str, minutes: int) -> str:
    # html.escape: user-er name-e HTML thakle jate kaj na kore
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:480px">
      <h2>Verify your email</h2>
      <p>Hello {html.escape(name)},</p>
      <p>Your verification code is:</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:6px">{otp}</p>
      <p>This code expires in {minutes} minutes. If you did not request it, ignore this email.</p>
    </div>
    """

