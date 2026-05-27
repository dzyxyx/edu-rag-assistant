# Backend — edu-rag-assistant

## Стек

| Слой | Технологии |
|---|---|
| Web framework | FastAPI, Uvicorn |
| База данных | PostgreSQL 16, SQLAlchemy 2.x async, Alembic |
| Кеш / очереди | Redis 7, Celery, Celery Beat, Flower |
| Векторная БД | Chroma 1.x |
| LLM | Ollama (локальный) |
| RAG / агент | LangChain 1.x, sentence-transformers |
| Auth | JWT (python-jose), bcrypt |
| NLP | spaCy |
| Мониторинг | Loguru, Sentry, Prometheus |

## Быстрый старт

### 1. Настроить окружение

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements/base.txt
```

### 2. Переменные окружения

```bash
cp .env.example .env
# Отредактируй .env под свои значения
```

### 3. Поднять инфраструктуру

```bash
docker compose up -d postgres redis chroma
```

### 4. Применить миграции

```bash
alembic upgrade head
```

### 5. Запустить приложение

```bash
uvicorn app.main:app --reload
```

Swagger UI: http://localhost:8000/api/v1/docs

## Переменные окружения

| Переменная | Описание | Пример |
|---|---|---|
| `POSTGRES_HOST` | Хост PostgreSQL | `localhost` |
| `POSTGRES_DB` | Имя базы данных | `edagent` |
| `POSTGRES_USER` | Пользователь | `edagent` |
| `POSTGRES_PASSWORD` | Пароль | `edagent` |
| `REDIS_HOST` | Хост Redis | `localhost` |
| `CHROMA_HOST` | Хост Chroma | `localhost` |
| `CHROMA_PORT` | Порт Chroma | `8001` |
| `SECRET_KEY` | JWT-секрет | сгенерируй случайный |
| `OLLAMA_BASE_URL` | URL Ollama | `http://localhost:11434` |
| `OLLAMA_MODEL` | Модель Ollama | `llama3.1:8b` |

## Запуск тестов

```bash
# Создать тестовую БД (один раз)
docker exec edagent_postgres createdb -U edagent edagent_test

pip install pytest pytest-asyncio httpx pytest-env
pytest tests/ -v
```

## Структура проекта

```
backend/
├── app/
│   ├── api/v1/          # REST эндпоинты и WebSocket
│   │   ├── auth/        # Регистрация, логин, /me
│   │   ├── health/      # Health check (postgres, redis, chroma)
│   │   ├── companies/   # Скоринг компаний
│   │   ├── industry/    # Анализ отрасли
│   │   ├── rag/         # EdAgent RAG + WebSocket чат
│   │   ├── outreach/    # Аутрич-компании
│   │   ├── projects/    # Проекты и ТЗ
│   │   ├── memory/      # Память агента
│   │   └── dashboard/   # Дашборд
│   ├── core/            # Config, security, logging, redis, dependencies
│   ├── db/              # Модели, репозитории, сессия, Alembic
│   ├── services/        # LLM, RAG, NLP, скоринг, память
│   ├── workers/         # Celery tasks и beat schedule
│   └── integrations/    # HH, Superjob, LinkedIn, email, Spark
├── tests/
│   ├── unit/
│   └── integration/
├── requirements/
│   ├── base.txt         # Основные зависимости
│   └── ml.txt           # ML/QLoRA
└── docker-compose.yml
```
