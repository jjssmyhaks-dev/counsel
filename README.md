# Counsel — AI Workforce Suite for Legal, Consulting & CA Firms

A B2B AI suite that gives every employee at a legal, consulting, or Chartered Accountancy firm an AI copilot embedded in their existing workflow. Counsel ingests the firm's documents, learns its institutional voice, and delivers AI-powered contract analysis, research synthesis, drafting assistance, meeting intelligence, GST/ITR reconciliation, audit automation, and compliance tracking — all tenant-isolated, auditable, and secure.

**Two verticals, one platform:** Legal & Consulting (10 agents, 4 crews) | CA Firms (15 agents, 5 crews)

---

## 🏗 Architecture

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router) + Tailwind CSS (green-serif theme) |
| Core API | Node.js + Express + TypeScript |
| AI Service | Python FastAPI + CrewAI Multi-Agent (25 agents, 9 crews across 2 verticals) + Cloudflare Workers AI |
| MCP Servers | 25 Model Context Protocol servers across 3 tiers |
| Embeddings | Cloudflare bge-base-en-v1.5 (768-dim) via pgvector HNSW |
| Database | PostgreSQL + pgvector (vector search) |
| ORM | Prisma with multi-tenant RLS |
| Queue | Redis/BullMQ (async processing) |
| Storage | S3 / GCS / SharePoint + Cloudflare R2 (document storage) |
| Monitoring | Prometheus + Grafana (18 server dashboards, 6 alert rules) |
| Extension | Chrome Manifest V3 (Gmail integration) |
| Auth | JWT-based + WorkOS SSO (SAML/OIDC) + OAuth2 for integrations |
| CI/CD | GitHub Actions — test → build → push → rolling deploy + Trivy security scan |

## 📁 Project Structure

