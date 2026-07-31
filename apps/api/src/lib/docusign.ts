/**
 * DocuSign eSignature REST API client.
 *
 * Wraps the DocuSign REST API v2.1 for envelope creation, status checks,
 * signed-document downloads, voiding, and listing. Uses the shared OAuth
 * module (getValidToken) for automatic token acquisition and refresh.
 *
 * Demo vs Production: when DOCUSIGN_ACCOUNT_ID is unset / "demo", the
 * client targets account-d.docusign.com; otherwise account.docusign.com.
 *
 * When DOCUSIGN_INTEGRATION_KEY is missing the entire module is disabled
 * gracefully — every method short-circuits with a descriptive error.
 */
import { getValidToken } from './oauth';

// ── Types ───────────────────────────────────────────────────────────────────

export interface DocuSignSigner {
  name: string;
  email: string;
  roleName?: string;
  routingOrder?: number;
}

export interface DocuSignDocument {
  name: string;
  fileExtension?: string;
  documentBase64: string;            // raw base64-encoded document bytes
  documentId?: string;
}

export interface DocuSignTab {
  tabType: 'signHere' | 'dateSigned' | 'fullName' | 'text' | 'checkbox';
  pageNumber?: string;
  documentId?: string;
  xPosition?: string;
  yPosition?: string;
  anchorString?: string;
  value?: string;
}

export interface DocuSignRecipientTabs {
  signerEmail: string;
  tabs: DocuSignTab[];
}

export interface CreateEnvelopeInput {
  subject: string;
  emailBlurb?: string;
  documents: DocuSignDocument[];
  signers: DocuSignSigner[];
  tabs?: DocuSignRecipientTabs[];
  /** Optional: CC recipients who get a copy once the envelope is complete */
  carbonCopies?: { name: string; email: string }[];
  /** Optional: free-form metadata stored on the envelope */
  envelopeCustomFields?: Record<string, string>;
}

export interface EnvelopeStatus {
  envelopeId: string;
  status: 'sent' | 'delivered' | 'completed' | 'declined' | 'voided' | 'created' | string;
  statusChangedDateTime: string;
  sentDateTime?: string;
  completedDateTime?: string;
  voidedDateTime?: string;
  signers: {
    name: string;
    email: string;
    status: string;
  }[];
}

export interface EnvelopeListItem {
  envelopeId: string;
  status: string;
  subject: string;
  createdDateTime: string;
  sentDateTime?: string;
  statusChangedDateTime?: string;
}

export type DocuSignApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

// ── Config ──────────────────────────────────────────────────────────────────

let _integrationKey = '';
let _accountId = '';
let _isDemo = true;
let _docusignAvailable = false;

export function initDocuSign() {
  _integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY || '';
  _accountId = process.env.DOCUSIGN_ACCOUNT_ID || '';
  _isDemo = !_accountId || _accountId === 'demo';

  if (!_integrationKey) {
    console.warn('[DocuSign] DOCUSIGN_INTEGRATION_KEY not set — DocuSign client disabled');
    _docusignAvailable = false;
    return;
  }

  _docusignAvailable = true;
  console.log(`[DocuSign] Initialized — ${_isDemo ? 'DEMO' : 'PRODUCTION'} mode`);
}

export function isDocuSignAvailable(): boolean {
  return _docusignAvailable;
}

// ── Base URL ────────────────────────────────────────────────────────────────

function baseUrl(): string {
  return `https://${_isDemo ? 'account-d' : 'account'}.docusign.com`;
}

function restApiBase(): string {
  return `${baseUrl()}/restapi/v2.1`;
}

// ── Resolve account ID ──────────────────────────────────────────────────────

