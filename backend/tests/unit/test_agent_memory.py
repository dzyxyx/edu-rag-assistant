"""
Тесты Спринта 4: память агента (MemoryService/AgentMemoryRepository),
журнал аудита (AuditLogRepository/log_action), LangGraph-граф outreach
и API /memory/*.

Все тесты выполняются с MOCK_LLM=true — Ollama/Chroma не используются,
MemoryService работает только через SQL (AgentMemoryRepository).
"""
import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")

from app.core.config import settings
from app.db.models.outreach import OutreachStatus
from app.db.repositories.agent_memory import AgentMemoryRepository, AuditLogRepository
from app.services.memory.audit import log_action
from app.services.memory.memory_service import MemoryService, format_memories
from app.services.outreach.memory_graph import run_outreach_graph


@pytest.fixture(autouse=True)
def mock_llm(monkeypatch):
    """Гарантируем, что во всех тестах этого модуля используется заглушка LLM."""
    monkeypatch.setattr(settings, "MOCK_LLM", True)


COMPANY_DATA = {
    "name": "MemTest Компания",
    "website": "https://memtest.ru",
    "description": "python devops стажировка практика студент",
    "industry": "Разработка ПО",
    "region": "Екатеринбург",
    "employee_count": 200,
    "email": "hr@memtest.ru",
    "source": "manual",
    "status": "raw",
}


async def _create_company(db_session):
    from app.db.repositories.company import CompanyRepository

    repo = CompanyRepository(db_session)
    company, _ = await repo.upsert_by_name(**COMPANY_DATA)
    await db_session.commit()
    return company


# ── MemoryService / AgentMemoryRepository ────────────────────────────────────

async def test_save_memory_and_retrieve_by_company(db_session):
    company = await _create_company(db_session)
    service = MemoryService(db_session)

    memory = await service.save_memory(
        memory_type="interaction",
        phase="phase_3",
        company_id=company.id,
        content="Письмо компании отправлено",
        summary="Outreach draft",
        outcome="success",
        outcome_score=0.9,
    )
    await db_session.commit()

    assert memory.id is not None
    assert memory.chroma_id is None  # MOCK_LLM=true -> Chroma не используется

    results = await service.retrieve_relevant("query", company_id=company.id, top_k=3)
    assert any(m.id == memory.id for m in results)


async def test_retrieve_relevant_without_company_falls_back_to_list(db_session):
    service = MemoryService(db_session)
    await service.save_memory(
        memory_type="interaction",
        phase="rag_chat",
        content="Вопрос: что такое Scrum?\nОтвет: ...",
        summary="что такое Scrum?",
    )
    await db_session.commit()

    results = await service.retrieve_relevant("scrum", top_k=5)
    assert isinstance(results, list)
    assert len(results) >= 1


async def test_record_outcome(db_session):
    company = await _create_company(db_session)
    service = MemoryService(db_session)
    memory = await service.save_memory(
        memory_type="strategy",
        phase="phase_3",
        company_id=company.id,
        content="Стратегия выхода на компанию",
    )
    await db_session.commit()

    updated = await service.record_outcome(memory.id, outcome="failure", outcome_score=0.1)
    await db_session.commit()

    assert updated.outcome == "failure"
    assert updated.outcome_score == 0.1


async def test_format_memories():
    class FakeMemory:
        def __init__(self, memory_type, phase, outcome, outcome_score, summary, content):
            self.memory_type = memory_type
            self.phase = phase
            self.outcome = outcome
            self.outcome_score = outcome_score
            self.summary = summary
            self.content = content

    assert format_memories([]) == ""

    memories = [FakeMemory("interaction", "phase_3", "success", 0.8, "Письмо ушло", "...")]
    text = format_memories(memories)
    assert "interaction" in text
    assert "success" in text
    assert "Письмо ушло" in text


# ── AuditLogRepository / log_action ──────────────────────────────────────────

async def test_log_action_creates_entry(db_session):
    entry = await log_action(
        db_session,
        actor="agent",
        action="memory.save",
        phase="phase_3",
        entity_type="agent_memory",
        entity_id=1,
        details={"foo": "bar"},
    )
    await db_session.commit()

    assert entry.id is not None
    assert entry.actor == "agent"
    assert "foo" in entry.details

    repo = AuditLogRepository(db_session)
    items = await repo.list(entity_type="agent_memory")
    assert any(i.id == entry.id for i in items)


# ── LangGraph граф outreach ───────────────────────────────────────────────────

