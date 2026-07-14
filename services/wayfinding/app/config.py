"""
FIFA Nexus AI — Wayfinding Service Configuration
"""

from __future__ import annotations

from functools import lru_cache
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Service
    SERVICE_NAME: str = "wayfinding"
    SERVICE_VERSION: str = "1.0.0"
    SERVICE_PORT: int = 8001
    LOG_LEVEL: str = "info"

    # PostgreSQL
    POSTGRES_HOST: Optional[str] = None
    POSTGRES_PORT: Optional[int] = None
    POSTGRES_DB: Optional[str] = None
    POSTGRES_USER: Optional[str] = None
    POSTGRES_PASSWORD: Optional[str] = None
    DATABASE_URL: Optional[str] = None

    # Redis
    REDIS_HOST: Optional[str] = None
    REDIS_PORT: Optional[int] = None
    REDIS_PASSWORD: Optional[str] = None
    REDIS_URL: Optional[str] = None
    REDIS_DB: int = 0
    REDIS_CACHE_TTL: int = 300  # 5 minutes default

    # JWT Authentication
    JWT_SECRET: str = "fifa-nexus-jwt-secret-2026-change-in-production"
    JWT_ALGORITHM: str = "HS256"

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:8080"

    # Rate Limiting
    RATE_LIMIT_FAN: int = 100
    RATE_LIMIT_STAFF: int = 500
    RATE_LIMIT_ADMIN: int = 1000
    RATE_LIMIT_WINDOW_SECONDS: int = 60

    # Wayfinding-specific
    DEFAULT_DENSITY_THRESHOLD: float = 0.85
    ROUTE_CACHE_TTL: int = 60  # Recalculate routes every 60 seconds
    STADIUM_MAP_CACHE_TTL: int = 3600  # Cache stadium map for 1 hour

    @property
    def database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def redis_url(self) -> str:
        if self.REDIS_URL:
            return self.REDIS_URL
        return f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    model_config = {"env_file": ".env", "case_sensitive": True}


@lru_cache()
def get_settings() -> Settings:
    """Cached settings singleton."""
    return Settings()
