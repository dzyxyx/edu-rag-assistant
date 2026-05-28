# Backend — edu-rag-assistant

Два продукта в одном сервисе: **EdAgent** — RAG-ассистент для студентов по Agile/Scrum/DevOps, и **RH AI memory** — автономный агент для поиска партнёров-работодателей.

---

## Стек

| Слой | Технологии |
|---|---|
| Web framework | FastAPI 0.115, Uvicorn |
| База данных | PostgreSQL 16, SQLAlchemy 2.x async, Alembic |
| Кеш / брокер | Redis 7 |
| Очереди | Celery 5.4, Celery Beat, Flower |
| Векторная БД | ChromaDB 1.5 (HTTP-режим) |
| LLM | Ollama (локальный), llama3.1:8b / llama3.2:3b |
| RAG | LangChain 1.x, LangGraph, sentence-transformers (multilingual) |
| Эмбеддинги | paraphrase-multilingual-mpnet-base-v2 |
| Auth | JWT (python-jose), bcrypt |
| Скрейпинг | HH.ru API, Scrapy, Playwright |
| NLP | spaCy 3.8 |
| Email | SendGrid, aioimaplib |
| Мониторинг | Loguru, Sentry, Prometheus + Grafana |
| Тесты | pytest, pytest-asyncio, httpx |
| Линтинг | Ruff, Mypy |

---

## Структура проекта

```
backend/
├── app/
│   ├── main.py                  # Точка входа FastAPI
│   ├── api/
│   │   └── v1/
│   │       ├── router.py        # Главный роутер
│   │       ├── auth/            # POST /register, /login, GET /me
│   │       ├── health/          # GET /health (postgres, redis, chroma, ollama)
│   │       ├── companies/       # CRUD компаний, скоринг, статусы
│   │       ├── outreach/        # Кампании, генерация писем, approve, send
│   │       ├── rag/             # POST /chat, сессии, история, WebSocket
│   │       ├── dashboard/       # Статистика (stub)
│   │       ├── memory/          # Граф памяти агента (stub)
│   │       ├── projects/        # Проекты и ТЗ (stub)
│   │       ├── notifications/   # Уведомления (stub)
│   │       ├── industry/        # Анализ отрасли (stub)
│   │       └── communications/  # Коммуникации (stub)
│   ├── core/
│   │   ├── config.py            # Pydantic Settings (.env)
│   │   ├── security.py          # JWT, хэширование паролей
│   │   ├── dependencies.py      # get_current_user, get_current_active_user
│   │   ├── redis.py             # Пул соединений Redis
│   │   └── logging.py           # Loguru setup
│   ├── db/
│   │   ├── base.py              # DeclarativeBase с id/created_at/updated_at
│   │   ├── session.py           # AsyncSession, get_db, get_db_context
│   │   ├── models/              # User, Company, Vacancy, Competency,
│   │   │                        # OutreachCampaign, OutreachEvent,
│   │   │                        # ChatSession, ChatMessage,
│   │   │                        # Project, AgentMemory
│   │   └── repositories/        # UserRepository, CompanyRepository,
│   │                            # OutreachRepository, VacancyRepository
│   ├── services/
│   │   ├── rag/
│   │   │   ├── embedder.py      # LocalEmbeddings (sentence-transformers)
│   │   │   ├── loader.py        # Загрузка .md → чанки
│   │   │   ├── vector_store.py  # Chroma HTTP-клиент (singleton)
│   │   │   └── chain.py         # LangChain LCEL цепочка + MOCK_LLM режим
│   │   ├── outreach/
│   │   │   ├── generator.py     # LLM-генерация писем (formal/informal)
│   │   │   └── sender.py        # SendGrid + dry-run
│   │   ├── scoring/
│   │   │   └── company_scorer.py # Скоринг по 4 критериям (0–1)
│   │   ├── nlp/                 # spaCy pipeline (Sprint 2, в разработке)
│   │   ├── memory/              # LangGraph агент (Sprint 8, в разработке)
│   │   └── llm/                 # Вспомогательные LLM-утилиты
│   ├── workers/
│   │   ├── celery_app.py        # Конфигурация Celery + Beat расписание
│   │   └── tasks/
│   │       ├── hh_ingest.py     # Сбор компаний с HH.ru (ежедневно)
│   │       ├── rag_ingest.py    # Переиндексация базы знаний (еженедельно)
│   │       └── outreach.py      # Генерация писем, follow-up (каждые 12ч)
│   └── integrations/
│       ├── hh/                  # HH.ru API клиент + схемы
│       ├── superjob/            # (в разработке)
│       ├── linkedin/            # (в разработке)
│       ├── scraper/             # Scrapy-пауки (в разработке)
│       ├── spark/               # Spark-Interfax (в разработке)
│       └── email/               # IMAP (в разработке)
├── knowledge_base/              # Markdown-файлы для RAG
│   ├── agile/                   # manifesto.md, frameworks.md, mindset.md
│   ├── scrum/                   # overview.md, roles.md, events.md, artifacts.md
│   └── devops/                  # overview.md, ci_cd.md, practices.md
├── alembic/                     # Миграции БД
├── tests/
│   ├── conftest.py
│   └── integration/
│       └── test_auth.py
├── scripts/
│   └── index_knowledge_base.py  # Ручная индексация базы знаний
├── requirements/
│   ├── base.txt                 # Основные зависимости
│   ├── dev.txt                  # base + pytest, ruff, mypy, ipython
│   ├── prod.txt                 # base + gunicorn
│   └── ml.txt                   # torch, peft, bitsandbytes (Sprint 8)
├── .env.example                 # Шаблон переменных окружения
└── docker-compose.yml           # Все сервисы
```

