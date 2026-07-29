# Counsel Platform — Production Runbook

## Architecture Overview

| Service | Port | Tech | Process |
|---------|------|------|---------|
| Web (Next.js) | 3000 | Node 22 | PM2 `counsel-web` |
| API (Express) | 3001 | Node 22 | PM2 `counsel-api` |
| AI Service (FastAPI) | 8000 | Python 3.12 | PM2 `counsel-ai` |
| MCP Postgres | 3101 | Python | PM2 `counsel-mcp-postgres` |
| MCP Cloudflare | 3102 | Python | PM2 `counsel-mcp-cloudflare` |
| MCP Document | 3103 | Python | PM2 `counsel-mcp-document` |
| MCP Email | 3104 | Python | PM2 `counsel-mcp-email` |
| MCP Calendar | 3105 | Python | PM2 `counsel-mcp-calendar` |
| MCP Storage | 3106 | Python | PM2 `counsel-mcp-storage` |
| MCP eSign | 3107 | Python | PM2 `counsel-mcp-esign` |
| MCP Billing | 3108 | Python | PM2 `counsel-mcp-billing` |
| MCP Court | 3109 | Python | PM2 `counsel-mcp-court` |
| MCP Communication | 3110 | Python | PM2 `counsel-mcp-communication` |
| MCP CRM | 3111 | Python | PM2 `counsel-mcp-crm` |
| MCP Workflow | 3112 | Python | PM2 `counsel-mcp-workflow` |
| MCP OCR | 3113 | Python | PM2 `counsel-mcp-ocr` |
| MCP Translation | 3114 | Python | PM2 `counsel-mcp-translation` |
| MCP Video | 3115 | Python | PM2 `counsel-mcp-video` |
| MCP Time | 3116 | Python | PM2 `counsel-mcp-time` |
| MCP Conflict | 3117 | Python | PM2 `counsel-mcp-conflict` |
| PostgreSQL | 5432 | Neon Serverless | External |

Total: 20 processes (1 web + 1 API + 1 AI + 17 MCP servers)

---

## 1. Deployment

### Prerequisites
- Node.js 22+, Python 3.12+, PM2 (`npm i -g pm2`)
- PostgreSQL database (Neon serverless or self-hosted)
- Git clone of the repository

### Environment Variables (set before starting)
```bash
# API
export DATABASE_URL=postgresql://user:pass@host:5432/db
export JWT_SECRET=<random-64-char-string>
export CORS_ORIGIN=https://app.counsel.ai
export WORKOS_API_KEY=...
export RESEND_API_KEY=...

# AI
export CF_ACCOUNT_ID=e09989
export CF_API_TOKEN=...

# Web
export NEXT_PUBLIC_API_URL=https://api.counsel.ai/api/v1
```

### First-time Setup
```bash
# 1. Clone + install
git clone https://github.com/jjssmyhaks-dev/counsel.git counsel-platform
cd counsel-platform
npm ci
pip install -r services/ai/requirements.txt

# 2. Generate Prisma client + run migrations
cd packages/database
npx prisma generate
npx prisma db push
npx prisma db seed
cd ../..

# 3. Build the frontend
cd apps/web
npx next build
cd ../..

# 4. Create log directories
mkdir -p logs
```

### Start All Services (Production)
```bash
pm2 start ecosystem.config.cjs
pm2 save           # Save process list for automatic restart on reboot
pm2 startup        # Install PM2 startup hook
```

### Verify Health
```bash
# Wait 30 seconds then check
curl http://localhost:3001/api/health
# Expected: {"status":"ok","database":"connected","ai":{"status":"reachable"}}

curl http://localhost:8000/health
# Expected: {"status":"ok"}

# Check all 17 MCP servers
for port in $(seq 3101 3117); do
  echo "Port $port: $(curl -s http://localhost:$port/health | jq -r '.status + " - " + .server')"
done
```

---

## 2. Stopping