```
counsel-platform/
├── apps/
│   ├── api/                    # Node.js Express API
│   │   └── src/
│   │       ├── middleware/      # Auth, tenant RLS, audit, validation
│   │       ├── routes/          # REST endpoints (documents, matters, drafts, etc.)
│   │       └── lib/             # JWT, errors, R2 client
│   └── web/                    # Next.js frontend
│       └── src/
│           ├── app/            # App Router pages (landing, dashboard, auth)
│           ├── components/     # UI, layout, Footer, HeroPreview, Navbar
│           ├── hooks/          # Custom React hooks
│           └── lib/            # API client (auto-fallback to mock), auth, types
├── packages/
│   └── database/              # Prisma schema (16 models), migrations, seeds
├── services/
│   ├── ai/                    # Python AI/ML service
│   │   ├── logs/               # Audit trail JSONL (date-rotated, 10 MB chunks)
│   │   ├── scripts/            # Indexing + verification scripts
│   │   └── src/
│   │       ├── agents/         # CrewAI multi-agent crews (4 crews, 10 agents)
│   │       │   ├── crews.py            # Crew definitions + full pipeline orchestrator
│   │       │   ├── tasks.py            # Task builders (clause extraction, risk, etc.)
│   │       │   ├── definitions.py      # Agent LLM configs (Cloudflare Workers AI)
│   │       │   ├── cloudflare_llm.py   # CrewAI-compatible Cloudflare LLM bridge
│   │       │   └── mcp_client.py       # MCP bridge: 18 servers → CrewAI tools
│   │       ├── orchestrator/   # Pipeline orchestration + audit trail
│   └── mcp/                   # Model Context Protocol servers (18 total)
│       ├── shared/             # MCPServer factory, CircuitBreaker, Prometheus metrics, protocol
│       ├── registry/           # :3100 — Service discovery + health aggregation
│       ├── postgres-mcp/       # :3101 — Neon PostgreSQL (10 tools: CRUD, schema, audit)
│       ├── cloudflare-mcp/     # :3102 — Cloudflare Workers AI (5 tools: text gen, embed, chat)
│       ├── document-mcp/       # :3103 — pgvector RAG (5 tools: semantic search, chunks)
│       ├── email-mcp/          # :3104 — Gmail + Outlook (6 tools)
│       ├── calendar-mcp/       # :3105 — Google + Outlook Calendar (6 tools)
│       ├── storage-mcp/        # :3106 — S3/GCS/SharePoint (6 tools)
│       ├── esign-mcp/          # :3107 — DocuSign + HelloSign (6 tools)
│       ├── billing-mcp/        # :3108 — Stripe (6 tools)
│       ├── court-mcp/          # :3109 — CourtListener case law + statutes (6 tools)
│       ├── communication-mcp/  # :3110 — Slack + Teams (6 tools)
│       ├── crm-mcp/            # :3111 — Salesforce/Clio/HubSpot (6 tools)
│       ├── workflow-mcp/       # :3112 — Zapier/n8n/Make (5 tools)
│       ├── ocr-mcp/            # :3113 — AWS Textract + Azure DocIntel (6 tools)
│       ├── translation-mcp/    # :3114 — DeepL + Azure Translator (5 tools)
│       ├── video-mcp/          # :3115 — Zoom + Teams Meetings (5 tools)
│       ├── time-mcp/           # :3116 — Harvest + Toggl (5 tools)
│       ├── conflict-mcp/       # :3117 — Conflict of Interest check (5 tools)
│       ├── gsp-mcp/            # :3118 — GST Suvidha Provider (8 tools)
│       ├── mca-mcp/            # :3119 — MCA21 V3 / ROC (6 tools)
│       ├── udin-mcp/           # :3120 — UDIN tracking, ICAI (5 tools)
│       ├── tally-mcp/          # :3121 — Tally connector (6 tools)
│       ├── eri-mcp/            # :3122 — Income Tax ERI (6 tools)
│       ├── books-mcp/          # :3123 — Zoho Books + QuickBooks (6 tools)
│       ├── whatsapp-mcp/       # :3124 — WhatsApp Business API (6 tools)
│       ├── prometheus/         # Prometheus config + 6 alert rules
│       ├── grafana/            # Grafana dashboards + auto-provisioning
│       └── tests/              # Integration tests + 100-call benchmark
│           │   ├── router.py, pipeline_orchestrator.py
│           │   ├── audit_agent.py       # In-memory audit trail singleton
│           │   └── audit_persistence.py # JSONL file persistence with rotation
│           ├── providers/      # Cloudflare API client (61 models available)
│           ├── embeddings/     # Cloudflare bge-base-en-v1.5 embedder (768-dim)
│           ├── rag/            # pgvector retriever with cosine similarity
│           ├── db/             # asyncpg client + schema management
│           ├── analysis/       # Contract clause extraction + risk scoring
│           ├── drafting/       # Draft generation + citation validation
│           └── routes/         # FastAPI route handlers (agents, health)
├── extensions/
│   └── chrome/                # Chrome/Gmail browser extension (Manifest V3)
└── scripts/                   # Test scripts (auth, AI agents, crews, links, theme)
```

## 🚀 Getting Started

### Prerequisites
- Node.js 22+
- Python 3.11+
- PostgreSQL 15+ with pgvector extension
- npm 10+
- Cloudflare Workers AI account (for embeddings + LLM)

### Quick Start

**1. Install dependencies:**
```bash
cd counsel-platform
npm install
```

**2. Set up the database:**
```bash
# Create a PostgreSQL database
createdb counsel

# Enable pgvector
psql counsel -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Configure DATABASE_URL in packages/database/.env
# Then run migrations:
npm run db:migrate
npm run db:seed
```

**3. Start the API server:**
```bash
npm run dev:api    # Starts on port 3001
```

**4. Start the frontend:**
```bash
npm run dev:web    # Starts on port 3000
```

**5. Start the AI service:**
```bash
cd services/ai
pip install -r requirements.txt
uvicorn src.main:app --host 127.0.0.1 --port 8000
```

**6. Start MCP servers (optional):**
```bash
# All 18 servers
cd services/mcp
npm install

docker compose --profile mcp up -d    # MCP only
docker compose --profile full up -d   # Everything including monitoring

# Health checks
curl http://127.0.0.1:3100/health   # Registry
# ... through http://127.0.0.1:3117/health
```

**7. Install MCP dependencies:**
```bash
cd services/mcp
npm install --legacy-peer-deps
```

**8. Index sample documents for RAG (optional):**
```bash
cd services/ai
python scripts/index_cf_embeddings.py
```

### Demo Credentials
- **Email:** admin@sterling.law
- **Password:** password
- **Role:** James Sterling, Partner, Sterling & Associates

