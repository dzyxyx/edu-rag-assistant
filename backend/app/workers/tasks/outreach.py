import asyncio
import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy import select

from app.workers.celery_app import celery_app
from app.db.session import AsyncSessionFactory
from app.db.models.outreach import OutreachEvent, OutreachStatus
from app.db.repositories.company import CompanyRepository
from app.db.repositories.outreach import OutreachRepository
from app.services.outreach.generator import generate_email

logger = logging.getLogger(__name__)


@celery_app.task(
    name="app.workers.tasks.outreach.generate_emails_task",
    bind=True,
    max_retries=2,
)
def generate_emails_task(self, campaign_id: int, company_ids: list[int], tone: str = "formal"):
    """Фоновая генерация черновиков писем для списка компаний."""
    asyncio.run(_generate_emails(campaign_id, company_ids, tone))


async def _generate_emails(campaign_id: int, company_ids: list[int], tone: str):
    async with AsyncSessionFactory() as session:
        outreach_repo = OutreachRepository(session)
        company_repo = CompanyRepository(session)

        for company_id in company_ids:
            company = await company_repo.get_by_id(company_id)
            if not company:
                continue
            try:
                subject, body = await generate_email(company, tone=tone)
                await outreach_repo.create_event(
                    campaign_id=campaign_id,
                    company_id=company_id,
                    subject=subject,
                    body=body,
                    tone=tone,
                )
                logger.info("Черновик создан: campaign=%s company=%s", campaign_id, company_id)
            except Exception as exc:
                logger.exception("Ошибка генерации для company=%s: %s", company_id, exc)

        await session.commit()


@celery_app.task(name="app.workers.tasks.outreach.check_follow_ups")
def check_follow_ups():
    """
    Beat-задача: каждые 12 часов проверяет письма со статусом SENT,
    у которых истёк срок follow-up, и создаёт новое касание.
    """
    asyncio.run(_check_follow_ups())


async def _check_follow_ups():
    async with AsyncSessionFactory() as session:
        outreach_repo = OutreachRepository(session)
        company_repo = CompanyRepository(session)

        now = datetime.now(timezone.utc)

        result = await session.execute(
            select(OutreachEvent).where(
                OutreachEvent.status == OutreachStatus.SENT,
                OutreachEvent.next_follow_up_after_days.is_not(None),
                OutreachEvent.follow_up_number < 2,  # максимум 2 follow-up
            )
        )
        events = result.scalars().all()

        for event in events:
            due = event.updated_at + timedelta(days=event.next_follow_up_after_days)
            if due.replace(tzinfo=timezone.utc) > now:
                continue  # ещё не пора

            company = await company_repo.get_by_id(event.company_id)
            if not company:
                continue

            try:
                subject, body = await generate_email(company, tone=event.tone or "formal")
                follow_up = OutreachEvent(
                    campaign_id=event.campaign_id,
                    company_id=event.company_id,
                    channel="email",
                    status=OutreachStatus.DRAFT,
                    subject=f"Re: {subject}",
                    body=body,
                    tone=event.tone,
                    follow_up_number=event.follow_up_number + 1,
                    next_follow_up_after_days=14,
                )
                session.add(follow_up)
                logger.info(
                    "Follow-up создан: campaign=%s company=%s #%s",
                    event.campaign_id, event.company_id, follow_up.follow_up_number,
                )
            except Exception as exc:
                logger.exception("Follow-up error company=%s: %s", event.company_id, exc)

        await session.commit()
