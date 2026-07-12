import { Router, Request, Response, NextFunction } from 'express';
import { prisma, UserRole } from '@counsel/database';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { requireRole } from '../middleware/audit';
import { NotFoundError } from '../lib/errors';

const router = Router();

// All audit routes require ADMIN or PARTNER role
router.use(requireRole(UserRole.ADMIN, UserRole.PARTNER));

// ─── GET /logs ─── Filterable audit log retrieval ───────────────────────────
const auditQuerySchema = z.object({
  resourceType: z.enum([
    'Firm',
    'User',
    'Matter',
    'Document',
    'Analysis',
    'Draft',
    'Meeting',
    'MeetingActionItem',
    'KbQuery',
    'Playbook',
    'Job',
  ]).optional(),
  userId: z.string().uuid().optional(),
  action: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

router.get(
  '/logs',
  validate('query', auditQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { resourceType, userId, action, startDate, endDate, page, limit } =
        req.query as any;

      const where: any = { firmId: req.firmId };

      if (resourceType) where.resourceType = resourceType;
      if (userId) where.userId = userId;
      if (action) where.action = action;

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate as string);
        if (endDate) where.createdAt.lte = new Date(endDate as string);
      }

      const p = parseInt(page as string) || 1;
      const l = parseInt(limit as string) || 20;

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (p - 1) * l,
          take: l,
        }),
        prisma.auditLog.count({ where }),
      ]);

      res.json({
        data: logs,
        pagination: {
          page: p,
          limit: l,
          total,
          totalPages: Math.ceil(total / l),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
