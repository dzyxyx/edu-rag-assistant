import asyncio
import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy import select

from app.workers.celery_app import celery_app
from app.db.session import AsyncSessionFactory
from app.db.models.notification import NotificationType
from app.db.models.outreach import OutreachEvent, OutreachStatus
from app.db.repositories.company import CompanyRepository
from app.db.repositories.notification import NotificationRepository
from app.db.repositories.outreach import OutreachRepository
from app.services.outreach.generator import generate_email
from app.services.outreach.touch_plan import is_plan_exhausted, next_touch_after_days, max_follow_ups

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
    """
    Реализация плана касаний (FR-3.6, OUTREACH_TOUCH_PLAN_DAYS): для каждого
    отправленного письма без ответа, у которого подошёл срок следующего
    касания, создаёт черновик follow-up'а. Если план касаний исчерпан
    (follow_up_number достиг максимума) — переводит событие в ESCALATED и
    создаёт уведомление координатору (human-in-the-loop, FR-4.6).
    """
    async with AsyncSessionFactory() as session:
        outreach_repo = OutreachRepository(session)
        company_repo = CompanyRepository(session)
        notification_repo = NotificationRepository(session)

        now = datetime.now(timezone.utc)

        result = await session.execute(
            select(OutreachEvent).where(
                OutreachEvent.status == OutreachStatus.SENT,
                OutreachEvent.next_follow_up_after_days.is_not(None),
                OutreachEvent.follow_up_number < max_follow_ups(),
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

            new_follow_up_number = event.follow_up_number + 1

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
                    follow_up_number=new_follow_up_number,
                    next_follow_up_after_days=next_touch_after_days(new_follow_up_number),
                )
                session.add(follow_up)
                logger.info(
                    "Follow-up создан: campaign=%s company=%s #%s",
                    event.campaign_id, event.company_id, follow_up.follow_up_number,
                )

                # FR-3.6/FR-4.6: план касаний исчерпан — эскалируем на человека.
                if is_plan_exhausted(new_follow_up_number):
                    await outreach_repo.update_status(
                        event.id, OutreachStatus.ESCALATED, next_follow_up_after_days=None
                    )
                    await notification_repo.create(
                        type=NotificationType.GENERAL,
                        title="Компания не отвечает — требуется решение",
                        message=(
                            f"Компания «{company.name}» не ответила после "
                            f"{new_follow_up_number} follow-up(ов). План касаний "
                            f"исчерпан, письмо передано на ручную обработку (FR-4.6)."
                        ),
                        entity_type="outreach_event",
                        entity_id=event.id,
                        recipient_role="менеджер по партнёрствам",
                    )
            except Exception as exc:
                logger.exception("Follow-up error company=%s: %s", event.company_id, exc)

        await session.commit()
