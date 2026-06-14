import asyncio
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models.agent_memory import AgentMemory
from app.db.repositories.agent_memory import AgentMemoryRepository

logger = logging.getLogger(__name__)


# TODO[MOCK]: при MOCK_LLM=true Chroma не используется — retrieve_relevant
# и индексация работают через простые SQL-запросы (см. AgentMemoryRepository).


def _get_memory_vector_store():
    """Отдельная коллекция Chroma для долгосрочной памяти агента (FR-6.1)."""
    import chromadb
    from langchain_chroma import Chroma

    from app.services.rag.embedder import get_embeddings

    client = chromadb.HttpClient(host=settings.CHROMA_HOST, port=settings.CHROMA_PORT)
    return Chroma(
        client=client,
        collection_name=settings.CHROMA_COLLECTION_MEMORY,
        embedding_function=get_embeddings(),
    )


class MemoryService:
    """
    Сервис долгосрочной памяти агента.

    Сохраняет записи в таблицу agent_memory (SQL — источник правды) и,
    если MOCK_LLM выключен, индексирует их в отдельной Chroma-коллекции
    для семантического поиска похожих ситуаций (retrieve_relevant).
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = AgentMemoryRepository(db)

    async def save_memory(
        self,
        memory_type: str,
        content: str,
        summary: str | None = None,
        phase: str | None = None,
        company_id: int | None = None,
        outcome: str | None = None,
        outcome_score: float | None = None,
    ) -> AgentMemory:
        """Сохраняет новую запись памяти. memory_type: interaction|strategy|outcome|feedback."""
        memory = await self.repo.create(
            memory_type=memory_type,
            content=content,
            summary=summary,
            phase=phase,
            company_id=company_id,
            outcome=outcome,
            outcome_score=outcome_score,
        )

        if not settings.MOCK_LLM:
            try:
                from langchain_core.documents import Document

                store = _get_memory_vector_store()
                chroma_id = f"memory-{memory.id}"
                await asyncio.to_thread(
                    store.add_documents,
                    [
                        Document(
                            page_content=summary or content,
                            metadata={
                                "memory_id": memory.id,
                                "memory_type": memory_type,
                                "company_id": company_id or 0,
                            },
                        )
                    ],
                    ids=[chroma_id],
                )
                await self.repo.set_chroma_id(memory.id, chroma_id)
            except Exception:
                logger.exception(
                    "MemoryService: не удалось индексировать память %s в Chroma", memory.id
                )

        return memory

    async def record_outcome(
        self, memory_id: int, outcome: str, outcome_score: float | None = None
    ) -> AgentMemory | None:
        """Обновляет исход записи памяти (FR-6.2): success|failure|neutral + опционально оценка."""
        return await self.repo.record_outcome(memory_id, outcome, outcome_score)

    async def retrieve_relevant(
        self,
        query: str,
        company_id: int | None = None,
        top_k: int = 3,
    ) -> list[AgentMemory]:
        """
        Возвращает наиболее релевантные записи памяти.

        При MOCK_LLM=true — простая выборка из БД (по company_id, либо последние записи),
        без эмбеддингов. В обычном режиме — семантический поиск через Chroma.
        """
        if settings.MOCK_LLM:
            if company_id is not None:
                return await self.repo.list_by_company(company_id, limit=top_k)
            return await self.repo.list(limit=top_k)

        try:
            store = _get_memory_vector_store()
            filter_ = {"company_id": company_id} if company_id is not None else None
            docs = await asyncio.to_thread(
                store.similarity_search, query, k=top_k, filter=filter_
            )
            ids = [
                int(d.metadata["memory_id"])
                for d in docs
                if d.metadata.get("memory_id") is not None
            ]
            memories = await self.repo.get_by_ids(ids)
            for m in memories:
                await self.repo.increment_usage(m.id)
            return memories
        except Exception:
            logger.exception(
                "MemoryService: семантический поиск памяти не удался, fallback на SQL"
            )
            if company_id is not None:
                return await self.repo.list_by_company(company_id, limit=top_k)
            return await self.repo.list(limit=top_k)


def format_memories(memories: list[AgentMemory]) -> str:
    """Текстовое представление списка записей памяти для подстановки в промпт LLM."""
    if not memories:
        return ""
    lines = []
    for m in memories:
        outcome = f" (исход: {m.outcome}, score={m.outcome_score})" if m.outcome else ""
        text = m.summary or m.content
        lines.append(f"- [{m.memory_type}/{m.phase or '-'}]{outcome}: {text}")
    return "\n".join(lines)
