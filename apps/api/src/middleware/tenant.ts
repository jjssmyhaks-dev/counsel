import { Request, Response, NextFunction } from 'express';
import { prisma } from '@counsel/database';

/**
 * Tenant context middleware.
 * Runs after auth middleware.
 * Sets the PostgreSQL session-local variable `app.current_firm_id`
 * so that RLS policies scope all subsequent queries in this request
 * to the current user's firm.
 */
export async function tenantMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  if (!req.firmId) {
    _res.status(500).json({ error: 'No firm context — auth middleware must run first' });
    return;
  }

  try {
    await prisma.$executeRawUnsafe(
      `SET LOCAL app.current_firm_id = '${req.firmId}'`,
    );
    next();
  } catch (err) {
    console.error('Failed to set tenant context:', err);
    _res.status(500).json({ error: 'Failed to initialize tenant context' });
  }
}
