from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.outreach import OutreachCampaign, OutreachEvent, OutreachStatus

_UNSET = object()


class OutreachRepository:
    def __init__(self, session: AsyncSession):
        self._s = session

    # ── Campaigns ─────────────────────────────────────────────────────────────

    async def create_campaign(
        self,
        name: str,
        description: str | None,
        created_by_id: int,
    ) -> OutreachCampaign:
        obj = OutreachCampaign(
            name=name,
            description=description,
            created_by_id=created_by_id,
        )
        self._s.add(obj)
        await self._s.flush()
        return obj

    async def get_campaign(self, campaign_id: int) -> OutreachCampaign | None:
        return await self._s.get(OutreachCampaign, campaign_id)

    async def list_campaigns(
        self, limit: int = 50, offset: int = 0
    ) -> list[OutreachCampaign]:
        result = await self._s.execute(
            select(OutreachCampaign)
            .order_by(OutreachCampaign.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())

    # ── Events ────────────────────────────────────────────────────────────────

    async def create_event(
        self,
        campaign_id: int,
        company_id: int,
        subject: str,
        body: str,
        tone: str = "formal",
        status: str = OutreachStatus.DRAFT,
        confidence_score: float | None = None,
        memory_used_count: int = 0,
    ) -> OutreachEvent:
        obj = OutreachEvent(
            campaign_id=campaign_id,
            company_id=company_id,
            channel="email",
            status=status,
            subject=subject,
            body=body,
            tone=tone,
            confidence_score=confidence_score,
            memory_used_count=memory_used_count,
        )
        self._s.add(obj)
        await self._s.flush()
        return obj

    async def get_event(self, event_id: int) -> OutreachEvent | None:
        return await self._s.get(OutreachEvent, event_id)

    async def list_events(
        self,
        campaign_id: int | None = None,
        status: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[OutreachEvent]:
        q = select(OutreachEvent).order_by(OutreachEvent.created_at.desc())
        if campaign_id is not None:
            q = q.where(OutreachEvent.campaign_id == campaign_id)
        if status is not None:
            q = q.where(OutreachEvent.status == status)
        result = await self._s.execute(q.limit(limit).offset(offset))
        return list(result.scalars().all())

    async def update_status(
        self, event_id: int, status: str, next_follow_up_after_days: int | None = _UNSET
    ) -> OutreachEvent | None:
        obj = await self.get_event(event_id)
        if obj:
            obj.status = status
            if next_follow_up_after_days is not _UNSET:
                obj.next_follow_up_after_days = next_follow_up_after_days
            await self._s.flush()
        return obj

    async def update_content(
        self, event_id: int, subject: str, body: str
    ) -> OutreachEvent | None:
        obj = await self.get_event(event_id)
        if obj:
            obj.subject = subject
            obj.body = body
            await self._s.flush()
        return obj

    async def count_events(self, status: str | None = None) -> int:
        q = select(func.count()).select_from(OutreachEvent)
        if status is not None:
            q = q.where(OutreachEvent.status == status)
        result = await self._s.execute(q)
        return result.scalar_one()

    async def count_events_in(self, statuses: list[str]) -> int:
        result = await self._s.execute(
            select(func.count())
            .select_from(OutreachEvent)
            .where(OutreachEvent.status.in_(statuses))
        )
        return result.scalar_one()

    async def list_events_in(
        self, statuses: list[str], limit: int = 100, offset: int = 0
    ) -> list[OutreachEvent]:
        result = await self._s.execute(
            select(OutreachEvent)
            .where(OutreachEvent.status.in_(statuses))
            .order_by(OutreachEvent.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(result.scalars().all())

    async def save_reply(
        self, event_id: int, reply_body: str, reply_category: str
    ) -> OutreachEvent | None:
        obj = await self.get_event(event_id)
        if obj:
            obj.reply_body = reply_body
            obj.reply_category = reply_category
            obj.status = OutreachStatus.REPLIED
            await self._s.flush()
        return obj
