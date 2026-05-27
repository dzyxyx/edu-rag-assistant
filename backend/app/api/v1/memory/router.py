from fastapi import APIRouter, Depends

from app.core.dependencies import get_current_user

router = APIRouter()


@router.get("/graph")
async def get_memory_graph(_=Depends(get_current_user)):
    """Stub — будет реализован в Sprint 4 (Agent Memory / LangGraph)."""
    return {
        "nodes": [],
        "edges": [],
    }
