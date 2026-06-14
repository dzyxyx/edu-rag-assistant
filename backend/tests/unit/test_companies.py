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
    scores.pop("priority_bonus", None)  # не является полем Company, см. Sprint 4
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


# ── Sprint 4: скоринг на основе вакансий, автошортлист, история ─────────────

from app.core.config import settings
from app.db.models.company import CompanyStatus
from app.db.models.priority_area import PriorityAreaStatus
from app.db.repositories.company_score_history import CompanyScoreHistoryRepository
from app.db.repositories.priority_area import PriorityAreaRepository
from app.db.repositories.vacancy import VacancyRepository
from app.services.scoring.scoring_service import score_company


IDEAL_COMPANY_S4 = {
    **COMPANY_DATA,
    "name": "S4 Идеальная компания",
    "description": (
        "python devops kubernetes docker agile scrum react "
        "стажировка практика студент вуз молодой специалист " + "x" * 60
    ),
    "employee_count": 1000,
}


async def _create_company_s4(db_session, **overrides) -> "object":
    from app.db.repositories.company import CompanyRepository

    repo = CompanyRepository(db_session)
    data = {**IDEAL_COMPANY_S4, **overrides}
    company, _ = await repo.upsert_by_name(**data)
    await db_session.commit()
    return company


async def _add_vacancy(db_session, company_id: int, title: str):
    vacancy_repo = VacancyRepository(db_session)
    vacancy = await vacancy_repo.create(title=title, source="hh", company_id=company_id)
    await db_session.commit()
    return vacancy


async def test_score_includes_vacancy_activity_field(auth_client, db_session):
    company = await _create_company_s4(db_session, name="S4 Компания без вакансий")
    resp = await auth_client.post(f"{BASE}/{company.id}/score")
    assert resp.status_code == 200
    data = resp.json()
    assert "score_vacancy_activity" in data
    assert data["score_vacancy_activity"] == 0.0  # нет вакансий


async def test_auto_shortlist_on_high_score(auth_client, db_session):
    company = await _create_company_s4(db_session, name="S4 Компания для автошортлиста")
    for i in range(5):
        await _add_vacancy(db_session, company.id, f"Стажёр Python разработчик #{i}")

    resp = await auth_client.post(f"{BASE}/{company.id}/score")
    assert resp.status_code == 200
    data = resp.json()
    assert data["score"] >= settings.AUTO_SHORTLIST_SCORE_THRESHOLD
    assert data["status"] == CompanyStatus.SHORTLISTED


async def test_low_score_sets_scored_status(auth_client, db_session):
    company = await _create_company_s4(
        db_session,
        name="S4 Слабая компания",
        description=None,
        industry=None,
        employee_count=None,
        website=None,
        email=None,
    )
    resp = await auth_client.post(f"{BASE}/{company.id}/score")
    assert resp.status_code == 200
    data = resp.json()
    assert data["score"] < settings.AUTO_SHORTLIST_SCORE_THRESHOLD
    assert data["status"] == CompanyStatus.SCORED


async def test_score_company_does_not_downgrade_advanced_status(db_session):
    company = await _create_company_s4(
        db_session, name="S4 Партнёр компания", status=CompanyStatus.PARTNER
    )

    await score_company(db_session, company, trigger="manual")
    await db_session.commit()

    from app.db.repositories.company import CompanyRepository

    repo = CompanyRepository(db_session)
    refreshed = await repo.get_by_id(company.id)
    assert refreshed.status == CompanyStatus.PARTNER


async def test_priority_area_bonus_applied(db_session):
    area_repo = PriorityAreaRepository(db_session)
    area, _ = await area_repo.upsert_proposal(
        name="S4 Разработка ПО — приоритет",
        industry="Разработка ПО",
        score=90.0,
        competency_ids=[],
    )
    await area_repo.review(area.id, status=PriorityAreaStatus.APPROVED, reviewed_by="tester")
    await db_session.commit()

    company = await _create_company_s4(db_session, name="S4 Компания с приоритетной отраслью")

    result = await score_company(db_session, company, trigger="manual")
    await db_session.commit()
    assert result["priority_bonus"] > 0.0

    # Очищаем созданную приоритетную область, чтобы не влиять на другие тесты
    # (например, build_market_context в test_rag_chat.py).
    await area_repo.review(area.id, status=PriorityAreaStatus.REJECTED, reviewed_by="tester")
    await db_session.commit()


