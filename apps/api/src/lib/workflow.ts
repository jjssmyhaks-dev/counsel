/**
 * Workflow Automation Integration Stubs — Zapier, Make, n8n
 *
 * These are stubs with feature flags. Each triggers webhooks/webhook-based
 * workflows in the respective platforms. When not configured, they log
 * gracefully and return structured error responses.
 */
import { prisma } from '@counsel/database';
import { log } from './logger';

// ── Types ───────────────────────────────────────────────────────────────────

export interface WebhookPayload {
  event: string;
  data: Record<string, any>;
  timestamp?: string;
}

export interface WebhookResult {
  success: boolean;
  provider: 'zapier' | 'make' | 'n8n';
  statusCode?: number;
  message?: string;
  responseData?: any;
}

export interface WorkflowHealthStatus {
  provider: string;
  configured: boolean;
  connected: boolean;
  label: string;
}

// ── Audit Logger ────────────────────────────────────────────────────────────

async function auditLog(
  userId: string,
  firmId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  details?: Record<string, any>,
) {
  try {
    await prisma.auditLog.create({
      data: {
        firmId,
        userId,
        action,
        resourceType,
        resourceId,
        details: (details || null) as any,
        ipAddress: null,
      },
    });
  } catch (err) {
    log.warn('[Workflow] Audit log write failed', { error: (err as Error).message });
  }
}

// ── Feature Gate Helper ─────────────────────────────────────────────────────

