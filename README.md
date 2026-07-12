# Counsel — AI Workforce Suite for Legal & Consulting Firms

A B2B AI suite that gives every employee at a legal or consulting firm an AI copilot embedded in their existing workflow. Counsel ingests the firm's documents, learns its institutional voice, and delivers AI-powered contract analysis, research synthesis, drafting assistance, and meeting intelligence — all tenant-isolated, auditable, and secure.

---

## 🏗 Architecture

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router) + Tailwind CSS |
| Core API | Node.js + Express + TypeScript |
| AI Service | Python FastAPI + SentenceTransformers |
| Database | PostgreSQL + pgvector (vector search) |
| ORM | Prisma with multi-tenant RLS |
| Queue | Redis/BullMQ (async processing) |
| Storage | Cloudflare R2 (document storage) |
| Extension | Chrome Manifest V3 (Gmail integration) |
| Auth | JWT-based with SSO readiness |

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
│           ├── app/            # App Router pages
│           ├── components/     # UI, layout, feature components
│           ├── hooks/          # Custom React hooks
│           └── lib/            # API client, auth, types
├── packages/
│   └── database/              # Prisma schema, migrations, seeds
├── services/
│   └── ai/                    # Python AI/ML service
│       └── src/
│           ├── parsers/        # PDF, DOCX, TXT parsers
│           ├── chunking/       # Semantic chunker for legal docs
│           ├── embeddings/     # SentenceTransformer embedder
│           ├── rag/            # Retrieval-augmented generation pipeline
│           ├── analysis/       # M1: Contract analysis
│           ├── synthesis/      # M2: Research synthesis
│           ├── drafting/       # M3: Draft generation
│           └── meetings/       # M4: Meeting processing
└── extensions/
    └── chrome/                # Chrome/Gmail browser extension
```

## 🚀 Getting Started

### Prerequisites
- Node.js 22+
- Python 3.11+
- PostgreSQL 15+ with pgvector extension
- npm 10+

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

**5. Start the AI service (optional — required for AI features):**
```bash
cd services/ai
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000
```

### Demo Credentials
- **Email:** admin@demo-firm.com
- **Password:** password

The seed script provisions a demo firm with sample documents, matters, and a handful of users so you can explore every module immediately.

---

## 🔐 Multi-Tenancy & Security

- **Row-Level Security (RLS):** Every query is scoped to the current firm via Postgres RLS policies. Accidentally forgetting a WHERE clause cannot leak cross-tenant data.
- **Tenant Context Middleware:** `withTenantContext(firmId, callback)` wraps every request — sets the runtime tenant variable that RLS policies rely on.
- **Audit Trail:** Immutable append-only log of all AI actions (who queried what, when, and with what result). Stored in `audit_log` table.
- **Document Encryption:** Envelope encryption with per-firm data keys managed via Cloudflare R2 SSE-C.
- **No Training on Customer Data:** Contractual guarantee backed by technical controls — all AI prompts are logged and scrubbed before any upstream provider sees them.

---

## 🧩 Core Modules (MVP)

| Module | Description | Endpoint |
|--------|-------------|----------|
| **M1: Contract Analysis** | Auto-summary, clause extraction, risk flagging against firm playbook | `POST /api/v1/documents/:id/analyze` |
| **M2: Research Synthesis** | Multi-source research briefs with citations and confidence scores | `POST /api/v1/matters/:id/research` |
| **M3: Drafting Assistant** | Email, memo, report drafting in the firm's institutional voice | `POST /api/v1/drafts` |
| **M4: Meeting Intelligence** | Transcript → action items, decisions, follow-ups | `POST /api/v1/meetings/transcripts` |
| **M5: Ask the Firm** | RAG over the entire firm knowledge base with inline citations | `POST /api/v1/kb/query` |

---

## 🔌 API Overview

Base URL: `http://localhost:3001/api/v1`

All endpoints require a `Bearer` token in the `Authorization` header. Every request is automatically tenant-scoped — the tenant is derived from the authenticated user's firm membership.

### Authentication

```
POST /api/v1/auth/login          # Email + password → JWT
POST /api/v1/auth/refresh        # Refresh token → new access token
GET  /api/v1/auth/me             # Current user profile
```

### Documents

```
POST   /api/v1/documents/upload   # Upload & index a document
GET    /api/v1/documents/:id      # Get document metadata
DELETE /api/v1/documents/:id      # Soft-delete a document
POST   /api/v1/documents/:id/analyze  # Run contract analysis (M1)
```

### Matters

```
GET    /api/v1/matters            # List firm matters
POST   /api/v1/matters            # Create a matter
GET    /api/v1/matters/:id        # Get matter detail
POST   /api/v1/matters/:id/research  # Run research synthesis (M2)
```

