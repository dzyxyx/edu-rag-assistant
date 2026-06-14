"""
Спринт 7 — генерация технического задания (ТЗ) для студенческого проекта (FR-5.*).

По аналогии с services/communications/generator.py: MOCK_LLM=true — Ollama не
вызывается, возвращается заглушка с префиксом [MOCK]. В реальном режиме —
LangChain-цепочка ChatOllama + ChatPromptTemplate + StrOutputParser.

Помимо текста ТЗ агент предлагает базовый набор ролей (FR-5.3): набор ролей
зависит от уровня сложности (difficulty) и не требует LLM — это эвристика,
которую куратор может отредактировать руками после генерации.
"""
from __future__ import annotations

import asyncio
import logging

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate

from app.core.config import settings
from app.db.models.project import ProjectRole

logger = logging.getLogger(__name__)


SPEC_PROMPT = """\
Ты — ассистент отдела по работе с работодателями УрФУ (Уральский федеральный университет).
Сформируй техническое задание (ТЗ) для студенческого проекта.

Название проекта: {title}
Краткое описание: {description}
Отрасль/направление: {industry}
{priority_area_context}

ТЗ должно включать: цель проекта, краткое описание объёма работ, ожидаемый
результат (deliverables), используемые технологии (на основе описания и отрасли).
Стиль: официальный деловой. Не более 200 слов.

Первая строка: "Название: <короткое название>"
Затем пустая строка и текст ТЗ. Верни только название и текст, ничего лишнего.
"""

# Базовые наборы ролей по уровню сложности (FR-5.3).
_ROLE_SETS: dict[str, list[dict]] = {
    "easy": [
        {"role": ProjectRole.DEVELOPER, "slots_count": 2, "skills_required": ["Python", "Git"]},
        {"role": ProjectRole.TESTER, "slots_count": 1, "skills_required": ["Тестирование", "Документация"]},
    ],
    "medium": [
        {"role": ProjectRole.ANALYST, "slots_count": 1, "skills_required": ["Сбор требований", "UML"]},
        {"role": ProjectRole.DEVELOPER, "slots_count": 2, "skills_required": ["Python", "FastAPI", "SQL"]},
        {"role": ProjectRole.DESIGNER, "slots_count": 1, "skills_required": ["Figma", "UI/UX"]},
        {"role": ProjectRole.TESTER, "slots_count": 1, "skills_required": ["Тестирование", "pytest"]},
    ],
    "hard": [
        {"role": ProjectRole.MANAGER, "slots_count": 1, "skills_required": ["Управление проектами", "Scrum"]},
        {"role": ProjectRole.ANALYST, "slots_count": 1, "skills_required": ["Сбор требований", "UML"]},
        {"role": ProjectRole.DEVELOPER, "slots_count": 3, "skills_required": ["Python", "FastAPI", "Docker"]},
        {"role": ProjectRole.DESIGNER, "slots_count": 1, "skills_required": ["Figma", "UI/UX"]},
        {"role": ProjectRole.DEVOPS, "slots_count": 1, "skills_required": ["Docker", "CI/CD"]},
        {"role": ProjectRole.TESTER, "slots_count": 1, "skills_required": ["Тестирование", "pytest"]},
    ],
}

_DURATION_BY_DIFFICULTY = {"easy": 4, "medium": 8, "hard": 12}


def suggest_role_slots(difficulty: str) -> list[dict]:
    """Возвращает базовый набор ролей для указанного уровня сложности (FR-5.3)."""
    return [dict(slot) for slot in _ROLE_SETS.get(difficulty, _ROLE_SETS["medium"])]


def _parse_title_spec(text: str, default_title: str) -> tuple[str, str]:
    lines = text.strip().splitlines()
    title = default_title
    body_start = 0

    for i, line in enumerate(lines):
        if line.strip().lower().startswith("название:"):
            title = line.split(":", 1)[-1].strip()
            body_start = i + 1
            break

    while body_start < len(lines) and not lines[body_start].strip():
        body_start += 1

    spec = "\n".join(lines[body_start:]).strip() or text.strip()
    return title, spec


# TODO[MOCK]: удалить функцию целиком после подключения реальной LLM (S3-1)
def _mock_generate(title: str, description: str | None, industry: str | None, priority_area: str | None) -> str:
    parts = [
        f"[MOCK_LLM=true — Ollama не вызывается]",
        f"Цель проекта: {description or title}.",
        f"Отрасль: {industry or 'IT'}.",
    ]
    if priority_area:
        parts.append(f"Учтена приоритетная область: {priority_area}.")
    parts.append(
        "Объём работ: проектирование, разработка, тестирование и документирование решения. "
        "Ожидаемый результат: рабочий прототип с исходным кодом и кратким отчётом."
    )
    return "\n\n".join(parts)


def _build_chain():
    from app.services.llm.factory import get_chat_llm

    llm = get_chat_llm(temperature=0.5)
    return ChatPromptTemplate.from_template(SPEC_PROMPT) | llm | StrOutputParser()


async def generate_technical_spec(
    title: str,
    description: str | None = None,
    industry: str | None = None,
    priority_area: str | None = None,
    difficulty: str = "medium",
) -> dict:
    """
    Генерирует ТЗ для проекта и предлагает набор ролей (FR-5.1, FR-5.3).

    Возвращает dict:
        - technical_spec: str
        - suggested_title: str (может отличаться от исходного title)
        - duration_weeks: int
        - role_slots: list[{"role", "slots_count", "skills_required"}]
    """
    difficulty = difficulty if difficulty in _ROLE_SETS else "medium"

    if settings.MOCK_LLM:
        spec = _mock_generate(title, description, industry, priority_area)
        suggested_title = title
    else:
        chain = _build_chain()
        priority_area_context = (
            f"Учти приоритетную область подготовки: {priority_area}." if priority_area else ""
        )
        try:
            raw = await asyncio.to_thread(
                chain.invoke,
                {
                    "title": title,
                    "description": description or "",
                    "industry": industry or "IT",
                    "priority_area_context": priority_area_context,
                },
            )
            suggested_title, spec = _parse_title_spec(raw, default_title=title)
        except Exception:
            logger.exception("Ошибка генерации ТЗ для проекта '%s'", title)
            raise

    return {
        "technical_spec": spec,
        "suggested_title": suggested_title,
        "duration_weeks": _DURATION_BY_DIFFICULTY.get(difficulty, 8),
        "role_slots": suggest_role_slots(difficulty),
    }