async def test_outreach_graph_returns_subject_body_and_status(db_session):
    company = await _create_company(db_session)

    result = await run_outreach_graph(db_session, company, tone="formal")

    assert result["subject"]
    assert result["body"]
    assert 0.0 <= result["confidence"] <= 1.0
    assert result["status"] in (OutreachStatus.DRAFT, OutreachStatus.ESCALATED)


async def test_outreach_graph_escalates_after_failed_history(db_session, monkeypatch):
    """Если в памяти много неудачных исходов — уверенность падает и письмо эскалируется."""
    company = await _create_company(db_session)
    service = MemoryService(db_session)

    for _ in range(3):
        await service.save_memory(
            memory_type="outcome",
            phase="phase_3",
            company_id=company.id,
            content="Компания отказалась от сотрудничества",
            outcome="failure",
            outcome_score=0.0,
        )
    await db_session.commit()

    # Поднимем порог, чтобы наглядно показать эскалацию при низкой уверенности
    monkeypatch.setattr(settings, "OUTREACH_CONFIDENCE_THRESHOLD", 0.9)

    result = await run_outreach_graph(db_session, company, tone="formal")
    assert result["status"] == OutreachStatus.ESCALATED


# ── API /memory ────────────────────────────────────────────────────────────────

async def test_memory_list_and_detail_endpoints(auth_client, db_session):
    company = await _create_company(db_session)
    service = MemoryService(db_session)
    memory = await service.save_memory(
        memory_type="interaction",
        phase="phase_3",
        company_id=company.id,
        content="Тестовая запись памяти",
        summary="Тест",
    )
    await db_session.commit()

    resp = await auth_client.get("/api/v1/memory")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    assert any(item["id"] == memory.id for item in data["items"])

    detail = await auth_client.get(f"/api/v1/memory/{memory.id}")
    assert detail.status_code == 200
    assert detail.json()["content"] == "Тестовая запись памяти"


async def test_memory_detail_not_found(auth_client):
    resp = await auth_client.get("/api/v1/memory/999999")
    assert resp.status_code == 404


async def test_memory_graph_endpoint(auth_client, db_session):
    company = await _create_company(db_session)
    service = MemoryService(db_session)
    await service.save_memory(
        memory_type="interaction",
        phase="phase_3",
        company_id=company.id,
        content="Память для графа",
        summary="Граф-тест",
    )
    await db_session.commit()

    resp = await auth_client.get("/api/v1/memory/graph", params={"company_id": company.id})
    assert resp.status_code == 200
    data = resp.json()
    assert any(n["type"] == "memory" for n in data["nodes"])
    assert any(n["type"] == "company" for n in data["nodes"])
    assert len(data["edges"]) >= 1


async def test_memory_audit_log_endpoint(auth_client, db_session):
    await log_action(db_session, actor="agent", action="memory.save", details={"x": 1})
    await db_session.commit()

    resp = await auth_client.get("/api/v1/memory/audit-log")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    assert any(item["action"] == "memory.save" for item in data["items"])


# ── Интеграция: генерация outreach-черновика сохраняет память и аудит-лог ───────

async def test_generate_drafts_saves_memory_and_audit(auth_client, db_session):
    company = await _create_company(db_session)

    campaign_resp = await auth_client.post(
        "/api/v1/outreach/campaigns", json={"name": "Тестовая кампания S4"}
    )
    assert campaign_resp.status_code == 200
    campaign_id = campaign_resp.json()["id"]

    gen_resp = await auth_client.post(
        f"/api/v1/outreach/campaigns/{campaign_id}/generate",
        json={"company_ids": [company.id], "tone": "formal"},
    )
    assert gen_resp.status_code == 200
    body = gen_resp.json()
    assert body["generated"] == 1
    assert body["failed"] == 0

    events_resp = await auth_client.get("/api/v1/outreach/events", params={"campaign_id": campaign_id})
    assert events_resp.status_code == 200
    events = events_resp.json()["items"]
    assert len(events) == 1
    event = events[0]
    assert event["status"] in (OutreachStatus.DRAFT, OutreachStatus.ESCALATED)

    # Память агента: сохранена запись interaction/phase_3 для компании
    repo = AgentMemoryRepository(db_session)
    memories = await repo.list_by_company(company.id)
    assert any(m.memory_type == "interaction" for m in memories)

    # Аудит-лог: записано действие outreach.draft_generated
    audit_repo = AuditLogRepository(db_session)
    audit_items = await audit_repo.list(entity_type="outreach_event")
    assert any(a.action == "outreach.draft_generated" for a in audit_items)
