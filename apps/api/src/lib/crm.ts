/**
 * CRM Integration Clients — Salesforce, Clio Manage, HubSpot
 *
 * All clients auto-register with the shared OAuth provider registry.
 * Each client is feature-gated: only activates when its required env vars are set.
 * Exports a unified crmSearch() that queries all connected CRMs.
 *
 * ── Salesforce: REST API (OAuth 2.0 via shared module)
 * ── Clio Manage: API v4 (OAuth 2.0)
 * ── HubSpot: API v3 (OAuth 2.0 / Private App access token)
 */
import {
  registerOAuthProvider,
  getValidToken,
  getStoredTokens,
  storeTokens,
  OAuthTokens,
} from './oauth';
import { prisma } from '@counsel/database';
import { log } from './logger';

// ── Types ───────────────────────────────────────────────────────────────────

export interface CRMContact {
  id: string;
  provider: 'salesforce' | 'clio' | 'hubspot';
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  title?: string;
  rawData: Record<string, any>;
}

export interface CRMContactSearchParams {
  query?: string;
  email?: string;
  phone?: string;
  limit?: number;
  offset?: number;
}

export interface CRMContactResult {
  contacts: CRMContact[];
  total: number;
  providers: string[];
}

export interface CRMOpportunity {
  id: string;
  provider: 'salesforce' | 'clio' | 'hubspot';
  name: string;
  stage: string;
  amount?: number;
  closeDate?: string;
  contactId?: string;
  rawData: Record<string, any>;
}

export interface CRMHealthStatus {
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
    log.warn('[CRM] Audit log write failed', { error: (err as Error).message });
  }
}

// ── Feature Gate Helper ─────────────────────────────────────────────────────

function featureGate(envVars: string[]): boolean {
  return envVars.every((v) => {
    const val = process.env[v];
    return val && val.length > 0;
  });
}

