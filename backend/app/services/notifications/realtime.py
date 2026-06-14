"""
Realtime-доставка внутренних уведомлений через Redis pub/sub (S4-7/S9-7).

Уведомления (``Notification``) могут создаваться как в процессе FastAPI-приложения
(API-запросы), так и в Celery worker (например, периодический пересчёт скоринга,
см. ``app/workers/tasks/scoring.py``). Чтобы push дошёл до клиента независимо от
того, где было создано уведомление, используется Redis pub/sub: создатель публикует
сообщение в канал(ы), а WebSocket-эндпоинт ``/notifications/ws`` подписывается на них.

Канал для каждого уведомления: ``notifications:{recipient_role}``
(``notifications:all``, если recipient_role не задан). Дополнительно сообщение
всегда дублируется в ``notifications:all`` — туда подписаны администраторы.
"""

from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING

import redis.asyncio as aioredis

from app.core.config import settings

if TYPE_CHECKING:
    from app.db.models.notification import Notification

logger = logging.getLogger(__name__)

CHANNEL_PREFIX = "notifications"
CHANNEL_ALL = f"{CHANNEL_PREFIX}:all"


def channel_for_recipient_role(recipient_role: str | None) -> str:
    return f"{CHANNEL_PREFIX}:{recipient_role}" if recipient_role else CHANNEL_ALL


def _serialize(notification: "Notification") -> str:
    return json.dumps(
        {
            "id": notification.id,
            "type": notification.type,
            "title": notification.title,
            "message": notification.message,
            "entity_type": notification.entity_type,
            "entity_id": notification.entity_id,
            "recipient_role": notification.recipient_role,
            "is_read": notification.is_read,
            "created_at": notification.created_at.isoformat() if notification.created_at else None,
        },
        ensure_ascii=False,
    )


async def publish_notification(notification: "Notification") -> None:
    """
    Публикует уведомление в Redis pub/sub для доставки через WebSocket.

    Создаёт собственное короткоживущее соединение с Redis — это позволяет
    вызывать функцию как из FastAPI (request-scoped), так и из Celery worker,
    где общий пул ``app.core.redis`` не инициализирован. Ошибки публикации
    не должны прерывать основной поток (создание уведомления уже committed).
    """
    try:
        client = aioredis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
        try:
            payload = _serialize(notification)
            channel = channel_for_recipient_role(notification.recipient_role)
            await client.publish(channel, payload)
            if channel != CHANNEL_ALL:
                await client.publish(CHANNEL_ALL, payload)
        finally:
            await client.aclose()
    except Exception:
        logger.exception("publish_notification: не удалось опубликовать уведомление id=%s", notification.id)
