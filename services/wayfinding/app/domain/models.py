"""
FIFA Nexus AI — Wayfinding Domain Models (Pydantic)
Request/response validation models for API layer.
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field, field_validator
import bleach


# ============================================================================
# Request Models
# ============================================================================

class RouteCalculateRequest(BaseModel):
    """Request body for route calculation."""

    origin: str = Field(..., min_length=1, max_length=100, description="Starting zone ID")
    destination: str = Field(..., min_length=1, max_length=100, description="Destination zone ID")
    accessibility_needs: list[str] = Field(
        default_factory=list,
        description="Accessibility requirements",
    )
    is_vip: bool = Field(default=False, description="Whether user has VIP access")
    preference: str = Field(default="fastest", description="Route optimization preference")
    max_density_threshold: Optional[float] = Field(
        None, ge=0.0, le=1.0, description="Maximum acceptable crowd density (0.0-1.0)"
    )

    @field_validator("origin", "destination")
    @classmethod
    def sanitize_ids(cls, v: str) -> str:
        """Sanitize input to prevent injection attacks."""
        return bleach.clean(v.strip(), tags=[], attributes={}, strip=True)

    @field_validator("preference")
    @classmethod
    def validate_preference(cls, v: str) -> str:
        valid = {"fastest", "least_crowded", "accessible", "scenic", "family_friendly"}
        if v not in valid:
            raise ValueError(f"Invalid preference. Must be one of: {', '.join(valid)}")
        return v

    @field_validator("accessibility_needs")
    @classmethod
    def validate_accessibility_needs(cls, v: list[str]) -> list[str]:
        valid = {
            "wheelchair", "visual_impairment", "hearing_impairment",
            "mobility_limited", "elderly", "family_with_children", "none",
        }
        for need in v:
            if need not in valid:
                raise ValueError(f"Invalid accessibility need: {need}")
        return v


# ============================================================================
# Response Models
# ============================================================================

class GeoCoordinateResponse(BaseModel):
    latitude: float
    longitude: float
    level: int


class RouteStepResponse(BaseModel):
    step_number: int = Field(..., alias="stepNumber")
    node_id: str = Field(..., alias="nodeId")
    node_name: str = Field(..., alias="nodeName")
    zone_type: str = Field(..., alias="zoneType")
    coordinate: GeoCoordinateResponse
    instruction: str
    alt_text: str = Field(..., alias="altText")
    time_from_previous_seconds: float = Field(..., alias="timeFromPreviousSeconds")
    distance_from_previous_meters: float = Field(..., alias="distanceFromPreviousMeters")
    current_density: float = Field(..., alias="currentDensity")
    congestion_level: str = Field(..., alias="congestionLevel")

    model_config = {"populate_by_name": True}


class RouteCalculateResponse(BaseModel):
    route_id: str = Field(..., alias="routeId")
    path: list[RouteStepResponse]
    total_time_seconds: float = Field(..., alias="totalTimeSeconds")
    total_distance_meters: float = Field(..., alias="totalDistanceMeters")
    average_density: float = Field(..., alias="averageDensity")
    accessibility_notes: str = Field(..., alias="accessibilityNotes")
    alt_text: str = Field(..., alias="altText")
    is_personalized: bool = Field(..., alias="isPersonalized")
    preference: str
    calculated_at: str = Field(..., alias="calculatedAt")
    valid_for_seconds: int = Field(..., alias="validForSeconds")

    model_config = {"populate_by_name": True}


class ZoneDensityResponse(BaseModel):
    zone_id: str = Field(..., alias="zoneId")
    zone_name: str = Field(..., alias="zoneName")
    zone_type: str = Field(..., alias="zoneType")
    current_occupancy: int = Field(..., alias="currentOccupancy")
    max_capacity: int = Field(..., alias="maxCapacity")
    density_ratio: float = Field(..., alias="densityRatio")
    congestion_level: str = Field(..., alias="congestionLevel")
    trend: float
    alt_text: str = Field(..., alias="altText")
    updated_at: str = Field(..., alias="updatedAt")

    model_config = {"populate_by_name": True}


class StadiumNodeResponse(BaseModel):
    id: str
    name: str
    zone_type: str = Field(..., alias="zoneType")
    coordinate: GeoCoordinateResponse
    is_accessible: bool = Field(..., alias="isAccessible")
    is_vip_only: bool = Field(..., alias="isVIPOnly")
    current_density: float = Field(..., alias="currentDensity")
    capacity: int
    congestion_level: str = Field(..., alias="congestionLevel")

    model_config = {"populate_by_name": True}


class StadiumMapResponse(BaseModel):
    stadium_id: str = Field(..., alias="stadiumId")
    stadium_name: str = Field(..., alias="stadiumName")
    nodes: list[StadiumNodeResponse]
    total_capacity: int = Field(..., alias="totalCapacity")
    levels: int
    version: str
    alt_text: str = Field(..., alias="altText")
    updated_at: str = Field(..., alias="updatedAt")

    model_config = {"populate_by_name": True}


# ============================================================================
# API Wrapper Models
# ============================================================================

class ApiErrorResponse(BaseModel):
    code: str
    message: str
    details: Optional[str] = None
    status_code: int = Field(..., alias="statusCode")
    timestamp: str
    trace_id: str = Field(..., alias="traceId")

    model_config = {"populate_by_name": True}


class ApiMetaResponse(BaseModel):
    timestamp: str
    version: str
    trace_id: str = Field(..., alias="traceId")
    alt_text: Optional[str] = Field(None, alias="altText")

    model_config = {"populate_by_name": True}


class HealthDependencyResponse(BaseModel):
    name: str
    status: str
    latency_ms: Optional[float] = Field(None, alias="latencyMs")

    model_config = {"populate_by_name": True}


class HealthCheckResponseModel(BaseModel):
    status: str
    service: str
    version: str
    uptime: float
    timestamp: str
    dependencies: list[HealthDependencyResponse]
