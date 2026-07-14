"""
FIFA Nexus AI — Wayfinding Pathfinding Unit Tests
"""

from __future__ import annotations

import pytest

from app.core.pathfinding import AStarPathfinder
from app.domain.entities import RoutePreference, StadiumZone


def test_astar_simple_path(mock_stadium_zones):
    pathfinder = AStarPathfinder()
    graph = {z.id: z for z in mock_stadium_zones}

    # Find path from Gate A to Concourse (1 hop)
    route = pathfinder.find_path(
        graph=graph,
        origin_id="gate-a",
        destination_id="concourse-100",
        needs_accessibility=False,
        is_vip=False,
        preference=RoutePreference.FASTEST,
    )

    assert route is not None
    assert len(route.path) == 2
    assert route.path[0].node_id == "gate-a"
    assert route.path[1].node_id == "concourse-100"
    assert route.total_distance_meters == 50
    assert route.total_time_seconds == 30


def test_astar_accessibility_needs(mock_stadium_zones):
    pathfinder = AStarPathfinder()
    graph = {z.id: z for z in mock_stadium_zones}

    # Seating-101 has is_accessible=False connection, so trying to route with accessibility=True should fail
    with pytest.raises(ValueError, match="No accessible path found"):
        pathfinder.find_path(
            graph=graph,
            origin_id="concourse-100",
            destination_id="seating-101",
            needs_accessibility=True,
            is_vip=False,
            preference=RoutePreference.ACCESSIBLE,
        )


def test_astar_vip_only_routing(mock_stadium_zones):
    pathfinder = AStarPathfinder()
    graph = {z.id: z for z in mock_stadium_zones}

    # VIP Lounge (concourse-300) is VIP only
    # Non-VIP user should fail
    with pytest.raises(ValueError, match="No accessible path found"):
        pathfinder.find_path(
            graph=graph,
            origin_id="concourse-100",
            destination_id="concourse-300",
            needs_accessibility=False,
            is_vip=False,
            preference=RoutePreference.FASTEST,
        )

    # VIP user should succeed
    route = pathfinder.find_path(
        graph=graph,
        origin_id="concourse-100",
        destination_id="concourse-300",
        needs_accessibility=False,
        is_vip=True,
        preference=RoutePreference.FASTEST,
    )
    assert route is not None
    assert route.path[-1].node_id == "concourse-300"


def test_astar_single_node(mock_stadium_zones):
    pathfinder = AStarPathfinder()
    graph = {z.id: z for z in mock_stadium_zones}

    route = pathfinder.find_path(
        graph=graph,
        origin_id="gate-a",
        destination_id="gate-a",
        needs_accessibility=False,
        is_vip=False,
        preference=RoutePreference.FASTEST,
    )
    assert len(route.path) == 1
    assert route.total_time_seconds == 0
    assert route.total_distance_meters == 0
