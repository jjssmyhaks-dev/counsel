import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@counsel/database';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { auditAction } from '../middleware/audit';

const router = Router();

const createFilingSchema = z.object({
  clientId: z.string().uuid(),
  engagementId: z.string().uuid().optional(),
  type: z.enum(['GSTR_1','GSTR_3B','GSTR_9','GSTR_9C','ITR_1','ITR_2','ITR_3','ITR_4','ITR_5','ITR_6','ITR_7','TDS_RETURN','AOC_4','MGT_7','DIR_3_KYC','E_INVOICE','E_WAY_BILL','UDIN']),
  period: z.string(),
  dueDate: z.string(),
  data: z.any().optional(),
  provenance: z.any().optional(),
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query;
    const where: any = { firmId: req.firmId! };
    if (status) where.status = status;
    const filings = await prisma.filing.findMany({
      where,
      include: { client: { select: { name: true } } },
      orderBy: { dueDate: 'asc' },
    });
    res.json(filings);
  } catch (e) { next(e); }
});

router.get('/overdue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filings = await prisma.filing.findMany({
      where: { firmId: req.firmId!, status: { in: ['DRAFT','PARTNER_REVIEW'] }, dueDate: { lt: new Date() } },
      orderBy: { dueDate: 'asc' },
    });
    res.json(filings);
  } catch (e) { next(e); }
});

router.post('/', validate('body', createFilingSchema), auditAction('Filing', 'FILING_CREATED'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filing = await prisma.filing.create({
      data: {
        firmId: req.firmId!, clientId: req.body.clientId, engagementId: req.body.engagementId, type: req.body.type, period: req.body.period, dueDate: new Date(req.body.dueDate),
        status: 'DRAFT', data: req.body.data || {}, provenance: req.body.provenance || { source: 'manual', agent: req.user?.id },
      },
    });
    (res as any).locals = { auditDetails: { type: filing.type, period: filing.period } };
    res.status(201).json({ ...filing, requiresPartnerReview: true });
  } catch (e) { next(e); }
});

router.put('/:id/review', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filing = await prisma.filing.updateMany({
      where: { id: req.params.id, firmId: req.firmId! },
      data: { status: 'PARTNER_REVIEW', partnerReviewBy: req.user?.id, partnerReviewAt: new Date(), notes: 'Marked for partner review' },
    });
    res.json(filing);
  } catch (e) { next(e); }
});

router.put('/:id/file', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { udin, filedBy, dscUsed } = req.body;
    if (!udin) return res.status(400).json({ error: 'UDIN required for filing' });
    const filing = await prisma.filing.updateMany({
      where: { id: req.params.id, firmId: req.firmId!, status: 'PARTNER_REVIEW' },
      data: { status: 'FILED', filedDate: new Date(), filedBy, dscUsed, udin, notes: `Filed with UDIN: ${udin}` },
    });
    (res as any).locals = { auditDetails: { type: 'FILING_SUBMITTED', udin } };
    res.json(filing);
  } catch (e) { next(e); }
});

export default router;
