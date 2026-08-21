/**
 * Express middleware for HTTP response caching via Redis.
 *
 * Usage:
 *   router.get('/matters', cacheMiddleware(60), handler);  // cache 60s
 *   router.get('/documents/:id', cacheMiddleware(120), handler);
 *
 * Cache is per-route + per-user + per-firm (tenant-scoped).
 * Invalidated automatically on POST/PUT/DELETE via cacheInvalidator.
 */

import { Request, Response, NextFunction } from 'express';
import { cacheGet, cacheSet, cacheInvalidatePattern } from '../lib/redis';

/**
 * Build a deterministic cache key from request properties.
 * Includes: method, path, query params, firm ID (tenant), user ID.
 */
function buildCacheKey(req: Request, suffix: string = ''): string {
  const firmId = (req as any).firmId || 'anon';
  const userId = (req as any).user?.id || 'anon';
  const sortedQuery = Object.keys(req.query || {})
    .sort()
    .map((k) => `${k}=${req.query[k]}`)
    .join('&');
  const base = `${req.method}:${req.path}:${sortedQuery}:${firmId}:${userId}`;
  return suffix ? `${base}:${suffix}` : base;
}

/**
 * HTTP response caching middleware.
 * @param ttl Time-to-live in seconds (default: 300 = 5 min)
 * @param keySuffix Optional suffix for cache key differentiation
 */
export function cacheMiddleware(ttl: number = 300, keySuffix?: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = buildCacheKey(req, keySuffix);

    try {
      const cached = await cacheGet<{ status: number; body: any }>(cacheKey);
      if (cached) {
        res.status(cached.status).json(cached.body);
        return;
      }
    } catch {
      // Cache miss or error — continue to handler
    }

    // Intercept res.json to capture the response
    const originalJson = res.json.bind(res);
    res.json = function interceptedJson(body: any): Response {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cacheSet(cacheKey, { status: res.statusCode, body }, ttl).catch(() => {});
      }
      return originalJson(body);
    };

    next();
  };
}

/**
 * Middleware to invalidate cache patterns after mutations.
 * Mount on POST/PUT/PATCH/DELETE routes to bust related caches.
 *
 * Usage:
 *   router.post('/matters', cacheInvalidator('matters:*'), handler);
 *   router.delete('/documents/:id', cacheInvalidator('documents:*'), handler);
 */
export function cacheInvalidator(pattern: string) {
  return async (_req: Request, _res: Response, next: NextFunction): Promise<void> => {
    // Run invalidation after response is sent
    _res.on('finish', () => {
      if (_res.statusCode >= 200 && _res.statusCode < 300) {
        cacheInvalidatePattern(pattern).catch(() => {});
      }
    });
    next();
  };
}

/**
 * Pre-configured cache middlewares for common resources.
 */
export const caches = {
  /** Matters list — cache 2 min */
  matters: cacheMiddleware(120, 'matters'),
  /** Documents list — cache 2 min */
  documents: cacheMiddleware(120, 'documents'),
  /** Drafts list — cache 1 min */
  drafts: cacheMiddleware(60, 'drafts'),
  /** Meetings list — cache 1 min */
  meetings: cacheMiddleware(60, 'meetings'),
  /** KB search results — cache 5 min */
  kb: cacheMiddleware(300, 'kb'),
  /** User profile — cache 10 min */
  user: cacheMiddleware(600, 'user'),
  /** Playbook rules — cache 10 min */
  playbook: cacheMiddleware(600, 'playbook'),
  /** Audit logs — cache 30s */
  audit: cacheMiddleware(30, 'audit'),
  /** Billing plans — cache 1 hour */
  plans: cacheMiddleware(3600, 'plans'),
  /** Public stats — cache 5 min */
  publicStats: cacheMiddleware(300, 'public-stats'),
};

/**
 * Pre-configured invalidation middlewares for mutations.
 */
export const invalidators = {
  matters: cacheInvalidator('matters'),
  documents: cacheInvalidator('documents'),
  drafts: cacheInvalidator('drafts'),
  meetings: cacheInvalidator('meetings'),
  kb: cacheInvalidator('kb'),
  user: cacheInvalidator('user'),
  playbook: cacheInvalidator('playbook'),
  all: cacheInvalidator('*'),
};
