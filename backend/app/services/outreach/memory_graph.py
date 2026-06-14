"""
LangGraph-граф генерации outreach-письма с использованием памяти агента (FR-6.3, S4-3).

Граф:
    retrieve_memory -> generate_email -> score_confidence -> [approve | escalate] -> END

- retrieve_memory: достаёт релевантные записи памяти агента (MemoryService.retrieve_relevant)
- generate_email: генерирует письмо с учётом найденной памяти (или MOCK)
- score_confidence: эвристическая оценка уверенности (0..1)
- approve/escalate: терминальные узлы, определяющие итоговый статус письма
  (DRAFT — обычный путь утверждения человеком, ESCALATED — низкая уверенность,
  требуется повышенное внимание человека, FR-4.6)
"""

import logging
from typing import TypedDict

from langgraph.graph import END, StateGraph
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.models.agent_memory import AgentMemory
from app.db.models.outreach import OutreachStatus
from app.services.memory.memory_service import MemoryService, format_memories
from app.services.outreach.generator import generate_email

logger = logging.getLogger(__name__)


class OutreachGraphState(TypedDict, total=False):
    db: AsyncSession
    company: object
    tone: str

    memories: list[AgentMemory]
    memory_context: str

    subject: str
    body: str

    confidence: float
    status: str


async def _retrieve_memory_node(state: OutreachGraphState) -> dict:
    db = state["db"]
    company = state["company"]

    service = MemoryService(db)
    query = f"outreach {company.name} {company.industry or ''}"
    memories = await service.retrieve_relevant(query=query, company_id=company.id, top_k=3)

    return {
        "memories": memories,
        "memory_context": format_memories(memories),
    }


async def _generate_email_node(state: OutreachGraphState) -> dict:
    company = state["company"]
    tone = state.get("tone", "formal")
    memory_context = state.get("memory_context", "")

    subject, body = await generate_email(company, tone=tone, memory_context=memory_context)
    return {"subject": subject, "body": body}


async def _score_confidence_node(state: OutreachGraphState) -> dict:
    """
    Эвристическая оценка уверенности агента в сгенерированном письме (0..1).

    Факторы:
    - базовая уверенность 0.5
    - + наличие релевантной памяти повышает уверенность (агент "видел" похожие случаи)
    - + успешные исходы прошлых взаимодействий с этой компанией повышают уверенность
    - - неудачные исходы прошлых взаимодействий снижают уверенность
    - + наличие описания/отрасли у компании (достаточно данных для письма)
    """
    company = state["company"]
    memories = state.get("memories", [])

    confidence = 0.5

    if memories:
        confidence += 0.1

    for m in memories:
        if m.outcome == "success":
            confidence += 0.1
        elif m.outcome == "failure":
            confidence -= 0.15

    if getattr(company, "description", None):
        confidence += 0.05
    if getattr(company, "industry", None):
        confidence += 0.05

    confidence = max(0.0, min(1.0, confidence))
    return {"confidence": confidence}


async def _approve_node(state: OutreachGraphState) -> dict:
    return {"status": OutreachStatus.DRAFT}


async def _escalate_node(state: OutreachGraphState) -> dict:
    logger.info(
        "outreach memory_graph: компания %s — низкая уверенность (%.2f), эскалация на человека",
        getattr(state["company"], "name", "?"),
        state.get("confidence", 0.0),
    )
    return {"status": OutreachStatus.ESCALATED}


def _route_after_confidence(state: OutreachGraphState) -> str:
    if state.get("confidence", 0.0) < settings.OUTREACH_CONFIDENCE_THRESHOLD:
        return "escalate"
    return "approve"


def build_outreach_graph():
    graph = StateGraph(OutreachGraphState)

    graph.add_node("retrieve_memory", _retrieve_memory_node)
    graph.add_node("generate_email", _generate_email_node)
    graph.add_node("score_confidence", _score_confidence_node)
    graph.add_node("approve", _approve_node)
    graph.add_node("escalate", _escalate_node)

    graph.set_entry_point("retrieve_memory")
    graph.add_edge("retrieve_memory", "generate_email")
    graph.add_edge("generate_email", "score_confidence")
    graph.add_conditional_edges(
        "score_confidence",
        _route_after_confidence,
        {"approve": "approve", "escalate": "escalate"},
    )
    graph.add_edge("approve", END)
    graph.add_edge("escalate", END)

    return graph.compile()


_compiled_graph = None


def get_outreach_graph():
    global _compiled_graph
    if _compiled_graph is None:
        _compiled_graph = build_outreach_graph()
    return _compiled_graph


async def run_outreach_graph(db: AsyncSession, company, tone: str = "formal") -> OutreachGraphState:
    """Запускает граф генерации письма для одной компании и возвращает итоговое состояние."""
    graph = get_outreach_graph()
    initial_state: OutreachGraphState = {"db": db, "company": company, "tone": tone}
    result = await graph.ainvoke(initial_state)
    return result
