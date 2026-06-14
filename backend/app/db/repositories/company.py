from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.company import Company, CompanyStatus


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
        """Возвращает (company, created). Если уже есть — обновляет поля."""
        existing = await self.get_by_name(name)
        if existing:
            for k, v in kwargs.items():
                if v is not None:
                    setattr(existing, k, v)
            await self.session.flush()
            return existing, False
        company = await self.create(name=name, **kwargs)
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
    ) -> None:
        await self.session.execute(
            update(Company)
            .where(Company.id == company_id)
            .values(
                score=score,
                score_tech_stack=score_tech_stack,
                score_scale=score_scale,
                score_reputation=score_reputation,
                score_edu_experience=score_edu_experience,
                status=CompanyStatus.SCORED,
            )
        )
        await self.session.flush()
