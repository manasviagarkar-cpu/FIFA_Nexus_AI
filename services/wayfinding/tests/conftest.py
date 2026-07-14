"""
FIFA Nexus AI — Wayfinding Pytest configuration & mocks
"""

from __future__ import annotations

import asyncio
from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from httpx import AsyncClient

from app.domain.entities import GeoCoordinate, StadiumZone, NodeConnection, ZoneType
from app.ports.outbound import StadiumRepository, CachePort
from app.domain.services import WayfindingService


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
def mock_stadium_zones() -> list[StadiumZone]:
    """Provide structured mock zones for testing pathfinding."""
    gate_a = StadiumZone(
        id="gate-a",
        name="Gate A - Main Entrance",
        zone_type=ZoneType.ENTRANCE,
        coordinate=GeoCoordinate(40.8135, -74.0745, 0),
        is_accessible=True,
        is_vip_only=False,
        capacity=1000,
        current_occupancy=100,
        current_density=0.1,
    )
    concourse = StadiumZone(
        id="concourse-100",
        name="Lower Concourse Section 100",
        zone_type=ZoneType.CONCOURSE,
        coordinate=GeoCoordinate(40.8137, -74.0742, 1),
        is_accessible=True,
        is_vip_only=False,
        capacity=2000,
        current_occupancy=400,
        current_density=0.2,
    )
    vip_lounge = StadiumZone(
        id="concourse-300",
        name="Premium Concourse",
        zone_type=ZoneType.VIP_LOUNGE,
        coordinate=GeoCoordinate(40.8137, -74.0742, 3),
        is_accessible=True,
        is_vip_only=True,
        capacity=500,
        current_occupancy=50,
        current_density=0.1,
    )
    seating = StadiumZone(
        id="seating-101",
        name="Section 101 - Lower Bowl",
        zone_type=ZoneType.SEATING,
        coordinate=GeoCoordinate(40.8136, -74.0744, 1),
        is_accessible=False,  # Accessible route must avoid this or require stairs
        is_vip_only=False,
        capacity=500,
        current_occupancy=450,
        current_density=0.9,  # High congestion
    )

    # Wire connections
    gate_a.connections = [
        NodeConnection("concourse-100", 30, 50, True, False, False, False),
    ]
    concourse.connections = [
        NodeConnection("gate-a", 30, 50, True, False, False, False),
        NodeConnection("seating-101", 45, 40, False, False, True, False),
        NodeConnection("concourse-300", 45, 15, True, True, True, True),
    ]
    vip_lounge.connections = [
        NodeConnection("concourse-100", 45, 15, True, True, True, True),
    ]
    seating.connections = [
        NodeConnection("concourse-100", 45, 40, False, False, True, False),
    ]

    return [gate_a, concourse, vip_lounge, seating]


@pytest.fixture
def mock_stadium_repo(mock_stadium_zones) -> MagicMock:
    repo = MagicMock(spec=StadiumRepository)
    repo.get_all_zones = AsyncMock(return_value=mock_stadium_zones)
    repo.get_all_zones_with_connections = AsyncMock(return_value=mock_stadium_zones)
    repo.get_zone_by_id = AsyncMock(side_effect=lambda idx: next((z for z in mock_stadium_zones if z.id == idx), None))
    repo.update_zone_occupancy = AsyncMock()
    return repo


@pytest.fixture
def mock_cache() -> MagicMock:
    cache = MagicMock(spec=CachePort)
    cache.get = AsyncMock(return_value=None)
    cache.set = AsyncMock()
    cache.delete = AsyncMock()
    cache.exists = AsyncMock(return_value=False)
    return cache


@pytest.fixture
def wayfinding_service(mock_stadium_repo, mock_cache) -> WayfindingService:
    return WayfindingService(mock_stadium_repo, mock_cache)
