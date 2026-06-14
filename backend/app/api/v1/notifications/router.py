from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.notifications.schemas import (
    NotificationListResponse,
    NotificationOut,
    NotificationReadResponse,
)
from app.core.dependencies import get_current_user
from app.db.repositories.notification import NotificationRepository
from app.db.session import get_db

router = APIRouter()


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """Список внутренних уведомлений (Sprint 9, human-in-the-loop)."""
    repo = NotificationRepository(db)
    items = await repo.list(unread_only=unread_only, limit=limit, offset=offset)
    total = await repo.count()
    unread = await repo.count(unread_only=True)
    return NotificationListResponse(
        items=[NotificationOut.model_validate(n) for n in items],
        total=total,
        unread=unread,
    )


@router.post("/{notification_id}/read", response_model=NotificationReadResponse)
async def mark_notification_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """Отметить уведомление как прочитанное."""
    repo = NotificationRepository(db)
    obj = await repo.mark_read(notification_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Notification not found")
    await db.commit()
    return NotificationReadResponse(status="ok", notification=NotificationOut.model_validate(obj))


@router.post("/read-all", response_model=NotificationReadResponse)
async def mark_all_notifications_read(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """Отметить все уведомления как прочитанные."""
    repo = NotificationRepository(db)
    await repo.mark_all_read()
    await db.commit()
    return NotificationReadResponse(status="ok")
