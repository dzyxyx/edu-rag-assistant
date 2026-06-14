import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.redis import get_redis
from app.db.base import Base
from app.db.session import get_db
from app.main import app  # noqa: E402 — app.db.models уже загружены внутри main.py


class _FakeRedis:
    """Заглушка Redis для тестов — lifespan (init_redis) не запускается при
    использовании ASGITransport без LifespanManager, поэтому app.core.redis
    не инициализирован. Достаточно для health-check и каналов уведомлений."""

    async def ping(self) -> bool:
        return True

    async def publish(self, *args, **kwargs) -> int:
        return 0

TEST_DATABASE_URL = (
    f"postgresql+asyncpg://{settings.POSTGRES_USER}:{settings.POSTGRES_PASSWORD}"
    f"@{settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/edagent_test"
)

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(loop_scope="session", scope="session", autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session():
    async with TestSessionLocal() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session

    async def override_get_redis():
        yield _FakeRedis()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_redis] = override_get_redis

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def auth_client(client):
    """Клиент с Bearer-токеном зарегистрированного пользователя."""
    user = {"email": "s1_test@example.com", "full_name": "S1 User", "password": "pass1234"}
    await client.post("/api/v1/auth/register", json=user)
    resp = await client.post("/api/v1/auth/login", json={
        "email": user["email"], "password": user["password"]
    })
    token = resp.json()["access_token"]
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client
