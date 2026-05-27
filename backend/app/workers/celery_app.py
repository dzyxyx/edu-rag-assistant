from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "edu_rag",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.workers.tasks.hh_ingest"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Europe/Moscow",
    enable_utc=True,
    broker_connection_retry_on_startup=True,
    # Windows: prefork не поддерживается, используй --pool=solo при запуске
    # celery -A app.workers.celery_app worker --loglevel=info --pool=solo
)

# Beat schedule — запускать каждую ночь в 03:00
celery_app.conf.beat_schedule = {
    "hh-ingest-nightly": {
        "task": "app.workers.tasks.hh_ingest.run_hh_ingest",
        "schedule": 60 * 60 * 24,   # каждые 24 часа
        "options": {"queue": "default"},
    },
}
