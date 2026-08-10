import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@counsel/database';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { auditAction } from '../middleware/audit';
import { NotFoundError } from '../lib/errors';

const router = Router();

// ─── POST / ─── Create a research brief ─────────────────────────────────────
const createResearchSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  query: z.string().min(1, 'Query is required'),
  matterId: z.string().uuid('Invalid matter ID'),
});

router.post(
  '/',
  validate('body', createResearchSchema),
  auditAction('ResearchBrief', 'RESEARCH_BRIEF_CREATED'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Verify matter belongs to this firm
      const matter = await prisma.matter.findFirst({
        where: { id: req.body.matterId, firmId: req.firmId! },
      });
      if (!matter) {
        throw new NotFoundError('Matter not found');
      }

      const brief = await prisma.researchBrief.create({
        data: {
          firmId: req.firmId!,
          matterId: req.body.matterId,
          title: req.body.title,
          query: req.body.query,
          createdById: req.user!.id,
        },
        include: {
          matter: {
            select: { id: true, name: true },
          },
          createdBy: {
            select: { id: true, name: true },
          },
        },
      });

      (res as any).locals = { auditDetails: { title: brief.title, matterId: brief.matterId } };
      res.status(201).json(brief);
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET / ─── List research briefs ─────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;

    const where: any = { firmId: req.firmId! };

    if (status) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { query: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [briefs, total] = await Promise.all([
      prisma.researchBrief.findMany({
        where,
        select: {
          id: true,
          title: true,
          query: true,
          status: true,
          result: true,
          modelUsed: true,
          createdAt: true,
          completedAt: true,
          matter: {
            select: { id: true, name: true },
          },
          createdBy: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.researchBrief.count({ where }),
    ]);

    res.json({
      data: briefs,
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

// ─── GET /:id ─── Get a single research brief ───────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const brief = await prisma.researchBrief.findFirst({
      where: { id: req.params.id, firmId: req.firmId! },
      include: {
        matter: {
          select: { id: true, name: true },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    if (!brief) {
      throw new NotFoundError('Research brief not found');
    }

    res.json(brief);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /:id ─── Delete a research brief ────────────────────────────────
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const brief = await prisma.researchBrief.findFirst({
      where: { id: req.params.id, firmId: req.firmId! },
    });

    if (!brief) {
      throw new NotFoundError('Research brief not found');
    }

    await prisma.researchBrief.delete({
      where: { id: req.params.id },
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
