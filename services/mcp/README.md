# ── MCP Production Readiness: Security Audit & Deployment Runbook ──

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    AI Agent Framework                        │
│  (CrewAI agents via CloudflareLLM bridge + tools.py)         │
└──────────┬──────────┬──────────┬─────────────────────────────┘
           │          │          │
     ┌─────▼──┐  ┌────▼───┐  ┌─▼──────────┐
     │Registry│  │PostgreSQL│  │Document RAG │
     │ :3100  │  │ :3101   │  │ :3103      │
     └────────┘  └─────────┘  └────────────┘
           │          │          │
           └──────────┼──────────┘
                      │
              ┌───────▼────────┐
              │ Cloudflare MCP │
              │ :3102          │
              └───────┬────────┘
                      │
              ┌───────▼────────┐
              │ Cloudflare API │
              │ Workers AI     │
              └────────────────┘
```

## MCP Servers

| Server | Port | Transport | Real Backend |
|--------|------|-----------|--------------|
| Registry | 3100 | HTTP | In-memory service discovery |
| PostgreSQL | 3101 | stdio + HTTP | Neon PostgreSQL (asyncpg) |
| Cloudflare AI | 3102 | stdio + HTTP | Cloudflare Workers AI REST API |
| Document RAG | 3103 | stdio + HTTP | pgvector + Python AI embedding API |

## Security Posture (OWASP Top 10)

| OWASP # | Threat | Mitigation |
|---------|--------|------------|
| A01 | Broken Access Control | JWT validation on Express API layer; MCP servers internal-only |
| A02 | Cryptographic Failures | TLS 1.2+ via NGINX; Cloudflare API over HTTPS; bcrypt password hashing |
| A03 | Injection | Parameterized SQL queries (asyncpg, no string concatenation) |
| A05 | Security Misconfiguration | `.env` files not committed; Docker secrets not exposed |
| A07 | Identification Failures | API token auth on Cloudflare; WorkOS SSO + JWT on user layer |

## Secret Rotation (90-day policy)

Secrets stored in `.env` files (local dev) / environment variables (Docker):
- `CLOUDFLARE_API_TOKEN` — rotate via Cloudflare Dashboard → API Tokens
- `DATABASE_URL` password — rotate via Neon Dashboard → Connection Details
- `JWT_SECRET` — regenerate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`

## Monitoring

- **Prometheus** at `http://localhost:9090` — scrapes all MCP servers every 10s
- **Grafana** at `http://localhost:3030` — dashboard `Counsel MCP — Integration Health`
- Alert rules cover: server down, high error rate, circuit breaker open, high latency, external service degraded

## Rollback Procedure

```bash
# Full rollback to previous commit in < 5 minutes
bash scripts/rollback.sh          # rollback to HEAD^
bash scripts/rollback.sh abc123   # rollback to specific commit
```

Steps: record state → stop → git reset → rebuild → start → health check (6 ports).

## Startup Commands

```bash
# Development (sequential)
docker compose --profile core up -d      # core: API + Web + AI
docker compose --profile mcp up -d       # MCP servers
docker compose --profile monitoring up -d # Prometheus + Grafana

# Everything
docker compose --profile full up -d

# Production (with NGINX SSL)
docker compose --profile production up -d
```

## Integration Test Commands

```bash
cd services/mcp
npm test              # All integration tests
npx vitest run        # With verbose output
```

## Port Map

| Port | Service | Health Check |
|------|---------|-------------|
| 3000 | Next.js Web | `curl http://localhost:3000` |
| 3001 | Express API | `curl http://localhost:3001/api/health` |
| 3030 | Grafana | `curl http://localhost:3030/api/health` |
| 3100 | MCP Registry | `curl http://localhost:3100/health` |
| 3101 | MCP PostgreSQL | `curl http://localhost:3101/health` |
| 3102 | MCP Cloudflare | `curl http://localhost:3102/health` |
| 3103 | MCP Document | `curl http://localhost:3103/health` |
| 8000 | Python AI | `curl http://localhost:8000/health` |
| 9090 | Prometheus | `curl http://localhost:9090/-/healthy` |
