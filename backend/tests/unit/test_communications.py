"""
Тесты Спринта 5: общий сервис генерации текста коммуникаций
(services/communications/generator.py) и API /communications/*.

Выполняются с MOCK_LLM=true.
"""
import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")

from app.core.config import settings
from app.services.communications.generator import (
    CommunicationType,
    generate_communication,
)


@pytest.fixture(autouse=True)
def mock_llm(monkeypatch):
    monkeypatch.setattr(settings, "MOCK_LLM", True)


COMPANY_DATA = {
    "name": "CommTest Компания",
    "website": "https://commtest.ru",
    "description": "python devops стажировка практика студент",
    "industry": "Разработка ПО",
    "region": "Екатеринбург",
    "employee_count": 150,
    "email": "hr@commtest.ru",
    "source": "manual",
    "status": "raw",
}


async def _create_company(db_session):
    from app.db.repositories.company import CompanyRepository

    repo = CompanyRepository(db_session)
    company, _ = await repo.upsert_by_name(**COMPANY_DATA)
    await db_session.commit()
    return company


# ── generate_communication (сервис) ──────────────────────────────────────────

async def test_generate_outreach_delegates_to_outreach_generator(db_session):
    company = await _create_company(db_session)
    subject, body = await generate_communication(CommunicationType.OUTREACH, company=company, tone="formal")
    assert subject
    assert body
    assert company.name in body


async def test_generate_follow_up(db_session):
    company = await _create_company(db_session)
    subject, body = await generate_communication(
        CommunicationType.FOLLOW_UP,
        company=company,
        tone="formal",
        previous_subject="Предложение о сотрудничестве",
        follow_up_number=2,
    )
    assert subject
    assert "2" in body or "follow-up" in body.lower()


async def test_generate_rejection(db_session):
    company = await _create_company(db_session)
    subject, body = await generate_communication(
        CommunicationType.REJECTION,
        company=company,
        tone="formal",
        reason="не подходит по профилю стажировок",
    )
    assert subject
    assert "не подходит по профилю стажировок" in body


async def test_generate_project_invitation(db_session):
    company = await _create_company(db_session)
    subject, body = await generate_communication(
        CommunicationType.PROJECT_INVITATION,
        company=company,
        tone="informal",
        project_name="Платформа для аналитики вакансий",
        project_description="Веб-сервис на FastAPI + React",
    )
    assert "Платформа для аналитики вакансий" in subject or "Платформа для аналитики вакансий" in body


async def test_generate_notification_without_company():
    subject, body = await generate_communication(
        CommunicationType.NOTIFICATION,
        recipient_role="менеджер по партнёрствам",
        message="Компания CommTest ответила на письмо, требуется проверка тональности",
    )
    assert subject
    assert "требуется проверка тональности" in body


async def test_generate_outreach_without_company_raises():
    with pytest.raises(ValueError):
        await generate_communication(CommunicationType.OUTREACH, company=None)


async def test_generate_follow_up_without_company_raises():
    with pytest.raises(ValueError):
        await generate_communication(CommunicationType.FOLLOW_UP, company=None)


# ── API /communications ───────────────────────────────────────────────────────

async def test_communication_types_endpoint(auth_client):
    resp = await auth_client.get("/api/v1/communications/types")
    assert resp.status_code == 200
    data = resp.json()
    types = {item["type"] for item in data["items"]}
    assert {"outreach", "follow_up", "rejection", "project_invitation", "notification"} <= types

    notification = next(item for item in data["items"] if item["type"] == "notification")
    assert notification["requires_company"] is False


async def test_communication_generate_outreach(auth_client, db_session):
    company = await _create_company(db_session)

    resp = await auth_client.post(
        "/api/v1/communications/generate",
        json={"type": "outreach", "company_id": company.id, "tone": "formal"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["type"] == "outreach"
    assert data["company_id"] == company.id
    assert data["subject"]
    assert data["body"]


async def test_communication_generate_notification(auth_client):
    resp = await auth_client.post(
        "/api/v1/communications/generate",
        json={
            "type": "notification",
            "recipient_role": "менеджер по партнёрствам",
            "message": "Новая компания требует ручного approve",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["company_id"] is None
    assert "approve" in data["body"]


async def test_communication_generate_missing_company_id(auth_client):
    resp = await auth_client.post(
        "/api/v1/communications/generate",
        json={"type": "follow_up"},
    )
    assert resp.status_code == 422


async def test_communication_generate_company_not_found(auth_client):
    resp = await auth_client.post(
        "/api/v1/communications/generate",
        json={"type": "rejection", "company_id": 999999, "reason": "тест"},
    )
    assert resp.status_code == 404
