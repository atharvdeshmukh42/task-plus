from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_SECRET = "dev-only-secret-do-not-use-in-production"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"
    database_url: str = "postgresql+psycopg://taskplus:taskplus@localhost:5432/taskplus"
    jwt_secret: str = DEV_SECRET
    jwt_expires_minutes: int = 60 * 24 * 7
    # Comma-separated list. Vite dev server and Expo web by default.
    cors_origins: str = "http://localhost:5173,http://localhost:8081"

    @field_validator("database_url")
    @classmethod
    def use_psycopg_driver(cls, value: str) -> str:
        # Accept plain postgres:// URLs from hosting providers.
        for prefix in ("postgres://", "postgresql://"):
            if value.startswith(prefix):
                return "postgresql+psycopg://" + value[len(prefix):]
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if settings.environment == "production" and (settings.jwt_secret == DEV_SECRET or len(settings.jwt_secret) < 32):
        raise RuntimeError("Set JWT_SECRET to a random value of at least 32 characters before running in production.")
    return settings
