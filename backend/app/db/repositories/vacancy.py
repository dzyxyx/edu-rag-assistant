from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.vacancy import Vacancy


class VacancyRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, vacancy_id: int) -> Vacancy | None:
        result = await self.session.execute(
            select(Vacancy).where(Vacancy.id == vacancy_id)
        )
        return result.scalar_one_or_none()

    async def get_by_external_id(self, external_id: str, source: str) -> Vacancy | None:
        result = await self.session.execute(
            select(Vacancy).where(
                Vacancy.external_id == external_id,
                Vacancy.source == source,
            )
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        company_id: int | None = None,
        source: str | None = None,
        is_processed: bool | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Vacancy]:
        q = select(Vacancy).order_by(Vacancy.created_at.desc())
        if company_id is not None:
            q = q.where(Vacancy.company_id == company_id)
        if source is not None:
            q = q.where(Vacancy.source == source)
        if is_processed is not None:
            q = q.where(Vacancy.is_processed == is_processed)
        q = q.limit(limit).offset(offset)
        result = await self.session.execute(q)
        return list(result.scalars().all())

    async def create(self, **kwargs) -> Vacancy:
        vacancy = Vacancy(**kwargs)
        self.session.add(vacancy)
        await self.session.flush()
        await self.session.refresh(vacancy)
        return vacancy

    async def upsert_by_external_id(
        self, external_id: str, source: str, **kwargs
    ) -> tuple[Vacancy, bool]:
        """Возвращает (vacancy, created). Если уже есть — обновляет поля."""
        existing = await self.get_by_external_id(external_id, source)
        if existing:
            for k, v in kwargs.items():
                if v is not None:
                    setattr(existing, k, v)
            await self.session.flush()
            return existing, False
        vacancy = await self.create(external_id=external_id, source=source, **kwargs)
        return vacancy, True

    async def mark_processed(self, vacancy_id: int) -> None:
        await self.session.execute(
            update(Vacancy)
            .where(Vacancy.id == vacancy_id)
            .values(is_processed=True)
        )
        await self.session.flush()

    async def count_by_company(self, company_id: int) -> int:
        result = await self.session.execute(
            select(Vacancy).where(Vacancy.company_id == company_id)
        )
        return len(result.scalars().all())
