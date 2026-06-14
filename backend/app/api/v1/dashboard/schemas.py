from pydantic import BaseModel


class DashboardStats(BaseModel):
    companies_total: int
    companies_shortlisted: int
    companies_partners: int
    priority_areas_proposed: int
    priority_areas_approved: int
    outreach_sent: int
    outreach_replied: int
    outreach_escalated: int
    pending_review_total: int


class PendingReviewItem(BaseModel):
    type: str  # "priority_area" | "outreach_event"
    id: int
    title: str
    description: str | None = None
    status: str
    created_at: str
    link: str


class PendingReviewResponse(BaseModel):
    total: int
    items: list[PendingReviewItem]
