import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@counsel/database';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { auditAction } from '../middleware/audit';
import { NotFoundError } from '../lib/errors';

const router = Router();

// ─── POST / ─── Create a draft ──────────────────────────────────────────────
const createDraftSchema = z.object({
  matterId: z.string().uuid().optional(),
  type: z.enum(['EMAIL', 'MEMO', 'REPORT']),
  title: z.string().min(1, 'Title is required'),
  instructions: z.string().optional(),
  content: z.string().optional(),
});

router.post(
  '/',
  validate('body', createDraftSchema),
  auditAction('Draft', 'DRAFT_CREATED'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const draft = await prisma.draft.create({
        data: {
          firmId: req.firmId!,
          matterId: req.body.matterId || null,
          type: req.body.type,
          title: req.body.title,
          instructions: req.body.instructions || null,
          content: req.body.content || '',
          createdById: req.user!.id,
        },
        include: {
          createdBy: {
            select: { id: true, name: true },
          },
          matter: {
            select: { id: true, name: true },
          },
        },
      });

      (res as any).locals = { auditDetails: { title: draft.title, type: draft.type } };
      res.status(201).json(draft);
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET / ─── List drafts ──────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const status = req.query.status as string | undefined;
    const type = req.query.type as string | undefined;
    const matterId = req.query.matterId as string | undefined;

    const where: any = { firmId: req.firmId };

    if (status) {
      where.status = status;
    }
    if (type) {
      where.type = type;
    }
    if (matterId) {
      where.matterId = matterId;
    }

    const [drafts, total] = await Promise.all([
      prisma.draft.findMany({
        where,
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          instructions: true,
          createdAt: true,
          updatedAt: true,
          createdBy: {
            select: { id: true, name: true },
          },
          matter: {
            select: { id: true, name: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.draft.count({ where }),
    ]);

    res.json({
      data: drafts,
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

// ─── GET /:id ─── Get draft with full content ───────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const draft = await prisma.draft.findFirst({
      where: {
        id: req.params.id,
        firmId: req.firmId,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        matter: {
          select: { id: true, name: true, clientName: true },
        },
      },
    });

    if (!draft) {
      throw new NotFoundError('Draft');
    }

    res.json(draft);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /:id ─── Update draft content ────────────────────────────────────
const updateDraftSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  instructions: z.string().optional().nullable(),
  type: z.enum(['EMAIL', 'MEMO', 'REPORT']).optional(),
  status: z.enum(['DRAFT', 'REVIEWING', 'FINALIZED']).optional(),
});

router.patch(
  '/:id',
  validate('body', updateDraftSchema),
  auditAction('Draft', 'DRAFT_UPDATED'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.draft.findFirst({
        where: { id: req.params.id, firmId: req.firmId },
      });

      if (!existing) {
        throw new NotFoundError('Draft');
      }

      const draft = await prisma.draft.update({
        where: { id: req.params.id },
        data: req.body,
        include: {
          createdBy: {
            select: { id: true, name: true },
          },
          matter: {
            select: { id: true, name: true },
          },
        },
      });

      res.json(draft);
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /:id/finalize ─── Finalize a draft ────────────────────────────────
router.post(
  '/:id/finalize',
  auditAction('Draft', 'DRAFT_FINALIZED'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.draft.findFirst({
        where: { id: req.params.id, firmId: req.firmId },
      });

      if (!existing) {
        throw new NotFoundError('Draft');
      }

      const draft = await prisma.draft.update({
        where: { id: req.params.id },
        data: { status: 'FINALIZED' },
        include: {
          createdBy: {
            select: { id: true, name: true },
          },
        },
      });

      res.json(draft);
    } catch (err) {
      next(err);
    }
  },
);

// ─── DELETE /:id ─── Delete a draft ─────────────────────────────────────────
router.delete(
  '/:id',
  auditAction('Draft', 'DRAFT_DELETED'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const draft = await prisma.draft.findFirst({
        where: { id: req.params.id, firmId: req.firmId },
      });

      if (!draft) {
        throw new NotFoundError('Draft');
      }

      await prisma.draft.delete({
        where: { id: req.params.id },
      });

      (res as any).locals = { auditDetails: { title: draft.title } };
      res.json({ message: 'Draft deleted', id: req.params.id });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
