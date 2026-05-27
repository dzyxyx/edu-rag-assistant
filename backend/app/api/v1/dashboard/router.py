from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user

router = APIRouter()


@router.get("/stats")
async def get_dashboard_stats(_=Depends(get_current_user)):
    """Stub — будет реализован в Sprint 3 (Dashboard)."""
    return {
        "companies_total": 0,
        "companies_shortlisted": 0,
        "companies_partners": 0,
        "outreach_sent": 0,
        "outreach_replied": 0,
        "students_active": 0,
    }
