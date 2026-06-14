"""
Запуск NLP-пайплайна извлечения компетенций напрямую (без Celery).

Запуск:
    cd backend
    python scripts/run_nlp_pipeline.py

Что делает (Спринт 2):
    1. Берёт необработанные вакансии (Vacancy.is_processed=False).
    2. Извлекает компетенции (spaCy + словарь, FR-1.2).
    3. Сохраняет компетенции и связи vacancy<->competency, пересчитывает demand_score.
    4. Строит матрицу компетенция-отрасль (FR-1.3) и формирует предложения
       приоритетных областей (FR-1.5), которые затем нужно утвердить через API.

Требует запущенный PostgreSQL и применённые миграции (alembic upgrade head).
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import app.db.models  # noqa: F401 — регистрирует все модели
from app.db.session import AsyncSessionFactory
from app.db.repositories.competency import CompetencyRepository
from app.db.repositories.priority_area import PriorityAreaRepository
from app.workers.tasks.nlp_process import _process


async def main():
    print("=" * 60)
    print("Запуск NLP-пайплайна извлечения компетенций (Спринт 2)")
    print("=" * 60)

    result = await _process(batch_size=1000)
    print(f"\nОбработано вакансий:     {result['processed_vacancies']}")
    print(f"Найдено компетенций:     {result['competencies_found']}")
    print(f"Отраслей с предложениями: {result['priority_area_industries']}")

    async with AsyncSessionFactory() as session:
        comp_repo = CompetencyRepository(session)
        area_repo = PriorityAreaRepository(session)

        print("\nТоп компетенций по спросу:")
        print("-" * 60)
        for c in await comp_repo.list(limit=20):
            print(f"  [{c.id}] {c.name:<25} cat={c.category or '-':<12} "
                  f"freq={c.frequency:<4} demand={c.demand_score}")

        print("\nПредложения приоритетных областей (ожидают утверждения):")
        print("-" * 60)
        for area in await area_repo.list(status="proposed"):
            print(f"  [{area.id}] {area.name} | score={area.score}")


if __name__ == "__main__":
    asyncio.run(main())
