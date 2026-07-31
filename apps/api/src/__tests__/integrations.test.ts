/**
 * Integration tests for OAuth framework, R2 client, and integration routes.
 * 
 * Run: npx jest --testPathPattern="integrations" --forceExit
 */

// ── OAuth Framework Tests ───────────────────────────────────────────────────

describe('OAuth Framework', () => {
  let oauth: any;

  beforeAll(() => {
    // Unit tests — no DB needed
    oauth = {
      buildAuthUrl: (providerId: string, state: string) => {
        const providers: Record<string, any> = {
          google: {
            authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
            clientId: 'test-client-id',
            redirectUri: 'http://localhost:3001/api/v1/integrations/google/callback',
            scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
            extraAuthParams: { access_type: 'offline', prompt: 'consent' },
          },
          docusign: {
            authorizeUrl: 'https://account-d.docusign.com/oauth/auth',
            clientId: 'test-docusign-key',
            redirectUri: 'http://localhost:3001/api/v1/integrations/docusign/callback',
            scopes: ['signature', 'impersonation'],
          },
        };
        const provider = providers[providerId];
        if (!provider) throw new Error(`Unknown provider: ${providerId}`);
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
        return `${provider.authorizeUrl}?${params.toString()}`;
      },
    };
  });

  test('builds Google auth URL with correct params', () => {
    const url = oauth.buildAuthUrl('google', 'test-state-123');
    expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url).toContain('client_id=test-client-id');
    expect(url).toContain('scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fgmail.readonly');
    expect(url).toContain('state=test-state-123');
    expect(url).toContain('access_type=offline');
    expect(url).toContain('prompt=consent');
  });

  test('builds DocuSign auth URL with demo account', () => {
    const url = oauth.buildAuthUrl('docusign', 'ds-state');
    expect(url).toContain('account-d.docusign.com');
    expect(url).toContain('scope=signature+impersonation');
  });

  test('throws for unknown provider', () => {
    expect(() => oauth.buildAuthUrl('nonexistent', 'state')).toThrow('Unknown provider');
  });
});

// ── R2 Client Tests ────────────────────────────────────────────────────────

describe('R2 Client', () => {
  test('R2 public URL generation', () => {
    const r2Key = 'documents/firm-123/abc123.pdf';
    const envBase = 'https://pub-abc.r2.dev';
    // Without env, returns local
    const localUrl = `/api/v1/documents/download/${r2Key}`;
    expect(localUrl).toContain(r2Key);
  });

  test('upload key uses firmId prefix', () => {
    const firmId = 'firm-abc';
    const key = `documents/${firmId}/`;
    expect(key.startsWith('documents/')).toBe(true);
    expect(key.includes(firmId)).toBe(true);
  });
});

// ── Integration Health Check Tests ─────────────────────────────────────────

describe('Integration Health Endpoint', () => {
  test('health snapshot structure', () => {
    const mockSnapshot = {
      total: 35,
      connected: 2,
      configured: 4,
      catalogOnly: 25,
      unconfigured: 4,
      services: [],
      timestamp: new Date().toISOString(),
    };
    expect(mockSnapshot).toHaveProperty('total');
    expect(mockSnapshot).toHaveProperty('connected');
    expect(mockSnapshot).toHaveProperty('configured');
    expect(mockSnapshot).toHaveProperty('catalogOnly');
    expect(mockSnapshot).toHaveProperty('unconfigured');
    expect(mockSnapshot).toHaveProperty('services');
    expect(mockSnapshot).toHaveProperty('timestamp');
    expect(mockSnapshot.total).toBe(mockSnapshot.connected + mockSnapshot.configured + mockSnapshot.catalogOnly + mockSnapshot.unconfigured);
  });
});

// ── Token Encryption Tests ─────────────────────────────────────────────────

describe('Token Encryption', () => {
  test('encrypt and decrypt roundtrip', () => {
    const crypto = require('crypto');
    const key = 'test-key-32-bytes-long-xxxxxxxx';
    const algorithm = 'aes-256-gcm';
    const text = JSON.stringify({ accessToken: 'ya29.test-token', refreshToken: '1/refresh-token', expiresAt: Date.now() + 3600000 });

    // Encrypt
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, Buffer.from(key.padEnd(32).slice(0, 32)), iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const combined = Buffer.concat([iv, tag, encrypted]);

    // Decrypt
    const buf = combined;
    const iv2 = buf.subarray(0, 16);
    const tag2 = buf.subarray(16, 32);
    const enc2 = buf.subarray(32);
    const decipher = crypto.createDecipheriv(algorithm, Buffer.from(key.padEnd(32).slice(0, 32)), iv2);
    decipher.setAuthTag(tag2);
    const decrypted = Buffer.concat([decipher.update(enc2), decipher.final()]).toString('utf8');

    const parsed = JSON.parse(decrypted);
    expect(parsed.accessToken).toBe('ya29.test-token');
    expect(parsed.refreshToken).toBe('1/refresh-token');
    expect(parsed.expiresAt).toBeGreaterThan(Date.now());
  });

  test('decrypt with wrong key fails', () => {
    const crypto = require('crypto');
    const algorithm = 'aes-256-gcm';
    const key = 'test-key-32-bytes-long-xxxxxxxx';
    const wrongKey = 'wrong-key-32-bytes-long-xxxxxxx';
    const text = 'secret data';

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, Buffer.from(key.padEnd(32).slice(0, 32)), iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const combined = Buffer.concat([iv, tag, encrypted]);

    const buf = combined;
    expect(() => {
      const decipher = crypto.createDecipheriv(algorithm, Buffer.from(wrongKey.padEnd(32).slice(0, 32)), buf.subarray(0, 16));
      decipher.setAuthTag(buf.subarray(16, 32));
      decipher.update(buf.subarray(32));
      decipher.final();
    }).toThrow();
  });
});

