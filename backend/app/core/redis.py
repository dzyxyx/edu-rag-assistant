from typing import AsyncGenerator

import redis.asyncio as aioredis
from redis.asyncio import Redis

from app.core.config import settings

_redis_pool: Redis | None = None


async def init_redis() -> Redis:
    """Инициализирует пул соединений Redis. Вызывается в lifespan."""
    global _redis_pool
    _redis_pool = aioredis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True,
        max_connections=20,
    )
    return _redis_pool


async def close_redis() -> None:
    """Закрывает соединения. Вызывается при shutdown."""
    global _redis_pool
    if _redis_pool:
        await _redis_pool.aclose()
        _redis_pool = None


async def get_redis() -> AsyncGenerator[Redis, None]:
    """FastAPI dependency — инжектит Redis-клиент в endpoint."""
    if _redis_pool is None:
        raise RuntimeError("Redis not initialised")
    yield _redis_pool