### Drafts

```
POST   /api/v1/drafts             # Generate draft (M3)
GET    /api/v1/drafts/:id         # Get draft status/result
```

### Knowledge Base

```
POST   /api/v1/kb/query           # RAG query (M5: Ask the Firm)
GET    /api/v1/kb/stats           # Index statistics
```

### Meetings

```
POST   /api/v1/meetings/transcripts   # Process transcript (M4)
GET    /api/v1/meetings/:id           # Get meeting analysis
```

### Audit & Admin

```
GET    /api/v1/audit              # Query audit log
GET    /api/v1/admin/users        # List firm users
POST   /api/v1/admin/playbook     # Update firm playbook rules
```

For full request/response shapes, see the PRD document.

---

## 🧪 Testing

```bash
# Run all API tests
npm -w apps/api run test

# Lint the entire monorepo
npm run lint

# Type-check TypeScript
npm run typecheck
```

---

## 📋 Environment Variables

### API (`apps/api/.env`)
```
PORT=3001
JWT_SECRET=your-secret-key
JWT_EXPIRY=24h
DATABASE_URL=postgresql://user:password@localhost:5432/counsel
R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<access-key>
R2_SECRET_ACCESS_KEY=<secret-key>
R2_BUCKET=counsel-documents
REDIS_URL=redis://localhost:6379
AI_SERVICE_URL=http://localhost:8000
```

### Web (`apps/web/.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
NEXT_PUBLIC_APP_NAME=Counsel
```

### AI Service (`services/ai/.env`)
```
DATABASE_URL=postgresql://user:password@localhost:5432/counsel
EMBEDDING_MODEL=all-MiniLM-L6-v2
EMBEDDING_DIM=384
CHUNK_SIZE=512
CHUNK_OVERLAP=64
```

---

## 🏛 Build Plan Progress

| Milestone | Description | Status |
|-----------|-------------|--------|
| **M0** | Foundations — auth, RLS, tenant context, project scaffolding | ✅ Done |
| **M1** | Document Pipeline — upload, parse (PDF/DOCX/TXT), semantic chunk, embed, pgvector index | ✅ Done |
| **M2** | Contract Analysis — two-pass analysis, playbook-based rule engine, risk flagging | ✅ Done |
| **M3** | Ask the Firm — RAG query engine, hybrid search, inline citations, source confidence | ✅ Done |
| **M4** | Research Synthesis — map-reduce across sources, cross-source reconciliation, structured briefs | ✅ Done |
| **M5** | Drafting Assistant — style exemplars, template library, firm-voice adaptation | ✅ Done |
| **M6** | Audit & Admin Console — immutable audit log, user management, playbook editor | ✅ Done |
| **M7** | Meeting Intelligence — transcript ingestion, speaker diarization, action-item extraction | ✅ Done |
| **M8** | Chrome Extension — Gmail compose/read integration, one-click analysis, draft reply | ✅ Done |
| **M9** | Pilot Hardening — load testing, encryption review, failover, rate limiting | 🔲 In Progress |
| **M10** | Pilot Launch — onboard first firm, production monitoring, support runbook | 🔲 Planned |

---

## 🧭 Architecture Decisions

- **Why PostgreSQL + pgvector instead of a dedicated vector DB?** Keeps operational complexity low. One database to manage, back up, and secure. pgvector's HNSW indexes perform well into millions of vectors — more than enough for a single firm's document corpus.
- **Why a separate Python service instead of doing AI in Node?** The Python ML ecosystem (HuggingFace, SentenceTransformers, llama-cpp-python) is far more mature. Keeping it in a separate service also lets us scale the AI tier independently.
- **Why Cloudflare R2?** S3-compatible API with zero egress fees. Legal documents are large, and egress charges on AWS S3 or GCP Cloud Storage would be significant.
- **Why JWT instead of sessions?** Stateless auth scales horizontally with no shared session store. The JWT carries the user ID and firm ID, making tenant resolution fast at the middleware level.
- **Why BullMQ?** AI operations (document parsing, embedding, analysis) can take seconds to minutes. BullMQ gives us reliable job processing with retries, scheduling, and a dashboard — backed by Redis, which we already run.

---

## 🤝 Contributing

This is a proprietary product. Internal contributors should follow the [Developer Guide](./docs/DEVELOPER.md) and the branching strategy below:

1. Create a feature branch from `main`: `feat/Mxx-description`
2. Write tests for new functionality
3. Open a PR with a description and linked issue
4. CI must pass (lint, typecheck, tests)
5. At least one review required before merge

---

## 📄 License

Proprietary — All rights reserved. Unauthorized copying, distribution, or use is strictly prohibited.
