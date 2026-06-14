from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.priority_area import PriorityArea, PriorityAreaStatus


class PriorityAreaRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, area_id: int) -> PriorityArea | None:
        result = await self.session.execute(
            select(PriorityArea).where(PriorityArea.id == area_id)
        )
        return result.scalar_one_or_none()

    async def list(self, status: str | None = None, limit: int = 100) -> list[PriorityArea]:
        q = select(PriorityArea).order_by(PriorityArea.score.desc().nullslast())
        if status is not None:
            q = q.where(PriorityArea.status == status)
        q = q.limit(limit)
        result = await self.session.execute(q)
        return list(result.scalars().all())

    async def count(self, status: str | None = None) -> int:
        q = select(func.count()).select_from(PriorityArea)
        if status is not None:
            q = q.where(PriorityArea.status == status)
        result = await self.session.execute(q)
        return result.scalar_one()

    async def get_by_name(self, name: str, industry: str | None) -> PriorityArea | None:
        result = await self.session.execute(
            select(PriorityArea).where(
                PriorityArea.name == name,
                PriorityArea.industry == industry,
            )
        )
        return result.scalar_one_or_none()

    async def upsert_proposal(
        self,
        name: str,
        industry: str | None,
        score: float | None,
        competency_ids: list[int],
        description: str | None = None,
    ) -> tuple[PriorityArea, bool]:
        """
        Создаёт предложение приоритетной области или обновляет существующее
        (если оно ещё не утверждено/отклонено человеком).
        """
        existing = await self.get_by_name(name, industry)
        if existing:
            if existing.status == PriorityAreaStatus.PROPOSED:
                existing.score = score
                existing.competency_ids = competency_ids
                existing.description = description
                await self.session.flush()
            return existing, False

        area = PriorityArea(
            name=name,
            industry=industry,
            score=score,
            competency_ids=competency_ids,
            description=description,
            status=PriorityAreaStatus.PROPOSED,
        )
        self.session.add(area)
        await self.session.flush()
        await self.session.refresh(area)
        return area, True

    async def review(
        self, area_id: int, status: str, reviewed_by: str, comment: str | None = None
    ) -> PriorityArea | None:
        area = await self.get_by_id(area_id)
        if not area:
            return None
        area.status = status
        area.reviewed_by = reviewed_by
        area.review_comment = comment
        await self.session.flush()
        return area
