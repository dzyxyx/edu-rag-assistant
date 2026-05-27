from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery(
    "edagent",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.workers.tasks.industry",
        "app.workers.tasks.companies",
        "app.workers.tasks.outreach",
        "app.workers.tasks.memory",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Europe/Moscow",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)

# Расписание периодических задач (Celery Beat)
celery_app.conf.beat_schedule = {
    # Обновление вакансий каждые 6 часов
    "sync-vacancies-hh": {
        "task": "app.workers.tasks.industry.sync_hh_vacancies",
        "schedule": crontab(minute=0, hour="*/6"),
    },
    # Мониторинг входящей почты каждые 15 минут
    "check-incoming-emails": {
        "task": "app.workers.tasks.outreach.check_incoming_emails",
        "schedule": crontab(minute="*/15"),
    },
    # Отправка follow-up писем раз в день в 10:00
    "send-followups": {
        "task": "app.workers.tasks.outreach.send_scheduled_followups",
        "schedule": crontab(hour=10, minute=0),
    },
}
