import { Request, Response, NextFunction } from 'express';
import { prisma, UserRole } from '@counsel/database';

/**
 * Audit logging middleware factory.
 * Wraps a route handler to automatically log actions to the AuditLog table.
 *
 * Usage:
 *   router.post('/', auditAction('Document', 'DOCUMENT_UPLOAD'), handler);
 *
 * The audit log captures:
 *   - userId, firmId from the authenticated request
 *   - resourceType, action from the factory args
 *   - resourceId from req.params (if available)
 *   - ipAddress from the request
 *   - details from res.locals.auditDetails (if set by the handler)
 *
 * Note: The audit log is written asynchronously (fire-and-forget)
 * so it does not block the response.
 */
export function auditAction(resourceType: string, action: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Hook into the response finish event so we log after the handler
    res.on('finish', () => {
      // Only log successful operations (2xx)
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return;
      }

      const userId = req.user?.id;
      const firmId = req.firmId;

      if (!userId || !firmId) {
        return;
      }

      // Extract resourceId from params
      const resourceId = req.params.id || '';

      const ipAddress =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        null;

      const details = (res as any).locals?.auditDetails || null;

      // Fire and forget — don't block the response
      prisma.auditLog
        .create({
          data: {
            firmId,
            userId,
            action,
            resourceType,
            resourceId,
            details,
            ipAddress,
          },
        })
        .catch((err: unknown) => {
          console.error('Failed to write audit log:', err);
        });
    });

    next();
  };
}

/**
 * Middleware to check if the user has at least one of the required roles.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const userRole = req.user.role as UserRole;
    if (!roles.includes(userRole)) {
      res.status(403).json({
        error: `This action requires one of these roles: ${roles.join(', ')}`,
      });
      return;
    }

    next();
  };
}
