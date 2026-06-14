import logging

from fastapi import APIRouter, Depends, HTTPException  # noqa: F401 (sync fix)
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.communications.schemas import (
    CommunicationGenerateRequest,
    CommunicationGenerateResponse,
    CommunicationTypeOut,
    CommunicationTypesResponse,
)
from app.core.dependencies import get_current_active_user
from app.db.models.user import User
from app.db.repositories.company import CompanyRepository
from app.db.session import get_db
from app.services.communications.generator import (
    COMMUNICATION_DESCRIPTIONS,
    CommunicationType,
    generate_communication,
)
from app.services.memory.memory_service import MemoryService, format_memories

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/types", response_model=CommunicationTypesResponse)
async def list_communication_types():
    """Список доступных типов коммуникаций (FR-5.1)."""
    items = [
        CommunicationTypeOut(
            type=str(t),
            description=desc,
            requires_company=t != CommunicationType.NOTIFICATION,
        )
        for t, desc in COMMUNICATION_DESCRIPTIONS.items()
    ]
    return CommunicationTypesResponse(items=items)


@router.post("/generate", response_model=CommunicationGenerateResponse)
async def generate(
    body: CommunicationGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Сгенерировать текст коммуникации произвольного типа (FR-5.*).

    Для всех типов, кроме 'notification', обязателен company_id.
    Если use_memory=true — подмешивается контекст из долгосрочной памяти
    агента по этой компании (FR-6.3).
    """
    company = None
    if body.type != CommunicationType.NOTIFICATION:
        if body.company_id is None:
            raise HTTPException(status_code=422, detail="company_id обязателен для этого типа коммуникации")
        company_repo = CompanyRepository(db)
        company = await company_repo.get_by_id(body.company_id)
        if not company:
            raise HTTPException(status_code=404, detail="Компания не найдена")

    memory_context = ""
    memory_used_count = 0
    if body.use_memory and company is not None:
        memory_service = MemoryService(db)
        memories = await memory_service.retrieve_relevant(
            f"{body.type} {company.name}", company_id=company.id, top_k=3
        )
        memory_context = format_memories(memories)
        memory_used_count = len(memories)

    extra = {
        "previous_subject": body.previous_subject or "",
        "follow_up_number": body.follow_up_number,
        "reason": body.reason,
        "project_name": body.project_name,
        "project_description": body.project_description,
        "recipient_role": body.recipient_role,
        "message": body.message,
    }
    # убираем None, чтобы не перетирать дефолты в generate_communication
    extra = {k: v for k, v in extra.items() if v is not None}

    try:
        subject, text = await generate_communication(
            body.type,
            company=company,
            tone=body.tone,
            memory_context=memory_context,
            **extra,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception:
        logger.exception("communications.generate: ошибка генерации type=%s", body.type)
        raise HTTPException(status_code=503, detail="Сервис генерации текста недоступен")

    return CommunicationGenerateResponse(
        type=body.type,
        company_id=company.id if company else None,
        tone=body.tone,
        subject=subject,
        body=text,
        memory_used_count=memory_used_count,
    )
