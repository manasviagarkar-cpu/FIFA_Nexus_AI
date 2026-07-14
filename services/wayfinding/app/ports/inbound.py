"""
FIFA Nexus AI — Wayfinding Ports: Inbound (Use Cases)
Hexagonal architecture inbound port interfaces.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from app.domain.entities import CalculatedRoute


class RouteCalculationUseCase(ABC):
    """Inbound port for route calculation."""

    @abstractmethod
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
        ...

    @abstractmethod
    async def get_route_by_id(self, route_id: str) -> Optional[dict]:
        ...


class ZoneDensityUseCase(ABC):
    """Inbound port for zone density queries."""

    @abstractmethod
    async def get_zone_densities(self) -> list[dict]:
        ...


class StadiumMapUseCase(ABC):
    """Inbound port for stadium map retrieval."""

    @abstractmethod
    async def get_stadium_map(self) -> dict:
        ...
