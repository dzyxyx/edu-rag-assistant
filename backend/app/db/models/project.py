from enum import StrEnum

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ProjectStatus(StrEnum):
    DRAFT = "draft"
    # S7-3: проект предложен компании-партнёру и ожидает согласования ТЗ.
    PROPOSED = "proposed"
    PUBLISHED = "published"
    # S7-3: ТЗ и роли утверждены — идёт набор студенческой команды (role slots).
    RECRUITING = "recruiting"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class ProjectRole(StrEnum):
    DEVELOPER = "developer"
    ANALYST = "analyst"
    DESIGNER = "designer"
    MANAGER = "manager"
    TESTER = "tester"
    DEVOPS = "devops"


class Project(Base):
    """Проект для студентов, сформированный агентом (Фаза 5)."""

    __tablename__ = "projects"

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    technical_spec: Mapped[str | None] = mapped_column(Text, nullable=True)  # ТЗ (FR-5.1)

    partner_company_id: Mapped[int | None] = mapped_column(ForeignKey("companies.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default=ProjectStatus.DRAFT, nullable=False)

    # Оценка трудоёмкости
    duration_weeks: Mapped[int | None] = mapped_column(Integer, nullable=True)
    team_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    difficulty: Mapped[str | None] = mapped_column(String(50), nullable=True)  # easy, medium, hard

    # Интеграция с ПроКомпетенции (FR-5.4)
    procompetency_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # S7-3: основная компетенция, на развитие которой направлен проект —
    # ссылка на словарь компетенций (app.db.models.competency.Competency),
    # используется для подбора студентов и аналитики покрытия компетенций.
    project_competency_id: Mapped[int | None] = mapped_column(
        ForeignKey("competencies.id"), nullable=True
    )

    def __repr__(self) -> str:
        return f"<Project id={self.id} title={self.title} status={self.status}>"


class ProjectRoleSlot(Base):
    """Роль в проекте с требованиями к навыкам (FR-5.3)."""

    __tablename__ = "project_role_slots"

    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    slots_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    skills_required: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON-список навыков
    assigned_student_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
