"""
Формирование предложений приоритетных областей (FR-1.5) на основе
матрицы "компетенция -> отрасль" (FR-1.3) и демонстрационного спроса
(Competency.demand_score).

Каждая приоритетная область — это топ-N компетенций для конкретной отрасли,
агрегированных в одно предложение, которое затем утверждается человеком
через API (первая точка эскалации, см. industry/router.py).
"""
import logging
from collections import defaultdict

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repositories.competency import CompetencyRepository
from app.db.repositories.priority_area import PriorityAreaRepository

logger = logging.getLogger(__name__)

TOP_COMPETENCIES_PER_INDUSTRY = 5


async def generate_priority_area_proposals(session: AsyncSession) -> int:
    """Генерирует/обновляет предложения PriorityArea по отраслям. Возвращает количество."""
    competency_repo = CompetencyRepository(session)
    priority_repo = PriorityAreaRepository(session)

    matrix = await competency_repo.matrix_by_industry()
    if not matrix:
        logger.info("priority_areas: матрица компетенций пуста, нечего предлагать")
        return 0

    # Группируем по отрасли, сортируем компетенции по числу упоминаний
    by_industry: dict[str, list[dict]] = defaultdict(list)
    for row in matrix:
        by_industry[row["industry"]].append(row)

    # Карта name -> Competency для получения id и demand_score
    all_competencies = await competency_repo.list(order_by_demand=False, limit=10_000)
    comp_by_name = {c.name: c for c in all_competencies}

    created = 0
    for industry, rows in by_industry.items():
        top = sorted(rows, key=lambda r: r["mentions"], reverse=True)[:TOP_COMPETENCIES_PER_INDUSTRY]

        competency_ids = []
        scores = []
        names = []
        for row in top:
            comp = comp_by_name.get(row["competency"])
            if not comp:
                continue
            competency_ids.append(comp.id)
            names.append(comp.name)
            if comp.demand_score is not None:
                scores.append(comp.demand_score)

        if not competency_ids:
            continue

        avg_score = round(sum(scores) / len(scores), 2) if scores else None
        name = f"{industry}: {', '.join(names)}"
        description = (
            f"Топ-{len(names)} компетенций по спросу в отрасли «{industry}»: "
            f"{', '.join(names)}."
        )

        _, was_created = await priority_repo.upsert_proposal(
            name=name,
            industry=industry,
            score=avg_score,
            competency_ids=competency_ids,
            description=description,
        )
        created += 1 if was_created else 0

    await session.flush()
    logger.info("priority_areas: сформировано/обновлено предложений: %d отраслей", len(by_industry))
    return len(by_industry)
