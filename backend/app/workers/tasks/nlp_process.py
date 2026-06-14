import asyncio
import logging

from app.db.session import AsyncSessionFactory
from app.db.repositories.competency import CompetencyRepository
from app.db.repositories.vacancy import VacancyRepository
from app.services.nlp.competency_extractor import extract_competencies
from app.services.nlp.priority_areas import generate_priority_area_proposals
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.workers.tasks.nlp_process.run_nlp_process", bind=True, max_retries=3)
def run_nlp_process(self, batch_size: int = 200):
    """Celery-задача: извлекает компетенции (FR-1.2) из необработанных вакансий."""
    try:
        return asyncio.run(_process(batch_size=batch_size))
    except Exception as exc:
        logger.exception("nlp_process failed: %s", exc)
        raise self.retry(exc=exc, countdown=60 * 5)


async def _process(batch_size: int = 200) -> dict:
    async with AsyncSessionFactory() as session:
        vacancy_repo = VacancyRepository(session)
        competency_repo = CompetencyRepository(session)

        vacancies = await vacancy_repo.list(is_processed=False, limit=batch_size)

        processed = 0
        competencies_found = 0

        for vacancy in vacancies:
            extracted = extract_competencies(
                f"{vacancy.title or ''}\n{vacancy.description or ''}"
            )

            for item in extracted:
                # confidence — нормализованная "уверенность" на основе количества
                # упоминаний компетенции в тексте вакансии
                confidence = min(item["count"] / 3, 1.0)

                competency, _ = await competency_repo.upsert(
                    name=item["name"],
                    category=item["category"],
                    source="industry",
                )
                await competency_repo.link_vacancy(
                    vacancy_id=vacancy.id,
                    competency_id=competency.id,
                    confidence=confidence,
                )
                competencies_found += 1

            await vacancy_repo.mark_processed(vacancy.id)
            processed += 1

        await competency_repo.recompute_demand_scores()
        areas = await generate_priority_area_proposals(session)
        await session.commit()

        logger.info(
            "nlp_process: обработано вакансий=%d, найдено компетенций=%d",
            processed, competencies_found,
        )
        return {
            "processed_vacancies": processed,
            "competencies_found": competencies_found,
            "priority_area_industries": areas,
        }
