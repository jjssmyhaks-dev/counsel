import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../lib/errors';

export type Role = 'ADMIN' | 'PARTNER' | 'SENIOR_ASSOCIATE' | 'ASSOCIATE' | 'PARALEGAL';

const ROLE_HIERARCHY: Record<Role, number> = {
  ADMIN: 5,
  PARTNER: 4,
  SENIOR_ASSOCIATE: 3,
  ASSOCIATE: 2,
  PARALEGAL: 1,
};

/**
 * Require at least the specified role level to access a route.
 * Usage: router.get('/admin/audit', requireRole('ADMIN'), handler)
 */
export function requireRole(minRole: Role) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const userRole = (req as any).user?.role as Role | undefined;
    if (!userRole) {
      return next(new ForbiddenError('Authentication required'));
    }

    const userLevel = ROLE_HIERARCHY[userRole] || 0;
    const requiredLevel = ROLE_HIERARCHY[minRole];

    if (userLevel < requiredLevel) {
      return next(new ForbiddenError(`Role ${minRole} or higher required. You are ${userRole}.`));
    }

    next();
  };
}

/**
 * Require that the user belongs to the same firm as the requested resource.
 * Usage: router.get('/matters/:id', requireSameFirm, handler)
 */
export function requireSameFirm(req: Request, _res: Response, next: NextFunction) {
  const userFirmId = (req as any).user?.firmId;
  const paramFirmId = req.params.firmId || (req as any).firmId;

  if (!userFirmId) {
    return next(new ForbiddenError('Authentication required'));
  }

  if (paramFirmId && userFirmId !== paramFirmId) {
    return next(new ForbiddenError('Access denied to this firm'));
  }

  next();
}

/**
 * Require the user to be an admin of their firm.
 */
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const userRole = (req as any).user?.role as Role | undefined;
  if (!userRole || ROLE_HIERARCHY[userRole] < ROLE_HIERARCHY.ADMIN) {
    return next(new ForbiddenError('Admin access required'));
  }
  next();
}
