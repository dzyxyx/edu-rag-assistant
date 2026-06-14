"""Юнит-тесты для нормализации данных компаний (Sprint 1 — FR-1.4)."""
from app.services.ingestion.normalization import normalize_company_name, normalize_region


class TestNormalizeCompanyName:
    def test_strips_legal_form_ooo(self):
        assert normalize_company_name('ООО "Ромашка"') == "ромашка"

    def test_strips_legal_form_and_quotes_variants(self):
        assert normalize_company_name("ООО «Ромашка»") == "ромашка"
        assert normalize_company_name("Ромашка") == "ромашка"
        assert normalize_company_name("  ромашка  ") == "ромашка"

    def test_strips_english_legal_forms(self):
        assert normalize_company_name("Acme LLC") == "acme"
        assert normalize_company_name("Acme Inc.") == "acme"

    def test_none_and_empty(self):
        assert normalize_company_name(None) == ""
        assert normalize_company_name("") == ""

    def test_different_companies_not_equal(self):
        assert normalize_company_name("ООО Ромашка") != normalize_company_name("ООО Лютик")


class TestNormalizeRegion:
    def test_known_aliases(self):
        assert normalize_region("г. Екатеринбург") == "Екатеринбург"
        assert normalize_region("Екатеринбург") == "Екатеринбург"
        assert normalize_region("г Москва") == "Москва"
        assert normalize_region("СПб") == "Санкт-Петербург"

    def test_unknown_region_passthrough(self):
        assert normalize_region("Новосибирск") == "Новосибирск"

    def test_none_passthrough(self):
        assert normalize_region(None) is None
