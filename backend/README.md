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
│   ├── main.py                  # Точка входа FastAPI: CORS, rate limiting, Sentry, /metrics
│   ├── api/
│   │   └── v1/
│   │       ├── router.py        # Главный роутер, подключает все подроутеры ниже
│   │       ├── auth/            # POST /register, /login, GET /me
│   │       ├── health/          # GET /health, /health/live, /health/ready
│   │       ├── companies/       # CRUD компаний, скоринг, история скоринга, статусы, импорт
│   │       ├── industry/        # Компетенции, матрица отраслей, приоритетные области
│   │       ├── outreach/        # Кампании, генерация писем, approve, send (план касаний)
│   │       ├── rag/             # POST /chat, сессии, история, WebSocket-стриминг
│   │       ├── communications/  # Генерация писем/уведомлений, HTML-шаблоны (Jinja2)
│   │       ├── memory/          # Память агента: список, граф связей, журнал аудита
│   │       ├── projects/        # Проекты, генерация ТЗ, роли/слоты, статусы
│   │       ├── notifications/   # Список уведомлений, mark read, WebSocket realtime
│   │       └── dashboard/       # Сводная статистика, очередь human-in-the-loop
│   ├── core/
│   │   ├── config.py            # Pydantic Settings (.env)
│   │   ├── security.py          # JWT, хэширование паролей
│   │   ├── dependencies.py      # get_current_user, get_current_active_user
│   │   ├── redis.py             # Пул соединений Redis
│   │   ├── logging.py           # Loguru setup
│   │   ├── limiter.py           # slowapi Limiter, RATE_LIMIT_PER_MINUTE (S1-7)
│   │   ├── observability.py     # Sentry init + Prometheus /metrics (S9-9/S10-4)
│   │   └── notification_roles.py # Видимость уведомлений по recipient_role (S9-7)
│   ├── db/
│   │   ├── base.py               # DeclarativeBase с id/created_at/updated_at
│   │   ├── session.py            # AsyncSession, get_db, get_db_context
│   │   ├── models/                # User, Company, CompanyScoreHistory, Vacancy,
│   │   │                          # Competency, PriorityArea, IngestLog,
│   │   │                          # OutreachCampaign, OutreachEvent,
│   │   │                          # ChatSession/ChatMessage, Project,
│   │   │                          # AgentMemory, Notification
│   │   └── repositories/          # По одному репозиторию на каждую модель выше
│   ├── services/
│   │   ├── rag/
│   │   │   ├── embedder.py       # LocalEmbeddings (sentence-transformers)
│   │   │   ├── loader.py         # Загрузка .md → чанки
│   │   │   ├── vector_store.py   # Chroma HTTP-клиент (singleton)
│   │   │   └── chain.py          # LangChain LCEL цепочка + MOCK_LLM режим
│   │   ├── nlp/
│   │   │   ├── competency_extractor.py # spaCy-экстрактор компетенций (FR-1.2)
│   │   │   ├── skills_dictionary.py    # Словарь навыков/технологий
│   │   │   └── priority_areas.py       # Матрица компетенций программы/индустрии (FR-1.3)
│   │   ├── scoring/
│   │   │   ├── company_scorer.py # Скоринг по критериям (0–1) + бонус приоритетной отрасли
│   │   │   └── scoring_service.py # Пересчёт, история скоринга, авто-шортлист, Top-20-уведомление
│   │   ├── communications/
│   │   │   ├── generator.py      # Генерация писем/уведомлений (outreach, follow_up, rejection,
│   │   │   │                      # project_invitation, notification), formal/informal
│   │   │   ├── templates.py      # render_communication_html (Jinja2)
│   │   │   └── templates/        # base_email.html.j2, follow_up.html.j2, notification.html.j2
│   │   ├── outreach/
│   │   │   ├── generator.py      # LLM-генерация писем с учётом памяти
│   │   │   ├── sender.py         # SendGrid + dry-run
│   │   │   ├── touch_plan.py     # План касаний (FR-3.6)
│   │   │   └── memory_graph.py   # Граф связей памяти по компании
│   │   ├── memory/
│   │   │   ├── memory_service.py # AgentMemory: создание/поиск записей
│   │   │   └── audit.py          # Журнал аудита действий агента
│   │   ├── notifications/
│   │   │   └── realtime.py       # Redis pub/sub relay для WebSocket /notifications/ws
│   │   ├── projects/
│   │   │   └── generator.py      # Генерация ТЗ, разметка ролей/слотов
│   │   └── llm/
│   │       └── factory.py        # get_chat_llm(): Ollama (основной) + fallback на GigaChat
│   ├── workers/
│   │   ├── celery_app.py        # Конфигурация Celery + Beat расписание
│   │   └── tasks/
│   │       ├── hh_ingest.py     # Сбор компаний с HH.ru (ежедневно)
│   │       ├── rag_ingest.py    # Переиндексация базы знаний (еженедельно)
│   │       ├── outreach.py      # Генерация писем, follow-up по плану касаний (каждые 12ч)
│   │       ├── companies.py     # Пересчёт скоринга / автошортлист
│   │       ├── scoring.py       # Top-20 шортлист-уведомление (S9-7)
│   │       ├── industry.py      # NLP-анализ вакансий, приоритетные области
│   │       └── memory.py        # Обслуживание памяти агента
│   └── integrations/
│       ├── hh/                  # HH.ru API клиент + схемы (реализован)
│       ├── superjob/            # (в разработке)
│       ├── linkedin/            # (в разработке)
│       ├── scraper/             # Scrapy-пауки (в разработке)
│       ├── spark/               # Spark-Interfax (в разработке)
│       └── email/               # IMAP (в разработке)
├── knowledge_base/              # Markdown-файлы для RAG
│   ├── agile/                   # manifesto.md, frameworks.md, mindset.md
│   ├── scrum/                   # overview.md, roles.md, events.md, artifacts.md
│   └── devops/                  # overview.md, ci_cd.md, practices.md
├── alembic/                     # Миграции БД (16 ревизий)
├── tests/
│   ├── conftest.py
│   ├── fixtures/
│   ├── unit/                    # ~15 модулей: auth, companies, scoring, communications,
│   │                             # touch-plan/templates/project, rag, rag_chat, dashboard,
│   │                             # notifications realtime, agent memory, health/metrics,
│   │                             # rate limit, hh_ingest, ingestion
│   └── integration/
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

