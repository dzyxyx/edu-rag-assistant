"""
Тесты Спринта 7: Генерация ТЗ / проекты.

Покрывает:
- ProjectRepository (CRUD для Project/ProjectRoleSlot)
- API /projects (list/create/get/update-status)
- /projects/{id}/generate-spec (с MOCK_LLM)
- Role slots: создание/список/назначение (с 404 для несуществующего студента)
- Связка communications project_invitation <-> project_id (FR-5.*)

Все тесты выполняются с MOCK_LLM=true.
"""
import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")

from app.core.config import settings
from app.db.models.project import ProjectRole, ProjectStatus
from app.db.repositories.project import ProjectRepository


@pytest.fixture(autouse=True)
def mock_llm(monkeypatch):
    monkeypatch.setattr(settings, "MOCK_LLM", True)


# ── ProjectRepository ────────────────────────────────────────────────────────

async def test_project_repository_crud(db_session):
    repo = ProjectRepository(db_session)

    project = await repo.create(
        title="Тестовый проект S7",
        description="Описание тестового проекта",
        difficulty="medium",
    )
    await db_session.commit()

    assert project.id is not None
    assert project.status == ProjectStatus.DRAFT

    fetched = await repo.get_by_id(project.id)
    assert fetched is not None
    assert fetched.title == "Тестовый проект S7"

    updated = await repo.update_status(project.id, ProjectStatus.PUBLISHED)
    await db_session.commit()
    assert updated.status == ProjectStatus.PUBLISHED

    spec_updated = await repo.update_spec(
        project.id, technical_spec="Текст ТЗ", duration_weeks=8, difficulty="medium"
    )
    await db_session.commit()
    assert spec_updated.technical_spec == "Текст ТЗ"
    assert spec_updated.duration_weeks == 8

    slot = await repo.add_role_slot(
        project.id, role=ProjectRole.DEVELOPER, slots_count=2, skills_required=["Python"]
    )
    await db_session.commit()
    assert slot.id is not None
    assert slot.role == ProjectRole.DEVELOPER

    slots = await repo.list_role_slots(project.id)
    assert any(s.id == slot.id for s in slots)

    assert await repo.count() >= 1
    assert await repo.count(status=ProjectStatus.PUBLISHED) >= 1


# ── /projects: list / create / get / update-status ──────────────────────────

