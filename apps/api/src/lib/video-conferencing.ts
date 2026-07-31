/**
 * Video Conferencing Integration Stubs — Zoom, Microsoft Teams Meetings
 *
 * Feature-gated stubs that work when configured and log gracefully when not.
 * Zoom uses the shared OAuth module; Teams Meetings uses Microsoft Graph.
 */
import { registerOAuthProvider, getValidToken } from './oauth';
import { prisma } from '@counsel/database';
import { log } from './logger';

// ── Types ───────────────────────────────────────────────────────────────────

export interface MeetingCreateParams {
  topic: string;
  agenda?: string;
  startTime: string; // ISO 8601
  durationMinutes: number;
  timezone?: string;
  password?: string;
  settings?: {
    hostVideo?: boolean;
    participantVideo?: boolean;
    joinBeforeHost?: boolean;
    muteUponEntry?: boolean;
    waitingRoom?: boolean;
    autoRecording?: string;
  };
}

export interface Meeting {
  id: string;
  provider: 'zoom' | 'teams';
  topic: string;
  joinUrl: string;
  startUrl?: string;
  startTime: string;
  durationMinutes: number;
  password?: string;
  rawData: Record<string, any>;
}

export interface VConfHealthStatus {
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
    log.warn('[VConf] Audit log write failed', { error: (err as Error).message });
  }
}

// ── Feature Gate Helper ─────────────────────────────────────────────────────