The seed script provisions a demo firm with sample documents, matters, and users.

---

## 🤖 CrewAI Multi-Agent System

### Legal & Consulting Vertical (4 Crews, 10 Agents)

| Crew | Agents | Endpoint | Status |
|------|--------|----------|--------|
| **Crew 1: Document Intelligence** | ClauseExtractor → RiskAnalyzer → PlaybookGuardian | `POST /agents/analyze/contract` | ✅ |
| **Crew 2: Drafting** | LegalDrafter → CitationValidator | `POST /agents/draft` | ✅ |
| **Crew 3: Research & Discovery** | pgvector RAG → LegalResearcher → RAGSynthesizer | `POST /agents/research` | ✅ |
| **Crew 4: Compliance & Negotiation** | AuditLogger → ComplianceChecker → NegotiatorAdvisor | `POST /agents/compliance` | ✅ |
| **Full Pipeline** | All 4 crews chained | `POST /agents/pipeline/full` | ✅ |

### CA Firm Vertical (5 Crews, 15 Agents)

| Crew | Agents | Purpose | Status |
|------|--------|---------|--------|
| **Crew 9: Bookkeeping** | TransactionMatcher → VarianceAnalyzer → ReconciliationReporter | Bank-book reconciliation, variance analysis, reporting | ✅ |
| **Crew 10: GST** | InputTaxReconciler → GSTRValidator → FilingPrepAdvisor | ITC matching, GSTR validation, filing prep (partner-review) | ✅ |
| **Crew 11: Audit** | RiskAssessmentEngine → SamplingRecommendation → AuditReportCompiler | Risk assessment (SA 315), sampling (SA 530), report drafting | ✅ |
| **Crew 12: Income Tax** | TDSReconciler → ITRDataAggregator → NoticeResponseDrafter | TDS reconciliation, ITR prep, notice responses | ✅ |
| **Crew 13: ROC** | FilingDeadlineTracker → FormDataCompiler → ComplianceCalendarManager | MCA deadlines, form compilation, compliance calendar | ✅ |

**Non-negotiable guardrails for all CA crews:**
- No crew auto-files with any government portal (GSTN, ITD, MCA21). All data goes to partner-review.
- Every filing-bound number carries provenance — source document, reconciliation, agent.
- UDIN/DSC signing are always manual human actions.
- PAN/GSTIN-linked data never used for model training.

### LLM Bridge

The `CloudflareLLM` class in [cloudflare_llm.py](services/ai/src/agents/cloudflare_llm.py) subclasses CrewAI's `BaseLLM` directly — bypassing the hardcoded model-name validation that rejects Cloudflare model IDs. It uses synchronous `httpx` for full compatibility with CrewAI's thread-pool-based execution.

### Audit Trail

All crew runs are persisted to a JSONL audit log with date rotation (10 MB chunks):
- **Path:** `services/ai/logs/audit-YYYY-MM-DD.jsonl`
- **Fields:** `id`, `timestamp`, `action`, `user_id`, `firm_id`, `resource_id`, `success`, `error_message`, `metadata`

---

## 🔐 Multi-Tenancy & Security

- **Row-Level Security (RLS):** Every query is scoped to the current firm via Postgres RLS policies.
- **Tenant Context Middleware:** `withTenantContext(firmId, callback)` wraps every request.
- **Audit Trail:** Immutable append-only log of all AI actions. Stored in both `audit_log` table and JSONL files.
- **Document Encryption:** Envelope encryption with per-firm data keys managed via Cloudflare R2 SSE-C.
- **No Training on Customer Data:** All AI prompts are logged and scrubbed before reaching upstream providers.

---

## 🔌 MCP Servers (25 Total · ~130 Tools)

Model Context Protocol servers give AI agents real-world capabilities. Each server connects to a live API, uses circuit breakers to prevent cascading failures, and degrades gracefully when external services are down.

### Tier 1 — Core (Built ✅)

| Server | Port | Tools | Backend |
|--------|------|-------|---------|
| **Registry** | 3100 | 6 | Service discovery + health aggregation |
| **PostgreSQL** | 3101 | 10 | Neon PostgreSQL · asyncpg parameterized |
| **Cloudflare AI** | 3102 | 5 | Workers AI REST API · 3 model tiers |
| **Document RAG** | 3103 | 5 | pgvector cosine + full-text fallback |

