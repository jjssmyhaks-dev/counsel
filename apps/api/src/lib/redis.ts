/**
 * Redis client + caching utilities for Counsel API.
 *
 * Gracefully degrades to in-memory Map cache when Redis is unavailable,
 * so the API never crashes if Redis is down — it just loses distributed caching.
 */

import Redis from 'ioredis';

// ─── Configuration ──────────────────────────────────────────────────────────

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const REDIS_KEY_PREFIX = process.env.REDIS_KEY_PREFIX || 'counsel:';
const DEFAULT_TTL = parseInt(process.env.CACHE_DEFAULT_TTL || '300', 10); // 5 min
const LOCK_TTL = parseInt(process.env.CACHE_LOCK_TTL || '30', 10); // 30 sec

// ─── Connection ─────────────────────────────────────────────────────────────

let redis: Redis | null = null;
let redisAvailable = false;

// In-memory fallback cache (LIFO eviction when full)
const memCache = new Map<string, { value: string; expiresAt: number }>();
const MEM_CACHE_MAX = 1000;

function getRedis(): Redis | null {
  if (redis) return redis;

  try {
    redis = new Redis(REDIS_URL, {
      keyPrefix: REDIS_KEY_PREFIX,
      maxRetriesPerRequest: 2,
      retryStrategy(times: number) {
        if (times > 3) return null; // stop retrying
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
      enableReadyCheck: true,
      connectTimeout: 3000,
    });

    redis.on('connect', () => {
      redisAvailable = true;
      console.log('[Redis] Connected');
    });

    redis.on('error', (err: Error) => {
      if (redisAvailable) {
        console.warn('[Redis] Error:', err.message);
      }
      redisAvailable = false;
    });

    redis.on('close', () => {
      redisAvailable = false;
    });

    // Connect in background (non-blocking)
    redis.connect().catch(() => {
      redisAvailable = false;
      console.warn('[Redis] Could not connect — falling back to in-memory cache');
    });

    return redis;
  } catch {
    return null;
  }
}

// ─── Cache API ──────────────────────────────────────────────────────────────

function keyWithPrefix(key: string): string {
  return `${REDIS_KEY_PREFIX}${key}`;
}

/**
 * Get a cached value by key.
 */
export async function cacheGet<T = any>(key: string): Promise<T | null> {
  // Try Redis first
  const client = getRedis();
  if (client && redisAvailable) {
    try {
      const raw = await client.get(key);
      if (raw) return JSON.parse(raw) as T;
      return null;
    } catch {
      // fall through to memory cache
    }
  }

  // In-memory fallback
  const entry = memCache.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    return JSON.parse(entry.value) as T;
  }
  if (entry) memCache.delete(key);
  return null;
}

/**
 * Set a cached value with optional TTL (seconds). Default: 5 minutes.
 */
export async function cacheSet(key: string, value: any, ttl: number = DEFAULT_TTL): Promise<void> {
  const serialized = JSON.stringify(value);

  // Try Redis first
  const client = getRedis();
  if (client && redisAvailable) {
    try {
      await client.setex(key, ttl, serialized);
      return;
    } catch {
      // fall through to memory cache
    }
  }

  // In-memory fallback
  if (memCache.size >= MEM_CACHE_MAX) {
    // Evict oldest entry
    const firstKey = memCache.keys().next().value;
    if (firstKey) memCache.delete(firstKey);
  }
  memCache.set(key, { value: serialized, expiresAt: Date.now() + ttl * 1000 });
}

/**
 * Delete a cached key (or pattern).
 */
export async function cacheDel(key: string): Promise<void> {
  const client = getRedis();
  if (client && redisAvailable) {
    try {
      await client.del(key);
    } catch { /* ignore */ }
  }
  memCache.delete(key);
}

/**
 * Invalidate all keys matching a prefix pattern.
 * Example: cacheInvalidatePattern('documents:firm-123:*')
 */
