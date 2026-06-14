from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.company_score_history import CompanyScoreHistory


class CompanyScoreHistoryRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def add(
        self,
        company_id: int,
        score: float,
        score_tech_stack: float | None = None,
        score_scale: float | None = None,
        score_reputation: float | None = None,
        score_edu_experience: float | None = None,
        score_vacancy_activity: float | None = None,
        priority_bonus: float = 0.0,
        trigger: str = "manual",
    ) -> CompanyScoreHistory:
        entry = CompanyScoreHistory(
            company_id=company_id,
            score=score,
            score_tech_stack=score_tech_stack,
            score_scale=score_scale,
            score_reputation=score_reputation,
            score_edu_experience=score_edu_experience,
            score_vacancy_activity=score_vacancy_activity,
            priority_bonus=priority_bonus,
            trigger=trigger,
        )
        self.session.add(entry)
        await self.session.flush()
        await self.session.refresh(entry)
        return entry

    async def list_by_company(
        self, company_id: int, limit: int = 50, offset: int = 0
    ) -> list[CompanyScoreHistory]:
        q = (
            select(CompanyScoreHistory)
            .where(CompanyScoreHistory.company_id == company_id)
            .order_by(CompanyScoreHistory.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.session.execute(q)
        return list(result.scalars().all())

    async def count_by_company(self, company_id: int) -> int:
        result = await self.session.execute(
            select(CompanyScoreHistory).where(CompanyScoreHistory.company_id == company_id)
        )
        return len(result.scalars().all())
