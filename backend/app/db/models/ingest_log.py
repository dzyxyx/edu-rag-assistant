from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class IngestLogStatus(StrEnum):
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"


class IngestLog(Base):
    """
    История запусков сбора данных (Sprint 1 — FR-1.1/FR-1.4, периодичность
    и мониторинг сбора).

    Запись создаётся в начале запуска источника (hh, manual_import, ...)
    и обновляется по завершении — это позволяет видеть, когда последний
    раз запускался сбор, сколько компаний/вакансий было создано/обновлено
    и были ли ошибки.
    """

    __tablename__ = "ingest_logs"

    # Источник данных: "hh", "manual_import", "manual" и т.п.
    source: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    # "scheduled" (Celery beat) или "manual" (запущено вручную через API)
    trigger: Mapped[str] = mapped_column(String(20), nullable=False, default="scheduled")

    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=IngestLogStatus.RUNNING, index=True
    )

    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    companies_created: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    companies_updated: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    vacancies_created: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    vacancies_updated: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    skipped_duplicates: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    errors_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<IngestLog id={self.id} source={self.source} status={self.status}>"
