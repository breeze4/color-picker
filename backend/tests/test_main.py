from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_health() -> None:
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_index_serves_frontend() -> None:
    r = client.get("/")
    assert r.status_code == 200
    assert "<canvas id=\"wheel\"" in r.text


def test_static_module_is_served() -> None:
    r = client.get("/js/app.js")
    assert r.status_code == 200
    assert "javascript" in r.headers["content-type"]
