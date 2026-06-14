"""Тесты доработок Sprint 9 (S4-7/S9-7): recipient_role↔users, Top-20, эскалации."""
import pytest

from app.core.notification_roles import (
    allowed_recipient_roles_filter,
    is_visible_to,
    recipient_roles_for_user_role,
)
from app.db.models.company import CompanyStatus
from app.db.models.notification import NotificationType
from app.db.models.user import UserRole
from app.db.repositories.notification import NotificationRepository
from app.services.scoring.scoring_service import (
    TOP20_SHORTLIST_THRESHOLD,
    check_top20_shortlist_ready,
)
from tests.unit.test_companies import COMPANY_DATA, _create_company

pytestmark = pytest.mark.asyncio(loop_scope="session")


# ── notification_roles ───────────────────────────────────────────────────────

def test_is_visible_to_admin_sees_everything():
    assert is_visible_to("методист", UserRole.ADMIN)
    assert is_visible_to(None, UserRole.ADMIN)
    assert is_visible_to("неизвестная роль", UserRole.ADMIN)


def test_is_visible_to_general_notification_visible_to_all():
    assert is_visible_to(None, UserRole.STUDENT)
    assert is_visible_to(None, UserRole.CURATOR)


def test_is_visible_to_role_specific():
    assert is_visible_to("методист", UserRole.CURATOR)
    assert not is_visible_to("методист", UserRole.STUDENT)


def test_recipient_roles_for_user_role_curator_includes_known_roles():
    roles = recipient_roles_for_user_role(UserRole.CURATOR)
    assert "методист" in roles
    assert "координатор" in roles


def test_allowed_recipient_roles_filter_admin_is_none():
    assert allowed_recipient_roles_filter(UserRole.ADMIN) is None
    assert allowed_recipient_roles_filter(UserRole.CURATOR) is not None


# ── NotificationRepository: фильтрация по роли + exists_recent ──────────────────

async def test_notification_list_filters_by_recipient_role(db_session):
    repo = NotificationRepository(db_session)

    await repo.create(
        type=NotificationType.GENERAL,
        title="Общее уведомление",
        publish=False,
    )
    await repo.create(
        type=NotificationType.PRIORITY_AREA_PROPOSED,
        title="Для методиста",
        recipient_role="методист",
        publish=False,
    )
    await db_session.commit()

    allowed_for_student = allowed_recipient_roles_filter(UserRole.STUDENT)
    items_student = await repo.list(allowed_recipient_roles=allowed_for_student, limit=100)
    titles_student = {n.title for n in items_student}
    assert "Общее уведомление" in titles_student
    assert "Для методиста" not in titles_student

    allowed_for_curator = allowed_recipient_roles_filter(UserRole.CURATOR)
    items_curator = await repo.list(allowed_recipient_roles=allowed_for_curator, limit=100)
    titles_curator = {n.title for n in items_curator}
    assert "Общее уведомление" in titles_curator
    assert "Для методиста" in titles_curator

    items_admin = await repo.list(allowed_recipient_roles=None, limit=100)
    assert {n.title for n in items_admin} >= {"Общее уведомление", "Для методиста"}


async def test_exists_recent(db_session):
    repo = NotificationRepository(db_session)
    assert await repo.exists_recent(NotificationType.SHORTLIST_TOP20_READY) is False

    await repo.create(
        type=NotificationType.SHORTLIST_TOP20_READY,
        title="Тест Top-20",
        recipient_role="координатор",
        publish=False,
    )
    await db_session.commit()

    assert await repo.exists_recent(NotificationType.SHORTLIST_TOP20_READY) is True


# ── /notifications: видимость по роли ────────────────────────────────────────

async def test_notifications_endpoint_hides_role_specific_for_student(auth_client, db_session):
    """auth_client регистрируется как обычный пользователь (роль student по умолчанию)."""
    repo = NotificationRepository(db_session)
    await repo.create(
        type=NotificationType.PRIORITY_AREA_PROPOSED,
        title="Только для методиста (S9-7 тест)",
        recipient_role="методист",
        publish=False,
    )
    await db_session.commit()

    resp = await auth_client.get("/api/v1/notifications", params={"limit": 200})
    assert resp.status_code == 200
    titles = {item["title"] for item in resp.json()["items"]}
    assert "Только для методиста (S9-7 тест)" not in titles


# ── Top-20 шортлист ───────────────────────────────────────────────────────────

async def test_check_top20_shortlist_ready_creates_notification(db_session):
    from sqlalchemy import delete

    from app.db.models.notification import Notification
    from app.db.repositories.company import CompanyRepository

    # Другие тесты (Sprint 4/9), выполняющиеся ранее в этом же тестовом
    # прогоне, могли уже зафиксировать (commit) уведомление SHORTLIST_TOP20_READY
    # — anti-spam (exists_recent, 24ч) тогда заблокирует создание нового.
    # Очищаем такие уведомления перед проверкой, чтобы тест был детерминированным.
    await db_session.execute(
        delete(Notification).where(Notification.type == NotificationType.SHORTLIST_TOP20_READY)
    )
    await db_session.commit()

    repo = CompanyRepository(db_session)

    # Создаём TOP20_SHORTLIST_THRESHOLD компаний со статусом shortlisted.
    for i in range(TOP20_SHORTLIST_THRESHOLD):
        data = dict(COMPANY_DATA)
        data["name"] = f"Top20 Компания {i}"
        company, _ = await repo.upsert_by_name(**data)
        await repo.update_status(company.id, CompanyStatus.SHORTLISTED)
    await db_session.commit()

    created = await check_top20_shortlist_ready(db_session)
    await db_session.commit()
    assert created is True

    # Повторный вызов в течение 24ч не должен создавать новое уведомление (анти-спам).
    created_again = await check_top20_shortlist_ready(db_session)
    await db_session.commit()
    assert created_again is False


async def test_check_top20_shortlist_not_ready_below_threshold(db_session):
    await _create_company(db_session)
    created = await check_top20_shortlist_ready(db_session)
    assert created is False
