from datetime import datetime, timezone

from app.core.config import settings
from app.db.models.company import Company

# Ключевые слова для оценки технологического стека
TECH_KEYWORDS = [
    "python", "java", "kotlin", "golang", "rust", "typescript",
    "react", "devops", "kubernetes", "docker", "ci/cd", "agile",
    "scrum", "microservices", "kafka", "postgresql",
]

# Ключевые слова образовательного опыта (для description компании)
EDU_KEYWORDS = [
    "стажировка", "практика", "вуз", "университет", "студент",
    "молодой специалист", "graduate", "intern",
]

# Ключевые слова, указывающие на вакансии для стажёров/junior-специалистов
INTERN_VACANCY_KEYWORDS = [
    "стажер", "стажёр", "стажировка", "интерн", "intern",
    "junior", "джуниор", "практикант", "практика", "trainee",
]

# Вакансия считается "свежей" (актуальной), если опубликована не позднее
# этого числа дней назад — используется в критерии vacancy_activity.
VACANCY_FRESHNESS_DAYS = 90


class CompanyScorer:
    """
    Скоринг компании по 5 критериям (0–1 каждый), итог — взвешенная сумма
    + бонус за совпадение отрасли с приоритетной областью (FR-1.5 <-> FR-2.4).

    Веса:
    - tech_stack        25% — IT-профиль
    - scale             15% — размер компании
    - reputation        20% — активность (есть описание, сайт)
    - edu_experience    15% — опыт работы со студентами (по описанию компании)
    - vacancy_activity  25% — реальные вакансии: объём, доля junior/intern, свежесть
    """

    WEIGHTS = {
        "tech_stack": 0.25,
        "scale": 0.15,
        "reputation": 0.20,
        "edu_experience": 0.15,
        "vacancy_activity": 0.25,
    }

    def score(
        self,
        company: Company,
        vacancies: list | None = None,
        priority_industries: set[str] | None = None,
    ) -> dict:
        """
        Считает итоговый скоринг компании.

        :param vacancies: список вакансий компании (Vacancy) — для критерия
            vacancy_activity (FR-2.3, "скоринг на основе вакансий"). Если не
            передан, критерий оценивается как 0 (нет данных).
        :param priority_industries: множество отраслей (lowercase) из
            утверждённых PriorityArea — для бонуса (FR-1.5 <-> FR-2.4).
        """
        tech = self._score_tech_stack(company)
        scale = self._score_scale(company)
        rep = self._score_reputation(company)
        edu = self._score_edu_experience(company)
        vac = self._score_vacancy_activity(vacancies or [])

        base_total = (
            tech * self.WEIGHTS["tech_stack"]
            + scale * self.WEIGHTS["scale"]
            + rep * self.WEIGHTS["reputation"]
            + edu * self.WEIGHTS["edu_experience"]
            + vac * self.WEIGHTS["vacancy_activity"]
        )

        priority_bonus = self._priority_bonus(company, priority_industries)
        total = min(base_total + priority_bonus, 1.0)

        return {
            "score": round(total, 3),
            "score_tech_stack": round(tech, 3),
            "score_scale": round(scale, 3),
            "score_reputation": round(rep, 3),
            "score_edu_experience": round(edu, 3),
            "score_vacancy_activity": round(vac, 3),
            "priority_bonus": round(priority_bonus, 3),
        }

    def _score_tech_stack(self, company: Company) -> float:
        text = f"{company.description or ''} {company.industry or ''}".lower()
        hits = sum(1 for kw in TECH_KEYWORDS if kw in text)
        return min(hits / 5, 1.0)   # насыщение на 5+ совпадениях

    def _score_scale(self, company: Company) -> float:
        n = company.employee_count
        if not n:
            return 0.2   # нет данных — нейтральный балл
        if n >= 1000:
            return 1.0
        if n >= 500:
            return 0.8
        if n >= 200:
            return 0.6
        if n >= 50:
            return 0.4
        return 0.2

    def _score_reputation(self, company: Company) -> float:
        score = 0.0
        if company.website:
            score += 0.4
        if company.description and len(company.description) > 100:
            score += 0.4
        if company.email or company.phone:
            score += 0.2
        return score

    def _score_edu_experience(self, company: Company) -> float:
        text = f"{company.description or ''}".lower()
        hits = sum(1 for kw in EDU_KEYWORDS if kw in text)
        return min(hits / 3, 1.0)

    def _score_vacancy_activity(self, vacancies: list) -> float:
        """
        Критерий на основе реальных вакансий компании (FR-2.3):
        - volume (40%) — объём публикаций (насыщение на 5+ вакансиях)
        - intern_ratio (40%) — доля вакансий для стажёров/junior
        - freshness (20%) — доля вакансий, опубликованных за последние
          VACANCY_FRESHNESS_DAYS дней (актуальность найма)

        Если у компании нет загруженных вакансий — возвращает 0.0
        (нет данных для оценки активности найма).
        """
        if not vacancies:
            return 0.0

        now = datetime.now(timezone.utc)
        count = len(vacancies)
        volume = min(count / 5, 1.0)

        intern_count = 0
        fresh_count = 0
        for v in vacancies:
            text = f"{getattr(v, 'title', '') or ''} {getattr(v, 'description', '') or ''}".lower()
            if any(kw in text for kw in INTERN_VACANCY_KEYWORDS):
                intern_count += 1

            created_at = getattr(v, "created_at", None)
            if created_at is not None:
                if created_at.tzinfo is None:
                    created_at = created_at.replace(tzinfo=timezone.utc)
                if (now - created_at).days <= VACANCY_FRESHNESS_DAYS:
                    fresh_count += 1

        intern_ratio = intern_count / count
        fresh_ratio = fresh_count / count

        return volume * 0.4 + intern_ratio * 0.4 + fresh_ratio * 0.2

    def _priority_bonus(self, company: Company, priority_industries: set[str] | None) -> float:
        """
        Небольшой бонус к итоговому score, если industry компании совпадает
        (или пересекается) с отраслью утверждённой приоритетной области
        (PriorityArea.status == approved), см. FR-1.5.
        """
        if not priority_industries or not company.industry:
            return 0.0

        company_industry = company.industry.strip().lower()
        if not company_industry:
            return 0.0

        for industry in priority_industries:
            industry = (industry or "").strip().lower()
            if not industry:
                continue
            if industry in company_industry or company_industry in industry:
                return settings.PRIORITY_AREA_SCORE_BONUS

        return 0.0
