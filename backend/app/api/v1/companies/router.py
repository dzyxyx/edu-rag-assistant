from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.companies.schemas import (
    CompanyCreate,
    CompanyImportRequest,
    CompanyImportResponse,
    CompanyListResponse,
    CompanyOut,
    CompanyScoreHistoryListResponse,
    CompanyStatusUpdate,
    IngestLogListResponse,
)
from app.core.dependencies import get_current_user
from app.core.limiter import limiter, rate_limit_string
from app.db.models.company import CompanyStatus
from app.db.models.ingest_log import IngestLogStatus
from app.db.models.notification import NotificationType
from app.db.repositories.company import CompanyRepository
from app.db.repositories.company_score_history import CompanyScoreHistoryRepository
from app.db.repositories.ingest_log import IngestLogRepository
from app.db.repositories.notification import NotificationRepository
from app.db.session import get_db
from app.services.ingestion.normalization import normalize_company_name
from app.services.scoring.company_scorer import CompanyScorer
from app.services.scoring.scoring_service import check_top20_shortlist_ready, score_company

router = APIRouter()


def _repo(db: AsyncSession = Depends(get_db)) -> CompanyRepository:
    return CompanyRepository(db)


def _ingest_log_repo(db: AsyncSession = Depends(get_db)) -> IngestLogRepository:
    return IngestLogRepository(db)


# ── Sprint 1: ручное добавление / импорт компаний ────────────────────────────
# ВАЖНО: эти статические маршруты должны быть объявлены до GET/{company_id},
# иначе FastAPI попытается распарсить "import"/"ingest-logs" как company_id:int
# и вернёт 422 вместо вызова нужного обработчика.


@router.post("", response_model=CompanyOut, status_code=201)
@limiter.limit(rate_limit_string)
async def create_company(
    request: Request,
    body: CompanyCreate,
    repo: CompanyRepository = Depends(_repo),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """
    Ручное добавление компании (FR-1.1).

    Перед созданием проверяет дубликаты по точному и нормализованному
    названию (FR-1.4) — если похожая компания уже существует, возвращает 409
    с указанием её id, чтобы оператор мог отредактировать существующую
    запись вместо создания дубликата.
    """
    normalized = normalize_company_name(body.name)
    existing = await repo.get_by_name(body.name)
    if not existing and normalized:
        existing = await repo.get_by_normalized_name(normalized)
    if existing:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Компания с похожим названием уже существует "
                f"(id={existing.id}, name={existing.name!r})"
            ),
        )

    data = body.model_dump(exclude_none=True)
    name = data.pop("name")
    company, _ = await repo.upsert_by_name(
        name, **data, source="manual", status=CompanyStatus.RAW
    )

    scorer = CompanyScorer()
    score_result = scorer.score(company)
    score_result.pop("priority_bonus", None)
    await repo.update_scores(company.id, **score_result)

    await db.commit()
    return await repo.get_by_id(company.id)


