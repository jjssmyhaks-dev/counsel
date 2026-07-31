/**
 * Medium+Low Priority Integration Routes
 *
 * ── CRM:  GET /api/v1/crm/contacts
 * ── Accounting: GET /api/v1/accounting/invoices
 * ── DMS:  GET /api/v1/dms/documents
 *
 * All routes use auth middleware, audit logging, and feature flags.
 * Graceful degradation when providers are not configured.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@counsel/database';
import { log } from '../lib/logger';
// ── CRM ─────────────────────────────────────────────────────────────────────
import { crmSearch, crmHealthCheck, salesforce, clio, hubspot } from '../lib/crm';

// ── Accounting ──────────────────────────────────────────────────────────────
import { getInvoicesUnified, accountingHealthCheck } from '../lib/accounting';

// ── DMS ─────────────────────────────────────────────────────────────────────
import { dmsSearch, dmsHealthCheck } from '../lib/dms';

// ── Communication ───────────────────────────────────────────────────────────
import { slack, teams, communicationHealthCheck } from '../lib/communication';

// ── Video Conferencing ──────────────────────────────────────────────────────
import { zoom, teamsMeetings, videoConferencingHealthCheck } from '../lib/video-conferencing';

// ── Workflow Automation ─────────────────────────────────────────────────────
import { zapier, make, n8n, workflowHealthCheck } from '../lib/workflow';

const router = Router();

// ── Helper: extract user/firm context ───────────────────────────────────────

function getUserContext(req: Request): { userId: string; firmId: string } {
  const userId = (req as any).userId || req.user?.id;
  const firmId = (req as any).firmId || req.user?.firmId;
  if (!userId || !firmId) {
    throw { code: 'UNAUTHORIZED', message: 'Authentication required', status: 401 };
  }
  return { userId, firmId };
}

// ── Helper: structured error response ───────────────────────────────────────

function errorResponse(res: Response, err: any) {
  if (err.code && err.status) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message },
    });
    return;
  }
  log.error('[MediumIntegrations] Unhandled error', { error: err.message });
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRM Routes
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/crm/contacts
 * Unified CRM contact search across all connected providers.
 * Query params: ?query=&email=&phone=&limit=20&offset=0
 */
router.get('/crm/contacts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, firmId } = getUserContext(req);
    const { query, email, phone, limit, offset } = req.query;

    const result = await crmSearch(userId, firmId, {
      query: query as string | undefined,
      email: email as string | undefined,
      phone: phone as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : 20,
      offset: offset ? parseInt(offset as string, 10) : 0,
    });

    res.json({
      data: result.contacts,
      total: result.total,
      providers: result.providers,
    });
  } catch (err) {
    errorResponse(res, err);
  }
});

/**
 * GET /api/v1/crm/contacts/:id
 * Get a specific CRM contact by ID.
 * Query params: ?provider=salesforce|clio|hubspot
 */
router.get('/crm/contacts/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, firmId } = getUserContext(req);
    const provider = (req.query.provider as string) || 'salesforce';
    const contactId = req.params.id;

    let contact;
    switch (provider) {
      case 'salesforce':
        contact = await salesforce.getContact(userId, firmId, contactId);
        break;
      case 'clio':
        contact = await clio.getContact(userId, firmId, contactId);
        break;
      case 'hubspot':
        contact = await hubspot.getContact(userId, firmId, contactId);
        break;
      default:
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: `Unknown provider: ${provider}` } });
        return;
    }

    res.json({ data: contact });
  } catch (err) {
    errorResponse(res, err);
  }
});

/**
 * GET /api/v1/crm/opportunities
 * Get opportunities from all connected CRMs.
 * Query params: ?limit=20&offset=0
 */
