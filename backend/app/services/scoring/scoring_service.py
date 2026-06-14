from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models.company import Company, CompanyStatus
from app.db.models.notification import NotificationType
from app.db.models.priority_area import PriorityAreaStatus
from app.db.repositories.company import CompanyRepository
from app.db.repositories.company_score_history import CompanyScoreHistoryRepository
from app.db.repositories.notification import NotificationRepository
from app.db.repositories.priority_area import PriorityAreaRepository
from app.db.repositories.vacancy import VacancyRepository
from app.services.scoring.company_scorer import CompanyScorer

# Sprint 4/9 (S4-7/S9-7): сколько компаний в шортлисте считается "готовым
# Top-20" для уведомления ответственного сотрудника о готовности к отбору.
TOP20_SHORTLIST_THRESHOLD = 20

# Статусы, дальше которых автоматическая смена статуса по результатам
# скоринга не должна "откатывать" компанию назад в пайплайне (FR-2.3).
_STATUSES_BEYOND_SCORING = {
    CompanyStatus.SHORTLISTED,
    CompanyStatus.APPROVED,
    CompanyStatus.CONTACTED,
    CompanyStatus.INTERESTED,
    CompanyStatus.PARTNER,
    CompanyStatus.REJECTED,
}


async def score_company(
    session: AsyncSession,
    company: Company,
    trigger: str = "manual",
) -> dict:
    """
    Пересчитывает скоринг компании (FR-2.3):
    - учитывает реальные вакансии компании (объём, доля junior/intern, свежесть);
    - добавляет бонус за совпадение industry с утверждённой PriorityArea (FR-1.5);
    - автоматически переводит компанию в статус "shortlisted", если итоговый
      score >= settings.AUTO_SHORTLIST_SCORE_THRESHOLD (и текущий статус ещё
      не ушёл дальше по пайплайну);
    - сохраняет запись в историю скоринга (CompanyScoreHistory, FR-2.4).

    Возвращает словарь с разбивкой скоринга (см. CompanyScorer.score()).
    """
    scorer = CompanyScorer()
    vacancy_repo = VacancyRepository(session)
    priority_repo = PriorityAreaRepository(session)
    company_repo = CompanyRepository(session)
    history_repo = CompanyScoreHistoryRepository(session)

    vacancies = await vacancy_repo.list(company_id=company.id, limit=200)
    approved_areas = await priority_repo.list(status=PriorityAreaStatus.APPROVED, limit=200)
    priority_industries = {a.industry for a in approved_areas if a.industry}

    result = scorer.score(company, vacancies=vacancies, priority_industries=priority_industries)

    new_status = None
    if company.status not in _STATUSES_BEYOND_SCORING:
        if result["score"] >= settings.AUTO_SHORTLIST_SCORE_THRESHOLD:
            new_status = CompanyStatus.SHORTLISTED
        else:
            new_status = CompanyStatus.SCORED

    await company_repo.update_scores(
        company.id,
        score=result["score"],
        score_tech_stack=result["score_tech_stack"],
        score_scale=result["score_scale"],
        score_reputation=result["score_reputation"],
        score_edu_experience=result["score_edu_experience"],
        score_vacancy_activity=result["score_vacancy_activity"],
        new_status=new_status,
    )

    await history_repo.add(
        company_id=company.id,
        score=result["score"],
        score_tech_stack=result["score_tech_stack"],
        score_scale=result["score_scale"],
        score_reputation=result["score_reputation"],
        score_edu_experience=result["score_edu_experience"],
        score_vacancy_activity=result["score_vacancy_activity"],
        priority_bonus=result["priority_bonus"],
        trigger=trigger,
    )

    return result


async def check_top20_shortlist_ready(session: AsyncSession) -> bool:
    """
    Проверяет, набралось ли в шортлисте (FR-2.5) достаточно компаний
    (``TOP20_SHORTLIST_THRESHOLD``), и при необходимости создаёт внутреннее
    уведомление координатору о готовности к отбору Top-20 (S4-7/S9-7).

    Чтобы не спамить, уведомление этого типа создаётся не чаще, чем раз в
    24 часа (см. ``NotificationRepository.exists_recent``).

    Возвращает ``True``, если уведомление было создано.
    """
    company_repo = CompanyRepository(session)
    shortlisted_count = await company_repo.count(status=CompanyStatus.SHORTLISTED)

    if shortlisted_count < TOP20_SHORTLIST_THRESHOLD:
        return False

    notification_repo = NotificationRepository(session)
    if await notification_repo.exists_recent(NotificationType.SHORTLIST_TOP20_READY, hours=24):
        return False

    await notification_repo.create(
        type=NotificationType.SHORTLIST_TOP20_READY,
        title="Шортлист готов к отбору Top-20",
        message=(
            f"В шортлисте уже {shortlisted_count} компаний (порог "
            f"{TOP20_SHORTLIST_THRESHOLD}) — можно переходить к отбору Top-20 "
            f"для дальнейшей работы (FR-2.5)."
        ),
        entity_type="company",
        recipient_role="координатор",
    )
    return True
