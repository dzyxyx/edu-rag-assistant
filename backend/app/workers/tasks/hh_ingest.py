import asyncio
import logging

from app.core.config import settings
from app.db.session import AsyncSessionFactory
from app.db.repositories.company import CompanyRepository
from app.integrations.hh.client import HHClient
from app.services.scoring.company_scorer import CompanyScorer
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)

# Ключевые слова для поиска IT/Agile компаний в регионе
HH_KEYWORDS = [
    "Agile",
    "Scrum",
    "DevOps",
    "Python разработчик",
    "Software Engineer",
    "IT директор",
]


@celery_app.task(name="app.workers.tasks.hh_ingest.run_hh_ingest", bind=True, max_retries=3)
def run_hh_ingest(self):
    """Celery-задача: собирает компании с HH.ru и сохраняет в БД."""
    try:
        asyncio.run(_ingest())
    except Exception as exc:
        logger.exception("hh_ingest failed: %s", exc)
        raise self.retry(exc=exc, countdown=60 * 10)


async def _ingest():
    access_token = settings.HH_ACCESS_TOKEN or None
    scorer = CompanyScorer()

    async with HHClient(access_token=access_token) as hh:
        employers = await hh.collect_companies(keywords=HH_KEYWORDS)

    async with AsyncSessionFactory() as session:
        company_repo = CompanyRepository(session)

        saved = 0
        for emp in employers:
            company, created = await company_repo.upsert_by_name(
                name=emp.name,
                website=emp.site_url,
                description=emp.description,
                region=emp.area.get("name") if emp.area else None,
                industry=", ".join(i.get("name", "") for i in emp.industries[:3]),
                employee_count=emp.employee_count,
                source="hh",
            )

            # Скоринг
            score_result = scorer.score(company)
            await company_repo.update_scores(company.id, **score_result)
            saved += 1

        await session.commit()
        logger.info("hh_ingest: upserted %d companies", saved)