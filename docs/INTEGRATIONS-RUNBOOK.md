# Counsel Platform — Operations Runbook

> Version 2.0 · Updated 2026-07-31  
> For operations team, SRE, and on-call engineers.

---

## 1. Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│  Chrome Extension (Manifest V3)                        │
│  Gmail OAuth · Compose · Read · Contract Analysis      │
└───────────────┬────────────────────────────────────────┘
                │ REST / OAuth
┌───────────────▼────────────────────────────────────────┐
│  Next.js Web App (Cloudflare Pages)                    │
│  Port 3000 · React 18 · Server Components              │
└───────────────┬────────────────────────────────────────┘
                │
┌───────────────▼────────────────────────────────────────┐
│  Express API (Oracle Cloud A1)                         │
│  Port 3001 · Node.js 22 · Prisma ORM                   │
│  ┌─────────────────────────────────────────┐           │
│  │  OAuth Framework (shared)               │           │
│  │  • Google Workspace                     │           │
│  │  • Microsoft 365                        │           │
│  │  • DocuSign eSignature                  │           │
│  │  • Salesforce CRM                       │           │
│  │  • QuickBooks Online                    │           │
│  │  • Slack · Zoom · more                  │           │
│  └─────────────────────────────────────────┘           │
└───────────────┬────────────────────────────────────────┘
                │
    ┌───────────┼───────────┬──────────────┐
    ▼           ▼           ▼              ▼
┌────────┐ ┌───────┐ ┌───────────┐ ┌──────────┐
│ Neon   │ │R2     │ │17 MCP     │ │FastAPI AI│
│ PG     │ │(Docs) │ │Servers    │ │(CrewAI)  │
│ +vector│ │       │ │Port 87xx  │ │Port 8000 │
└────────┘ └───────┘ └───────────┘ └──────────┘
```

---

## 2. Environment Variables Reference

### Core Services (Required)
| Variable | Purpose | Example |
|----------|---------|---------|
| `DATABASE_URL` | PostgreSQL (Neon) | `postgresql://user:pw@host/db` |
| `JWT_SECRET` | JWT signing key | `openssl rand -hex 32` |
| `AI_SERVICE_URL` | CrewAI Python service | `http://localhost:8000` |
| `CORS_ORIGIN` | Allowed frontend origins | `https://app.counsel.ai` |

### Billing & Auth (Already Configured)
| Variable | Service |
|----------|---------|
| `STRIPE_SECRET_KEY` | Stripe billing |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification |
| `WORKOS_API_KEY` | WorkOS SSO |
| `WORKOS_CLIENT_ID` | WorkOS SSO |
| `RESEND_API_KEY` | Email delivery |
| `CF_ACCOUNT_ID` | Cloudflare AI |
| `CF_API_TOKEN` | Cloudflare AI |

### File Storage (R2)
| Variable | Required? | Description |
|----------|-----------|-------------|
| `R2_ACCESS_KEY_ID` | Yes for prod | R2 bucket access key |
| `R2_SECRET_ACCESS_KEY` | Yes for prod | R2 secret key |
| `R2_ENDPOINT` | Yes for prod | `https://<id>.r2.cloudflarestorage.com` |
| `R2_BUCKET` | Yes for prod | Bucket name (e.g. `counsel-documents`) |
| `R2_PUBLIC_URL` | Recommended | Public URL for documents |

### OAuth Encryption
| Variable | Description |
|----------|-------------|
| `OAUTH_ENCRYPTION_KEY` | 32-byte key for token encryption at rest. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

### Google Workspace Integration
| Variable | Required? | Description |
|----------|-----------|-------------|
| `GOOGLE_CLIENT_ID` | Yes for Gmail | OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | Yes for Gmail | OAuth 2.0 Client Secret |

**OAuth Consent Screen Setup:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Configure OAuth consent screen (External, verification optional for dev)
3. Create OAuth 2.0 Client ID → Web Application
4. Authorized redirect URI: `https://api.counsel.ai/api/v1/integrations/google/callback`
5. Enable APIs: Gmail, Google Calendar, Google Drive

### Microsoft 365 Integration
| Variable | Required? |
|----------|-----------|
| `MICROSOFT_CLIENT_ID` | Yes for Outlook |
| `MICROSOFT_CLIENT_SECRET` | Yes for Outlook |

