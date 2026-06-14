from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.dashboard.schemas import (
    DashboardStats,
    PendingReviewItem,
    PendingReviewResponse,
)
from app.core.dependencies import get_current_user
from app.db.models.company import CompanyStatus
from app.db.models.outreach import OutreachStatus
from app.db.models.priority_area import PriorityAreaStatus
from app.db.repositories.company import CompanyRepository
from app.db.repositories.outreach import OutreachRepository
from app.db.repositories.priority_area import PriorityAreaRepository
from app.db.session import get_db

router = APIRouter()

# Статусы outreach-событий, считающихся "отправленными" (после утверждения).
_SENT_STATUSES = [
    OutreachStatus.SENT,
    OutreachStatus.DELIVERED,
    OutreachStatus.READ,
    OutreachStatus.REPLIED,
    OutreachStatus.FOLLOW_UP,
    OutreachStatus.CLOSED,
]

# Статусы, требующие внимания человека (human-in-the-loop, FR-3.5/FR-4.6).
_OUTREACH_REVIEW_STATUSES = [OutreachStatus.DRAFT, OutreachStatus.ESCALATED]


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """Сводные метрики проекта для дашборда (Sprint 9, FR-7.*)."""
    company_repo = CompanyRepository(db)
    outreach_repo = OutreachRepository(db)
    priority_repo = PriorityAreaRepository(db)

    companies_total = await company_repo.count()
    companies_shortlisted = await company_repo.count(CompanyStatus.SHORTLISTED)
    companies_partners = await company_repo.count(CompanyStatus.PARTNER)

    priority_areas_proposed = await priority_repo.count(PriorityAreaStatus.PROPOSED)
    priority_areas_approved = await priority_repo.count(PriorityAreaStatus.APPROVED)

    outreach_sent = await outreach_repo.count_events_in(_SENT_STATUSES)
    outreach_replied = await outreach_repo.count_events(OutreachStatus.REPLIED)
    outreach_escalated = await outreach_repo.count_events(OutreachStatus.ESCALATED)

    pending_outreach = await outreach_repo.count_events_in(_OUTREACH_REVIEW_STATUSES)
    pending_review_total = priority_areas_proposed + pending_outreach

    return DashboardStats(
        companies_total=companies_total,
        companies_shortlisted=companies_shortlisted,
        companies_partners=companies_partners,
        priority_areas_proposed=priority_areas_proposed,
        priority_areas_approved=priority_areas_approved,
        outreach_sent=outreach_sent,
        outreach_replied=outreach_replied,
        outreach_escalated=outreach_escalated,
        pending_review_total=pending_review_total,
    )


@router.get("/pending-review", response_model=PendingReviewResponse)
async def get_pending_review(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """
    Единая очередь human-in-the-loop (Sprint 9): предложенные приоритетные
    области (FR-1.5) + outreach-письма, требующие утверждения/повышенного
    внимания (FR-3.5, FR-4.6).
    """
    priority_repo = PriorityAreaRepository(db)
    outreach_repo = OutreachRepository(db)

    items: list[PendingReviewItem] = []

    for area in await priority_repo.list(status=PriorityAreaStatus.PROPOSED, limit=200):
        items.append(
            PendingReviewItem(
                type="priority_area",
                id=area.id,
                title=area.name,
                description=area.description,
                status=area.status,
                created_at=area.created_at.isoformat(),
                link=f"/api/v1/industry/priority-areas/{area.id}/review",
            )
        )

    for event in await outreach_repo.list_events_in(_OUTREACH_REVIEW_STATUSES, limit=200):
        items.append(
            PendingReviewItem(
                type="outreach_event",
                id=event.id,
                title=event.subject or f"Письмо #{event.id} (компания {event.company_id})",
                description=f"confidence={event.confidence_score}" if event.confidence_score is not None else None,
                status=event.status,
                created_at=event.created_at.isoformat(),
                link=f"/api/v1/outreach/events/{event.id}/approve",
            )
        )

    items.sort(key=lambda i: i.created_at, reverse=True)
    return PendingReviewResponse(total=len(items), items=items)
