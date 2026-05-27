from sqlalchemy import Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Competency(Base):
    """Компетенция, извлечённая из вакансии или учебной программы (FR-1.2)."""

    __tablename__ = "competencies"

    name: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    category: Mapped[str | None] = mapped_column(String(255), nullable=True)  # hard_skill, soft_skill, tool
    source: Mapped[str] = mapped_column(String(50), nullable=False)  # industry | program
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Вес/частота встречаемости в вакансиях
    frequency: Mapped[int] = mapped_column(default=1, nullable=False)
    demand_score: Mapped[float | None] = mapped_column(Float, nullable=True)  # 0-100

    def __repr__(self) -> str:
        return f"<Competency id={self.id} name={self.name} source={self.source}>"


class VacancyCompetency(Base):
    """Связь вакансия ↔ компетенция."""

    __tablename__ = "vacancy_competencies"

    vacancy_id: Mapped[int] = mapped_column(ForeignKey("vacancies.id"), nullable=False)
    competency_id: Mapped[int] = mapped_column(ForeignKey("competencies.id"), nullable=False)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)  # уверенность NLP-извлечения
