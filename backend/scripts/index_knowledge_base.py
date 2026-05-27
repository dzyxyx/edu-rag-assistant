"""
Индексация базы знаний в Chroma.

Запуск:
    cd backend
    python scripts/index_knowledge_base.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.rag.loader import load_knowledge_base
from app.services.rag.vector_store import get_vector_store

KB_DIR = Path(__file__).parent.parent / "knowledge_base"


def main():
    print(f"Загрузка базы знаний из: {KB_DIR}")
    docs = load_knowledge_base(KB_DIR)
    if not docs:
        print("ОШИБКА: документы не найдены!")
        sys.exit(1)

    print(f"Загружено чанков: {len(docs)}")
    by_topic = {}
    for d in docs:
        t = d.metadata.get("topic", "unknown")
        by_topic[t] = by_topic.get(t, 0) + 1
    for topic, count in sorted(by_topic.items()):
        print(f"  {topic}: {count} чанков")

    print("\nПодключение к Chroma...")
    store = get_vector_store()

    print("Сброс коллекции и индексация...")
    store.reset_collection()
    store.add_documents(docs)

    print(f"\nГотово! Проиндексировано {len(docs)} чанков.")
    print("\nПроверка поиска...")
    results = store.similarity_search("Что такое Sprint?", k=3)
    for i, r in enumerate(results, 1):
        print(f"  [{i}] {r.metadata.get('topic')}/{r.metadata.get('source')} — {r.page_content[:80]}...")


if __name__ == "__main__":
    main()