function gateStatus(envVars: string[]): { configured: boolean; missing: string[] } {
  const missing = envVars.filter((v) => !process.env[v] || process.env[v]!.length === 0);
  return { configured: missing.length === 0, missing };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SalesforceClient
// ═══════════════════════════════════════════════════════════════════════════════

const SALESFORCE_ENV_VARS = ['SALESFORCE_CLIENT_ID', 'SALESFORCE_CLIENT_SECRET'];

export class SalesforceClient {
  private configured: boolean;
  private instanceUrl: string | null = null;
  private apiVersion = 'v58.0';

  constructor() {
    const { configured } = gateStatus(SALESFORCE_ENV_VARS);
    this.configured = configured;

    if (this.configured) {
      registerOAuthProvider({
        id: 'salesforce',
        name: 'Salesforce CRM',
        authorizeUrl: 'https://login.salesforce.com/services/oauth2/authorize',
        tokenUrl: 'https://login.salesforce.com/services/oauth2/token',
        clientId: process.env.SALESFORCE_CLIENT_ID!,
        clientSecret: process.env.SALESFORCE_CLIENT_SECRET || '',
        redirectUri: `${process.env.API_URL || 'http://localhost:3001'}/api/v1/integrations/salesforce/callback`,
        scopes: ['api', 'refresh_token', 'offline_access'],
      });
      log.info('[CRM] SalesforceClient registered');
    } else {
      log.info('[CRM] SalesforceClient not configured (missing env vars)');
    }
  }

  private async getInstanceUrl(userId: string): Promise<string | null> {
    if (this.instanceUrl) return this.instanceUrl;
    const tokens = await getStoredTokens(userId, 'salesforce');
    if (tokens?.rawResponse?.instance_url) {
      this.instanceUrl = tokens.rawResponse.instance_url;
      return this.instanceUrl;
    }
    return null;
  }

  private async apiCall(
    userId: string,
    firmId: string,
    method: string,
    path: string,
    body?: any,
    params?: Record<string, string>,
  ): Promise<any> {
    const tokens = await getValidToken(userId, 'salesforce');
    if (!tokens) throw { code: 'CRM_NOT_CONNECTED', message: 'Salesforce not connected', status: 401 };

    const instanceUrl = await this.getInstanceUrl(userId);
    if (!instanceUrl) throw { code: 'CRM_NO_INSTANCE_URL', message: 'Salesforce instance URL not available', status: 500 };

    const url = new URL(`${instanceUrl}/services/data/${this.apiVersion}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${tokens.accessToken}`,
      'Content-Type': 'application/json',
    };

    const res = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ message: res.statusText }));
      log.error(`[CRM] Salesforce API error ${res.status}`, { path, error: errBody });
      throw { code: 'CRM_API_ERROR', message: errBody?.[0]?.message || errBody?.message || 'Salesforce API error', status: res.status };
    }

    return res.json();
  }

  async searchContacts(userId: string, firmId: string, params: CRMContactSearchParams): Promise<CRMContact[]> {
    const soqlParts: string[] = [];
    soqlParts.push('SELECT Id, FirstName, LastName, Email, Phone, Company, Title FROM Contact');

    const conditions: string[] = [];
    if (params.query) {
      const q = params.query.replace(/'/g, "\\'");
      conditions.push(`(Name LIKE '%${q}%' OR Email LIKE '%${q}%')`);
    }
    if (params.email) {
      conditions.push(`Email = '${params.email.replace(/'/g, "\\'")}'`);
    }
    if (params.phone) {
      conditions.push(`Phone = '${params.phone.replace(/'/g, "\\'")}'`);
    }

    if (conditions.length > 0) {
      soqlParts.push(`WHERE ${conditions.join(' AND ')}`);
    }

    soqlParts.push(`LIMIT ${params.limit || 20}`);
    if (params.offset) soqlParts.push(`OFFSET ${params.offset}`);

    const soql = soqlParts.join(' ');

    const result = await this.apiCall(userId, firmId, 'GET', '/query', undefined, { q: soql });

    await auditLog(userId, firmId, 'CRM_SEARCH_CONTACTS', 'CRM', 'salesforce', { query: params });

    return (result.records || []).map((r: any) => ({
      id: r.Id,
      provider: 'salesforce' as const,
      firstName: r.FirstName || '',
      lastName: r.LastName || '',
      email: r.Email || '',
      phone: r.Phone,
      company: r.Company,
      title: r.Title,
      rawData: r,
    }));
  }

  async getContact(userId: string, firmId: string, contactId: string): Promise<CRMContact> {
    const result = await this.apiCall(userId, firmId, 'GET', `/sobjects/Contact/${contactId}`);
    await auditLog(userId, firmId, 'CRM_GET_CONTACT', 'CRM', contactId);

    return {
      id: result.Id,
      provider: 'salesforce',
      firstName: result.FirstName || '',
      lastName: result.LastName || '',
      email: result.Email || '',
      phone: result.Phone,
      company: result.Company,
      title: result.Title,
      rawData: result,
    };
  }

  async createContact(userId: string, firmId: string, contact: Partial<CRMContact>): Promise<CRMContact> {
    const body: Record<string, any> = {};
    if (contact.firstName) body.FirstName = contact.firstName;
    if (contact.lastName) body.LastName = contact.lastName;
    if (contact.email) body.Email = contact.email;
    if (contact.phone) body.Phone = contact.phone;
    if (contact.company) body.Company = contact.company;
    if (contact.title) body.Title = contact.title;

    const result = await this.apiCall(userId, firmId, 'POST', '/sobjects/Contact', body);
    await auditLog(userId, firmId, 'CRM_CREATE_CONTACT', 'CRM', result.id, { contact: body });

    return {
      id: result.id,
      provider: 'salesforce',
      firstName: contact.firstName || '',
      lastName: contact.lastName || '',
      email: contact.email || '',
      phone: contact.phone,
      company: contact.company,
      title: contact.title,
      rawData: result,
    };
  }

  async getOpportunities(userId: string, firmId: string, limit = 20, offset = 0): Promise<CRMOpportunity[]> {
    const soql = `SELECT Id, Name, StageName, Amount, CloseDate, ContactId FROM Opportunity ORDER BY CloseDate DESC LIMIT ${limit} OFFSET ${offset}`;
    const result = await this.apiCall(userId, firmId, 'GET', '/query', undefined, { q: soql });
    await auditLog(userId, firmId, 'CRM_GET_OPPORTUNITIES', 'CRM', 'salesforce');

    return (result.records || []).map((r: any) => ({
      id: r.Id,
      provider: 'salesforce' as const,
      name: r.Name,
      stage: r.StageName,
      amount: r.Amount,
      closeDate: r.CloseDate,
      contactId: r.ContactId,
      rawData: r,
    }));
  }

  healthCheck(): CRMHealthStatus {
    return {
      provider: 'salesforce',
      configured: this.configured,
      connected: this.configured,
      label: 'Salesforce CRM',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ClioClient
// ═══════════════════════════════════════════════════════════════════════════════

const CLIO_ENV_VARS = ['CLIO_CLIENT_ID', 'CLIO_CLIENT_SECRET'];
const CLIO_API_BASE = 'https://app.clio.com/api/v4';

export class ClioClient {
  private configured: boolean;

  constructor() {
    const { configured } = gateStatus(CLIO_ENV_VARS);
    this.configured = configured;

    if (this.configured) {
      registerOAuthProvider({
        id: 'clio',
        name: 'Clio Manage',
        authorizeUrl: 'https://app.clio.com/oauth/authorize',
        tokenUrl: 'https://app.clio.com/oauth/token',
        clientId: process.env.CLIO_CLIENT_ID!,
        clientSecret: process.env.CLIO_CLIENT_SECRET || '',
        redirectUri: `${process.env.API_URL || 'http://localhost:3001'}/api/v1/integrations/clio/callback`,
        scopes: ['read', 'write'],
      });
      log.info('[CRM] ClioClient registered');
    } else {
      log.info('[CRM] ClioClient not configured (missing env vars)');
    }
  }

  private async apiCall(
    userId: string,
    firmId: string,
    method: string,
    path: string,
    body?: any,
    params?: Record<string, string>,
  ): Promise<any> {
    const tokens = await getValidToken(userId, 'clio');
    if (!tokens) throw { code: 'CRM_NOT_CONNECTED', message: 'Clio not connected', status: 401 };

    const url = new URL(`${CLIO_API_BASE}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const res = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ message: res.statusText }));
      log.error(`[CRM] Clio API error ${res.status}`, { path, error: errBody });
      throw { code: 'CRM_API_ERROR', message: errBody?.error?.message || errBody?.message || 'Clio API error', status: res.status };
    }

    return res.json();
  }

  async searchContacts(userId: string, firmId: string, params: CRMContactSearchParams): Promise<CRMContact[]> {
    const queryParams: Record<string, string> = { limit: String(params.limit || 20) };
    if (params.query) queryParams.query = params.query;
    if (params.email) queryParams.email = params.email;
    if (params.offset) queryParams.offset = String(params.offset);

    const result = await this.apiCall(userId, firmId, 'GET', '/contacts', undefined, queryParams);
    await auditLog(userId, firmId, 'CRM_SEARCH_CONTACTS', 'CRM', 'clio', { query: params });

    return (result.data || []).map((r: any) => ({
      id: r.id,
      provider: 'clio' as const,
      firstName: r.first_name || '',
      lastName: r.last_name || '',
      email: r.primary_email_address || r.email || '',
      phone: r.phone_number,
      company: r.company?.name,
      title: r.title,
      rawData: r,
    }));
  }

  async getContact(userId: string, firmId: string, contactId: string): Promise<CRMContact> {
    const result = await this.apiCall(userId, firmId, 'GET', `/contacts/${contactId}`);
    await auditLog(userId, firmId, 'CRM_GET_CONTACT', 'CRM', contactId);

    return {
      id: result.data.id,
      provider: 'clio',
      firstName: result.data.first_name || '',
      lastName: result.data.last_name || '',
      email: result.data.primary_email_address || result.data.email || '',
      phone: result.data.phone_number,
      company: result.data.company?.name,
      title: result.data.title,
      rawData: result.data,
    };
  }

  async createContact(userId: string, firmId: string, contact: Partial<CRMContact>): Promise<CRMContact> {
    const body: Record<string, any> = {
      data: {
        first_name: contact.firstName,
        last_name: contact.lastName,
        ...(contact.email && { primary_email_address: contact.email }),
        ...(contact.phone && { phone_number: contact.phone }),
        ...(contact.title && { title: contact.title }),
      },
    };

    const result = await this.apiCall(userId, firmId, 'POST', '/contacts', body);
    await auditLog(userId, firmId, 'CRM_CREATE_CONTACT', 'CRM', result.data.id, { contact: body });

    return {
      id: result.data.id,
      provider: 'clio',
      firstName: result.data.first_name || '',
      lastName: result.data.last_name || '',
      email: result.data.primary_email_address || result.data.email || '',
      phone: result.data.phone_number,
      company: result.data.company?.name,
      title: result.data.title,
      rawData: result.data,
    };
  }

  async getOpportunities(userId: string, firmId: string, limit = 20, offset = 0): Promise<CRMOpportunity[]> {
    // Clio uses "matters" as the opportunity analog
    const result = await this.apiCall(userId, firmId, 'GET', '/matters', undefined, {
      limit: String(limit),
      offset: String(offset),
      order: 'created_at(desc)',
    });
    await auditLog(userId, firmId, 'CRM_GET_OPPORTUNITIES', 'CRM', 'clio');

    return (result.data || []).map((r: any) => ({
      id: r.id,
      provider: 'clio' as const,
      name: r.description || `Matter ${r.id}`,
      stage: r.status || 'open',
      amount: r.pending_amount || r.total_amount,
      closeDate: r.close_date || r.updated_at,
      contactId: r.client?.id,
      rawData: r,
    }));
  }

  healthCheck(): CRMHealthStatus {
    return {
      provider: 'clio',
      configured: this.configured,
      connected: this.configured,
      label: 'Clio Manage',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HubSpotClient
// ═══════════════════════════════════════════════════════════════════════════════

const HUBSPOT_ENV_VARS = ['HUBSPOT_CLIENT_ID', 'HUBSPOT_CLIENT_SECRET'];
const HUBSPOT_API_BASE = 'https://api.hubapi.com';

export class HubSpotClient {
  private configured: boolean;
  private apiKey: string | null = null;

  constructor() {
    const { configured } = gateStatus(HUBSPOT_ENV_VARS);
    this.configured = configured;
    // Also support private app access token fallback
    this.apiKey = process.env.HUBSPOT_ACCESS_TOKEN || null;

    if (this.configured) {
      registerOAuthProvider({
        id: 'hubspot',
        name: 'HubSpot CRM',
        authorizeUrl: 'https://app.hubspot.com/oauth/authorize',
        tokenUrl: 'https://api.hubapi.com/oauth/v1/token',
        clientId: process.env.HUBSPOT_CLIENT_ID!,
        clientSecret: process.env.HUBSPOT_CLIENT_SECRET || '',
        redirectUri: `${process.env.API_URL || 'http://localhost:3001'}/api/v1/integrations/hubspot/callback`,
        scopes: ['crm.objects.contacts.read', 'crm.objects.contacts.write', 'crm.objects.deals.read'],
      });
      log.info('[CRM] HubSpotClient registered');
    } else if (this.apiKey) {
      this.configured = true;
      log.info('[CRM] HubSpotClient using private app access token');
    } else {
      log.info('[CRM] HubSpotClient not configured (missing env vars)');
    }
  }

  private async getAccessToken(userId: string): Promise<string> {
    if (this.apiKey) return this.apiKey;
    const tokens = await getValidToken(userId, 'hubspot');
    if (!tokens) throw { code: 'CRM_NOT_CONNECTED', message: 'HubSpot not connected', status: 401 };
    return tokens.accessToken;
  }

  private async apiCall(
    userId: string,
    firmId: string,
    method: string,
    path: string,
    body?: any,
    params?: Record<string, string>,
  ): Promise<any> {
    const token = await this.getAccessToken(userId);
    const url = new URL(`${HUBSPOT_API_BASE}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const res = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ message: res.statusText }));
      log.error(`[CRM] HubSpot API error ${res.status}`, { path, error: errBody });
      throw { code: 'CRM_API_ERROR', message: errBody?.message || 'HubSpot API error', status: res.status };
    }

    return res.json();
  }

  async searchContacts(userId: string, firmId: string, params: CRMContactSearchParams): Promise<CRMContact[]> {
    const searchBody: any = {
      limit: params.limit || 20,
      after: params.offset ? String(params.offset) : undefined,
      sorts: ['lastname'],
    };

    if (params.query || params.email) {
      searchBody.filterGroups = [{
        filters: [
          ...(params.query ? [{ propertyName: 'firstname', operator: 'CONTAINS_TOKEN', value: params.query }] : []),
          ...(params.query ? [{ propertyName: 'lastname', operator: 'CONTAINS_TOKEN', value: params.query }] : []),
          ...(params.email ? [{ propertyName: 'email', operator: 'EQ', value: params.email }] : []),
        ],
      }];
    }

    const result = await this.apiCall(userId, firmId, 'POST', '/crm/v3/objects/contacts/search', searchBody);
    await auditLog(userId, firmId, 'CRM_SEARCH_CONTACTS', 'CRM', 'hubspot', { query: params });

    return (result.results || []).map((r: any) => ({
      id: r.id,
      provider: 'hubspot' as const,
      firstName: r.properties?.firstname || '',
      lastName: r.properties?.lastname || '',
      email: r.properties?.email || '',
      phone: r.properties?.phone || '',
      company: r.properties?.company || '',
      title: r.properties?.jobtitle || '',
      rawData: r,
    }));
  }

  async getContact(userId: string, firmId: string, contactId: string): Promise<CRMContact> {
    const result = await this.apiCall(userId, firmId, 'GET', `/crm/v3/objects/contacts/${contactId}`, undefined, {
      properties: 'firstname,lastname,email,phone,company,jobtitle',
    });
    await auditLog(userId, firmId, 'CRM_GET_CONTACT', 'CRM', contactId);

    return {
      id: result.id,
      provider: 'hubspot',
      firstName: result.properties?.firstname || '',
      lastName: result.properties?.lastname || '',
      email: result.properties?.email || '',
      phone: result.properties?.phone || '',
      company: result.properties?.company || '',
      title: result.properties?.jobtitle || '',
      rawData: result,
    };
  }

  async createContact(userId: string, firmId: string, contact: Partial<CRMContact>): Promise<CRMContact> {
    const body = {
      properties: {
        firstname: contact.firstName || '',
        lastname: contact.lastName || '',
        ...(contact.email && { email: contact.email }),
        ...(contact.phone && { phone: contact.phone }),
        ...(contact.company && { company: contact.company }),
        ...(contact.title && { jobtitle: contact.title }),
      },
    };

    const result = await this.apiCall(userId, firmId, 'POST', '/crm/v3/objects/contacts', body);
    await auditLog(userId, firmId, 'CRM_CREATE_CONTACT', 'CRM', result.id, { contact: body });

    return {
      id: result.id,
      provider: 'hubspot',
      firstName: result.properties?.firstname || '',
      lastName: result.properties?.lastname || '',
      email: result.properties?.email || '',
      phone: result.properties?.phone || '',
      company: result.properties?.company || '',
      title: result.properties?.jobtitle || '',
      rawData: result,
    };
  }

  async getOpportunities(userId: string, firmId: string, limit = 20, offset = 0): Promise<CRMOpportunity[]> {
    const searchBody: any = {
      limit,
      after: offset ? String(offset) : undefined,
      sorts: ['-createdate'],
      properties: ['dealname', 'dealstage', 'amount', 'closedate', 'hubspot_owner_id'],
    };

    const result = await this.apiCall(userId, firmId, 'POST', '/crm/v3/objects/deals/search', searchBody);
    await auditLog(userId, firmId, 'CRM_GET_OPPORTUNITIES', 'CRM', 'hubspot');

    return (result.results || []).map((r: any) => ({
      id: r.id,
      provider: 'hubspot' as const,
      name: r.properties?.dealname || '',
      stage: r.properties?.dealstage || '',
      amount: r.properties?.amount ? parseFloat(r.properties.amount) : undefined,
      closeDate: r.properties?.closedate,
      contactId: r.properties?.hubspot_owner_id,
      rawData: r,
    }));
  }

  healthCheck(): CRMHealthStatus {
    return {
      provider: 'hubspot',
      configured: this.configured,
      connected: this.configured,
      label: 'HubSpot CRM',
    };
  }
}

