import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@counsel/database';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { auditAction } from '../middleware/audit';
import { NotFoundError, ForbiddenError, ValidationError } from '../lib/errors';

const router = Router();

// ─── POST / ─── Create a matter ─────────────────────────────────────────────
const createMatterSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  type: z.enum(['LEGAL', 'CONSULTING']).default('LEGAL'),
  clientName: z.string().min(1, 'Client name is required'),
});

router.post(
  '/',
  validate('body', createMatterSchema),
  auditAction('Matter', 'MATTER_CREATED'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const matter = await prisma.matter.create({
        data: {
          firmId: req.firmId!,
          name: req.body.name,
          description: req.body.description || null,
          type: req.body.type,
          clientName: req.body.clientName,
          createdById: req.user!.id,
        },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: { documents: true, drafts: true, meetings: true },
          },
        },
      });

      (res as any).locals = { auditDetails: { name: matter.name, clientName: matter.clientName } };
      res.status(201).json(matter);
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET / ─── List matters ─────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const status = req.query.status as string | undefined;
    const type = req.query.type as string | undefined;
    const search = req.query.search as string | undefined;

    const where: any = { firmId: req.firmId };

    if (status) {
      where.status = status;
    }
    if (type) {
      where.type = type;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { clientName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [matters, total] = await Promise.all([
      prisma.matter.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          type: true,
          status: true,
          clientName: true,
          createdAt: true,
          updatedAt: true,
          createdBy: {
            select: { id: true, name: true },
          },
          _count: {
            select: { documents: true, drafts: true, meetings: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.matter.count({ where }),
    ]);

    res.json({
      data: matters,
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

// ─── GET /:id ─── Get matter with documents ─────────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const matter = await prisma.matter.findFirst({
      where: {
        id: req.params.id,
        firmId: req.firmId,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        documents: {
          select: {
            id: true,
            filename: true,
            originalName: true,
            mimeType: true,
            sizeBytes: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        drafts: {
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        meetings: {
          select: {
            id: true,
            title: true,
            status: true,
            meetingDate: true,
          },
          orderBy: { meetingDate: 'desc' },
        },
        _count: {
          select: { documents: true, drafts: true, meetings: true },
        },
      },
    });

    if (!matter) {
      throw new NotFoundError('Matter');
    }

    res.json(matter);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /:id ─── Update a matter ─────────────────────────────────────────
const updateMatterSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  type: z.enum(['LEGAL', 'CONSULTING']).optional(),
  status: z.enum(['ACTIVE', 'CLOSED']).optional(),
  clientName: z.string().min(1).optional(),
});

router.patch(
  '/:id',
  validate('body', updateMatterSchema),
  auditAction('Matter', 'MATTER_UPDATED'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Verify ownership
      const existing = await prisma.matter.findFirst({
        where: { id: req.params.id, firmId: req.firmId },
      });

      if (!existing) {
        throw new NotFoundError('Matter');
      }

      const matter = await prisma.matter.update({
        where: { id: req.params.id },
        data: req.body,
        include: {
          createdBy: {
            select: { id: true, name: true },
          },
        },
      });

      res.json(matter);
    } catch (err) {
      next(err);
    }
  },
);

// ─── DELETE /:id ─── Delete a matter ────────────────────────────────────────
router.delete(
  '/:id',
  auditAction('Matter', 'MATTER_DELETED'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const matter = await prisma.matter.findFirst({
        where: { id: req.params.id, firmId: req.firmId },
      });

      if (!matter) {
        throw new NotFoundError('Matter');
      }

      await prisma.matter.delete({
        where: { id: req.params.id },
      });

      (res as any).locals = { auditDetails: { name: matter.name } };
      res.json({ message: 'Matter deleted', id: req.params.id });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
