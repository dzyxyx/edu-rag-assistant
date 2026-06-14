from datetime import datetime

from pydantic import BaseModel, Field

from app.db.models.project import ProjectStatus


class ProjectOut(BaseModel):
    id: int
    title: str
    description: str | None
    technical_spec: str | None
    partner_company_id: int | None
    status: str
    duration_weeks: int | None
    team_size: int | None
    difficulty: str | None
    procompetency_id: str | None
    project_competency_id: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ProjectListResponse(BaseModel):
    total: int
    items: list[ProjectOut]


class ProjectCreate(BaseModel):
    title: str
    description: str | None = None
    partner_company_id: int | None = None
    difficulty: str = "medium"  # easy | medium | hard
    generate_spec: bool = False
    priority_area: str | None = None
    project_competency_id: int | None = Field(
        default=None,
        description="S7-3: id основной компетенции (app.db.models.competency.Competency), "
        "на развитие которой направлен проект.",
    )


class ProjectStatusUpdate(BaseModel):
    status: ProjectStatus


class GenerateSpecRequest(BaseModel):
    priority_area: str | None = None
    difficulty: str | None = None  # если задано — переопределяет текущее
    apply_role_slots: bool = True


class GenerateSpecResponse(BaseModel):
    project: ProjectOut
    role_slots_created: int


class RoleSlotOut(BaseModel):
    id: int
    project_id: int
    role: str
    slots_count: int
    skills_required: str | None
    assigned_student_id: int | None

    model_config = {"from_attributes": True}


class RoleSlotCreate(BaseModel):
    role: str
    slots_count: int = 1
    skills_required: list[str] | None = None


class RoleSlotAssign(BaseModel):
    student_id: int


class RoleSlotListResponse(BaseModel):
    items: list[RoleSlotOut]
