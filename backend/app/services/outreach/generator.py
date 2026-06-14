import asyncio
import logging

from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

from app.core.config import settings

logger = logging.getLogger(__name__)

FORMAL_PROMPT = """\
Ты — ассистент отдела по работе с работодателями УрФУ (Уральский федеральный университет).
Напиши деловое письмо компании с предложением о партнёрстве в формате стажировок для студентов.

Профиль компании:
- Название: {name}
- Отрасль: {industry}
- Описание: {description}
- Регион: {region}
- Размер: {employee_count} сотрудников
{memory_context}
Требования:
- Официальный деловой стиль
- Конкретное предложение: стажировки, практики, дипломные проекты
- Не более 180 слов
- Первая строка: "Тема: <тема письма>"
- Затем пустая строка и текст письма

Верни только тему и текст, ничего лишнего.
"""

INFORMAL_PROMPT = """\
Ты — представитель партнёрского отдела УрФУ.
Напиши живое дружелюбное письмо компании {name} с предложением о сотрудничестве.

Контекст о компании: {description}
Отрасль: {industry}, регион: {region}
{memory_context}
Стиль: без канцеляризмов, как от человека к человеку.
Цель: предложить взять студентов на стажировку или дипломный проект.
До 150 слов. Первая строка: "Тема: <тема письма>", затем пустая строка и текст.
"""


def _parse_subject_body(text: str) -> tuple[str, str]:
    lines = text.strip().splitlines()
    subject = "Предложение о сотрудничестве от УрФУ"
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


# TODO[MOCK]: удалить функцию целиком
def _mock_generate(company, tone: str, memory_context: str = "") -> tuple[str, str]:
    subject = f"[MOCK] Предложение о сотрудничестве — {company.name}"
    memory_note = f"\n\n[Учтена память агента]:\n{memory_context}" if memory_context else ""
    body = (
        f"Уважаемые коллеги из {company.name},\n\n"
        f"[MOCK_LLM=true — Ollama не вызывается]\n\n"
        f"Отрасль: {company.industry or 'IT'}, тон: {tone}.\n\n"
        f"УрФУ предлагает сотрудничество в формате стажировок."
        f"{memory_note}\n\n"
        f"С уважением,\nОтдел по работе с работодателями УрФУ"
    )
    logger.info("MOCK_LLM: сгенерировано письмо для %s", company.name)
    return subject, body


def _build_chain(tone: str):
    from langchain_ollama import ChatOllama
    llm = ChatOllama(
        base_url=settings.OLLAMA_BASE_URL,
        model=settings.OLLAMA_MODEL,
        temperature=0.5,
    )
    template = FORMAL_PROMPT if tone == "formal" else INFORMAL_PROMPT
    return ChatPromptTemplate.from_template(template) | llm | StrOutputParser()


async def generate_email(company, tone: str = "formal", memory_context: str = "") -> tuple[str, str]:
    """
    memory_context: текстовое резюме релевантных записей долгосрочной памяти
    (см. MemoryService.retrieve_relevant + format_memories), подставляется в промпт,
    чтобы агент учитывал прошлый опыт переписки с похожими компаниями (FR-6.3).
    """
    # TODO[MOCK]: удалить if-блок, оставить только реальную генерацию
    if settings.MOCK_LLM:
        return _mock_generate(company, tone, memory_context)

    chain = _build_chain(tone)
    memory_block = (
        f"\nУчти прошлый опыт агента (память):\n{memory_context}\n" if memory_context else "\n"
    )
    params = {
        "name": company.name,
        "industry": company.industry or "IT",
        "description": (company.description or "")[:500],
        "region": company.region or "Екатеринбург",
        "employee_count": company.employee_count or "н/д",
        "memory_context": memory_block,
    }
    try:
        raw = await asyncio.to_thread(chain.invoke, params)
        subject, body = _parse_subject_body(raw)
        logger.info("Сгенерировано письмо для %s: %s", company.name, subject)
        return subject, body
    except Exception as exc:
        logger.exception("Ошибка генерации письма для %s: %s", company.name, exc)
        raise
