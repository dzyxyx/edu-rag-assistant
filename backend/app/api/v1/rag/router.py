from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

@router.websocket("/ws/chat/{session_id}")
async def chat_ws(websocket: WebSocket, session_id: str):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            # TODO: передать в RAG pipeline
            await websocket.send_text(f"[echo] {data}")
    except WebSocketDisconnect:
        pass
