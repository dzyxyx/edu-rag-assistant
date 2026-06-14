from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.memory.schemas import (
    AuditLogListResponse,
    AuditLogOut,
    GraphEdge,
    GraphNode,
    MemoryGraphResponse,
    MemoryListResponse,
    MemoryOut,
)
from app.core.dependencies import get_current_user
from app.db.repositories.agent_memory import AgentMemoryRepository, AuditLogRepository
from app.db.repositories.company import CompanyRepository
from app.db.session import get_db

router = APIRouter()


# ── Memory list/detail (FR-6.1) ──────────────────────────────────────────────────

@router.get("", response_model=MemoryListResponse)
async def list_memory(
    memory_type: str | None = Query(None),
    phase: str | None = Query(None),
    company_id: int | None = Query(None),
    outcome: str | None = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    repo = AgentMemoryRepository(db)
    items = await repo.list(
        memory_type=memory_type,
        phase=phase,
        company_id=company_id,
        outcome=outcome,
        limit=limit,
        offset=offset,
    )
    total = await repo.count(
        memory_type=memory_type,
        phase=phase,
        company_id=company_id,
        outcome=outcome,
    )
    return MemoryListResponse(
        items=[MemoryOut.model_validate(m) for m in items],
        total=total,
    )


# ── Graph visualization ───────────────────────────────────────────────────────────

@router.get("/graph", response_model=MemoryGraphResponse)
async def get_memory_graph(
    company_id: int | None = Query(None),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """
    Граф связей "запись памяти <-> компания" для визуализации (FR-6.1).

    Узлы: записи памяти (memory) и компании (company).
    Рёбра: memory -> company, если запись связана с компанией.
    """
    repo = AgentMemoryRepository(db)
    memories = await repo.list(company_id=company_id, limit=limit)

    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []
    company_repo = CompanyRepository(db)
    seen_companies: dict[int, str] = {}

    for m in memories:
        mem_node_id = f"memory-{m.id}"
        label = (m.summary or m.content or "")[:80]
        nodes.append(GraphNode(id=mem_node_id, label=label, type="memory"))

        if m.company_id is not None:
            if m.company_id not in seen_companies:
                company = await company_repo.get_by_id(m.company_id)
                seen_companies[m.company_id] = company.name if company else f"#{m.company_id}"

            company_node_id = f"company-{m.company_id}"
            if not any(n.id == company_node_id for n in nodes):
                nodes.append(
                    GraphNode(id=company_node_id, label=seen_companies[m.company_id], type="company")
                )

            edges.append(
                GraphEdge(source=mem_node_id, target=company_node_id, label=m.memory_type)
            )

    return MemoryGraphResponse(nodes=nodes, edges=edges)


# ── Audit log (FR-7.4) ────────────────────────────────────────────────────────────

@router.get("/audit-log", response_model=AuditLogListResponse)
async def list_audit_log(
    actor: str | None = Query(None),
    entity_type: str | None = Query(None),
    entity_id: int | None = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    repo = AuditLogRepository(db)
    items = await repo.list(
        actor=actor,
        entity_type=entity_type,
        entity_id=entity_id,
        limit=limit,
        offset=offset,
    )
    total = await repo.count(actor=actor, entity_type=entity_type, entity_id=entity_id)
    return AuditLogListResponse(
        items=[AuditLogOut.model_validate(a) for a in items],
        total=total,
    )


# ── Memory detail (должен идти после /graph и /audit-log) ────────────────────────

@router.get("/{memory_id}", response_model=MemoryOut)
async def get_memory(
    memory_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    repo = AgentMemoryRepository(db)
    memory = await repo.get_by_id(memory_id)
    if not memory:
        raise HTTPException(status_code=404, detail="Memory record not found")
    return memory