### Tier 2 — Required (Built ✅)

| Server | Port | Tools | Backend |
|--------|------|-------|---------|
| **Email** | 3104 | 6 | Gmail API + Microsoft Graph |
| **Calendar** | 3105 | 6 | Google Calendar + Outlook |
| **Storage** | 3106 | 6 | S3 + GCS + SharePoint |
| **E-Signature** | 3107 | 6 | DocuSign + HelloSign |
| **Billing** | 3108 | 6 | Stripe |
| **Court Lookup** | 3109 | 6 | CourtListener · case law/statutes |
| **Communication** | 3110 | 6 | Slack + Teams |
| **CRM** | 3111 | 6 | Salesforce + Clio + HubSpot |

### Tier 3 — Nice-to-Have (Built ✅)

| Server | Port | Tools | Backend |
|--------|------|-------|---------|
| **Workflow** | 3112 | 5 | Zapier + n8n + Make |
| **OCR** | 3113 | 6 | AWS Textract + Azure DocIntel |
| **Translation** | 3114 | 5 | DeepL + Azure Translator |
| **Video** | 3115 | 5 | Zoom + Teams Meetings |
| **Time Tracking** | 3116 | 5 | Harvest + Toggl |
| **Conflict Check** | 3117 | 5 | COI detection + watchlist |

### CA Vertical — Government & Accounting (Built ✅)

| Server | Port | Tools | Backend |
|--------|------|-------|---------|
| **GSP (GST)** | 3118 | 8 | ClearTax / Masters India / WhiteBooks swap |
| **MCA / ROC** | 3119 | 6 | MCA21 V3 — company data, filings, due dates |
| **UDIN (ICAI)** | 3120 | 5 | UDIN tracking — read-only, ICAI portal |
| **Tally** | 3121 | 6 | v1 manual XML export → v2 ODBC roadmap |
| **Income Tax ERI** | 3122 | 6 | 26AS/AIS fetch, ITR status, notices |
| **Books (Zoho/QB)** | 3123 | 6 | Zoho Books + QuickBooks Online |
| **WhatsApp Business** | 3124 | 6 | Compliance nudges, doc requests, status updates |

### CrewAI Integration

Agents get MCP tools through `mcp_client.py`:

```python
from src.agents.mcp_client import mcp_registry

# Per-crew tool allocation
di_tools      = mcp_registry.get_crew_tools(["postgres", "document", "email", "esign"])
drafting_tools = mcp_registry.get_crew_tools(["postgres", "cloudflare", "esign", "email", "court"])
research_tools = mcp_registry.get_crew_tools(["postgres", "document", "cloudflare", "court", "crm"])

agent = Agent(name="LegalResearcher", tools=research_tools, ...)
```

All servers share: circuit breaker (5 failures → OPEN), Prometheus metrics (6 per server), and graceful degradation with `degradeFallback()`.

### Quick Start

```bash
docker compose --profile mcp up -d    # All 18 MCP servers
docker compose --profile full up -d   # Including Prometheus + Grafana + API + Web

# Health check all servers
for port in $(seq 3100 3117); do curl -s http://localhost:$port/health | jq .status; done
```

---

## 🔌 API Overview

Base URL: `http://localhost:3001/api/v1`

All endpoints require a `Bearer` token in the `Authorization` header. Every request is automatically tenant-scoped.

### Authentication
```
POST /api/v1/auth/login          # Email + password → JWT
POST /api/v1/auth/register       # Create firm + admin user
POST /api/v1/auth/sso/authorize  # WorkOS SSO (SAML/OIDC)
POST /api/v1/auth/refresh        # Refresh token → new access token
GET  /api/v1/auth/me             # Current user profile
```

### Multi-Agent AI (port 8000)
```
POST /agents/analyze/contract    # Crew 1: Document Intelligence
POST /agents/draft               # Crew 2: Drafting Assistant
POST /agents/research            # Crew 3: Research & Discovery
POST /agents/compliance          # Crew 4: Compliance & Negotiation
POST /agents/pipeline/full       # Full pipeline (all 4 crews chained)
GET  /agents/status              # Agent system health + model info
```

