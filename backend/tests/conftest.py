import os

# Point the app at the test database before anything imports app.config.
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+psycopg://taskplus:taskplus@localhost:5432/taskplus_test"
)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def schema():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture(autouse=True)
def clean_tables():
    yield
    names = ", ".join(table.name for table in reversed(Base.metadata.sorted_tables))
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {names} RESTART IDENTITY CASCADE"))


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


class Api:
    def __init__(self, client: TestClient, token: str):
        self.client = client
        self.headers = {"Authorization": f"Bearer {token}"}

    def get(self, url, **kw):
        return self.client.get(url, headers=self.headers, **kw)

    def post(self, url, json=None):
        return self.client.post(url, headers=self.headers, json=json)

    def put(self, url, json=None):
        return self.client.put(url, headers=self.headers, json=json)

    def patch(self, url, json=None):
        return self.client.patch(url, headers=self.headers, json=json)

    def delete(self, url):
        return self.client.delete(url, headers=self.headers)


def sign_up(client: TestClient, email="owner@example.com", org="Test Co") -> Api:
    response = client.post(
        "/api/auth/signup",
        json={
            "organization_name": org,
            "timezone": "Asia/Kolkata",
            "full_name": "Olive Owner",
            "email": email,
            "password": "password-123",
        },
    )
    assert response.status_code == 201, response.text
    return Api(client, response.json()["access_token"])


def sign_in(client: TestClient, identifier: str, password: str = "password-123") -> Api:
    response = client.post("/api/auth/login", json={"identifier": identifier, "password": password})
    assert response.status_code == 200, response.text
    return Api(client, response.json()["access_token"])
