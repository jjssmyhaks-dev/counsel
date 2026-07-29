# Counsel — AI Workforce for Professional Firms

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![Python](https://img.shields.io/badge/Python-FastAPI-blue?logo=python)](https://fastapi.tiangolo.com/)
[![CrewAI](https://img.shields.io/badge/CrewAI-Multi--Agent-green)](https://crewai.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+pgvector-blue?logo=postgresql)](https://www.postgresql.org/)
[![Cloudflare Workers AI](https://img.shields.io/badge/Cloudflare-Workers_AI-orange?logo=cloudflare)](https://developers.cloudflare.com/workers-ai/)
[![Status](https://img.shields.io/badge/status-production--ready-brightgreen)]()

An AI workforce platform that deploys 25+ specialized agents across legal, consulting, and chartered accountancy firms — automating document analysis, contract review, legal research, proposal generation, GST reconciliation, audit automation, and compliance tracking.

---

## ✨ Platform Features

| Category | Capability | Legal | Consulting | CA |
|----------|-----------|:-----:|:----------:|:--:|
| **Document Intelligence** | Contract clause extraction (23+ types), risk scoring (1-10), playbook enforcement | ✅ | — | — |
| **Drafting Assistant** | AI-generated legal documents, proposals, SOWs, pitch decks with citations | ✅ | ✅ | — |
| **Legal Research** | pgvector semantic search + CourtListener case law, cited memoranda | ✅ | — | — |
| **Compliance Checker** | GDPR, CCPA, SOC 2, ISO 27001 validation on all AI outputs | ✅ | ✅ | ✅ |
| **Negotiation Advisor** | Counter-positions, market data, fallback strategies for every contract issue | ✅ | — | — |
| **Market Intelligence** | SWOT, competitive landscapes, TAM/SAM/SOM, strategic frameworks | — | ✅ | — |
| **Financial Modeling** | ROI analysis, Monte Carlo simulations, cost-benefit assessments | — | ✅ | — |
| **Engagement Management** | WBS, resource plans, risk registers, stakeholder maps, status reports | — | ✅ | — |
| **RFP Analysis** | Parse complex RFPs, extract requirements, identify win themes, disqualifiers | — | ✅ | — |
| **Bookkeeping Reconciliation** | Bank-to-book matching, variance analysis, partner-ready reports | — | — | ✅ |
| **GST Reconciliation** | GSTR-2A ITC matching, GSTR-1/3B/9 validation, filing prep (partner-review) | — | — | ✅ |
| **Audit Automation** | SA 315 risk assessment, SA 530 sampling, SA 700 report compilation | — | — | ✅ |
| **Income Tax** | TDS reconciliation (26AS), ITR data aggregation, notice response drafting | — | — | ✅ |
| **ROC Compliance** | MCA filing deadline tracking, form data compilation, unified compliance calendar | — | — | ✅ |
| **Chat Copilot** | AI chat with full firm knowledge base access | ✅ | ✅ | ✅ |
| **Integrations** | 25 MCP servers: Gmail, Calendar, DocuSign, Stripe, Salesforce, Slack, CourtListener, GST, Tally & more | ✅ | ✅ | ✅ |
| **Multi-Tenancy** | PostgreSQL RLS, per-firm document indexes, isolated playbooks | ✅ | ✅ | ✅ |
| **Audit Trail** | Immutable append-only logs (database + JSONL), every AI action tracked | ✅ | ✅ | ✅ |
| **SSO** | WorkOS SAML/OIDC enterprise single sign-on | ✅ | ✅ | ✅ |
| **Chrome Extension** | Manifest V3 Gmail compose/read integration | ✅ | — | — |

---

## 🏗 Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    Browser / Chrome Ext                     │
└──────────────────────────┬─────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼─────────────────────────────────┐
│   Next.js 15 (App Router)  ─  43 Dynamic Pages              │
│   • Landing, Auth, Dashboard, Documents, Drafts, Research   │
│   • Admin (Playbook, Users, Audit), Chat Copilot, Settings  │
│   • CA: Reconciliation, GST, Audit, Compliance, Clients     │
└──────────────────────────┬─────────────────────────────────┘
                           │ REST API (3001)
┌──────────────────────────▼─────────────────────────────────┐
│   Node.js Express API  ─  Port 3001                         │
│   • Auth (JWT + WorkOS SSO), Tenant RLS, Audit Middleware    │
│   • Routes: Documents, Matters, Drafts, KB, Playbook, etc.  │
└──────────────┬────────────────────────┬───────────────────┘
               │                        │
┌──────────────▼──────────┐  ┌──────────▼────────────────────┐
│  PostgreSQL 15+pgvector │  │  Python FastAPI  ─  Port 8000  │
│  • 16 Prisma models     │  │  • CrewAI Multi-Agent (25)     │
│  • RLS per firm         │  │  • Cloudflare LLM Bridge       │
│  • HNSW vector index    │  │  • pgvector RAG retriever      │
└──────┬─────────────────┘  │  • Audit trail persistence      │
       │                    └──────────────┬──────────────────┘
       │                                   │
┌──────▼───────────────────────────────────▼──────────────────┐
│   MCP Servers (25)  ─  Ports 3100–3124                      │
│   Tier 1: Registry, PostgreSQL, Cloudflare AI, Document RAG  │
│   Tier 2: Email, Calendar, Storage, E-Sign, Billing, Court,  │
│           Communication, CRM                                 │
│   Tier 3: Workflow, OCR, Translation, Video, Time, Conflict  │
│   CA Only: GSP, MCA, UDIN, Tally, ERI, Books, WhatsApp       │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│   External Services: Cloudflare Workers AI, Gmail, Google    │
│   Calendar, DocuSign, Stripe, Salesforce, Slack, CourtListener│
│   GST Portal, Income Tax Portal, MCA21, Tally, Zoho Books    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

**One command to start the entire development environment:**

```bash
node scripts/start-dev.cjs
```

This starts the API server (port 3001), Next.js frontend (port 3000), and verifies connectivity. For the AI service and MCP servers, see below.

### Prerequisites

- Node.js 22+
- Python 3.11+
- PostgreSQL 15+ with pgvector extension
- Docker Desktop (for MCP servers)
- Cloudflare Workers AI account (for embeddings + LLM)

### Step-by-Step Setup

**1. Install dependencies:**
```bash
cd counsel-platform
npm install
cd services/mcp && npm install --legacy-peer-deps && cd ../..
cd services/ai && pip install -r requirements.txt && cd ../..
```

**2. Configure environment variables:**
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
# Edit with your DATABASE_URL, Cloudflare credentials, etc.
```

**3. Set up the database:**
```bash
createdb counsel
psql counsel -c "CREATE EXTENSION IF NOT EXISTS vector;"
npm run db:migrate
npm run db:seed
```

**4. Start everything:**
```bash
# Frontend + API
npm run dev:web     # Port 3000
npm run dev:api     # Port 3001

# AI Service (separate terminal)
cd services/ai
uvicorn src.main:app --host 127.0.0.1 --port 8000

# MCP Servers (optional, Docker required)
cd services/mcp
docker compose --profile mcp up -d
```

**5. Index sample documents (optional):**
```bash
cd services/ai
python scripts/index_cf_embeddings.py
```

### Demo Credentials

| Field | Value |
|-------|-------|
| **Email** | admin@sterling.law |
| **Password** | password |
| **Role** | James Sterling, Partner, Sterling & Associates |

The seed script provisions a demo firm with sample documents, matters, and users.

---

## 📊 Current Status

| Metric | Value |
|--------|-------|
| **Status** | 🟢 Production-ready |
| **AI Agents** | 31 operational across 9 crews |
| **MCP Servers** | 25 deployed (~145 tools) |
| **Dynamic Pages** | 43 (including landing, auth, dashboard, CA sub-pages) |
| **Database Models** | 16 (Prisma) |
| **API Endpoints** | 40+ REST routes |
| **Pipeline Stages** | M0–M9 complete, M10 hardening in progress |

---

## 📁 Project Structure

```
counsel-platform/
├── apps/
│   ├── api/                    # Node.js Express API (port 3001)
│   │   └── src/
│   │       ├── middleware/      # Auth, tenant RLS, audit, RBAC, validation
│   │       ├── routes/          # 18 route files (documents, matters, drafts, kb, etc.)
│   │       ├── lib/             # JWT, errors, R2 client, WorkOS, AI client, email
│   │       └── workers/         # BullMQ job worker
│   └── web/                    # Next.js 15 frontend (port 3000)
│       └── src/
│           ├── app/            # 43 dynamic pages (landing, auth, dashboard, CA)
│           ├── components/     # UI kit, layout, document analysis, draft editor, etc.
│           ├── hooks/          # Custom React hooks
│           └── lib/            # API client, auth, types
├── packages/
│   └── database/              # Prisma schema (16 models), migrations, seed data
├── services/
│   ├── ai/                    # Python FastAPI AI Service (port 8000)
│   │   └── src/
│   │       ├── agents/         # 31 CrewAI agents (definitions, crews, tasks, MCP bridge)
│   │       ├── orchestrator/   # Pipeline orchestration + audit trail
│   │       ├── rag/            # pgvector retriever (cosine similarity)
│   │       └── routes/         # FastAPI route handlers
│   └── mcp/                   # 25 Model Context Protocol servers (ports 3100-3124)
│       ├── registry/           # :3100 Service discovery
│       ├── postgres-mcp/       # :3101 Database tools
│       ├── cloudflare-mcp/     # :3102 AI + embeddings
│       ├── document-mcp/       # :3103 pgvector RAG
│       ├── email-mcp/          # :3104 Gmail/Outlook
│       ├── calendar-mcp/       # :3105 Google/Outlook Calendar
│       ├── storage-mcp/        # :3106 S3/GCS/SharePoint
│       ├── esign-mcp/          # :3107 DocuSign/HelloSign
│       ├── billing-mcp/        # :3108 Stripe
│       ├── court-mcp/          # :3109 CourtListener
│       ├── communication-mcp/  # :3110 Slack/Teams
│       ├── crm-mcp/            # :3111 Salesforce/Clio/HubSpot
│       ├── workflow-mcp/       # :3112 Zapier/n8n/Make
│       ├── ocr-mcp/            # :3113 AWS Textract/Azure DocIntel
│       ├── translation-mcp/    # :3114 DeepL/Azure Translator
│       ├── video-mcp/          # :3115 Zoom/Teams Meetings
│       ├── time-mcp/           # :3116 Harvest/Toggl
│       ├── conflict-mcp/       # :3117 Conflict of Interest
│       ├── gsp-mcp/            # :3118 GST Suvidha Provider
│       ├── mca-mcp/            # :3119 MCA21/ROC
│       ├── udin-mcp/           # :3120 UDIN (ICAI)
│       ├── tally-mcp/          # :3121 Tally connector
│       ├── eri-mcp/            # :3122 Income Tax ERI
│       ├── books-mcp/          # :3123 Zoho Books/QuickBooks
│       ├── whatsapp-mcp/       # :3124 WhatsApp Business
│       ├── prometheus/         # Monitoring config + 6 alert rules
│       └── grafana/            # 25 dashboards (auto-provisioned)
├── extensions/
│   └── chrome/                # Chrome Manifest V3 Gmail extension
├── nginx/                     # Production reverse proxy + SSL
├── scripts/                   # Start scripts, test scripts
└── docs/                      # Documentation
    ├── USER-JOURNEY.md        # Complete user journey (10-step flow)
    └── adr/                   # Architecture Decision Records
```

---

## 🔌 API Overview

Base URL: `http://localhost:3001/api/v1`

All endpoints require a `Bearer` token. Every request is tenant-scoped.

### Authentication

```
POST /api/v1/auth/login          # Email + password → JWT
POST /api/v1/auth/register       # Create firm + admin user
POST /api/v1/auth/sso/authorize  # WorkOS SSO (SAML/OIDC)
POST /api/v1/auth/refresh        # Refresh token
GET  /api/v1/auth/me             # Current user profile
```

### Multi-Agent AI (port 8000)

```
POST /agents/analyze/contract    # Crew 1: Document Intelligence (3 agents)
POST /agents/draft               # Crew 2: Drafting Assistant (2 agents)
POST /agents/research            # Crew 3: Research & Discovery (2 agents)
POST /agents/compliance          # Crew 4: Compliance & Negotiation (2 agents)
POST /agents/pipeline/full       # Full pipeline (all 4 crews)
POST /agents/proposal            # Crew 5: Proposal Generation (3 agents)
POST /agents/market-intel        # Crew 6: Market Intelligence (2 agents)
POST /agents/engagement          # Crew 7: Engagement Management (2 agents)
POST /agents/ca/bookkeeping      # Crew 9: Bookkeeping Reconciliation (3 agents)
POST /agents/ca/gst              # Crew 10: GST Reconciliation (3 agents)
POST /agents/ca/audit            # Crew 11: Audit Automation (3 agents)
POST /agents/ca/income-tax       # Crew 12: Income Tax (3 agents)
POST /agents/ca/roc              # Crew 13: ROC Compliance (3 agents)
GET  /agents/status              # Agent system health + model info
```

### Core Resources

```
# Documents
POST   /api/v1/documents/upload   # Upload & index document
GET    /api/v1/documents/:id      # Document metadata + analysis
GET    /api/v1/documents          # List firm documents
DELETE /api/v1/documents/:id      # Soft-delete document

# Matters, Drafts, KB, Meetings
GET    /api/v1/matters            # List firm matters
POST   /api/v1/drafts             # Generate AI draft
POST   /api/v1/kb/query           # RAG query (Ask the Firm)
POST   /api/v1/meetings/transcripts # Process transcript
```

---

## 🤖 CrewAI Multi-Agent System

### Legal Vertical (4 Crews, 9 Agents)

| Crew | Agents | Flow | Endpoint |
|------|--------|------|----------|
| **Document Intelligence** | ClauseExtractor → RiskAnalyzer → PlaybookGuardian | Extract → Score → Validate | `POST /agents/analyze/contract` |
| **Drafting** | LegalDrafter → CitationValidator | Generate → Validate citations | `POST /agents/draft` |
| **Research** | LegalResearcher → RAGSynthesizer | Search → Synthesize into memo | `POST /agents/research` |
| **Compliance** | ComplianceChecker → NegotiatorAdvisor | Check → Advise counter-positions | `POST /agents/compliance` |

### Consulting Vertical (3 Crews, 6 Agents)

| Crew | Agents | Flow | Endpoint |
|------|--------|------|----------|
| **Proposal** | RFPAnalyzer → ProposalWriter → FinancialModeler | Analyze RFP → Write → Model costs | `POST /agents/proposal` |
| **Market Intel** | MarketIntelligenceAnalyst → StrategicAdvisor | Research market → Synthesize strategy | `POST /agents/market-intel` |
| **Engagement** | EngagementManager → StrategicAdvisor | Structure → Status report | `POST /agents/engagement` |

### CA Vertical (5 Crews, 15 Agents)

| Crew | Agents | Flow | Endpoint |
|------|--------|------|----------|
| **Bookkeeping** | TransactionMatcher → VarianceAnalyzer → ReconciliationReporter | Match → Analyze → Report | `POST /agents/ca/bookkeeping` |
| **GST** | InputTaxReconciler → GSTRValidator → FilingPrepAdvisor | Reconcile ITC → Validate → Prep package | `POST /agents/ca/gst` |
| **Audit** | RiskAssessmentEngine → SamplingRecommendation → AuditReportCompiler | Assess → Sample → Compile report | `POST /agents/ca/audit` |
| **Income Tax** | TDSReconciler → ITRDataAggregator → NoticeResponseDrafter | Reconcile TDS → Aggregate → Draft responses | `POST /agents/ca/income-tax` |
| **ROC** | FilingDeadlineTracker → FormDataCompiler → ComplianceCalendarManager | Track deadlines → Compile → Manage calendar | `POST /agents/ca/roc` |

### LLM Architecture

Three-tier model selection per agent task complexity:

| Tier | Model | Use Case | Temperature |
|------|-------|----------|-------------|
| **Default** | Llama 4 Scout (17B) | Low-creativity tasks (extraction, validation, citation) | 0.05–0.1 |
| **Power** | Llama 3.3 70B | High-creativity tasks (drafting, synthesis, negotiation) | 0.15–0.4 |
| **Reasoning** | DeepSeek R1 | Complex reasoning (research, risk assessment, financial modeling) | Model-default |

---

## 🔐 Multi-Tenancy & Security

- **Row-Level Security (RLS):** Every query scoped to current firm via PostgreSQL RLS policies
- **Tenant Context Middleware:** `withTenantContext(firmId, callback)` wraps every request
- **Audit Trail:** Immutable append-only log — database table + date-rotated JSONL files (10 MB chunks)
- **Document Encryption:** Envelope encryption with per-firm data keys (Cloudflare R2 SSE-C)
- **No Training on Customer Data:** All AI prompts logged and scrubbed before reaching upstream providers
- **CA Non-Negotiable Guardrails:** No auto-filing to government portals; all filing-bound numbers carry provenance; UDIN/DSC signing always manual; PAN/GSTIN data never used for model training

---

## 🧪 Testing

```bash
# Auth flow
node scripts/test-auth.cjs

# Standalone AI agent test (all agents)
node scripts/test-ai-agents.cjs

# Crew 1: Document Intelligence (3-agent pipeline)
node scripts/test-c1-only.cjs

# Crews 2-4 + Full Pipeline
node scripts/test-c2-c4-pipeline.cjs

# All links + theme verification
node scripts/test-links.cjs

# Lint + typecheck
npm run lint
npm run typecheck
```

---

## 🧭 Architecture Decisions

- **Why Cloudflare Workers AI + CrewAI?** 61-model catalog at the edge with zero egress fees. CrewAI for agent orchestration. Custom `CloudflareLLM` bridge bypasses model-name validation by subclassing `BaseLLM` directly.
- **Why PostgreSQL + pgvector?** One database. pgvector HNSW performs well into millions of vectors. No separate vector DB to manage.
- **Why a separate Python service?** Python ML ecosystem (CrewAI, HuggingFace, SentenceTransformers) is more mature. Independent scaling.
- **Why Cloudflare R2?** S3-compatible with zero egress fees. Legal documents are large.
- **Why JWT instead of sessions?** Stateless auth scales horizontally. JWT carries user + firm ID for fast tenant resolution.

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [User Journey](docs/USER-JOURNEY.md) | Complete 10-step user flow, integration setup guide, agent architecture, MCP server inventory |
| [Code Map](CODE_MAP.md) | Detailed file-by-file project map |
| [Local Dev Guide](LOCAL_DEV.md) | Local development setup and conventions |
| [Deployment Guide](DEPLOY.md) | Production deployment instructions |
| [ADR: Tool Calling Bridge](docs/adr/001-tool-calling-bridge.md) | Decision record for MCP-to-CrewAI bridge |
| [ADR: Audit Trail Decorator](docs/adr/002-audit-trail-decorator.md) | Decision record for audit trail architecture |
| [API README](apps/api/README.md) | API-specific documentation |
| [Nginx README](nginx/README.md) | Reverse proxy configuration |

---

## 📄 License

Proprietary — All rights reserved.
