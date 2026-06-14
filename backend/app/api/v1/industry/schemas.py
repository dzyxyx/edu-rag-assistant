from datetime import datetime

from pydantic import BaseModel

from app.db.models.priority_area import PriorityAreaStatus


class CompetencyOut(BaseModel):
    id: int
    name: str
    category: str | None
    source: str
    frequency: int
    demand_score: float | None

    model_config = {"from_attributes": True}


class CompetencyListResponse(BaseModel):
    total: int
    items: list[CompetencyOut]


class MatrixRow(BaseModel):
    competency: str
    category: str | None
    industry: str
    mentions: int


class MatrixResponse(BaseModel):
    total: int
    items: list[MatrixRow]


class PriorityAreaOut(BaseModel):
    id: int
    name: str
    description: str | None
    industry: str | None
    score: float | None
    competency_ids: list[int] | None
    status: str
    reviewed_by: str | None
    review_comment: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PriorityAreaListResponse(BaseModel):
    total: int
    items: list[PriorityAreaOut]


class PriorityAreaReview(BaseModel):
    status: PriorityAreaStatus
    comment: str | None = None


class AnalyzeResponse(BaseModel):
    processed_vacancies: int
    competencies_found: int
    priority_area_industries: int
