"""Тесты S9-9/S10-4: health-checks (live/ready) + /metrics."""
import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")


async def test_liveness(client):
    resp = await client.get("/api/v1/health/live")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


async def test_readiness_mock_llm_skips_chroma_ollama(client):
    """В тестовом окружении MOCK_LLM=true — chroma/ollama должны быть пропущены,
    а итоговый статус не должен зависеть от их недоступности."""
    resp = await client.get("/api/v1/health/ready")
    assert resp.status_code == 200
    data = resp.json()
    assert "services" in data
    assert data["services"]["chroma"] == "skipped (MOCK_LLM)"
    assert data["services"]["ollama"] == "skipped (MOCK_LLM)"
    # postgres/redis должны быть проверены реально
    assert "postgres" in data["services"]
    assert "redis" in data["services"]


async def test_health_root_alias_still_works(client):
    resp = await client.get("/api/v1/health")
    assert resp.status_code == 200
    assert "status" in resp.json()


async def test_metrics_endpoint_exposed(client):
    resp = await client.get("/metrics")
    assert resp.status_code == 200
    # prometheus-fastapi-instrumentator exposes plain-text metrics
    assert "text/plain" in resp.headers.get("content-type", "")
