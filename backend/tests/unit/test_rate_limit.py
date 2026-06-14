"""Тесты rate limiting (slowapi) — Sprint 1 (S1-7)."""
import pytest

from app.core.config import settings
from app.core.limiter import limiter
from tests.unit.test_companies import COMPANY_DATA, _create_company

pytestmark = pytest.mark.asyncio(loop_scope="session")

BASE = "/api/v1/companies"


@pytest.fixture
def low_rate_limit(monkeypatch):
    """Временно снижает RATE_LIMIT_PER_MINUTE до 2 и сбрасывает storage лимитера."""
    monkeypatch.setattr(settings, "RATE_LIMIT_PER_MINUTE", 2)
    limiter.reset()
    yield
    limiter.reset()


async def test_rescore_company_rate_limited(auth_client, db_session, low_rate_limit):
    """После превышения RATE_LIMIT_PER_MINUTE эндпоинт возвращает 429."""
    company_id = await _create_company(db_session)
    url = f"{BASE}/{company_id}/score"

    statuses = []
    for _ in range(3):
        resp = await auth_client.post(url)
        statuses.append(resp.status_code)

    assert 200 in statuses
    assert 429 in statuses


async def test_rescore_company_not_limited_with_default_settings(auth_client, db_session):
    """С настройками по умолчанию (60/мин) пара запросов не должна давать 429."""
    company_id = await _create_company(db_session)
    url = f"{BASE}/{company_id}/score"

    for _ in range(2):
        resp = await auth_client.post(url)
        assert resp.status_code == 200