**Azure AD Setup:**
1. [Azure Portal](https://portal.azure.com) → App registrations
2. Redirect URI: `https://api.counsel.ai/api/v1/integrations/microsoft/callback`
3. API permissions: Mail.Read, Mail.Send, Calendars.ReadWrite, Files.Read.All

### DocuSign Integration
| Variable | Required? | Description |
|----------|-----------|-------------|
| `DOCUSIGN_INTEGRATION_KEY` | Yes | Integration Key (Client ID) |
| `DOCUSIGN_SECRET_KEY` | Yes | Secret Key |
| `DOCUSIGN_ACCOUNT_ID` | Yes | Account ID (or `demo`) |
| `DOCUSIGN_HMAC_KEY` | For webhooks | HMAC signing key for Connect |
| `DOCUSIGN_ENVIRONMENT` | Default: `demo` | `demo` or `production` |

**Setup:**
1. [DocuSign Developer Center](https://developers.docusign.com/) → Create App
2. Generate RSA keypair for JWT grant
3. Redirect URI: `https://api.counsel.ai/api/v1/integrations/docusign/callback`
4. Webhook URL (Connect): `https://api.counsel.ai/api/v1/docusign/webhook`

### Salesforce CRM
| Variable | Required? |
|----------|-----------|
| `SALESFORCE_CLIENT_ID` | Yes for CRM integration |
| `SALESFORCE_CLIENT_SECRET` | Yes for CRM integration |

### QuickBooks Online
| Variable | Required? |
|----------|-----------|
| `QUICKBOOKS_CLIENT_ID` | Yes for accounting |
| `QUICKBOOKS_CLIENT_SECRET` | Yes for accounting |

### Slack
| Variable | Required? |
|----------|-----------|
| `SLACK_CLIENT_ID` | Yes for Slack bot |
| `SLACK_CLIENT_SECRET` | Yes for Slack bot |

### Zoom
| Variable | Required? |
|----------|-----------|
| `ZOOM_CLIENT_ID` | Yes for Zoom meetings |
| `ZOOM_CLIENT_SECRET` | Yes for Zoom meetings |

---

## 3. Integration Health Monitoring

### Dashboard
- **URL:** `/dashboard/admin/integrations-health`
- **What it shows:** Real-time status for all 30+ services
- **Refresh:** Manual button; consider adding auto-refresh via cron
- **Data source:** `GET /api/v1/integrations/health`

### Key Metrics
| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| Connected services | OAuth tokens valid | < 1 (if configured) |
| R2 health | Bucket reachable | Any error |
| Token freshness | Expiry within 5 min | Auto-refresh |

### Monitoring API
```
GET /api/v1/integrations/health
→ { total: 35, connected: 2, configured: 4, catalogOnly: 25, unconfigured: 4, services: [...], timestamp }
```

---

## 4. Troubleshooting

### R2 Storage — Uploads Failing

**Symptom:** Documents return local URLs, not R2 URLs.

**Checklist:**
1. Verify `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` are set → `echo $R2_ACCESS_KEY_ID`
2. Verify `R2_ENDPOINT` is correct → `https://<account-id>.r2.cloudflarestorage.com`
3. Check bucket exists → Cloudflare Dashboard → R2 → Buckets
4. CORS on bucket → Allow `https://app.counsel.ai`
5. Check API logs → `grep R2 /var/log/counsel/api.log`

### OAuth Token Exchange Fails

**Symptom:** "Token exchange failed" in logs.

**Checklist:**
1. Verify client ID and secret match the provider console
2. Verify redirect URI matches exactly (including trailing slash)
3. Check the provider's developer console for rate limits
4. Verify `OAUTH_ENCRYPTION_KEY` hasn't changed (rotating invalidates stored tokens)
5. Clear stored tokens → `DELETE FROM oauth_tokens WHERE provider = 'google'`

### DocuSign — Envelope Creation Fails

**Symptom:** 401 or "invalid_grant" from DocuSign.

**Checklist:**
1. Verify `DOCUSIGN_ENVIRONMENT` → `demo` for dev, `production` for prod
2. Verify `DOCUSIGN_ACCOUNT_ID` — use account ID (not name)
3. Tokens expire after 8 hours in DocuSign; auto-refresh should handle this
4. Check RSA keypair hasn't expired
5. Re-run OAuth consent flow from integrations page

### Token Refresh Issues

**Symptom:** "Token refresh failed" in logs.

**Checklist:**
1. Google: Access tokens last 1 hour; refresh tokens last until revoked
2. DocuSign: Tokens expire based on consent; may need re-authorization
3. Microsoft: Refresh tokens may expire after 90 days of inactivity
4. Force re-auth → Disconnect/reconnect from integrations page

---

## 5. Rollback Procedures

### Disable R2 (Fall Back to Local Storage)
```bash
# Remove or comment out these env vars:
unset R2_ACCESS_KEY_ID
unset R2_SECRET_ACCESS_KEY
# Restart API — it will auto-detect and fall back to local URLs
pm2 restart counsel-api
```
**Impact:** File uploads go to local disk instead of R2. Existing R2 URLs remain accessible if bucket still exists.

### Disable Individual Integration
Each integration is feature-gated by its env var. To disable:
```bash
# Remove the env var and restart
unset GOOGLE_CLIENT_ID
pm2 restart counsel-api
```

### Disable All Integrations (Rollback to Core Platform)
```bash
# Set this env var to disable the integrations module entirely
INTEGRATIONS_ENABLED=false
pm2 restart counsel-api
```

### Rollback OAuth Encryption Key
```bash
# If the encryption key was rotated, all stored tokens become unreadable.
# 1. Set back the old key
OAUTH_ENCRYPTION_KEY=<old-key>
# 2. Restart
pm2 restart counsel-api
# 3. Users will need to re-authorize if tokens can't be decrypted
#    (gracefully handled — they'll be prompted to reconnect)
```

### Database Rollback (Integration Tables)
```sql
-- To clean slate and have users re-authorize:
TRUNCATE TABLE oauth_tokens;
TRUNCATE TABLE docusign_envelopes;
TRUNCATE TABLE integration_health_status;
```

---

## 6. Security Review Checklist

- [ ] No secrets hardcoded — all keys from env vars ✓
- [ ] OAuth tokens encrypted at rest with AES-256-GCM ✓
- [ ] Minimal OAuth scopes — only what's needed ✓
- [ ] Redirect URIs validated (exact match) ✓
- [ ] HMAC verification for DocuSign webhooks ✓
- [ ] State parameter (CSRF protection) in OAuth flows ✓
- [ ] Audit logs for all integration actions ✓
- [ ] Token auto-refresh with 5-minute buffer ✓
- [ ] Graceful fallback when credentials missing ✓
- [ ] Rate limiting on all API routes ✓

---

## 7. API Endpoints Reference

### Integrations
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/integrations` | Yes | List all available integrations |
| GET | `/api/v1/integrations/:provider/status` | Yes | Check if connected |
| GET | `/api/v1/integrations/:provider/auth-url` | Yes | Start OAuth flow |
| GET | `/api/v1/integrations/:provider/callback` | No | OAuth callback |
| POST | `/api/v1/integrations/:provider/disconnect` | Yes | Disconnect |
| GET | `/api/v1/integrations/health` | No* | Health snapshot |

### DocuSign
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/docusign/envelopes` | Yes | Create envelope |
| GET | `/api/v1/docusign/envelopes` | Yes | List envelopes |
| GET | `/api/v1/docusign/envelopes/:id` | Yes | Get envelope status |
| GET | `/api/v1/docusign/envelopes/:id/document` | Yes | Download signed doc |
| POST | `/api/v1/docusign/envelopes/:id/void` | Yes | Void envelope |
| POST | `/api/v1/docusign/webhook` | No* | Connect webhook |

### Google Workspace (Proxy)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/google/gmail/messages` | Yes | List Gmail messages |
| GET | `/api/v1/google/gmail/messages/:id` | Yes | Get message details |
| POST | `/api/v1/google/gmail/send` | Yes | Send email |
| GET | `/api/v1/google/calendar/events` | Yes | List calendar events |
| GET | `/api/v1/google/drive/files` | Yes | List Drive files |

---

## 8. Common Operations

### Health Check
```bash
curl -s http://localhost:3001/api/v1/integrations/health | jq '.connected, .configured, .total'
```

### Force Token Refresh (Testing)
```bash
# Trigger token refresh by accessing a Google API endpoint
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/v1/google/gmail/messages
```

### Check R2 Connectivity
```bash
# The R2 client logs on init
grep "\[R2\]" /var/log/counsel/api.log
# Expected: "[R2] Client initialized — bucket: counsel-documents"
```

### View Audit Logs for Integrations
```sql
SELECT * FROM audit_logs
WHERE resource_type = 'Integration'
ORDER BY created_at DESC
LIMIT 20;
```

---

## 9. Deployment Checklist

### Before Deploy
- [ ] All env vars set in production (see Section 2)
- [ ] OAuth redirect URIs registered with providers
- [ ] R2 bucket created with correct CORS
- [ ] DocuSign webhook URL configured in DocuSign Connect
- [ ] Google Cloud APIs enabled
- [ ] `OAUTH_ENCRYPTION_KEY` set and backed up securely
- [ ] Integration health dashboard accessible to admins

### After Deploy
- [ ] Run `GET /api/v1/integrations/health` — verify counts
- [ ] Connect to each provider from integrations page
- [ ] Verify token storage in DB → `SELECT * FROM oauth_tokens`
- [ ] Test file upload with R2
- [ ] Trigger DocuSign webhook test from DocuSign Connect
- [ ] Check audit logs for integration actions

### Rollback Decision Tree
```
Integration broken?
├─ One provider failing? → Disable that env var, restart API
├─ R2 uploads failing? → Remove R2_ACCESS_KEY_ID, restart API (falls back to local)
├─ OAuth flow broken? → Check OAUTH_ENCRYPTION_KEY, check redirect URIs
└─ Everything broken? → Set INTEGRATIONS_ENABLED=false, restart API
```
