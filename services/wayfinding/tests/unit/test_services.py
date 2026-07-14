"""
FIFA Nexus AI — Wayfinding Service Unit Tests
"""

from __future__ import annotations

import pytest

from app.domain.services import WayfindingService


@pytest.mark.asyncio
async def test_get_stadium_map(wayfinding_service, mock_cache):
    # Verify mapping builds correctly and caches output
    stadium_map = await wayfinding_service.get_stadium_map()

    assert stadium_map["stadium_id"] == "metlife-stadium"
    assert len(stadium_map["nodes"]) == 4
    assert mock_cache.set.called


@pytest.mark.asyncio
async def test_get_zone_densities(wayfinding_service, mock_cache):
    densities = await wayfinding_service.get_zone_densities()

    assert len(densities) == 4
    # seating-101 has 450 occupancy / 500 capacity = 0.9 density
    seating_density = next(d for d in densities if d["zone_id"] == "seating-101")
    assert seating_density["density_ratio"] == 0.9
    assert seating_density["congestion_level"] == "critical"


@pytest.mark.asyncio
async def test_calculate_route_service(wayfinding_service):
    route = await wayfinding_service.calculate_route(
        origin_id="gate-a",
        destination_id="concourse-100",
        accessibility_needs=["none"],
        is_vip=False,
        preference="fastest",
        user_id="user-123",
    )
    assert route.route_id is not None
    assert route.is_personalized is True
    assert len(route.path) == 2
