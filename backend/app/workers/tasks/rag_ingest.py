import logging
from pathlib import Path

from app.workers.celery_app import celery_app
from app.services.rag.loader import load_knowledge_base
from app.services.rag.vector_store import get_vector_store

logger = logging.getLogger(__name__)

KB_DIR = Path(__file__).parent.parent.parent.parent / "knowledge_base"


@celery_app.task(
    name="app.workers.tasks.rag_ingest.run_rag_ingest",
    bind=True,
    max_retries=3,
)
def run_rag_ingest(self):
    try:
        logger.info("RAG ingest: загрузка базы знаний из %s", KB_DIR)
        docs = load_knowledge_base(KB_DIR)
        if not docs:
            logger.warning("RAG ingest: документы не найдены в %s", KB_DIR)
            return {"status": "skipped", "chunks": 0}

        logger.info("RAG ingest: %d чанков готово к индексации", len(docs))

        store = get_vector_store()
        store.reset_collection()
        store.add_documents(docs)

        logger.info("RAG ingest: завершено, проиндексировано %d чанков", len(docs))
        return {"status": "ok", "chunks": len(docs)}
    except Exception as exc:
        logger.exception("RAG ingest: ошибка — %s", exc)
        raise self.retry(exc=exc, countdown=120)
