import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors';
import { log } from '../lib/logger';

/**
 * Global error handler middleware.
 * Catches all errors thrown from route handlers and middleware.
 * Returns structured JSON with request tracing.
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const requestId = (req as any).requestId;

  if (err instanceof AppError) {
    log.warn(`AppError: ${err.message}`, { requestId, code: err.code, statusCode: err.statusCode, path: req.path });
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      requestId,
    });
    return;
  }

  // Prisma errors
  if ((err as any)?.code === 'P2025') {
    res.status(404).json({
      error: 'Resource not found',
      code: 'NOT_FOUND',
      requestId,
    });
    return;
  }

  if ((err as any)?.code === 'P2002') {
    res.status(409).json({
      error: 'A record with that value already exists',
      code: 'CONFLICT',
      requestId,
    });
    return;
  }

  log.error(`Unhandled: ${err.message}`, { requestId, stack: err.stack, path: req.path });

  // Item #3 — Error monitoring hook (Sentry-ready)
  // When SENTRY_DSN is configured, errors are automatically captured.
  // Dynamic import keeps @sentry/node an optional dependency.
  const sentryDsn = process.env.SENTRY_DSN;
  if (sentryDsn) {
    import('@sentry/node')
      .then((Sentry) => {
        Sentry.captureException(err, {
          tags: { requestId, path: req.path },
          extra: { method: req.method, url: req.url },
        });
      })
      .catch(() => { /* Sentry not installed — skip */ });
  }

  // In production, don't leak stack traces
  const isProd = process.env.NODE_ENV === 'production';
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    requestId,
    ...(isProd ? {} : { stack: err.stack?.split('\n').slice(0, 5) }),
  });
}
