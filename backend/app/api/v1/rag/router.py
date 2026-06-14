import asyncio
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.rag.schemas import ChatRequest, ChatResponse, MessageOut, SessionOut
from app.core.config import settings
from app.core.dependencies import get_current_active_user
from app.core.limiter import limiter, rate_limit_string
from app.core.security import decode_token
from app.db.models.chat import ChatMessage, ChatSession
from app.db.models.user import User
from app.db.repositories.user import UserRepository
from app.db.session import get_db, get_db_context
from app.services.memory.memory_service import MemoryService
from app.services.rag.chain import HISTORY_MAX_MESSAGES, build_rag_chain
from app.services.rag.market_context import build_market_context, is_market_question


async def _save_chat_memory(db: AsyncSession, question: str, answer: str) -> None:
    """
    Лёгкое сохранение взаимодействия RAG-чата в долгосрочную память агента (FR-6.1).
    Без отдельного LangGraph-графа — просто запись memory_type=interaction, phase=rag_chat.
    Ошибки не должны прерывать чат.
    """
    try:
        service = MemoryService(db)
        await service.save_memory(
            memory_type="interaction",
            phase="rag_chat",
            content=f"Вопрос: {question}\nОтвет: {answer}",
            summary=question[:300],
        )
    except Exception:
        logger.exception("_save_chat_memory: не удалось сохранить память для RAG-чата")

logger = logging.getLogger(__name__)
router = APIRouter()


async def _retrieve_sources(question: str) -> list[str]:
    """Возвращает список источников из Chroma для ответа (пусто в MOCK-режиме)."""
    # TODO[MOCK]: удалить if-блок, оставить только реальную логику
    if settings.MOCK_LLM:
        return []
    from app.services.rag.vector_store import get_vector_store
    store = get_vector_store()
    relevant = await asyncio.to_thread(store.similarity_search, question, k=3)
    return list({
        f"{d.metadata.get('topic', '')}/{d.metadata.get('source', '')}"
        for d in relevant
    })


# ── POST /rag/chat ─────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
@limiter.limit(rate_limit_string)
async def chat(
    request: Request,
    req: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    # Сессия
    if req.session_id:
        session = await db.get(ChatSession, req.session_id)
        if not session or session.user_id != current_user.id:
            raise HTTPException(status_code=404, detail="Session not found")
    else:
        session = ChatSession(user_id=current_user.id, title=req.question[:80])
        db.add(session)
        await db.flush()

    # История диалога до текущего вопроса (для контекста LLM)
    history_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(HISTORY_MAX_MESSAGES)
    )
    history = [
        {"role": m.role, "content": m.content}
        for m in reversed(history_result.scalars().all())
    ]

    # Сохраняем вопрос пользователя
    user_msg = ChatMessage(session_id=session.id, role="user", content=req.question)
    db.add(user_msg)
    await db.flush()

    # Аналитика рынка труда (Спринт 2) — подмешивается, если вопрос об этом
    market_context = ""
    if is_market_question(req.question):
        market_context = await build_market_context(db)

    # RAG-цепочка (синхронный invoke в отдельном потоке)
    chain = build_rag_chain()
    try:
        answer = await asyncio.to_thread(
            chain.invoke,
            {"question": req.question, "history": history, "market_context": market_context},
        )
    except Exception as exc:
        logger.exception("RAG chain error: %s", exc)
        raise HTTPException(status_code=503, detail="LLM service unavailable")

    # Sources из Chroma
    sources = await _retrieve_sources(req.question)

    # Сохраняем ответ ассистента
    bot_msg = ChatMessage(
        session_id=session.id,
        role="assistant",
        content=answer,
        sources=json.dumps(sources, ensure_ascii=False),
    )
    db.add(bot_msg)
    await _save_chat_memory(db, req.question, answer)
    await db.commit()
    await db.refresh(bot_msg)

    return ChatResponse(
        answer=answer,
        session_id=session.id,
        message_id=bot_msg.id,
        sources=sources,
    )


# ── GET /rag/sessions ──────────────────────────────────────────────────────────

