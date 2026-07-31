/**
 * Shared OAuth 2.0 Framework — token exchange, refresh, secure storage.
 *
 * Reusable across ALL integrations (Google, DocuSign, Salesforce, etc.).
 * Each integration registers as a provider via registerOAuthProvider().
 *
 * Flow:
 *   1. GET  /api/v1/integrations/:provider/auth-url   →  redirect URI
 *   2. User authorizes at provider → redirected back to callback
 *   3. GET  /api/v1/integrations/:provider/callback     →  exchanges code for tokens
 *   4. Token stored encrypted in DB, refreshed automatically
 */
import { prisma } from '@counsel/database';
import crypto from 'crypto';

// Types

export interface OAuthProviderConfig {
  id: string;
  name: string;
  authorizeUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  extraAuthParams?: Record<string, string>;
  extraTokenParams?: Record<string, string>;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string;
  tokenType?: string;
  rawResponse?: any;
}

// Registry

const providers = new Map<string, OAuthProviderConfig>();

export function registerOAuthProvider(config: OAuthProviderConfig) {
  providers.set(config.id, config);
  console.log('[OAuth] Registered provider:', config.id, '-', config.name);
}

export function getProvider(id: string): OAuthProviderConfig | undefined {
  return providers.get(id);
}

export function listProviders(): OAuthProviderConfig[] {
  return Array.from(providers.values());
}

// Encryption

function getEncryptionKey(): Buffer {
  const key = process.env.OAUTH_ENCRYPTION_KEY || 'dev-encryption-key-change-in-production';
  return Buffer.from(key.padEnd(32).slice(0, 32));
}

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decrypt(data: string): string {
  const buf = Buffer.from(data, 'base64');
  const iv = buf.subarray(0, 16);
  const tag = buf.subarray(16, 32);
  const encrypted = buf.subarray(32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

// Token Storage

export async function storeTokens(
  userId: string,
  firmId: string,
  provider: string,
  tokens: OAuthTokens
): Promise<void> {
  const encrypted = encrypt(JSON.stringify(tokens));
  const record = await (prisma as any).oAuthToken?.findUnique({
    where: { userId_provider: { userId, provider } },
  });
  if (record) {
    await (prisma as any).oAuthToken?.update({
      where: { userId_provider: { userId, provider } },
      data: {
        tokensEncrypted: encrypted,
        expiresAt: tokens.expiresAt ? new Date(tokens.expiresAt) : null,
        scope: tokens.scope || null,
        updatedAt: new Date(),
      },
    });
  } else {
    await (prisma as any).oAuthToken?.create({
      data: {
        userId,
        firmId,
        provider,
        tokensEncrypted: encrypted,
        expiresAt: tokens.expiresAt ? new Date(tokens.expiresAt) : null,
        scope: tokens.scope || null,
      },
    });
  }
}

export async function getStoredTokens(userId: string, provider: string): Promise<OAuthTokens | null> {
  const record = await (prisma as any).oAuthToken?.findUnique({
    where: { userId_provider: { userId, provider } },
  });
  if (!record) return null;
  try {
    return JSON.parse(decrypt(record.tokensEncrypted));
  } catch {
    return null;
  }
}

export async function deleteTokens(userId: string, provider: string): Promise<void> {
  await (prisma as any).oAuthToken?.deleteMany({ where: { userId, provider } });
}

// Token Exchange

export async function exchangeCode(providerId: string, code: string): Promise<OAuthTokens> {
  const provider = providers.get(providerId);
  if (!provider) throw new Error('Unknown OAuth provider: ' + providerId);

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: provider.clientId,
    client_secret: provider.clientSecret,
    redirect_uri: provider.redirectUri,
    ...(provider.extraTokenParams || {}),
  });

  const res = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error('Token exchange failed (' + providerId + '): ' + res.status + ' ' + errText);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
    scope: data.scope,
    tokenType: data.token_type,
    rawResponse: data,
  };
}

// Token Refresh

export async function refreshTokens(providerId: string, refreshToken: string): Promise<OAuthTokens> {
  const provider = providers.get(providerId);
  if (!provider) throw new Error('Unknown OAuth provider: ' + providerId);

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: provider.clientId,
    client_secret: provider.clientSecret,
  });

  const res = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) throw new Error('Token refresh failed (' + providerId + '): ' + res.status);

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
    scope: data.scope,
    tokenType: data.token_type,
    rawResponse: data,
  };
}

// Get Valid Token (auto-refresh)

export async function getValidToken(userId: string, providerId: string): Promise<OAuthTokens | null> {
  const tokens = await getStoredTokens(userId, providerId);
  if (!tokens) return null;

  if (tokens.expiresAt && tokens.expiresAt > Date.now() + 5 * 60 * 1000) {
    return tokens;
  }

  if (tokens.refreshToken) {
    try {
      const fresh = await refreshTokens(providerId, tokens.refreshToken);
      await storeTokens(userId, 'unknown', providerId, fresh);
      return fresh;
    } catch (err) {
      console.error('[OAuth] Token refresh failed for ' + providerId + ':', (err as Error).message);
    }
  }
  return null;
}

// Auth URL Builder

export function buildAuthUrl(providerId: string, state: string): string {
  const provider = providers.get(providerId);
  if (!provider) throw new Error('Unknown OAuth provider: ' + providerId);

  const params = new URLSearchParams({
    client_id: provider.clientId,
    redirect_uri: provider.redirectUri,
    response_type: 'code',
    scope: provider.scopes.join(' '),
    state,
    access_type: 'offline',
    prompt: 'consent',
    ...(provider.extraAuthParams || {}),
  });

  return provider.authorizeUrl + '?' + params.toString();
}

// Health Check

export function oauthHealthCheck(providerId: string): {
  status: 'configured' | 'unconfigured';
  name?: string;
  scopes?: string[];
} {
  const provider = providers.get(providerId);
  if (!provider) return { status: 'unconfigured' };
  return {
    status: 'configured',
    name: provider.name,
    scopes: provider.scopes,
  };
}
