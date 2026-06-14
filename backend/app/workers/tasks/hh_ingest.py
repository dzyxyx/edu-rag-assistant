import asyncio
import logging

from app.core.config import settings
from app.db.models.ingest_log import IngestLogStatus
from app.db.session import AsyncSessionFactory
from app.db.repositories.company import CompanyRepository
from app.db.repositories.ingest_log import IngestLogRepository
from app.db.repositories.vacancy import VacancyRepository
from app.integrations.hh.client import HHClient, get_cached_application_token
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
def run_hh_ingest(self, trigger: str = "scheduled"):
    """Celery-задача: собирает компании с HH.ru и сохраняет в БД."""
    try:
        asyncio.run(_ingest(trigger=trigger))
    except Exception as exc:
        logger.exception("hh_ingest failed: %s", exc)
        raise self.retry(exc=exc, countdown=60 * 10)


async def _ingest(trigger: str = "scheduled"):
    access_token = settings.HH_ACCESS_TOKEN or None

    # Если прямого токена нет, но есть client_id/secret — получаем
    # application-токен через OAuth2 client_credentials.
    if not access_token and settings.HH_CLIENT_ID and settings.HH_CLIENT_SECRET:
        access_token = await get_cached_application_token(
            client_id=settings.HH_CLIENT_ID,
            client_secret=settings.HH_CLIENT_SECRET,
        )

    scorer = CompanyScorer()

    async with AsyncSessionFactory() as session:
        log_repo = IngestLogRepository(session)
        log = await log_repo.start(source="hh", trigger=trigger)
        await session.commit()

    try:
        async with HHClient(access_token=access_token) as hh:
            employers, vacancies = await hh.collect(keywords=HH_KEYWORDS)
    except Exception as exc:
        async with AsyncSessionFactory() as session:
            log_repo = IngestLogRepository(session)
            await log_repo.finish(
                log.id, status=IngestLogStatus.FAILED, errors_count=1, error_message=str(exc)
            )
            await session.commit()
        raise

    async with AsyncSessionFactory() as session:
        company_repo = CompanyRepository(session)
        vacancy_repo = VacancyRepository(session)
        log_repo = IngestLogRepository(session)

        # employer (HH id) -> company.id, нужно для привязки вакансий к компаниям
        employer_to_company: dict[str, int] = {}

        saved = 0
        created_count = 0
        for emp in employers:
            industry = ", ".join(i.get("name", "") for i in emp.industries[:3])
            if len(industry) > 255:
                industry = industry[:252] + "..."

            company, created = await company_repo.upsert_by_name(
                name=emp.name,
                website=emp.site_url,
                description=emp.description,
                region=emp.area.get("name") if emp.area else None,
                industry=industry,
                employee_count=emp.employee_count,
                source="hh",
            )
            employer_to_company[emp.id] = company.id
            if created:
                created_count += 1

            # Скоринг (без вакансий и приоритетных областей на этапе ingest —
            # полный пересчёт выполняется позже через scoring_service)
            score_result = scorer.score(company)
            score_result.pop("priority_bonus", None)
            await company_repo.update_scores(company.id, **score_result)
            saved += 1

        # Сохраняем вакансии — они нужны для NLP-пайплайна извлечения компетенций (Спринт 2)
        vac_saved = 0
        vac_created = 0
        for vac in vacancies:
            snippet = vac.snippet or {}
            description = vac.description or "\n".join(
                filter(None, [snippet.get("requirement"), snippet.get("responsibility")])
            )

            salary = vac.salary or {}
            experience = (vac.experience or {}).get("name")
            employment = (vac.employment or {}).get("name")
            region = (vac.area or {}).get("name")

            _, vac_created_flag = await vacancy_repo.upsert_by_external_id(
                external_id=vac.id,
                source="hh",
                title=vac.name,
                description=description,
                company_name=vac.employer.name,
                company_id=employer_to_company.get(vac.employer.id),
                salary_from=salary.get("from"),
                salary_to=salary.get("to"),
                salary_currency=salary.get("currency"),
                experience_required=experience,
                employment_type=employment,
                region=region,
                url=vac.alternate_url,
            )
            vac_saved += 1
            if vac_created_flag:
                vac_created += 1

        await log_repo.finish(
            log.id,
            status=IngestLogStatus.SUCCESS,
            companies_created=created_count,
            companies_updated=saved - created_count,
            vacancies_created=vac_created,
            vacancies_updated=vac_saved - vac_created,
        )

        await session.commit()
        logger.info("hh_ingest: upserted %d companies, %d vacancies", saved, vac_saved)