async def test_score_history_endpoint(auth_client, db_session):
    company = await _create_company_s4(db_session, name="S4 Компания с историей скоринга")

    resp1 = await auth_client.post(f"{BASE}/{company.id}/score")
    assert resp1.status_code == 200
    resp2 = await auth_client.post(f"{BASE}/{company.id}/score")
    assert resp2.status_code == 200

    history_resp = await auth_client.get(f"{BASE}/{company.id}/score-history")
    assert history_resp.status_code == 200
    data = history_resp.json()
    assert data["total"] >= 2
    assert data["items"][0]["trigger"] == "manual"
    assert "score_vacancy_activity" in data["items"][0]


async def test_score_history_not_found(auth_client):
    resp = await auth_client.get(f"{BASE}/999999/score-history")
    assert resp.status_code == 404


# ── Sprint 1: дедупликация, ручное добавление, импорт, ingest-logs ──────────


async def test_upsert_by_name_dedup_via_normalized_name(db_session):
    """Компания с другим юр.лицом/кавычками в названии не создаёт дубликат (FR-1.4)."""
    from app.db.repositories.company import CompanyRepository

    repo = CompanyRepository(db_session)
    company1, created1 = await repo.upsert_by_name(
        'ООО "Ромашка Тест S1"', industry="Разработка ПО", source="hh"
    )
    await db_session.commit()
    assert created1 is True

    company2, created2 = await repo.upsert_by_name(
        "Ромашка Тест S1", region="г. Екатеринбург", source="manual"
    )
    await db_session.commit()

    assert created2 is False
    assert company2.id == company1.id
    # source перезаписан последним upsert
    assert company2.source == "manual"
    # регион нормализован через словарь синонимов
    assert company2.region == "Екатеринбург"


async def test_create_company_manual(auth_client, db_session):
    resp = await auth_client.post(
        BASE,
        json={
            "name": "S1 Новая Компания",
            "industry": "Разработка ПО",
            "region": "г. Екатеринбург",
            "employee_count": 50,
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "S1 Новая Компания"
    assert data["source"] == "manual"
    assert data["status"] == "raw"
    assert data["region"] == "Екатеринбург"
    assert data["score"] is not None


async def test_create_company_duplicate_conflict(auth_client, db_session):
    payload = {"name": "S1 Дубликат Компания", "industry": "Разработка ПО"}
    resp1 = await auth_client.post(BASE, json=payload)
    assert resp1.status_code == 201

    resp2 = await auth_client.post(BASE, json={"name": 'ООО "S1 Дубликат Компания"'})
    assert resp2.status_code == 409


async def test_create_company_requires_auth(client):
    resp = await client.post(BASE, json={"name": "S1 Без авторизации"})
    assert resp.status_code == 401


async def test_import_companies(auth_client, db_session):
    resp = await auth_client.post(
        f"{BASE}/import",
        json={
            "items": [
                {"name": "S1 Импорт Компания 1", "industry": "Разработка ПО"},
                {"name": "S1 Импорт Компания 2", "region": "г. Москва"},
            ]
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert data["created"] == 2
    assert data["updated"] == 0
    assert "log_id" in data


async def test_import_companies_updates_existing(auth_client, db_session):
    await auth_client.post(BASE, json={"name": "S1 Импорт Существующая"})

    resp = await auth_client.post(
        f"{BASE}/import",
        json={"items": [{"name": "S1 Импорт Существующая", "industry": "Финансы"}]},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["created"] == 0
    assert data["updated"] == 1


async def test_import_companies_requires_auth(client):
    resp = await client.post(f"{BASE}/import", json={"items": [{"name": "X"}]})
    assert resp.status_code == 401


async def test_list_ingest_logs(auth_client, db_session):
    await auth_client.post(
        f"{BASE}/import", json={"items": [{"name": "S1 Лог Компания"}]}
    )

    resp = await auth_client.get(f"{BASE}/ingest-logs", params={"source": "manual_import"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    assert data["items"][0]["source"] == "manual_import"
    assert data["items"][0]["status"] == "success"


async def test_list_ingest_logs_requires_auth(client):
    resp = await client.get(f"{BASE}/ingest-logs")
    assert resp.status_code == 401


async def test_company_score_history_repository(db_session):
    company = await _create_company_s4(db_session, name="S4 Компания для репозитория истории")
    history_repo = CompanyScoreHistoryRepository(db_session)

    await history_repo.add(
        company_id=company.id,
        score=0.55,
        score_tech_stack=0.5,
        score_scale=0.4,
        score_reputation=0.6,
        score_edu_experience=0.3,
        score_vacancy_activity=0.7,
        priority_bonus=0.05,
        trigger="scheduled",
    )
    await db_session.commit()

    items = await history_repo.list_by_company(company.id)
    assert len(items) >= 1
    assert items[0].trigger == "scheduled"
    assert await history_repo.count_by_company(company.id) >= 1
