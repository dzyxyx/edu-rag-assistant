from fastapi import APIRouter

from app.api.v1.auth.router import router as auth_router
from app.api.v1.communications.router import router as communications_router
from app.api.v1.companies.router import router as companies_router
from app.api.v1.dashboard.router import router as dashboard_router
from app.api.v1.health.router import router as health_router
from app.api.v1.industry.router import router as industry_router
from app.api.v1.memory.router import router as memory_router
from app.api.v1.outreach.router import router as outreach_router
from app.api.v1.projects.router import router as projects_router
from app.api.v1.rag.router import router as rag_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["Auth"])
api_router.include_router(health_router, prefix="/health", tags=["Health"])
api_router.include_router(industry_router, prefix="/industry", tags=["Industry Analysis"])
api_router.include_router(companies_router, prefix="/companies", tags=["Companies & Scoring"])
api_router.include_router(communications_router, prefix="/communications", tags=["Communications"])
api_router.include_router(outreach_router, prefix="/outreach", tags=["Outreach"])
api_router.include_router(projects_router, prefix="/projects", tags=["Projects & TZ"])
api_router.include_router(rag_router, prefix="/rag", tags=["EdAgent RAG"])
api_router.include_router(memory_router, prefix="/memory", tags=["Agent Memory"])
api_router.include_router(dashboard_router, prefix="/dashboard", tags=["Dashboard"])
