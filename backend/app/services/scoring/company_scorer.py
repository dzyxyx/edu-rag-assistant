from app.db.models.company import Company

# Ключевые слова для оценки технологического стека
TECH_KEYWORDS = [
    "python", "java", "kotlin", "golang", "rust", "typescript",
    "react", "devops", "kubernetes", "docker", "ci/cd", "agile",
    "scrum", "microservices", "kafka", "postgresql",
]

# Ключевые слова образовательного опыта
EDU_KEYWORDS = [
    "стажировка", "практика", "вуз", "университет", "студент",
    "молодой специалист", "graduate", "intern",
]


class CompanyScorer:
    """
    Скоринг компании по 4 критериям (0–1 каждый), итог — взвешенная сумма.

    Веса:
    - tech_stack        30% — IT-профиль
    - scale             25% — размер компании
    - reputation        25% — активность (есть описание, сайт)
    - edu_experience    20% — опыт работы со студентами
    """

    WEIGHTS = {
        "tech_stack": 0.30,
        "scale": 0.25,
        "reputation": 0.25,
        "edu_experience": 0.20,
    }

    def score(self, company: Company) -> dict:
        tech = self._score_tech_stack(company)
        scale = self._score_scale(company)
        rep = self._score_reputation(company)
        edu = self._score_edu_experience(company)

        total = (
            tech * self.WEIGHTS["tech_stack"]
            + scale * self.WEIGHTS["scale"]
            + rep * self.WEIGHTS["reputation"]
            + edu * self.WEIGHTS["edu_experience"]
        )

        return {
            "score": round(total, 3),
            "score_tech_stack": round(tech, 3),
            "score_scale": round(scale, 3),
            "score_reputation": round(rep, 3),
            "score_edu_experience": round(edu, 3),
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