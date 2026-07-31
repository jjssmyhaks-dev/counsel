/**
 * Communication Integration Stubs — Slack, Microsoft Teams
 *
 * These are stubs that work when configured and log gracefully when not.
 * Slack uses the shared OAuth module; Teams uses Microsoft Graph via the Microsoft OAuth provider.
 */
import { registerOAuthProvider, getValidToken } from './oauth';
import { prisma } from '@counsel/database';
import { log } from './logger';

// ── Types ───────────────────────────────────────────────────────────────────

export interface CommunicationMessage {
  channel: string;
  text: string;
  blocks?: any[];
  threadTs?: string;
  attachments?: { title: string; text: string; url?: string; color?: string }[];
}

export interface CommunicationResult {
  success: boolean;
  provider: 'slack' | 'teams';
  messageId?: string;
  channel?: string;
  error?: string;
}

export interface CommunicationHealthStatus {
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
    log.warn('[Comm] Audit log write failed', { error: (err as Error).message });
  }
}

// ── Feature Gate Helper ─────────────────────────────────────────────────────

function gateStatus(envVars: string[]): { configured: boolean; missing: string[] } {
  const missing = envVars.filter((v) => !process.env[v] || process.env[v]!.length === 0);
  return { configured: missing.length === 0, missing };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SlackClient — Slack Web API
// ═══════════════════════════════════════════════════════════════════════════════

const SLACK_ENV_VARS = ['SLACK_CLIENT_ID', 'SLACK_CLIENT_SECRET'];

export class SlackClient {
  private configured: boolean;
  private botToken: string | null = null;

  constructor() {
    const { configured } = gateStatus(SLACK_ENV_VARS);
    this.configured = configured;
    // Support bot token fallback for simple integrations
    this.botToken = process.env.SLACK_BOT_TOKEN || null;

    if (this.configured) {
      registerOAuthProvider({
        id: 'slack',
        name: 'Slack',
        authorizeUrl: 'https://slack.com/oauth/v2/authorize',
        tokenUrl: 'https://slack.com/api/oauth.v2.access',
        clientId: process.env.SLACK_CLIENT_ID!,
        clientSecret: process.env.SLACK_CLIENT_SECRET || '',
        redirectUri: `${process.env.API_URL || 'http://localhost:3001'}/api/v1/integrations/slack/callback`,
        scopes: ['chat:write', 'channels:read', 'users:read', 'chat:write.public'],
      });
      log.info('[Comm] SlackClient registered');
    } else if (this.botToken) {
      this.configured = true;
      log.info('[Comm] SlackClient using bot token');
    } else {
      log.info('[Comm] SlackClient not configured (missing env vars)');
    }
  }

  private async getToken(userId: string): Promise<string> {
    if (this.botToken) return this.botToken;
    const tokens = await getValidToken(userId, 'slack');
    if (!tokens) throw { code: 'COMM_NOT_CONNECTED', message: 'Slack not connected', status: 401 };
    return tokens.accessToken;
  }

  async sendMessage(
    userId: string,
    firmId: string,
    message: CommunicationMessage,
  ): Promise<CommunicationResult> {
    if (!this.configured) {
      log.info('[Comm] SlackClient disabled — logging message instead', { channel: message.channel });
      await auditLog(userId, firmId, 'COMM_SLACK_SEND', 'Communication', 'slack', {
        channel: message.channel,
        textLength: message.text.length,
        status: 'disabled',
      });
      return { success: false, provider: 'slack', error: 'Slack not configured' };
    }

    try {
      const token = await this.getToken(userId);

      const body: Record<string, any> = {
        channel: message.channel,
        text: message.text,
      };

      if (message.blocks) body.blocks = message.blocks;
      if (message.threadTs) body.thread_ts = message.threadTs;
      if (message.attachments) body.attachments = message.attachments;

      const res = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!data.ok) {
        throw { code: 'COMM_API_ERROR', message: data.error || 'Slack API error', status: 400 };
      }

      await auditLog(userId, firmId, 'COMM_SLACK_SEND', 'Communication', 'slack', {
        channel: message.channel,
        ts: data.ts,
        status: 'sent',
      });

      return {
        success: true,
        provider: 'slack',
        messageId: data.ts,
        channel: data.channel,
      };
    } catch (err: any) {
      log.error('[Comm] Slack sendMessage failed', { error: err.message });
      await auditLog(userId, firmId, 'COMM_SLACK_SEND', 'Communication', 'slack', {
        channel: message.channel,
        status: 'error',
        error: err.message,
      });
      return { success: false, provider: 'slack', error: err.message };
    }
  }

  async sendNotification(
    userId: string,
    firmId: string,
    channel: string,
    title: string,
    text: string,
    color?: string,
  ): Promise<CommunicationResult> {
    return this.sendMessage(userId, firmId, {
      channel,
      text: `*${title}*\n${text}`,
      attachments: [{
        title,
        text,
        color: color || '#36a64f',
      }],
    });
  }

  healthCheck(): CommunicationHealthStatus {
    return {
      provider: 'slack',
      configured: this.configured,
      connected: this.configured,
      label: 'Slack',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TeamsClient — Microsoft Teams via Microsoft Graph
// ═══════════════════════════════════════════════════════════════════════════════

const TEAMS_ENV_VARS = ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'];

export class TeamsClient {
  private configured: boolean;

  constructor() {
    const { configured } = gateStatus(TEAMS_ENV_VARS);
    this.configured = configured;

    if (this.configured) {
      log.info('[Comm] TeamsClient configured (uses Microsoft OAuth provider)');
    } else {
      log.info('[Comm] TeamsClient not configured (missing env vars)');
    }
  }

  async sendMessage(
    userId: string,
    firmId: string,
    message: CommunicationMessage,
  ): Promise<CommunicationResult> {
    if (!this.configured) {
      log.info('[Comm] TeamsClient disabled — logging message instead', { channel: message.channel });
      await auditLog(userId, firmId, 'COMM_TEAMS_SEND', 'Communication', 'teams', {
        channel: message.channel,
        textLength: message.text.length,
        status: 'disabled',
      });
      return { success: false, provider: 'teams', error: 'Teams not configured' };
    }

    try {
      const tokens = await getValidToken(userId, 'microsoft');
      if (!tokens) throw { code: 'COMM_NOT_CONNECTED', message: 'Microsoft/Teams not connected', status: 401 };

      // Teams channel messages go through Microsoft Graph
      const body: Record<string, any> = {
        body: {
          contentType: 'html',
          content: message.text.replace(/\n/g, '<br>'),
        },
      };

      const res = await fetch(`https://graph.microsoft.com/v1.0/teams/${message.channel}/channels/${message.channel}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw { code: 'COMM_API_ERROR', message: data.error?.message || 'Teams API error', status: res.status };
      }

      await auditLog(userId, firmId, 'COMM_TEAMS_SEND', 'Communication', 'teams', {
        channel: message.channel,
        messageId: data.id,
        status: 'sent',
      });

      return {
        success: true,
        provider: 'teams',
        messageId: data.id,
        channel: message.channel,
      };
    } catch (err: any) {
      log.error('[Comm] Teams sendMessage failed', { error: err.message });
      await auditLog(userId, firmId, 'COMM_TEAMS_SEND', 'Communication', 'teams', {
        channel: message.channel,
        status: 'error',
        error: err.message,
      });
      return { success: false, provider: 'teams', error: err.message };
    }
  }

  async sendNotification(
    userId: string,
    firmId: string,
    channel: string,
    title: string,
    text: string,
  ): Promise<CommunicationResult> {
    const formatted = `**${title}**\n\n${text}`;
    return this.sendMessage(userId, firmId, {
      channel,
      text: formatted,
    });
  }

  healthCheck(): CommunicationHealthStatus {
    return {
      provider: 'teams',
      configured: this.configured,
      connected: this.configured,
      label: 'Microsoft Teams',
    };
  }
}

// ── Singleton Instances ─────────────────────────────────────────────────────

export const slack = new SlackClient();
export const teams = new TeamsClient();

// ── Health Checks ───────────────────────────────────────────────────────────

export function communicationHealthCheck(): CommunicationHealthStatus[] {
  return [
    slack.healthCheck(),
    teams.healthCheck(),
  ];
}