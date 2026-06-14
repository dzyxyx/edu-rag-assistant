from datetime import datetime

from pydantic import BaseModel


class MemoryOut(BaseModel):
    id: int
    memory_type: str
    phase: str | None
    company_id: int | None
    content: str
    summary: str | None
    outcome: str | None
    outcome_score: float | None
    chroma_id: str | None
    usage_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class MemoryListResponse(BaseModel):
    items: list[MemoryOut]
    total: int


class AuditLogOut(BaseModel):
    id: int
    actor: str
    action: str
    phase: str | None
    entity_type: str | None
    entity_id: int | None
    details: str | None
    user_id: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogListResponse(BaseModel):
    items: list[AuditLogOut]
    total: int


class GraphNode(BaseModel):
    id: str
    label: str
    type: str  # memory | company


class GraphEdge(BaseModel):
    source: str
    target: str
    label: str | None = None


class MemoryGraphResponse(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]
