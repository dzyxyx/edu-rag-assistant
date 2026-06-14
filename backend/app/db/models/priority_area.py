from enum import StrEnum

from sqlalchemy import Float, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PriorityAreaStatus(StrEnum):
    PROPOSED = "proposed"   # сформировано автоматически по аналитике
    APPROVED = "approved"   # утверждено человеком (FR-1.5, точка эскалации №1)
    REJECTED = "rejected"


class PriorityArea(Base):
    """
    Приоритетная область (направление) подготовки/развития (FR-1.5).

    Формируется автоматически на основе аналитики спроса на компетенции
    (см. CompetencyRepository.matrix_by_industry / recompute_demand_scores)
    и требует утверждения человеком — первая точка эскалации в проекте.
    """

    __tablename__ = "priority_areas"

    # Текстовый тип, т.к. название может включать длинный перечень
    # компетенций и наименование отрасли по классификатору HH (>255 симв.)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Отрасль/направление, к которому относится приоритетная область.
    # Text, т.к. наименования отраслей в классификаторе HH могут быть
    # длиннее 255 символов (составные перечисления).
    industry: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Агрегированная оценка спроса (0-100), на основе demand_score компетенций
    score: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Список id компетенций (Competency.id), формирующих эту область
    competency_ids: Mapped[list[int] | None] = mapped_column(JSONB, nullable=True)

    status: Mapped[str] = mapped_column(String(50), default=PriorityAreaStatus.PROPOSED, nullable=False)

    # Кто утвердил/отклонил (email пользователя)
    reviewed_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    review_comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    def __repr__(self) -> str:
        return f"<PriorityArea id={self.id} name={self.name} status={self.status}>"
