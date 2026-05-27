from datetime import datetime
from pydantic import BaseModel
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
    status: str
    source: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class CompanyStatusUpdate(BaseModel):
    status: CompanyStatus


class CompanyListResponse(BaseModel):
    total: int
    items: list[CompanyOut]