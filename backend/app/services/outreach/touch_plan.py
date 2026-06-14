"""FR-3.6 (Sprint 5): «План касаний» — формализованная последовательность
контактов с компанией-партнёром в рамках одной outreach-кампании.

Касание №0 — первичное письмо (outreach). Каждое следующее касание —
follow-up с порядковым номером ``follow_up_number`` (1, 2, ...), отправляемый
через ``OUTREACH_TOUCH_PLAN_DAYS[follow_up_number - 1]`` дней после
предыдущего, если компания не ответила.

Когда план касаний исчерпан (все follow-up отправлены, ответа нет) —
``next_touch_after_days`` возвращает ``None``, и дальнейшая обработка
(например, эскалация на человека / перевод в ESCALATED) выполняется выше по
стеку (Celery-задача ``check_follow_ups``).
"""
from dataclasses import dataclass

from app.core.config import settings


@dataclass(frozen=True)
class TouchStep:
    """Один шаг плана касаний."""

    follow_up_number: int  # 0 — первичное письмо, 1..N — follow-up'ы
    after_days: int | None  # через сколько дней после предыдущего касания
    description: str


def _build_plan() -> list[TouchStep]:
    plan = [TouchStep(0, None, "Первичное письмо (outreach)")]
    for i, days in enumerate(settings.OUTREACH_TOUCH_PLAN_DAYS, start=1):
        plan.append(TouchStep(i, days, f"Follow-up №{i}"))
    return plan


def get_touch_plan() -> list[TouchStep]:
    """Возвращает текущий план касаний (зависит от настроек, поэтому строится
    динамически — удобно для тестов, переопределяющих ``OUTREACH_TOUCH_PLAN_DAYS``)."""
    return _build_plan()


def max_follow_ups() -> int:
    """Максимальное количество follow-up'ов в плане касаний."""
    return len(settings.OUTREACH_TOUCH_PLAN_DAYS)


def next_touch_after_days(current_follow_up_number: int) -> int | None:
    """
    Сколько дней нужно подождать перед следующим касанием после касания
    с номером ``current_follow_up_number``.

    Возвращает ``None``, если план касаний исчерпан (следующего касания не
    предусмотрено — пора эскалировать на человека).
    """
    days_list = settings.OUTREACH_TOUCH_PLAN_DAYS
    next_index = current_follow_up_number  # follow_up_number=0 → days_list[0]
    if next_index < len(days_list):
        return days_list[next_index]
    return None


def is_plan_exhausted(follow_up_number: int) -> bool:
    """True, если для текущего касания дальнейших follow-up'ов в плане нет."""
    return follow_up_number >= max_follow_ups()
