import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@counsel/database';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { auditAction } from '../middleware/audit';

const router = Router();

const createEngagementSchema = z.object({
  clientId: z.string().uuid(),
  type: z.enum(['GST_FILING','INCOME_TAX_FILING','ROC_FILING','TDS_FILING','AUDIT','BOOKKEEPING','RECONCILIATION','ADVISORY']),
  name: z.string().min(1),
  description: z.string().optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
  fee: z.number().optional(),
  signingCAId: z.string().uuid().optional(),
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const engagements = await prisma.engagement.findMany({
      where: { firmId: req.firmId! },
      include: { client: { select: { name: true } } },
      orderBy: { startDate: 'desc' },
    });
    res.json(engagements);
  } catch (e) { next(e); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eng = await prisma.engagement.findFirst({
      where: { id: req.params.id, firmId: req.firmId! },
      include: { client: true, filings: true },
    });
    if (!eng) return res.status(404).json({ error: 'Not found' });
    res.json(eng);
  } catch (e) { next(e); }
});

router.post('/', validate('body', createEngagementSchema), auditAction('Engagement', 'ENGAGEMENT_CREATED'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eng = await prisma.engagement.create({
      data: { ...req.body, firmId: req.firmId!, startDate: new Date(req.body.startDate), endDate: req.body.endDate ? new Date(req.body.endDate) : null },
    });
    (res as any).locals = { auditDetails: { name: eng.name, type: eng.type } };
    res.status(201).json(eng);
  } catch (e) { next(e); }
});

router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const eng = await prisma.engagement.updateMany({
      where: { id: req.params.id, firmId: req.firmId! },
      data: req.body,
    });
    res.json(eng);
  } catch (e) { next(e); }
});

export default router;
