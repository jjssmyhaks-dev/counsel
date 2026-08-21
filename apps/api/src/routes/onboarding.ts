import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@counsel/database';

const router = Router();

// ─── Company size → recommended plan mapping ─────────────────────
const PLAN_RECOMMENDATIONS: Record<string, { plan: string; seats: number; price: string; features: string[] }> = {
  SOLO: {
    plan: 'starter',
    seats: 1,
    price: '₹999/mo',
    features: ['5 AI analyses/month', 'Basic RAG', 'Email support', '1 user'],
  },
  SMALL: {
    plan: 'professional',
    seats: 10,
    price: '₹4,999/mo',
    features: ['Unlimited AI analyses', 'Full RAG + MCP', 'CA vertical', 'Up to 10 users', 'Priority support'],
  },
  MEDIUM: {
    plan: 'professional',
    seats: 30,
    price: '₹9,999/mo',
    features: ['Everything in Professional', 'Up to 30 users', 'Custom playbooks', 'API access', 'SSO'],
  },
  LARGE: {
    plan: 'business',
    seats: 100,
    price: '₹24,999/mo',
    features: ['Everything in Business', 'Up to 100 users', 'Custom integrations', 'Dedicated support', 'SLA'],
  },
  ENTERPRISE: {
    plan: 'enterprise',
    seats: 999,
    price: 'Custom',
    features: ['Unlimited users', 'On-premise option', 'Custom ML models', 'Dedicated CSM', 'Custom SLA'],
  },
};

// ─── GET /onboarding/status ─── Get onboarding progress ─────────
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const firmId = (req as any).firmId;
    const progress = await prisma.onboardingProgress.findUnique({ where: { firmId } });
    const firm = await prisma.firm.findUnique({ where: { id: firmId }, select: { companySize: true, firmType: true, onboardingCompleted: true } });

    res.json({
      completed: firm?.onboardingCompleted || false,
      currentStep: progress?.currentStep || 'welcome',
      completedSteps: progress?.completedSteps || [],
      firm: {
        companySize: firm?.companySize || 'SOLO',
        firmType: firm?.firmType || 'LEGAL',
      },
    });
  } catch (err) { next(err); }
});

// ─── POST /onboarding/setup ─── Complete org setup step ──────────
router.post('/setup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const firmId = (req as any).firmId;
    const userId = (req as any).user?.id;
    const { companySize, firmType, firmName } = req.body;

    if (!companySize || !['SOLO', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE'].includes(companySize)) {
      res.status(400).json({ error: 'Invalid companySize. Must be: SOLO, SMALL, MEDIUM, LARGE, ENTERPRISE' });
      return;
    }

    // Update firm with company size and type
    const updateData: any = { companySize };
    if (firmType && ['LEGAL', 'CONSULTING', 'CA', 'HYBRID'].includes(firmType)) {
      updateData.firmType = firmType;
      updateData.firmVertical = firmType === 'HYBRID' ? 'LEGAL' : firmType;
    }
    if (firmName) updateData.name = firmName;

    // Set seat count based on company size
    const seatMap: Record<string, number> = { SOLO: 1, SMALL: 10, MEDIUM: 30, LARGE: 100, ENTERPRISE: 999 };
    updateData.seatCount = seatMap[companySize] || 5;

    // Set AI token budget based on plan
    const budgetMap: Record<string, number> = { SOLO: 50000, SMALL: 200000, MEDIUM: 500000, LARGE: 2000000, ENTERPRISE: 10000000 };
    updateData.aiTokensBudget = budgetMap[companySize] || 100000;

    const firm = await prisma.firm.update({ where: { id: firmId }, data: updateData });

    // Get plan recommendation
    const recommendation = PLAN_RECOMMENDATIONS[companySize] || PLAN_RECOMMENDATIONS.SOLO;

    // Update onboarding progress
    await prisma.onboardingProgress.upsert({
      where: { firmId },
      create: { firmId, currentStep: 'team', completedSteps: JSON.stringify(['welcome', 'setup']) },
      update: { currentStep: 'team', completedSteps: JSON.stringify(['welcome', 'setup']) },
    });

    // Mark first user as SUPER_ADMIN if not already
    if (userId) {
      await prisma.user.updateMany({ where: { id: userId, firmId }, data: { role: 'SUPER_ADMIN' } });
    }

    res.json({
      firm: { id: firm.id, name: firm.name, companySize: firm.companySize, firmType: firm.firmType },
      recommendation,
    });
  } catch (err) { next(err); }
});

