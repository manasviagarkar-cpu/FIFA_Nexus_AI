"""
FIFA Nexus AI — Wayfinding Ports: Outbound (Repository Interfaces)
Hexagonal architecture outbound port interfaces.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Optional

from app.domain.entities import StadiumZone


class StadiumRepository(ABC):
    """Outbound port for stadium data persistence."""

    @abstractmethod
    async def get_all_zones(self) -> list[StadiumZone]:
        """Retrieve all stadium zones."""
        ...

    @abstractmethod
    async def get_all_zones_with_connections(self) -> list[StadiumZone]:
        """Retrieve all zones with their connections (full graph)."""
        ...

    @abstractmethod
    async def get_zone_by_id(self, zone_id: str) -> Optional[StadiumZone]:
        """Retrieve a specific zone by ID."""
        ...

    @abstractmethod
    async def update_zone_occupancy(self, zone_id: str, occupancy: int) -> None:
        """Update the current occupancy of a zone."""
        ...


class CachePort(ABC):
    """Outbound port for caching operations."""

    @abstractmethod
    async def get(self, key: str) -> Optional[Any]:
        """Retrieve value from cache."""
        ...

    @abstractmethod
    async def set(self, key: str, value: Any, ttl: int = 300) -> None:
        """Store value in cache with TTL."""
        ...

    @abstractmethod
    async def delete(self, key: str) -> None:
        """Delete value from cache."""
        ...

    @abstractmethod
    async def exists(self, key: str) -> bool:
        """Check if key exists in cache."""
        ...
