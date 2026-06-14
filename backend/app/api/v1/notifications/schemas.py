from datetime import datetime

from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: int
    type: str
    title: str
    message: str | None = None
    entity_type: str | None = None
    entity_id: int | None = None
    recipient_role: str | None = None
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    items: list[NotificationOut]
    total: int
    unread: int


class NotificationReadResponse(BaseModel):
    status: str = "ok"
    notification: NotificationOut | None = None
