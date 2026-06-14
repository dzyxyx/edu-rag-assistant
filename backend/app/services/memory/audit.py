import json
import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.agent_memory import AgentAuditLog
from app.db.repositories.agent_memory import AuditLogRepository

logger = logging.getLogger(__name__)


async def log_action(
    db: AsyncSession,
    actor: str,
    action: str,
    phase: str | None = None,
    entity_type: str | None = None,
    entity_id: int | None = None,
    details: dict[str, Any] | None = None,
    user_id: int | None = None,
) -> AgentAuditLog:
    """
    Записывает действие агента или решение человека в журнал аудита (FR-7.4).

    actor: "agent" | "human"
    action: краткое машинно-читаемое имя действия, например
            "memory.save", "outreach.draft_generated", "outreach.approved"
    details: произвольный словарь — сериализуется в JSON и кладётся в details.
    Ошибки логирования не должны прерывать основной поток — при сбое
    пишем в логгер и возвращаем None-подобный объект не требуется,
    т.к. это вспомогательная операция.
    """
    serialized_details: str | None = None
    if details is not None:
        try:
            serialized_details = json.dumps(details, ensure_ascii=False, default=str)
        except (TypeError, ValueError):
            logger.exception("audit.log_action: не удалось сериализовать details")
            serialized_details = json.dumps({"_error": "serialization_failed"})

    repo = AuditLogRepository(db)
    return await repo.create(
        actor=actor,
        action=action,
        phase=phase,
        entity_type=entity_type,
        entity_id=entity_id,
        details=serialized_details,
        user_id=user_id,
    )
