"""Rate limiting (slowapi) — Sprint 1 (S1-7).

Единый Limiter для всего приложения. Лимит по умолчанию настраивается через
``settings.RATE_LIMIT_PER_MINUTE`` (env: ``RATE_LIMIT_PER_MINUTE``).

Ключ лимита — IP-адрес клиента (``get_remote_address``). Для тестов и при
``RATE_LIMIT_PER_MINUTE`` <= 0 лимитер фактически не ограничивает запросы
(используется очень большое значение / отключение через slowapi enabled flag).
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[],
    enabled=settings.RATE_LIMIT_PER_MINUTE > 0,
)


def rate_limit_string() -> str:
    """Строка лимита для декоратора @limiter.limit(...), напр. "60/minute"."""
    return f"{settings.RATE_LIMIT_PER_MINUTE}/minute"