@router.post("/import", response_model=CompanyImportResponse)
@limiter.limit(rate_limit_string)
async def import_companies(
    request: Request,
    body: CompanyImportRequest,
    repo: CompanyRepository = Depends(_repo),
    log_repo: IngestLogRepository = Depends(_ingest_log_repo),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """
    Массовый импорт компаний (CSV/JSON, FR-1.1).

    Каждая запись проходит нормализацию и дедупликацию через
    `CompanyRepository.upsert_by_name` (FR-1.4): новые компании создаются,
    уже существующие (по точному или нормализованному названию) —
    обновляются. Запуск фиксируется в истории сбора данных (ingest_logs).
    """
    log = await log_repo.start(source="manual_import", trigger="manual")

    scorer = CompanyScorer()
    created_count = 0
    updated_count = 0
    errors_count = 0
    for item in body.items:
        try:
            data = item.model_dump(exclude_none=True)
            name = data.pop("name")
            company, created = await repo.upsert_by_name(
                name, **data, source="manual_import"
            )
            score_result = scorer.score(company)
            score_result.pop("priority_bonus", None)
            await repo.update_scores(company.id, **score_result)
            if created:
                created_count += 1
            else:
                updated_count += 1
        except Exception:
            errors_count += 1

    await log_repo.finish(
        log.id,
        status=IngestLogStatus.SUCCESS if errors_count == 0 else IngestLogStatus.FAILED,
        companies_created=created_count,
        companies_updated=updated_count,
        errors_count=errors_count,
    )

    # Доп. эскалация (S9-7): импорт завершился с ошибками — уведомляем координатора.
    if errors_count > 0:
        notification_repo = NotificationRepository(db)
        await notification_repo.create(
            type=NotificationType.INGEST_ERRORS,
            title="Импорт компаний завершён с ошибками",
            message=(
                f"При импорте компаний (лог #{log.id}) возникло ошибок: {errors_count} "
                f"из {len(body.items)}. Создано: {created_count}, обновлено: {updated_count}."
            ),
            entity_type="ingest_log",
            entity_id=log.id,
            recipient_role="координатор",
        )

    await db.commit()

    return CompanyImportResponse(
        total=len(body.items),
        created=created_count,
        updated=updated_count,
        log_id=log.id,
    )


@router.get("/ingest-logs", response_model=IngestLogListResponse)
async def list_ingest_logs(
    source: str | None = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    log_repo: IngestLogRepository = Depends(_ingest_log_repo),
    _=Depends(get_current_user),
):
    """История запусков сбора данных (HH.ru, ручной импорт) — FR-1.1, мониторинг сбора."""
    items = await log_repo.list(source=source, limit=limit, offset=offset)
    total = await log_repo.count(source=source)
    return IngestLogListResponse(total=total, items=items)


@router.get("", response_model=CompanyListResponse)
async def list_companies(
    status: str | None = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    page: int | None = Query(None, ge=1),  # page=1 → offset=0, page=2 → offset=limit, etc.
    repo: CompanyRepository = Depends(_repo),
    _=Depends(get_current_user),
):
    # Support both ?offset=X and ?page=N (page takes priority if both provided)
    effective_offset = (page - 1) * limit if page is not None else offset
    items = await repo.list(status=status, limit=limit, offset=effective_offset)
    total = await repo.count(status=status)
    return CompanyListResponse(total=total, items=items)


@router.get("/{company_id}", response_model=CompanyOut)
async def get_company(
    company_id: int,
    repo: CompanyRepository = Depends(_repo),
    _=Depends(get_current_user),
):
    company = await repo.get_by_id(company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


@router.patch("/{company_id}/status", response_model=CompanyOut)
async def update_status(
    company_id: int,
    body: CompanyStatusUpdate,
    repo: CompanyRepository = Depends(_repo),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    company = await repo.update_status(company_id, body.status)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    await db.commit()
    return company


@router.post("/{company_id}/score", response_model=CompanyOut)
@limiter.limit(rate_limit_string)
async def rescore_company(
    request: Request,
    company_id: int,
    repo: CompanyRepository = Depends(_repo),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """
    Пересчитать скоринг компании вручную (FR-2.3).

    Учитывает реальные вакансии компании и бонус за совпадение industry
    с утверждённой приоритетной областью (FR-1.5), может автоматически
    перевести компанию в статус "shortlisted" при score >= порога, и
    сохраняет запись в историю скоринга (FR-2.4).
    """
    company = await repo.get_by_id(company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    await score_company(db, company, trigger="manual")
    await check_top20_shortlist_ready(db)
    await db.commit()
    return await repo.get_by_id(company_id)


@router.get("/{company_id}/score-history", response_model=CompanyScoreHistoryListResponse)
async def company_score_history(
    company_id: int,
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    repo: CompanyRepository = Depends(_repo),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """История пересчётов скоринга компании (FR-2.4) — для динамики и объяснения оценки."""
    company = await repo.get_by_id(company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    history_repo = CompanyScoreHistoryRepository(db)
    items = await history_repo.list_by_company(company_id, limit=limit, offset=offset)
    total = await history_repo.count_by_company(company_id)
    return CompanyScoreHistoryListResponse(total=total, items=items)