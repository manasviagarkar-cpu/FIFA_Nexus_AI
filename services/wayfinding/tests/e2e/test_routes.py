"""
FIFA Nexus AI — Wayfinding REST Routes E2E Tests
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import jwt
import pytest
from fastapi import FastAPI
from httpx import AsyncClient

from app.config import get_settings
from app.main import app
from shared.contracts import UserRole


@pytest.fixture
def test_jwt_token() -> str:
    """Generate a test JWT token for authorization header mock verification."""
    settings = get_settings()
    payload = {
        "sub": "user-123",
        "email": "fan@example.com",
        "name": "Alex Fan",
        "role": UserRole.FAN.value,
        "iat": 1800000000,
        "exp": 2000000000,
        "iss": "fifa-nexus-auth",
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


@pytest.mark.asyncio
async def test_health_check_endpoint():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        # We need state mocked in main app
        app.state.db_pool = MagicMock()
        app.state.db_pool.acquire = MagicMock()
        # Mock connection context manager
        conn_mock = AsyncMock()
        app.state.db_pool.acquire.return_value.__aenter__.return_value = conn_mock

        app.state.redis_client = AsyncMock()
        app.state.redis_client.ping = AsyncMock(return_value=True)

        response = await ac.get("/api/v1/health")
        assert response.status_code == 200
        json_data = response.json()
        assert json_data["status"] == "healthy"
        assert json_data["service"] == "wayfinding"


@pytest.mark.asyncio
async def test_calculate_route_api(test_jwt_token, mock_stadium_zones, mock_cache):
    # Mock wayfinding_service and rate_limiter in app state
    mock_service = AsyncMock()
    # Mock calculate_route to return dummy CalculatedRoute structure
    from app.domain.entities import CalculatedRoute, RouteStep, GeoCoordinate, ZoneType, CongestionLevel
    step1 = RouteStep(1, "gate-a", "Gate A", ZoneType.ENTRANCE, GeoCoordinate(40.8, -74.0), "Start", 0, 0, 0.1, CongestionLevel.LOW)
    step2 = RouteStep(2, "concourse-100", "Concourse", ZoneType.CONCOURSE, GeoCoordinate(40.81, -74.01), "End", 30, 50, 0.2, CongestionLevel.LOW)
    mock_route = CalculatedRoute("route-abc", [step1, step2], 30, 50, 0.15, False, "fastest")
    mock_service.calculate_route = AsyncMock(return_value=mock_route)

    mock_limiter = AsyncMock()
    # is_rate_limited -> (is_limited, remaining, retry_after)
    mock_limiter.is_rate_limited = AsyncMock(return_value=(False, 99, 0))

    app.state.wayfinding_service = mock_service
    app.state.rate_limiter = mock_limiter

    headers = {"Authorization": f"Bearer {test_jwt_token}"}
    async with AsyncClient(app=app, base_url="http://test") as ac:
        payload = {
            "origin": "gate-a",
            "destination": "concourse-100",
            "accessibility_needs": ["none"],
            "is_vip": False,
            "preference": "fastest",
        }
        response = await ac.post("/api/v1/routes/calculate", json=payload, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["routeId"] == "route-abc"
        assert len(data["data"]["path"]) == 2
