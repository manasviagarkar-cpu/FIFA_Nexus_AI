"""
FIFA Nexus AI — Wayfinding REST Routes Adapter
Implements inbound API endpoints.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.config import get_settings
from app.domain.models import (
    RouteCalculateRequest,
    RouteCalculateResponse,
    RouteStepResponse,
    GeoCoordinateResponse,
    ZoneDensityResponse,
    StadiumMapResponse,
    StadiumNodeResponse,
    ApiErrorResponse,
    ApiMetaResponse,
)
from app.domain.services import WayfindingService
from app.middleware.auth import verify_jwt, RequirePermission
from app.middleware.rate_limit import RedisRateLimiter
from shared.contracts import JWTPayload, UserRole, ApiResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1")


# Helper dependency to retrieve the WayfindingService
# (Usually injected via dependency container in main.py)
def get_wayfinding_service(request: Request) -> WayfindingService:
    return request.app.state.wayfinding_service


def get_rate_limiter(request: Request) -> RedisRateLimiter:
    return request.app.state.rate_limiter


async def check_rate_limit(
    request: Request,
    response: Response,
    token: JWTPayload = Depends(verify_jwt),
    limiter: RedisRateLimiter = Depends(get_rate_limiter),
):
    """Dependency to check rate limits and append headers."""
    identifier = token.sub
    role = token.role

    is_limited, remaining, retry_after = await limiter.is_rate_limited(identifier, role)

    response.headers["X-RateLimit-Limit"] = str(remaining + (1 if is_limited else 0))
    response.headers["X-RateLimit-Remaining"] = str(remaining)

    if is_limited:
        response.headers["Retry-After"] = str(retry_after)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please try again later.",
        )


@router.post(
    "/routes/calculate",
    response_model=ApiResponse[RouteCalculateResponse],
    dependencies=[Depends(check_rate_limit), Depends(RequirePermission("route:calculate"))],
    summary="Calculate dynamic wayfinding route",
    description="Finds a personalized, real-time optimal route avoiding congestion based on accessibility.",
)
async def calculate_route(
    request: Request,
    body: RouteCalculateRequest,
    token: JWTPayload = Depends(verify_jwt),
    service: WayfindingService = Depends(get_wayfinding_service),
):
    trace_id = str(uuid.uuid4())
    try:
        route = await service.calculate_route(
            origin_id=body.origin,
            destination_id=body.destination,
            accessibility_needs=body.accessibility_needs,
            is_vip=body.is_vip or token.role == UserRole.ADMIN,
            preference=body.preference,
            max_density_threshold=body.max_density_threshold,
            user_id=token.sub,
        )

        steps = [
            RouteStepResponse(
                stepNumber=s.step_number,
                nodeId=s.node_id,
                nodeName=s.node_name,
                zoneType=s.zone_type.value,
                coordinate=GeoCoordinateResponse(
                    latitude=s.coordinate.latitude,
                    longitude=s.coordinate.longitude,
                    level=s.coordinate.level,
                ),
                instruction=s.instruction,
                altText=s.alt_text,
                timeFromPreviousSeconds=s.time_from_previous_seconds,
                distanceFromPreviousMeters=s.distance_from_previous_meters,
                currentDensity=s.current_density,
                congestionLevel=s.congestion_level.value,
            )
            for s in route.path
        ]

        data = RouteCalculateResponse(
            routeId=route.route_id,
            path=steps,
            totalTimeSeconds=route.total_time_seconds,
            totalDistanceMeters=route.total_distance_meters,
            averageDensity=route.average_density,
            accessibilityNotes=route.accessibility_notes,
            altText=route.alt_text,
            isPersonalized=route.is_personalized,
            preference=route.preference.value,
            calculatedAt=datetime.now(timezone.utc).isoformat(),
            validForSeconds=60,
        )

        return ApiResponse(
            success=True,
            data=data,
            meta=ApiMetaResponse(
                timestamp=datetime.now(timezone.utc).isoformat(),
                version="1.0.0",
                traceId=trace_id,
                altText=route.alt_text,
            ),
        )

    except ValueError as e:
        logger.warning("Routing validation error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.exception("Failed to calculate route: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while calculating the route.",
        )


@router.get(
    "/routes/{route_id}",
    response_model=ApiResponse[RouteCalculateResponse],
    dependencies=[Depends(check_rate_limit), Depends(RequirePermission("route:view"))],
    summary="Get cached route",
)
async def get_route(
    route_id: str,
    service: WayfindingService = Depends(get_wayfinding_service),
):
    trace_id = str(uuid.uuid4())
    route_dict = await service.get_route_by_id(route_id)
    if not route_dict:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Route {route_id} not found or expired.",
        )

    # Note: route_dict is a serialized dictionary from cache. Parse back or return.
    # To keep things simple and fully compliant with Pydantic serialization:
    try:
        steps = [
            RouteStepResponse(
                stepNumber=s["step_number"],
                nodeId=s["node_id"],
                nodeName=s["node_name"],
                zoneType=s["zone_type"],
                coordinate=GeoCoordinateResponse(
                    latitude=s["coordinate"]["latitude"],
                    longitude=s["coordinate"]["longitude"],
                    level=s["coordinate"]["level"],
                ),
                instruction=s["instruction"],
                altText=s["alt_text"],
                timeFromPreviousSeconds=s["time_from_previous_seconds"],
                distanceFromPreviousMeters=s["distance_from_previous_meters"],
                currentDensity=s["current_density"],
                congestionLevel=s["congestion_level"],
            )
            for s in route_dict["path"]
        ]

        data = RouteCalculateResponse(
            routeId=route_dict["route_id"],
            path=steps,
            totalTimeSeconds=route_dict["total_time_seconds"],
            totalDistanceMeters=route_dict["total_distance_meters"],
            averageDensity=route_dict["average_density"],
            accessibilityNotes=route_dict.get("accessibility_notes", ""),
            altText=route_dict.get("alt_text", ""),
            isPersonalized=route_dict["is_personalized"],
            preference=route_dict["preference"],
            calculatedAt=datetime.now(timezone.utc).isoformat(),
            validForSeconds=30,
        )

        return ApiResponse(
            success=True,
            data=data,
            meta=ApiMetaResponse(
                timestamp=datetime.now(timezone.utc).isoformat(),
                version="1.0.0",
                traceId=trace_id,
                altText=data.alt_text,
            ),
        )
    except Exception as e:
        logger.exception("Failed to parse cached route: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error retrieving cached route.",
        )


@router.get(
    "/zones/density",
    response_model=ApiResponse[list[ZoneDensityResponse]],
    dependencies=[Depends(RequirePermission("zone:density:view"))],
    summary="Get current zone densities",
)
async def get_zone_densities(
    service: WayfindingService = Depends(get_wayfinding_service),
):
    trace_id = str(uuid.uuid4())
    try:
        densities = await service.get_zone_densities()
        data = [
            ZoneDensityResponse(
                zoneId=d["zone_id"],
                zoneName=d["zone_name"],
                zoneType=d["zone_type"],
                currentOccupancy=d["current_occupancy"],
                maxCapacity=d["max_capacity"],
                densityRatio=d["density_ratio"],
                congestionLevel=d["congestion_level"],
                trend=d["trend"],
                altText=d["alt_text"],
                updatedAt=d["updated_at"],
            )
            for d in densities
        ]

        return ApiResponse(
            success=True,
            data=data,
            meta=ApiMetaResponse(
                timestamp=datetime.now(timezone.utc).isoformat(),
                version="1.0.0",
                traceId=trace_id,
                altText="Live stadium zone crowd density information.",
            ),
        )
    except Exception as e:
        logger.exception("Failed to retrieve zone densities: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not retrieve crowd density data.",
        )


@router.get(
    "/stadium/map",
    response_model=ApiResponse[StadiumMapResponse],
    dependencies=[Depends(RequirePermission("stadium:map:view"))],
    summary="Retrieve static stadium map structure",
)
async def get_stadium_map(
    service: WayfindingService = Depends(get_wayfinding_service),
):
    trace_id = str(uuid.uuid4())
    try:
        map_data = await service.get_stadium_map()

        nodes = [
            StadiumNodeResponse(
                id=n["id"],
                name=n["name"],
                zoneType=n["zone_type"],
                coordinate=GeoCoordinateResponse(
                    latitude=n["coordinate"]["latitude"],
                    longitude=n["coordinate"]["longitude"],
                    level=n["coordinate"]["level"],
                ),
                isAccessible=n["is_accessible"],
                isVIPOnly=n["is_vip_only"],
                currentDensity=n["current_density"],
                capacity=n["capacity"],
                congestionLevel=n["congestion_level"],
            )
            for n in map_data["nodes"]
        ]

        data = StadiumMapResponse(
            stadiumId=map_data["stadium_id"],
            stadiumName=map_data["stadium_name"],
            nodes=nodes,
            totalCapacity=map_data["total_capacity"],
            levels=map_data["levels"],
            version=map_data["version"],
            altText=map_data["alt_text"],
            updatedAt=map_data["updated_at"],
        )

        return ApiResponse(
            success=True,
            data=data,
            meta=ApiMetaResponse(
                timestamp=datetime.now(timezone.utc).isoformat(),
                version="1.0.0",
                traceId=trace_id,
                altText=data.alt_text,
            ),
        )
    except Exception as e:
        logger.exception("Failed to retrieve stadium map: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not retrieve stadium map.",
        )
