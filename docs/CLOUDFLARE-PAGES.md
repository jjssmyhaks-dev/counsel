# Cloudflare Pages Deployment Guide for Counsel Platform

## Why Cloudflare Pages over Vercel

| Feature | Vercel (free) | Cloudflare Pages (free) |
|---------|---------------|------------------------|
| Bandwidth | 100 GB/mo | **Unlimited** |
| Build minutes | 6000/mo | 500 builds/mo (unused after deploy) |
| Edge locations | 30+ | **330+** |
| DDoS protection | Basic | **Enterprise-grade (free)** |
| Custom domains | ✅ | ✅ |
| CI/CD from GitHub | ✅ | ✅ |
| Monorepo support | Limited | ✅ (via build command) |

---

## Quick Deploy (GitHub Integration)

### 1. Install GitHub App

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages**
2. Click **Create application** → **Pages** → **Connect to Git**
3. Select `jjssmyhaks-dev/counsel` repository

### 2. Configure Build

| Setting | Value |
|---------|-------|
| **Framework preset** | Next.js |
| **Build command** | `cd ../.. && npm install --legacy-peer-deps && npx prisma generate --schema=packages/database/prisma/schema.prisma && cd apps/web && npx next build` |
| **Build output directory** | `.next` |
| **Root directory** | `apps/web` |

### 3. Set Environment Variables

In the Cloudflare Pages dashboard → **Settings → Environment variables**:

| Variable | Production value | Preview value |
|----------|-----------------|---------------|
| `NEXT_PUBLIC_API_URL` | `https://api.counsel.ai/api/v1` | `https://api-staging.counsel.ai/api/v1` |
| `NEXT_PUBLIC_SITE_URL` | `https://app.counsel.ai` | `https://preview.app.pages.dev` |
| `NEXT_PUBLIC_ENABLE_AI` | `true` | `true` |
| `NODE_VERSION` | `22` | `22` |

### 4. Deploy

- Push to `main` → auto-deploys to production
- Pull request → auto-deploys preview URL
- Every commit triggers a build

---

## Manual Deploy (from local)

```bash
# Install dependencies
cd counsel-platform/apps/web
npm install

# Build for Cloudflare Pages (static export)
CF_PAGES=1 npx next build

# Deploy via Wrangler
npx wrangler pages deploy .vercel/output/static --project-name=counsel-platform-web
```

---

## Post-Deploy DNS Setup

In Cloudflare DNS dashboard:

| Record | Type | Content | Proxy Status |
|--------|------|---------|-------------|
| `app.counsel.ai` | CNAME | `counsel-platform-web.pages.dev` | ☁️ Proxied |
| `www.counsel.ai` | CNAME | `app.counsel.ai` | ☁️ Proxied |

### Redirect apex to www (optional)

Create a **Page Rule** in Cloudflare:
- URL: `counsel.ai/*`
- Setting: Forwarding URL (301)
- Destination: `https://app.counsel.ai/$1`

---

## Architecture After Migration

```
counsel.ai (domain, DNS, DDoS, SSL)
│
├── app.counsel.ai (Cloudflare Pages — FREE)
│   └── Next.js 47 pages, static + SSR, unlimited bandwidth
│
├── api.counsel.ai (Cloudflare Tunnel → Oracle VM — FREE)
│   ├── Express API (:3001) via PM2
│   ├── Python AI FastAPI (:8000)
│   └── MCP Servers (:3101-:3117)
│
└── Oracle Cloud Ampere A1 (Always Free)
    ├── PostgreSQL 17 (local install, or Neon free tier)
    ├── Nginx reverse proxy
    └── PM2 process manager (20 services)

Total monthly cost: $0.00
```

---

## CI/CD Pipeline

GitHub Actions already configured (`.github/workflows/ci.yml`). After push:
1. GitHub Actions → lint, TS check, test ✅
2. Cloudflare Pages → build + deploy (auto) ✅
3. Preview URL for PRs ✅
4. Production deploy on merge to main ✅

---

## Rollback

```bash
# Via Cloudflare Dashboard
# Workers & Pages → counsel-platform-web → Deployments
# Find the working deployment → "Rollback to this deployment"

# Or via Wrangler
npx wrangler pages deployment list --project-name=counsel-platform-web
npx wrangler pages deployment rollback <deployment-id>
```

---

## Environment-Specific Builds

The `next.config.ts` detects `CF_PAGES=1` and switches to static export mode. Cloudflare's GitHub integration sets this automatically.

For manual builds:
```bash
# Standard Next.js (Vercel / local dev)
npx next build

# Cloudflare Pages (static export)
CF_PAGES=1 npx next build
```
