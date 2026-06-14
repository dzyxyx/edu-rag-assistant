from datetime import datetime
from pydantic import BaseModel


class CampaignCreate(BaseModel):
    name: str
    description: str | None = None


class CampaignOut(BaseModel):
    id: int
    name: str
    description: str | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class GenerateRequest(BaseModel):
    company_ids: list[int]
    tone: str = "formal"   # formal | informal


class GenerateResponse(BaseModel):
    campaign_id: int
    generated: int          # сколько черновиков создано
    failed: int             # сколько не удалось сгенерировать


class EventOut(BaseModel):
    id: int
    campaign_id: int
    company_id: int
    status: str
    subject: str | None
    body: str | None
    tone: str | None
    reply_category: str | None
    follow_up_number: int
    confidence_score: float | None = None
    memory_used_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class EventContentUpdate(BaseModel):
    subject: str
    body: str
