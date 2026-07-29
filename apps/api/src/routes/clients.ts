import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@counsel/database';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import { auditAction } from '../middleware/audit';

const router = Router();

const createClientSchema = z.object({
  name: z.string().min(1),
  pan: z.string().optional(),
  gstin: z.string().optional(),
  tan: z.string().optional(),
  cin: z.string().optional(),
  contactName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clients = await prisma.client.findMany({
      where: { firmId: req.firmId! },
      include: { _count: { select: { engagements: true, filings: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(clients);
  } catch (e) { next(e); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = await prisma.client.findFirst({
      where: { id: req.params.id, firmId: req.firmId! },
      include: { engagements: true, filings: true, reconciliations: true },
    });
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json(client);
  } catch (e) { next(e); }
});

router.post('/', validate('body', createClientSchema), auditAction('Client', 'CLIENT_CREATED'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = await prisma.client.create({
      data: { ...req.body, firmId: req.firmId! },
    });
    (res as any).locals = { auditDetails: { name: client.name } };
    res.status(201).json(client);
  } catch (e) { next(e); }
});

router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = await prisma.client.updateMany({
      where: { id: req.params.id, firmId: req.firmId! },
      data: req.body,
    });
    res.json(client);
  } catch (e) { next(e); }
});

export default router;
