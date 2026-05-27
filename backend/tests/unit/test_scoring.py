"""Юнит-тесты для CompanyScorer — без БД, без async."""
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


class TestCompanyScorer:
    scorer = CompanyScorer()

    # ── score() возвращает все ключи ─────────────────────────────────

    def test_score_returns_all_keys(self):
        company = make_company()
        result = self.scorer.score(company)
        assert set(result.keys()) == {
            "score", "score_tech_stack", "score_scale",
            "score_reputation", "score_edu_experience",
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
        result = self.scorer.score(company)
        assert result["score"] >= 0.7

    def test_empty_company_low_score(self):
        company = make_company()
        result = self.scorer.score(company)
        assert result["score"] <= 0.3