router.get('/crm/opportunities', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, firmId } = getUserContext(req);
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const allOpportunities: any[] = [];
    const providers: string[] = [];
    const errors: string[] = [];

    const clients = [
      { name: 'salesforce', fetch: () => salesforce.getOpportunities(userId, firmId, limit, offset) },
      { name: 'clio', fetch: () => clio.getOpportunities(userId, firmId, limit, offset) },
      { name: 'hubspot', fetch: () => hubspot.getOpportunities(userId, firmId, limit, offset) },
    ];

    for (const client of clients) {
      try {
        const opps = await client.fetch();
        if (opps.length > 0) {
          providers.push(client.name);
          allOpportunities.push(...opps);
        }
      } catch (err: any) {
        if (err.code !== 'CRM_NOT_CONNECTED') {
          errors.push(`${client.name}: ${err.message}`);
        }
      }
    }

    res.json({
      data: allOpportunities,
      total: allOpportunities.length,
      providers,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    errorResponse(res, err);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Accounting Routes
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/accounting/invoices
 * Unified invoices from all connected accounting providers.
 * Query params: ?limit=20&offset=0
 */
router.get('/accounting/invoices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, firmId } = getUserContext(req);
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const result = await getInvoicesUnified(userId, firmId, limit, offset);

    res.json({
      data: result.invoices,
      total: result.invoices.length,
      providers: result.providers,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (err) {
    errorResponse(res, err);
  }
});

/**
 * GET /api/v1/accounting/accounts
 * Get chart of accounts from all connected accounting providers.
 */
router.get('/accounting/accounts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, firmId } = getUserContext(req);
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    // Dynamic import to avoid circular issues
    const { quickbooks, xero, zoho } = await import('../lib/accounting');

    const allAccounts: any[] = [];
    const providers: string[] = [];
    const errors: string[] = [];

    const clients = [
      { name: 'quickbooks', fetch: () => quickbooks.getAccounts(userId, firmId, limit, offset) },
      { name: 'xero', fetch: () => xero.getAccounts(userId, firmId, limit, offset) },
      { name: 'zoho', fetch: () => zoho.getAccounts(userId, firmId, limit, offset) },
    ];

    for (const client of clients) {
      try {
        const accounts = await client.fetch();
        if (accounts.length > 0) {
          providers.push(client.name);
          allAccounts.push(...accounts);
        }
      } catch (err: any) {
        if (err.code !== 'ACCT_NOT_CONNECTED' && err.code !== 'ACCT_NOT_CONFIGURED') {
          errors.push(`${client.name}: ${err.message}`);
        }
      }
    }

    res.json({
      data: allAccounts,
      total: allAccounts.length,
      providers,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    errorResponse(res, err);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DMS Routes
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/dms/documents
 * Unified DMS document search across all connected providers.
 * Query params: ?query=&folder=&workspace=&author=&limit=20&offset=0
 */
router.get('/dms/documents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, firmId } = getUserContext(req);
    const { query, folder, workspace, author, limit, offset } = req.query;

    const result = await dmsSearch(userId, firmId, {
      query: query as string | undefined,
      folder: folder as string | undefined,
      workspace: workspace as string | undefined,
      author: author as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : 20,
      offset: offset ? parseInt(offset as string, 10) : 0,
    });

    res.json({
      data: result.documents,
      total: result.total,
      providers: result.providers,
    });
  } catch (err) {
    errorResponse(res, err);
  }
});

/**
 * GET /api/v1/dms/documents/:id
 * Get a specific DMS document by ID.
 * Query params: ?provider=imanage|netdocuments
 */
router.get('/dms/documents/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, firmId } = getUserContext(req);
    const provider = (req.query.provider as string) || 'imanage';
    const documentId = req.params.id;

    const { imanage, netdocuments } = await import('../lib/dms');

    let doc;
    switch (provider) {
      case 'imanage':
        doc = await imanage.getDocument(userId, firmId, documentId);
        break;
      case 'netdocuments':
        doc = await netdocuments.getDocument(userId, firmId, documentId);
        break;
      default:
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: `Unknown provider: ${provider}` } });
        return;
    }

    res.json({ data: doc });
  } catch (err) {
    errorResponse(res, err);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Communication Routes (stubs)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/communication/send
 * Send a message via Slack or Teams.
 * Body: { provider: 'slack'|'teams', channel: string, text: string, ... }
 */
router.post('/communication/send', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, firmId } = getUserContext(req);
    const { provider, channel, text, blocks, threadTs, attachments } = req.body;

    if (!provider || !channel || !text) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'provider, channel, and text are required' },
      });
      return;
    }

    let result;
    switch (provider) {
      case 'slack':
        result = await slack.sendMessage(userId, firmId, { channel, text, blocks, threadTs, attachments });
        break;
      case 'teams':
        result = await teams.sendMessage(userId, firmId, { channel, text, blocks, threadTs, attachments });
        break;
      default:
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: `Unknown provider: ${provider}` } });
        return;
    }

    res.status(result.success ? 200 : 503).json(result);
  } catch (err) {
    errorResponse(res, err);
  }
});

/**
 * POST /api/v1/communication/notify
 * Send a notification with title/text formatting.
 * Body: { provider: 'slack'|'teams', channel: string, title: string, text: string, color?: string }
 */
