from typing import Sequence

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.company import Company, CompanyStatus
from app.services.ingestion.normalization import normalize_company_name, normalize_region


class CompanyRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, company_id: int) -> Company | None:
        result = await self.session.execute(
            select(Company).where(Company.id == company_id)
        )
        return result.scalar_one_or_none()

    async def get_by_inn(self, inn: str) -> Company | None:
        result = await self.session.execute(
            select(Company).where(Company.inn == inn)
        )
        return result.scalar_one_or_none()

    async def get_by_name(self, name: str) -> Company | None:
        result = await self.session.execute(
            select(Company).where(Company.name == name)
        )
        return result.scalar_one_or_none()

    async def get_by_normalized_name(self, normalized_name: str) -> Company | None:
        """Поиск по нормализованному названию (без ООО/АО/кавычек/пунктуации, lower) — для дедупа (FR-1.4)."""
        if not normalized_name:
            return None
        result = await self.session.execute(
            select(Company).where(Company.normalized_name == normalized_name)
        )
        return result.scalars().first()

    async def list(
            self,
            status: str | None = None,
            limit: int = 50,
            offset: int = 0,
    ) -> list[Company]:
        q = select(Company).order_by(Company.score.desc().nulls_last())
        if status:
            q = q.where(Company.status == status)
        q = q.limit(limit).offset(offset)
        result = await self.session.execute(q)
        return list(result.scalars().all())

    async def list_by_statuses(self, statuses: Sequence[str], limit: int = 500) -> Sequence[Company]:
        """Используется периодическим пересчётом скоринга (FR-2.4)."""
        q = (
            select(Company)
            .where(Company.status.in_(statuses))
            .order_by(Company.id)
            .limit(limit)
        )
        result = await self.session.execute(q)
        return list(result.scalars().all())

    async def count(self, status: str | None = None) -> int:
        q = select(func.count()).select_from(Company)
        if status:
            q = q.where(Company.status == status)
        result = await self.session.execute(q)
        return result.scalar_one()

    async def create(self, **kwargs) -> Company:
        company = Company(**kwargs)
        self.session.add(company)
        await self.session.flush()
        await self.session.refresh(company)
        return company

    async def upsert_by_name(self, name: str, **kwargs) -> tuple[Company, bool]:
        """
        Возвращает (company, created). Если уже есть — обновляет поля.

        Дедупликация (Sprint 1, FR-1.4): сначала ищем точное совпадение по
        `name`, затем — по нормализованному названию (`normalized_name`),
        чтобы не создавать дубликаты вида "ООО «Ромашка»" / "Ромашка".
        Регион при наличии нормализуется через словарь синонимов
        (normalize_region), чтобы "г. Екатеринбург" и "Екатеринбург"
        считались одним и тем же значением.
        """
        normalized = normalize_company_name(name)
        if kwargs.get("region") is not None:
            kwargs["region"] = normalize_region(kwargs["region"])

        existing = await self.get_by_name(name)
        if not existing and normalized:
            existing = await self.get_by_normalized_name(normalized)

        if existing:
            for k, v in kwargs.items():
                if v is not None:
                    setattr(existing, k, v)
            if normalized:
                existing.normalized_name = normalized
            await self.session.flush()
            return existing, False
        company = await self.create(name=name, normalized_name=normalized or None, **kwargs)
        return company, True

    async def update_status(self, company_id: int, status: CompanyStatus) -> Company | None:
        await self.session.execute(
            update(Company).where(Company.id == company_id).values(status=status)
        )
        await self.session.flush()
        return await self.get_by_id(company_id)

    async def update_scores(
            self,
            company_id: int,
            score: float,
            score_tech_stack: float | None = None,
            score_scale: float | None = None,
            score_reputation: float | None = None,
            score_edu_experience: float | None = None,
            score_vacancy_activity: float | None = None,
            new_status: str | None = None,
    ) -> Company | None:
        values = dict(
            score=score,
            score_tech_stack=score_tech_stack,
            score_scale=score_scale,
            score_reputation=score_reputation,
            score_edu_experience=score_edu_experience,
            score_vacancy_activity=score_vacancy_activity,
        )
        if new_status is not None:
            values["status"] = new_status
        await self.session.execute(
            update(Company).where(Company.id == company_id).values(**values)
        )
        await self.session.flush()
        return await self.get_by_id(company_id)
