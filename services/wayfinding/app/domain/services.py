"""
FIFA Nexus AI — Wayfinding Domain Services
Business logic orchestrating pathfinding with crowd density.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional

from app.domain.entities import (
    AccessibilityNeed,
    CalculatedRoute,
    RoutePreference,
    StadiumZone,
)
from app.core.pathfinding import AStarPathfinder
from app.ports.outbound import StadiumRepository, CachePort

logger = logging.getLogger(__name__)


class WayfindingService:
    """Core wayfinding business logic — hexagonal domain service."""

    def __init__(
        self,
        stadium_repo: StadiumRepository,
        cache: CachePort,
    ) -> None:
        self._stadium_repo = stadium_repo
        self._cache = cache
        self._pathfinder = AStarPathfinder()

    async def calculate_route(
        self,
        origin_id: str,
        destination_id: str,
        accessibility_needs: list[str],
        is_vip: bool,
        preference: str,
        max_density_threshold: Optional[float] = None,
        user_id: Optional[str] = None,
    ) -> CalculatedRoute:
        """Calculate personalized route considering crowd density and user profile."""
        logger.info(
            "Calculating route from %s to %s (pref=%s, vip=%s)",
            origin_id, destination_id, preference, is_vip,
        )

        # Load stadium graph
        zones = await self._load_stadium_graph()

        # Validate origin and destination exist
        zone_map = {z.id: z for z in zones}
        if origin_id not in zone_map:
            raise ValueError(f"Origin zone '{origin_id}' not found")
        if destination_id not in zone_map:
            raise ValueError(f"Destination zone '{destination_id}' not found")

        # Parse preference
        try:
            route_pref = RoutePreference(preference)
        except ValueError:
            route_pref = RoutePreference.FASTEST

        # Parse accessibility needs
        needs_accessibility = any(
            need != "none" for need in accessibility_needs
        )

        # Calculate route using A*
        route = self._pathfinder.find_path(
            graph=zone_map,
            origin_id=origin_id,
            destination_id=destination_id,
            needs_accessibility=needs_accessibility,
            is_vip=is_vip,
            preference=route_pref,
            max_density_threshold=max_density_threshold,
        )

        route.is_personalized = user_id is not None

        # Cache the result
        cache_key = f"route:{route.route_id}"
        await self._cache.set(cache_key, route.__dict__, ttl=60)

        return route

    async def get_zone_densities(self) -> list[dict]:
        """Get current density information for all zones."""
        # Try cache first
        cached = await self._cache.get("zone:densities")
        if cached:
            return cached

        zones = await self._stadium_repo.get_all_zones()
        densities = []
        for zone in zones:
            density_ratio = zone.current_occupancy / max(1, zone.capacity)
            densities.append({
                "zone_id": zone.id,
                "zone_name": zone.name,
                "zone_type": zone.zone_type.value,
                "current_occupancy": zone.current_occupancy,
                "max_capacity": zone.capacity,
                "density_ratio": round(density_ratio, 3),
                "congestion_level": zone.congestion_level.value,
                "trend": 0.0,
                "alt_text": (
                    f"{zone.name}: {zone.current_occupancy} of {zone.capacity} capacity, "
                    f"congestion level {zone.congestion_level.value}"
                ),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })

        await self._cache.set("zone:densities", densities, ttl=30)
        return densities

    async def get_stadium_map(self) -> dict:
        """Get cached stadium map data."""
        # Try cache first (long TTL for static data)
        cached = await self._cache.get("stadium:map")
        if cached:
            return cached

        zones = await self._stadium_repo.get_all_zones()
        map_data = {
            "stadium_id": "metlife-stadium",
            "stadium_name": "MetLife Stadium - FIFA World Cup 2026",
            "nodes": [
                {
                    "id": z.id,
                    "name": z.name,
                    "zone_type": z.zone_type.value,
                    "coordinate": {
                        "latitude": z.coordinate.latitude,
                        "longitude": z.coordinate.longitude,
                        "level": z.coordinate.level,
                    },
                    "is_accessible": z.is_accessible,
                    "is_vip_only": z.is_vip_only,
                    "current_density": z.current_density,
                    "capacity": z.capacity,
                    "congestion_level": z.congestion_level.value,
                }
                for z in zones
            ],
            "total_capacity": sum(z.capacity for z in zones),
            "levels": max((z.coordinate.level for z in zones), default=0) + 1,
            "version": "1.0.0",
            "alt_text": (
                f"MetLife Stadium map with {len(zones)} zones across "
                f"{max((z.coordinate.level for z in zones), default=0) + 1} levels"
            ),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        await self._cache.set("stadium:map", map_data, ttl=3600)
        return map_data

    async def get_route_by_id(self, route_id: str) -> Optional[dict]:
        """Retrieve a previously calculated route from cache."""
        cache_key = f"route:{route_id}"
        return await self._cache.get(cache_key)

    async def _load_stadium_graph(self) -> list[StadiumZone]:
        """Load stadium graph with current density data."""
        zones = await self._stadium_repo.get_all_zones_with_connections()
        return zones
