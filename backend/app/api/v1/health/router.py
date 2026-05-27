import httpx
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.redis import get_redis
from app.db.session import get_db

router = APIRouter()


@router.get("")
async def health_check(
        db: AsyncSession = Depends(get_db),
        redis=Depends(get_redis),
):
    """
    Проверяет доступность всех зависимостей.
    Возвращает status: ok | degraded | down
    """
    checks = {}

    # 1. PostgreSQL
    try:
        await db.execute(text("SELECT 1"))
        checks["postgres"] = "ok"
    except Exception as e:
        checks["postgres"] = f"error: {e}"

    # 2. Redis
    try:
        pong = await redis.ping()
        checks["redis"] = "ok" if pong else "no response"
    except Exception as e:
        checks["redis"] = f"error: {e}"

    # 3. Chroma (HTTP-ping)
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(
                f"http://{settings.CHROMA_HOST}:{settings.CHROMA_PORT}/api/v2/heartbeat"
            )
            checks["chroma"] = "ok" if resp.status_code == 200 else f"status {resp.status_code}"
    except Exception as e:
        checks["chroma"] = f"error: {e}"

    # 4. Ollama (HTTP-ping + проверка наличия модели)
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            if resp.status_code == 200:
                models = [m["name"] for m in resp.json().get("models", [])]
                model_ok = any(settings.OLLAMA_MODEL.split(":")[0] in m for m in models)
                checks["ollama"] = "ok" if model_ok else f"model '{settings.OLLAMA_MODEL}' not found (pull it)"
            else:
                checks["ollama"] = f"status {resp.status_code}"
    except Exception as e:
        checks["ollama"] = f"error: {e}"

    all_ok = all(v == "ok" for v in checks.values())
    return {
        "status": "ok" if all_ok else "degraded",
        "services": checks,
    }