---

## Быстрый старт

### 1. Клонировать и настроить окружение

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# Linux / macOS
source .venv/bin/activate

pip install -r requirements/dev.txt
```

### 2. Переменные окружения

```bash
cp .env.example .env
```

Обязательно заполнить в `.env`:
- `SECRET_KEY` — сгенерировать: `openssl rand -hex 32`
- `POSTGRES_PASSWORD` — любой пароль
- `MOCK_LLM=true` — для разработки без Ollama (экономит ~2 GB RAM)

### 3. Поднять инфраструктуру

Минимум для разработки (без Ollama):
```bash
docker compose up -d postgres redis chroma
```

Полный стек:
```bash
docker compose up -d
```

Проверить состояние:
```bash
docker ps
```

### 4. Применить миграции

```bash
alembic upgrade head
```

### 5. Запустить сервер

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Swagger UI: **http://localhost:8000/api/v1/docs**

Health check: **http://localhost:8000/api/v1/health**

### 6. (Опционально) Индексировать базу знаний

Нужно когда `MOCK_LLM=false` и Chroma запущена:

```bash
python scripts/index_knowledge_base.py
```

### 7. (Опционально) Запустить Celery

```bash
# Воркер (Windows — только solo pool)
celery -A app.workers.celery_app worker --pool=solo --loglevel=info

# Beat-расписание (в отдельном терминале)
celery -A app.workers.celery_app beat --loglevel=info

# Flower — мониторинг задач
celery -A app.workers.celery_app flower --port=5555
# http://localhost:5555
```

---

## MOCK_LLM режим

При `MOCK_LLM=true` в `.env` сервер запускается без загрузки Ollama и ChromaDB:
- `/rag/chat` возвращает эхо-ответ вместо обращения к LLM
- Генерация писем (`/outreach`) возвращает шаблонный текст
- Экономия: ~1.1 GB (embeddings) + RAM Ollama

Убрать перед продакшеном — все места помечены `# TODO[MOCK]`.

---

## Переменные окружения

| Переменная | Описание | Дефолт |
|---|---|---|
| `SECRET_KEY` | JWT-секрет | `CHANGE_ME` |
| `MOCK_LLM` | Заглушка вместо LLM | `false` |
| `POSTGRES_HOST` | Хост PostgreSQL | `localhost` |
| `POSTGRES_DB` | Имя БД | `edagent` |
| `REDIS_HOST` | Хост Redis | `localhost` |
| `CHROMA_HOST` | Хост Chroma | `localhost` |
| `CHROMA_PORT` | Порт Chroma | `8001` |
| `OLLAMA_BASE_URL` | URL Ollama | `http://localhost:11434` |
| `OLLAMA_MODEL` | Модель | `llama3.1:8b` |
| `EMBEDDING_MODEL` | Модель эмбеддингов | `paraphrase-multilingual-mpnet-base-v2` |
| `HH_ACCESS_TOKEN` | Токен HH.ru API | — |
| `HH_AREA_ID` | Регион HH.ru | `3` (Екатеринбург) |
| `SENDGRID_API_KEY` | Ключ SendGrid | — (dry-run без него) |

Полный список — в `.env.example`.

---

## Запуск тестов

```bash
# Создать тестовую БД (один раз)
docker exec edagent_postgres createdb -U edagent edagent_test

# Запустить тесты
pytest tests/ -v

# С отчётом покрытия
pytest tests/ -v --cov=app --cov-report=term-missing
```

---

## Полезные команды

```bash
# Создать новую миграцию
alembic revision --autogenerate -m "description"

# Откатить последнюю миграцию
alembic downgrade -1

# Посмотреть текущую ревизию
alembic current

# Проверить линтером
ruff check app/

# Форматировать код
ruff format app/
```
