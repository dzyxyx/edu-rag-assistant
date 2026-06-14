"""
Тесты Спринта 3 для RAG-чата: история диалога, связка с аналитикой рынка труда
(приоритетные области/компетенции) и API /rag/*.

Все тесты выполняются с MOCK_LLM=true — реальные Ollama/Chroma не используются.
"""
import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")

from app.core.config import settings
from app.db.models.competency import Competency
from app.db.models.priority_area import PriorityArea, PriorityAreaStatus
from app.services.rag.chain import format_history
from app.services.rag.market_context import build_market_context, is_market_question


@pytest.fixture(autouse=True)
def mock_llm(monkeypatch):
    """Гарантируем, что во всех тестах этого модуля используется заглушка LLM."""
    monkeypatch.setattr(settings, "MOCK_LLM", True)


# ── format_history ──────────────────────────────────────────────────────────

def test_format_history_empty():
    assert format_history([]) == ""


def test_format_history_formats_roles():
    messages = [
        {"role": "user", "content": "Что такое Scrum?"},
        {"role": "assistant", "content": "Scrum — это фреймворк..."},
    ]
    text = format_history(messages)
    assert "Студент: Что такое Scrum?" in text
    assert "EdAgent: Scrum — это фреймворк..." in text


def test_format_history_truncates_to_max():
    messages = [{"role": "user", "content": f"Вопрос {i}"} for i in range(10)]
    text = format_history(messages)
    lines = text.splitlines()
    assert len(lines) == 6  # HISTORY_MAX_MESSAGES
    assert "Вопрос 9" in text
    assert "Вопрос 0" not in text


# ── is_market_question ──────────────────────────────────────────────────────

@pytest.mark.parametrize("question,expected", [
    ("Какие навыки сейчас востребованы на рынке труда?", True),
    ("Что приоритетнее изучать для отрасли IT?", True),
    ("Что такое Scrum Master?", False),
    ("Объясни разницу между Kanban и Scrum", False),
])
def test_is_market_question(question, expected):
    assert is_market_question(question) is expected


# ── build_market_context ────────────────────────────────────────────────────

async def test_build_market_context_empty(db_session):
    context = await build_market_context(db_session)
    assert context == ""


async def test_build_market_context_with_data(db_session):
    comp = Competency(name="python", category="hard_skill", source="industry", demand_score=42.5)
    db_session.add(comp)

    area = PriorityArea(
        name="Backend разработка: python, sql",
        industry="ИТ",
        score=10.0,
        status=PriorityAreaStatus.APPROVED,
        competency_ids=[1],
    )
    db_session.add(area)
    await db_session.flush()

    context = await build_market_context(db_session)
    assert "python" in context
    assert "42.5" in context
    assert "Backend разработка" in context


async def test_build_market_context_ignores_unapproved(db_session):
    """Предложения со статусом 'proposed' не должны попадать в контекст RAG."""
    area = PriorityArea(
        name="Не утверждённая область",
        industry="ИТ",
        score=5.0,
        status=PriorityAreaStatus.PROPOSED,
        competency_ids=[],
    )
    db_session.add(area)
    await db_session.flush()

    context = await build_market_context(db_session)
    assert "Не утверждённая область" not in context


# ── /rag/chat ────────────────────────────────────────────────────────────────

async def test_chat_creates_session_and_messages(auth_client):
    resp = await auth_client.post("/api/v1/rag/chat", json={"question": "Что такое Scrum?"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["session_id"] is not None
    assert data["message_id"] is not None
    assert "Scrum" in data["answer"]
    assert data["sources"] == []  # MOCK_LLM=true -> Chroma не используется

    # Сообщения должны быть сохранены
    msgs = await auth_client.get(f"/api/v1/rag/sessions/{data['session_id']}/messages")
    assert msgs.status_code == 200
    items = msgs.json()["items"]
    assert len(items) == 2
    assert items[0]["role"] == "user"
    assert items[0]["content"] == "Что такое Scrum?"
    assert items[1]["role"] == "assistant"


async def test_chat_continues_session_with_history(auth_client):
    first = await auth_client.post("/api/v1/rag/chat", json={"question": "Привет"})
    session_id = first.json()["session_id"]

    second = await auth_client.post(
        "/api/v1/rag/chat",
        json={"question": "А что дальше?", "session_id": session_id},
    )
    assert second.status_code == 200
    # В моке при наличии истории добавляется подсказка о количестве сообщений
    assert "истории" in second.json()["answer"]

    msgs = await auth_client.get(f"/api/v1/rag/sessions/{session_id}/messages")
    assert len(msgs.json()["items"]) == 4


async def test_chat_market_question_marks_market_context(auth_client, db_session):
    comp = Competency(name="kubernetes", category="tool", source="industry", demand_score=33.3)
    db_session.add(comp)
    area = PriorityArea(
        name="DevOps: kubernetes, docker",
        industry="ИТ",
        score=12.0,
        status=PriorityAreaStatus.APPROVED,
        competency_ids=[1],
    )
    db_session.add(area)
    await db_session.flush()
    await db_session.commit()

    resp = await auth_client.post(
        "/api/v1/rag/chat",
        json={"question": "Какие компетенции сейчас востребованы на рынке труда?"},
    )
    assert resp.status_code == 200
    assert "аналитика рынка труда" in resp.json()["answer"]


async def test_chat_requires_auth(client):
    resp = await client.post("/api/v1/rag/chat", json={"question": "Привет"})
    assert resp.status_code == 401


async def test_chat_unknown_session_returns_404(auth_client):
    resp = await auth_client.post(
        "/api/v1/rag/chat", json={"question": "Привет", "session_id": 999999}
    )
    assert resp.status_code == 404


# ── /rag/sessions ────────────────────────────────────────────────────────────

async def test_list_sessions(auth_client):
    await auth_client.post("/api/v1/rag/chat", json={"question": "Вопрос 1"})
    await auth_client.post("/api/v1/rag/chat", json={"question": "Вопрос 2"})

    resp = await auth_client.get("/api/v1/rag/sessions")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 2
    assert all("title" in item for item in data["items"])
