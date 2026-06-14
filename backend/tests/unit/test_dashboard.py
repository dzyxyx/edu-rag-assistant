"""
Тесты Спринта 9: Дашборд / Human-in-the-loop.

Покрывает:
- NotificationRepository (CRUD)
- API /dashboard/stats, /dashboard/pending-review (реальные данные вместо stub)
- API /notifications (list, mark read)
- Автосоздание уведомлений при эскалации outreach-письма (FR-4.6)
  и при появлении новой приоритетной области (FR-1.5)

Все тесты выполняются с MOCK_LLM=true.
"""
import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")

from app.core.config import settings
from app.db.models.notification import NotificationType
from app.db.models.outreach import OutreachStatus
from app.db.models.priority_area import PriorityAreaStatus
from app.db.repositories.notification import NotificationRepository
from app.db.repositories.priority_area import PriorityAreaRepository


@pytest.fixture(autouse=True)
def mock_llm(monkeypatch):
    monkeypatch.setattr(settings, "MOCK_LLM", True)


COMPANY_DATA = {
    "name": "DashTest Компания",
    "website": "https://dashtest.ru",
    "description": "python devops стажировка практика студент",
    "industry": "Разработка ПО",
    "region": "Екатеринбург",
    "employee_count": 80,
    "email": "hr@dashtest.ru",
    "source": "manual",
    "status": "raw",
}


async def _create_company(db_session):
    from app.db.repositories.company import CompanyRepository

    repo = CompanyRepository(db_session)
    company, _ = await repo.upsert_by_name(**COMPANY_DATA)
    await db_session.commit()
    return company


# ── NotificationRepository ───────────────────────────────────────────────────

async def test_notification_repository_crud(db_session):
    repo = NotificationRepository(db_session)

    n = await repo.create(
        type=NotificationType.GENERAL,
        title="Тестовое уведомление",
        message="Текст",
        recipient_role="методист",
    )
    await db_session.commit()

    assert n.id is not None
    assert n.is_read is False

    items = await repo.list()
    assert any(i.id == n.id for i in items)

    assert await repo.count() >= 1
    unread_before = await repo.count(unread_only=True)
    assert unread_before >= 1

    updated = await repo.mark_read(n.id)
    await db_session.commit()
    assert updated.is_read is True


# ── /dashboard/stats ──────────────────────────────────────────────────────────

async def test_dashboard_stats_endpoint(auth_client, db_session):
    await _create_company(db_session)

    resp = await auth_client.get("/api/v1/dashboard/stats")
    assert resp.status_code == 200
    data = resp.json()

    for field in (
        "companies_total",
        "companies_shortlisted",
        "companies_partners",
        "priority_areas_proposed",
        "priority_areas_approved",
        "outreach_sent",
        "outreach_replied",
        "outreach_escalated",
        "pending_review_total",
    ):
        assert field in data

    assert data["companies_total"] >= 1


# ── /dashboard/pending-review ─────────────────────────────────────────────────

async def test_pending_review_includes_proposed_priority_area(auth_client, db_session):
    priority_repo = PriorityAreaRepository(db_session)
    area, _ = await priority_repo.upsert_proposal(
        name="Тестовая приоритетная область",
        industry="Разработка ПО",
        score=42.0,
        competency_ids=[1, 2],
        description="Описание тестовой области",
    )
    await db_session.commit()
    assert area.status == PriorityAreaStatus.PROPOSED

    resp = await auth_client.get("/api/v1/dashboard/pending-review")
    assert resp.status_code == 200
    data = resp.json()

    matches = [
        i for i in data["items"]
        if i["type"] == "priority_area" and i["id"] == area.id
    ]
    assert len(matches) == 1
    assert matches[0]["status"] == PriorityAreaStatus.PROPOSED


async def test_generate_drafts_escalation_creates_notification(auth_client, db_session, monkeypatch):
    """Письмо с низкой уверенностью -> ESCALATED -> уведомление + pending-review."""
    monkeypatch.setattr(settings, "OUTREACH_CONFIDENCE_THRESHOLD", 0.9)

    company = await _create_company(db_session)

    campaign_resp = await auth_client.post(
        "/api/v1/outreach/campaigns", json={"name": "Тестовая кампания S9"}
    )
    assert campaign_resp.status_code == 200
    campaign_id = campaign_resp.json()["id"]

    gen_resp = await auth_client.post(
        f"/api/v1/outreach/campaigns/{campaign_id}/generate",
        json={"company_ids": [company.id], "tone": "formal"},
    )
    assert gen_resp.status_code == 200

    events_resp = await auth_client.get(
        "/api/v1/outreach/events", params={"campaign_id": campaign_id}
    )
    events = events_resp.json()["items"]
    escalated = [e for e in events if e["status"] == OutreachStatus.ESCALATED]
    assert escalated, "ожидалось эскалированное письмо при OUTREACH_CONFIDENCE_THRESHOLD=0.9"
    event_id = escalated[0]["id"]

    # Уведомление создано автоматически
    notif_repo = NotificationRepository(db_session)
    notifications = await notif_repo.list()
    assert any(
        n.type == NotificationType.OUTREACH_ESCALATED and n.entity_id == event_id
        for n in notifications
    )

    # И попадает в очередь human-in-the-loop
    pending_resp = await auth_client.get("/api/v1/dashboard/pending-review")
    pending = pending_resp.json()["items"]
    assert any(
        i["type"] == "outreach_event" and i["id"] == event_id and i["status"] == OutreachStatus.ESCALATED
        for i in pending
    )


# ── /notifications ─────────────────────────────────────────────────────────────

async def test_notifications_list_and_mark_read(auth_client, db_session):
    notif_repo = NotificationRepository(db_session)
    n = await notif_repo.create(
        type=NotificationType.GENERAL,
        title="Проверка API уведомлений",
        recipient_role=None,  # общее уведомление — видно всем ролям (S9-7)
    )
    await db_session.commit()

    resp = await auth_client.get("/api/v1/notifications")
    assert resp.status_code == 200
    data = resp.json()
    assert any(item["id"] == n.id for item in data["items"])
    assert data["unread"] >= 1

    read_resp = await auth_client.post(f"/api/v1/notifications/{n.id}/read")
    assert read_resp.status_code == 200
    assert read_resp.json()["notification"]["is_read"] is True


async def test_notification_mark_read_not_found(auth_client):
    resp = await auth_client.post("/api/v1/notifications/999999/read")
    assert resp.status_code == 404
