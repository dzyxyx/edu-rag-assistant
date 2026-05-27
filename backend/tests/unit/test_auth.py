import pytest

pytestmark = pytest.mark.asyncio(loop_scope="session")

BASE = "/api/v1/auth"

USER = {
    "email": "testuser@example.com",
    "full_name": "Test User",
    "password": "secret123",
}


# ── register ──────────────────────────────────────────────────

async def test_register_success(client):
    resp = await client.post(f"{BASE}/register", json=USER)
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == USER["email"]
    assert data["full_name"] == USER["full_name"]
    assert "id" in data
    assert "hashed_password" not in data


async def test_register_duplicate_email(client):
    await client.post(f"{BASE}/register", json=USER)  # первая регистрация
    resp = await client.post(f"{BASE}/register", json=USER)  # дубликат
    assert resp.status_code == 400
    assert "already registered" in resp.json()["detail"]


# ── login ─────────────────────────────────────────────────────

async def test_login_success(client):
    await client.post(f"{BASE}/register", json=USER)
    resp = await client.post(f"{BASE}/login", json={
        "email": USER["email"],
        "password": USER["password"],
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


async def test_login_wrong_password(client):
    await client.post(f"{BASE}/register", json=USER)
    resp = await client.post(f"{BASE}/login", json={
        "email": USER["email"],
        "password": "wrongpassword",
    })
    assert resp.status_code == 401


async def test_login_unknown_email(client):
    resp = await client.post(f"{BASE}/login", json={
        "email": "nobody@example.com",
        "password": "anything",
    })
    assert resp.status_code == 401


# ── /me ───────────────────────────────────────────────────────

async def test_me_with_valid_token(client):
    await client.post(f"{BASE}/register", json=USER)
    login = await client.post(f"{BASE}/login", json={
        "email": USER["email"],
        "password": USER["password"],
    })
    token = login.json()["access_token"]

    resp = await client.get(f"{BASE}/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["email"] == USER["email"]


async def test_me_without_token(client):
    resp = await client.get(f"{BASE}/me")
    assert resp.status_code == 401
