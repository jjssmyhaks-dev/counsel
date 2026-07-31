/**
 * Google Workspace API proxy — Gmail, Calendar, and Drive via shared OAuth.
 *
 * All routes use the shared OAuth module (getValidToken) for automatic
 * token acquisition and refresh. When GOOGLE_CLIENT_ID is missing,
 * every route returns a descriptive 503.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { getValidToken } from '../lib/oauth';
import { logIntegrationAction } from '../lib/audit-log';

const router = Router();

// ── Feature flag ────────────────────────────────────────────────────────────

function isGoogleAvailable(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID;
}

function requireGoogle(req: Request, res: Response, next: NextFunction): void {
  if (!isGoogleAvailable()) {
    res.status(503).json({
      error: 'Google Workspace integration is not configured',
      code: 'GOOGLE_UNAVAILABLE',
      message: 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable Google integrations.',
    });
    return;
  }
  next();
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getAuth(req: Request): { userId: string; firmId: string } {
  const { userId, firmId } = req as any;
  return { userId, firmId };
}

async function googleFetch(
  userId: string,
  url: string,
  method: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: any }> {
  const tokens = await getValidToken(userId, 'google');
  if (!tokens) {
    throw Object.assign(new Error('Google not connected — no valid token found'), { code: 'GOOGLE_NOT_CONNECTED', status: 401 });
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${tokens.accessToken}`,
    'Content-Type': 'application/json',
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data: any = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { ok: res.ok, status: res.status, data };
}

// ── GET /google/gmail/messages — List Gmail messages ───────────────────────

router.get('/gmail/messages', requireGoogle, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, firmId } = getAuth(req);
    const { q, maxResults, pageToken, labelIds } = req.query;

    const params = new URLSearchParams();
    if (q) params.set('q', q as string);
    if (maxResults) params.set('maxResults', maxResults as string);
    if (pageToken) params.set('pageToken', pageToken as string);
    if (labelIds) params.set('labelIds', labelIds as string);

    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`;
    const result = await googleFetch(userId, url, 'GET');

    if (!result.ok) {
      const statusCode = result.data?.error?.code === 401 ? 401 : 502;
      res.status(statusCode).json({
        error: result.data?.error?.message || `Gmail API error (${result.status})`,
        code: 'GMAIL_API_ERROR',
      });
      return;
    }

    await logIntegrationAction(userId, firmId, 'GMAIL_MESSAGES_LISTED', 'Gmail', '*', {
      provider: 'google',
      query: q as string || undefined,
    });

    res.json({ data: result.data });
  } catch (err: any) {
    if (err.code === 'GOOGLE_NOT_CONNECTED') {
      res.status(401).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});

// ── GET /google/gmail/messages/:id — Get message details ───────────────────

router.get('/gmail/messages/:id', requireGoogle, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, firmId } = getAuth(req);
    const messageId = req.params.id;
    const format = (req.query.format as string) || 'full';

    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=${format}`;
    const result = await googleFetch(userId, url, 'GET');

    if (!result.ok) {
      res.status(502).json({
        error: result.data?.error?.message || `Gmail API error (${result.status})`,
        code: 'GMAIL_API_ERROR',
      });
      return;
    }

    await logIntegrationAction(userId, firmId, 'GMAIL_MESSAGE_READ', 'Gmail', messageId, {
      provider: 'google',
      messageId,
    });

    res.json({ data: result.data });
  } catch (err: any) {
    if (err.code === 'GOOGLE_NOT_CONNECTED') {
      res.status(401).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});

// ── POST /google/gmail/send — Send email via Gmail ─────────────────────────

router.post('/gmail/send', requireGoogle, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, firmId } = getAuth(req);
    const { to, subject, body: emailBody, cc, bcc, attachments } = req.body;

    if (!to || !subject) {
      res.status(400).json({ error: 'Missing required fields: to, subject', code: 'VALIDATION_ERROR' });
      return;
    }

    // Build RFC 2822 message with proper headers
    const message = buildEmailMessage({ to, subject, body: emailBody, cc, bcc, attachments });
    const base64EncodedEmail = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const result = await googleFetch(
      userId,
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      'POST',
      { raw: base64EncodedEmail },
    );

    if (!result.ok) {
      res.status(502).json({
        error: result.data?.error?.message || `Gmail send failed (${result.status})`,
        code: 'GMAIL_SEND_FAILED',
      });
      return;
    }

    await logIntegrationAction(userId, firmId, 'GMAIL_EMAIL_SENT', 'Gmail', result.data?.id || 'unknown', {
      provider: 'google',
      emailSubject: subject,
      recipients: [to],
    });

    res.json({ data: result.data });
  } catch (err: any) {
    if (err.code === 'GOOGLE_NOT_CONNECTED') {
      res.status(401).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});

// ── GET /google/calendar/events — List calendar events ─────────────────────

router.get('/calendar/events', requireGoogle, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, firmId } = getAuth(req);
    const { timeMin, timeMax, maxResults, q, orderBy } = req.query;

    const params = new URLSearchParams();
    params.set('timeMin', (timeMin as string) || new Date().toISOString());
    if (timeMax) params.set('timeMax', timeMax as string);
    if (maxResults) params.set('maxResults', maxResults as string);
    if (q) params.set('q', q as string);
    if (orderBy) params.set('orderBy', orderBy as string);

    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`;
    const result = await googleFetch(userId, url, 'GET');

    if (!result.ok) {
      res.status(502).json({
        error: result.data?.error?.message || `Calendar API error (${result.status})`,
        code: 'CALENDAR_API_ERROR',
      });
      return;
    }

    await logIntegrationAction(userId, firmId, 'CALENDAR_EVENTS_LISTED', 'GoogleCalendar', '*', {
      provider: 'google',
      timeMin: timeMin as string || undefined,
      timeMax: timeMax as string || undefined,
    });

    res.json({ data: result.data });
  } catch (err: any) {
    if (err.code === 'GOOGLE_NOT_CONNECTED') {
      res.status(401).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});

// ── GET /google/drive/files — List Drive files ─────────────────────────────

router.get('/drive/files', requireGoogle, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, firmId } = getAuth(req);
    const { q, pageSize, pageToken, orderBy, fields } = req.query;

    const params = new URLSearchParams();
    if (q) params.set('q', q as string);
    if (pageSize) params.set('pageSize', pageSize as string);
    if (pageToken) params.set('pageToken', pageToken as string);
    if (orderBy) params.set('orderBy', orderBy as string);
    params.set('fields', (fields as string) || 'files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink)');

    const url = `https://www.googleapis.com/drive/v3/files?${params.toString()}`;
    const result = await googleFetch(userId, url, 'GET');

    if (!result.ok) {
      res.status(502).json({
        error: result.data?.error?.message || `Drive API error (${result.status})`,
        code: 'DRIVE_API_ERROR',
      });
      return;
    }

    await logIntegrationAction(userId, firmId, 'DRIVE_FILES_LISTED', 'GoogleDrive', '*', {
      provider: 'google',
      query: q as string || undefined,
    });

    res.json({ data: result.data });
  } catch (err: any) {
    if (err.code === 'GOOGLE_NOT_CONNECTED') {
      res.status(401).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});

// ── RFC 2822 email builder ─────────────────────────────────────────────────

function buildEmailMessage(opts: {
  to: string;
  subject: string;
  body?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: { filename: string; mimeType: string; contentBase64: string }[];
}): string {
  const boundary = `__counsel_boundary_${Date.now()}__`;
  const fields: string[] = [];

  fields.push(`To: ${escapeHeaderAddress(opts.to)}`);
  if (opts.cc) {
    const ccList = Array.isArray(opts.cc) ? opts.cc.join(', ') : opts.cc;
    fields.push(`Cc: ${escapeHeaderAddress(ccList)}`);
  }
  if (opts.bcc) {
    const bccList = Array.isArray(opts.bcc) ? opts.bcc.join(', ') : opts.bcc;
    fields.push(`Bcc: ${escapeHeaderAddress(bccList)}`);
  }
  fields.push(`Subject: ${opts.subject}`);
  fields.push('MIME-Version: 1.0');
  fields.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

  const parts: string[] = [];
  parts.push(`--${boundary}`);
  parts.push('Content-Type: text/html; charset="UTF-8"');
  parts.push('');
  parts.push(opts.body || '');

  if (opts.attachments) {
    for (const att of opts.attachments) {
      parts.push(`--${boundary}`);
      parts.push(`Content-Type: ${att.mimeType}; name="${att.filename}"`);
      parts.push('Content-Transfer-Encoding: base64');
      parts.push(`Content-Disposition: attachment; filename="${att.filename}"`);
      parts.push('');
      parts.push(att.contentBase64);
    }
  }

  parts.push(`--${boundary}--`);
  return [...fields, '', ...parts].join('\r\n');
}

function escapeHeaderAddress(address: string): string {
  // Simple: if address doesn't have a name, just return the email
  return address.trim();
}

export default router;
