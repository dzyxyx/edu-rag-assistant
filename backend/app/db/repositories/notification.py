from __future__ import annotations

from sqlalchemy import func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.notification import Notification, NotificationType


class NotificationRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        type: NotificationType | str,
        title: str,
        message: str | None = None,
        entity_type: str | None = None,
        entity_id: int | None = None,
        recipient_role: str | None = None,
        publish: bool = True,
    ) -> Notification:
        obj = Notification(
            type=str(type),
            title=title,
            message=message,
            entity_type=entity_type,
            entity_id=entity_id,
            recipient_role=recipient_role,
        )
        self.session.add(obj)
        await self.session.flush()
        await self.session.refresh(obj)

        if publish:
            # Realtime push через Redis pub/sub (S4-7/S9-7) — best-effort,
            # не должен прерывать создание уведомления при ошибке.
            from app.services.notifications.realtime import publish_notification

            try:
                await publish_notification(obj)
            except Exception:  # noqa: BLE001
                pass

        return obj

    async def get_by_id(self, notification_id: int) -> Notification | None:
        return await self.session.get(Notification, notification_id)

    async def list(
        self,
        unread_only: bool = False,
        limit: int = 50,
        offset: int = 0,
        allowed_recipient_roles: list[str] | None = None,
    ) -> list[Notification]:
        q = select(Notification).order_by(Notification.created_at.desc())
        if unread_only:
            q = q.where(Notification.is_read.is_(False))
        if allowed_recipient_roles is not None:
            q = q.where(
                or_(
                    Notification.recipient_role.is_(None),
                    Notification.recipient_role.in_(allowed_recipient_roles),
                )
            )
        q = q.limit(limit).offset(offset)
        result = await self.session.execute(q)
        return list(result.scalars().all())

    async def count(
        self,
        unread_only: bool = False,
        allowed_recipient_roles: list[str] | None = None,
    ) -> int:
        q = select(func.count()).select_from(Notification)
        if unread_only:
            q = q.where(Notification.is_read.is_(False))
        if allowed_recipient_roles is not None:
            q = q.where(
                or_(
                    Notification.recipient_role.is_(None),
                    Notification.recipient_role.in_(allowed_recipient_roles),
                )
            )
        result = await self.session.execute(q)
        return result.scalar_one()

    async def exists_recent(self, type: NotificationType | str, hours: int = 24) -> bool:
        """Есть ли уведомление данного типа за последние ``hours`` часов (анти-спам)."""
        from datetime import datetime, timedelta, timezone

        threshold = datetime.now(timezone.utc) - timedelta(hours=hours)
        q = (
            select(func.count())
            .select_from(Notification)
            .where(Notification.type == str(type), Notification.created_at >= threshold)
        )
        result = await self.session.execute(q)
        return result.scalar_one() > 0

    async def mark_read(self, notification_id: int) -> Notification | None:
        obj = await self.get_by_id(notification_id)
        if obj and not obj.is_read:
            obj.is_read = True
            await self.session.flush()
        return obj

    async def mark_all_read(self) -> int:
        result = await self.session.execute(
            update(Notification)
            .where(Notification.is_read.is_(False))
            .values(is_read=True)
        )
        await self.session.flush()
        return result.rowcount or 0
