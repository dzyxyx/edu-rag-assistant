from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.competency import Competency, VacancyCompetency
from app.db.models.vacancy import Vacancy


class CompetencyRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_name(self, name: str, source: str) -> Competency | None:
        result = await self.session.execute(
            select(Competency).where(
                func.lower(Competency.name) == name.lower(),
                Competency.source == source,
            )
        )
        return result.scalar_one_or_none()

    async def upsert(
        self,
        name: str,
        category: str | None,
        source: str = "industry",
        description: str | None = None,
        frequency_increment: int = 1,
    ) -> tuple[Competency, bool]:
        """Создаёт компетенцию или увеличивает её частоту встречаемости."""
        existing = await self.get_by_name(name, source)
        if existing:
            existing.frequency += frequency_increment
            if category and not existing.category:
                existing.category = category
            if description and not existing.description:
                existing.description = description
            await self.session.flush()
            return existing, False

        competency = Competency(
            name=name.lower(),
            category=category,
            source=source,
            description=description,
            frequency=frequency_increment,
        )
        self.session.add(competency)
        await self.session.flush()
        await self.session.refresh(competency)
        return competency, True

    async def link_vacancy(
        self, vacancy_id: int, competency_id: int, confidence: float | None = None
    ) -> VacancyCompetency:
        """Связывает вакансию с компетенцией (если связи ещё нет)."""
        existing = await self.session.execute(
            select(VacancyCompetency).where(
                VacancyCompetency.vacancy_id == vacancy_id,
                VacancyCompetency.competency_id == competency_id,
            )
        )
        link = existing.scalar_one_or_none()
        if link:
            if confidence is not None:
                link.confidence = confidence
            await self.session.flush()
            return link

        link = VacancyCompetency(
            vacancy_id=vacancy_id,
            competency_id=competency_id,
            confidence=confidence,
        )
        self.session.add(link)
        await self.session.flush()
        return link

    async def list(
        self,
        source: str | None = None,
        category: str | None = None,
        order_by_demand: bool = True,
        limit: int = 100,
    ) -> list[Competency]:
        q = select(Competency)
        if source is not None:
            q = q.where(Competency.source == source)
        if category is not None:
            q = q.where(Competency.category == category)
        if order_by_demand:
            q = q.order_by(Competency.frequency.desc())
        q = q.limit(limit)
        result = await self.session.execute(q)
        return list(result.scalars().all())

    async def recompute_demand_scores(self) -> int:
        """
        Пересчитывает demand_score (0-100) для всех компетенций как долю
        вакансий, в которых компетенция встречается, от общего числа
        обработанных вакансий.
        """
        total_processed = await self.session.scalar(
            select(func.count()).select_from(Vacancy).where(Vacancy.is_processed.is_(True))
        )
        total_processed = total_processed or 0
        if total_processed == 0:
            return 0

        competencies = await self.list(order_by_demand=False, limit=10_000)
        for comp in competencies:
            vacancy_count = await self.session.scalar(
                select(func.count(func.distinct(VacancyCompetency.vacancy_id))).where(
                    VacancyCompetency.competency_id == comp.id
                )
            )
            comp.demand_score = round((vacancy_count or 0) / total_processed * 100, 2)

        await self.session.flush()
        return len(competencies)

    async def matrix_by_industry(self) -> list[dict]:
        """
        Матрица компетенция -> отрасль (FR-1.3).

        Возвращает список {competency, category, industry, mentions} —
        сколько раз компетенция встретилась в вакансиях компаний
        с данной отраслью (Company.industry).
        """
        from app.db.models.company import Company

        q = (
            select(
                Competency.name,
                Competency.category,
                Company.industry,
                func.count(VacancyCompetency.id).label("mentions"),
            )
            .join(VacancyCompetency, VacancyCompetency.competency_id == Competency.id)
            .join(Vacancy, Vacancy.id == VacancyCompetency.vacancy_id)
            .join(Company, Company.id == Vacancy.company_id)
            .where(Company.industry.is_not(None))
            .group_by(Competency.name, Competency.category, Company.industry)
            .order_by(func.count(VacancyCompetency.id).desc())
        )
        result = await self.session.execute(q)
        return [
            {
                "competency": row.name,
                "category": row.category,
                "industry": row.industry,
                "mentions": row.mentions,
            }
            for row in result.all()
        ]
