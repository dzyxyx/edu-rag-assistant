"""Тесты S5-6/S7-3: план касаний (FR-3.6), Jinja2-шаблоны коммуникаций,
поле project_competency_id и новые статусы проекта."""
import pytest

from app.core.config import settings
from app.db.models.competency import Competency
from app.db.models.project import ProjectStatus
from app.db.repositories.project import ProjectRepository
from app.services.communications.generator import CommunicationType
from app.services.communications.templates import render_communication_html
from app.services.outreach.touch_plan import (
    is_plan_exhausted,
    max_follow_ups,
    next_touch_after_days,
)

pytestmark = pytest.mark.asyncio(loop_scope="session")


@pytest.fixture(autouse=True)
def mock_llm(monkeypatch):
    monkeypatch.setattr(settings, "MOCK_LLM", True)


# ── touch_plan (FR-3.6) ────────────────────────────────────────────────────────

def test_touch_plan_defaults():
    assert settings.OUTREACH_TOUCH_PLAN_DAYS == [5, 14]
    assert max_follow_ups() == 2

    # после первичного письма (follow_up_number=0) ждём 5 дней
    assert next_touch_after_days(0) == 5
    # после первого follow-up'а (follow_up_number=1) ждём 14 дней
    assert next_touch_after_days(1) == 14
    # после второго follow-up'а план исчерпан
    assert next_touch_after_days(2) is None

    assert not is_plan_exhausted(0)
    assert not is_plan_exhausted(1)
    assert is_plan_exhausted(2)


def test_touch_plan_respects_settings_override(monkeypatch):
    monkeypatch.setattr(settings, "OUTREACH_TOUCH_PLAN_DAYS", [3])
    assert max_follow_ups() == 1
    assert next_touch_after_days(0) == 3
    assert next_touch_after_days(1) is None
    assert is_plan_exhausted(1)


# ── Jinja2-шаблоны коммуникаций ──────────────────────────────────────────────

def test_render_notification_html():
    html = render_communication_html(
        CommunicationType.NOTIFICATION,
        subject="Тест",
        body="Текст уведомления",
        recipient_role="координатор",
    )
    assert "Тест" in html
    assert "Текст уведомления" in html
    assert "координатор" in html


def test_render_follow_up_html_with_company():
    html = render_communication_html(
        CommunicationType.FOLLOW_UP,
        subject="Напоминание",
        body="Текст письма",
        company_name="ООО Ромашка",
        follow_up_number=2,
    )
    assert "ООО Ромашка" in html
    assert "№2" in html
    assert "Текст письма" in html


def test_render_default_template_for_outreach():
    html = render_communication_html(
        CommunicationType.OUTREACH,
        subject="Предложение",
        body="Текст предложения",
        company_name="ООО Ромашка",
    )
    assert "ООО Ромашка" in html
    assert "Текст предложения" in html


# ── Project: project_competency_id + новые статусы ──────────────────────────

async def test_project_competency_id_and_new_statuses(db_session):
    competency = Competency(name="Python", category="hard_skill", source="program")
    db_session.add(competency)
    await db_session.flush()

    repo = ProjectRepository(db_session)
    project = await repo.create(
        title="Проект с компетенцией",
        project_competency_id=competency.id,
    )
    await db_session.commit()

    assert project.project_competency_id == competency.id

    # Новые статусы жизненного цикла (S7-3)
    project = await repo.update_status(project.id, ProjectStatus.PROPOSED)
    assert project.status == ProjectStatus.PROPOSED

    project = await repo.update_status(project.id, ProjectStatus.RECRUITING)
    assert project.status == ProjectStatus.RECRUITING
    await db_session.commit()
