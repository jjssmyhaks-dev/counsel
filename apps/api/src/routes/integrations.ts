import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@counsel/database';
import {
  registerOAuthProvider,
  getProvider,
  listProviders,
  buildAuthUrl,
  exchangeCode,
  storeTokens,
  getStoredTokens,
  deleteTokens,
  oauthHealthCheck,
} from '../lib/oauth';
import { r2HealthCheck } from '../lib/r2-client';
import crypto from 'crypto';

const router = Router();

// ── Init: Register all OAuth providers on import ───────────────────────────

function initProviders() {
  const baseUrl = process.env.CORS_ORIGIN || 'http://localhost:3000';

  // Google (Gmail + Calendar + Drive)
  if (process.env.GOOGLE_CLIENT_ID) {
    registerOAuthProvider({
      id: 'google',
      name: 'Google Workspace',
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirectUri: `${process.env.API_URL || 'http://localhost:3001'}/api/v1/integrations/google/callback`,
      scopes: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.compose',
        'https://www.googleapis.com/auth/calendar.readonly',
        'https://www.googleapis.com/auth/drive.readonly',
      ],
      extraAuthParams: { access_type: 'offline', prompt: 'consent' },
    });
  }

  // DocuSign
  if (process.env.DOCUSIGN_INTEGRATION_KEY) {
    const isDemo = !process.env.DOCUSIGN_ACCOUNT_ID || process.env.DOCUSIGN_ACCOUNT_ID === 'demo';
    registerOAuthProvider({
      id: 'docusign',
      name: 'DocuSign eSignature',
      authorizeUrl: `https://${isDemo ? 'account-d' : 'account'}.docusign.com/oauth/auth`,
      tokenUrl: `https://${isDemo ? 'account-d' : 'account'}.docusign.com/oauth/token`,
      clientId: process.env.DOCUSIGN_INTEGRATION_KEY!,
      clientSecret: process.env.DOCUSIGN_SECRET_KEY || '',
      redirectUri: `${process.env.API_URL || 'http://localhost:3001'}/api/v1/integrations/docusign/callback`,
      scopes: ['signature', 'impersonation'],
    });
  }

  // Microsoft (Outlook + Calendar + OneDrive + Teams)
  if (process.env.MICROSOFT_CLIENT_ID) {
    registerOAuthProvider({
      id: 'microsoft',
      name: 'Microsoft 365',
      authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
      redirectUri: `${process.env.API_URL || 'http://localhost:3001'}/api/v1/integrations/microsoft/callback`,
      scopes: [
        'Mail.Read', 'Mail.Send',
        'Calendars.ReadWrite',
        'Files.Read.All',
        'offline_access',
      ],
    });
  }

  // Salesforce
  if (process.env.SALESFORCE_CLIENT_ID) {
    registerOAuthProvider({
      id: 'salesforce',
      name: 'Salesforce CRM',
      authorizeUrl: 'https://login.salesforce.com/services/oauth2/authorize',
      tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
      clientId: process.env.SALESFORCE_CLIENT_ID!,
      clientSecret: process.env.SALESFORCE_CLIENT_SECRET || '',
      redirectUri: `${process.env.API_URL || 'http://localhost:3001'}/api/v1/integrations/salesforce/callback`,
      scopes: ['api', 'refresh_token'],
    });
  }

  // QuickBooks
  if (process.env.QUICKBOOKS_CLIENT_ID) {
    registerOAuthProvider({
      id: 'quickbooks',
      name: 'QuickBooks Online',
      authorizeUrl: 'https://appcenter.intuit.com/connect/oauth2',
      tokenUrl: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
      clientId: process.env.QUICKBOOKS_CLIENT_ID!,
      clientSecret: process.env.QUICKBOOKS_CLIENT_SECRET || '',
      redirectUri: `${process.env.API_URL || 'http://localhost:3001'}/api/v1/integrations/quickbooks/callback`,
      scopes: ['com.intuit.quickbooks.accounting'],
    });
  }

  // Slack
  if (process.env.SLACK_CLIENT_ID) {
    registerOAuthProvider({
      id: 'slack',
      name: 'Slack',
      authorizeUrl: 'https://slack.com/oauth/v2/authorize',
      tokenUrl: 'https://slack.com/api/oauth.v2.access',
      clientId: process.env.SLACK_CLIENT_ID!,
      clientSecret: process.env.SLACK_CLIENT_SECRET || '',
      redirectUri: `${process.env.API_URL || 'http://localhost:3001'}/api/v1/integrations/slack/callback`,
      scopes: ['chat:write', 'channels:read', 'users:read'],
    });
  }

  // Zoom
  if (process.env.ZOOM_CLIENT_ID) {
    registerOAuthProvider({
      id: 'zoom',
      name: 'Zoom',
      authorizeUrl: 'https://zoom.us/oauth/authorize',
      tokenUrl: 'https://zoom.us/oauth/token',
      clientId: process.env.ZOOM_CLIENT_ID!,
      clientSecret: process.env.ZOOM_CLIENT_SECRET || '',
      redirectUri: `${process.env.API_URL || 'http://localhost:3001'}/api/v1/integrations/zoom/callback`,
      scopes: ['meeting:write', 'user:read'],
    });
  }

  console.log(`[Integrations] Registered ${listProviders().length} OAuth providers`);
}

