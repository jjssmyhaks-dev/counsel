# Vercel deployment guide for Counsel Platform

## Pre-deploy Checklist

### 1. Environment Variables (set in Vercel Dashboard → Settings → Environment Variables)

| Name | Value | Notes |
|------|-------|-------|
| `NEXT_PUBLIC_API_URL` | `https://api.counsel.ai/api/v1` | Points to your Express API (or set to Vercel-API URL) |
| `NEXT_PUBLIC_SITE_URL` | `https://app.counsel.ai` | Your production web domain |
| `NEXT_PUBLIC_ENABLE_AI` | `true` | Feature flag for AI features |

### 2. API Backend
- Your Express API (`apps/api`) must be running on a separate service (Railway, Render, AWS, etc.)
- Update `NEXT_PUBLIC_API_URL` to point to your production API URL
- Ensure CORS on the API allows your Vercel domain:
  ```
  CORS_ORIGIN=https://app.counsel.ai
  ```

### 3. Database
- PostgreSQL (Neon) must be accessible from Vercel's IP range (or use connection pooling)
- Prisma client is generated at build time via `next.config.ts` → `transpilePackages`

---

## Deploy Steps

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Link project (one-time)
cd apps/web
vercel link

# 3. Set environment variables
vercel env add NEXT_PUBLIC_API_URL production
vercel env add NEXT_PUBLIC_SITE_URL production

# 4. Deploy preview
vercel

# 5. Deploy production
vercel --prod
```

---

## Build Configuration (auto-detected by Vercel)

- **Framework:** Next.js (auto-detected)
- **Root Directory:** `apps/web`
- **Build Command:** Next.js defaults via `vercel.json`
- **Install Command:** `npm install --legacy-peer-deps` (needed for monorepo)
- **Output:** `.next`

---

## Post-deploy Verification

```bash
# 1. Check homepage loads
curl -s https://app.counsel.ai | head -n 5

# 2. Check API proxy works
curl https://app.counsel.ai/api/v1/public/stats

# 3. Check health
curl https://api.counsel.ai/api/health

# 4. Verify SSL
curl -I https://app.counsel.ai
```

---

## Rollback

```bash
vercel rollback
# or via Vercel Dashboard → Deployments → [select previous] → Promote to Production
```

---

## Known Limitations

- **Express API is NOT on Vercel** — it runs separately. Vercel only hosts the Next.js frontend.
- **Prisma client** must be generated at build. `@counsel/database` is marked as `transpilePackages` in `next.config.ts`.
- **WebSocket connections** (if any) won't work on Vercel serverless. Consider a WebSocket service separately.
- **API route rewrites** in `vercel.json` proxy `/api/v1/*` to the Express backend.
