from datetime import datetime

from pydantic import BaseModel


class ChatRequest(BaseModel):
    question: str
    session_id: int | None = None  # None — создать новую сессию


class ChatResponse(BaseModel):
    answer: str
    session_id: int
    message_id: int
    sources: list[str] = []


class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    sources: list[str] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class SessionOut(BaseModel):
    id: int
    title: str | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
