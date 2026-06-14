from enum import StrEnum

from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class NotificationType(StrEnum):
    """Тип внутреннего уведомления (Sprint 9, human-in-the-loop)."""

    PRIORITY_AREA_PROPOSED = "priority_area_proposed"   # новая приоритетная область требует review (FR-1.5)
    OUTREACH_ESCALATED = "outreach_escalated"           # письмо эскалировано из-за низкой уверенности (FR-4.6)
    OUTREACH_DRAFT_REVIEW = "outreach_draft_review"     # обычный черновик, ожидающий утверждения (FR-3.5)
    GENERAL = "general"                                  # произвольное уведомление (см. communications.notification)


class Notification(Base):
    """
    Внутреннее уведомление сотруднику УрФУ о событии, требующем внимания
    (human-in-the-loop, Sprint 9). Создаётся агентом автоматически при
    эскалациях/новых предложениях и отображается в /notifications и на
    дашборде (/dashboard/pending-review).
    """

    __tablename__ = "notifications"

    type: Mapped[str] = mapped_column(String(50), default=NotificationType.GENERAL, nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Связь с сущностью, по которой возникло уведомление (priority_area / outreach_event / ...)
    entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    entity_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Кому адресовано (роль сотрудника); None — общее уведомление
    recipient_role: Mapped[str | None] = mapped_column(String(100), nullable=True)

    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    def __repr__(self) -> str:
        return f"<Notification id={self.id} type={self.type} is_read={self.is_read}>"
