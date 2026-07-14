"""
FIFA Nexus AI — Wayfinding Service Entrypoint
"""

from __future__ import annotations

import os
import sys

# Adjust sys.path to make app and shared modules importable in Vercel serverless environment
current_dir = os.path.dirname(os.path.abspath(__file__))
# current_dir is <root>/services/wayfinding/app
service_root = os.path.dirname(current_dir) # <root>/services/wayfinding
repo_root = os.path.dirname(os.path.dirname(service_root)) # <root>

if service_root not in sys.path:
    sys.path.insert(0, service_root)
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

import logging
import time
from contextlib import asynccontextmanager

import asyncpg
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import redis.asyncio as redis

from app.adapters.inbound.routes import router
from app.adapters.outbound.cache import RedisCacheAdapter
from app.adapters.outbound.database import PostgresStadiumRepository
from app.config import get_settings
from app.domain.services import WayfindingService
from app.middleware.rate_limit import RedisRateLimiter
from shared.contracts import ApiError, ApiResponse

# Configure logging
settings = get_settings()
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("wayfinding")


async def init_app_state(app: FastAPI):
    """Lazy initialization of database and cache dependencies."""
    if hasattr(app.state, "wayfinding_service") and app.state.wayfinding_service:
        return

    logger.info("Lazily initializing database and Redis connections...")

    # Initialize PostgreSQL Pool
    if not hasattr(app.state, "db_pool") or not app.state.db_pool:
        try:
            db_pool = await asyncpg.create_pool(
                dsn=settings.database_url,
                min_size=1,
                max_size=5,
                timeout=10.0,
            )
            app.state.db_pool = db_pool
            logger.info("Connected to PostgreSQL pool successfully (lazy).")
        except Exception as e:
            logger.critical("Failed to connect to PostgreSQL (lazy): %s", e)
            raise e
    else:
        db_pool = app.state.db_pool

    # Initialize Redis Client
    if not hasattr(app.state, "redis_client") or not app.state.redis_client:
        try:
            redis_client = redis.from_url(
                settings.redis_url,
                decode_responses=True,
            )
            app.state.redis_client = redis_client
            logger.info("Connected to Redis successfully (lazy).")
        except Exception as e:
            logger.critical("Failed to connect to Redis (lazy): %s", e)
            raise e
    else:
        redis_client = app.state.redis_client

    # Instantiate Adapters and Services
    stadium_repo = PostgresStadiumRepository(db_pool)
    cache = RedisCacheAdapter(redis_client)
    app.state.wayfinding_service = WayfindingService(stadium_repo, cache)
    app.state.rate_limiter = RedisRateLimiter(redis_client)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for db pool and Redis connections."""
    logger.info("Starting up Wayfinding Service...")
    try:
        await init_app_state(app)
    except Exception as e:
        logger.warning("Could not pre-initialize connections at startup: %s", e)

    yield

    # Shutdown
    logger.info("Shutting down Wayfinding Service...")
    if hasattr(app.state, "db_pool") and app.state.db_pool:
        await app.state.db_pool.close()
        logger.info("PostgreSQL pool closed.")
    if hasattr(app.state, "redis_client") and app.state.redis_client:
        await app.state.redis_client.close()
        logger.info("Redis connection closed.")


app = FastAPI(
    title="FIFA Nexus AI — Wayfinding Service",
    description="Dynamic pathfinding and crowd density routing for FIFA 2026 World Cup stadium operations.",
    version=settings.SERVICE_VERSION,
    lifespan=lifespan,
)

# CORS Middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """Appends server performance latency headers and log metrics."""
    start_time = time.perf_counter()
    response = await call_next(request)
    process_time = time.perf_counter() - start_time
    response.headers["X-Process-Time"] = f"{process_time:.4f}s"
    return response


@app.middleware("http")
async def ensure_app_state_initialized(request: Request, call_next):
    """Ensures database and Redis connections are initialized before route processing."""
    if request.url.path.startswith("/api/v1") or request.url.path.startswith("/graphql"):
        await init_app_state(request.app)
    response = await call_next(request)
    return response


# Register route handlers
app.include_router(router)


# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception in API request context:")
    trace_id = request.headers.get("X-Trace-ID", "unknown-trace")
    api_error = ApiError(
        code="INTERNAL_SERVER_ERROR",
        message="An unexpected error occurred. Please contact stadium support.",
        details=str(exc) if settings.LOG_LEVEL.lower() == "debug" else None,
        statusCode=status.HTTP_500_INTERNAL_SERVER_ERROR,
        timestamp=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        traceId=trace_id,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=ApiResponse(success=False, error=api_error).model_dump(by_alias=True),
    )


@app.get("/api/v1/health", tags=["System"])
@app.get("/api/v1/health-wayfinding", tags=["System"])
async def health_check(request: Request):
    """Retrieve service and infrastructure integration health status."""
    uptime = time.perf_counter()
    status_overall = "healthy"
    dependencies = []

    # Test Database
    try:
        t0 = time.perf_counter()
        async with request.app.state.db_pool.acquire() as conn:
            await conn.execute("SELECT 1")
        latency = (time.perf_counter() - t0) * 1000
        dependencies.append({"name": "postgres", "status": "connected", "latencyMs": round(latency, 2)})
    except Exception as e:
        status_overall = "degraded"
        dependencies.append({"name": "postgres", "status": "disconnected", "details": str(e)})

    # Test Redis
    try:
        t0 = time.perf_counter()
        await request.app.state.redis_client.ping()
        latency = (time.perf_counter() - t0) * 1000
        dependencies.append({"name": "redis", "status": "connected", "latencyMs": round(latency, 2)})
    except Exception as e:
        status_overall = "degraded"
        dependencies.append({"name": "redis", "status": "disconnected", "details": str(e)})

    return {
        "status": status_overall,
        "service": settings.SERVICE_NAME,
        "version": settings.SERVICE_VERSION,
        "uptime": round(uptime, 2),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "dependencies": dependencies,
    }
