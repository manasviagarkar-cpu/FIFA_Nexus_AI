"""
FIFA Nexus AI — Core Pathfinding Algorithm
Weighted A* pathfinding considering crowd density, accessibility, and VIP status.
"""

from __future__ import annotations

import heapq
import logging
import math
import uuid
from datetime import datetime, timezone
from typing import Optional

from app.domain.entities import (
    CalculatedRoute,
    CongestionLevel,
    GeoCoordinate,
    RoutePreference,
    RouteStep,
    StadiumZone,
)

logger = logging.getLogger(__name__)


class AStarPathfinder:
    """
    Weighted A* pathfinder for stadium navigation.

    Considers:
    - Real-time crowd density per zone
    - Accessibility requirements (wheelchair ramps, elevators)
    - VIP-only shortcuts
    - Route preference (fastest, least crowded, scenic, etc.)
    """

    def find_path(
        self,
        graph: dict[str, StadiumZone],
        origin_id: str,
        destination_id: str,
        needs_accessibility: bool,
        is_vip: bool,
        preference: RoutePreference,
        max_density_threshold: Optional[float] = None,
    ) -> CalculatedRoute:
        """
        Find optimal path using weighted A* algorithm.

        Args:
            graph: Dictionary of zone_id -> StadiumZone
            origin_id: Starting zone ID
            destination_id: Target zone ID
            needs_accessibility: Whether accessible paths are required
            is_vip: Whether VIP-only paths are available
            preference: Route optimization preference
            max_density_threshold: Maximum acceptable density (skip zones above this)

        Returns:
            CalculatedRoute with ordered steps

        Raises:
            ValueError: If no valid path exists
        """
        if origin_id not in graph:
            raise ValueError(f"Origin zone '{origin_id}' not found in graph")
        if destination_id not in graph:
            raise ValueError(f"Destination zone '{destination_id}' not found in graph")

        if origin_id == destination_id:
            return self._build_single_step_route(graph[origin_id], preference)

        # A* algorithm
        # Priority queue: (f_score, counter, node_id)
        counter = 0
        open_set: list[tuple[float, int, str]] = [(0.0, counter, origin_id)]
        came_from: dict[str, str] = {}
        g_score: dict[str, float] = {origin_id: 0.0}
        f_score: dict[str, float] = {origin_id: self._heuristic(graph[origin_id], graph[destination_id])}

        closed_set: set[str] = set()

        while open_set:
            _, _, current_id = heapq.heappop(open_set)

            if current_id == destination_id:
                return self._reconstruct_path(
                    graph, came_from, current_id, origin_id, preference
                )

            if current_id in closed_set:
                continue
            closed_set.add(current_id)

            current_zone = graph[current_id]

            for connection in current_zone.connections:
                neighbor_id = connection.target_node_id

                if neighbor_id not in graph or neighbor_id in closed_set:
                    continue

                neighbor_zone = graph[neighbor_id]

                # Skip zones above density threshold
                if max_density_threshold is not None and neighbor_zone.current_density > max_density_threshold:
                    continue

                # Calculate edge cost
                edge_cost = connection.effective_cost(
                    target_density=neighbor_zone.current_density,
                    needs_accessibility=needs_accessibility,
                    is_vip=is_vip,
                    preference=preference,
                )

                if edge_cost == float("inf"):
                    continue

                tentative_g = g_score[current_id] + edge_cost

                if tentative_g < g_score.get(neighbor_id, float("inf")):
                    came_from[neighbor_id] = current_id
                    g_score[neighbor_id] = tentative_g
                    h = self._heuristic(neighbor_zone, graph[destination_id])
                    f_score[neighbor_id] = tentative_g + h

                    counter += 1
                    heapq.heappush(open_set, (f_score[neighbor_id], counter, neighbor_id))

        raise ValueError(
            f"No accessible path found from '{origin_id}' to '{destination_id}'. "
            "Try relaxing accessibility requirements or density thresholds."
        )

    def _heuristic(self, zone_a: StadiumZone, zone_b: StadiumZone) -> float:
        """
        A* heuristic: Haversine distance between two zones divided by
        an assumed walking speed, giving an optimistic time estimate.
        """
        dist = self._haversine_distance(zone_a.coordinate, zone_b.coordinate)
        # Assume 1.4 m/s walking speed, add level change penalty
        level_diff = abs(zone_a.coordinate.level - zone_b.coordinate.level)
        return (dist / 1.4) + (level_diff * 30)  # 30 seconds per level change

    @staticmethod
    def _haversine_distance(a: GeoCoordinate, b: GeoCoordinate) -> float:
        """Calculate Haversine distance between two coordinates in meters."""
        R = 6371000  # Earth's radius in meters
        lat1, lat2 = math.radians(a.latitude), math.radians(b.latitude)
        dlat = math.radians(b.latitude - a.latitude)
        dlon = math.radians(b.longitude - a.longitude)

        h = (
            math.sin(dlat / 2) ** 2
            + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
        )
        return 2 * R * math.asin(math.sqrt(h))

    def _reconstruct_path(
        self,
        graph: dict[str, StadiumZone],
        came_from: dict[str, str],
        end_id: str,
        start_id: str,
        preference: RoutePreference,
    ) -> CalculatedRoute:
        """Reconstruct the path from A* result and build route steps."""
        # Build path node IDs
        path_ids: list[str] = []
        current = end_id
        while current != start_id:
            path_ids.append(current)
            current = came_from[current]
        path_ids.append(start_id)
        path_ids.reverse()

        # Build route steps
        steps: list[RouteStep] = []
        total_time = 0.0
        total_distance = 0.0
        total_density = 0.0

        for i, node_id in enumerate(path_ids):
            zone = graph[node_id]
            time_from_prev = 0.0
            dist_from_prev = 0.0

            if i > 0:
                prev_zone = graph[path_ids[i - 1]]
                # Find the connection between prev and current
                for conn in prev_zone.connections:
                    if conn.target_node_id == node_id:
                        time_from_prev = conn.base_cost_seconds
                        dist_from_prev = conn.distance_meters
                        break

            total_time += time_from_prev
            total_distance += dist_from_prev
            total_density += zone.current_density

            # Generate navigation instruction
            instruction = self._generate_instruction(zone, i, len(path_ids))

            steps.append(RouteStep(
                step_number=i + 1,
                node_id=zone.id,
                node_name=zone.name,
                zone_type=zone.zone_type,
                coordinate=zone.coordinate,
                instruction=instruction,
                time_from_previous_seconds=time_from_prev,
                distance_from_previous_meters=dist_from_prev,
                current_density=zone.current_density,
                congestion_level=zone.congestion_level,
            ))

        avg_density = total_density / max(1, len(steps))

        route = CalculatedRoute(
            route_id=str(uuid.uuid4()),
            path=steps,
            total_time_seconds=total_time,
            total_distance_meters=total_distance,
            average_density=round(avg_density, 3),
            preference=preference,
        )

        return route

    def _build_single_step_route(
        self, zone: StadiumZone, preference: RoutePreference
    ) -> CalculatedRoute:
        """Build a route when origin and destination are the same."""
        step = RouteStep(
            step_number=1,
            node_id=zone.id,
            node_name=zone.name,
            zone_type=zone.zone_type,
            coordinate=zone.coordinate,
            instruction="You are already at your destination.",
            time_from_previous_seconds=0,
            distance_from_previous_meters=0,
            current_density=zone.current_density,
            congestion_level=zone.congestion_level,
        )
        return CalculatedRoute(
            path=[step],
            total_time_seconds=0,
            total_distance_meters=0,
            average_density=zone.current_density,
            preference=preference,
        )

    @staticmethod
    def _generate_instruction(zone: StadiumZone, step_index: int, total_steps: int) -> str:
        """Generate human-readable navigation instruction."""
        if step_index == 0:
            return f"Start at {zone.name}."
        elif step_index == total_steps - 1:
            return f"Arrive at {zone.name}. You have reached your destination."
        else:
            type_desc = zone.zone_type.value.replace("_", " ")
            density_note = ""
            if zone.congestion_level == CongestionLevel.HIGH:
                density_note = " Expect moderate crowds."
            elif zone.congestion_level == CongestionLevel.CRITICAL:
                density_note = " Heavy crowds — proceed carefully."
            return f"Continue through {zone.name} ({type_desc}).{density_note}"
