from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.ingest_log import IngestLog, IngestLogStatus


class IngestLogRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def start(self, source: str, trigger: str = "scheduled") -> IngestLog:
        """Создаёт запись о начале запуска сбора данных."""
        log = IngestLog(
            source=source,
            trigger=trigger,
            status=IngestLogStatus.RUNNING,
            started_at=datetime.now(timezone.utc),
        )
        self.session.add(log)
        await self.session.flush()
        await self.session.refresh(log)
        return log

    async def finish(
        self,
        log_id: int,
        status: str = IngestLogStatus.SUCCESS,
        companies_created: int = 0,
        companies_updated: int = 0,
        vacancies_created: int = 0,
        vacancies_updated: int = 0,
        skipped_duplicates: int = 0,
        errors_count: int = 0,
        error_message: str | None = None,
    ) -> IngestLog | None:
        """Обновляет запись по завершении запуска (успех/ошибка + счётчики)."""
        log = await self.get_by_id(log_id)
        if not log:
            return None
        log.status = status
        log.finished_at = datetime.now(timezone.utc)
        log.companies_created = companies_created
        log.companies_updated = companies_updated
        log.vacancies_created = vacancies_created
        log.vacancies_updated = vacancies_updated
        log.skipped_duplicates = skipped_duplicates
        log.errors_count = errors_count
        log.error_message = error_message
        await self.session.flush()
        await self.session.refresh(log)
        return log

    async def get_by_id(self, log_id: int) -> IngestLog | None:
        result = await self.session.execute(select(IngestLog).where(IngestLog.id == log_id))
        return result.scalar_one_or_none()

    async def list(
        self,
        source: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[IngestLog]:
        q = select(IngestLog).order_by(IngestLog.started_at.desc())
        if source:
            q = q.where(IngestLog.source == source)
        q = q.limit(limit).offset(offset)
        result = await self.session.execute(q)
        return list(result.scalars().all())

    async def count(self, source: str | None = None) -> int:
        q = select(IngestLog)
        if source:
            q = q.where(IngestLog.source == source)
        result = await self.session.execute(q)
        return len(result.scalars().all())

    async def get_latest(self, source: str) -> IngestLog | None:
        result = await self.session.execute(
            select(IngestLog)
            .where(IngestLog.source == source)
            .order_by(IngestLog.started_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()