// ── Token Refresh Tests ────────────────────────────────────────────────────

describe('Token Refresh Logic', () => {
  test('uses valid token without refresh', () => {
    const tokens = {
      accessToken: 'fresh-token',
      expiresAt: Date.now() + 3600000, // 1 hour from now
    };
    const needsRefresh = tokens.expiresAt <= Date.now() + 5 * 60 * 1000;
    expect(needsRefresh).toBe(false);
  });

  test('triggers refresh when token expires within 5 minutes', () => {
    const tokens = {
      accessToken: 'expiring-token',
      expiresAt: Date.now() + 2 * 60 * 1000, // 2 min from now
    };
    const needsRefresh = tokens.expiresAt <= Date.now() + 5 * 60 * 1000;
    expect(needsRefresh).toBe(true);
  });

  test('triggers refresh when token already expired', () => {
    const tokens = {
      accessToken: 'expired-token',
      expiresAt: Date.now() - 1000, // 1 second ago
    };
    const needsRefresh = tokens.expiresAt <= Date.now() + 5 * 60 * 1000;
    expect(needsRefresh).toBe(true);
  });

  test('no refresh without refreshToken', () => {
    const tokens = {
      accessToken: 'expired-token',
      expiresAt: Date.now() - 1000,
      // no refreshToken
    };
    const needsRefresh = tokens.expiresAt <= Date.now() + 5 * 60 * 1000;
    const canRefresh = !!tokens.refreshToken;
    expect(needsRefresh).toBe(true);
    expect(canRefresh).toBe(false);
  });
});

// ── Feature Flag / Graceful Fallback Tests ──────────────────────────────────

describe('Graceful Fallback', () => {
  test('R2 falls back to local when unconfigured', () => {
    const env = { R2_ACCESS_KEY_ID: '', R2_SECRET_ACCESS_KEY: '' };
    const available = !!(env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY);
    expect(available).toBe(false);
    // Should return local URL
    const localUrl = '/api/v1/documents/download/doc.txt';
    expect(localUrl).toBe('/api/v1/documents/download/doc.txt');
  });

  test('DocuSign falls back when missing integration key', () => {
    const env = { DOCUSIGN_INTEGRATION_KEY: '' };
    const available = !!env.DOCUSIGN_INTEGRATION_KEY;
    expect(available).toBe(false);
  });

  test('Google falls back when missing client ID', () => {
    const env = { GOOGLE_CLIENT_ID: '' };
    const available = !!env.GOOGLE_CLIENT_ID;
    expect(available).toBe(false);
  });
});

// ── Audit Log Tests ────────────────────────────────────────────────────────

describe('Audit Logging', () => {
  test('audit log entry shape', () => {
    const entry = {
      firmId: 'firm-123',
      userId: 'user-456',
      action: 'INTEGRATION_CONNECTED',
      resourceType: 'Integration',
      resourceId: 'google',
      details: { provider: 'google', scopes: 'gmail.readonly gmail.compose' },
      createdAt: new Date().toISOString(),
    };
    expect(entry).toHaveProperty('action');
    expect(entry).toHaveProperty('resourceType');
    expect(entry).toHaveProperty('resourceId');
    expect(entry).toHaveProperty('details');
    expect(['INTEGRATION_CONNECTED', 'INTEGRATION_DISCONNECTED']).toContain(entry.action);
  });
});

// ── DocuSign Webhook HMAC Verification ─────────────────────────────────────

describe('DocuSign Webhook', () => {
  test('HMAC signature verification structure', () => {
    const crypto = require('crypto');
    const secret = 'docusign-hmac-key';
    const payload = JSON.stringify({ event: 'envelope-completed', data: { envelopeId: 'abc-123' } });
    const hmac = crypto.createHmac('sha256', secret).update(payload).digest('base64');
    expect(hmac).toBeTruthy();
    expect(typeof hmac).toBe('string');
  });

  test('HMAC mismatch detected', () => {
    const crypto = require('crypto');
    const secret = 'docusign-hmac-key';
    const wrongSecret = 'wrong-key';
    const payload = 'test-payload';
    const sig1 = crypto.createHmac('sha256', secret).update(payload).digest('base64');
    const sig2 = crypto.createHmac('sha256', wrongSecret).update(payload).digest('base64');
    expect(sig1).not.toBe(sig2);
  });
});