from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class CompanyScoreHistory(Base):
    """
    История скоринга компании (Sprint 4 — FR-2.4).

    Каждый пересчёт скоринга (вручную через /companies/{id}/score
    или периодической Celery-задачей) добавляет новую запись —
    это позволяет строить динамику оценки компании во времени.
    """

    __tablename__ = "company_score_history"

    company_id: Mapped[int] = mapped_column(
        ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True
    )

    score: Mapped[float] = mapped_column(Float, nullable=False)
    score_tech_stack: Mapped[float | None] = mapped_column(Float, nullable=True)
    score_scale: Mapped[float | None] = mapped_column(Float, nullable=True)
    score_reputation: Mapped[float | None] = mapped_column(Float, nullable=True)
    score_edu_experience: Mapped[float | None] = mapped_column(Float, nullable=True)
    score_vacancy_activity: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Бонус за совпадение industry компании с утверждённой приоритетной
    # областью (PriorityArea, FR-1.5 <-> FR-2.4)
    priority_bonus: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    # Источник пересчёта: "manual" (через API) или "scheduled" (Celery)
    trigger: Mapped[str] = mapped_column(String(20), nullable=False, default="manual")

    def __repr__(self) -> str:
        return f"<CompanyScoreHistory id={self.id} company_id={self.company_id} score={self.score}>"
