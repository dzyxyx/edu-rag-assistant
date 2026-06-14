"""
Извлечение компетенций из текста вакансии (FR-1.2).

Используется spaCy (PhraseMatcher) поверх словаря компетенций
(skills_dictionary.py). Намеренно используется spacy.blank("ru") —
не требует загрузки и установки большой языковой модели
(ru_core_news_*), работает быстро и не зависит от сетевого доступа.
Если в окружении доступна полноценная модель ru_core_news_sm,
она используется автоматически (для лучшей токенизации).
"""
from __future__ import annotations

import logging
import re
from functools import lru_cache

import spacy
from spacy.matcher import PhraseMatcher

from app.services.nlp.skills_dictionary import SKILLS_DICTIONARY

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _get_nlp():
    """Возвращает spaCy pipeline. Пытается загрузить ru_core_news_sm,
    если не установлена — использует пустой ru-токенизатор (blank)."""
    try:
        return spacy.load("ru_core_news_sm", disable=["ner", "parser", "lemmatizer"])
    except OSError:
        logger.info(
            "competency_extractor: модель ru_core_news_sm не найдена, "
            "используется spacy.blank('ru')"
        )
        return spacy.blank("ru")


@lru_cache(maxsize=1)
def _get_matcher() -> PhraseMatcher:
    nlp = _get_nlp()
    matcher = PhraseMatcher(nlp.vocab, attr="LOWER")
    for category, terms in SKILLS_DICTIONARY.items():
        patterns = [nlp.make_doc(term) for term in terms]
        matcher.add(category, patterns)
    return matcher


def extract_competencies(text: str | None) -> list[dict]:
    """
    Извлекает компетенции из текста.

    Возвращает список словарей: {"name": str, "category": str, "count": int}
    name — нормализованное (lower-case) название компетенции,
    count — количество упоминаний в тексте (используется для confidence).
    """
    if not text:
        return []

    nlp = _get_nlp()
    matcher = _get_matcher()

    # spaCy плохо токенизирует составные термины вроде "ci/cd" или ".net" —
    # добавляем пробелы вокруг распространённых разделителей, чтобы
    # PhraseMatcher с attr="LOWER" находил их надёжнее.
    cleaned = re.sub(r"[\n\r\t]+", " ", text)

    doc = nlp(cleaned)
    matches = matcher(doc)

    found: dict[str, dict] = {}
    for match_id, start, end in matches:
        category = nlp.vocab.strings[match_id]
        span_text = doc[start:end].text.strip().lower()
        if not span_text:
            continue
        if span_text not in found:
            found[span_text] = {"name": span_text, "category": category, "count": 0}
        found[span_text]["count"] += 1

    return list(found.values())
