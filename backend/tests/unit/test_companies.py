"""API-тесты для модуля Companies (S1)."""
import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")

BASE = "/api/v1/companies"

COMPANY_DATA = {
    "name": "Тест Компания",
    "website": "https://test.ru",
    "description": "python devops agile scrum стажировка практика студент",
    "industry": "Разработка ПО",
    "region": "Екатеринбург",
    "employee_count": 500,
    "email": "hr@test.ru",
    "source": "manual",
    "status": "raw",
}


# ── Вспомогательная функция ──────────────────────────────────────────────────

async def _create_company(db_session) -> int:
    """Создаёт компанию напрямую через репозиторий, возвращает id."""
    from app.db.repositories.company import CompanyRepository
    from app.services.scoring.company_scorer import CompanyScorer

    repo = CompanyRepository(db_session)
    scorer = CompanyScorer()
    company, _ = await repo.upsert_by_name(**COMPANY_DATA)
    scores = scorer.score(company)
    await repo.update_scores(company.id, **scores)
    await db_session.commit()
    return company.id


# ── GET /companies (список) ──────────────────────────────────────────────────

async def test_list_companies_empty(auth_client):
    resp = await auth_client.get(BASE)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data


async def test_list_companies_returns_created(auth_client, db_session):
    await _create_company(db_session)
    resp = await auth_client.get(BASE)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


async def test_list_companies_filter_by_status(auth_client, db_session):
    await _create_company(db_session)
    resp = await auth_client.get(BASE, params={"status": "raw"})
    assert resp.status_code == 200
    for item in resp.json()["items"]:
        assert item["status"] == "raw"


async def test_list_companies_filter_nonexistent_status(auth_client):
    resp = await auth_client.get(BASE, params={"status": "nonexistent_xyz"})
    assert resp.status_code == 200
    assert resp.json()["total"] == 0


async def test_list_companies_pagination(auth_client, db_session):
    await _create_company(db_session)
    resp = await auth_client.get(BASE, params={"limit": 1, "offset": 0})
    assert resp.status_code == 200
    assert len(resp.json()["items"]) <= 1


async def test_list_companies_requires_auth(client):
    resp = await client.get(BASE)
    assert resp.status_code == 401


# ── GET /companies/{id} ──────────────────────────────────────────────────────

async def test_get_company_found(auth_client, db_session):
    company_id = await _create_company(db_session)
    resp = await auth_client.get(f"{BASE}/{company_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == company_id
    assert data["name"] == COMPANY_DATA["name"]
    # Скоринг заполнен
    assert data["score"] is not None
    assert 0.0 <= data["score"] <= 1.0


async def test_get_company_not_found(auth_client):
    resp = await auth_client.get(f"{BASE}/999999")
    assert resp.status_code == 404


async def test_get_company_requires_auth(client, db_session):
    company_id = await _create_company(db_session)
    resp = await client.get(f"{BASE}/{company_id}")
    assert resp.status_code == 401


# ── PATCH /companies/{id}/status ─────────────────────────────────────────────

async def test_update_status_success(auth_client, db_session):
    company_id = await _create_company(db_session)
    resp = await auth_client.patch(
        f"{BASE}/{company_id}/status",
        json={"status": "shortlisted"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "shortlisted"


async def test_update_status_all_valid_values(auth_client, db_session):
    company_id = await _create_company(db_session)
    valid_statuses = [
        "raw", "scored", "shortlisted", "approved",
        "contacted", "interested", "partner", "rejected",
    ]
    for status in valid_statuses:
        resp = await auth_client.patch(
            f"{BASE}/{company_id}/status",
            json={"status": status},
        )
        assert resp.status_code == 200, f"Статус {status} вернул {resp.status_code}"
        assert resp.json()["status"] == status


async def test_update_status_invalid_value(auth_client, db_session):
    company_id = await _create_company(db_session)
    resp = await auth_client.patch(
        f"{BASE}/{company_id}/status",
        json={"status": "invalid_status"},
    )
    assert resp.status_code == 422


async def test_update_status_not_found(auth_client):
    resp = await auth_client.patch(
        f"{BASE}/999999/status",
        json={"status": "shortlisted"},
    )
    assert resp.status_code == 404


# ── POST /companies/{id}/score ───────────────────────────────────────────────

async def test_rescore_company(auth_client, db_session):
    company_id = await _create_company(db_session)
    resp = await auth_client.post(f"{BASE}/{company_id}/score")
    assert resp.status_code == 200
    data = resp.json()
    assert data["score"] is not None
    assert data["score_tech_stack"] is not None
    assert data["score_scale"] is not None
    assert data["score_reputation"] is not None
    assert data["score_edu_experience"] is not None
    # Компания с python/agile/стажировка должна иметь высокий score
    assert data["score"] > 0.4


async def test_rescore_not_found(auth_client):
    resp = await auth_client.post(f"{BASE}/999999/score")
    assert resp.status_code == 404
