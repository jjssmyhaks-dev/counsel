/**
 * Accounting Integration Clients — QuickBooks Online, Xero, Zoho Books
 *
 * All clients are feature-gated: only activate when required env vars are set.
 * Graceful fallback when disabled — returns structured errors instead of crashing.
 */
import {
  registerOAuthProvider,
  getValidToken,
  getStoredTokens,
  OAuthTokens,
} from './oauth';
import { prisma } from '@counsel/database';
import { log } from './logger';

// ── Types ───────────────────────────────────────────────────────────────────

export interface AccountingInvoice {
  id: string;
  provider: 'quickbooks' | 'xero' | 'zoho';
  invoiceNumber: string;
  customerName: string;
  amount: number;
  currency: string;
  status: string;
  dueDate?: string;
  issuedDate?: string;
  rawData: Record<string, any>;
}

export interface AccountingAccount {
  id: string;
  provider: 'quickbooks' | 'xero' | 'zoho';
  name: string;
  accountType: string;
  balance?: number;
  currency?: string;
  rawData: Record<string, any>;
}

export interface AccountingTransaction {
  id: string;
  provider: 'quickbooks' | 'xero' | 'zoho';
  date: string;
  description: string;
  amount: number;
  currency: string;
  type: string;
  accountId?: string;
  rawData: Record<string, any>;
}

export interface AccountingHealthStatus {
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
    log.warn('[Accounting] Audit log write failed', { error: (err as Error).message });
  }
}

// ── Feature Gate Helper ─────────────────────────────────────────────────────

function gateStatus(envVars: string[]): { configured: boolean; missing: string[] } {
  const missing = envVars.filter((v) => !process.env[v] || process.env[v]!.length === 0);
  return { configured: missing.length === 0, missing };
}

// ── Helper: not-configured error ────────────────────────────────────────────