function gateStatus(envVars: string[]): { configured: boolean; missing: string[] } {
  const missing = envVars.filter((v) => !process.env[v] || process.env[v]!.length === 0);
  return { configured: missing.length === 0, missing };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ZapierClient — Zapier Webhooks
// ═══════════════════════════════════════════════════════════════════════════════

const ZAPIER_ENV_VARS = ['ZAPIER_WEBHOOK_URL'];

export class ZapierClient {
  private configured: boolean;
  private webhookUrl: string;

  constructor() {
    const { configured } = gateStatus(ZAPIER_ENV_VARS);
    this.configured = configured;
    this.webhookUrl = process.env.ZAPIER_WEBHOOK_URL || '';

    if (this.configured) {
      log.info('[Workflow] ZapierClient configured');
    } else {
      log.info('[Workflow] ZapierClient not configured (missing ZAPIER_WEBHOOK_URL)');
    }
  }

  async triggerWebhook(
    userId: string,
    firmId: string,
    payload: WebhookPayload,
  ): Promise<WebhookResult> {
    if (!this.configured) {
      log.info('[Workflow] ZapierClient disabled — logging event instead', { event: payload.event });
      await auditLog(userId, firmId, 'WF_ZAPIER_TRIGGER', 'Workflow', 'zapier', {
        event: payload.event,
        status: 'disabled',
      });
      return {
        success: false,
        provider: 'zapier',
        message: 'Zapier not configured. Set ZAPIER_WEBHOOK_URL.',
      };
    }

    try {
      const res = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          timestamp: payload.timestamp || new Date().toISOString(),
          metadata: { userId, firmId, source: 'counsel' },
        }),
      });

      const responseData = await res.json().catch(() => null);

      await auditLog(userId, firmId, 'WF_ZAPIER_TRIGGER', 'Workflow', 'zapier', {
        event: payload.event,
        status: res.ok ? 'sent' : 'error',
        statusCode: res.status,
      });

      return {
        success: res.ok,
        provider: 'zapier',
        statusCode: res.status,
        message: res.ok ? 'Webhook triggered successfully' : `Zapier returned ${res.status}`,
        responseData,
      };
    } catch (err: any) {
      log.error('[Workflow] Zapier trigger failed', { error: err.message });
      await auditLog(userId, firmId, 'WF_ZAPIER_TRIGGER', 'Workflow', 'zapier', {
        event: payload.event,
        status: 'error',
        error: err.message,
      });
      return { success: false, provider: 'zapier', message: err.message };
    }
  }

  healthCheck(): WorkflowHealthStatus {
    return {
      provider: 'zapier',
      configured: this.configured,
      connected: this.configured,
      label: 'Zapier',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MakeClient — Make (formerly Integromat) Webhooks
// ═══════════════════════════════════════════════════════════════════════════════

const MAKE_ENV_VARS = ['MAKE_WEBHOOK_URL'];

export class MakeClient {
  private configured: boolean;
  private webhookUrl: string;

  constructor() {
    const { configured } = gateStatus(MAKE_ENV_VARS);
    this.configured = configured;
    this.webhookUrl = process.env.MAKE_WEBHOOK_URL || '';

    if (this.configured) {
      log.info('[Workflow] MakeClient configured');
    } else {
      log.info('[Workflow] MakeClient not configured (missing MAKE_WEBHOOK_URL)');
    }
  }

  async triggerScenario(
    userId: string,
    firmId: string,
    payload: WebhookPayload,
  ): Promise<WebhookResult> {
    if (!this.configured) {
      log.info('[Workflow] MakeClient disabled — logging event instead', { event: payload.event });
      await auditLog(userId, firmId, 'WF_MAKE_TRIGGER', 'Workflow', 'make', {
        event: payload.event,
        status: 'disabled',
      });
      return {
        success: false,
        provider: 'make',
        message: 'Make not configured. Set MAKE_WEBHOOK_URL.',
      };
    }

    try {
      const res = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          timestamp: payload.timestamp || new Date().toISOString(),
          metadata: { userId, firmId, source: 'counsel' },
        }),
      });

      const responseText = await res.text();
      let responseData: any = responseText;
      try { responseData = JSON.parse(responseText); } catch { /* text response */ }

      await auditLog(userId, firmId, 'WF_MAKE_TRIGGER', 'Workflow', 'make', {
        event: payload.event,
        status: res.ok ? 'sent' : 'error',
        statusCode: res.status,
      });

      return {
        success: res.ok,
        provider: 'make',
        statusCode: res.status,
        message: res.ok ? 'Scenario triggered successfully' : `Make returned ${res.status}`,
        responseData,
      };
    } catch (err: any) {
      log.error('[Workflow] Make trigger failed', { error: err.message });
      await auditLog(userId, firmId, 'WF_MAKE_TRIGGER', 'Workflow', 'make', {
        event: payload.event,
        status: 'error',
        error: err.message,
      });
      return { success: false, provider: 'make', message: err.message };
    }
  }

  healthCheck(): WorkflowHealthStatus {
    return {
      provider: 'make',
      configured: this.configured,
      connected: this.configured,
      label: 'Make (Integromat)',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// N8nClient — n8n Webhooks
// ═══════════════════════════════════════════════════════════════════════════════

const N8N_ENV_VARS = ['N8N_WEBHOOK_URL'];

export class N8nClient {
  private configured: boolean;
  private webhookUrl: string;
  private apiKey: string | null;

  constructor() {
    const { configured } = gateStatus(N8N_ENV_VARS);
    this.configured = configured;
    this.webhookUrl = process.env.N8N_WEBHOOK_URL || '';
    this.apiKey = process.env.N8N_API_KEY || null;

    if (this.configured) {
      log.info('[Workflow] N8nClient configured');
    } else {
      log.info('[Workflow] N8nClient not configured (missing N8N_WEBHOOK_URL)');
    }
  }

  async triggerWorkflow(
    userId: string,
    firmId: string,
    payload: WebhookPayload,
  ): Promise<WebhookResult> {
    if (!this.configured) {
      log.info('[Workflow] N8nClient disabled — logging event instead', { event: payload.event });
      await auditLog(userId, firmId, 'WF_N8N_TRIGGER', 'Workflow', 'n8n', {
        event: payload.event,
        status: 'disabled',
      });
      return {
        success: false,
        provider: 'n8n',
        message: 'n8n not configured. Set N8N_WEBHOOK_URL.',
      };
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.apiKey) {
        headers['X-N8N-API-KEY'] = this.apiKey;
      }

      const res = await fetch(this.webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...payload,
          timestamp: payload.timestamp || new Date().toISOString(),
          metadata: { userId, firmId, source: 'counsel' },
        }),
      });

      const responseData = await res.json().catch(() => null);

      await auditLog(userId, firmId, 'WF_N8N_TRIGGER', 'Workflow', 'n8n', {
        event: payload.event,
        status: res.ok ? 'sent' : 'error',
        statusCode: res.status,
      });

      return {
        success: res.ok,
        provider: 'n8n',
        statusCode: res.status,
        message: res.ok ? 'Workflow triggered successfully' : `n8n returned ${res.status}`,
        responseData,
      };
    } catch (err: any) {
      log.error('[Workflow] N8n trigger failed', { error: err.message });
      await auditLog(userId, firmId, 'WF_N8N_TRIGGER', 'Workflow', 'n8n', {
        event: payload.event,
        status: 'error',
        error: err.message,
      });
      return { success: false, provider: 'n8n', message: err.message };
    }
  }

  healthCheck(): WorkflowHealthStatus {
    return {
      provider: 'n8n',
      configured: this.configured,
      connected: this.configured,
      label: 'n8n',
    };
  }
}

// ── Singleton Instances ─────────────────────────────────────────────────────

export const zapier = new ZapierClient();
export const make = new MakeClient();
export const n8n = new N8nClient();

// ── Health Checks ───────────────────────────────────────────────────────────

export function workflowHealthCheck(): WorkflowHealthStatus[] {
  return [
    zapier.healthCheck(),
    make.healthCheck(),
    n8n.healthCheck(),
  ];
}