function gateStatus(envVars: string[]): { configured: boolean; missing: string[] } {
  const missing = envVars.filter((v) => !process.env[v] || process.env[v]!.length === 0);
  return { configured: missing.length === 0, missing };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ZoomClient — Zoom API v2
// ═══════════════════════════════════════════════════════════════════════════════

const ZOOM_ENV_VARS = ['ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET'];

export class ZoomClient {
  private configured: boolean;
  private apiBase = 'https://api.zoom.us/v2';

  constructor() {
    const { configured } = gateStatus(ZOOM_ENV_VARS);
    this.configured = configured;

    if (this.configured) {
      registerOAuthProvider({
        id: 'zoom',
        name: 'Zoom',
        authorizeUrl: 'https://zoom.us/oauth/authorize',
        tokenUrl: 'https://zoom.us/oauth/token',
        clientId: process.env.ZOOM_CLIENT_ID!,
        clientSecret: process.env.ZOOM_CLIENT_SECRET || '',
        redirectUri: `${process.env.API_URL || 'http://localhost:3001'}/api/v1/integrations/zoom/callback`,
        scopes: ['meeting:write', 'meeting:read', 'user:read'],
      });
      log.info('[VConf] ZoomClient registered');
    } else {
      log.info('[VConf] ZoomClient not configured (missing env vars)');
    }
  }

  async createMeeting(
    userId: string,
    firmId: string,
    params: MeetingCreateParams,
  ): Promise<Meeting> {
    if (!this.configured) {
      log.info('[VConf] ZoomClient disabled — returning stub', { topic: params.topic });
      await auditLog(userId, firmId, 'VCONF_ZOOM_CREATE', 'VideoConference', 'zoom', {
        topic: params.topic,
        status: 'disabled',
      });
      return {
        id: `zoom-stub-${Date.now()}`,
        provider: 'zoom',
        topic: params.topic,
        joinUrl: 'https://zoom.us/j/stub-meeting',
        startTime: params.startTime,
        durationMinutes: params.durationMinutes,
        rawData: { stub: true, reason: 'Zoom not configured' },
      };
    }

    try {
      const tokens = await getValidToken(userId, 'zoom');
      if (!tokens) throw { code: 'VCONF_NOT_CONNECTED', message: 'Zoom not connected', status: 401 };

      const body: Record<string, any> = {
        topic: params.topic,
        type: 2, // Scheduled meeting
        start_time: params.startTime,
        duration: params.durationMinutes,
        timezone: params.timezone || 'UTC',
        agenda: params.agenda || '',
        settings: {
          host_video: params.settings?.hostVideo ?? true,
          participant_video: params.settings?.participantVideo ?? true,
          join_before_host: params.settings?.joinBeforeHost ?? false,
          mute_upon_entry: params.settings?.muteUponEntry ?? true,
          waiting_room: params.settings?.waitingRoom ?? true,
          auto_recording: params.settings?.autoRecording || 'none',
        },
      };

      if (params.password) body.password = params.password;

      const res = await fetch(`${this.apiBase}/users/me/meetings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw { code: 'VCONF_API_ERROR', message: data.message || 'Zoom API error', status: res.status };
      }

      await auditLog(userId, firmId, 'VCONF_ZOOM_CREATE', 'VideoConference', data.id, {
        topic: params.topic,
        status: 'created',
      });

      return {
        id: String(data.id),
        provider: 'zoom',
        topic: data.topic || params.topic,
        joinUrl: data.join_url || '',
        startUrl: data.start_url,
        startTime: params.startTime,
        durationMinutes: params.durationMinutes,
        password: data.password,
        rawData: data,
      };
    } catch (err: any) {
      log.error('[VConf] Zoom createMeeting failed', { error: err.message });
      throw err;
    }
  }

  async getMeeting(userId: string, firmId: string, meetingId: string): Promise<Meeting> {
    if (!this.configured) {
      throw { code: 'VCONF_NOT_CONFIGURED', message: 'Zoom not configured', status: 503 };
    }

    const tokens = await getValidToken(userId, 'zoom');
    if (!tokens) throw { code: 'VCONF_NOT_CONNECTED', message: 'Zoom not connected', status: 401 };

    const res = await fetch(`${this.apiBase}/meetings/${meetingId}`, {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await res.json();
    if (!res.ok) {
      throw { code: 'VCONF_API_ERROR', message: data.message || 'Zoom API error', status: res.status };
    }

    await auditLog(userId, firmId, 'VCONF_ZOOM_GET', 'VideoConference', meetingId);

    return {
      id: String(data.id),
      provider: 'zoom',
      topic: data.topic || '',
      joinUrl: data.join_url || '',
      startUrl: data.start_url,
      startTime: data.start_time || '',
      durationMinutes: data.duration || 0,
      password: data.password,
      rawData: data,
    };
  }

  healthCheck(): VConfHealthStatus {
    return {
      provider: 'zoom',
      configured: this.configured,
      connected: this.configured,
      label: 'Zoom',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TeamsMeetingClient — Microsoft Teams via Graph API
// ═══════════════════════════════════════════════════════════════════════════════

const TEAMS_MEETING_ENV_VARS = ['MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET'];

export class TeamsMeetingClient {
  private configured: boolean;

  constructor() {
    const { configured } = gateStatus(TEAMS_MEETING_ENV_VARS);
    this.configured = configured;

    if (this.configured) {
      log.info('[VConf] TeamsMeetingClient configured (uses Microsoft OAuth provider)');
    } else {
      log.info('[VConf] TeamsMeetingClient not configured (missing env vars)');
    }
  }

  async createMeeting(
    userId: string,
    firmId: string,
    params: MeetingCreateParams,
  ): Promise<Meeting> {
    if (!this.configured) {
      log.info('[VConf] TeamsMeetingClient disabled — returning stub', { topic: params.topic });
      await auditLog(userId, firmId, 'VCONF_TEAMS_CREATE', 'VideoConference', 'teams', {
        topic: params.topic,
        status: 'disabled',
      });
      return {
        id: `teams-stub-${Date.now()}`,
        provider: 'teams',
        topic: params.topic,
        joinUrl: 'https://teams.microsoft.com/l/meetup-join/stub-meeting',
        startTime: params.startTime,
        durationMinutes: params.durationMinutes,
        rawData: { stub: true, reason: 'Teams not configured' },
      };
    }

    try {
      const tokens = await getValidToken(userId, 'microsoft');
      if (!tokens) throw { code: 'VCONF_NOT_CONNECTED', message: 'Microsoft/Teams not connected', status: 401 };

      const body = {
        subject: params.topic,
        start: {
          dateTime: params.startTime,
          timeZone: params.timezone || 'UTC',
        },
        end: {
          dateTime: new Date(
            new Date(params.startTime).getTime() + params.durationMinutes * 60000,
          ).toISOString(),
          timeZone: params.timezone || 'UTC',
        },
        isOnlineMeeting: true,
        onlineMeetingProvider: 'teamsForBusiness',
      };

      const res = await fetch('https://graph.microsoft.com/v1.0/me/events', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw { code: 'VCONF_API_ERROR', message: data.error?.message || 'Teams API error', status: res.status };
      }

      await auditLog(userId, firmId, 'VCONF_TEAMS_CREATE', 'VideoConference', data.id, {
        topic: params.topic,
        status: 'created',
      });

      return {
        id: data.id,
        provider: 'teams',
        topic: data.subject || params.topic,
        joinUrl: data.onlineMeeting?.joinUrl || '',
        startTime: params.startTime,
        durationMinutes: params.durationMinutes,
        rawData: data,
      };
    } catch (err: any) {
      log.error('[VConf] TeamsMeetingClient createMeeting failed', { error: err.message });
      throw err;
    }
  }

  healthCheck(): VConfHealthStatus {
    return {
      provider: 'teams-meetings',
      configured: this.configured,
      connected: this.configured,
      label: 'Microsoft Teams Meetings',
    };
  }
}

// ── Singleton Instances ─────────────────────────────────────────────────────

export const zoom = new ZoomClient();
export const teamsMeetings = new TeamsMeetingClient();

// ── Health Checks ───────────────────────────────────────────────────────────

export function videoConferencingHealthCheck(): VConfHealthStatus[] {
  return [
    zoom.healthCheck(),
    teamsMeetings.healthCheck(),
  ];
}