@router.get("/sessions")
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == current_user.id, ChatSession.is_active == True)
        .order_by(ChatSession.created_at.desc())
        .limit(50)
    )
    sessions = result.scalars().all()
    return {
        "items": [SessionOut.model_validate(s) for s in sessions],
        "total": len(sessions),
    }


# ── GET /rag/sessions/{id}/messages ───────────────────────────────────────────

@router.get("/sessions/{session_id}/messages")
async def get_messages(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    session = await db.get(ChatSession, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")

    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at)
    )
    messages = result.scalars().all()

    items = []
    for m in messages:
        sources = json.loads(m.sources) if m.sources else []
        items.append(MessageOut(
            id=m.id,
            role=m.role,
            content=m.content,
            sources=sources,
            created_at=m.created_at,
        ))
    return {"items": items}


# ── WebSocket стриминг ─────────────────────────────────────────────────────────

async def _ws_authenticate(websocket: WebSocket, token: str | None) -> User | None:
    """Аутентификация по JWT, переданному в query-параметре ?token=..."""
    if not token:
        return None
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        if user_id is None:
            return None
    except ValueError:
        return None

    async with get_db_context() as db:
        repo = UserRepository(db)
        return await repo.get_by_id(int(user_id))


def _stream_chain(chain, chain_input: dict, queue: "asyncio.Queue"):
    """Выполняется в отдельном потоке: читает chain.stream() и кладёт чанки в очередь."""
    try:
        for chunk in chain.stream(chain_input):
            queue.put_nowait(chunk)
    except Exception as exc:  # noqa: BLE001
        logger.exception("RAG stream error: %s", exc)
        queue.put_nowait(None)  # сигнал ошибки
        return
    queue.put_nowait(...)  # сигнал успешного завершения


@router.websocket("/ws/chat/{session_id}")
async def chat_ws(
    websocket: WebSocket,
    session_id: int,
    token: str | None = Query(default=None),
):
    user = await _ws_authenticate(websocket, token)
    if user is None:
        await websocket.close(code=4401, reason="Unauthorized")
        return

    async with get_db_context() as db:
        session = await db.get(ChatSession, session_id)
        if not session or session.user_id != user.id:
            await websocket.close(code=4404, reason="Session not found")
            return

    await websocket.accept()
    chain = build_rag_chain()

    try:
        while True:
            question = await websocket.receive_text()

            # История диалога до текущего вопроса + сохранение вопроса пользователя
            async with get_db_context() as db:
                history_result = await db.execute(
                    select(ChatMessage)
                    .where(ChatMessage.session_id == session_id)
                    .order_by(ChatMessage.created_at.desc())
                    .limit(HISTORY_MAX_MESSAGES)
                )
                history = [
                    {"role": m.role, "content": m.content}
                    for m in reversed(history_result.scalars().all())
                ]

                user_msg = ChatMessage(session_id=session_id, role="user", content=question)
                db.add(user_msg)
                await db.commit()

                # Аналитика рынка труда (Спринт 2) — подмешивается, если вопрос об этом
                market_context = ""
                if is_market_question(question):
                    market_context = await build_market_context(db)

            # Стримим ответ LLM, не блокируя event loop
            chain_input = {"question": question, "history": history, "market_context": market_context}
            queue: asyncio.Queue = asyncio.Queue()
            asyncio.get_event_loop().run_in_executor(None, _stream_chain, chain, chain_input, queue)

            chunks: list[str] = []
            while True:
                item = await queue.get()
                if item is ... :
                    break
                if item is None:
                    await websocket.send_text("[ERROR]")
                    chunks = []
                    break
                chunks.append(item)
                await websocket.send_text(item)

            answer = "".join(chunks)
            sources = await _retrieve_sources(question) if answer else []

            # Сохраняем ответ ассистента
            async with get_db_context() as db:
                bot_msg = ChatMessage(
                    session_id=session_id,
                    role="assistant",
                    content=answer,
                    sources=json.dumps(sources, ensure_ascii=False),
                )
                db.add(bot_msg)
                if answer:
                    await _save_chat_memory(db, question, answer)
                await db.commit()

            await websocket.send_text("[DONE]")
    except WebSocketDisconnect:
        pass
