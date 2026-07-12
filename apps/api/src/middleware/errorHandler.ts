import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors';

/**
 * Global error handler middleware.
 * Catches all errors thrown from route handlers and middleware.
 * Uses AppError subclasses for known errors, returns 500 for unknowns.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
    return;
  }

  // Prisma errors
  if ((err as any)?.code === 'P2025') {
    res.status(404).json({
      error: 'Resource not found',
      code: 'NOT_FOUND',
    });
    return;
  }

  if ((err as any)?.code === 'P2002') {
    res.status(409).json({
      error: 'A record with that value already exists',
      code: 'CONFLICT',
    });
    return;
  }

  console.error('Unhandled error:', err);

  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
}
