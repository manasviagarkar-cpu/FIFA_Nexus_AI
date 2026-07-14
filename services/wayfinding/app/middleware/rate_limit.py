"""
FIFA Nexus AI — Wayfinding Rate Limiting Middleware
Implements a Redis-backed token bucket rate limiter.
"""

from __future__ import annotations

import logging
import time
from typing import Optional

from fastapi import HTTPException, status
import redis.asyncio as redis

from app.config import get_settings
from shared.contracts import UserRole, DEFAULT_RATE_LIMITS

logger = logging.getLogger(__name__)


class RedisRateLimiter:
    """Redis-backed sliding window rate limiter."""

    def __init__(self, client: redis.Redis) -> None:
        self._client = client

    async def is_rate_limited(self, identifier: str, role: UserRole) -> tuple[bool, int, int]:
        """
        Check if request is rate limited.

        Returns:
            (is_limited, remaining_requests, retry_after_seconds)
        """
        settings = get_settings()
        limit_config = DEFAULT_RATE_LIMITS.get(role, DEFAULT_RATE_LIMITS[UserRole.FAN])

        max_requests = limit_config.get("max_requests", 100)
        window = limit_config.get("window_seconds", 60)

        key = f"rate_limit:{identifier}"
        now = time.time()
        clear_before = now - window

        try:
            # Multi/exec transaction to add token and count
            pipe = self._client.pipeline()
            # Remove old entries
            pipe.zremrangebyscore(key, 0, clear_before)
            # Add current request
            pipe.zadd(key, {str(now): now})
            # Count elements in window
            pipe.zcard(key)
            # Set expiry for cleanup
            pipe.expire(key, window + 5)

            _, _, count, _ = await pipe.execute()

            remaining = max(0, max_requests - count)

            if count > max_requests:
                # Get the oldest timestamp in window to calculate retry_after
                oldest = await self._client.zrange(key, 0, 0, withscores=True)
                retry_after = 1
                if oldest:
                    retry_after = int(max(1, window - (now - oldest[0][1])))
                return True, 0, retry_after

            return False, remaining, 0

        except Exception as e:
            logger.error("Rate limiter Redis operation failed: %s", e)
            # Fail open to avoid blocking operations, but log alert
            return False, 1, 0
