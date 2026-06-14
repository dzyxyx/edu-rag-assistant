"""
Тесты для HH ingest — HH API замокан, Celery не используется.
Тестируем только логику _ingest(): сохранение компаний и скоринг.
"""
import pytest
from unittest.mock import AsyncMock, patch

from app.integrations.hh.schemas import HHEmployer
from app.workers.tasks.hh_ingest import _ingest, HH_KEYWORDS


def make_employer(
    emp_id: str,
    name: str,
    description: str = "python devops agile",
    employee_count: int = 200,
    site_url: str = "https://example.com",
    area: str = "Екатеринбург",
    industries: list | None = None,
) -> HHEmployer:
    return HHEmployer(
        id=emp_id,
        name=name,
        site_url=site_url,
        description=description,
        area={"name": area},
        industries=industries or [{"name": "Разработка ПО"}],
        employee_count=employee_count,
    )


MOCK_EMPLOYERS = [
    make_employer("1", "Альфа Технологии", description="python kubernetes devops agile scrum"),
    make_employer("2", "Бета Системы", description="java react typescript postgresql"),
    make_employer(
        "3", "Гамма Инновации",
        description="стажировка практика студент вуз python",
        employee_count=1000,
    ),
]


@pytest.fixture
def mock_hh_client():
    """Мок HHClient.collect_companies — возвращает фиксированный список работодателей."""
    with patch(
        "app.workers.tasks.hh_ingest.HHClient",
        autospec=True,
    ) as MockHHClient:
        instance = MockHHClient.return_value.__aenter__.return_value
        instance.collect_companies = AsyncMock(return_value=MOCK_EMPLOYERS)
        instance.collect = AsyncMock(return_value=(MOCK_EMPLOYERS, []))
        yield instance


# ── Async тесты _ingest() ────────────────────────────────────────────────────

@pytest.mark.asyncio(loop_scope="session")
async def test_ingest_creates_companies(mock_hh_client, db_session):
    """После _ingest() компании появляются в БД."""
    from app.db.repositories.company import CompanyRepository

    with patch("app.workers.tasks.hh_ingest.AsyncSessionFactory") as mock_factory:
        mock_factory.return_value.__aenter__ = AsyncMock(return_value=db_session)
        mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)
        await _ingest()

    repo = CompanyRepository(db_session)
    company = await repo.get_by_name("Альфа Технологии")
    assert company is not None
    assert company.source == "hh"


@pytest.mark.asyncio(loop_scope="session")
async def test_ingest_scores_companies(mock_hh_client, db_session):
    """После _ingest() у компаний заполнен скоринг."""
    from app.db.repositories.company import CompanyRepository

    with patch("app.workers.tasks.hh_ingest.AsyncSessionFactory") as mock_factory:
        mock_factory.return_value.__aenter__ = AsyncMock(return_value=db_session)
        mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)
        await _ingest()

    repo = CompanyRepository(db_session)
    company = await repo.get_by_name("Гамма Инновации")
    assert company is not None
    assert company.score is not None
    assert company.score > 0.0
    assert company.score_edu_experience is not None
    assert company.score_edu_experience > 0.0


@pytest.mark.asyncio(loop_scope="session")
async def test_ingest_upsert_no_duplicates(mock_hh_client, db_session):
    """Повторный запуск _ingest() не создаёт дубликаты."""
    from app.db.repositories.company import CompanyRepository

    for _ in range(2):
        with patch("app.workers.tasks.hh_ingest.AsyncSessionFactory") as mock_factory:
            mock_factory.return_value.__aenter__ = AsyncMock(return_value=db_session)
            mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)
            await _ingest()

    repo = CompanyRepository(db_session)
    companies = await repo.list()
    names = [c.name for c in companies]
    assert len(names) == len(set(names))


@pytest.mark.asyncio(loop_scope="session")
async def test_ingest_calls_hh_with_keywords(mock_hh_client, db_session):
    """HH клиент вызывается с правильными ключевыми словами."""
    with patch("app.workers.tasks.hh_ingest.AsyncSessionFactory") as mock_factory:
        mock_factory.return_value.__aenter__ = AsyncMock(return_value=db_session)
        mock_factory.return_value.__aexit__ = AsyncMock(return_value=False)
        await _ingest()

    mock_hh_client.collect.assert_called_once_with(keywords=HH_KEYWORDS)


# ── Sync тесты HHEmployer schema ─────────────────────────────────────────────

def test_hh_employer_schema_optional_fields():
    """HHEmployer корректно создаётся без необязательных полей."""
    emp = HHEmployer(id="42", name="Тест")
    assert emp.id == "42"
    assert emp.name == "Тест"
    assert emp.site_url is None
    assert emp.employee_count is None
    assert emp.industries == []


def test_hh_employer_schema_full():
    emp = make_employer("1", "Полная Компания")
    assert emp.area == {"name": "Екатеринбург"}
    assert emp.employee_count == 200