async def test_create_and_get_project(auth_client):
    resp = await auth_client.post(
        "/api/v1/projects",
        json={"title": "API проект", "description": "Описание", "difficulty": "easy"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "API проект"
    assert data["status"] == ProjectStatus.DRAFT

    get_resp = await auth_client.get(f"/api/v1/projects/{data['id']}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == data["id"]


async def test_get_project_not_found(auth_client):
    resp = await auth_client.get("/api/v1/projects/999999")
    assert resp.status_code == 404


async def test_list_projects(auth_client):
    create_resp = await auth_client.post(
        "/api/v1/projects",
        json={"title": "Проект для списка", "difficulty": "medium"},
    )
    assert create_resp.status_code == 200

    resp = await auth_client.get("/api/v1/projects")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    assert any(item["title"] == "Проект для списка" for item in data["items"])


async def test_update_project_status(auth_client):
    create_resp = await auth_client.post(
        "/api/v1/projects",
        json={"title": "Проект для статуса", "difficulty": "medium"},
    )
    project_id = create_resp.json()["id"]

    resp = await auth_client.patch(
        f"/api/v1/projects/{project_id}/status", json={"status": "published"}
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "published"


async def test_update_project_status_not_found(auth_client):
    resp = await auth_client.patch(
        "/api/v1/projects/999999/status", json={"status": "published"}
    )
    assert resp.status_code == 404


async def test_create_project_with_generate_spec(auth_client):
    resp = await auth_client.post(
        "/api/v1/projects",
        json={
            "title": "Проект с генерацией ТЗ",
            "description": "Веб-сервис для аналитики",
            "difficulty": "hard",
            "generate_spec": True,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["technical_spec"]
    assert data["duration_weeks"] == 12

    roles_resp = await auth_client.get(f"/api/v1/projects/{data['id']}/roles")
    assert roles_resp.status_code == 200
    items = roles_resp.json()["items"]
    assert len(items) == len(set(i["role"] for i in items))
    assert any(i["role"] == ProjectRole.MANAGER for i in items)


# ── /projects/{id}/generate-spec ─────────────────────────────────────────────

async def test_generate_spec_endpoint(auth_client):
    create_resp = await auth_client.post(
        "/api/v1/projects",
        json={"title": "Проект без ТЗ", "description": "Описание", "difficulty": "easy"},
    )
    project_id = create_resp.json()["id"]
    assert create_resp.json()["technical_spec"] is None

    resp = await auth_client.post(
        f"/api/v1/projects/{project_id}/generate-spec",
        json={"difficulty": "easy"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["project"]["technical_spec"]
    # для difficulty="easy" эвристика предлагает 2 роли: developer + tester
    assert data["role_slots_created"] == 2

    roles_resp = await auth_client.get(f"/api/v1/projects/{project_id}/roles")
    assert len(roles_resp.json()["items"]) == data["role_slots_created"]


async def test_generate_spec_not_found(auth_client):
    resp = await auth_client.post(
        "/api/v1/projects/999999/generate-spec", json={}
    )
    assert resp.status_code == 404


# ── Role slots ───────────────────────────────────────────────────────────────

async def test_add_and_list_role_slots(auth_client):
    create_resp = await auth_client.post(
        "/api/v1/projects",
        json={"title": "Проект для ролей", "difficulty": "medium"},
    )
    project_id = create_resp.json()["id"]

    add_resp = await auth_client.post(
        f"/api/v1/projects/{project_id}/roles",
        json={"role": "developer", "slots_count": 2, "skills_required": ["Python", "SQL"]},
    )
    assert add_resp.status_code == 200
    slot = add_resp.json()
    assert slot["role"] == "developer"
    assert slot["assigned_student_id"] is None

    list_resp = await auth_client.get(f"/api/v1/projects/{project_id}/roles")
    assert list_resp.status_code == 200
    assert any(item["id"] == slot["id"] for item in list_resp.json()["items"])


async def test_assign_role_slot(auth_client, db_session):
    from app.db.repositories.user import UserRepository

    create_resp = await auth_client.post(
        "/api/v1/projects",
        json={"title": "Проект для назначения", "difficulty": "medium"},
    )
    project_id = create_resp.json()["id"]

    add_resp = await auth_client.post(
        f"/api/v1/projects/{project_id}/roles",
        json={"role": "tester", "slots_count": 1},
    )
    slot_id = add_resp.json()["id"]

    user_repo = UserRepository(db_session)
    student = await user_repo.create(
        email="student-s7@example.com",
        full_name="Студент Тестов",
        hashed_password="hashed",
    )
    await db_session.commit()

    assign_resp = await auth_client.post(
        f"/api/v1/projects/{project_id}/roles/{slot_id}/assign",
        json={"student_id": student.id},
    )
    assert assign_resp.status_code == 200
    assert assign_resp.json()["assigned_student_id"] == student.id


async def test_assign_role_slot_student_not_found(auth_client):
    create_resp = await auth_client.post(
        "/api/v1/projects",
        json={"title": "Проект для несуществующего студента", "difficulty": "medium"},
    )
    project_id = create_resp.json()["id"]

    add_resp = await auth_client.post(
        f"/api/v1/projects/{project_id}/roles",
        json={"role": "tester", "slots_count": 1},
    )
    slot_id = add_resp.json()["id"]

    resp = await auth_client.post(
        f"/api/v1/projects/{project_id}/roles/{slot_id}/assign",
        json={"student_id": 999999},
    )
    assert resp.status_code == 404


async def test_assign_role_slot_not_found(auth_client):
    create_resp = await auth_client.post(
        "/api/v1/projects",
        json={"title": "Проект для проверки 404 слота", "difficulty": "medium"},
    )
    project_id = create_resp.json()["id"]

    resp = await auth_client.post(
        f"/api/v1/projects/{project_id}/roles/999999/assign",
        json={"student_id": 1},
    )
    assert resp.status_code == 404


# ── communications: project_invitation <-> project_id ───────────────────────

async def test_communication_project_invitation_with_project_id(auth_client, db_session):
    from app.db.repositories.company import CompanyRepository

    company_repo = CompanyRepository(db_session)
    company, _ = await company_repo.upsert_by_name(
        name="ProjTest Компания",
        website="https://projtest.ru",
        description="python стажировка",
        industry="Разработка ПО",
        region="Екатеринбург",
        employee_count=50,
        email="hr@projtest.ru",
        source="manual",
        status="raw",
    )
    await db_session.commit()

    create_resp = await auth_client.post(
        "/api/v1/projects",
        json={
            "title": "Платформа для аналитики вакансий",
            "description": "Веб-сервис на FastAPI + React",
            "difficulty": "medium",
            "generate_spec": True,
        },
    )
    project = create_resp.json()

    resp = await auth_client.post(
        "/api/v1/communications/generate",
        json={
            "type": "project_invitation",
            "company_id": company.id,
            "tone": "informal",
            "project_id": project["id"],
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "Платформа для аналитики вакансий" in data["subject"] or "Платформа для аналитики вакансий" in data["body"]


async def test_communication_project_invitation_project_not_found(auth_client, db_session):
    from app.db.repositories.company import CompanyRepository

    company_repo = CompanyRepository(db_session)
    company, _ = await company_repo.upsert_by_name(
        name="ProjTest Компания 2",
        website="https://projtest2.ru",
        description="python стажировка",
        industry="Разработка ПО",
        region="Екатеринбург",
        employee_count=50,
        email="hr2@projtest.ru",
        source="manual",
        status="raw",
    )
    await db_session.commit()

    resp = await auth_client.post(
        "/api/v1/communications/generate",
        json={
            "type": "project_invitation",
            "company_id": company.id,
            "tone": "informal",
            "project_id": 999999,
        },
    )
    assert resp.status_code == 404
