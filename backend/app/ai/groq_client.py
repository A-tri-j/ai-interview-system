# Groq call. Rate limit / network error-e retry kore, JSON na ashle-o retry kore.
import json
import logging
import time

from app.core.config import settings

logger = logging.getLogger("ai")


class AIUnavailable(Exception):
    """Groq key nai, ba bar bar fail korse."""


def chat_json(system: str, user: str, *, temperature: float = 0.4,
              max_tokens: int = 3000, retries: int = 3) -> dict:
    if not settings.GROQ_API_KEY or settings.GROQ_API_KEY == "your-groq-key":
        raise AIUnavailable("GROQ_API_KEY is not configured")

    from groq import APIConnectionError, APIError, Groq, RateLimitError
    client = Groq(api_key=settings.GROQ_API_KEY, timeout=settings.GROQ_TIMEOUT)

    last = None
    for attempt in range(retries):
        try:
            r = client.chat.completions.create(
                model=settings.GROQ_MODEL,
                messages=[{"role": "system", "content": system},
                          {"role": "user", "content": user}],
                temperature=temperature, max_tokens=max_tokens,
                response_format={"type": "json_object"},
            )
            return json.loads(r.choices[0].message.content)
        except RateLimitError as exc:       # free tier limit: beshi opekkha kori
            last = exc
            time.sleep(3 * (2 ** attempt))
        except (APIConnectionError, APIError, json.JSONDecodeError, TypeError) as exc:
            last = exc
            time.sleep(1 + attempt)
    logger.error("Groq failed after retries: %s", last)
    raise AIUnavailable("The AI service is busy. Please try again shortly.")
