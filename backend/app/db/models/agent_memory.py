from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AgentMemory(Base):
    """Долгосрочная память агента (Модуль 6, FR-6.1)."""

    __tablename__ = "agent_memory"

    # Тип записи
    memory_type: Mapped[str] = mapped_column(String(100), nullable=False)
    # interaction | strategy | outcome | feedback

    # Контекст
    phase: Mapped[str | None] = mapped_column(String(50), nullable=True)  # phase_1..5
    company_id: Mapped[int | None] = mapped_column(ForeignKey("companies.id"), nullable=True)

    # Содержимое
    content: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Результат / обратная связь (FR-6.2)
    outcome: Mapped[str | None] = mapped_column(String(50), nullable=True)  # success | failure | neutral
    outcome_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Ссылка на вектор в Chroma
    chroma_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Количество использований записи
    usage_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    def __repr__(self) -> str:
        return f"<AgentMemory id={self.id} type={self.memory_type} outcome={self.outcome}>"


class AgentAuditLog(Base):
    """Лог всех действий агента и решений человека (FR-7.4)."""

    __tablename__ = "agent_audit_log"

    actor: Mapped[str] = mapped_column(String(50), nullable=False)  # agent | human
    action: Mapped[str] = mapped_column(String(255), nullable=False)
    phase: Mapped[str | None] = mapped_column(String(50), nullable=True)
    entity_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    entity_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    def __repr__(self) -> str:
        return f"<AuditLog id={self.id} actor={self.actor} action={self.action}>"
