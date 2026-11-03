import logging
import time

from app.ai.groq_client import AIUnavailable
from app.core.config import settings

logger = logging.getLogger("ai")


def _d(s) -> dict:
    return s if isinstance(s, dict) else getattr(s, "__dict__", {})


def transcribe(data: bytes, filename: str) -> tuple[str, list[dict]]:
    """Audio/video bytes theke (text, segments). Rate limit-e retry kore.
    File-i bhalo na hole ValueError, service down hole AIUnavailable."""
    if not settings.GROQ_API_KEY or settings.GROQ_API_KEY == "your-groq-key":
        raise AIUnavailable("GROQ_API_KEY is not configured")

    from groq import APIConnectionError, APIError, BadRequestError, Groq, RateLimitError

    client = Groq(api_key=settings.GROQ_API_KEY, timeout=120)
    kwargs = {
        "model": settings.WHISPER_MODEL,
        "response_format": "verbose_json",
        "temperature": 0.0,
    }
    if settings.WHISPER_LANGUAGE:
        kwargs["language"] = settings.WHISPER_LANGUAGE

    last = None
    for attempt in range(3):
        try:
            r = client.audio.transcriptions.create(file=(filename, data), **kwargs)
            text = (getattr(r, "text", "") or "").strip()
            segments = [
                {
                    "start": round(float(_d(s).get("start", 0)), 2),
                    "end": round(float(_d(s).get("end", 0)), 2),
                    "text": str(_d(s).get("text", "")).strip(),
                }
                for s in (getattr(r, "segments", None) or [])
            ]
            return text, segments
        except BadRequestError as exc:
            # nosto/unsupported file, retry kore labh nei
            raise ValueError("This recording could not be processed") from exc
        except RateLimitError as exc:
            last = exc
            time.sleep(3 * (2**attempt))
        except (APIConnectionError, APIError) as exc:
            last = exc
            time.sleep(1 + attempt)

    logger.error("Whisper failed after retries: %s", last)
    raise AIUnavailable("Transcription service is busy")

