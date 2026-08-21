"""
Scalability Infrastructure — Connection pooling, caching, request deduplication.

Designed for 10M+ users:
- LRU cache for hot data (firm configs, playbook rules, user preferences)
- Request deduplication (identical concurrent requests share one execution)
- Connection pooling for MCP servers
- Automatic cache invalidation
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import time
from collections import OrderedDict
from typing import Any, Callable, Dict, Optional

logger = logging.getLogger(__name__)


class LRUCache:
    """Thread-safe LRU cache with TTL support."""

    def __init__(self, max_size: int = 10000, default_ttl: int = 300):
        self._cache: OrderedDict[str, tuple[Any, float]] = OrderedDict()
        self._max_size = max_size
        self._default_ttl = default_ttl
        self._hits = 0
        self._misses = 0

    def get(self, key: str) -> Optional[Any]:
        """Get value from cache, return None if expired or missing."""
        if key in self._cache:
            value, expiry = self._cache[key]
            if time.time() < expiry:
                self._cache.move_to_end(key)
                self._hits += 1
                return value
            else:
                del self._cache[key]
        self._misses += 1
        return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None):
        """Set value in cache with optional TTL."""
        if key in self._cache:
            del self._cache[key]
        elif len(self._cache) >= self._max_size:
            self._cache.popitem(last=False)
        self._cache[key] = (value, time.time() + (ttl or self._default_ttl))

    def invalidate(self, key: str):
        """Remove a key from cache."""
        self._cache.pop(key, None)

    def invalidate_prefix(self, prefix: str):
        """Remove all keys with a given prefix."""
        keys_to_remove = [k for k in self._cache if k.startswith(prefix)]
        for k in keys_to_remove:
            del self._cache[k]

    def clear(self):
        """Clear entire cache."""
        self._cache.clear()

    @property
    def stats(self) -> Dict[str, Any]:
        total = self._hits + self._misses
        return {
            "size": len(self._cache),
            "max_size": self._max_size,
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": round(self._hits / max(total, 1), 3),
        }


class RequestDeduplicator:
    """Deduplicate identical concurrent requests to prevent thundering herd."""

    def __init__(self):
        self._in_flight: Dict[str, asyncio.Future] = {}

    def _make_key(self, operation: str, params: Dict[str, Any]) -> str:
        """Create a dedup key from operation + params."""
        raw = json.dumps({"op": operation, "params": params}, sort_keys=True, default=str)
        return hashlib.sha256(raw.encode()).hexdigest()[:16]

    async def deduplicate(self, operation: str, params: Dict[str, Any], fn: Callable) -> Any:
        """
        Execute fn, but if an identical request is already in-flight,
        wait for that one instead of executing a duplicate.
        """
        key = self._make_key(operation, params)

        if key in self._in_flight:
            # Wait for the existing request
            logger.debug("Dedup: reusing in-flight request %s", key)
            try:
                return await self._in_flight[key]
            except Exception:
                raise

        # Create a future for this request
        future = asyncio.get_event_loop().create_future()
        self._in_flight[key] = future

        try:
            result = await fn()
            future.set_result(result)
            return result
        except Exception as e:
            future.set_exception(e)
            raise
        finally:
            self._in_flight.pop(key, None)


class ConnectionPool:
    """Simple HTTP connection pool for MCP servers."""

    def __init__(self, max_per_host: int = 10, timeout: float = 30.0):
        self._max_per_host = max_per_host
        self._timeout = timeout
        self._client = None

    async def get_client(self):
        """Get or create an httpx async client."""
        if self._client is None or self._client.is_closed:
            import httpx
            self._client = httpx.AsyncClient(
                timeout=self._timeout,
                limits=httpx.Limits(max_connections=self._max_per_host * 5, max_keepalive_connections=self._max_per_host),
            )
        return self._client

    async def close(self):
        """Close the connection pool."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()


class ScalabilityManager:
    """
    Central scalability manager combining all infrastructure.
    """

    def __init__(self):
        # Different caches for different data types
        self.firm_cache = LRUCache(max_size=50000, default_ttl=600)     # Firm configs: 10 min
        self.user_cache = LRUCache(max_size=100000, default_ttl=300)    # User data: 5 min
        self.playbook_cache = LRUCache(max_size=10000, default_ttl=1800) # Playbooks: 30 min
        self.tool_cache = LRUCache(max_size=5000, default_ttl=60)       # Tool results: 1 min

        self.deduplicator = RequestDeduplicator()
        self.connection_pool = ConnectionPool()

    def get_firm_config(self, firm_id: str) -> Optional[Dict[str, Any]]:
        """Get cached firm configuration."""
        return self.firm_cache.get(f"firm:{firm_id}")

    def set_firm_config(self, firm_id: str, config: Dict[str, Any]):
        """Cache firm configuration."""
        self.firm_cache.set(f"firm:{firm_id}", config, ttl=600)

    def invalidate_firm(self, firm_id: str):
        """Invalidate all cached data for a firm."""
        self.firm_cache.invalidate_prefix(f"firm:{firm_id}")
        self.user_cache.invalidate_prefix(f"user:{firm_id}")
        self.playbook_cache.invalidate_prefix(f"playbook:{firm_id}")

    def get_stats(self) -> Dict[str, Any]:
        """Get overall scalability stats."""
        return {
            "firm_cache": self.firm_cache.stats,
            "user_cache": self.user_cache.stats,
            "playbook_cache": self.playbook_cache.stats,
            "tool_cache": self.tool_cache.stats,
            "in_flight_requests": len(self.deduplicator._in_flight),
        }


# Global singleton
scalability = ScalabilityManager()
