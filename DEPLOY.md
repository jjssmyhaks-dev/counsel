# DEPLOY.md — Counsel AI Workforce Suite

Deployment runbook for the `jjssmyhaks-dev/counsel` platform.

---

## Architecture (Three Services)

| Service | Port | Stack | Purpose |
|---|---|---|---|
| Frontend | 3000 | Next.js 15 (App Router) | Web platform + admin console |
| API | 3001 | Node.js + Express | Auth, CRUD, orchestration, billing |
| AI Service | 8000 | Python FastAPI + CrewAI | Agents, RAG, embeddings, document processing |

---

## Prerequisites

- Node.js >= 22.0
- Python >= 3.10
- PostgreSQL (Neon serverless in production, local fallback for dev)
- Cloudflare Workers AI account (Account ID + API Token)
- Environment files configured (see below)

---

## Environment Variables

### Frontend (`apps/web/.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WORKOS_CLIENT_ID=client_01KXE72T9A1FFSBTPT4P6DE85K
```

### API (`apps/api/.env`)
```
DATABASE_URL=postgresql://neondb_owner:***@ep-super-math-aolcnxm7.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=<your-jwt-secret>
AI_SERVICE_URL=http://localhost:8000
WORKOS_API_KEY=<workos-api-key>
WORKOS_CLIENT_ID=client_01KXE72T9A1FFSBTPT4P6DE85K
RESEND_API_KEY=<resend-api-key>
STRIPE_SECRET_KEY=<stripe-secret>
PORT=3001
```

### AI Service (`services/ai/.env` — optional, reads from config.py)
```
CLOUDFLARE_ACCOUNT_ID=e09989...
CLOUDFLARE_API_TOKEN=<api-token>
CLOUDFLARE_TEXT_MODEL=@cf/meta/llama-4-scout-17b-16e-instruct
DATABASE_URL=postgresql://neondb_owner:***@ep-super-math-aolcnxm7.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

---

## Startup

### 1. AI Service (port 8000)
```bash
cd services/ai
pip install -r requirements.txt
python -m uvicorn src.main:app --host 127.0.0.1 --port 8000
```

### 2. Express API (port 3001)
```bash
cd apps/api
npm install
npx prisma generate
node scripts/start-api.mjs
```

### 3. Next.js Frontend (port 3000)
```bash
cd apps/web
npm install
npx next dev --port 3000
```

### Health Checks
```bash
curl http://localhost:8000/health    # → {"status":"ok", ...}
curl http://localhost:3001/api/health # → {"status":"ok", ...}
curl http://localhost:3000            # → HTTP 200 (landing page)
```

---

## Database

Schema is managed by Prisma:

```bash
cd packages/database
npx prisma migrate dev    # Apply migrations
npx prisma db seed        # Seed default firm + admin user
```

### Seed credentials
- Email: `admin@sterling.law`
- Password: `password`

### Database URL
Neon serverless (ap-southeast-1), shared-schema multi-tenant with Row-Level Security.

---

## Smoke Test

Run the multi-crew E2E test suite:
```bash
node scripts/test-all-crews.cjs
```

Expected output: all 7 crews (C1-C7 + full pipeline) return `completed`.

Individual crew tests via curl:
```bash
# Document Intelligence
curl -X POST http://localhost:8000/agents/analyze/contract \
  -H "Content-Type: application/json" \
  -d '{"document_text":"Sample contract...", "firm_id":"test", "user_id":"test"}'

# Proposal
curl -X POST http://localhost:8000/agents/proposal \
  -H "Content-Type: application/json" \
  -d '{"proposal_type":"strategy","client_context":"Test","scope":"Test","timeline":"1 month","budget_range":"$10K"}'
```

---

## Rollback Procedure

```bash
# View commit history
git log --oneline -10

# Revert to specific commit
git revert <bad-commit-hash>

# Or force-reset (destructive):
git reset --hard <good-commit-hash>

# Push rollback
git push origin main --force
```

No database migrations to roll back — current schema changes are additive only.

---

## Monitoring

- **Audit trail:** `services/ai/logs/audit-YYYY-MM-DD.jsonl` (rotates at 10 MB)
- **Crew logs:** `services/ai/logs/crew-YYYY-MM-DD.jsonl` (rotates at 10 MB)
- **Express logs:** Console output
- **Next.js logs:** Console output

---

## Known Limitations

| Limitation | Workaround | Priority |
|---|---|---|
| Redis/BullMQ requires >=5.0 | Falls back to in-process polling | Medium |
| C2 Drafting test returns 400 | Route works; test body missing fields | Low |
| pgvector search fails gracefully | Returns empty results + note to upload docs | Low |
| FinancialModeler uses LLM numbers | numpy-financial integration planned | Medium |
| No production Docker setup | Bare-metal or VPS deployment only | Low |

---

## Production Checklist

- [ ] Rotate all API keys and secrets
- [ ] Enable SSL/TLS on all services
- [ ] Set up proper process management (PM2, systemd, or Docker Compose)
- [ ] Configure logging to file/stdout aggregation
- [ ] Set up monitoring alerts (UptimeRobot, Sentry)
- [ ] Run security audit: `node scripts/security-audit.cjs`
- [ ] Review and rotate JWT secret
- [ ] Verify RLS policies are active on production database