### Documents
```
POST   /api/v1/documents/upload   # Upload & index a document
GET    /api/v1/documents/:id      # Get document metadata
DELETE /api/v1/documents/:id      # Soft-delete a document
```

### Matters, Drafts, KB, Meetings
```
GET    /api/v1/matters            # List firm matters
POST   /api/v1/drafts             # Generate draft
POST   /api/v1/kb/query           # RAG query (Ask the Firm)
POST   /api/v1/meetings/transcripts   # Process transcript
```

---

## 🧪 Testing

```bash
# Auth flow test
node scripts/test-auth.cjs

# Standalone AI agent test (all 8 agents)
node scripts/test-ai-agents.cjs

# Crew 1: Document Intelligence (3-agent pipeline)
node scripts/test-c1-only.cjs

# Crews 2-4 + Full Pipeline
node scripts/test-c2-c4-pipeline.cjs

# Lint + typecheck
npm run lint
npm run typecheck
```

---

## 📋 Environment Variables

### API (`apps/api/.env`)
```
PORT=3001
JWT_SECRET=***
JWT_EXPIRY=24h
DATABASE_URL=postgresql://user:***@localhost:5432/counsel
WORKOS_CLIENT_ID=client_...
WORKOS_API_KEY=sk_...
AI_SERVICE_URL=http://localhost:8000
```

### Web (`apps/web/.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_APP_NAME=Counsel
WORKOS_CLIENT_ID=client_...
```

### AI Service (`services/ai/.env`)
```
DATABASE_URL=postgresql://user:***@localhost:5432/counsel
CLOUDFLARE_ACCOUNT_ID=<account-id>
CLOUDFLARE_API_TOKEN=<api-token>
EMBEDDING_MODEL=@cf/baai/bge-base-en-v1.5
EMBEDDING_DIM=768
CLOUDFLARE_TEXT_MODEL=@cf/meta/llama-4-scout-17b-16e-instruct
CHUNK_SIZE=800
CHUNK_OVERLAP=200
```

---

## 🏛 Build Plan Progress

| Milestone | Description | Status |
|-----------|-------------|--------|
| **M0** | Foundations — auth, RLS, tenant context, project scaffolding | ✅ Done |
| **M1** | Document Pipeline — upload, parse, semantic chunk, embed, pgvector index | ✅ Done |
| **M2** | Contract Analysis — two-pass analysis, playbook rules, risk flagging | ✅ Done |
| **M3** | Ask the Firm — RAG query engine, hybrid search, inline citations | ✅ Done |
| **M4** | Research Synthesis — map-reduce, cross-source reconciliation, briefs | ✅ Done |
| **M5** | Drafting Assistant — style exemplars, template library, firm-voice | ✅ Done |
| **M6** | Audit & Admin Console — immutable audit log, user management | ✅ Done |
| **M7** | Meeting Intelligence — transcript, speaker diarization, action items | ✅ Done |
| **M8** | Chrome Extension — Gmail compose/read integration | ✅ Done |
| **M9** | CrewAI Multi-Agent — 4 crews (10 agents), Cloudflare LLM bridge, pgvector RAG, audit persistence | ✅ Done |
| **M10** | Pilot Hardening — load testing, encryption review, failover, rate limiting | 🔲 In Progress |
| **M11** | Pilot Launch — onboard first firm, production monitoring, support runbook | 🔲 Planned |

---

## 🧭 Architecture Decisions

- **Why Cloudflare Workers AI + CrewAI?** Cloudflare's 61-model catalog (Llama 4 Scout, DeepSeek R1, etc.) runs at the edge with zero egress fees. CrewAI provides agent orchestration. Our `CloudflareLLM` bridge subclasses `BaseLLM` directly to bypass model-name validation.
- **Why PostgreSQL + pgvector instead of a dedicated vector DB?** One database to manage. pgvector HNSW indexes perform well into millions of vectors.
- **Why a separate Python service?** The Python ML ecosystem (HuggingFace, SentenceTransformers, CrewAI) is far more mature. Separate service = independent scaling.
- **Why Cloudflare R2?** S3-compatible API with zero egress fees. Legal documents are large.
- **Why JWT instead of sessions?** Stateless auth scales horizontally. JWT carries user + firm ID for fast tenant resolution.

---

## 📄 License

Proprietary — All rights reserved.
