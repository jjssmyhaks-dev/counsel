# Counsel — AI Workforce for Professional Firms

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![Python](https://img.shields.io/badge/Python-FastAPI-blue?logo=python)](https://fastapi.tiangolo.com/)
[![CrewAI](https://img.shields.io/badge/CrewAI-Multi--Agent-green)](https://crewai.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17+pgvector-blue?logo=postgresql)](https://www.postgresql.org/)
[![Cloudflare Workers AI](https://img.shields.io/badge/Cloudflare-Workers_AI-orange?logo=cloudflare)](https://developers.cloudflare.com/workers-ai/)
[![Status](https://img.shields.io/badge/status-production--ready-brightgreen)]()
[![Deploy](https://img.shields.io/badge/deploy-Oracle_Cloud%2BCloudflare-%2300C4B3)](docs/ORACLE-DEPLOY.md)
[![Cost](https://img.shields.io/badge/running_cost-%240%2Fmonth-brightgreen)]()

An AI workforce platform that deploys 25+ specialized agents across legal, consulting, and chartered accountancy firms — automating document analysis, contract review, legal research, proposal generation, GST reconciliation, audit automation, and compliance tracking.

**100% free to run in production** using Oracle Cloud Always Free + Cloudflare free tier.

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
│                 counsel.ai (DNS, SSL, DDoS)                │
│                 Cloudflare (FREE)                           │
└──────┬──────────────────────────────┬──────────────────────┘
       │                              │
┌──────▼──────────────┐    ┌──────────▼──────────────────────┐
│ Cloudflare Pages     │    │ Cloudflare Tunnel               │
│ Next.js 15 (44 pages)│    │ (secure bridge, no open ports)  │
│ • Landing, Auth,     │    │                                 │
│   Dashboard, CA      │    │ api.counsel.ai → localhost:3001 │
│ • Chat Copilot,      │    │ ai.counsel.ai  → localhost:8000 │
│   Settings, Admin    │    │                                 │
│ • Unlimited bandwidth │    │                                 │
│ • 330+ edge locations │    │                                 │
│ • $0/month forever   │    │                                 │
└──────────────────────┘    └──────────┬──────────────────────┘
                                       │
                         ┌─────────────▼──────────────────────┐
                         │  Oracle Cloud Ampere A1 (FREE)      │
                         │  4 OCPU, 24 GB RAM, 200 GB SSD      │
                         │  Ubuntu 22.04 LTS                   │
                         │                                     │
                         │  ┌─────────────────────────────┐   │
                         │  │ PM2 Process Manager (20 svc) │   │
                         │  ├─────────────────────────────┤   │
                         │  │ counsel-api    (Express)    │   │
                         │  │ counsel-ai     (FastAPI)    │   │
                         │  │ counsel-web    (Next.js)    │   │
                         │  │ MCP Servers ×17 (Python)    │   │
                         │  └─────────────────────────────┘   │
                         │                                     │
                         │  PostgreSQL 17 + pgvector           │
                         │  Nginx reverse proxy + certbot SSL  │
                         │  $0/month forever                   │
                         └─────────────────────────────────────┘
```

---

## 🚀 Deploy to Production ($0/month)

### One-command deployment to Oracle Cloud Always Free

```bash
# 1. Provision Oracle VM (5 min in Oracle Console — see docs/ORACLE-DEPLOY.md)
# 2. SSH in and run the setup script
ssh ubuntu@<oracle-vm-ip>
curl -O https://raw.githubusercontent.com/jjssmyhaks-dev/counsel/main/scripts/oracle-setup.sh
chmod +x oracle-setup.sh
sudo -E ./oracle-setup.sh

# 3. Optional: Add Cloudflare Tunnel for zero open ports
sudo ./oracle-setup-tunnel.sh

# 4. Deploy frontend to Cloudflare Pages (see docs/CLOUDFLARE-PAGES.md)
```

This single script installs Node 22, Python 3.12, PostgreSQL 17, Nginx, PM2, clones the repo, installs all dependencies, runs database migrations, seeds demo data, starts all 20 services, configures SSL via Let's Encrypt, and sets up automatic restart on reboot.

**Total monthly cost: $0.00** — Oracle Cloud Always Free (4 cores, 24GB RAM) + Cloudflare free tier.

### Deployment Guides

| Guide | Description |
|-------|-------------|
| [Oracle Cloud Deployment](docs/ORACLE-DEPLOY.md) | Step-by-step VM provisioning + DNS + monitoring |
| [Cloudflare Pages Deploy](docs/CLOUDFLARE-PAGES.md) | Frontend deploy to Cloudflare Pages (free, unlimited bandwidth) |
| [Production Runbook](docs/RUNBOOK.md) | Startup, stopping, logs, health checks, failure modes, rollback |
| [Vercel Deploy](apps/web/VERCEL_DEPLOY.md) | Alternative: deploy frontend to Vercel |

### Quick Start (Local Development)

```bash
node scripts/start-dev.cjs
```

This starts the API server (port 3001), Next.js frontend (port 3000), and AI service (port 8000).

### Prerequisites

- Node.js 22+
- Python 3.12+
- PostgreSQL 17+ with pgvector extension
- Cloudflare Workers AI account (for embeddings + LLM)

### Manual Setup Steps

**1. Install dependencies:**
```bash
cd counsel-platform
npm install --legacy-peer-deps
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
cd packages/database
npx prisma generate
npx prisma db push
npx prisma db seed
```

**4. Start everything:**
```bash
node scripts/start-dev.cjs
```

Or individually:
```bash
# API server
cd apps/api && npx tsx src/index.ts    # Port 3001

# AI Service (separate terminal)
cd services/ai && python -m uvicorn src.main:app --host 127.0.0.1 --port 8000

# Web frontend
cd apps/web && npx next dev -p 3000

# MCP Servers (all 17 at once)
node scripts/start-mcp-servers.cjs
```

**5. Production mode with PM2:**
```bash
pm2 start ecosystem.config.cjs
pm2 status
pm2 logs
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
| **MCP Servers** | 17 deployed (78 tools, all verified) |
| **Dynamic Pages** | 47 (landing, auth, dashboard, CA, admin, integrations) |
| **Database Models** | 16 (Prisma) |
| **API Endpoints** | 80+ REST routes |
| **Production Cost** | $0/month (Oracle Always Free + Cloudflare Free) |
| **TypeScript Errors** | 0 (web), 81 pre-existing in API tests |

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
| [Oracle Cloud Deploy](docs/ORACLE-DEPLOY.md) | Step-by-step Oracle VM provisioning ($0/month production) |
| [Cloudflare Pages Deploy](docs/CLOUDFLARE-PAGES.md) | Frontend deploy to Cloudflare Pages (free, unlimited) |
| [Production Runbook](docs/RUNBOOK.md) | Startup, stopping, logs, health checks, failure modes, rollback |
| [Vercel Deploy](apps/web/VERCEL_DEPLOY.md) | Alternative: deploy frontend to Vercel |
| [User Journey](docs/USER-JOURNEY.md) | Complete 10-step user flow, integration setup guide, agent architecture, MCP server inventory |
| [Code Map](CODE_MAP.md) | Detailed file-by-file project map |
| [Local Dev Guide](LOCAL_DEV.md) | Local development setup and conventions |
| [ADR: Tool Calling Bridge](docs/adr/001-tool-calling-bridge.md) | Decision record for MCP-to-CrewAI bridge |
| [ADR: Audit Trail Decorator](docs/adr/002-audit-trail-decorator.md) | Decision record for audit trail architecture |
| [API README](apps/api/README.md) | API-specific documentation |
| [Nginx README](nginx/README.md) | Reverse proxy configuration |

---

## 📄 License

Proprietary — All rights reserved.
