"""Юнит-тесты для CompanyScorer — без БД, без async."""
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest

from app.services.scoring.company_scorer import CompanyScorer


def make_company(**kwargs) -> MagicMock:
    """Создаёт mock-объект Company с нужными атрибутами."""
    defaults = {
        "name": "Test Company",
        "description": None,
        "industry": None,
        "employee_count": None,
        "website": None,
        "email": None,
        "phone": None,
    }
    defaults.update(kwargs)
    return MagicMock(**defaults)


def make_vacancy(**kwargs) -> MagicMock:
    """Создаёт mock-объект Vacancy с нужными атрибутами."""
    defaults = {
        "title": "Разработчик",
        "description": "",
        "created_at": datetime.now(timezone.utc),
    }
    defaults.update(kwargs)
    return MagicMock(**defaults)


class TestCompanyScorer:
    scorer = CompanyScorer()

    # ── score() возвращает все ключи ─────────────────────────────────

    def test_score_returns_all_keys(self):
        company = make_company()
        result = self.scorer.score(company)
        assert set(result.keys()) == {
            "score", "score_tech_stack", "score_scale",
            "score_reputation", "score_edu_experience",
            "score_vacancy_activity", "priority_bonus",
        }

    def test_score_values_in_range(self):
        company = make_company(
            description="python devops agile scrum kubernetes",
            industry="разработка ПО",
            employee_count=500,
            website="https://example.com",
        )
        result = self.scorer.score(company)
        for key, val in result.items():
            assert 0.0 <= val <= 1.0, f"{key}={val} вне диапазона [0, 1]"

    # ── tech_stack ───────────────────────────────────────────────────

    def test_tech_stack_empty_description(self):
        company = make_company(description=None, industry=None)
        assert self.scorer._score_tech_stack(company) == 0.0

    def test_tech_stack_saturates_at_five_keywords(self):
        desc = "python devops kubernetes docker agile scrum react"
        company = make_company(description=desc, industry=None)
        assert self.scorer._score_tech_stack(company) == 1.0

    def test_tech_stack_partial(self):
        company = make_company(description="python docker", industry=None)
        score = self.scorer._score_tech_stack(company)
        assert 0.0 < score < 1.0

    def test_tech_stack_from_industry(self):
        company = make_company(description=None, industry="agile python")
        score = self.scorer._score_tech_stack(company)
        assert score > 0.0

    # ── scale ────────────────────────────────────────────────────────

    def test_scale_no_data(self):
        company = make_company(employee_count=None)
        assert self.scorer._score_scale(company) == 0.2

    def test_scale_small(self):
        company = make_company(employee_count=30)
        assert self.scorer._score_scale(company) == 0.2

    def test_scale_medium(self):
        company = make_company(employee_count=100)
        assert self.scorer._score_scale(company) == 0.4

    def test_scale_large(self):
        company = make_company(employee_count=300)
        assert self.scorer._score_scale(company) == 0.6

    def test_scale_very_large(self):
        company = make_company(employee_count=700)
        assert self.scorer._score_scale(company) == 0.8

    def test_scale_enterprise(self):
        company = make_company(employee_count=5000)
        assert self.scorer._score_scale(company) == 1.0

    # ── reputation ───────────────────────────────────────────────────

    def test_reputation_empty(self):
        company = make_company(website=None, description=None, email=None, phone=None)
        assert self.scorer._score_reputation(company) == 0.0

    def test_reputation_website_only(self):
        company = make_company(website="https://x.com", description=None, email=None, phone=None)
        assert self.scorer._score_reputation(company) == 0.4

    def test_reputation_full(self):
        company = make_company(
            website="https://x.com",
            description="x" * 200,
            email="hr@x.com",
            phone=None,
        )
        assert self.scorer._score_reputation(company) == 1.0

    def test_reputation_short_description_not_counted(self):
        company = make_company(website=None, description="short", email=None, phone=None)
        assert self.scorer._score_reputation(company) == 0.0

    # ── edu_experience ───────────────────────────────────────────────

    def test_edu_empty(self):
        company = make_company(description=None)
        assert self.scorer._score_edu_experience(company) == 0.0

    def test_edu_keywords_found(self):
        company = make_company(description="стажировка практика вуз")
        assert self.scorer._score_edu_experience(company) == 1.0

    def test_edu_partial(self):
        company = make_company(description="стажировка для студентов")
        score = self.scorer._score_edu_experience(company)
        assert 0.0 < score < 1.0

    # ── итоговый score ───────────────────────────────────────────────

    def test_ideal_company_high_score(self):
        company = make_company(
            description=(
                "python devops kubernetes docker agile scrum react "
                "стажировка практика студент вуз молодой специалист"
            ),
            industry="разработка ПО",
            employee_count=1000,
            website="https://best.com",
            email="hr@best.com",
            phone=None,
        )
        # Идеальная компания активно нанимает стажёров/junior (FR-2.3)
        vacancies = [make_vacancy(title="Стажёр Python разработчик") for _ in range(5)]
        result = self.scorer.score(company, vacancies=vacancies)
        assert result["score"] >= 0.7

    def test_empty_company_low_score(self):
        company = make_company()
        result = self.scorer.score(company)
        assert result["score"] <= 0.3

    # ── vacancy_activity (FR-2.3) ───────────────────────────────────────

    def test_vacancy_activity_no_vacancies(self):
        assert self.scorer._score_vacancy_activity([]) == 0.0

    def test_vacancy_activity_intern_and_fresh(self):
        vacancies = [
            make_vacancy(title="Стажёр-разработчик Python"),
            make_vacancy(title="Junior backend developer"),
            make_vacancy(title="Backend developer"),
        ]
        score = self.scorer._score_vacancy_activity(vacancies)
        assert 0.0 < score < 1.0

    def test_vacancy_activity_stale_vacancies_score_lower(self):
        fresh = [make_vacancy(title="Стажёр") for _ in range(5)]
        stale = [
            make_vacancy(title="Стажёр", created_at=datetime.now(timezone.utc) - timedelta(days=365))
            for _ in range(5)
        ]
        fresh_score = self.scorer._score_vacancy_activity(fresh)
        stale_score = self.scorer._score_vacancy_activity(stale)
        assert fresh_score > stale_score

    def test_vacancy_activity_saturates_on_volume(self):
        vacancies = [make_vacancy(title="Стажёр") for _ in range(10)]
        score = self.scorer._score_vacancy_activity(vacancies)
        assert score == 1.0

    def test_score_includes_vacancy_activity(self):
        company = make_company()
        vacancies = [make_vacancy(title="Стажёр") for _ in range(5)]
        without = self.scorer.score(company)
        with_vacancies = self.scorer.score(company, vacancies=vacancies)
        assert with_vacancies["score_vacancy_activity"] == 1.0
        assert without["score_vacancy_activity"] == 0.0
        assert with_vacancies["score"] > without["score"]

    # ── priority_bonus (FR-1.5 <-> FR-2.4) ──────────────────────────────

    def test_priority_bonus_no_match(self):
        company = make_company(industry="Розничная торговля")
        bonus = self.scorer._priority_bonus(company, {"разработка по"})
        assert bonus == 0.0

    def test_priority_bonus_match(self):
        company = make_company(industry="Разработка ПО")
        bonus = self.scorer._priority_bonus(company, {"разработка по"})
        assert bonus > 0.0

    def test_priority_bonus_no_industries(self):
        company = make_company(industry="Разработка ПО")
        assert self.scorer._priority_bonus(company, None) == 0.0
        assert self.scorer._priority_bonus(company, set()) == 0.0

    def test_score_with_priority_bonus_higher(self):
        company = make_company(industry="Разработка ПО")
        without = self.scorer.score(company)
        with_bonus = self.scorer.score(company, priority_industries={"разработка по"})
        assert with_bonus["priority_bonus"] > 0.0
        assert with_bonus["score"] > without["score"]

    def test_score_capped_at_one(self):
        company = make_company(
            description=(
                "python devops kubernetes docker agile scrum react "
                "стажировка практика студент вуз молодой специалист"
            ),
            industry="разработка по",
            employee_count=5000,
            website="https://best.com",
            email="hr@best.com",
            phone=None,
        )
        vacancies = [make_vacancy(title="Стажёр Python") for _ in range(10)]
        result = self.scorer.score(company, vacancies=vacancies, priority_industries={"разработка по"})
        assert result["score"] <= 1.0
