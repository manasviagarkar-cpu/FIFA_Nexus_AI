"""
FIFA Nexus AI — Wayfinding PostgreSQL Adapter
Implements StadiumRepository outbound port.
"""

from __future__ import annotations

import logging
from typing import Optional

import asyncpg

from app.domain.entities import (
    GeoCoordinate,
    NodeConnection,
    StadiumZone,
    ZoneType,
)
from app.ports.outbound import StadiumRepository

logger = logging.getLogger(__name__)


class PostgresStadiumRepository(StadiumRepository):
    """PostgreSQL implementation of the stadium repository."""

    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def get_all_zones(self) -> list[StadiumZone]:
        """Retrieve all stadium zones without connections."""
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, name, zone_type, latitude, longitude, level,
                       is_accessible, is_vip_only, capacity, current_occupancy
                FROM stadium_zones
                ORDER BY id
                """
            )
            return [self._row_to_zone(row) for row in rows]

    async def get_all_zones_with_connections(self) -> list[StadiumZone]:
        """Retrieve all zones with their connections (full graph)."""
        async with self._pool.acquire() as conn:
            # Fetch zones
            zone_rows = await conn.fetch(
                """
                SELECT id, name, zone_type, latitude, longitude, level,
                       is_accessible, is_vip_only, capacity, current_occupancy
                FROM stadium_zones
                ORDER BY id
                """
            )

            # Fetch connections
            conn_rows = await conn.fetch(
                """
                SELECT source_zone_id, target_zone_id, base_cost_seconds,
                       distance_meters, is_accessible, is_vip_only,
                       has_stairs, has_elevator
                FROM zone_connections
                """
            )

            # Build connection map
            connection_map: dict[str, list[NodeConnection]] = {}
            for row in conn_rows:
                source_id = row["source_zone_id"]
                if source_id not in connection_map:
                    connection_map[source_id] = []
                connection_map[source_id].append(NodeConnection(
                    target_node_id=row["target_zone_id"],
                    base_cost_seconds=row["base_cost_seconds"],
                    distance_meters=row["distance_meters"],
                    is_accessible=row["is_accessible"],
                    is_vip_only=row["is_vip_only"],
                    has_stairs=row["has_stairs"],
                    has_elevator=row["has_elevator"],
                ))

            # Build zones with connections
            zones = []
            for row in zone_rows:
                zone = self._row_to_zone(row)
                zone.connections = connection_map.get(zone.id, [])
                zones.append(zone)

            return zones

    async def get_zone_by_id(self, zone_id: str) -> Optional[StadiumZone]:
        """Retrieve a specific zone by ID."""
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT id, name, zone_type, latitude, longitude, level,
                       is_accessible, is_vip_only, capacity, current_occupancy
                FROM stadium_zones WHERE id = $1
                """,
                zone_id,
            )
            if row is None:
                return None
            return self._row_to_zone(row)

    async def update_zone_occupancy(self, zone_id: str, occupancy: int) -> None:
        """Update the current occupancy of a zone."""
        async with self._pool.acquire() as conn:
            await conn.execute(
                "UPDATE stadium_zones SET current_occupancy = $1 WHERE id = $2",
                occupancy,
                zone_id,
            )

    @staticmethod
    def _row_to_zone(row: asyncpg.Record) -> StadiumZone:
        """Convert a database row to a StadiumZone entity."""
        capacity = row["capacity"]
        occupancy = row["current_occupancy"]
        density = occupancy / max(1, capacity)

        return StadiumZone(
            id=row["id"],
            name=row["name"],
            zone_type=ZoneType(row["zone_type"]),
            coordinate=GeoCoordinate(
                latitude=row["latitude"],
                longitude=row["longitude"],
                level=row["level"],
            ),
            is_accessible=row["is_accessible"],
            is_vip_only=row["is_vip_only"],
            capacity=capacity,
            current_occupancy=occupancy,
            current_density=density,
        )