// ─── POST /onboarding/invite-team ─── Send team invites ──────────
router.post('/invite-team', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const firmId = (req as any).firmId;
    const userId = (req as any).user?.id;
    const { invites } = req.body as { invites?: { email: string; role?: string }[] };

    if (!invites || !Array.isArray(invites) || invites.length === 0) {
      res.status(400).json({ error: 'invites array with at least one email is required' });
      return;
    }

    // Check seat limit
    const firm = await prisma.firm.findUnique({ where: { id: firmId }, select: { seatCount: true, inviteCount: true } });
    if (!firm) { res.status(404).json({ error: 'Firm not found' }); return; }

    const remainingSeats = (firm.seatCount || 5) - (firm.inviteCount || 0);
    if (invites.length > remainingSeats) {
      res.status(400).json({ error: `Only ${remainingSeats} seats remaining. Upgrade your plan for more.` });
      return;
    }

    // Create invites
    const created = [];
    const skipped = [];
    for (const invite of invites) {
      if (!invite.email || !invite.email.includes('@')) {
        skipped.push({ email: invite.email, reason: 'Invalid email' });
        continue;
      }

      // Check if already a member
      const existing = await prisma.user.findFirst({ where: { firmId, email: invite.email } });
      if (existing) {
        skipped.push({ email: invite.email, reason: 'Already a team member' });
        continue;
      }

      // Check if already invited
      const existingInvite = await prisma.teamInvite.findFirst({
        where: { firmId, email: invite.email, status: 'PENDING' },
      });
      if (existingInvite) {
        skipped.push({ email: invite.email, reason: 'Already invited' });
        continue;
      }

      const token = generateInviteToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const roleMap: Record<string, string> = {
        admin: 'ADMIN', partner: 'PARTNER', associate: 'ASSOCIATE',
        analyst: 'ANALYST', viewer: 'READONLY',
      };

      const inviteRecord = await prisma.teamInvite.create({
        data: {
          firmId,
          email: invite.email,
          role: (roleMap[invite.role || 'associate'] || 'ASSOCIATE') as any,
          invitedById: userId,
          token,
          expiresAt,
        },
      });

      created.push({
        id: inviteRecord.id,
        email: invite.email,
        role: inviteRecord.role,
        token,
        expiresAt,
        inviteLink: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite?token=${token}`,
      });
    }

    // Update invite count
    if (created.length > 0) {
      await prisma.firm.update({
        where: { id: firmId },
        data: { inviteCount: { increment: created.length } },
      });
    }

    // Mark onboarding step complete
    await prisma.onboardingProgress.upsert({
      where: { firmId },
      create: { firmId, currentStep: 'complete', completedSteps: JSON.stringify(['welcome', 'setup', 'team']) },
      update: { currentStep: 'complete', completedSteps: JSON.stringify(['welcome', 'setup', 'team']) },
    });

    // Mark firm onboarding complete
    await prisma.firm.update({ where: { id: firmId }, data: { onboardingCompleted: true } });

    res.json({ created, skipped, totalCreated: created.length, totalSkipped: skipped.length });
  } catch (err) { next(err); }
});

// ─── GET /onboarding/recommendation ─── Get plan recommendation ──
router.get('/recommendation', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const firmId = (req as any).firmId;
    const firm = await prisma.firm.findUnique({ where: { id: firmId }, select: { companySize: true, plan: true, seatCount: true } });

    const size = firm?.companySize || 'SOLO';
    const recommendation = PLAN_RECOMMENDATIONS[size] || PLAN_RECOMMENDATIONS.SOLO;

    // Also count active users for context
    const userCount = await prisma.user.count({ where: { firmId } });

    res.json({
      currentPlan: firm?.plan || 'free',
      companySize: size,
      activeUsers: userCount,
      seatLimit: firm?.seatCount || 5,
      recommendation,
      allPlans: PLAN_RECOMMENDATIONS,
    });
  } catch (err) { next(err); }
});

function generateInviteToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 48; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export default router;
