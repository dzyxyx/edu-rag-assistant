import asyncio
import logging

from app.db.models.company import CompanyStatus
from app.db.repositories.company import CompanyRepository
from app.db.session import AsyncSessionFactory
from app.services.scoring.scoring_service import check_top20_shortlist_ready, score_company
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)

# Статусы компаний, для которых имеет смысл периодически пересчитывать
# скоринг — после "approved"/"contacted" и далее по пайплайну скоринг уже
# не используется для принятия решений и пересчёт только создавал бы шум
# в истории (FR-2.4).
_RESCORE_STATUSES = [CompanyStatus.RAW, CompanyStatus.SCORED, CompanyStatus.SHORTLISTED]


@celery_app.task(name="app.workers.tasks.scoring.run_scoring_recompute", bind=True, max_retries=3)
def run_scoring_recompute(self, batch_size: int = 500):
    """Celery-задача: периодический пересчёт скоринга компаний (FR-2.3/FR-2.4)."""
    try:
        return asyncio.run(_recompute(batch_size=batch_size))
    except Exception as exc:
        logger.exception("scoring recompute failed: %s", exc)
        raise self.retry(exc=exc, countdown=60 * 5)


async def _recompute(batch_size: int = 500) -> dict:
    async with AsyncSessionFactory() as session:
        repo = CompanyRepository(session)

        rescored = 0
        shortlisted = 0

        companies = await repo.list_by_statuses(_RESCORE_STATUSES, limit=batch_size)
        for company in companies:
            result = await score_company(session, company, trigger="scheduled")
            rescored += 1
            if result["score"] >= 0.7:
                shortlisted += 1

        top20_notified = await check_top20_shortlist_ready(session)

        await session.commit()

        logger.info("scoring recompute: пересчитано компаний=%d", rescored)
        return {
            "rescored": rescored,
            "shortlisted_candidates": shortlisted,
            "top20_notified": top20_notified,
        }
