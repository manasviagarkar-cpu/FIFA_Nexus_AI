"""
FIFA Nexus AI — Wayfinding Domain Entities
Core domain objects independent of infrastructure concerns.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class AccessibilityNeed(str, Enum):
    WHEELCHAIR = "wheelchair"
    VISUAL_IMPAIRMENT = "visual_impairment"
    HEARING_IMPAIRMENT = "hearing_impairment"
    MOBILITY_LIMITED = "mobility_limited"
    ELDERLY = "elderly"
    FAMILY_WITH_CHILDREN = "family_with_children"
    NONE = "none"


class ZoneType(str, Enum):
    ENTRANCE = "entrance"
    CONCOURSE = "concourse"
    SEATING = "seating"
    CONCESSION = "concession"
    RESTROOM = "restroom"
    MERCHANDISE = "merchandise"
    VIP_LOUNGE = "vip_lounge"
    MEDICAL = "medical"
    EXIT = "exit"
    PARKING = "parking"
    MEDIA = "media"


class CongestionLevel(str, Enum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    CRITICAL = "critical"

    @classmethod
    def from_density(cls, density: float) -> "CongestionLevel":
        """Classify density ratio to congestion level."""
        if density < 0.4:
            return cls.LOW
        elif density < 0.65:
            return cls.MODERATE
        elif density < 0.85:
            return cls.HIGH
        else:
            return cls.CRITICAL


class RoutePreference(str, Enum):
    FASTEST = "fastest"
    LEAST_CROWDED = "least_crowded"
    ACCESSIBLE = "accessible"
    SCENIC = "scenic"
    FAMILY_FRIENDLY = "family_friendly"


@dataclass
class GeoCoordinate:
    latitude: float
    longitude: float
    level: int = 0


@dataclass
class NodeConnection:
    target_node_id: str
    base_cost_seconds: float
    distance_meters: float
    is_accessible: bool
    is_vip_only: bool
    has_stairs: bool
    has_elevator: bool

    def effective_cost(
        self,
        target_density: float,
        needs_accessibility: bool,
        is_vip: bool,
        preference: RoutePreference,
    ) -> float:
        """Calculate effective traversal cost considering dynamic factors."""
        # Inaccessible path for users needing accessibility
        if needs_accessibility and not self.is_accessible:
            return float("inf")

        # VIP-only path for non-VIP users
        if self.is_vip_only and not is_vip:
            return float("inf")

        # Stairs penalty for accessibility needs
        if needs_accessibility and self.has_stairs and not self.has_elevator:
            return float("inf")

        cost = self.base_cost_seconds

        # Density penalty: exponential increase as density approaches 1.0
        density_multiplier = 1.0 + (target_density ** 2) * 3.0
        cost *= density_multiplier

        # Preference-based adjustments
        if preference == RoutePreference.LEAST_CROWDED:
            cost *= 1.0 + target_density * 5.0
        elif preference == RoutePreference.ACCESSIBLE:
            if self.has_elevator:
                cost *= 0.8  # Prefer elevators
            if self.has_stairs and not self.has_elevator:
                cost *= 2.5
        elif preference == RoutePreference.FAMILY_FRIENDLY:
            if self.has_stairs:
                cost *= 1.5
            cost *= 1.0 + target_density * 2.0  # Avoid crowds more
        elif preference == RoutePreference.SCENIC:
            cost *= 0.9  # Slight preference for longer scenic routes

        return cost


@dataclass
class StadiumZone:
    id: str
    name: str
    zone_type: ZoneType
    coordinate: GeoCoordinate
    is_accessible: bool
    is_vip_only: bool
    connections: list[NodeConnection] = field(default_factory=list)
    current_density: float = 0.0
    capacity: int = 500
    current_occupancy: int = 0

    @property
    def congestion_level(self) -> CongestionLevel:
        return CongestionLevel.from_density(self.current_density)

    def update_density(self, occupancy: int) -> None:
        """Update zone density based on current occupancy."""
        self.current_occupancy = max(0, occupancy)
        self.current_density = min(1.0, self.current_occupancy / max(1, self.capacity))


@dataclass
class RouteStep:
    step_number: int
    node_id: str
    node_name: str
    zone_type: ZoneType
    coordinate: GeoCoordinate
    instruction: str
    time_from_previous_seconds: float
    distance_from_previous_meters: float
    current_density: float
    congestion_level: CongestionLevel

    @property
    def alt_text(self) -> str:
        """Generate accessibility alt-text for this step."""
        return (
            f"Step {self.step_number}: {self.instruction}. "
            f"Area: {self.node_name} ({self.zone_type.value}). "
            f"Crowd level: {self.congestion_level.value}. "
            f"Estimated time: {self.time_from_previous_seconds:.0f} seconds."
        )


@dataclass
class CalculatedRoute:
    route_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    path: list[RouteStep] = field(default_factory=list)
    total_time_seconds: float = 0.0
    total_distance_meters: float = 0.0
    average_density: float = 0.0
    is_personalized: bool = False
    preference: RoutePreference = RoutePreference.FASTEST

    @property
    def accessibility_notes(self) -> str:
        """Generate detailed accessibility summary."""
        stairs_count = 0
        elevators_count = 0
        high_density_zones = 0

        for step in self.path:
            if step.congestion_level in (CongestionLevel.HIGH, CongestionLevel.CRITICAL):
                high_density_zones += 1

        notes = (
            f"Route has {len(self.path)} steps, total distance "
            f"{self.total_distance_meters:.0f} meters, estimated time "
            f"{self.total_time_seconds:.0f} seconds. "
        )
        if high_density_zones > 0:
            notes += f"Passes through {high_density_zones} high-density area(s). "
        return notes

    @property
    def alt_text(self) -> str:
        """Generate route alt-text for screen readers."""
        if not self.path:
            return "No route available."
        start = self.path[0].node_name
        end = self.path[-1].node_name
        return (
            f"Route from {start} to {end}. "
            f"{len(self.path)} steps, {self.total_distance_meters:.0f} meters, "
            f"approximately {self.total_time_seconds / 60:.1f} minutes. "
            f"Average crowd density: {self.average_density:.0%}."
        )
