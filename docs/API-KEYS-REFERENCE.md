# Counsel — Complete API Keys & Integration Reference

## Overview

Counsel requires the following API keys and credentials. Not all are required at launch — see the "Required vs Optional" matrix below.

---

## 🔑 Required Keys (App Won't Work Without These)

| # | Key | Where Used | How to Get | Cost |
|---|-----|-----------|------------|------|
| 1 | `DATABASE_URL` | PostgreSQL connection | [Neon](https://neon.tech) — Free 0.5 GB | Free |
| 2 | `JWT_SECRET` | JWT token signing | Auto-generated in dev; set a random 64-char string in production | Free |
| 3 | `CLOUDFLARE_ACCOUNT_ID` | LLM + Embeddings | [Cloudflare Workers AI](https://workers.cloudflare.com) | Free tier (10K tokens/day) |
| 4 | `CLOUDFLARE_API_TOKEN` | Cloudflare API auth | Cloudflare Dashboard → My Profile → API Tokens | Free |

---

## 🤖 AI Service Keys (For LLM + Embeddings)

| # | Key | Service | Notes |
|---|-----|---------|-------|
| 5 | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Workers AI | Used by `services/ai/src/config.py` for LLM + embeddings |
| 6 | `CLOUDFLARE_API_TOKEN` | Cloudflare Workers AI | Needs Workers AI permissions |
| 7 | `AI_SERVICE_URL` | FastAPI AI service | Default: `http://localhost:8000` |

### Cloudflare Workers AI Models Used

| Model | ID | Use |
|-------|-----|-----|
| Llama 4 Scout (17B) | `@cf/meta/llama-4-scout-17b-16e-instruct` | Default: extraction, validation |
| Llama 3.3 70B | `@cf/meta/llama-3.3-70b-instruct` | Power: drafting, synthesis |
| DeepSeek R1 | `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b` | Reasoning: research, risk |
| BGE Embeddings | `@cf/baai/bge-base-en-v1.5` | 768-dim vector embeddings |

---

## 💳 Billing & Payments

### Stripe (Global Customers)

| # | Key | Service | How to Get |
|---|-----|---------|------------|
| 8 | `STRIPE_SECRET_KEY` | Stripe API | [Stripe Dashboard](https://dashboard.stripe.com/apikeys) |
| 9 | `STRIPE_WEBHOOK_SECRET` | Stripe webhooks | Stripe Dashboard → Webhooks → Signing secret |
| 10 | `STRIPE_PRICE_ID` | Subscription price | Stripe Dashboard → Products → Price ID |

### Razorpay (Indian Customers)

| # | Key | Service | How to Get |
|---|-----|---------|------------|
| 11 | `RAZORPAY_KEY_ID` | Razorpay API | [Razorpay Dashboard](https://dashboard.razorpay.com/app/keys) |
| 12 | `RAZORPAY_KEY_SECRET` | Razorpay API | Razorpay Dashboard → API Keys |
| 13 | `RAZORPAY_PLAN_ID` | Subscription plan | Razorpay Dashboard → Subscriptions → Plans |

---

## 📧 Email (Resend)

| # | Key | Service | How to Get |
|---|-----|---------|------------|
| 14 | `RESEND_API_KEY` | Transactional email | [Resend](https://resend.com) — Free 3K emails/month |

**Used for:** Welcome emails, email verification, matter notifications, document shared alerts.

---

## 🔐 Auth & SSO (WorkOS)

| # | Key | Service | How to Get |
|---|-----|---------|------------|
| 15 | `WORKOS_API_KEY` | WorkOS SSO | [WorkOS Dashboard](https://dashboard.workos.com/api-keys) |
| 16 | `WORKOS_CLIENT_ID` | WorkOS SSO | WorkOS Dashboard → Applications |
| 17 | `WORKOS_REDIRECT_URI` | SSO callback | Set to `https://your-domain.com/api/v1/auth/callback` |

**Used for:** SAML/OIDC SSO, SCIM directory sync, organization management.

---

## 📁 Document Storage (Cloudflare R2)

| # | Key | Service | How to Get |
|---|-----|---------|------------|
| 18 | `R2_ACCOUNT_ID` | Cloudflare R2 | Cloudflare Dashboard → R2 |
| 19 | `R2_ACCESS_KEY_ID` | Cloudflare R2 | R2 → Manage R2 API Tokens |
| 20 | `R2_SECRET_ACCESS_KEY` | Cloudflare R2 | R2 → Manage R2 API Tokens |
| 21 | `R2_BUCKET_NAME` | S3-compatible bucket | Create bucket in R2 Dashboard |

**Used for:** Document uploads, signed documents, firm file storage.

---

## 🔌 MCP Server Keys (17 Servers)

### Core Infrastructure (No External Keys Needed)

| MCP Server | Port | Backend | Keys Required |
|-----------|------|---------|---------------|
| postgres-mcp | stdio | Neon PostgreSQL | `DATABASE_URL` (shared) |
| document-mcp | stdio | pgvector | `DATABASE_URL` (shared) |
| conflict-mcp | stdio | PostgreSQL | `DATABASE_URL` (shared) |
| cloudflare-mcp | 5002 | Cloudflare AI | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` |
| storage-mcp | 5008 | S3/R2 | `R2_*` keys (shared) |

### Communication & Productivity

| MCP Server | Port | Backend | Keys Required |
|-----------|------|---------|---------------|
| email-mcp | 5004 | Gmail + Outlook | OAuth tokens (per-user via Connector) |
| calendar-mcp | 5005 | Google + Outlook | OAuth tokens (per-user via Connector) |
| communication-mcp | 5010 | Slack + Teams | Slack Bot Token, Teams App Registration |
| video-mcp | 5014 | Zoom + Teams | Zoom S2S OAuth credentials |

### Business Integrations

| MCP Server | Port | Backend | Keys Required |
|-----------|------|---------|---------------|
| crm-mcp | 5011 | Salesforce + Clio + HubSpot | OAuth per-provider (per-user) |
| billing-mcp | 5009 | Stripe | `STRIPE_SECRET_KEY` (shared) |
| time-mcp | 5015 | Harvest + Toggl | Harvest API Key, Toggl API Token |
| workflow-mcp | 5012 | n8n + webhooks | n8n API Key or webhook URLs |

### Legal & Compliance (India-Specific)

| MCP Server | Port | Backend | Keys Required |
|-----------|------|---------|---------------|
| court-mcp | 5010 | CourtListener API | CourtListener API Token (free) |
| esign-mcp | 5007 | DocuSign REST API v2.1 | DocuSign Integration Key + OAuth |
| ocr-mcp | 5013 | AWS Textract + Azure | AWS Access Key, Azure Cognitive Services Key |
| translation-mcp | 5016 | DeepL + Azure Translator | DeepL API Key, Azure Translator Key |

### CA Vertical (India-Specific)

| MCP Server | Port | Backend | Keys Required |
|-----------|------|---------|---------------|
| books-mcp | — | Tally Prime API | Tally API token (local network) |
| eri-mcp | — | Income Tax ERI | ERI credentials (government portal) |
| gsp-mcp | — | GST Suvidha Provider | GSP API credentials |
| mca-mcp | — | MCA Portal | MCA digital signature |
| tally-mcp | — | Tally Prime | Tally API (local network) |
| udin-mcp | — | ICAI UDIN Portal | UDIN API credentials |
| whatsapp-mcp | — | WhatsApp Business API | WhatsApp Business Token |

---

## 🌐 Environment Configuration

### Complete .env Template

```bash
# ═══════════════════════════════════════════════════════════════
# REQUIRED — Database
# ═══════════════════════════════════════════════════════════════
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

# ═══════════════════════════════════════════════════════════════
# REQUIRED — Auth
# ═══════════════════════════════════════════════════════════════
JWT_SECRET=<64-char-random-string>
JWT_EXPIRES_IN=24h
REFRESH_TOKEN_EXPIRES_IN=7d

# ═══════════════════════════════════════════════════════════════
# REQUIRED — Cloudflare (AI + Storage)
# ═══════════════════════════════════════════════════════════════
CLOUDFLARE_ACCOUNT_ID=<your-cloudflare-account-id>
CLOUDFLARE_API_TOKEN=<your-cloudflare-api-token>

# ═══════════════════════════════════════════════════════════════
# OPTIONAL — Document Storage (Cloudflare R2)
# Falls back to local disk if not set
# ═══════════════════════════════════════════════════════════════
R2_ACCOUNT_ID=<cloudflare-account-id>
R2_ACCESS_KEY_ID=<r2-access-key>
R2_SECRET_ACCESS_KEY=<r2-secret-key>
R2_BUCKET_NAME=counsel-documents

# ═══════════════════════════════════════════════════════════════
# OPTIONAL — Stripe Billing (Global)
# ═══════════════════════════════════════════════════════════════
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...

# ═══════════════════════════════════════════════════════════════
# OPTIONAL — Razorpay Billing (India)
# ═══════════════════════════════════════════════════════════════
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=<razorpay-secret>
RAZORPAY_PLAN_ID=plan_...

# ═══════════════════════════════════════════════════════════════
# OPTIONAL — Email (Resend)
# ═══════════════════════════════════════════════════════════════
RESEND_API_KEY=re_...

# ═══════════════════════════════════════════════════════════════
# OPTIONAL — SSO (WorkOS)
# ═══════════════════════════════════════════════════════════════
WORKOS_API_KEY=key_...
WORKOS_CLIENT_ID=client_...
WORKOS_REDIRECT_URI=https://your-domain.com/api/v1/auth/callback

# ═══════════════════════════════════════════════════════════════
# OPTIONAL — Monitoring (Sentry)
# ═══════════════════════════════════════════════════════════════
SENTRY_DSN=https://...@sentry.io/...

# ═══════════════════════════════════════════════════════════════
# OPTIONAL — CRM Integrations (per-user OAuth via Connector)
# ═══════════════════════════════════════════════════════════════
# These are OAuth tokens — set via the Feature Connector UI, not env vars
# Salesforce, Clio, HubSpot, QuickBooks, Xero, Google, Microsoft

# ═══════════════════════════════════════════════════════════════
# OPTIONAL — E-Sign (DocuSign)
# ═══════════════════════════════════════════════════════════════
DOCUSIGN_INTEGRATION_KEY=<integration-key>
DOCUSIGN_CLIENT_SECRET=<client-secret>
DOCUSIGN_ACCOUNT_ID=<docusign-account-id>

# ═══════════════════════════════════════════════════════════════
# OPTIONAL — OCR (AWS Textract)
# ═══════════════════════════════════════════════════════════════
AWS_ACCESS_KEY_ID=<aws-access-key>
AWS_SECRET_ACCESS_KEY=<aws-secret-key>
AWS_REGION=ap-south-1

# ═══════════════════════════════════════════════════════════════
# OPTIONAL — Translation (DeepL)
# ═══════════════════════════════════════════════════════════════
DEEPL_API_KEY=<deepl-api-key>

# ═══════════════════════════════════════════════════════════════
# OPTIONAL — Video (Zoom)
# ═══════════════════════════════════════════════════════════════
ZOOM_ACCOUNT_ID=<zoom-account-id>
ZOOM_CLIENT_ID=<zoom-client-id>
ZOOM_CLIENT_SECRET=<zoom-client-secret>

# ═══════════════════════════════════════════════════════════════
# OPTIONAL — Time Tracking
# ═══════════════════════════════════════════════════════════════
HARVEST_ACCESS_TOKEN=<harvest-token>
TOGGL_API_TOKEN=<toggl-token>

# ═══════════════════════════════════════════════════════════════
# OPTIONAL — Communication
# ═══════════════════════════════════════════════════════════════
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...

# ═══════════════════════════════════════════════════════════════
# OPTIONAL — Court Data (CourtListener)
# ═══════════════════════════════════════════════════════════════
COURTLISTENER_API_TOKEN=<courtlistener-token>

# ═══════════════════════════════════════════════════════════════
# APP CONFIG
# ═══════════════════════════════════════════════════════════════
FRONTEND_URL=http://localhost:3000
API_URL=http://localhost:3001
AI_SERVICE_URL=http://localhost:8000
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development
```

---

## 📊 Key Dependency Summary

| Category | Minimum Keys to Launch | All Keys for Full Feature Set |
|----------|----------------------|------------------------------|
| **Core (Required)** | 4 (DATABASE_URL, JWT_SECRET, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN) | 4 |
| **Billing** | 0 (Stripe or Razorpay, or both) | 6 (Stripe + Razorpay) |
| **Auth/SSO** | 0 (WorkOS optional) | 3 (WorkOS) |
| **Email** | 0 (Resend optional) | 1 (Resend) |
| **Storage** | 0 (R2 optional, falls back to disk) | 4 (R2) |
| **OCR** | 0 (optional) | 2 (AWS Textract) |
| **Video** | 0 (optional) | 3 (Zoom) |
| **Time** | 0 (optional) | 2 (Harvest + Toggl) |
| **Translation** | 0 (optional) | 1 (DeepL) |
| **Monitoring** | 0 (optional) | 1 (Sentry) |
| **Legal/Court** | 0 (optional) | 1 (CourtListener) |
| **Communication** | 0 (optional) | 2 (Slack) |
| **CRM** | 0 (OAuth per-user) | OAuth (Salesforce/Clio/HubSpot) |
| **Accounting** | 0 (OAuth per-user) | OAuth (QuickBooks/Xero) |
| **Total to launch** | **4 keys** | **~35 keys/tokens** |

---

## 🔒 Security Notes

- Never commit `.env` files to git
- Rotate API keys quarterly
- Use separate keys for development and production
- Razorpay and Stripe test keys are safe for development
- CourtListener has a free API tier — no payment required
- All MCP servers use circuit breakers for graceful degradation when keys are missing
