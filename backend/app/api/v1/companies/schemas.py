from datetime import datetime
from pydantic import BaseModel, Field
from app.db.models.company import CompanyStatus


class CompanyOut(BaseModel):
    id: int
    name: str
    inn: str | None
    website: str | None
    description: str | None
    industry: str | None
    region: str | None
    employee_count: int | None
    email: str | None
    score: float | None
    score_tech_stack: float | None
    score_scale: float | None
    score_reputation: float | None
    score_edu_experience: float | None
    score_vacancy_activity: float | None
    status: str
    source: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class CompanyStatusUpdate(BaseModel):
    status: CompanyStatus


class CompanyListResponse(BaseModel):
    total: int
    items: list[CompanyOut]


class CompanyScoreHistoryOut(BaseModel):
    id: int
    score: float
    score_tech_stack: float | None
    score_scale: float | None
    score_reputation: float | None
    score_edu_experience: float | None
    score_vacancy_activity: float | None
    priority_bonus: float
    trigger: str
    created_at: datetime

    model_config = {"from_attributes": True}


class CompanyScoreHistoryListResponse(BaseModel):
    total: int
    items: list[CompanyScoreHistoryOut]


# ── Sprint 1: ручное добавление / импорт компаний ────────────────────────────


class CompanyCreate(BaseModel):
    """Ручное добавление компании (FR-1.1, FR-1.4)."""

    name: str = Field(..., min_length=1, max_length=500)
    inn: str | None = Field(None, max_length=12)
    website: str | None = None
    description: str | None = None
    industry: str | None = None
    region: str | None = None
    employee_count: int | None = None
    email: str | None = None
    phone: str | None = None
    linkedin_url: str | None = None


class CompanyImportRequest(BaseModel):
    """Массовый импорт компаний из внешнего источника (CSV/JSON)."""

    items: list[CompanyCreate] = Field(..., min_length=1)


class CompanyImportResponse(BaseModel):
    total: int
    created: int
    updated: int
    log_id: int


# ── Sprint 1: история запусков сбора данных ──────────────────────────────────


class IngestLogOut(BaseModel):
    id: int
    source: str
    trigger: str
    status: str
    started_at: datetime
    finished_at: datetime | None
    companies_created: int
    companies_updated: int
    vacancies_created: int
    vacancies_updated: int
    skipped_duplicates: int
    errors_count: int
    error_message: str | None

    model_config = {"from_attributes": True}


class IngestLogListResponse(BaseModel):
    total: int
    items: list[IngestLogOut]