# Counsel — AI Workforce Suite for Legal & Consulting Firms

A B2B AI suite that gives every employee at a legal or consulting firm an AI copilot embedded in their existing workflow. Counsel ingests the firm's documents, learns its institutional voice, and delivers AI-powered contract analysis, research synthesis, drafting assistance, and meeting intelligence — all tenant-isolated, auditable, and secure.

---

## 🏗 Architecture

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router) + Tailwind CSS (Lovable green-serif theme) |
| Core API | Node.js + Express + TypeScript |
| AI Service | Python FastAPI + CrewAI Multi-Agent (10 agents, 4 crews) + Cloudflare Workers AI (Llama 4 Scout 17B, Llama 3.3 70B, DeepSeek R1) |
| Embeddings | Cloudflare bge-base-en-v1.5 (768-dim) via pgvector HNSW |
| Database | PostgreSQL + pgvector (vector search) |
| ORM | Prisma with multi-tenant RLS |
| Queue | Redis/BullMQ (async processing) |
| Storage | Cloudflare R2 (document storage) |
| Extension | Chrome Manifest V3 (Gmail integration) |
| Auth | JWT-based + WorkOS SSO (SAML/OIDC) |

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
│   └── ai/                    # Python AI/ML service
│       ├── logs/               # Audit trail JSONL (date-rotated, 10 MB chunks)
│       ├── scripts/            # Indexing + verification scripts
│       └── src/
│           ├── agents/         # CrewAI multi-agent crews (4 crews, 10 agents)
│           │   ├── crews.py            # Crew definitions + full pipeline orchestrator
│           │   ├── tasks.py            # Task builders (clause extraction, risk, etc.)
│           │   ├── definitions.py      # Agent LLM configs (Cloudflare Workers AI)
│           │   └── cloudflare_llm.py   # CrewAI-compatible Cloudflare LLM bridge
│           ├── orchestrator/   # Pipeline orchestration + audit trail
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

**6. Index sample documents for RAG (optional):**
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

Four specialized crews, each a sequential pipeline of specialized agents powered by Cloudflare Workers AI:

| Crew | Agents | Endpoint | Status |
|------|--------|----------|--------|
| **Crew 1: Document Intelligence** | ClauseExtractor → RiskAnalyzer → PlaybookGuardian | `POST /agents/analyze/contract` | ✅ |
| **Crew 2: Drafting** | LegalDrafter → CitationValidator | `POST /agents/draft` | ✅ |
| **Crew 3: Research & Discovery** | pgvector RAG → LegalResearcher → RAGSynthesizer | `POST /agents/research` | ✅ |
| **Crew 4: Compliance & Negotiation** | AuditLogger → ComplianceChecker → NegotiatorAdvisor | `POST /agents/compliance` | ✅ |
| **Full Pipeline** | All 4 crews chained | `POST /agents/pipeline/full` | ✅ |

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