router.post('/communication/notify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, firmId } = getUserContext(req);
    const { provider, channel, title, text, color } = req.body;

    if (!provider || !channel || !title || !text) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'provider, channel, title, and text are required' },
      });
      return;
    }

    let result;
    switch (provider) {
      case 'slack':
        result = await slack.sendNotification(userId, firmId, channel, title, text, color);
        break;
      case 'teams':
        result = await teams.sendNotification(userId, firmId, channel, title, text);
        break;
      default:
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: `Unknown provider: ${provider}` } });
        return;
    }

    res.status(result.success ? 200 : 503).json(result);
  } catch (err) {
    errorResponse(res, err);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Video Conferencing Routes (stubs)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/video-conferencing/meetings
 * Create a meeting via Zoom or Teams.
 * Body: { provider: 'zoom'|'teams', topic, agenda, startTime, durationMinutes, ... }
 */
router.post('/video-conferencing/meetings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, firmId } = getUserContext(req);
    const { provider, topic, agenda, startTime, durationMinutes, timezone, password, settings } = req.body;

    if (!provider || !topic || !startTime || !durationMinutes) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'provider, topic, startTime, and durationMinutes are required' },
      });
      return;
    }

    let meeting;
    switch (provider) {
      case 'zoom':
        meeting = await zoom.createMeeting(userId, firmId, {
          topic, agenda, startTime, durationMinutes, timezone, password, settings,
        });
        break;
      case 'teams':
        meeting = await teamsMeetings.createMeeting(userId, firmId, {
          topic, agenda, startTime, durationMinutes, timezone, password, settings,
        });
        break;
      default:
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: `Unknown provider: ${provider}` } });
        return;
    }

    res.status(201).json({ data: meeting });
  } catch (err) {
    errorResponse(res, err);
  }
});

/**
 * GET /api/v1/video-conferencing/meetings/:id
 * Get a meeting by ID.
 * Query params: ?provider=zoom
 */
router.get('/video-conferencing/meetings/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, firmId } = getUserContext(req);
    const provider = (req.query.provider as string) || 'zoom';
    const meetingId = req.params.id;

    let meeting;
    switch (provider) {
      case 'zoom':
        meeting = await zoom.getMeeting(userId, firmId, meetingId);
        break;
      default:
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: `Unknown provider: ${provider}` } });
        return;
    }

    res.json({ data: meeting });
  } catch (err) {
    errorResponse(res, err);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Workflow Automation Routes (stubs)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/workflow/trigger
 * Trigger a workflow in Zapier, Make, or n8n.
 * Body: { provider: 'zapier'|'make'|'n8n', event: string, data: object }
 */
router.post('/workflow/trigger', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, firmId } = getUserContext(req);
    const { provider, event, data } = req.body;

    if (!provider || !event) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'provider and event are required' },
      });
      return;
    }

    let result;
    const payload = { event, data: data || {}, timestamp: new Date().toISOString() };

    switch (provider) {
      case 'zapier':
        result = await zapier.triggerWebhook(userId, firmId, payload);
        break;
      case 'make':
        result = await make.triggerScenario(userId, firmId, payload);
        break;
      case 'n8n':
        result = await n8n.triggerWorkflow(userId, firmId, payload);
        break;
      default:
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: `Unknown provider: ${provider}` } });
        return;
    }

    res.status(result.success ? 200 : 503).json(result);
  } catch (err) {
    errorResponse(res, err);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Health Check — Aggregated status for all medium/low integrations
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/health', async (_req: Request, res: Response) => {
  const results = [
    ...crmHealthCheck().map((h) => ({
      category: 'crm',
      service: h.label,
      provider: h.provider,
      status: h.configured ? 'configured' : 'unconfigured',
    })),
    ...accountingHealthCheck().map((h) => ({
      category: 'accounting',
      service: h.label,
      provider: h.provider,
      status: h.configured ? 'configured' : 'unconfigured',
    })),
    ...dmsHealthCheck().map((h) => ({
      category: 'dms',
      service: h.label,
      provider: h.provider,
      status: h.configured ? 'configured' : 'unconfigured',
    })),
    ...communicationHealthCheck().map((h) => ({
      category: 'communication',
      service: h.label,
      provider: h.provider,
      status: h.configured ? 'configured' : 'unconfigured',
    })),
    ...videoConferencingHealthCheck().map((h) => ({
      category: 'video-conferencing',
      service: h.label,
      provider: h.provider,
      status: h.configured ? 'configured' : 'unconfigured',
    })),
    ...workflowHealthCheck().map((h) => ({
      category: 'workflow',
      service: h.label,
      provider: h.provider,
      status: h.configured ? 'configured' : 'unconfigured',
    })),
  ];

  res.json({
    total: results.length,
    configured: results.filter((r) => r.status === 'configured').length,
    unconfigured: results.filter((r) => r.status === 'unconfigured').length,
    services: results,
    timestamp: new Date().toISOString(),
  });
});

export default router;