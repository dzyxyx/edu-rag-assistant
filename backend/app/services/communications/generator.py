"""
Спринт 5 — общий сервис генерации текста коммуникаций (FR-5.*).

Помимо outreach-писем (Спринт 6, делегируется в services.outreach.generator),
умеет генерировать follow-up напоминания, вежливые отказы, приглашения компаний
к участию в студенческих проектах (Спринт 7) и внутренние уведомления для
human-in-the-loop (Спринт 9).

MOCK_LLM=true — Ollama не вызывается, возвращаются заглушки с префиксом [MOCK].
"""
from __future__ import annotations

import asyncio
import logging
from enum import StrEnum

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate

from app.core.config import settings
from app.services.outreach.generator import generate_email as _generate_outreach_email

logger = logging.getLogger(__name__)


class CommunicationType(StrEnum):
    OUTREACH = "outreach"
    FOLLOW_UP = "follow_up"
    REJECTION = "rejection"
    PROJECT_INVITATION = "project_invitation"
    NOTIFICATION = "notification"


COMMUNICATION_DESCRIPTIONS: dict[CommunicationType, str] = {
    CommunicationType.OUTREACH: "Первичное письмо компании с предложением о партнёрстве (стажировки/практики).",
    CommunicationType.FOLLOW_UP: "Письмо-напоминание компании, не ответившей на предыдущее письмо.",
    CommunicationType.REJECTION: "Вежливый ответ компании при отказе от дальнейшего сотрудничества.",
    CommunicationType.PROJECT_INVITATION: "Приглашение компании выступить заказчиком студенческого проекта (ТЗ).",
    CommunicationType.NOTIFICATION: "Внутреннее уведомление сотруднику УрФУ о событии, требующем внимания (human-in-the-loop).",
}


FOLLOW_UP_PROMPT = """\
Ты — ассистент отдела по работе с работодателями УрФУ (Уральский федеральный университет).
Компания {name} ({industry}, регион {region}) ранее получила от нас письмо с темой
"{previous_subject}", но пока не ответила.
{memory_context}
Напиши короткое вежливое письмо-напоминание (follow-up №{follow_up_number}).
Стиль: {tone_hint}. Не более 100 слов.

Первая строка: "Тема: <тема письма>"
Затем пустая строка и текст письма. Верни только тему и текст, ничего лишнего.
"""

REJECTION_PROMPT = """\
Ты — ассистент отдела по работе с работодателями УрФУ.
Компания {name} ({industry}) откликнулась на наше предложение о сотрудничестве,
но по итогам рассмотрения мы вежливо отказываемся от дальнейшего взаимодействия сейчас.
Причина (внутренняя, не упоминай явно если неуместно): {reason}.
{memory_context}
Напиши корректное письмо-отказ, оставляющее возможность вернуться к сотрудничеству в будущем.
Стиль: {tone_hint}. Не более 120 слов.

Первая строка: "Тема: <тема письма>"
Затем пустая строка и текст письма. Верни только тему и текст, ничего лишнего.
"""

PROJECT_INVITATION_PROMPT = """\
Ты — ассистент отдела по работе с работодателями УрФУ.
Компания {name} ({industry}) — партнёр университета.
Пригласи компанию выступить заказчиком студенческого проекта «{project_name}».
Описание проекта: {project_description}
{memory_context}
Стиль: {tone_hint}. Не более 150 слов.

Первая строка: "Тема: <тема письма>"
Затем пустая строка и текст письма. Верни только тему и текст, ничего лишнего.
"""

NOTIFICATION_PROMPT = """\
Сформируй короткое внутреннее уведомление для сотрудника УрФУ (роль: {recipient_role}).
Событие, требующее внимания: {message}
Не более 40 слов, по делу, без приветствий и подписи.

Первая строка: "Тема: <тема>"
Затем пустая строка и текст уведомления. Верни только тему и текст, ничего лишнего.
"""

_PROMPTS: dict[CommunicationType, str] = {
    CommunicationType.FOLLOW_UP: FOLLOW_UP_PROMPT,
    CommunicationType.REJECTION: REJECTION_PROMPT,
    CommunicationType.PROJECT_INVITATION: PROJECT_INVITATION_PROMPT,
    CommunicationType.NOTIFICATION: NOTIFICATION_PROMPT,
}

_TONE_HINTS: dict[str, str] = {
    "formal": "официальный деловой стиль",
    "informal": "дружелюбный, неформальный стиль, без канцеляризмов",
}


def _parse_subject_body(text: str, default_subject: str) -> tuple[str, str]:
    lines = text.strip().splitlines()
    subject = default_subject
    body_start = 0

    for i, line in enumerate(lines):
        if line.strip().lower().startswith("тема:"):
            subject = line.split(":", 1)[-1].strip()
            body_start = i + 1
            break

    while body_start < len(lines) and not lines[body_start].strip():
        body_start += 1

    body = "\n".join(lines[body_start:]).strip() or text.strip()
    return subject, body


