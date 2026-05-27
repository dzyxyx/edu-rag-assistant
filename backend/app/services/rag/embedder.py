from functools import lru_cache
from langchain_core.embeddings import Embeddings
from sentence_transformers import SentenceTransformer

from app.core.config import settings


class LocalEmbeddings(Embeddings):
    """SentenceTransformer wrapper, совместимый с LangChain Embeddings API."""

    def __init__(self, model_name: str):
        self._model = SentenceTransformer(model_name)

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return self._model.encode(
            texts, normalize_embeddings=True, show_progress_bar=False
        ).tolist()

    def embed_query(self, text: str) -> list[float]:
        return self._model.encode(text, normalize_embeddings=True).tolist()


@lru_cache(maxsize=1)
def get_embeddings() -> LocalEmbeddings:
    """Синглтон — модель загружается один раз (~120 MB)."""
    return LocalEmbeddings(settings.EMBEDDING_MODEL)
