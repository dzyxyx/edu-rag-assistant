"""Юнит-тесты RAG loader — без Chroma и Ollama."""
import pytest

from app.services.rag.loader import load_knowledge_base


def test_loader_splits_documents(tmp_path):
    """load_knowledge_base нарезает markdown на несколько чанков."""
    (tmp_path / "agile").mkdir()
    (tmp_path / "agile" / "test.md").write_text(
        "# Agile\n\n" + "Текст про agile методологию. " * 60,
        encoding="utf-8",
    )
    docs = load_knowledge_base(tmp_path)
    assert len(docs) > 1
    for d in docs:
        assert len(d.page_content) <= 920  # chunk_size + overlap


def test_loader_empty_dir(tmp_path):
    """Пустая директория возвращает пустой список."""
    docs = load_knowledge_base(tmp_path)
    assert docs == []


def test_loader_preserves_metadata(tmp_path):
    """Метаданные topic и source корректно заполняются."""
    (tmp_path / "scrum").mkdir()
    (tmp_path / "scrum" / "roles.md").write_text(
        "# Роли Scrum\n\nProduct Owner отвечает за бэклог.",
        encoding="utf-8",
    )
    docs = load_knowledge_base(tmp_path)
    assert len(docs) >= 1
    assert docs[0].metadata["topic"] == "scrum"
    assert docs[0].metadata["source"] == "roles.md"


def test_loader_multiple_topics(tmp_path):
    """Файлы из разных тем получают правильный topic."""
    for topic in ("agile", "scrum", "devops"):
        (tmp_path / topic).mkdir()
        (tmp_path / topic / "intro.md").write_text(
            f"# {topic.capitalize()}\n\nВведение в {topic}.",
            encoding="utf-8",
        )
    docs = load_knowledge_base(tmp_path)
    topics = {d.metadata["topic"] for d in docs}
    assert topics == {"agile", "scrum", "devops"}


def test_loader_real_knowledge_base():
    """Реальная база знаний загружается и даёт разумное количество чанков."""
    from pathlib import Path
    kb_dir = Path(__file__).parent.parent.parent / "knowledge_base"
    if not kb_dir.exists():
        pytest.skip("knowledge_base не найдена")
    docs = load_knowledge_base(kb_dir)
    # 10 файлов, каждый ~500-1500 слов → ожидаем 20-80 чанков
    assert 15 <= len(docs) <= 100
    assert all(d.metadata.get("topic") for d in docs)