async function resolveAccountId(accessToken: string): Promise<string> {
  if (_accountId && _accountId !== 'demo') return _accountId;

  // Look up the user's default account
  const res = await fetch(`${baseUrl()}/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`DocuSign userinfo failed: ${res.status}`);
  const data = await res.json();

  const account = data.accounts?.find((a: any) => a.is_default) ?? data.accounts?.[0];
  if (!account?.account_id) throw new Error('No DocuSign account found for this user');
  return account.account_id as string;
}

// ── Low-level authenticated fetch ───────────────────────────────────────────

async function docusignFetch(
  userId: string,
  path: string,
  method: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: any }> {
  const tokens = await getValidToken(userId, 'docusign');
  if (!tokens) {
    throw new Error('DocuSign not connected — no valid token found');
  }

  const accountId = await resolveAccountId(tokens.accessToken);
  const url = `${restApiBase()}/accounts/${accountId}${path}`;

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

// ── Client class ────────────────────────────────────────────────────────────

export class DocuSignClient {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Create a signing envelope with documents, recipients, and optional tabs.
   */
  async createEnvelope(input: CreateEnvelopeInput): Promise<DocuSignApiResult<EnvelopeStatus>> {
    if (!_docusignAvailable) {
      return { ok: false, error: 'DocuSign integration is not configured', code: 'DOCUSIGN_UNAVAILABLE' };
    }

    try {
      const signers = input.signers.map((s, i) => ({
        email: s.email,
        name: s.name,
        roleName: s.roleName || `signer${i + 1}`,
        recipientId: `${i + 1}`,
        routingOrder: s.routingOrder?.toString() || '1',
        tabs: (input.tabs || [])
          .filter((t) => t.signerEmail === s.email)
          .reduce(
            (acc, rt) => {
              for (const tab of rt.tabs) {
                const list: any[] = acc[tab.tabType] || [];
                list.push({
                  pageNumber: tab.pageNumber || '1',
                  documentId: tab.documentId || '1',
                  xPosition: tab.xPosition || '100',
                  yPosition: tab.yPosition || '100',
                  anchorString: tab.anchorString,
                  value: tab.value,
                });
                acc[tab.tabType] = list;
              }
              return acc;
            },
            {} as Record<string, any[]>,
          ),
      }));

      const carbonCopies = (input.carbonCopies || []).map((cc, i) => ({
        email: cc.email,
        name: cc.name,
        roleName: `cc${i + 1}`,
        recipientId: `${signers.length + i + 1}`,
        routingOrder: (signers.length + i + 1).toString(),
      }));

      const envelopeDef: any = {
        emailSubject: input.subject,
        emailBlurb: input.emailBlurb || 'Please review and sign this document.',
        documents: input.documents.map((d, i) => ({
          documentBase64: d.documentBase64,
          documentId: d.documentId || `${i + 1}`,
          name: d.name,
          fileExtension: d.fileExtension || 'pdf',
        })),
        recipients: {
          signers,
          ...(carbonCopies.length > 0 ? { carbonCopies } : {}),
        },
        status: 'sent',
      };

      if (input.envelopeCustomFields) {
        envelopeDef.customFields = {
          textCustomFields: Object.entries(input.envelopeCustomFields).map(([name, value]) => ({
            name,
            value,
          })),
        };
      }

      const result = await docusignFetch(this.userId, '/envelopes', 'POST', envelopeDef);

      if (!result.ok) {
        return {
          ok: false,
          error: result.data?.message || `DocuSign API error (${result.status})`,
          code: result.data?.errorCode || 'DOCUSIGN_API_ERROR',
        };
      }

      // Immediately fetch status to return full envelope info
      const envelopeId = result.data.envelopeId;
      return await this.getEnvelopeStatus(envelopeId);
    } catch (err) {
      return { ok: false, error: (err as Error).message, code: 'DOCUSIGN_REQUEST_FAILED' };
    }
  }

  /**
   * Get envelope status by ID.
   */
  async getEnvelopeStatus(envelopeId: string): Promise<DocuSignApiResult<EnvelopeStatus>> {
    if (!_docusignAvailable) {
      return { ok: false, error: 'DocuSign integration is not configured', code: 'DOCUSIGN_UNAVAILABLE' };
    }

    try {
      const result = await docusignFetch(this.userId, `/envelopes/${envelopeId}`, 'GET');

      if (!result.ok) {
        return {
          ok: false,
          error: result.data?.message || `DocuSign API error (${result.status})`,
          code: result.data?.errorCode || 'DOCUSIGN_API_ERROR',
        };
      }

      const raw = result.data;
      const signers = (raw.recipients?.signers || []).map((s: any) => ({
        name: s.name,
        email: s.email,
        status: s.status,
      }));

      return {
        ok: true,
        data: {
          envelopeId: raw.envelopeId,
          status: raw.status,
          statusChangedDateTime: raw.statusChangedDateTime,
          sentDateTime: raw.sentDateTime,
          completedDateTime: raw.completedDateTime,
          voidedDateTime: raw.voidedDateTime,
          signers,
        },
      };
    } catch (err) {
      return { ok: false, error: (err as Error).message, code: 'DOCUSIGN_REQUEST_FAILED' };
    }
  }

  /**
   * Download the completed signed document as a base64-encoded PDF.
   */
  async getSignedDocument(envelopeId: string): Promise<DocuSignApiResult<{ documentBase64: string; contentType: string }>> {
    if (!_docusignAvailable) {
      return { ok: false, error: 'DocuSign integration is not configured', code: 'DOCUSIGN_UNAVAILABLE' };
    }

    try {
      const tokens = await getValidToken(this.userId, 'docusign');
      if (!tokens) {
        return { ok: false, error: 'DocuSign not connected — no valid token found', code: 'DOCUSIGN_NOT_CONNECTED' };
      }

      const accountId = await resolveAccountId(tokens.accessToken);

      // DocuSign combines all documents into a single PDF
      const url = `${restApiBase()}/accounts/${accountId}/envelopes/${envelopeId}/documents/combined`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return {
          ok: false,
          error: errData.message || `Failed to download document (${res.status})`,
          code: errData.errorCode || 'DOCUSIGN_DOWNLOAD_FAILED',
        };
      }

      const buffer = await res.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');

      return {
        ok: true,
        data: {
          documentBase64: base64,
          contentType: res.headers.get('content-type') || 'application/pdf',
        },
      };
    } catch (err) {
      return { ok: false, error: (err as Error).message, code: 'DOCUSIGN_DOWNLOAD_FAILED' };
    }
  }

  /**
   * Void an in-progress envelope.
   */
  async voidEnvelope(envelopeId: string, reason?: string): Promise<DocuSignApiResult<EnvelopeStatus>> {
    if (!_docusignAvailable) {
      return { ok: false, error: 'DocuSign integration is not configured', code: 'DOCUSIGN_UNAVAILABLE' };
    }

    try {
      const body = {
        status: 'voided',
        voidedReason: reason || 'Voided by Counsel platform user',
      };

      const result = await docusignFetch(
        this.userId,
        `/envelopes/${envelopeId}`,
        'PUT',
        body,
      );

      if (!result.ok) {
        return {
          ok: false,
          error: result.data?.message || `DocuSign API error (${result.status})`,
          code: result.data?.errorCode || 'DOCUSIGN_API_ERROR',
        };
      }

      return await this.getEnvelopeStatus(envelopeId);
    } catch (err) {
      return { ok: false, error: (err as Error).message, code: 'DOCUSIGN_REQUEST_FAILED' };
    }
  }

  /**
   * List envelopes for the authenticated user's account.
   */
  async listEnvelopes(options?: {
    fromDate?: string; // ISO 8601
    toDate?: string;
    status?: string;
    searchText?: string;
    limit?: number;
  }): Promise<DocuSignApiResult<{ envelopes: EnvelopeListItem[]; total: number }>> {
    if (!_docusignAvailable) {
      return { ok: false, error: 'DocuSign integration is not configured', code: 'DOCUSIGN_UNAVAILABLE' };
    }

    try {
      const params = new URLSearchParams();
      if (options?.fromDate) params.set('from_date', options.fromDate);
      if (options?.toDate) params.set('to_date', options.toDate);
      if (options?.status) params.set('status', options.status);
      if (options?.searchText) params.set('search_text', options.searchText);

      const limit = options?.limit || 50;
      const path = `/envelopes?${params.toString()}`;

      const result = await docusignFetch(this.userId, path, 'GET');

      if (!result.ok) {
        return {
          ok: false,
          error: result.data?.message || `DocuSign API error (${result.status})`,
          code: result.data?.errorCode || 'DOCUSIGN_API_ERROR',
        };
      }

      const raw = result.data;
      const envelopes: EnvelopeListItem[] = (raw.envelopes || []).slice(0, limit).map((e: any) => ({
        envelopeId: e.envelopeId,
        status: e.status,
        subject: e.emailSubject || e.subject || '',
        createdDateTime: e.createdDateTime,
        sentDateTime: e.sentDateTime,
        statusChangedDateTime: e.statusChangedDateTime,
      }));

      return {
        ok: true,
        data: {
          envelopes,
          total: raw.resultSetSize || envelopes.length,
        },
      };
    } catch (err) {
      return { ok: false, error: (err as Error).message, code: 'DOCUSIGN_REQUEST_FAILED' };
    }
  }

  /**
   * Verify a DocuSign Connect webhook HMAC signature.
   * Uses the HMAC key configured in DOCUSIGN_HMAC_KEY.
   */
  static verifyWebhookSignature(payload: string, signature: string): boolean {
    const hmacKey = process.env.DOCUSIGN_HMAC_KEY;
    if (!hmacKey) {
      console.warn('[DocuSign] HMAC verification skipped — DOCUSIGN_HMAC_KEY not set');
      return true; // passthrough when not configured
    }

    try {
      const crypto = require('crypto');
      const computed = crypto.createHmac('sha256', hmacKey).update(payload).digest('base64');
      return crypto.timingSafeEqual
        ? crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature))
        : computed === signature;
    } catch (err) {
      console.error('[DocuSign] HMAC verification error:', (err as Error).message);
      return false;
    }
  }
}

// ── Module init on import ───────────────────────────────────────────────────
initDocuSign();
