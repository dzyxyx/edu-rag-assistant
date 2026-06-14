import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.outreach.schemas import (
    CampaignCreate, CampaignOut,
    EventContentUpdate, EventOut,
    GenerateRequest, GenerateResponse,
)
from app.core.dependencies import get_current_user
from app.db.models.notification import NotificationType
from app.db.models.outreach import OutreachStatus
from app.db.models.user import User
from app.db.repositories.company import CompanyRepository
from app.db.repositories.notification import NotificationRepository
from app.db.repositories.outreach import OutreachRepository
from app.db.session import get_db
from app.services.memory.audit import log_action
from app.services.memory.memory_service import MemoryService
from app.services.outreach.memory_graph import run_outreach_graph
from app.services.outreach.sender import send_email
from app.services.outreach.touch_plan import next_touch_after_days

logger = logging.getLogger(__name__)
router = APIRouter()


def _repo(db: AsyncSession = Depends(get_db)) -> OutreachRepository:
    return OutreachRepository(db)


def _company_repo(db: AsyncSession = Depends(get_db)) -> CompanyRepository:
    return CompanyRepository(db)


# ── Campaigns ──────────────────────────────────────────────────────────────────

@router.post("/campaigns", response_model=CampaignOut)
async def create_campaign(
    body: CampaignCreate,
    repo: OutreachRepository = Depends(_repo),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    campaign = await repo.create_campaign(
        name=body.name,
        description=body.description,
        created_by_id=current_user.id,
    )
    await db.commit()
    await db.refresh(campaign)
    return campaign


@router.get("/campaigns", response_model=dict)
async def list_campaigns(
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    repo: OutreachRepository = Depends(_repo),
    _=Depends(get_current_user),
):
    items = await repo.list_campaigns(limit=limit, offset=offset)
    return {"items": [CampaignOut.model_validate(c) for c in items], "total": len(items)}


@router.get("/campaigns/{campaign_id}", response_model=CampaignOut)
async def get_campaign(
    campaign_id: int,
    repo: OutreachRepository = Depends(_repo),
    _=Depends(get_current_user),
):
    campaign = await repo.get_campaign(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


# ── Generate drafts ────────────────────────────────────────────────────────────

@router.post("/campaigns/{campaign_id}/generate", response_model=GenerateResponse)
async def generate_drafts(
    campaign_id: int,
    body: GenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Генерирует черновики писем для указанных компаний.
    Статус каждого письма — DRAFT, требует утверждения человеком (FR-3.5).
    """
    outreach_repo = OutreachRepository(db)
    company_repo = CompanyRepository(db)

    campaign = await outreach_repo.get_campaign(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    generated = 0
    failed = 0

    memory_service = MemoryService(db)

    for company_id in body.company_ids:
        company = await company_repo.get_by_id(company_id)
        if not company:
            logger.warning("generate_drafts: company %s not found, skip", company_id)
            failed += 1
            continue
        try:
            # FR-6.3: граф retrieve_memory -> generate_email -> score_confidence -> approve/escalate
            result = await run_outreach_graph(db, company, tone=body.tone)

            event = await outreach_repo.create_event(
                campaign_id=campaign_id,
                company_id=company_id,
                subject=result["subject"],
                body=result["body"],
                tone=body.tone,
                status=result["status"],
                confidence_score=result["confidence"],
                memory_used_count=len(result.get("memories", [])),
            )

            await memory_service.save_memory(
                memory_type="interaction",
                phase="phase_3",
                company_id=company_id,
                content=f"Сгенерировано письмо для {company.name} (тон: {body.tone}).\n"
                        f"Тема: {result['subject']}",
                summary=f"Outreach draft для {company.name}, confidence={result['confidence']:.2f}",
            )
            await log_action(
                db,
                actor="agent",
                action="outreach.draft_generated",
                phase="phase_3",
                entity_type="outreach_event",
                entity_id=event.id,
                details={
                    "company_id": company_id,
                    "confidence": result["confidence"],
                    "status": str(result["status"]),
                    "memory_used_count": len(result.get("memories", [])),
                },
                user_id=current_user.id,
            )

            if result["status"] == OutreachStatus.ESCALATED:
                # Human-in-the-loop (Sprint 9, FR-4.6): низкая уверенность —
                # уведомляем сотрудника о необходимости проверки письма.
                notification_repo = NotificationRepository(db)
                await notification_repo.create(
                    type=NotificationType.OUTREACH_ESCALATED,
                    title=f"Письмо для «{company.name}» требует проверки",
                    message=f"Низкая уверенность агента (confidence={result['confidence']:.2f}).",
                    entity_type="outreach_event",
                    entity_id=event.id,
                    recipient_role="менеджер по партнёрствам",
                )

            generated += 1
        except Exception as exc:
            logger.exception("generate_drafts: failed for company %s: %s", company_id, exc)
            failed += 1

    await db.commit()
    return GenerateResponse(campaign_id=campaign_id, generated=generated, failed=failed)


# ── Events ─────────────────────────────────────────────────────────────────────

@router.get("/events", response_model=dict)
async def list_events(
    campaign_id: int | None = Query(None),
    status: str | None = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    repo: OutreachRepository = Depends(_repo),
    _=Depends(get_current_user),
):
    items = await repo.list_events(
        campaign_id=campaign_id, status=status,
        limit=limit, offset=offset,
    )
    return {"items": [EventOut.model_validate(e) for e in items], "total": len(items)}


@router.patch("/events/{event_id}/approve", response_model=EventOut)
async def approve_event(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """FR-3.5 — человек утверждает письмо перед отправкой."""
    repo = OutreachRepository(db)
    event = await repo.update_status(event_id, OutreachStatus.APPROVED)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    await db.commit()
    return event


@router.patch("/events/{event_id}/content", response_model=EventOut)
async def update_event_content(
    event_id: int,
    body: EventContentUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """Редактировать текст письма до отправки."""
    repo = OutreachRepository(db)
    event = await repo.update_content(event_id, subject=body.subject, body=body.body)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    await db.commit()
    return event


@router.post("/events/{event_id}/send", response_model=EventOut)
async def send_event(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """Отправить утверждённое письмо через SendGrid."""
    repo = OutreachRepository(db)
    company_repo = CompanyRepository(db)

    event = await repo.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.status != OutreachStatus.APPROVED:
        raise HTTPException(
            status_code=400,
            detail=f"Письмо должно быть утверждено перед отправкой (текущий статус: {event.status})",
        )

    company = await company_repo.get_by_id(event.company_id)
    if not company or not company.email:
        raise HTTPException(status_code=400, detail="У компании не указан email")

    ok = await send_email(
        to_email=company.email,
        subject=event.subject or "Предложение о сотрудничестве",
        body=event.body or "",
    )
    new_status = OutreachStatus.SENT if ok else OutreachStatus.DRAFT
    # FR-3.6: при успешной отправке планируем следующее касание (follow-up)
    # согласно плану касаний (OUTREACH_TOUCH_PLAN_DAYS).
    next_days = next_touch_after_days(event.follow_up_number) if ok else event.next_follow_up_after_days
    event = await repo.update_status(event_id, new_status, next_follow_up_after_days=next_days)
    await db.commit()
    return event
