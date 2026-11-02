# Local embedding model (fastembed, ONNX). API key lage na.
# Prothom bar model download hoy (~130 MB), tai prothom call dhire.
from app.core.config import settings

_model = None


def _get():
    global _model
    if _model is None:
        from fastembed import TextEmbedding
        _model = TextEmbedding(model_name=settings.EMBED_MODEL)
    return _model


def embed_texts(texts: list[str]) -> list[list[float]]:
    return [[float(x) for x in v] for v in _get().embed(texts)]


def embed_query(text: str) -> list[float]:
    # Query-r jonno alada method (retrieval-e bhalo kaj kore)
    return [float(x) for x in next(iter(_get().query_embed(text)))]

