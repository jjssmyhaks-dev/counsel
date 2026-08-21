/**
 * Usage API — returns daily free tier usage stats.
 * GET /api/v1/usage — returns current usage for the firm's plan.
 */
import { Router, Request, Response } from 'express';
import { getUsageInfo, isFreePlan } from '../middleware/free-tier';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const firmId = (req as any).firmId;
  const plan = (req as any).user?.plan || (req as any).firm?.plan;

  if (!firmId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const info = getUsageInfo(firmId, plan);
  res.json(info);
});

export default router;
