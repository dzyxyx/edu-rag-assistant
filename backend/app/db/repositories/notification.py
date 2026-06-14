from __future__ import annotations

from sqlalchemy import func, select, update
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
        return obj

    async def get_by_id(self, notification_id: int) -> Notification | None:
        return await self.session.get(Notification, notification_id)

    async def list(
        self,
        unread_only: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Notification]:
        q = select(Notification).order_by(Notification.created_at.desc())
        if unread_only:
            q = q.where(Notification.is_read.is_(False))
        q = q.limit(limit).offset(offset)
        result = await self.session.execute(q)
        return list(result.scalars().all())

    async def count(self, unread_only: bool = False) -> int:
        q = select(func.count()).select_from(Notification)
        if unread_only:
            q = q.where(Notification.is_read.is_(False))
        result = await self.session.execute(q)
        return result.scalar_one()

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
