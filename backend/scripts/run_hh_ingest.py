"""
Запуск сбора компаний с HH.ru напрямую (без Celery).

Запуск:
    cd backend
    python scripts/run_hh_ingest.py

Что делает:
    Вызывает app.workers.tasks.hh_ingest._ingest() — получает токен,
    собирает компании по ключевым словам и сохраняет их в БД со скорингом.
    Требует запущенный PostgreSQL и применённые миграции (alembic upgrade head).
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.db.session import AsyncSessionFactory
from app.db.repositories.company import CompanyRepository
from app.workers.tasks.hh_ingest import _ingest
import app.db.models  # noqa: F401 — регистрирует все модели


async def main():
    print("=" * 60)
    print("Запуск hh_ingest...")
    print("=" * 60)

    await _ingest()

    print("\nРезультат — компании в БД:")
    print("-" * 60)
    async with AsyncSessionFactory() as session:
        repo = CompanyRepository(session)
        companies = await repo.list(limit=100)
        for c in companies:
            print(f"[{c.id}] {c.name} | score={c.score} | status={c.status} | source={c.source}")
        print("-" * 60)
        print(f"Всего компаний: {len(companies)}")


if __name__ == "__main__":
    asyncio.run(main())
