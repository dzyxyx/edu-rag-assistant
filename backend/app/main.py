from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.limiter import limiter
from app.core.logging import setup_logging
from app.core.observability import init_sentry, setup_metrics
from app.core.redis import init_redis, close_redis
import app.db.models  # noqa: F401 — регистрирует все модели в маппере SQLAlchemy


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    await init_redis()
    # TODO: init DB pool, Chroma client
    yield
    await close_redis()


def create_app() -> FastAPI:
    init_sentry()

    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
        docs_url=f"{settings.API_V1_PREFIX}/docs",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    setup_metrics(app)

    return app


app = create_app()
