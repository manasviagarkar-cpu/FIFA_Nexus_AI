"""
FIFA Nexus AI — Shared Contracts: Python Mirror
Zero-drift synchronization with TypeScript contracts.

All models here MUST exactly mirror the TypeScript interfaces in shared/contracts/src/.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Generic, TypeVar, Optional

from pydantic import BaseModel, Field, field_validator


# ============================================================================
# Enums (mirrors common.ts)
# ============================================================================

class UserRole(str, Enum):
    FAN = "fan"
    STAFF = "staff"
    ADMIN = "admin"


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


class AlertPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AlertStatus(str, Enum):
    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    EXPIRED = "expired"


class SensorType(str, Enum):
    TURNSTILE = "turnstile"
    WIFI_PROBE = "wifi_probe"
    CAMERA = "camera"
    ENVIRONMENTAL = "environmental"
    CROWD_COUNTER = "crowd_counter"


class SupportedLanguage(str, Enum):
    EN = "en"
    ES = "es"
    FR = "fr"
    AR = "ar"
    PT = "pt"
    DE = "de"
    JA = "ja"
    ZH = "zh"
    KO = "ko"
    HI = "hi"
    IT = "it"
    NL = "nl"


class RoutePreference(str, Enum):
    FASTEST = "fastest"
    LEAST_CROWDED = "least_crowded"
    ACCESSIBLE = "accessible"
    SCENIC = "scenic"
    FAMILY_FRIENDLY = "family_friendly"


# ============================================================================
# Common Models (mirrors common.ts)
# ============================================================================

class GeoCoordinate(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    level: int = Field(default=0, description="Floor/level within the stadium (0 = ground)")


class ApiError(BaseModel):
    code: str
    message: str
    details: Optional[str] = None
    status_code: int = Field(..., alias="statusCode")
    timestamp: str
    trace_id: str = Field(..., alias="traceId")

    model_config = {"populate_by_name": True}


T = TypeVar("T")


class ApiResponseMeta(BaseModel):
    timestamp: str
    version: str
    trace_id: str = Field(..., alias="traceId")
    alt_text: Optional[str] = Field(None, alias="altText")

    model_config = {"populate_by_name": True}


class ApiResponse(BaseModel, Generic[T]):
    success: bool
    data: Optional[T] = None  # type: ignore[valid-type]
    error: Optional[ApiError] = None
    meta: Optional[ApiResponseMeta] = None


class HealthDependency(BaseModel):
    name: str
    status: str  # 'connected' | 'disconnected' | 'degraded'
    latency_ms: Optional[float] = Field(None, alias="latencyMs")

    model_config = {"populate_by_name": True}


class HealthCheckResponse(BaseModel):
    status: str  # 'healthy' | 'degraded' | 'unhealthy'
    service: str
    version: str
    uptime: float
    timestamp: str
    dependencies: list[HealthDependency]


# ============================================================================
# Auth Models (mirrors auth.ts)
# ============================================================================

class JWTPayload(BaseModel):
    sub: str
    email: str
    name: str
    role: UserRole
    iat: int
    exp: int
    iss: str


class SeatInfo(BaseModel):
    section: str
    row: str
    seat: str
    level: int


class UserProfile(BaseModel):
    id: str
    email: str
    name: str
    role: UserRole
    preferred_language: SupportedLanguage = Field(..., alias="preferredLanguage")
    accessibility_needs: list[AccessibilityNeed] = Field(..., alias="accessibilityNeeds")
    is_vip: bool = Field(..., alias="isVIP")
    supported_team: Optional[str] = Field(None, alias="supportedTeam")
    seat_info: Optional[SeatInfo] = Field(None, alias="seatInfo")
    created_at: str = Field(..., alias="createdAt")
    updated_at: str = Field(..., alias="updatedAt")

    model_config = {"populate_by_name": True}


# ============================================================================
# Wayfinding Models (mirrors wayfinding.ts)
# ============================================================================

class NodeConnection(BaseModel):
    target_node_id: str = Field(..., alias="targetNodeId")
    base_cost_seconds: float = Field(..., alias="baseCostSeconds")
    distance_meters: float = Field(..., alias="distanceMeters")
    is_accessible: bool = Field(..., alias="isAccessible")
    is_vip_only: bool = Field(..., alias="isVIPOnly")
    has_stairs: bool = Field(..., alias="hasStairs")
    has_elevator: bool = Field(..., alias="hasElevator")

    model_config = {"populate_by_name": True}


class StadiumNode(BaseModel):
    id: str
    name: str
    zone_type: ZoneType = Field(..., alias="zoneType")
    coordinate: GeoCoordinate
    is_accessible: bool = Field(..., alias="isAccessible")
    is_vip_only: bool = Field(..., alias="isVIPOnly")
    connections: list[NodeConnection]
    current_density: float = Field(..., ge=0.0, le=1.0, alias="currentDensity")
    capacity: int = Field(..., gt=0)

    model_config = {"populate_by_name": True}


class RouteRequest(BaseModel):
    origin: str = Field(..., description="Starting point node ID")
    destination: str = Field(..., description="Destination node ID")
    accessibility_needs: list[AccessibilityNeed] = Field(
        default_factory=list, alias="accessibilityNeeds"
    )
    is_vip: bool = Field(default=False, alias="isVIP")
    preference: RoutePreference = RoutePreference.FASTEST
    max_density_threshold: Optional[float] = Field(
        None, ge=0.0, le=1.0, alias="maxDensityThreshold"
    )
    user_id: Optional[str] = Field(None, alias="userId")

    model_config = {"populate_by_name": True}

    @field_validator("origin", "destination")
    @classmethod
    def validate_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Must not be empty")
        return v.strip()


class RouteStep(BaseModel):
    step_number: int = Field(..., alias="stepNumber")
    node_id: str = Field(..., alias="nodeId")
    node_name: str = Field(..., alias="nodeName")
    zone_type: ZoneType = Field(..., alias="zoneType")
    coordinate: GeoCoordinate
    instruction: str
    alt_text: str = Field(..., alias="altText")
    time_from_previous_seconds: float = Field(..., alias="timeFromPreviousSeconds")
    distance_from_previous_meters: float = Field(..., alias="distanceFromPreviousMeters")
    current_density: float = Field(..., alias="currentDensity")
    congestion_level: CongestionLevel = Field(..., alias="congestionLevel")

    model_config = {"populate_by_name": True}


class RouteResponse(BaseModel):
    route_id: str = Field(..., alias="routeId")
    path: list[RouteStep]
    total_time_seconds: float = Field(..., alias="totalTimeSeconds")
    total_distance_meters: float = Field(..., alias="totalDistanceMeters")
    average_density: float = Field(..., alias="averageDensity")
    accessibility_notes: str = Field(..., alias="accessibilityNotes")
    alt_text: str = Field(..., alias="altText")
    is_personalized: bool = Field(..., alias="isPersonalized")
    preference: RoutePreference
    calculated_at: str = Field(..., alias="calculatedAt")
    valid_for_seconds: int = Field(..., alias="validForSeconds")
    alternatives: Optional[list["RouteResponse"]] = None

    model_config = {"populate_by_name": True}


class ZoneDensityInfo(BaseModel):
    zone_id: str = Field(..., alias="zoneId")
    zone_name: str = Field(..., alias="zoneName")
    zone_type: ZoneType = Field(..., alias="zoneType")
    current_occupancy: int = Field(..., alias="currentOccupancy")
    max_capacity: int = Field(..., alias="maxCapacity")
    density_ratio: float = Field(..., ge=0.0, le=1.0, alias="densityRatio")
    congestion_level: CongestionLevel = Field(..., alias="congestionLevel")
    trend: float
    alt_text: str = Field(..., alias="altText")
    updated_at: str = Field(..., alias="updatedAt")

    model_config = {"populate_by_name": True}


class StadiumMap(BaseModel):
    stadium_id: str = Field(..., alias="stadiumId")
    stadium_name: str = Field(..., alias="stadiumName")
    nodes: list[StadiumNode]
    total_capacity: int = Field(..., alias="totalCapacity")
    levels: int
    version: str
    alt_text: str = Field(..., alias="altText")
    updated_at: str = Field(..., alias="updatedAt")

    model_config = {"populate_by_name": True}


# ============================================================================
# Rate Limit Config
# ============================================================================

DEFAULT_RATE_LIMITS: dict[UserRole, dict[str, int]] = {
    UserRole.FAN: {"max_requests": 100, "window_seconds": 60},
    UserRole.STAFF: {"max_requests": 500, "window_seconds": 60},
    UserRole.ADMIN: {"max_requests": 1000, "window_seconds": 60},
}

ROLE_PERMISSIONS: dict[UserRole, list[str]] = {
    UserRole.FAN: [
        "route:calculate",
        "route:view",
        "zone:density:view",
        "stadium:map:view",
        "translate",
        "stadium:query",
        "feedback:submit",
    ],
    UserRole.STAFF: [
        "route:calculate",
        "route:view",
        "zone:density:view",
        "stadium:map:view",
        "translate",
        "stadium:query",
        "feedback:submit",
        "sensor:ingest",
        "prediction:view",
        "alert:view",
        "alert:acknowledge",
    ],
    UserRole.ADMIN: [
        "route:calculate",
        "route:view",
        "zone:density:view",
        "stadium:map:view",
        "stadium:map:update",
        "translate",
        "stadium:query",
        "feedback:submit",
        "feedback:view",
        "sensor:ingest",
        "prediction:view",
        "prediction:configure",
        "alert:view",
        "alert:acknowledge",
        "alert:configure",
        "user:manage",
        "system:configure",
    ],
}
