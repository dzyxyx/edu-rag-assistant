from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.industry.schemas import (
    AnalyzeResponse,
    CompetencyListResponse,
    MatrixResponse,
    PriorityAreaListResponse,
    PriorityAreaOut,
    PriorityAreaReview,
)
from app.core.dependencies import get_current_user
from app.db.models.user import User
from app.db.repositories.competency import CompetencyRepository
from app.db.repositories.priority_area import PriorityAreaRepository
from app.db.session import get_db

router = APIRouter()


@router.get("/competencies", response_model=CompetencyListResponse)
async def list_competencies(
    source: str | None = Query(None, description="industry | program"),
    category: str | None = Query(None, description="hard_skill | tool | soft_skill | methodology"),
    limit: int = Query(50, le=500),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Список извлечённых компетенций, отсортированных по частоте (FR-1.2)."""
    repo = CompetencyRepository(db)
    items = await repo.list(source=source, category=category, limit=limit)
    return CompetencyListResponse(total=len(items), items=items)


@router.get("/matrix", response_model=MatrixResponse)
async def competency_industry_matrix(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Матрица соответствия компетенций отраслям (FR-1.3)."""
    repo = CompetencyRepository(db)
    rows = await repo.matrix_by_industry()
    return MatrixResponse(total=len(rows), items=rows)


@router.post("/analyze", response_model=AnalyzeResponse)
async def run_analysis(
    batch_size: int = Query(200, le=2000),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Запускает NLP-пайплайн извлечения компетенций (FR-1.2) для необработанных
    вакансий, пересчитывает спрос (demand_score) и формирует/обновляет
    предложения приоритетных областей (FR-1.5).
    """
    # Локальный импорт, чтобы избежать циклических зависимостей с Celery app
    from app.db.repositories.vacancy import VacancyRepository
    from app.services.nlp.competency_extractor import extract_competencies
    from app.services.nlp.priority_areas import generate_priority_area_proposals

    vacancy_repo = VacancyRepository(db)
    competency_repo = CompetencyRepository(db)

    vacancies = await vacancy_repo.list(is_processed=False, limit=batch_size)

    processed = 0
    competencies_found = 0
    for vacancy in vacancies:
        extracted = extract_competencies(f"{vacancy.title or ''}\n{vacancy.description or ''}")
        for item in extracted:
            confidence = min(item["count"] / 3, 1.0)
            competency, _created = await competency_repo.upsert(
                name=item["name"], category=item["category"], source="industry"
            )
            await competency_repo.link_vacancy(
                vacancy_id=vacancy.id, competency_id=competency.id, confidence=confidence
            )
            competencies_found += 1
        await vacancy_repo.mark_processed(vacancy.id)
        processed += 1

    await competency_repo.recompute_demand_scores()
    industries = await generate_priority_area_proposals(db)
    await db.commit()

    return AnalyzeResponse(
        processed_vacancies=processed,
        competencies_found=competencies_found,
        priority_area_industries=industries,
    )


@router.get("/priority-areas", response_model=PriorityAreaListResponse)
async def list_priority_areas(
    status: str | None = Query(None, description="proposed | approved | rejected"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Список приоритетных областей (FR-1.5)."""
    repo = PriorityAreaRepository(db)
    items = await repo.list(status=status)
    return PriorityAreaListResponse(total=len(items), items=items)


@router.post("/priority-areas/{area_id}/review", response_model=PriorityAreaOut)
async def review_priority_area(
    area_id: int,
    body: PriorityAreaReview,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Утверждение/отклонение приоритетной области (FR-1.5) — первая точка
    эскалации проекта: автоматически сформированное предложение должно быть
    подтверждено человеком перед использованием в дальнейших спринтах.
    """
    repo = PriorityAreaRepository(db)
    area = await repo.review(
        area_id=area_id,
        status=body.status.value,
        reviewed_by=user.email,
        comment=body.comment,
    )
    if not area:
        raise HTTPException(status_code=404, detail="Priority area not found")
    await db.commit()
    return area
