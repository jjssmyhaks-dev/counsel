/**
 * Plan-based feature gating middleware.
 *
 * Enforces subscription tier restrictions on API endpoints and features.
 * Every query checks the firm's current plan against a feature map.
 *
 * Plans: FREE → STARTER → PROFESSIONAL → BUSINESS → ENTERPRISE
 */
import { Request, Response, NextFunction } from 'express';
import { prisma } from '@counsel/database';

type PlanTier = 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'BUSINESS' | 'ENTERPRISE';

const PLAN_LEVEL: Record<string, number> = {
  FREE: 0,
  starter: 1,
  STARTER: 1,
  professional: 2,
  PROFESSIONAL: 2,
  business: 3,
  BUSINESS: 3,
  enterprise: 4,
  ENTERPRISE: 4,
};

// Feature → minimum plan tier required
const FEATURE_PLAN_MAP: Record<string, PlanTier> = {
  // Documents
  document_upload: 'FREE',
  document_analysis: 'STARTER',
  document_unlimited: 'PROFESSIONAL',

  // Chat AI
  chat_basic: 'FREE',
  chat_unlimited: 'PROFESSIONAL',

  // Playbooks
  playbook_standard: 'FREE',
  playbook_custom: 'STARTER',

  // Clause extraction
  clause_basic: 'FREE',
  clause_full: 'STARTER',

  // AI Drafting
  drafting_basic: 'STARTER',
  drafting_unlimited: 'PROFESSIONAL',

  // CA vertical
  ca_gst: 'STARTER',
  ca_itr: 'PROFESSIONAL',
  ca_audit: 'PROFESSIONAL',
  ca_roc: 'PROFESSIONAL',
  ca_bookkeeping: 'PROFESSIONAL',

  // Knowledge Base
  kb_search: 'PROFESSIONAL',

  // Meetings
  meeting_intelligence: 'PROFESSIONAL',

  // Integrations
  integrations_basic: 'PROFESSIONAL',
  integrations_api: 'BUSINESS',

  // SSO
  sso_saml: 'PROFESSIONAL',

  // API access
  api_access: 'BUSINESS',

  // Custom AI models
  custom_ai: 'BUSINESS',

  // Support
  support_email: 'FREE',
  support_priority: 'PROFESSIONAL',
  support_dedicated: 'BUSINESS',
  support_24_7: 'ENTERPRISE',
};

/**
 * Middleware: requireFeature('feature_name')
 * Checks that the authenticated user's firm has access to the given feature.
 */
export function requireFeature(feature: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const firmId = (req as any).firmId;
      if (!firmId) {
        return next(); // No firm context — let auth middleware handle
      }

      const firm = await prisma.firm.findUnique({
        where: { id: firmId },
        select: { plan: true },
      });

      const firmPlan = (firm?.plan || 'free').toLowerCase();
      const requiredTier = FEATURE_PLAN_MAP[feature];

      if (!requiredTier) {
        return next(); // Unknown feature — allow
      }

      const firmLevel = PLAN_LEVEL[firmPlan] ?? 0;
      const requiredLevel = PLAN_LEVEL[requiredTier] ?? 0;

      if (firmLevel >= requiredLevel) {
        return next(); // Access granted
      }

      res.status(403).json({
        error: 'Feature not available on your current plan',
        feature,
        currentPlan: firmPlan,
        requiredPlan: requiredTier.toLowerCase(),
        upgradeUrl: '/pricing',
      });
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Middleware: requireMinimumPlan('professional')
 * Enforces a minimum plan tier for a route.
 */
export function requireMinimumPlan(minPlan: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const firmId = (req as any).firmId;
      if (!firmId) return next();

      const firm = await prisma.firm.findUnique({
        where: { id: firmId },
        select: { plan: true },
      });

      const firmPlan = (firm?.plan || 'free').toLowerCase();
      const firmLevel = PLAN_LEVEL[firmPlan] ?? 0;
      const requiredLevel = PLAN_LEVEL[minPlan] ?? 0;

      if (firmLevel >= requiredLevel) {
        return next();
      }

      res.status(403).json({
        error: `This feature requires ${minPlan} plan or higher`,
        currentPlan: firmPlan,
        requiredPlan: minPlan,
        upgradeUrl: '/pricing',
      });
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Check if a firm has access to a feature (non-middleware, for use in route handlers).
 */
export async function firmHasFeature(firmId: string, feature: string): Promise<boolean> {
  const firm = await prisma.firm.findUnique({
    where: { id: firmId },
    select: { plan: true },
  });

  const firmPlan = (firm?.plan || 'free').toLowerCase();
  const requiredTier = FEATURE_PLAN_MAP[feature];
  if (!requiredTier) return true;

  const firmLevel = PLAN_LEVEL[firmPlan] ?? 0;
  const requiredLevel = PLAN_LEVEL[requiredTier] ?? 0;
  return firmLevel >= requiredLevel;
}
