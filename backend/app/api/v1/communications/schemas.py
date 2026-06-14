from pydantic import BaseModel, Field

from app.services.communications.generator import CommunicationType


class CommunicationTypeOut(BaseModel):
    type: str
    description: str
    requires_company: bool


class CommunicationTypesResponse(BaseModel):
    items: list[CommunicationTypeOut]


class CommunicationGenerateRequest(BaseModel):
    type: CommunicationType
    company_id: int | None = Field(
        default=None,
        description="Обязателен для всех типов, кроме 'notification'.",
    )
    tone: str = "formal"  # formal | informal
    use_memory: bool = Field(
        default=True,
        description="Учитывать долгосрочную память агента по компании (FR-6.3).",
    )
    render_html: bool = Field(
        default=False,
        description="Дополнительно вернуть HTML-версию письма, оформленную "
        "по Jinja2-шаблону (FR-5.*) — для предпросмотра/отправки.",
    )

    # Доп. параметры конкретных типов (см. generate_communication)
    previous_subject: str | None = None
    follow_up_number: int = 1
    reason: str | None = None
    project_id: int | None = Field(
        default=None,
        description="Для type='project_invitation' (Sprint 7): id проекта. "
        "Если указан — title/technical_spec проекта используются вместо "
        "project_name/project_description.",
    )
    project_name: str | None = None
    project_description: str | None = None
    recipient_role: str | None = None
    message: str | None = None


class CommunicationGenerateResponse(BaseModel):
    type: CommunicationType
    company_id: int | None = None
    tone: str
    subject: str
    body: str
    memory_used_count: int = 0
    rendered_html: str | None = None
