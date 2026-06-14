"""
Связка RAG-чата (Спринт 3) с аналитикой рынка труда из Спринта 2
(CompetencyRepository.demand_score, PriorityAreaRepository).

Если вопрос студента касается рынка труда/востребованных навыков, в контекст
RAG-цепочки подмешивается короткая сводка: топ компетенций по спросу и
утверждённые приоритетные направления (FR-1.5).
"""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repositories.competency import CompetencyRepository
from app.db.repositories.priority_area import PriorityAreaRepository
from app.db.models.priority_area import PriorityAreaStatus

# Ключевые слова-триггеры: при их наличии в вопросе подмешиваем аналитику рынка
MARKET_KEYWORDS = (
    "вакан", "рынок", "востреб", "спрос", "работодател", "найм",
    "карьер", "профессия", "специальност", "трудоустрой", "стажир",
    "навык", "компетенц", "приоритет", "отрасл", "индустри",
    "skill", "demand", "job", "career",
)


def is_market_question(question: str) -> bool:
    """Эвристика: стоит ли подмешивать аналитику рынка труда в контекст."""
    q = question.lower()
    return any(kw in q for kw in MARKET_KEYWORDS)


async def build_market_context(session: AsyncSession, top_n: int = 10) -> str:
    """
    Формирует текстовый блок с аналитикой рынка труда:
    - топ-N компетенций по demand_score (FR-1.2/FR-1.4)
    - утверждённые приоритетные направления (FR-1.5)

    Возвращает пустую строку, если данных нет.
    """
    competency_repo = CompetencyRepository(session)
    priority_repo = PriorityAreaRepository(session)

    competencies = await competency_repo.list(order_by_demand=False, limit=10_000)
    top_competencies = sorted(
        (c for c in competencies if c.demand_score is not None and c.demand_score > 0),
        key=lambda c: c.demand_score,
        reverse=True,
    )[:top_n]

    areas = await priority_repo.list(status=PriorityAreaStatus.APPROVED, limit=top_n)

    if not top_competencies and not areas:
        return ""

    lines: list[str] = []
    if top_competencies:
        lines.append("Топ компетенций по текущему спросу на рынке труда (по данным анализа вакансий):")
        for c in top_competencies:
            lines.append(f"- {c.name} (спрос: {c.demand_score})")

    if areas:
        if lines:
            lines.append("")
        lines.append("Утверждённые приоритетные направления развития:")
        for a in areas:
            lines.append(f"- {a.name} (score={a.score})")

    return "\n".join(lines)