```bash
pm2 stop all          # Graceful stop, keeps process list
pm2 kill              # Stop all + clear list (use cautiously)
```

---

## 3. Log Inspection

```bash
pm2 logs                    # Tail all logs (live)
pm2 logs counsel-api        # Specific service
pm2 logs --lines 100        # Last 100 lines
pm2 logs --err              # Error logs only

# Structured JSON logs location
ls logs/*.log
cat logs/api-out.log | jq '.' # Pretty-print structured logs
```

### Log Format
All API and AI services output JSON-structured logs:
```json
{"level":"info","message":"GET /api/v1/matters","requestId":"req-abc123","method":"GET","path":"/api/v1/matters","userId":"u-001","firmId":"f-001","timestamp":"2026-07-30T00:00:00.000Z"}
```

---

## 4. Health Checks

| Endpoint | Expected Response | Critical? |
|----------|------------------|-----------|
| `GET /api/health` | `{"status":"ok","database":"connected"}` | Yes |
| `GET /api/v1/public/stats` | `{"firmCount":...,"docCount":...}` | No |
| `GET :8000/health` | `{"status":"ok"}` | No (AI optional) |
| `GET :3101/health` to `:3117/health` | `{"status":"ok","server":"..."}` | No |

---

## 5. Common Failure Modes

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `database: disconnected` | DB creds expired or Neon paused | Check `DATABASE_URL` env, wake Neon |
| `ai: unreachable` | Python deps missing or uvicorn crashed | `pm2 restart counsel-ai`, check `logs/ai-error.log` |
| MCP server not responding | Port conflict or Python env issue | `pm2 restart counsel-mcp-<name>`, verify pip install |
| `ECONNREFUSED :3001` | API not started | `pm2 restart counsel-api` |
| Web build fails | `NEXT_PUBLIC_API_URL` not set | Set env var, run `npx next build` in `apps/web` |
| Rate limiting (429) | Too many login attempts | Wait 15 min (100 req/15min limit) |
| Prisma P2025 (not found) | Seed not run | `npm run seed` or `node scripts/seed.cjs` |

---

## 6. Rollback Procedure

### Rollback to Previous Deployment
```bash
# 1. List recent commits
git log --oneline -10

# 2. Revert to specific commit
git checkout <commit-hash>

# 3. Reinstall dependencies (if package.json changed)
npm ci

# 4. Rebuild frontend
cd apps/web && npx next build && cd ../..

# 5. Restart services
pm2 restart all

# 6. Verify
curl http://localhost:3001/api/health
```

### Rollback via PM2 (if only process change)
```bash
pm2 restart all --update-env
```

---

## 7. CI/CD Pipeline

GitHub Actions workflow at `.github/workflows/ci.yml` runs on every push:
- Lint + TypeScript check (API + Web + Database)
- Next.js production build
- Python AI service tests

### Deploy after CI passes
```bash
git pull origin main
npm ci --production
pm2 restart all
```

---

## 8. Monitoring & APM

Structured JSON logs can be shipped to any APM (Datadog, Sentry, Grafana):
```bash
# Example: ship logs to Datadog via agent
tail -f logs/api-out.log | datadog-agent stream

# Example: send error logs to Sentry
# (API already has try/catch on all routes; errors log as JSON with stack traces)
```

---

## 9. Scaling Notes

- **API**: Can scale horizontally behind a load balancer (stateless JWT auth)
- **MCP servers**: Each runs on its own port; scale by adding PM2 instances
- **Frontend**: Deploy as static export or via Vercel/Cloudflare Pages
- **Database**: Neon serverless scales automatically; cache with Redis if needed

---

## 10. Quick Reference

```bash
pm2 start all      # Start everything
pm2 status         # Show process list
pm2 logs           # Tail all logs
pm2 restart all    # Restart everything
pm2 stop all       # Stop everything
node scripts/seed.cjs     # Reseed database
node scripts/start-dev.cjs  # Dev mode (local)
```