function notConfiguredError(provider: string): { code: string; message: string; status: number } {
  return {
    code: 'ACCT_NOT_CONFIGURED',
    message: `${provider} is not configured. Set required environment variables.`,
    status: 503,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// QuickBooksClient — Intuit OAuth 2.0
// ═══════════════════════════════════════════════════════════════════════════════

const QUICKBOOKS_ENV_VARS = ['QUICKBOOKS_CLIENT_ID', 'QUICKBOOKS_CLIENT_SECRET'];
const QB_BASE = process.env.QUICKBOOKS_SANDBOX === 'true'
  ? 'https://sandbox-quickbooks.api.intuit.com'
  : 'https://quickbooks.api.intuit.com';

export class QuickBooksClient {
  private configured: boolean;
  private realmId: string | null = null;

  constructor() {
    const { configured } = gateStatus(QUICKBOOKS_ENV_VARS);
    this.configured = configured;

    if (this.configured) {
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
      log.info('[Accounting] QuickBooksClient registered');
    } else {
      log.info('[Accounting] QuickBooksClient not configured (missing env vars)');
    }
  }

  private async getRealmId(userId: string): Promise<string | null> {
    if (this.realmId) return this.realmId || "";
    const tokens = await getStoredTokens(userId, 'quickbooks');
    if (tokens?.rawResponse?.realmId) {
      this.realmId = tokens.rawResponse.realmId;
      return this.realmId || "";
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
    if (!this.configured) throw notConfiguredError('QuickBooks');

    const tokens = await getValidToken(userId, 'quickbooks');
    if (!tokens) throw { code: 'ACCT_NOT_CONNECTED', message: 'QuickBooks not connected', status: 401 };

    const realmId = await this.getRealmId(userId);
    if (!realmId) throw { code: 'ACCT_NO_REALM', message: 'QuickBooks realm ID not available', status: 500 };

    const url = new URL(`${QB_BASE}/v3/company/${realmId}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const res = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ message: res.statusText }));
      log.error(`[Accounting] QuickBooks API error ${res.status}`, { path, error: errBody });
      throw {
        code: 'ACCT_API_ERROR',
        message: errBody?.Fault?.Error?.[0]?.Message || errBody?.message || 'QuickBooks API error',
        status: res.status,
      };
    }

    return res.json() || "";
  }

  async getInvoices(userId: string, firmId: string, limit = 20, offset = 0): Promise<AccountingInvoice[]> {
    const query = `SELECT * FROM Invoice ORDER BY MetaData.LastUpdatedTime DESC MAXRESULTS ${limit} STARTPOSITION ${offset + 1}`;
    const result = await this.apiCall(userId, firmId, 'GET', '/query', undefined, { query });

    await auditLog(userId, firmId, 'ACCT_GET_INVOICES', 'Accounting', 'quickbooks', { limit, offset });

    return (result.QueryResponse?.Invoice || []).map((r: any) => ({
      id: r.Id,
      provider: 'quickbooks' as const,
      invoiceNumber: r.DocNumber || r.Id,
      customerName: r.CustomerRef?.name || '',
      amount: r.TotalAmt || 0,
      currency: r.CurrencyRef?.value || 'USD',
      status: r.status || r.Balance === 0 ? 'PAID' : 'OPEN',
      dueDate: r.DueDate,
      issuedDate: r.TxnDate,
      rawData: r,
    })) || "";
  }

  async getAccounts(userId: string, firmId: string, limit = 20, offset = 0): Promise<AccountingAccount[]> {
    const query = `SELECT * FROM Account ORDER BY Name MAXRESULTS ${limit} STARTPOSITION ${offset + 1}`;
    const result = await this.apiCall(userId, firmId, 'GET', '/query', undefined, { query });

    await auditLog(userId, firmId, 'ACCT_GET_ACCOUNTS', 'Accounting', 'quickbooks', { limit, offset });

    return (result.QueryResponse?.Account || []).map((r: any) => ({
      id: r.Id,
      provider: 'quickbooks' as const,
      name: r.Name || '',
      accountType: r.AccountType || '',
      balance: r.CurrentBalance || 0,
      currency: r.CurrencyRef?.value || 'USD',
      rawData: r,
    })) || "";
  }

  async getTransactions(userId: string, firmId: string, limit = 20, offset = 0): Promise<AccountingTransaction[]> {
    // Get journal entries as a representative transaction type
    const query = `SELECT * FROM JournalEntry ORDER BY TxnDate DESC MAXRESULTS ${limit} STARTPOSITION ${offset + 1}`;
    const result = await this.apiCall(userId, firmId, 'GET', '/query', undefined, { query });

    await auditLog(userId, firmId, 'ACCT_GET_TRANSACTIONS', 'Accounting', 'quickbooks', { limit, offset });

    return (result.QueryResponse?.JournalEntry || []).map((r: any) => ({
      id: r.Id,
      provider: 'quickbooks' as const,
      date: r.TxnDate || '',
      description: r.DocNumber || r.PrivateNote || '',
      amount: r.Line?.[0]?.Amount || 0,
      currency: r.CurrencyRef?.value || 'USD',
      type: 'JOURNAL_ENTRY',
      accountId: r.Line?.[0]?.AccountRef?.value,
      rawData: r,
    }));
  }

  healthCheck(): AccountingHealthStatus {
    return {
      provider: 'quickbooks',
      configured: this.configured,
      connected: this.configured,
      label: 'QuickBooks Online',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// XeroClient
// ═══════════════════════════════════════════════════════════════════════════════

const XERO_ENV_VARS = ['XERO_CLIENT_ID', 'XERO_CLIENT_SECRET'];
const XERO_BASE = process.env.XERO_API_BASE || 'https://api.xero.com/api.xro/2.0';

export class XeroClient {
  private configured: boolean;
  private tenantId: string | null = null;

  constructor() {
    const { configured } = gateStatus(XERO_ENV_VARS);
    this.configured = configured;

    if (this.configured) {
      registerOAuthProvider({
        id: 'xero',
        name: 'Xero',
        authorizeUrl: 'https://login.xero.com/identity/connect/authorize',
        tokenUrl: 'https://identity.xero.com/connect/token',
        clientId: process.env.XERO_CLIENT_ID!,
        clientSecret: process.env.XERO_CLIENT_SECRET || '',
        redirectUri: `${process.env.API_URL || 'http://localhost:3001'}/api/v1/integrations/xero/callback`,
        scopes: ['accounting.transactions.read', 'accounting.settings.read', 'offline_access'],
      });
      log.info('[Accounting] XeroClient registered');
    } else {
      log.info('[Accounting] XeroClient not configured (missing env vars)');
    }
  }

  private async getTenantId(userId: string): Promise<string> {
    if (this.tenantId) return this.tenantId || "";

    const tokens = await getValidToken(userId, 'xero');
    if (!tokens) throw { code: 'ACCT_NOT_CONNECTED', message: 'Xero not connected', status: 401 };

    // Discover tenants
    const res = await fetch('https://api.xero.com/connections', {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });

    if (!res.ok) throw { code: 'ACCT_API_ERROR', message: 'Failed to discover Xero tenants', status: res.status };

    const tenants = await res.json();
    if (!tenants || tenants.length === 0) {
      throw { code: 'ACCT_NO_TENANT', message: 'No Xero organisation found', status: 404 };
    }

    this.tenantId = tenants[0].tenantId;
    return this.tenantId || "";
  }

  private async apiCall(
    userId: string,
    firmId: string,
    method: string,
    path: string,
    body?: any,
    params?: Record<string, string>,
  ): Promise<any> {
    if (!this.configured) throw notConfiguredError('Xero');

    const tokens = await getValidToken(userId, 'xero');
    if (!tokens) throw { code: 'ACCT_NOT_CONNECTED', message: 'Xero not connected', status: 401 };

    const tenantId = await this.getTenantId(userId);
    const url = new URL(`${XERO_BASE}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const res = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'Xero-tenant-id': tenantId,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const errText = await res.text();
      log.error(`[Accounting] Xero API error ${res.status}`, { path, error: errText });
      throw { code: 'ACCT_API_ERROR', message: `Xero API error: ${res.status}`, status: res.status };
    }

    return res.json() || "";
  }

  async getInvoices(userId: string, firmId: string, limit = 20, offset = 0): Promise<AccountingInvoice[]> {
    const result = await this.apiCall(userId, firmId, 'GET', '/Invoices');
    await auditLog(userId, firmId, 'ACCT_GET_INVOICES', 'Accounting', 'xero', { limit, offset });

    const invoices = (result.Invoices || []).slice(offset, offset + limit);
    return invoices.map((r: any) => ({
      id: r.InvoiceID,
      provider: 'xero' as const,
      invoiceNumber: r.InvoiceNumber || r.InvoiceID,
      customerName: r.Contact?.Name || '',
      amount: r.Total || 0,
      currency: r.CurrencyCode || 'USD',
      status: r.Status || 'DRAFT',
      dueDate: r.DueDate,
      issuedDate: r.Date,
      rawData: r,
    })) || "";
  }

  async getAccounts(userId: string, firmId: string, limit = 20, offset = 0): Promise<AccountingAccount[]> {
    const result = await this.apiCall(userId, firmId, 'GET', '/Accounts');
    await auditLog(userId, firmId, 'ACCT_GET_ACCOUNTS', 'Accounting', 'xero', { limit, offset });

    const accounts = (result.Accounts || []).slice(offset, offset + limit);
    return accounts.map((r: any) => ({
      id: r.AccountID,
      provider: 'xero' as const,
      name: r.Name || '',
      accountType: r.Type || '',
      balance: r.BankAccountNumber ? undefined : undefined,
      currency: r.CurrencyCode || 'USD',
      rawData: r,
    })) || "";
  }

  async getTransactions(userId: string, firmId: string, limit = 20, offset = 0): Promise<AccountingTransaction[]> {
    const result = await this.apiCall(userId, firmId, 'GET', '/BankTransactions');
    await auditLog(userId, firmId, 'ACCT_GET_TRANSACTIONS', 'Accounting', 'xero', { limit, offset });

    const transactions = (result.BankTransactions || []).slice(offset, offset + limit);
    return transactions.flatMap((bt: any) =>
      (bt.LineItems || []).map((li: any) => ({
        id: bt.BankTransactionID,
        provider: 'xero' as const,
        date: bt.Date || '',
        description: li.Description || bt.Reference || '',
        amount: li.LineAmount || 0,
        currency: bt.CurrencyCode || 'USD',
        type: bt.Type || 'SPEND',
        accountId: bt.BankAccount?.AccountID,
        rawData: bt,
      })),
    );
  }

  healthCheck(): AccountingHealthStatus {
    return {
      provider: 'xero',
      configured: this.configured,
      connected: this.configured,
      label: 'Xero',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ZohoClient — Zoho Books API
// ═══════════════════════════════════════════════════════════════════════════════

const ZOHO_ENV_VARS = ['ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET'];
const ZOHO_BASE = process.env.ZOHO_API_BASE || 'https://www.zohoapis.com/books/v3';

export class ZohoClient {
  private configured: boolean;
  private orgId: string | null = null;

  constructor() {
    const { configured } = gateStatus(ZOHO_ENV_VARS);
    this.configured = configured;

    if (this.configured) {
      registerOAuthProvider({
        id: 'zoho',
        name: 'Zoho Books',
        authorizeUrl: 'https://accounts.zoho.com/oauth/v2/auth',
        tokenUrl: 'https://accounts.zoho.com/oauth/v2/token',
        clientId: process.env.ZOHO_CLIENT_ID!,
        clientSecret: process.env.ZOHO_CLIENT_SECRET || '',
        redirectUri: `${process.env.API_URL || 'http://localhost:3001'}/api/v1/integrations/zoho/callback`,
        scopes: ['ZohoBooks.fullaccess.all'],
        extraAuthParams: { access_type: 'offline', prompt: 'consent' },
      });
      this.orgId = process.env.ZOHO_ORGANIZATION_ID || null;
      log.info('[Accounting] ZohoClient registered');
    } else {
      log.info('[Accounting] ZohoClient not configured (missing env vars)');
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
    if (!this.configured) throw notConfiguredError('Zoho Books');

    const tokens = await getValidToken(userId, 'zoho');
    if (!tokens) throw { code: 'ACCT_NOT_CONNECTED', message: 'Zoho Books not connected', status: 401 };

    const orgId = this.orgId;
    if (!orgId) throw { code: 'ACCT_NO_ORG', message: 'Zoho organization ID not configured', status: 500 };

    const url = new URL(`${ZOHO_BASE}${path}`);
    url.searchParams.set('organization_id', orgId);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const res = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Zoho-oauthtoken ${tokens.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ message: res.statusText }));
      log.error(`[Accounting] Zoho API error ${res.status}`, { path, error: errBody });
      throw { code: 'ACCT_API_ERROR', message: errBody?.message || 'Zoho Books API error', status: res.status };
    }

    return res.json() || "";
  }

  async getInvoices(userId: string, firmId: string, limit = 20, offset = 0): Promise<AccountingInvoice[]> {
    const result = await this.apiCall(userId, firmId, 'GET', '/invoices', undefined, {
      per_page: String(limit),
      page: String(Math.floor(offset / limit) + 1),
    });
    await auditLog(userId, firmId, 'ACCT_GET_INVOICES', 'Accounting', 'zoho', { limit, offset });

    return (result.invoices || []).map((r: any) => ({
      id: r.invoice_id,
      provider: 'zoho' as const,
      invoiceNumber: r.invoice_number || r.invoice_id,
      customerName: r.customer_name || '',
      amount: r.total || 0,
      currency: r.currency_code || 'USD',
      status: r.status || 'draft',
      dueDate: r.due_date,
      issuedDate: r.date,
      rawData: r,
    })) || "";
  }

  async getAccounts(userId: string, firmId: string, limit = 20, offset = 0): Promise<AccountingAccount[]> {
    const result = await this.apiCall(userId, firmId, 'GET', '/chartofaccounts', undefined, {
      per_page: String(limit),
      page: String(Math.floor(offset / limit) + 1),
    });
    await auditLog(userId, firmId, 'ACCT_GET_ACCOUNTS', 'Accounting', 'zoho', { limit, offset });

    return (result.chartofaccounts || []).map((r: any) => ({
      id: r.account_id,
      provider: 'zoho' as const,
      name: r.account_name || '',
      accountType: r.account_type || '',
      balance: r.current_balance,
      currency: r.currency_code || 'USD',
      rawData: r,
    })) || "";
  }

  async getTransactions(userId: string, firmId: string, limit = 20, offset = 0): Promise<AccountingTransaction[]> {
    // Use bank transactions as representative
    const result = await this.apiCall(userId, firmId, 'GET', '/banktransactions', undefined, {
      per_page: String(limit),
      page: String(Math.floor(offset / limit) + 1),
    });
    await auditLog(userId, firmId, 'ACCT_GET_TRANSACTIONS', 'Accounting', 'zoho', { limit, offset });

    return (result.banktransactions || []).map((r: any) => ({
      id: r.transaction_id,
      provider: 'zoho' as const,
      date: r.date || '',
      description: r.description || '',
      amount: r.amount || 0,
      currency: r.currency_code || 'USD',
      type: r.transaction_type || 'bank_transaction',
      accountId: r.account_id,
      rawData: r,
    }));
  }

  healthCheck(): AccountingHealthStatus {
    return {
      provider: 'zoho',
      configured: this.configured,
      connected: this.configured,
      label: 'Zoho Books',
    };
  }
}

// ── Singleton Instances ─────────────────────────────────────────────────────

export const quickbooks = new QuickBooksClient();
export const xero = new XeroClient();
export const zoho = new ZohoClient();

// ── Unified Accounting Queries ──────────────────────────────────────────────

export async function getInvoicesUnified(
  userId: string,
  firmId: string,
  limit = 20,
  offset = 0,
): Promise<{ invoices: AccountingInvoice[]; providers: string[]; errors: string[] }> {
  const allInvoices: AccountingInvoice[] = [];
  const providers: string[] = [];
  const errors: string[] = [];

  const clients = [
    { name: 'quickbooks', fetch: () => quickbooks.getInvoices(userId, firmId, limit, offset) },
    { name: 'xero', fetch: () => xero.getInvoices(userId, firmId, limit, offset) },
    { name: 'zoho', fetch: () => zoho.getInvoices(userId, firmId, limit, offset) },
  ];

  for (const client of clients) {
    try {
      const invoices = await client.fetch();
      if (invoices.length > 0) {
        providers.push(client.name);
        allInvoices.push(...invoices);
      }
    } catch (err: any) {
      if (err.code !== 'ACCT_NOT_CONNECTED' && err.code !== 'ACCT_NOT_CONFIGURED') {
        log.warn(`[Accounting] ${client.name} fetch failed`, { error: err.message });
        errors.push(`${client.name}: ${err.message}`);
      }
    }
  }

  await auditLog(userId, firmId, 'ACCT_UNIFIED_GET_INVOICES', 'Accounting', 'unified', {
    providers,
    resultCount: allInvoices.length,
    errors: errors.length > 0 ? errors : undefined,
  });

  return { invoices: allInvoices, providers, errors };
}

// ── Health Checks ───────────────────────────────────────────────────────────

export function accountingHealthCheck(): AccountingHealthStatus[] {
  return [
    quickbooks.healthCheck(),
    xero.healthCheck(),
    zoho.healthCheck(),
  ];
}