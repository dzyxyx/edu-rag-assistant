"""Sprint 9/10 (S9-9/S10-4): метрики Prometheus + хуки Sentry.

Обе интеграции — "no-op" при отсутствии конфигурации:
- ``init_sentry()`` ничего не делает, если ``settings.SENTRY_DSN`` пуст.
- ``setup_metrics()`` всегда подключает ``prometheus-fastapi-instrumentator``
  и публикует эндпоинт ``/metrics`` — он не требует внешних сервисов и
  безопасен даже в dev/тестовом окружении.
"""
import logging

from fastapi import FastAPI

from app.core.config import settings

logger = logging.getLogger(__name__)


def init_sentry() -> None:
    """Инициализирует Sentry SDK, если задан ``SENTRY_DSN``.

    Без DSN — полный no-op (вызов безопасен и в тестах, и в dev).
    """
    if not settings.SENTRY_DSN:
        return

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration

        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.ENVIRONMENT,
            release=settings.VERSION,
            integrations=[StarletteIntegration(), FastApiIntegration()],
            traces_sample_rate=0.1,
        )
        logger.info("Sentry инициализирован (environment=%s)", settings.ENVIRONMENT)
    except Exception:
        logger.exception("Не удалось инициализировать Sentry SDK")


def setup_metrics(app: FastAPI) -> None:
    """Подключает Prometheus-метрики и эндпоинт ``GET /metrics``."""
    try:
        from prometheus_fastapi_instrumentator import Instrumentator

        Instrumentator().instrument(app).expose(
            app, endpoint="/metrics", include_in_schema=False
        )
        logger.info("Prometheus instrumentator подключён (/metrics)")
    except Exception:
        logger.exception("Не удалось подключить prometheus-fastapi-instrumentator")