# TODO[MOCK]: удалить функцию целиком после подключения реальной LLM (S3-1)
def _mock_generate(comm_type: CommunicationType, params: dict, tone: str) -> tuple[str, str]:
    name = params["name"]
    memory_note = f"\n\n[Учтена память агента]:\n{params['memory_context']}" if params.get("memory_context") else ""

    if comm_type == CommunicationType.FOLLOW_UP:
        subject = f"[MOCK] Напоминание: предложение о сотрудничестве — {name}"
        body = (
            f"Уважаемые коллеги из {name},\n\n"
            f"[MOCK_LLM=true — Ollama не вызывается]\n\n"
            f"Напоминаем о письме «{params['previous_subject']}» "
            f"(follow-up №{params['follow_up_number']}, тон: {tone})."
            f"{memory_note}\n\n"
            f"С уважением,\nОтдел по работе с работодателями УрФУ"
        )
    elif comm_type == CommunicationType.REJECTION:
        subject = f"[MOCK] Ответ по сотрудничеству — {name}"
        body = (
            f"Уважаемые коллеги из {name},\n\n"
            f"[MOCK_LLM=true — Ollama не вызывается]\n\n"
            f"Благодарим за обращение. {params['reason']}. "
            f"Будем рады вернуться к диалогу в будущем (тон: {tone})."
            f"{memory_note}\n\n"
            f"С уважением,\nОтдел по работе с работодателями УрФУ"
        )
    elif comm_type == CommunicationType.PROJECT_INVITATION:
        subject = f"[MOCK] Приглашение к проекту «{params['project_name']}» — {name}"
        body = (
            f"Уважаемые коллеги из {name},\n\n"
            f"[MOCK_LLM=true — Ollama не вызывается]\n\n"
            f"Приглашаем выступить заказчиком студенческого проекта «{params['project_name']}»: "
            f"{params['project_description']} (тон: {tone})."
            f"{memory_note}\n\n"
            f"С уважением,\nОтдел по работе с работодателями УрФУ"
        )
    elif comm_type == CommunicationType.NOTIFICATION:
        subject = f"[MOCK] Уведомление ({params['recipient_role']})"
        body = f"[MOCK_LLM=true] {params['message']}"
    else:  # pragma: no cover - защищено CommunicationType(...)
        raise ValueError(f"Unsupported communication type: {comm_type}")

    logger.info("MOCK_LLM: сгенерирована коммуникация type=%s для %s", comm_type, name)
    return subject, body


def _build_chain(comm_type: CommunicationType):
    from app.services.llm.factory import get_chat_llm

    llm = get_chat_llm(temperature=0.5)
    template = _PROMPTS[comm_type]
    return ChatPromptTemplate.from_template(template) | llm | StrOutputParser()


async def generate_communication(
    comm_type: CommunicationType | str,
    company=None,
    tone: str = "formal",
    memory_context: str = "",
    **extra,
) -> tuple[str, str]:
    """
    Универсальная генерация текста коммуникации (FR-5.*).

    Параметры:
    - comm_type: один из CommunicationType (outreach/follow_up/rejection/
      project_invitation/notification).
    - company: ORM-объект Company — обязателен для всех типов, кроме notification.
    - tone: "formal" | "informal".
    - memory_context: текстовое резюме релевантных записей долгосрочной памяти
      агента (см. MemoryService.retrieve_relevant + format_memories), учитывается
      при генерации (FR-6.3).
    - extra: доп. параметры конкретного типа:
        follow_up: previous_subject, follow_up_number
        rejection: reason
        project_invitation: project_name, project_description
        notification: recipient_role, message

    Возвращает (subject, body).
    """
    comm_type = CommunicationType(comm_type)

    # outreach — отдельная LangGraph-связанная логика (Спринт 4/6), не дублируем
    if comm_type == CommunicationType.OUTREACH:
        if company is None:
            raise ValueError("company обязателен для типа 'outreach'")
        return await _generate_outreach_email(company, tone=tone, memory_context=memory_context)

    if comm_type != CommunicationType.NOTIFICATION and company is None:
        raise ValueError(f"company обязателен для типа '{comm_type}'")

    params: dict = {
        "name": getattr(company, "name", None) or extra.get("name", "компания"),
        "industry": getattr(company, "industry", None) or "IT",
        "description": (getattr(company, "description", None) or "")[:500],
        "region": getattr(company, "region", None) or "Екатеринбург",
        "employee_count": getattr(company, "employee_count", None) or "н/д",
        "tone_hint": _TONE_HINTS.get(tone, _TONE_HINTS["formal"]),
        "memory_context": memory_context,
        # значения по умолчанию для специфичных полей типов
        "previous_subject": extra.get("previous_subject", ""),
        "follow_up_number": extra.get("follow_up_number", 1),
        "reason": extra.get("reason", "приоритеты направления сотрудничества изменились"),
        "project_name": extra.get("project_name", ""),
        "project_description": extra.get("project_description", ""),
        "recipient_role": extra.get("recipient_role", "координатор"),
        "message": extra.get("message", ""),
    }

    if settings.MOCK_LLM:
        return _mock_generate(comm_type, params, tone)

    chain = _build_chain(comm_type)
    prompt_params = {
        **params,
        "memory_context": (
            f"\nУчти прошлый опыт агента (память):\n{memory_context}\n" if memory_context else "\n"
        ),
    }
    try:
        raw = await asyncio.to_thread(chain.invoke, prompt_params)
        subject, body = _parse_subject_body(raw, default_subject=f"Сообщение от УрФУ — {params['name']}")
        logger.info("Сгенерирована коммуникация type=%s для %s: %s", comm_type, params["name"], subject)
        return subject, body
    except Exception as exc:
        logger.exception("Ошибка генерации коммуникации type=%s для %s: %s", comm_type, params["name"], exc)
        raise
