import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@counsel/database';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { auditAction } from '../middleware/audit';
import { requireRole } from '../middleware/rbac';
import { NotFoundError } from '../lib/errors';

const router = Router();

// ─── GET / ─── List all playbook rules ──────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rules = await prisma.playbookRule.findMany({
      where: { firmId: req.firmId },
      orderBy: [{ category: 'asc' }, { riskLevel: 'desc' }, { ruleName: 'asc' }],
    });
    res.json({ data: rules, total: rules.length });
  } catch (err) {
    next(err);
  }
});

// ─── POST / ─── Create a rule ───────────────────────────────────────────────
const createRuleSchema = z.object({
  ruleName: z.string().min(1, 'Rule name is required'),
  description: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  checkType: z.enum(['REQUIRE', 'RANGE', 'PATTERN', 'PROHIBIT']),
  targetField: z.string().optional(),
  requiredValue: z.string().optional(),
  acceptableRange: z.string().optional(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  remediation: z.string().optional(),
  enabled: z.boolean().default(true),
});

router.post(
  '/',
  requireRole('PARTNER'),
  validate('body', createRuleSchema),
  auditAction('Playbook', 'PLAYBOOK_RULE_CREATED'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rule = await prisma.playbookRule.create({
        data: {
          firmId: req.firmId!,
          ...req.body,
        },
      });
      (res as any).locals = { auditDetails: { ruleName: rule.ruleName, category: rule.category } };
      res.status(201).json(rule);
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /:id ─── Get a single rule ─────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rule = await prisma.playbookRule.findFirst({
      where: { id: req.params.id, firmId: req.firmId },
    });
    if (!rule) throw new NotFoundError('Playbook rule');
    res.json(rule);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /:id ─── Update a rule ───────────────────────────────────────────
const updateRuleSchema = z.object({
  ruleName: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  category: z.string().optional(),
  checkType: z.enum(['REQUIRE', 'RANGE', 'PATTERN', 'PROHIBIT']).optional(),
  targetField: z.string().optional().nullable(),
  requiredValue: z.string().optional().nullable(),
  acceptableRange: z.string().optional().nullable(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  remediation: z.string().optional().nullable(),
  enabled: z.boolean().optional(),
});

router.patch(
  '/:id',
  requireRole('PARTNER'),
  validate('body', updateRuleSchema),
  auditAction('Playbook', 'PLAYBOOK_RULE_UPDATED'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.playbookRule.findFirst({
        where: { id: req.params.id, firmId: req.firmId },
      });
      if (!existing) throw new NotFoundError('Playbook rule');

      const rule = await prisma.playbookRule.update({
        where: { id: req.params.id },
        data: req.body,
      });

      res.json(rule);
    } catch (err) {
      next(err);
    }
  },
);

// ─── DELETE /:id ─── Delete a rule ──────────────────────────────────────────
router.delete(
  '/:id',
  requireRole('PARTNER'),
  auditAction('Playbook', 'PLAYBOOK_RULE_DELETED'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rule = await prisma.playbookRule.findFirst({
        where: { id: req.params.id, firmId: req.firmId },
      });
      if (!rule) throw new NotFoundError('Playbook rule');

      await prisma.playbookRule.delete({ where: { id: req.params.id } });
      (res as any).locals = { auditDetails: { ruleName: rule.ruleName } };
      res.json({ message: 'Playbook rule deleted', id: req.params.id });
    } catch (err) {
      next(err);
    }
  },
);

// ─── POST /toggle/:id ─── Quick enable/disable toggle ───────────────────────
router.post(
  '/toggle/:id',
  requireRole('PARTNER'),
  auditAction('Playbook', 'PLAYBOOK_RULE_TOGGLED'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.playbookRule.findFirst({
        where: { id: req.params.id, firmId: req.firmId },
        select: { id: true, enabled: true, ruleName: true },
      });
      if (!existing) throw new NotFoundError('Playbook rule');

      const rule = await prisma.playbookRule.update({
        where: { id: req.params.id },
        data: { enabled: !existing.enabled },
      });

      (res as any).locals = { auditDetails: { ruleName: rule.ruleName, enabled: rule.enabled } };
      res.json(rule);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
