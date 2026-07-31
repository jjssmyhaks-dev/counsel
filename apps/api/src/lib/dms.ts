/**
 * DMS (Document Management System) Integration Clients — iManage Work, NetDocuments
 *
 * All clients are feature-gated: only activate when required env vars are set.
 * Graceful fallback when disabled.
 */
import {
  registerOAuthProvider,
  getValidToken,
  OAuthTokens,
} from './oauth';
import { prisma } from '@counsel/database';
import { log } from './logger';

// ── Types ───────────────────────────────────────────────────────────────────

export interface DMSDocument {
  id: string;
  provider: 'imanage' | 'netdocuments';
  name: string;
  title?: string;
  author?: string;
  lastModified?: string;
  size?: number;
  mimeType?: string;
  folder?: string;
  workspace?: string;
  rawData: Record<string, any>;
}

export interface DMSDocumentSearchParams {
  query?: string;
  folder?: string;
  workspace?: string;
  author?: string;
  limit?: number;
  offset?: number;
}

export interface DMSDocumentResult {
  documents: DMSDocument[];
  total: number;
  providers: string[];
}

export interface DMSHealthStatus {
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
    log.warn('[DMS] Audit log write failed', { error: (err as Error).message });
  }
}

// ── Feature Gate Helper ─────────────────────────────────────────────────────

function gateStatus(envVars: string[]): { configured: boolean; missing: string[] } {
  const missing = envVars.filter((v) => !process.env[v] || process.env[v]!.length === 0);
  return { configured: missing.length === 0, missing };
}

