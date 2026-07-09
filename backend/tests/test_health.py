"""
sanity check that the app boots and the health endpoint responds.
not testing much yet, just proving the pytest + ci wiring works end to end.
"""

from fastapi.testclient import TestClient

from tailorpilot.main import app


client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
"""
sanity check that the app boots and the health endpoint responds.
not testing much yet, just proving the pytest + ci wiring works end to end.
"""

from fastapi.testclient import TestClient

from tailorpilot.main import app

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}