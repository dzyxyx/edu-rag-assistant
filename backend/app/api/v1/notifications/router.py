from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user

router = APIRouter()


@router.get("")
async def list_notifications(_=Depends(get_current_user)):
    """Stub — будет реализован в Sprint 3."""
    return {
        "items": [],
        "total": 0,
        "unread": 0,
    }


@router.post("/{notification_id}/read")
async def mark_notification_read(notification_id: int, _=Depends(get_current_user)):
    """Stub — будет реализован в Sprint 3."""
    return {"status": "ok"}