initProviders();

// ── GET /integrations — List all available integrations with status ────────

router.get('/', (req: Request, res: Response) => {
  const providers = listProviders();
  res.json({
    data: providers.map((p) => ({
      id: p.id,
      name: p.name,
      health: oauthHealthCheck(p.id),
    })),
    total: providers.length,
  });
});

// ── GET /integrations/:provider/status — Check if connected ────────────────

router.get('/:provider/status', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const provider = req.params.provider;

  const tokens = await getStoredTokens(userId, provider);
  res.json({
    provider,
    connected: !!tokens,
    expiresAt: tokens?.expiresAt || null,
  });
});

// ── GET /integrations/:provider/auth-url — Start OAuth flow ────────────────

router.get('/:provider/auth-url', (req: Request, res: Response) => {
  const provider = req.params.provider;
  const userId = (req as any).userId;
  const firmId = (req as any).firmId;

  const state = crypto.randomBytes(16).toString('hex');
  const authUrl = buildAuthUrl(provider, `${state}:${userId}:${firmId}`);
  res.json({ url: authUrl });
});

// ── GET /integrations/:provider/callback — OAuth callback ──────────────────

router.get('/:provider/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      res.status(400).json({ error: 'Missing code or state parameter', code: 'OAUTH_BAD_CALLBACK' });
      return;
    }

    const [nonce, userId, firmId] = (state as string).split(':');
    if (!userId || !firmId) {
      res.status(400).json({ error: 'Invalid state parameter', code: 'OAUTH_BAD_STATE' });
      return;
    }

    const provider = req.params.provider;
    const tokens = await exchangeCode(provider, code as string);
    await storeTokens(userId, firmId, provider, tokens);

    // Audit log
    await prisma.auditLog.create({
      data: {
        firmId,
        userId,
        action: 'INTEGRATION_CONNECTED',
        resourceType: 'Integration',
        resourceId: provider,
        details: { provider, scopes: tokens.scope },
      },
    });

    const frontendUrl = process.env.CORS_ORIGIN || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/dashboard/integrations?connected=${provider}`);
  } catch (err) {
    next(err);
  }
});

// ── POST /integrations/:provider/disconnect ────────────────────────────────

router.post('/:provider/disconnect', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const firmId = (req as any).firmId;
    const provider = req.params.provider;

    await deleteTokens(userId, provider);

    await prisma.auditLog.create({
      data: {
        firmId,
        userId,
        action: 'INTEGRATION_DISCONNECTED',
        resourceType: 'Integration',
        resourceId: provider,
        details: { provider },
      },
    });

    res.json({ disconnected: true, provider });
  } catch (err) {
    next(err);
  }
});

// ─── GET /integrations-health — Full health check for all services ─────────

router.get('/health', async (_req: Request, res: Response) => {
  const results: any[] = [];

  // R2
  results.push({ service: 'Cloudflare R2', ...(await r2HealthCheck()) });

  // OAuth providers
  for (const p of listProviders()) {
    results.push({
      service: p.name,
      provider: p.id,
      ...oauthHealthCheck(p.id),
    });
  }

  // Stripe (check via env)
  results.push({
    service: 'Stripe',
    status: process.env.STRIPE_SECRET_KEY ? 'configured' : 'unconfigured',
  });

  // Resend
  results.push({
    service: 'Resend Email',
    status: process.env.RESEND_API_KEY ? 'configured' : 'unconfigured',
  });

  // WorkOS
  results.push({
    service: 'WorkOS SSO',
    status: process.env.WORKOS_API_KEY ? 'configured' : 'unconfigured',
  });

  // Cloudflare AI
  results.push({
    service: 'Cloudflare Workers AI',
    status: process.env.CF_API_TOKEN ? 'configured' : 'unconfigured',
  });

  // All catalog services
  const catalogServices = [
    'gmail', 'outlook', 'google-calendar', 'outlook-calendar',
    'google-drive', 'onedrive', 'sharepoint', 'docusign', 'hellosign',
    'salesforce', 'clio', 'hubspot', 'slack', 'teams', 'zoom',
    'quickbooks', 'xero', 'zoho-books', 'imanage', 'netdocuments',
    'harvest', 'toggl', 'zapier', 'make', 'n8n',
  ];
  for (const svc of catalogServices) {
    results.push({ service: svc, status: 'catalog_only' });
  }

  res.json({
    total: results.length,
    connected: results.filter((r) => r.status === 'connected').length,
    configured: results.filter((r) => r.status === 'configured').length,
    catalogOnly: results.filter((r) => r.status === 'catalog_only').length,
    unconfigured: results.filter((r) => r.status === 'unconfigured').length,
    services: results,
    timestamp: new Date().toISOString(),
  });
});

export default router;
