import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@counsel/database';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { auditAction } from '../middleware/audit';
import { NotFoundError } from '../lib/errors';

const router = Router();

// ─── POST / ─── Create a meeting ────────────────────────────────────────────
const createMeetingSchema = z.object({
  matterId: z.string().uuid().optional(),
  title: z.string().min(1, 'Title is required'),
  transcript: z.string().optional(),
  meetingDate: z.string().datetime('Invalid date format'),
  source: z.enum(['ZOOM', 'TEAMS', 'MEET', 'UPLOAD']).default('UPLOAD'),
});

router.post(
  '/',
  validate('body', createMeetingSchema),
  auditAction('Meeting', 'MEETING_CREATED'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const meeting = await prisma.meeting.create({
        data: {
          firmId: req.firmId!,
          matterId: req.body.matterId || null,
          title: req.body.title,
          transcript: req.body.transcript || null,
          meetingDate: new Date(req.body.meetingDate),
          source: req.body.source,
          status: req.body.transcript ? 'PENDING' : 'PENDING',
        },
      });

      // If transcript provided, create an async job stub
      if (req.body.transcript) {
        await prisma.job.create({
          data: {
            firmId: req.firmId!,
            type: 'MEETING_PROCESS',
            status: 'PENDING',
            result: { meetingId: meeting.id },
          },
        });
      }

      (res as any).locals = { auditDetails: { title: meeting.title, source: meeting.source } };
      res.status(201).json(meeting);
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET / ─── List meetings ────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const status = req.query.status as string | undefined;
    const matterId = req.query.matterId as string | undefined;

    const where: any = { firmId: req.firmId };

    if (status) {
      where.status = status;
    }
    if (matterId) {
      where.matterId = matterId;
    }

    const [meetings, total] = await Promise.all([
      prisma.meeting.findMany({
        where,
        select: {
          id: true,
          title: true,
          meetingDate: true,
          source: true,
          status: true,
          createdAt: true,
          matter: {
            select: { id: true, name: true },
          },
          _count: {
            select: { actionItems: true, decisions: true },
          },
        },
        orderBy: { meetingDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.meeting.count({ where }),
    ]);

    res.json({
      data: meetings,
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

// ─── GET /:id ─── Get meeting with transcript and items ─────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const meeting = await prisma.meeting.findFirst({
      where: {
        id: req.params.id,
        firmId: req.firmId,
      },
      include: {
        matter: {
          select: { id: true, name: true, clientName: true },
        },
        actionItems: {
          include: {
            owner: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        decisions: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!meeting) {
      throw new NotFoundError('Meeting');
    }

    res.json(meeting);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /:id ─── Update meeting ──────────────────────────────────────────
const updateMeetingSchema = z.object({
  title: z.string().min(1).optional(),
  transcript: z.string().optional().nullable(),
  meetingDate: z.string().datetime().optional(),
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED']).optional(),
});

router.patch(
  '/:id',
  validate('body', updateMeetingSchema),
  auditAction('Meeting', 'MEETING_UPDATED'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.meeting.findFirst({
        where: { id: req.params.id, firmId: req.firmId },
      });

      if (!existing) {
        throw new NotFoundError('Meeting');
      }

      const data: any = { ...req.body };
      if (data.meetingDate) {
        data.meetingDate = new Date(data.meetingDate);
      }

      const meeting = await prisma.meeting.update({
        where: { id: req.params.id },
        data,
      });

      res.json(meeting);
    } catch (err) {
      next(err);
    }
  },
);

// ─── DELETE /:id ─── Delete a meeting ───────────────────────────────────────
router.delete(
  '/:id',
  auditAction('Meeting', 'MEETING_DELETED'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const meeting = await prisma.meeting.findFirst({
        where: { id: req.params.id, firmId: req.firmId },
      });

      if (!meeting) {
        throw new NotFoundError('Meeting');
      }

      await prisma.meeting.delete({
        where: { id: req.params.id },
      });

      (res as any).locals = { auditDetails: { title: meeting.title } };
      res.json({ message: 'Meeting deleted', id: req.params.id });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /:id/action-items ─── Add action item ─────────────────────────────
const createActionItemSchema = z.object({
  text: z.string().min(1, 'Text is required'),
  ownerId: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
});

router.post(
  '/:id/action-items',
  validate('body', createActionItemSchema),
  auditAction('MeetingActionItem', 'ACTION_ITEM_CREATED'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const meeting = await prisma.meeting.findFirst({
        where: { id: req.params.id, firmId: req.firmId },
      });

      if (!meeting) {
        throw new NotFoundError('Meeting');
      }

      const item = await prisma.meetingActionItem.create({
        data: {
          meetingId: req.params.id,
          text: req.body.text,
          ownerId: req.body.ownerId || null,
          dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
        },
        include: {
          owner: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      res.status(201).json(item);
    } catch (err) {
      next(err);
    }
  },
);

// ─── PATCH /:meetingId/action-items/:itemId ─── Update action item ──────────
const updateActionItemSchema = z.object({
  text: z.string().min(1).optional(),
  ownerId: z.string().uuid().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'DONE']).optional(),
});

router.patch(
  '/:meetingId/action-items/:itemId',
  validate('body', updateActionItemSchema),
  auditAction('MeetingActionItem', 'ACTION_ITEM_UPDATED'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const meeting = await prisma.meeting.findFirst({
        where: { id: req.params.meetingId, firmId: req.firmId },
      });

      if (!meeting) {
        throw new NotFoundError('Meeting');
      }

      const data: any = { ...req.body };
      if (data.dueDate !== undefined) {
        data.dueDate = data.dueDate ? new Date(data.dueDate) : null;
      }

      const item = await prisma.meetingActionItem.update({
        where: { id: req.params.itemId },
        data,
        include: {
          owner: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      res.json(item);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
