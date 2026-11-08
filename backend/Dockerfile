FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    FASTEMBED_CACHE_PATH=/app/.cache/fastembed

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

# Embedding model build-er somoy-i namiye rakhi, jate runtime-e ~130 MB download na hoy
ARG EMBED_MODEL=BAAI/bge-small-en-v1.5
RUN python -c "from fastembed import TextEmbedding; TextEmbedding(model_name='${EMBED_MODEL}')"

COPY . .

# CRLF thakle shell script fail kore, tai ber kore dei. Non-root user diye chalai.
RUN sed -i 's/\r$//' start.sh && chmod +x start.sh \
 && useradd --create-home --uid 10001 appuser \
 && mkdir -p /app/uploads \
 && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000
CMD ["./start.sh"]

