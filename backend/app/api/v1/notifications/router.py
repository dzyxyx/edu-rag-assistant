import asyncio
import contextlib
import logging

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.notifications.schemas import (
    NotificationListResponse,
    NotificationOut,
    NotificationReadResponse,
)
from app.core.config import settings
from app.core.dependencies import get_current_user
from app.core.notification_roles import (
    allowed_recipient_roles_filter,
    recipient_roles_for_user_role,
)
from app.core.security import decode_token
from app.db.models.user import User
from app.db.repositories.notification import NotificationRepository
from app.db.repositories.user import UserRepository
from app.db.session import get_db, get_db_context
from app.services.notifications.realtime import CHANNEL_ALL, channel_for_recipient_role

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Список внутренних уведомлений (Sprint 9, human-in-the-loop).

    Доработка S9-7: показываются только уведомления, адресованные роли
    текущего пользователя (``recipient_role``), плюс общие (без
    recipient_role). Пользователи с ролью admin видят все уведомления.
    """
    repo = NotificationRepository(db)
    allowed_roles = allowed_recipient_roles_filter(current_user.role)
    items = await repo.list(
        unread_only=unread_only, limit=limit, offset=offset, allowed_recipient_roles=allowed_roles
    )
    total = await repo.count(allowed_recipient_roles=allowed_roles)
    unread = await repo.count(unread_only=True, allowed_recipient_roles=allowed_roles)
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


# ── WebSocket realtime-уведомления (S4-7/S9-7) ──────────────────────────────────

async def _ws_authenticate(websocket: WebSocket, token: str | None) -> User | None:
    """Аутентификация по JWT, переданному в query-параметре ?token=... (как в rag/router.py)."""
    if not token:
        return None
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        if user_id is None:
            return None
    except ValueError:
        return None

    async with get_db_context() as db:
        repo = UserRepository(db)
        return await repo.get_by_id(int(user_id))


@router.websocket("/ws")
async def notifications_ws(websocket: WebSocket, token: str | None = Query(default=None)):
    """
    Realtime-канал уведомлений.

    Подключение: ``/api/v1/notifications/ws?token=<JWT>``.

    Пользователь подписывается на:
      * ``notifications:all`` — общие уведомления (без recipient_role);
      * каналы ``notifications:{recipient_role}``, адресованные роли пользователя
        (см. ``app.core.notification_roles``).

    Администратор (``UserRole.ADMIN``) подписан на все известные каналы.
    Каждое сообщение — JSON-объект с полями уведомления (см.
    ``app.services.notifications.realtime._serialize``).
    """
    user = await _ws_authenticate(websocket, token)
    if user is None:
        await websocket.close(code=4401, reason="Unauthorized")
        return

    await websocket.accept()

    channels = {CHANNEL_ALL}
    for recipient_role in recipient_roles_for_user_role(user.role):
        channels.add(channel_for_recipient_role(recipient_role))

    redis_client = aioredis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
    pubsub = redis_client.pubsub()

    try:
        await pubsub.subscribe(*channels)

        listen_task = asyncio.create_task(_relay_messages(pubsub, websocket))
        try:
            # Ждём отключения клиента (входящие сообщения от клиента игнорируются).
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            pass
        finally:
            listen_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await listen_task
    finally:
        with contextlib.suppress(Exception):
            await pubsub.unsubscribe(*channels)
            await pubsub.aclose()
        with contextlib.suppress(Exception):
            await redis_client.aclose()


async def _relay_messages(pubsub, websocket: WebSocket) -> None:
    """Читает сообщения из Redis pub/sub и пересылает их в WebSocket."""
    try:
        async for message in pubsub.listen():
            if message.get("type") != "message":
                continue
            await websocket.send_text(message["data"])
    except asyncio.CancelledError:
        raise
    except Exception:  # noqa: BLE001
        logger.exception("notifications_ws: ошибка при ретрансляции сообщений")
