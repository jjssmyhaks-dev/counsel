import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@counsel/database';
import { requireRole } from '../middleware/rbac';

const router = Router();

// GET / — list users (admin only)
router.get(
  '/',
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
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
      res.json({ data: users });
    } catch (err) {
      next(err);
    }
  },
);

// GET /me — get current user with firm
router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [user, firm] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { id: true, email: true, name: true, role: true, avatarUrl: true, firmId: true, createdAt: true },
      }),
      prisma.firm.findUnique({
        where: { id: req.firmId },
        select: { id: true, name: true, slug: true, plan: true, seatCount: true },
      }),
    ]);
    res.json({ user, firm });
  } catch (err) {
    next(err);
  }
});

export default router;
