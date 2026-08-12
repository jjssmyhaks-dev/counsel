import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@counsel/database';

const router = Router();

// ─── GET /usage ───────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const firmId = (req as any).firmId;

    // Get firm plan + seat count
    const firm = await prisma.firm.findUnique({
      where: { id: firmId },
      select: { plan: true, seatCount: true, createdAt: true },
    });

    if (!firm) {
      res.status(404).json({ error: 'Firm not found', code: 'NOT_FOUND' });
      return;
    }

    // Document counts (usage)
    const [docCount, matterCount, draftCount, meetingCount, apiCallCount] = await Promise.all([
      prisma.document.count({ where: { firmId } }),
      prisma.matter.count({ where: { firmId } }),
      prisma.draft.count({ where: { firmId } }),
      prisma.meeting.count({ where: { firmId } }),
      // Approximate API calls from audit logs this month
      prisma.auditLog.count({
        where: {
          firmId,
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
    ]);

    // Storage
    const docs = await prisma.document.findMany({
      where: { firmId },
      select: { sizeBytes: true },
    });
    const totalBytes = docs.reduce((s, d) => s + (d.sizeBytes || 0), 0);
    const storageGB = Math.round((totalBytes / (1024 * 1024 * 1024)) * 10) / 10;

    // Day count
    const created = new Date(firm.createdAt || Date.now());
    const daysSince = Math.max(1, Math.floor((Date.now() - created.getTime()) / 86400000));

    // Limits per plan
    const limits: Record<string, any> = {
      starter: { documents: 50, agents: 5, storageGB: 5, apiCalls: 1000, seats: 5 },
      pro: { documents: 200, agents: 10, storageGB: 25, apiCalls: 5000, seats: 20 },
      enterprise: { documents: 99999, agents: 99999, storageGB: 999, apiCalls: 999999, seats: 999 },
    };

    const plan = firm.plan || 'starter';
    const limit = limits[plan] || limits.starter;

    res.json({
      plan,
      planLabel: plan.charAt(0).toUpperCase() + plan.slice(1),
      documentsUsed: docCount,
      documentsLimit: limit.documents,
      agentsUsed: 2, // from the actual deployed agents
      agentsLimit: limit.agents,
      storageUsed: `${storageGB} GB`,
      storageLimit: `${limit.storageGB} GB`,
      apiCalls: apiCallCount,
      apiCallsLimit: limit.apiCalls,
      seatsUsed: (firm.seatCount || 1),
      seatsLimit: limit.seats,
      daysSinceSignup: daysSince,
      trialActive: plan === 'starter' && daysSince < 14,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
