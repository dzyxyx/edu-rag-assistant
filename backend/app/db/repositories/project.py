from __future__ import annotations

import json

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.project import Project, ProjectRoleSlot, ProjectStatus


class ProjectRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    # ── Project ───────────────────────────────────────────────────────────────

    async def create(
        self,
        title: str,
        description: str | None = None,
        technical_spec: str | None = None,
        partner_company_id: int | None = None,
        duration_weeks: int | None = None,
        team_size: int | None = None,
        difficulty: str | None = None,
        status: str = ProjectStatus.DRAFT,
        project_competency_id: int | None = None,
    ) -> Project:
        obj = Project(
            title=title,
            description=description,
            technical_spec=technical_spec,
            partner_company_id=partner_company_id,
            duration_weeks=duration_weeks,
            team_size=team_size,
            difficulty=difficulty,
            status=status,
            project_competency_id=project_competency_id,
        )
        self.session.add(obj)
        await self.session.flush()
        await self.session.refresh(obj)
        return obj

    async def get_by_id(self, project_id: int) -> Project | None:
        return await self.session.get(Project, project_id)

    async def list(
        self,
        status: str | None = None,
        partner_company_id: int | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Project]:
        q = select(Project).order_by(Project.created_at.desc())
        if status is not None:
            q = q.where(Project.status == status)
        if partner_company_id is not None:
            q = q.where(Project.partner_company_id == partner_company_id)
        q = q.limit(limit).offset(offset)
        result = await self.session.execute(q)
        return list(result.scalars().all())

    async def count(self, status: str | None = None) -> int:
        q = select(func.count()).select_from(Project)
        if status is not None:
            q = q.where(Project.status == status)
        result = await self.session.execute(q)
        return result.scalar_one()

    async def update_status(self, project_id: int, status: str) -> Project | None:
        obj = await self.get_by_id(project_id)
        if obj:
            obj.status = status
            await self.session.flush()
        return obj

    async def update_spec(
        self,
        project_id: int,
        technical_spec: str,
        duration_weeks: int | None = None,
        team_size: int | None = None,
        difficulty: str | None = None,
    ) -> Project | None:
        obj = await self.get_by_id(project_id)
        if not obj:
            return None
        obj.technical_spec = technical_spec
        if duration_weeks is not None:
            obj.duration_weeks = duration_weeks
        if team_size is not None:
            obj.team_size = team_size
        if difficulty is not None:
            obj.difficulty = difficulty
        await self.session.flush()
        return obj

    # ── ProjectRoleSlot ───────────────────────────────────────────────────────

    async def add_role_slot(
        self,
        project_id: int,
        role: str,
        slots_count: int = 1,
        skills_required: list[str] | None = None,
    ) -> ProjectRoleSlot:
        obj = ProjectRoleSlot(
            project_id=project_id,
            role=role,
            slots_count=slots_count,
            skills_required=json.dumps(skills_required or [], ensure_ascii=False),
        )
        self.session.add(obj)
        await self.session.flush()
        await self.session.refresh(obj)
        return obj

    async def list_role_slots(self, project_id: int) -> list[ProjectRoleSlot]:
        result = await self.session.execute(
            select(ProjectRoleSlot)
            .where(ProjectRoleSlot.project_id == project_id)
            .order_by(ProjectRoleSlot.id)
        )
        return list(result.scalars().all())

    async def get_role_slot(self, slot_id: int) -> ProjectRoleSlot | None:
        return await self.session.get(ProjectRoleSlot, slot_id)

    async def assign_student(self, slot_id: int, student_id: int) -> ProjectRoleSlot | None:
        obj = await self.get_role_slot(slot_id)
        if obj:
            obj.assigned_student_id = student_id
            await self.session.flush()
        return obj
