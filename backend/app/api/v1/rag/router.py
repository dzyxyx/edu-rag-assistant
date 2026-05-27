import asyncio
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.rag.schemas import ChatRequest, ChatResponse, MessageOut, SessionOut
from app.core.config import settings
from app.core.dependencies import get_current_active_user
from app.db.models.chat import ChatMessage, ChatSession
from app.db.models.user import User
from app.db.session import get_db
from app.services.rag.chain import build_rag_chain

logger = logging.getLogger(__name__)
router = APIRouter()


# ── POST /rag/chat ─────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
async def chat(
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

    # Сохраняем вопрос пользователя
    user_msg = ChatMessage(session_id=session.id, role="user", content=req.question)
    db.add(user_msg)
    await db.flush()

    # RAG-цепочка (синхронный invoke в отдельном потоке)
    chain = build_rag_chain()
    try:
        answer = await asyncio.to_thread(chain.invoke, req.question)
    except Exception as exc:
        logger.exception("RAG chain error: %s", exc)
        raise HTTPException(status_code=503, detail="LLM service unavailable")

    # Sources из Chroma
    # TODO[MOCK]: удалить if-блок, оставить только реальную логику
    if settings.MOCK_LLM:
        sources = []
    else:
        from app.services.rag.vector_store import get_vector_store
        store = get_vector_store()
        relevant = await asyncio.to_thread(store.similarity_search, req.question, k=3)
        sources = list({
            f"{d.metadata.get('topic', '')}/{d.metadata.get('source', '')}"
            for d in relevant
        })

    # Сохраняем ответ ассистента
    bot_msg = ChatMessage(
        session_id=session.id,
        role="assistant",
        content=answer,
        sources=json.dumps(sources, ensure_ascii=False),
    )
    db.add(bot_msg)
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

@router.websocket("/ws/chat/{session_id}")
async def chat_ws(websocket: WebSocket, session_id: str):
    await websocket.accept()
    chain = build_rag_chain()
    try:
        while True:
            question = await websocket.receive_text()
            for chunk in chain.stream(question):
                await websocket.send_text(chunk)
            await websocket.send_text("[DONE]")
    except WebSocketDisconnect:
        pass