export async function cacheInvalidatePattern(pattern: string): Promise<void> {
  const client = getRedis();
  if (client && redisAvailable) {
    try {
      // SCAN is safe for production (non-blocking)
      let cursor = '0';
      do {
        const [nextCursor, keys] = await client.scan(cursor, 'MATCH', `${REDIS_KEY_PREFIX}${pattern}`, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          const stripped = keys.map((k: string) => k.replace(REDIS_KEY_PREFIX, ''));
          await client.del(...stripped);
        }
      } while (cursor !== '0');
    } catch { /* ignore */ }
  }

  // Also clear matching in-memory keys
  const glob = pattern.replace('*', '');
  for (const k of memCache.keys()) {
    if (k.includes(glob)) memCache.delete(k);
  }
}

// ─── Distributed Lock ───────────────────────────────────────────────────────

/**
 * Acquire a distributed lock. Returns the lock value if acquired, null otherwise.
 * Useful for preventing duplicate processing of the same job.
 */
export async function acquireLock(resource: string, ttl: number = LOCK_TTL): Promise<string | null> {
  const client = getRedis();
  if (!client || !redisAvailable) return null; // no lock in fallback mode

  const lockKey = `lock:${resource}`;
  const lockValue = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    const acquired = await client.set(lockKey, lockValue, 'EX', ttl, 'NX');
    return acquired ? lockValue : null;
  } catch {
    return null;
  }
}

/**
 * Release a distributed lock (only if we own it).
 */
export async function releaseLock(resource: string, lockValue: string): Promise<void> {
  const client = getRedis();
  if (!client || !redisAvailable) return;

  const lockKey = `lock:${resource}`;
  try {
    // Lua script: only delete if value matches (atomic compare-and-delete)
    await client.eval(
      `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`,
      1,
      lockKey,
      lockValue,
    );
  } catch { /* ignore */ }
}

// ─── Rate Limiting (distributed) ────────────────────────────────────────────

/**
 * Distributed sliding-window rate limiter.
 * Returns { allowed, remaining, resetAt }.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSec: number,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const client = getRedis();
  if (!client || !redisAvailable) {
    // Fallback: always allow (rate limiting still works via express-rate-limit)
    return { allowed: true, remaining: limit, resetAt: Date.now() + windowSec * 1000 };
  }

  const now = Date.now();
  const windowStart = now - windowSec * 1000;
  const rateKey = `ratelimit:${key}`;

  try {
    const pipeline = client.pipeline();
    pipeline.zremrangebyscore(rateKey, 0, windowStart); // remove expired
    pipeline.zadd(rateKey, now.toString(), `${now}-${Math.random()}`);
    pipeline.zcard(rateKey);
    pipeline.expire(rateKey, windowSec);
    const results = await pipeline.exec();

    const count = (results?.[2]?.[1] as number) || 0;
    const resetAt = now + windowSec * 1000;

    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt,
    };
  } catch {
    return { allowed: true, remaining: limit, resetAt: now + windowSec * 1000 };
  }
}

// ─── Health Check ───────────────────────────────────────────────────────────

export async function redisHealthCheck(): Promise<{ status: string; latencyMs?: number }> {
  const client = getRedis();
  if (!client || !redisAvailable) {
    return { status: 'unavailable (using in-memory fallback)' };
  }

  try {
    const start = Date.now();
    await client.ping();
    return { status: 'connected', latencyMs: Date.now() - start };
  } catch {
    return { status: 'error' };
  }
}

// ─── Graceful Shutdown ──────────────────────────────────────────────────────

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit().catch(() => {});
    redis = null;
    redisAvailable = false;
  }
}

export default {
  get: cacheGet,
  set: cacheSet,
  del: cacheDel,
  invalidatePattern: cacheInvalidatePattern,
  acquireLock,
  releaseLock,
  checkRateLimit,
  healthCheck: redisHealthCheck,
  close: closeRedis,
};
