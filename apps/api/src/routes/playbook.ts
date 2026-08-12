import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@counsel/database';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { requireRole } from '../middleware/rbac';
import { NotFoundError } from '../lib/errors';

const router = Router();

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseRules(rules: unknown): unknown[] {
  if (typeof rules === 'string') {
    try { return JSON.parse(rules); } catch { return []; }
  }
  return Array.isArray(rules) ? rules : [];
}

async function getFirmPlaybook(firmId: string) {
  return prisma.playbook.findFirst({
    where: { firmId },
    orderBy: { updatedAt: 'desc' },
  });
}

// ─── GET /rules ─── Get the firm's playbook rules array ─────────────────────
// Contract used by the web Playbook Configuration page:
//   GET  /playbook/rules  → PlaybookRule[]
//   PATCH /playbook/rules { rules } → { rules }
router.get('/rules', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const playbook = await getFirmPlaybook(req.firmId!);
    res.json(parseRules(playbook?.rules));
  } catch (err) {
    next(err);
  }
});

const saveRulesSchema = z.object({
  rules: z.array(z.record(z.any())).optional().default([]),
});

router.patch(
  '/rules',
  requireRole('PARTNER'),
  validate('body', saveRulesSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rules = req.body.rules || [];
      const existing = await getFirmPlaybook(req.firmId!);

      if (existing) {
        await prisma.playbook.update({
          where: { id: existing.id },
          data: { rules: rules as any },
        });
      } else {
        await prisma.playbook.create({
          data: {
            firmId: req.firmId!,
            name: 'Firm Playbook',
            description: 'Firm-wide risk rules that drive AI document analysis',
            rules: rules as any,
          },
        });
      }

      res.json({ rules });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET / ─── List firm playbooks ──────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const playbooks = await prisma.playbook.findMany({
      where: { firmId: req.firmId },
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ data: playbooks, total: playbooks.length });
  } catch (err) {
    next(err);
  }
});

// ─── POST / ─── Create a playbook ───────────────────────────────────────────
const createPlaybookSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  rules: z.array(z.record(z.any())).optional().default([]),
});

router.post(
  '/',
  requireRole('PARTNER'),
  validate('body', createPlaybookSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const playbook = await prisma.playbook.create({
        data: {
          firmId: req.firmId!,
          name: req.body.name,
          description: req.body.description,
          rules: req.body.rules || [],
        },
      });
      res.status(201).json(playbook);
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /:id ─── Get a single playbook ─────────────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const playbook = await prisma.playbook.findFirst({
      where: { id: req.params.id, firmId: req.firmId },
    });
    if (!playbook) throw new NotFoundError('Playbook');
    res.json(playbook);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /:id ─── Update a playbook ───────────────────────────────────────
const updatePlaybookSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  rules: z.array(z.record(z.any())).optional(),
});

router.patch(
  '/:id',
  requireRole('PARTNER'),
  validate('body', updatePlaybookSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.playbook.findFirst({
        where: { id: req.params.id, firmId: req.firmId },
      });
      if (!existing) throw new NotFoundError('Playbook');

      const playbook = await prisma.playbook.update({
        where: { id: req.params.id },
        data: req.body,
      });

      res.json(playbook);
    } catch (err) {
      next(err);
    }
  },
);

// ─── DELETE /:id ─── Delete a playbook ──────────────────────────────────────
router.delete(
  '/:id',
  requireRole('PARTNER'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.playbook.findFirst({
        where: { id: req.params.id, firmId: req.firmId },
      });
      if (!existing) throw new NotFoundError('Playbook');

      await prisma.playbook.delete({ where: { id: req.params.id } });
      res.json({ message: 'Playbook deleted', id: req.params.id });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
