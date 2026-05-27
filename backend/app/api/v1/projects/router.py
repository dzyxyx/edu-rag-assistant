from fastapi import APIRouter, Depends, HTTPException

from app.core.dependencies import get_current_user

router = APIRouter()


@router.get("")
async def list_projects(_=Depends(get_current_user)):
    """Stub — будет реализован в Sprint 3 (Projects & TZ)."""
    return {
        "items": [],
        "total": 0,
    }


@router.get("/{project_id}")
async def get_project(project_id: int, _=Depends(get_current_user)):
    """Stub — будет реализован в Sprint 3."""
    raise HTTPException(status_code=404, detail="Project not found")
