from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.companies.schemas import CompanyListResponse, CompanyOut, CompanyStatusUpdate
from app.core.dependencies import get_current_user
from app.db.repositories.company import CompanyRepository
from app.db.session import get_db
from app.services.scoring.company_scorer import CompanyScorer

router = APIRouter()


def _repo(db: AsyncSession = Depends(get_db)) -> CompanyRepository:
    return CompanyRepository(db)


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
    return CompanyListResponse(total=len(items), items=items)


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
async def rescore_company(
    company_id: int,
    repo: CompanyRepository = Depends(_repo),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """Пересчитать скоринг компании вручную."""
    company = await repo.get_by_id(company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    scorer = CompanyScorer()
    scores = scorer.score(company)
    await repo.update_scores(company.id, **scores)
    await db.commit()
    return await repo.get_by_id(company_id)