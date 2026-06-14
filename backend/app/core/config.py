from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",  # игнорировать неизвестные переменные окружения
    )

    # App
    PROJECT_NAME: str = "RH AI memory and EdAgent"
    VERSION: str = "0.1.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"
    # TODO[MOCK]: удалить поле и все проверки settings.MOCK_LLM перед продакшеном
    MOCK_LLM: bool = False  # True → заглушка вместо Ollama (dev/тесты)
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    # PostgreSQL
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "edagent"
    POSTGRES_USER: str = "edagent"
    POSTGRES_PASSWORD: str = "edagent"

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def DATABASE_URL_SYNC(self) -> str:
        return (
            f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = ""
    REDIS_DB: int = 0

    @property
    def REDIS_URL(self) -> str:
        if self.REDIS_PASSWORD:
            return f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # Chroma
    CHROMA_HOST: str = "localhost"
    CHROMA_PORT: int = 8001
    CHROMA_COLLECTION_RAG: str = "edagent_knowledge"
    CHROMA_COLLECTION_MEMORY: str = "agent_memory"
    CHROMA_COLLECTION_VACANCIES: str = "vacancies"

    # JWT
    SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Ollama (локальный LLM-сервер, основной провайдер)
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.1:8b"          # модель по умолчанию, меняется в .env

    # GigaChat (резервный облачный LLM — используется, если Ollama недоступна)
    GIGACHAT_ENABLED: bool = False             # включить fallback на GigaChat
    GIGACHAT_CREDENTIALS: str = ""             # Authorization key (base64) из личного кабинета
    GIGACHAT_SCOPE: str = "GIGACHAT_API_PERS"  # GIGACHAT_API_PERS | GIGACHAT_API_B2B | GIGACHAT_API_CORP
    GIGACHAT_MODEL: str = "GigaChat"           # GigaChat | GigaChat-Pro | GigaChat-Max
    GIGACHAT_VERIFY_SSL_CERTS: bool = False    # для GigaChat часто нужны минцифровские сертификаты

    # HuggingFace (для локальных моделей и QLoRA)
    HF_TOKEN: str = ""
    EMBEDDING_MODEL: str = "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"

    # HeadHunter
    HH_API_URL: str = "https://api.hh.ru"
    HH_CLIENT_ID: str = ""
    HH_CLIENT_SECRET: str = ""
    HH_ACCESS_TOKEN: str = ""
    HH_AREA_ID: int = 3  # 3 = Екатеринбург; 1 = Москва; 2 = Санкт-Петербург

    # Superjob
    SUPERJOB_API_URL: str = "https://api.superjob.ru/2.0"
    SUPERJOB_CLIENT_ID: str = ""
    SUPERJOB_SECRET_KEY: str = ""

    # LinkedIn
    LINKEDIN_CLIENT_ID: str = ""
    LINKEDIN_CLIENT_SECRET: str = ""
    LINKEDIN_ACCESS_TOKEN: str = ""

    # Email (SendGrid)
    SENDGRID_API_KEY: str = ""
    SENDGRID_FROM_EMAIL: str = ""
    SENDGRID_FROM_NAME: str = "ПроКомпетенции"

    # Email (IMAP входящие)
    IMAP_HOST: str = ""
    IMAP_PORT: int = 993
    IMAP_USER: str = ""
    IMAP_PASSWORD: str = ""

    # Spark-Interfax
    SPARK_API_KEY: str = ""
    SPARK_API_URL: str = "https://api.spark-interfax.ru"

    # Sentry
    SENTRY_DSN: str = ""

    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = 60

    # Agent memory / outreach graph (Sprint 4)
    OUTREACH_CONFIDENCE_THRESHOLD: float = 0.6  # ниже — письмо уходит на ESCALATED

    # План касаний (FR-3.6, Sprint 5): интервалы (в днях) между касаниями
    # компании-партнёра — после первичного письма (outreach) и после каждого
    # follow-up. Длина списка определяет максимальное число follow-up'ов.
    OUTREACH_TOUCH_PLAN_DAYS: list[int] = [5, 14]

    # Скоринг компаний (Sprint 4 — FR-2.3/FR-2.4)
    # Порог итогового score, при котором компания автоматически переводится
    # в статус "shortlisted" (если её текущий статус ещё не дальше по пайплайну).
    AUTO_SHORTLIST_SCORE_THRESHOLD: float = 0.7
    # Бонус к score за совпадение industry компании с утверждённой
    # приоритетной областью (PriorityArea.status == approved).
    PRIORITY_AREA_SCORE_BONUS: float = 0.05


settings = Settings()
