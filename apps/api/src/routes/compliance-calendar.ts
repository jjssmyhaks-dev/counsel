import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@counsel/database';

const router = Router();

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, limit } = req.query;
    const where: any = { firmId: req.firmId! };
    if (status) where.status = status;

    const items = await prisma.complianceItem.findMany({
      where,
      include: { client: { select: { name: true } } },
      orderBy: { dueDate: 'asc' },
      take: parseInt((limit as string) || '50'),
    });

    const now = new Date();
    const summary = {
      total: items.length,
      overdue: items.filter(i => new Date(i.dueDate) < now && i.status !== 'COMPLETED').length,
      dueThisWeek: items.filter(i => {
        const d = new Date(i.dueDate); const diff = (d.getTime() - now.getTime()) / 86400000; return diff >= 0 && diff <= 7;
      }).length,
      completed: items.filter(i => i.status === 'COMPLETED').length,
    };

    res.json({ items, summary });
  } catch (e) { next(e); }
});

router.get('/upcoming', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const now = new Date();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const items = await prisma.complianceItem.findMany({
      where: { firmId: req.firmId!, status: { not: 'COMPLETED' }, dueDate: { gte: now, lte: monthEnd } },
      orderBy: { dueDate: 'asc' },
    });
    res.json(items);
  } catch (e) { next(e); }
});

export default router;