Health check:
- **http://localhost:8000/api/v1/health/live** — liveness (без зависимостей, для оркестратора)
- **http://localhost:8000/api/v1/health/ready** (и алиас `/api/v1/health`) — readiness: проверяет PostgreSQL, Redis, а также Chroma и Ollama (пропускаются при `MOCK_LLM=true`)

Метрики Prometheus: **http://localhost:8000/metrics** (вне `/api/v1`, всегда доступны)

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
| `RATE_LIMIT_PER_MINUTE` | Лимит запросов на клиента в минуту (slowapi, S1-7). `0` — лимитер отключён | `60` |
| `SENTRY_DSN` | DSN для отправки ошибок в Sentry. Пусто — Sentry не инициализируется | `""` |
| `GIGACHAT_ENABLED` | Включить резервный LLM-провайдер GigaChat при недоступности Ollama | `false` |
| `GIGACHAT_CREDENTIALS` | Authorization key (base64) из личного кабинета GigaChat | `""` |
| `GIGACHAT_MODEL` | Модель GigaChat (`GigaChat` / `GigaChat-Pro` / `GigaChat-Max`) | `GigaChat` |

Полный список — в `.env.example`. `RATE_LIMIT_PER_MINUTE` и `SENTRY_DSN` в `.env.example` пока не прописаны явно — при необходимости задайте их вручную в `.env`, иначе используются дефолты выше.

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

Основные тесты лежат в `tests/unit/` (auth, companies, scoring, communications,
touch plan/шаблоны/проекты, RAG и RAG-чат, dashboard, realtime-уведомления,
память агента, health/metrics, rate limiting, hh-ingest, ingestion) и используют
фикстуры из `tests/fixtures/`. Каталог `tests/integration/` зарезервирован под
интеграционные сценарии (на данный момент пуст).

---

## WebSocket-эндпоинты

- `/api/v1/rag/chat/ws` — стриминг ответов RAG-чата.
- `/api/v1/notifications/ws?token=<JWT>` — realtime-доставка уведомлений
  (Sprint 9), фильтрация по `recipient_role` через `app/core/notification_roles.py`,
  релей через Redis pub/sub (`app/services/notifications/realtime.py`).

## Резервный LLM (GigaChat)

Все LLM-цепочки (`rag/chain.py`, `projects/generator.py`, `communications/generator.py`,
`outreach/generator.py`) собираются через `app/services/llm/factory.get_chat_llm()`.
Основной провайдер — Ollama. Если `GIGACHAT_ENABLED=true` и задан `GIGACHAT_CREDENTIALS`,
поверх Ollama навешивается fallback через `Runnable.with_fallbacks([...])`: при
ошибке/таймауте/недоступности Ollama LangChain автоматически переключается на GigaChat
для этого же запроса. Если GigaChat не настроен — поведение не меняется (только Ollama).
При `MOCK_LLM=true` фабрика не используется вообще.

## Rate limiting

При `RATE_LIMIT_PER_MINUTE > 0` (по умолчанию `60`) включается лимитер на основе
slowapi (`app/core/limiter.py`), ключ — IP-адрес клиента. При превышении лимита
сервер возвращает `429 Too Many Requests`.

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
