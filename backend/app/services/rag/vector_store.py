from functools import lru_cache

import chromadb
from langchain_chroma import Chroma

from app.core.config import settings
from app.services.rag.embedder import get_embeddings


@lru_cache(maxsize=1)
def get_vector_store() -> Chroma:
    """Синглтон — подключение к Chroma HTTP-сервису."""
    client = chromadb.HttpClient(
        host=settings.CHROMA_HOST,
        port=settings.CHROMA_PORT,
    )
    return Chroma(
        client=client,
        collection_name=settings.CHROMA_COLLECTION_RAG,
        embedding_function=get_embeddings(),
    )
