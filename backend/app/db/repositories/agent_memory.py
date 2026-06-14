from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.agent_memory import AgentAuditLog, AgentMemory


class AgentMemoryRepository:
    """Репозиторий для долгосрочной памяти агента (FR-6.1/6.2)."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, **kwargs) -> AgentMemory:
        obj = AgentMemory(**kwargs)
        self.session.add(obj)
        await self.session.flush()
        await self.session.refresh(obj)
        return obj

    async def get_by_id(self, memory_id: int) -> AgentMemory | None:
        return await self.session.get(AgentMemory, memory_id)

    async def list(
        self,
        memory_type: str | None = None,
        phase: str | None = None,
        company_id: int | None = None,
        outcome: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[AgentMemory]:
        q = select(AgentMemory).order_by(AgentMemory.created_at.desc())
        if memory_type:
            q = q.where(AgentMemory.memory_type == memory_type)
        if phase:
            q = q.where(AgentMemory.phase == phase)
        if company_id is not None:
            q = q.where(AgentMemory.company_id == company_id)
        if outcome:
            q = q.where(AgentMemory.outcome == outcome)
        q = q.limit(limit).offset(offset)
        result = await self.session.execute(q)
        return list(result.scalars().all())

    async def count(
        self,
        memory_type: str | None = None,
        phase: str | None = None,
        company_id: int | None = None,
        outcome: str | None = None,
    ) -> int:
        q = select(func.count()).select_from(AgentMemory)
        if memory_type:
            q = q.where(AgentMemory.memory_type == memory_type)
        if phase:
            q = q.where(AgentMemory.phase == phase)
        if company_id is not None:
            q = q.where(AgentMemory.company_id == company_id)
        if outcome:
            q = q.where(AgentMemory.outcome == outcome)
        result = await self.session.execute(q)
        return result.scalar_one()

    async def list_by_company(self, company_id: int, limit: int = 10) -> list[AgentMemory]:
        """Последние записи памяти, связанные с компанией — для retrieval без эмбеддингов (MOCK)."""
        q = (
            select(AgentMemory)
            .where(AgentMemory.company_id == company_id)
            .order_by(AgentMemory.outcome_score.desc().nulls_last(), AgentMemory.created_at.desc())
            .limit(limit)
        )
        result = await self.session.execute(q)
        return list(result.scalars().all())

    async def set_chroma_id(self, memory_id: int, chroma_id: str) -> AgentMemory | None:
        obj = await self.get_by_id(memory_id)
        if obj:
            obj.chroma_id = chroma_id
            await self.session.flush()
        return obj

    async def record_outcome(
        self, memory_id: int, outcome: str, outcome_score: float | None = None
    ) -> AgentMemory | None:
        obj = await self.get_by_id(memory_id)
        if obj:
            obj.outcome = outcome
            if outcome_score is not None:
                obj.outcome_score = outcome_score
            await self.session.flush()
        return obj

    async def increment_usage(self, memory_id: int) -> AgentMemory | None:
        obj = await self.get_by_id(memory_id)
        if obj:
            obj.usage_count += 1
            await self.session.flush()
        return obj

    async def get_by_ids(self, ids: list[int]) -> list[AgentMemory]:
        if not ids:
            return []
        result = await self.session.execute(select(AgentMemory).where(AgentMemory.id.in_(ids)))
        return list(result.scalars().all())


class AuditLogRepository:
    """Репозиторий для лога действий агента/человека (FR-7.4)."""

    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, **kwargs) -> AgentAuditLog:
        obj = AgentAuditLog(**kwargs)
        self.session.add(obj)
        await self.session.flush()
        await self.session.refresh(obj)
        return obj

    async def list(
        self,
        actor: str | None = None,
        entity_type: str | None = None,
        entity_id: int | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[AgentAuditLog]:
        q = select(AgentAuditLog).order_by(AgentAuditLog.created_at.desc())
        if actor:
            q = q.where(AgentAuditLog.actor == actor)
        if entity_type:
            q = q.where(AgentAuditLog.entity_type == entity_type)
        if entity_id is not None:
            q = q.where(AgentAuditLog.entity_id == entity_id)
        q = q.limit(limit).offset(offset)
        result = await self.session.execute(q)
        return list(result.scalars().all())

    async def count(
        self,
        actor: str | None = None,
        entity_type: str | None = None,
        entity_id: int | None = None,
    ) -> int:
        q = select(func.count()).select_from(AgentAuditLog)
        if actor:
            q = q.where(AgentAuditLog.actor == actor)
        if entity_type:
            q = q.where(AgentAuditLog.entity_type == entity_type)
        if entity_id is not None:
            q = q.where(AgentAuditLog.entity_id == entity_id)
        result = await self.session.execute(q)
        return result.scalar_one()
