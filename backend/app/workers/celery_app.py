from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "edu_rag",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.workers.tasks.hh_ingest",
        "app.workers.tasks.rag_ingest",
        "app.workers.tasks.outreach",
        "app.workers.tasks.nlp_process",
        "app.workers.tasks.scoring",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Europe/Moscow",
    enable_utc=True,
    broker_connection_retry_on_startup=True,
)

celery_app.conf.beat_schedule = {
    "hh-ingest-nightly": {
        "task": "app.workers.tasks.hh_ingest.run_hh_ingest",
        "schedule": 60 * 60 * 24,
        "options": {"queue": "default"},
    },
    "rag-ingest-weekly": {
        "task": "app.workers.tasks.rag_ingest.run_rag_ingest",
        "schedule": 60 * 60 * 24 * 7,
        "options": {"queue": "default"},
    },
    "outreach-follow-ups": {
        "task": "app.workers.tasks.outreach.check_follow_ups",
        "schedule": 60 * 60 * 12,
        "options": {"queue": "default"},
    },
    "nlp-process-nightly": {
        "task": "app.workers.tasks.nlp_process.run_nlp_process",
        "schedule": 60 * 60 * 24,
        "options": {"queue": "default"},
    },
    "scoring-recompute-daily": {
        "task": "app.workers.tasks.scoring.run_scoring_recompute",
        "schedule": 60 * 60 * 24,
        "options": {"queue": "default"},
    },
}
