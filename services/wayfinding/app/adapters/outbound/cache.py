"""
FIFA Nexus AI — Wayfinding Redis Cache Adapter
Implements CachePort outbound port.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

import redis.asyncio as redis

from app.ports.outbound import CachePort

logger = logging.getLogger(__name__)


class RedisCacheAdapter(CachePort):
    """Redis-backed implementation of the CachePort."""

    def __init__(self, client: redis.Redis) -> None:
        self._client = client

    async def get(self, key: str) -> Optional[Any]:
        """Retrieve and parse JSON value from Redis."""
        try:
            val = await self._client.get(key)
            if val is None:
                return None
            return json.loads(val)
        except Exception as e:
            logger.error("Redis get failed for key %s: %s", key, e)
            return None

    async def set(self, key: str, value: Any, ttl: int = 300) -> None:
        """Serialize and store value in Redis with a TTL."""
        try:
            serialized = json.dumps(value)
            await self._client.set(key, serialized, ex=ttl)
        except Exception as e:
            logger.error("Redis set failed for key %s: %s", key, e)

    async def delete(self, key: str) -> None:
        """Delete key from Redis."""
        try:
            await self._client.delete(key)
        except Exception as e:
            logger.error("Redis delete failed for key %s: %s", key, e)

    async def exists(self, key: str) -> bool:
        """Check if key exists in Redis."""
        try:
            return bool(await self._client.exists(key))
        except Exception as e:
            logger.error("Redis exists failed for key %s: %s", key, e)
            return False