function notConfiguredError(provider: string): { code: string; message: string; status: number } {
  return {
    code: 'DMS_NOT_CONFIGURED',
    message: `${provider} is not configured. Set required environment variables.`,
    status: 503,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// iManageClient — iManage Work REST API v2
// ═══════════════════════════════════════════════════════════════════════════════

const IMANAGE_ENV_VARS = ['IMANAGE_CLIENT_ID', 'IMANAGE_CLIENT_SECRET', 'IMANAGE_BASE_URL'];

export class iManageClient {
  private configured: boolean;
  private baseUrl: string;

  constructor() {
    const { configured } = gateStatus(IMANAGE_ENV_VARS);
    this.configured = configured;
    this.baseUrl = process.env.IMANAGE_BASE_URL || '';

    if (this.configured) {
      registerOAuthProvider({
        id: 'imanage',
        name: 'iManage Work',
        authorizeUrl: `${this.baseUrl}/oauth2/authorize`,
        tokenUrl: `${this.baseUrl}/oauth2/token`,
        clientId: process.env.IMANAGE_CLIENT_ID!,
        clientSecret: process.env.IMANAGE_CLIENT_SECRET || '',
        redirectUri: `${process.env.API_URL || 'http://localhost:3001'}/api/v1/integrations/imanage/callback`,
        scopes: ['read', 'write'],
      });
      log.info('[DMS] iManageClient registered');
    } else {
      log.info('[DMS] iManageClient not configured (missing env vars)');
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
    if (!this.configured) throw notConfiguredError('iManage');

    const tokens = await getValidToken(userId, 'imanage');
    if (!tokens) throw { code: 'DMS_NOT_CONNECTED', message: 'iManage not connected', status: 401 };

    const url = new URL(`${this.baseUrl}/api/v2${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    // iManage uses a custom header for the library/database
    const headers: Record<string, string> = {
      Authorization: `Bearer ${tokens.accessToken}`,
      Accept: 'application/json',
    };

    if (process.env.IMANAGE_LIBRARY) {
      headers['X-Im-Library'] = process.env.IMANAGE_LIBRARY;
    }

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      if (res.status === 404) return { data: [] };
      const errText = await res.text();
      log.error(`[DMS] iManage API error ${res.status}`, { path, error: errText });
      throw { code: 'DMS_API_ERROR', message: `iManage API error: ${res.status}`, status: res.status };
    }

    return res.json();
  }

  async searchDocuments(
    userId: string,
    firmId: string,
    params: DMSDocumentSearchParams,
  ): Promise<DMSDocument[]> {
    const queryParams: Record<string, string> = {
      limit: String(params.limit || 20),
      offset: String(params.offset || 0),
    };

    if (params.query) queryParams.search_text = params.query;
    if (params.folder) queryParams.folder_id = params.folder;
    if (params.workspace) queryParams.workspace_id = params.workspace;

    const result = await this.apiCall(userId, firmId, 'GET', '/documents', undefined, queryParams);
    await auditLog(userId, firmId, 'DMS_SEARCH', 'DMS', 'imanage', { query: params });

    return (result.data || []).map((r: any) => ({
      id: r.id,
      provider: 'imanage' as const,
      name: r.name || '',
      title: r.title || r.name,
      author: r.author || r.creator?.name,
      lastModified: r.last_modified_date || r.updated,
      size: r.size,
      mimeType: r.mime_type || r.type,
      folder: r.container?.name || r.folder,
      workspace: r.workspace?.name,
      rawData: r,
    }));
  }

  async getDocument(userId: string, firmId: string, documentId: string): Promise<DMSDocument> {
    const result = await this.apiCall(userId, firmId, 'GET', `/documents/${documentId}`);
    await auditLog(userId, firmId, 'DMS_GET_DOCUMENT', 'DMS', documentId);

    const r = result.data || result;
    return {
      id: r.id,
      provider: 'imanage',
      name: r.name || '',
      title: r.title || r.name,
      author: r.author || r.creator?.name,
      lastModified: r.last_modified_date || r.updated,
      size: r.size,
      mimeType: r.mime_type || r.type,
      folder: r.container?.name || r.folder,
      workspace: r.workspace?.name,
      rawData: r,
    };
  }

  async uploadDocument(
    userId: string,
    firmId: string,
    name: string,
    content: Buffer,
    mimeType: string,
    folderId?: string,
  ): Promise<DMSDocument> {
    // iManage upload requires multipart with metadata
    const tokens = await getValidToken(userId, 'imanage');
    if (!tokens) throw { code: 'DMS_NOT_CONNECTED', message: 'iManage not connected', status: 401 };

    const headers: Record<string, string> = {
      Authorization: `Bearer ${tokens.accessToken}`,
    };

    if (process.env.IMANAGE_LIBRARY) {
      headers['X-Im-Library'] = process.env.IMANAGE_LIBRARY;
    }

    // Use iManage upload endpoint
    const formData = new FormData();
    formData.append('file', new Blob([content as any], { type: mimeType }), name);
    formData.append('name', name);
    if (folderId) formData.append('container_id', folderId);

    const url = `${this.baseUrl}/api/v2/documents`;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw { code: 'DMS_API_ERROR', message: `iManage upload failed: ${res.status}`, status: res.status };
    }

    const result = await res.json();
    const r = result.data || result;
    await auditLog(userId, firmId, 'DMS_UPLOAD', 'DMS', r.id, { name, folderId, mimeType });

    return {
      id: r.id,
      provider: 'imanage',
      name: r.name || name,
      title: r.title || r.name,
      lastModified: new Date().toISOString(),
      size: content.length,
      mimeType,
      folder: folderId,
      rawData: r,
    };
  }

  healthCheck(): DMSHealthStatus {
    return {
      provider: 'imanage',
      configured: this.configured,
      connected: this.configured,
      label: 'iManage Work',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// NetDocumentsClient — NetDocuments REST API
// ═══════════════════════════════════════════════════════════════════════════════

const NETDOCS_ENV_VARS = ['NETDOCUMENTS_CLIENT_ID', 'NETDOCUMENTS_CLIENT_SECRET'];

export class NetDocumentsClient {
  private configured: boolean;
  private apiBase = 'https://api.netdocuments.com';

  constructor() {
    const { configured } = gateStatus(NETDOCS_ENV_VARS);
    this.configured = configured;

    if (this.configured) {
      registerOAuthProvider({
        id: 'netdocuments',
        name: 'NetDocuments',
        authorizeUrl: 'https://api.netdocuments.com/oauth2/authorize',
        tokenUrl: 'https://api.netdocuments.com/oauth2/token',
        clientId: process.env.NETDOCUMENTS_CLIENT_ID!,
        clientSecret: process.env.NETDOCUMENTS_CLIENT_SECRET || '',
        redirectUri: `${process.env.API_URL || 'http://localhost:3001'}/api/v1/integrations/netdocuments/callback`,
        scopes: ['read', 'write', 'search'],
        extraAuthParams: { access_type: 'offline' },
      });
      log.info('[DMS] NetDocumentsClient registered');
    } else {
      log.info('[DMS] NetDocumentsClient not configured (missing env vars)');
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
    if (!this.configured) throw notConfiguredError('NetDocuments');

    const tokens = await getValidToken(userId, 'netdocuments');
    if (!tokens) throw { code: 'DMS_NOT_CONNECTED', message: 'NetDocuments not connected', status: 401 };

    const url = new URL(`${this.apiBase}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const res = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        Accept: 'application/json',
        'Content-Type': body ? 'application/json' : 'application/x-www-form-urlencoded',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const errText = await res.text();
      log.error(`[DMS] NetDocuments API error ${res.status}`, { path, error: errText });
      throw { code: 'DMS_API_ERROR', message: `NetDocuments API error: ${res.status}`, status: res.status };
    }

    return res.json();
  }

  async searchDocuments(
    userId: string,
    firmId: string,
    params: DMSDocumentSearchParams,
  ): Promise<DMSDocument[]> {
    const searchBody: any = {
      query: params.query || '*',
      searchOptions: {
        limit: params.limit || 20,
        offset: params.offset || 0,
        sort: [{ field: 'lastModified', direction: 'desc' }],
      },
    };

    if (params.author) {
      searchBody.filters = searchBody.filters || [];
      searchBody.filters.push({ field: 'author', operator: 'eq', value: params.author });
    }
    if (params.folder) {
      searchBody.filters = searchBody.filters || [];
      searchBody.filters.push({ field: 'folderId', operator: 'eq', value: params.folder });
    }

    const result = await this.apiCall(userId, firmId, 'POST', '/search/v2/documents', searchBody);
    await auditLog(userId, firmId, 'DMS_SEARCH', 'DMS', 'netdocuments', { query: params });

    return (result.results || result.documents || []).map((r: any) => ({
      id: r.id || r.documentId,
      provider: 'netdocuments' as const,
      name: r.name || r.title || '',
      title: r.title || r.name,
      author: r.author || r.creator?.name,
      lastModified: r.lastModified || r.lastModifiedDate,
      size: r.size || r.fileSize,
      mimeType: r.mimeType || r.contentType,
      folder: r.folderName || r.folder?.name,
      workspace: r.workspaceName || r.cabinet?.name,
      rawData: r,
    }));
  }

  async getDocument(userId: string, firmId: string, documentId: string): Promise<DMSDocument> {
    const result = await this.apiCall(userId, firmId, 'GET', `/documents/v2/${documentId}`);
    await auditLog(userId, firmId, 'DMS_GET_DOCUMENT', 'DMS', documentId);

    const r = result.document || result;
    return {
      id: r.id || r.documentId,
      provider: 'netdocuments',
      name: r.name || r.title || '',
      title: r.title || r.name,
      author: r.author || r.creator?.name,
      lastModified: r.lastModified || r.lastModifiedDate,
      size: r.size || r.fileSize,
      mimeType: r.mimeType || r.contentType,
      folder: r.folderName || r.folder?.name,
      workspace: r.workspaceName || r.cabinet?.name,
      rawData: r,
    };
  }

  async uploadDocument(
    userId: string,
    firmId: string,
    name: string,
    content: Buffer,
    mimeType: string,
    folderId?: string,
  ): Promise<DMSDocument> {
    const tokens = await getValidToken(userId, 'netdocuments');
    if (!tokens) throw { code: 'DMS_NOT_CONNECTED', message: 'NetDocuments not connected', status: 401 };

    const formData = new FormData();
    formData.append('file', new Blob([content as any], { type: mimeType }), name);
    if (folderId) formData.append('folderId', folderId);

    const url = `${this.apiBase}/documents/v2`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw { code: 'DMS_API_ERROR', message: `NetDocuments upload failed: ${res.status}`, status: res.status };
    }

    const result = await res.json();
    const r = result.document || result;
    await auditLog(userId, firmId, 'DMS_UPLOAD', 'DMS', r.id || r.documentId, { name, folderId, mimeType });

    return {
      id: r.id || r.documentId,
      provider: 'netdocuments',
      name: r.name || name,
      title: r.title || r.name,
      lastModified: new Date().toISOString(),
      size: content.length,
      mimeType,
      folder: folderId,
      rawData: r,
    };
  }

  healthCheck(): DMSHealthStatus {
    return {
      provider: 'netdocuments',
      configured: this.configured,
      connected: this.configured,
      label: 'NetDocuments',
    };
  }
}

// ── Singleton Instances ─────────────────────────────────────────────────────

export const imanage = new iManageClient();
export const netdocuments = new NetDocumentsClient();

// ── Unified DMS Search ──────────────────────────────────────────────────────

export async function dmsSearch(
  userId: string,
  firmId: string,
  params: DMSDocumentSearchParams,
): Promise<DMSDocumentResult> {
  const providers: string[] = [];
  const allDocs: DMSDocument[] = [];
  const errors: string[] = [];

  const clients = [
    { name: 'imanage', search: () => imanage.searchDocuments(userId, firmId, params) },
    { name: 'netdocuments', search: () => netdocuments.searchDocuments(userId, firmId, params) },
  ];

  for (const client of clients) {
    try {
      const docs = await client.search();
      if (docs.length > 0) {
        providers.push(client.name);
        allDocs.push(...docs);
      }
    } catch (err: any) {
      if (err.code !== 'DMS_NOT_CONNECTED' && err.code !== 'DMS_NOT_CONFIGURED') {
        log.warn(`[DMS] ${client.name} search failed`, { error: err.message });
        errors.push(`${client.name}: ${err.message}`);
      }
    }
  }

  await auditLog(userId, firmId, 'DMS_UNIFIED_SEARCH', 'DMS', 'unified', {
    params,
    providers,
    resultCount: allDocs.length,
    errors: errors.length > 0 ? errors : undefined,
  });

  return { documents: allDocs, total: allDocs.length, providers };
}

// ── Health Checks ───────────────────────────────────────────────────────────

export function dmsHealthCheck(): DMSHealthStatus[] {
  return [
    imanage.healthCheck(),
    netdocuments.healthCheck(),
  ];
}