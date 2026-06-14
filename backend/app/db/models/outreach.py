from enum import StrEnum

from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class OutreachStatus(StrEnum):
    DRAFT = "draft"
    APPROVED = "approved"     # Утверждено человеком (FR-3.5)
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    REPLIED = "replied"
    FOLLOW_UP = "follow_up"
    ESCALATED = "escalated"   # Передано человеку (FR-4.6)
    CLOSED = "closed"


class ReplyCategory(StrEnum):
    INTERESTED = "interested"
    REJECTED = "rejected"
    QUESTION = "question"
    NO_REPLY = "no_reply"


class OutreachCampaign(Base):
    """Компания по привлечению партнёров (Фаза 3-4)."""

    __tablename__ = "outreach_campaigns"

    name: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    phase: Mapped[str | None] = mapped_column(String(50), nullable=True)  # phase_1..5
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)


class OutreachEvent(Base):
    """Одно касание с конкретной компанией."""

    __tablename__ = "outreach_events"

    campaign_id: Mapped[int] = mapped_column(ForeignKey("outreach_campaigns.id"), nullable=False)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"), nullable=False)
    channel: Mapped[str] = mapped_column(String(50), nullable=False)  # email, linkedin
    status: Mapped[str] = mapped_column(String(50), default=OutreachStatus.DRAFT, nullable=False)

    # Контент письма
    subject: Mapped[str | None] = mapped_column(String(500), nullable=True)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    tone: Mapped[str | None] = mapped_column(String(50), nullable=True)  # formal, informal

    # Ответ
    reply_body: Mapped[str | None] = mapped_column(Text, nullable=True)
    reply_category: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Follow-up
    follow_up_number: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    next_follow_up_after_days: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Agent memory / LangGraph (Sprint 4): уверенность агента в сгенерированном письме
    # и количество записей памяти, использованных при генерации.
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    memory_used_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    def __repr__(self) -> str:
        return f"<OutreachEvent id={self.id} company_id={self.company_id} status={self.status}>"
