import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@counsel/database';
import { NotFoundError } from '../lib/errors';

const router = Router();

// ─── GET /:id ─── Poll job status ───────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const job = await prisma.job.findFirst({
      where: {
        id: req.params.id,
        firmId: req.firmId,
      },
    });

    if (!job) {
      throw new NotFoundError('Job');
    }

    res.json({
      id: job.id,
      type: job.type,
      status: job.status,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET / ─── List jobs ────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const status = req.query.status as string | undefined;
    const type = req.query.type as string | undefined;

    const where: any = { firmId: req.firmId };
    if (status) where.status = status;
    if (type) where.type = type;

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.job.count({ where }),
    ]);

    res.json({
      data: jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