// ── Singleton Instances ─────────────────────────────────────────────────────

export const salesforce = new SalesforceClient();
export const clio = new ClioClient();
export const hubspot = new HubSpotClient();

// ── Unified CRM Search ──────────────────────────────────────────────────────

export async function crmSearch(
  userId: string,
  firmId: string,
  params: CRMContactSearchParams,
): Promise<CRMContactResult> {
  const providers: string[] = [];
  const allContacts: CRMContact[] = [];
  const errors: string[] = [];

  const clients = [
    { name: 'salesforce', search: (p: CRMContactSearchParams) => salesforce.searchContacts(userId, firmId, p) },
    { name: 'clio', search: (p: CRMContactSearchParams) => clio.searchContacts(userId, firmId, p) },
    { name: 'hubspot', search: (p: CRMContactSearchParams) => hubspot.searchContacts(userId, firmId, p) },
  ];

  for (const client of clients) {
    try {
      const contacts = await client.search(params);
      if (contacts.length > 0) {
        providers.push(client.name);
        allContacts.push(...contacts);
      }
    } catch (err: any) {
      if (err.code !== 'CRM_NOT_CONNECTED') {
        log.warn(`[CRM] ${client.name} search failed`, { error: err.message });
        errors.push(`${client.name}: ${err.message}`);
      }
    }
  }

  await auditLog(userId, firmId, 'CRM_UNIFIED_SEARCH', 'CRM', 'unified', {
    params,
    providers,
    resultCount: allContacts.length,
    errors: errors.length > 0 ? errors : undefined,
  });

  return {
    contacts: allContacts,
    total: allContacts.length,
    providers,
  };
}

// ── Health Checks ───────────────────────────────────────────────────────────

export function crmHealthCheck(): CRMHealthStatus[] {
  return [
    salesforce.healthCheck(),
    clio.healthCheck(),
    hubspot.healthCheck(),
  ];
}