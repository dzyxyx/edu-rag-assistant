from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.projects.schemas import (
    GenerateSpecRequest,
    GenerateSpecResponse,
    ProjectCreate,
    ProjectListResponse,
    ProjectOut,
    ProjectStatusUpdate,
    RoleSlotAssign,
    RoleSlotCreate,
    RoleSlotListResponse,
    RoleSlotOut,
)
from app.core.dependencies import get_current_user
from app.core.limiter import limiter, rate_limit_string
from app.db.repositories.project import ProjectRepository
from app.db.repositories.user import UserRepository
from app.db.session import get_db
from app.services.projects.generator import generate_technical_spec

router = APIRouter()


def _repo(db: AsyncSession = Depends(get_db)) -> ProjectRepository:
    return ProjectRepository(db)


@router.get("", response_model=ProjectListResponse)
async def list_projects(
    status: str | None = Query(None),
    partner_company_id: int | None = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    repo: ProjectRepository = Depends(_repo),
    _=Depends(get_current_user),
):
    """Список студенческих проектов (FR-5.*)."""
    items = await repo.list(status=status, partner_company_id=partner_company_id, limit=limit, offset=offset)
    total = await repo.count(status=status)
    return ProjectListResponse(total=total, items=items)


@router.post("", response_model=ProjectOut)
async def create_project(
    body: ProjectCreate,
    repo: ProjectRepository = Depends(_repo),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """
    Создать проект (черновик). Если generate_spec=true — сразу генерирует ТЗ
    и базовый набор ролей (FR-5.1, FR-5.3).
    """
    project = await repo.create(
        title=body.title,
        description=body.description,
        partner_company_id=body.partner_company_id,
        difficulty=body.difficulty,
        project_competency_id=body.project_competency_id,
    )

    if body.generate_spec:
        result = await generate_technical_spec(
            title=project.title,
            description=project.description,
            priority_area=body.priority_area,
            difficulty=body.difficulty,
        )
        project = await repo.update_spec(
            project.id,
            technical_spec=result["technical_spec"],
            duration_weeks=result["duration_weeks"],
        )
        for slot in result["role_slots"]:
            await repo.add_role_slot(
                project.id,
                role=slot["role"],
                slots_count=slot["slots_count"],
                skills_required=slot["skills_required"],
            )

    await db.commit()
    return project


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(
    project_id: int,
    repo: ProjectRepository = Depends(_repo),
    _=Depends(get_current_user),
):
    project = await repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.patch("/{project_id}/status", response_model=ProjectOut)
async def update_project_status(
    project_id: int,
    body: ProjectStatusUpdate,
    repo: ProjectRepository = Depends(_repo),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """Изменить статус проекта (draft -> published -> in_progress -> completed -> archived)."""
    project = await repo.update_status(project_id, body.status)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.commit()
    return project


@router.post("/{project_id}/generate-spec", response_model=GenerateSpecResponse)
@limiter.limit(rate_limit_string)
async def generate_spec(
    request: Request,
    project_id: int,
    body: GenerateSpecRequest,
    repo: ProjectRepository = Depends(_repo),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """(Пере)генерировать ТЗ для существующего проекта и предложить роли (FR-5.1, FR-5.3)."""
    project = await repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    difficulty = body.difficulty or project.difficulty or "medium"
    result = await generate_technical_spec(
        title=project.title,
        description=project.description,
        priority_area=body.priority_area,
        difficulty=difficulty,
    )

    project = await repo.update_spec(
        project_id,
        technical_spec=result["technical_spec"],
        duration_weeks=result["duration_weeks"],
        difficulty=difficulty,
    )

    role_slots_created = 0
    if body.apply_role_slots:
        existing = await repo.list_role_slots(project_id)
        if not existing:
            for slot in result["role_slots"]:
                await repo.add_role_slot(
                    project_id,
                    role=slot["role"],
                    slots_count=slot["slots_count"],
                    skills_required=slot["skills_required"],
                )
                role_slots_created += 1

    await db.commit()
    return GenerateSpecResponse(project=project, role_slots_created=role_slots_created)


# ── Role slots (FR-5.3) ──────────────────────────────────────────────────────

@router.get("/{project_id}/roles", response_model=RoleSlotListResponse)
async def list_role_slots(
    project_id: int,
    repo: ProjectRepository = Depends(_repo),
    _=Depends(get_current_user),
):
    project = await repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    items = await repo.list_role_slots(project_id)
    return RoleSlotListResponse(items=items)


@router.post("/{project_id}/roles", response_model=RoleSlotOut)
async def add_role_slot(
    project_id: int,
    body: RoleSlotCreate,
    repo: ProjectRepository = Depends(_repo),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    project = await repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    slot = await repo.add_role_slot(
        project_id,
        role=body.role,
        slots_count=body.slots_count,
        skills_required=body.skills_required,
    )
    await db.commit()
    return slot


@router.post("/{project_id}/roles/{slot_id}/assign", response_model=RoleSlotOut)
async def assign_role_slot(
    project_id: int,
    slot_id: int,
    body: RoleSlotAssign,
    repo: ProjectRepository = Depends(_repo),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """Назначить студента на роль в проекте (FR-5.3)."""
    slot = await repo.get_role_slot(slot_id)
    if not slot or slot.project_id != project_id:
        raise HTTPException(status_code=404, detail="Role slot not found")

    user = await UserRepository(db).get_by_id(body.student_id)
    if not user:
        raise HTTPException(status_code=404, detail="Student (user) not found")

    slot = await repo.assign_student(slot_id, body.student_id)
    await db.commit()
    return slot
