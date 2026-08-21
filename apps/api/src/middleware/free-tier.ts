/**
 * Free Tier Enforcement Middleware
 *
 * Tracks daily usage per firm and enforces limits for the free plan.
 * When limits are exhausted, returns a clear upgrade prompt instead of
 * processing the request.
 *
 * Free tier limits:
 * - 5 AI chat messages per day
 * - 3 document uploads per day
 * - 10 KB queries per day
 * - 1 draft generation per day
 * - Read-only access to all other features
 */

import { Request, Response, NextFunction } from 'express';

// ─── In-memory usage tracker (resets at midnight UTC) ──────────────────────

interface DailyUsage {
  date: string; // YYYY-MM-DD
  chatMessages: number;
  documentUploads: number;
  kbQueries: number;
  drafts: number;
  apiCalls: number;
}

const FREE_TIER_LIMITS = {
  chatMessages: 5,
  documentUploads: 3,
  kbQueries: 10,
  drafts: 1,
  apiCalls: 100,
} as const;

const PAID_TIER_LIMITS = {
  chatMessages: Infinity,
  documentUploads: Infinity,
  kbQueries: Infinity,
  drafts: Infinity,
  apiCalls: Infinity,
} as const;

// firm_id → DailyUsage
const usageStore: Map<string, DailyUsage> = new Map();

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function getUsage(firmId: string): DailyUsage {
  const current = usageStore.get(firmId);
  const todayStr = today();
  if (!current || current.date !== todayStr) {
    const fresh: DailyUsage = {
      date: todayStr,
      chatMessages: 0,
      documentUploads: 0,
      kbQueries: 0,
      drafts: 0,
      apiCalls: 0,
    };
    usageStore.set(firmId, fresh);
    return fresh;
  }
  return current;
}

function incrementUsage(firmId: string, field: keyof DailyUsage): DailyUsage {
  const usage = getUsage(firmId);
  if (field !== 'date') {
    (usage[field] as number) += 1;
  }
  return usage;
}

// ─── Plan detection ────────────────────────────────────────────────────────

function isFreePlan(plan?: string | null): boolean {
  if (!plan) return true;
  const p = plan.toLowerCase();
  return p === 'free' || p === '' || p === 'none' || p === 'null';
}

function getLimits(plan?: string | null) {
  return isFreePlan(plan) ? FREE_TIER_LIMITS : PAID_TIER_LIMITS;
}

// ─── Middleware factory ─────────────────────────────────────────────────────

/**
 * Check free tier limits before processing a request.
 * Usage: router.post('/chat/message', checkFreeTier('chatMessages'), handler)
 */
export function checkFreeTier(resource: keyof typeof FREE_TIER_LIMITS) {
  return (req: Request, res: Response, next: NextFunction) => {
    const firmId = (req as any).firmId;
    const plan = (req as any).user?.plan || (req as any).firm?.plan;

    if (!firmId) {
      // No auth context — skip (auth middleware should have caught this)
      return next();
    }

    // Paid plans have unlimited access
    if (!isFreePlan(plan)) {
      return next();
    }

    const limits = getLimits(plan);
    const usage = getUsage(firmId);
    const current = usage[resource] as number;
    const limit = limits[resource] as number;

    if (current >= limit) {
      const resourceName: Record<string, string> = {
        chatMessages: 'AI Chat Messages',
        documentUploads: 'Document Uploads',
        kbQueries: 'Knowledge Base Queries',
        drafts: 'Draft Generations',
        apiCalls: 'API Calls',
      };

      res.status(403).json({
        error: 'Free tier limit reached',
        code: 'FREE_TIER_LIMIT_EXCEEDED',
        resource: resource,
        resourceName: resourceName[resource] || resource,
        current,
        limit,
        resetsAt: 'midnight UTC',
        upgrade: {
          message: `You've used all ${limit} free ${resourceName[resource] || resource} for today. Upgrade to get unlimited access.`,
          plans: [
            { name: 'Starter', price: '₹999/mo', features: 'Unlimited chat, 100 docs/mo, 50 drafts/mo' },
            { name: 'Professional', price: '₹4,999/mo', features: 'Unlimited everything, custom playbook, API access' },
            { name: 'Business', price: '₹14,999/mo', features: 'Audit, ROC, team management, SSO' },
          ],
          checkoutUrl: '/dashboard/billing',
        },
      });
      return;
    }

    // Increment usage
    incrementUsage(firmId, resource);

    // Add usage headers to response
    res.set({
      'X-Usage-Current': String(current + 1),
      'X-Usage-Limit': String(limit),
      'X-Usage-Remaining': String(Math.max(0, limit - current - 1)),
      'X-Usage-Resource': resource,
    });

    next();
  };
}

// ─── Usage info endpoint (for frontend to display remaining quota) ──────────

export function getUsageInfo(firmId: string, plan?: string | null) {
  const limits = getLimits(plan);
  const usage = getUsage(firmId);

  return {
    plan: isFreePlan(plan) ? 'free' : plan || 'paid',
    date: today(),
    usage: {
      chatMessages: {
        current: usage.chatMessages,
        limit: limits.chatMessages,
        remaining: Math.max(0, (limits.chatMessages as number) - usage.chatMessages),
        isFree: isFreePlan(plan),
      },
      documentUploads: {
        current: usage.documentUploads,
        limit: limits.documentUploads,
        remaining: Math.max(0, (limits.documentUploads as number) - usage.documentUploads),
        isFree: isFreePlan(plan),
      },
      kbQueries: {
        current: usage.kbQueries,
        limit: limits.kbQueries,
        remaining: Math.max(0, (limits.kbQueries as number) - usage.kbQueries),
        isFree: isFreePlan(plan),
      },
      drafts: {
        current: usage.drafts,
        limit: limits.drafts,
        remaining: Math.max(0, (limits.drafts as number) - usage.drafts),
        isFree: isFreePlan(plan),
      },
    },
    limits: FREE_TIER_LIMITS,
  };
}

export { FREE_TIER_LIMITS, isFreePlan };
