from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.vacancy import Vacancy

class CompanyStatus(StrEnum):
    RAW = "raw"               # Только собрана
    SCORED = "scored"         # Прошла скоринг
    SHORTLISTED = "shortlisted"  # В шорт-листе
    APPROVED = "approved"     # Верифицирована человеком
    CONTACTED = "contacted"   # Отправлено письмо
    INTERESTED = "interested" # Положительный ответ
    PARTNER = "partner"       # Стала партнёром
    REJECTED = "rejected"     # Отказ


class Company(Base):
    __tablename__ = "companies"

    # Базовая информация
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    # Нормализованное название (без ООО/АО/кавычек/пунктуации, lower) —
    # используется для дедупликации между источниками (Sprint 1, FR-1.4).
    normalized_name: Mapped[str | None] = mapped_column(String(500), nullable=True, index=True)
    inn: Mapped[str | None] = mapped_column(String(12), unique=True, nullable=True, index=True)
    website: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    industry: Mapped[str | None] = mapped_column(String(255), nullable=True)
    region: Mapped[str | None] = mapped_column(String(255), nullable=True)
    employee_count: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Контактная информация
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Скоринг (FR-2.3)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    score_tech_stack: Mapped[float | None] = mapped_column(Float, nullable=True)
    score_scale: Mapped[float | None] = mapped_column(Float, nullable=True)
    score_reputation: Mapped[float | None] = mapped_column(Float, nullable=True)
    score_edu_experience: Mapped[float | None] = mapped_column(Float, nullable=True)
    score_vacancy_activity: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Статус пайплайна
    status: Mapped[str] = mapped_column(String(50), default=CompanyStatus.RAW, nullable=False)

    # Источник данных
    source: Mapped[str | None] = mapped_column(String(100), nullable=True)  # hh, spark, manual, etc.
    vacancies: Mapped[list["Vacancy"]] = relationship(
        "Vacancy", back_populates="company", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<Company id={self.id} name={self.name} score={self.score}>"

