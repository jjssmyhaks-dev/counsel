import { Router, Request, Response, NextFunction } from 'express';
import { prisma, UserRole } from '@counsel/database';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { auditAction, requireRole } from '../middleware/audit';
import { NotFoundError, ForbiddenError } from '../lib/errors';

const router = Router();

// ─── GET / ─── Get firm profile ─────────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const firm = await prisma.firm.findUnique({
      where: { id: req.firmId },
      include: {
        _count: {
          select: {
            users: true,
            matters: true,
            documents: true,
          },
        },
      },
    });

    if (!firm) {
      throw new NotFoundError('Firm');
    }

    res.json(firm);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH / ─── Update firm profile ────────────────────────────────────────
const updateFirmSchema = z.object({
  name: z.string().min(1).optional(),
  plan: z.enum(['free', 'pro', 'enterprise']).optional(),
  seatCount: z.number().int().min(1).optional(),
});

router.patch(
  '/',
  requireRole(UserRole.ADMIN),
  validate('body', updateFirmSchema),
  auditAction('Firm', 'FIRM_UPDATED'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const firm = await prisma.firm.update({
        where: { id: req.firmId },
        data: req.body,
      });
      res.json(firm);
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /users ─── List firm users ─────────────────────────────────────────
router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      where: { firmId: req.firmId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(users);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /users/:id/role ─── Update user role ─────────────────────────────
const updateRoleSchema = z.object({
  role: z.nativeEnum(UserRole),
});

router.patch(
  '/users/:id/role',
  requireRole(UserRole.ADMIN),
  validate('body', updateRoleSchema),
  auditAction('User', 'USER_ROLE_CHANGED'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.params.id },
      });

      if (!user || user.firmId !== req.firmId) {
        throw new NotFoundError('User');
      }

      const updated = await prisma.user.update({
        where: { id: req.params.id },
        data: { role: req.body.role },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          avatarUrl: true,
        },
      });

      (res as any).locals = { auditDetails: { previousRole: user.role, newRole: req.body.role } };
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /playbooks ─── List firm playbooks ────────────────────────────────
router.get('/playbooks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const playbooks = await prisma.playbook.findMany({
      where: { firmId: req.firmId },
      select: {
        id: true,
        name: true,
        description: true,
        rules: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(playbooks);
  } catch (err) {
    next(err);
  }
});

export default router;
