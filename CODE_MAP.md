# Counsel Platform — Code Domain Map

> **Monorepo layout → domain mapping:**  
> `apps/web/` = Frontend · `apps/api/` = Backend · `services/ai/` = AI Agents · `packages/database/` = Database · `extensions/chrome/` = Chrome Extension · `scripts/` = Scripts

---

## 🎨 Frontend (`apps/web/`)

| File | Description |
|---|---|
| `app/page.tsx` | Landing page — hero, product showcase, How It Works, Scale section, social proof |
| `app/layout.tsx` | Root layout with SEO metadata, Inter + serif fonts, global styles |
| `app/globals.css` | Design tokens — Lovable green-serif theme (`#15b881` mint, `#0a8a5f` dark green, `#7ce3b6` light, `#fefdfb` warm bg, `#0c0a09` text), serif headings, dark mode |
| `app/(auth)/login/page.tsx` | Split-layout login: green brand panel + form with Password/SSO toggle |
| `app/(auth)/register/page.tsx` | Register page — matching brand panel, creates firm + admin user |
| `app/dashboard/layout.tsx` | Authenticated dashboard shell — sidebar navigation, header, tenant guard |
| `app/dashboard/page.tsx` | Dashboard home — KPI cards, recent activity feed, quick-action buttons |
| `app/dashboard/documents/page.tsx` | Document management — upload, list, view, analyze (green-serif, no shadcn) |
| `app/dashboard/matters/page.tsx` | Legal matters overview — matter cards, status badges, filters |
| `app/dashboard/drafts/page.tsx` | Drafting interface — type selector (email/memo/motion/brief/contract), instructions input |
| `app/dashboard/research/page.tsx` | Research query — jurisdiction picker, source filters, results display |
| `app/dashboard/meetings/page.tsx` | Meeting intelligence — transcript upload, action items, decisions extraction |
| `app/dashboard/kb/page.tsx` | Ask The Firm — RAG query with inline citations and confidence indicators |
| `app/dashboard/admin/page.tsx` | Admin panel — playbook rule editor, firm settings, user management |
| `app/dashboard/settings/page.tsx` | User/firm settings — profile, preferences, API keys |
| `components/Navbar.tsx` | Public navigation bar — responsive hamburger menu, CTA buttons |
| `components/Footer.tsx` | Shared footer — applied to all public pages (landing, pricing, product, resources) |
| `components/HeroPreview.tsx` | Animated dashboard preview — 6 data-rich tabs (contracts, matters, assistant, playbooks, research, meetings) with live badges |
| `components/ProductShowcase.tsx` | Feature cards section — AI-powered modules with illustrations |
| `components/HowItWorks.tsx` | 3-step workflow — Upload → Analyze → Act visualization |
| `components/ScaleSection.tsx` | Enterprise scale comparison table |
| `components/CustomerStories.tsx` | Social proof carousel — firm testimonials and logos |
| `components/ui/button.tsx` | Button primitive — Lovable green-serif variant with hover/active/disabled states |
| `components/ui/card.tsx` | Card primitive — border, shadow, header/content/footer slots |
| `components/ui/badge.tsx` | Badge/tag — variant colors (mint, amber, red, gray) for status indicators |
| `lib/api.ts` | API client — typed fetch wrapper with automatic mock data fallback on network error |
| `lib/auth.ts` | Auth utilities — token storage, refresh flow, logout |
| `lib/types.ts` | TypeScript types — User, Firm, Matter, Document, Draft, Meeting interfaces |
| `middleware.ts` | Next.js middleware — route protection, redirect unauthenticated to /login |
| `next.config.ts` | Next.js config — rewrites, image domains, env variables |
| `tailwind.config.ts` | Tailwind config — Lovable brand colors, serif font stack, custom utilities |
| `.env.local` | Frontend env — `NEXT_PUBLIC_API_URL`, WorkOS client ID |

---

## ⚙️ Backend (`apps/api/`)

| File | Description |
|---|---|
| `src/index.ts` | Express server entry — middleware stack, route mounting, error handler, port 3001 |
| `src/middleware/auth.ts` | JWT authentication middleware — token verification, public path allowlist, SSO bypass routes |
| `src/middleware/errorHandler.ts` | Global error handler — structured JSON error responses with stack traces in dev |
| `src/routes/auth.ts` | Auth routes — POST login/register/refresh/me, SSO authorize/callback |
| `src/routes/documents.ts` | Document routes — upload (multer), list, get by ID, delete (soft), analyze trigger |
| `src/routes/matters.ts` | Matter routes — CRUD operations, research trigger, document association |
| `src/routes/users.ts` | User management — list firm users, update roles (admin only) |
| `src/routes/jobs.ts` | Background job tracking — BullMQ job status, retry, cancel |
| `src/routes/kb.ts` | Knowledge Base — RAG query proxy to AI service, returns cited answers |
| `src/lib/jwt.ts` | JWT utilities — sign (HS256), verify, refresh, payload extraction |
| `src/lib/workos.ts` | WorkOS SSO client — SAML/OIDC authorization URL generation, profile retrieval |
| `src/lib/ai-client.ts` | AI proxy client — forwards requests to Python AI service on port 8000 |
| `.env` | Backend env — JWT secret, WorkOS credentials, AI service URL, database URL |

---

## 🤖 AI Agents (`services/ai/`)

### Agent System (CrewAI)

| File | Description |
|---|---|
| `src/agents/cloudflare_llm.py` | `CloudflareLLM` — CrewAI-compatible bridge. Subclasses `BaseLLM` directly to bypass model-name validation. Synchronous `httpx` call() for thread-pool compatibility. Falls back to 70B model on failure. |
| `src/agents/definitions.py` | **16 agent definitions** — 10 Legal + 6 Consulting. Legal: ClauseExtractor, RiskAnalyzer, PlaybookGuardian, LegalDrafter, CitationValidator, LegalResearcher, RAGSynthesizer, AuditLogger, ComplianceChecker, NegotiatorAdvisor. Consulting: ProposalWriter, MarketIntelAnalyst, StrategyAdvisor, RFPAnalyzer, EngagementManager, FinancialModeler. All configured with Cloudflare Workers AI (Llama 4 Scout 17B / Llama 3.3 70B / DeepSeek R1). |
| `src/agents/crews.py` | **7 crew definitions** + full pipeline orchestrator. Legal: C1 Document Intelligence, C2 Drafting, C3 Research & Discovery, C4 Compliance & Negotiation. Consulting: C5 Proposal Generation (RFPAnalyzer→ProposalWriter→FinancialModeler), C6 Market Intelligence (MarketIntelAnalyst→StrategyAdvisor), C7 Engagement Management (EngagementManager→StrategyAdvisor). All async with `kickoff_async()`. Wired with @with_retry(), step_callbacks, and auto audit trail logging. |
| `src/agents/tasks.py` | **13 CrewAI Task builders** — 10 Legal + 3 Consulting. Legal: clause extraction, risk analysis (1-10 scale), playbook compliance check, legal drafting, citation validation, legal research with RAG sources, memorandum synthesis, audit logging, compliance check (SOC 2/ISO 27001/GDPR), negotiation advice. Consulting: ProposalTasks (RFP analysis, proposal writing, financial modeling), MarketIntelTasks (market research, strategy synthesis), EngagementTasks (engagement structuring, status reporting). |

### Orchestration & Observability

| File | Description |
|---|---|
| `src/orchestrator/router.py` | Request router — dispatches to correct crew based on request type |
| `src/orchestrator/pipeline_orchestrator.py` | Pipeline coordinator — manages multi-step contract analysis flow |
| `src/orchestrator/audit_agent.py` | Immutable audit trail — in-memory singleton with observer pattern. Tracks every AI action with timestamp, user, firm, model, input/output hashes. |
| `src/orchestrator/audit_persistence.py` | JSONL file logger — persists audit entries to disk with date rotation (10 MB chunks). Wired at startup via `setup_audit_persistence()`. |
| `src/orchestrator/structured_logging.py` | JSONL crew execution logs — `task_start`, `task_complete`, `task_error`, `agent_step`, `crew_complete` events. `create_step_callback()` factory for CrewAI step callbacks. `CrewMetrics` class for per-task timing and token tracking. |
| `src/orchestrator/retry.py` | `@with_retry(crew_name, max_retries=2)` decorator — exponential backoff (2s→4s), retryable exception filtering (TimeoutError, ConnectionError, RuntimeError). Structured log events on retry. |

### RAG & Embeddings

| File | Description |
|---|---|
| `src/embeddings/embedder.py` | Cloudflare bge-base-en-v1.5 embedder — 768-dimensional vectors. Falls back to local SentenceTransformer if Cloudflare is unreachable. |
| `src/rag/retriever.py` | pgvector retriever — cosine similarity search, chunk indexing with ON CONFLICT upsert, document-scoped search filters |
| `src/rag/pipeline.py` | Full RAG pipeline — ingest → semantic chunk → embed → pgvector store → search → synthesize |
| `src/db/client.py` | asyncpg connection pool — `document_chunks` table management (vector(768)), `ensure_tables()` for schema auto-creation |

### Analysis & Generation

| File | Description |
|---|---|
| `src/analysis/contract_analyzer.py` | Standalone contract analysis engine (pre-CrewAI fallback) |
| `src/analysis/clause_extractor.py` | Clause type identification and extraction from legal text |
| `src/drafting/draft_generator.py` | Standalone draft generation (pre-CrewAI fallback) |

### API & Configuration

| File | Description |
|---|---|
| `src/main.py` | FastAPI application — lifespan hooks (Cloudflare init, audit persistence wiring), router mounting, CORS |
| `src/routes/agents.py` | 5 multi-agent endpoints — `POST /agents/analyze/contract`, `/draft`, `/research`, `/compliance`, `/pipeline/full`. Plus `GET /agents/status`. |
| `src/providers/cloudflare.py` | Cloudflare Workers AI API client — 61 models available, health check, embedding + text generation |
| `src/config.py` | Pydantic settings — database URL, Cloudflare credentials, model IDs, chunking parameters |
| `.env` | AI env — Cloudflare account ID, API token, model names, database connection string |
| `requirements.txt` | Python dependencies — crewai, httpx, asyncpg, pydantic, fastapi, uvicorn, python-dotenv |

### Data & Scripts

| File | Description |
|---|---|
| `scripts/index_cf_embeddings.py` | Index 4 sample legal documents into pgvector using Cloudflare 768-dim embeddings. Drops and recreates `document_chunks` table to ensure schema compatibility. |
| `scripts/index_sample_docs.py` | Alternative indexing with local SentenceTransformer fallback (384-dim) |
| `logs/audit-2026-07-16.jsonl` | Production audit trail — 8 entries from verified crew + pipeline runs |

---

## 🗄️ Database (`packages/database/`)

| File | Description |
|---|---|
| `prisma/schema.prisma` | Database schema — 16 models: `Firm`, `User`, `UserFirm`, `Document`, `DocumentChunk` (with pgvector 768-dim), `Matter`, `Draft`, `Meeting`, `MeetingActionItem`, `PlaybookRule`, `AuditLog`, `ApiKey`, `KbQuery`, `Job`, `Notification`, `Subscription`. PostgreSQL provider with pgvector extension. |
| `prisma/seed.ts` | Seed script — creates Sterling & Associates firm, 3 demo users (James Sterling/partner, associate, paralegal), 3 matters, 8 playbook rules, sample documents |
| `.env` | Database connection string (Neon serverless, Singapore region, ap-southeast-1) |

---

## 🧩 Chrome Extension (`extensions/chrome/`)

| File | Description |
|---|---|
| `manifest.json` | Manifest V3 — Gmail compose and read page injection permissions, content security policy, host permissions for `mail.google.com` |

---

## 🔧 Scripts (`scripts/`)

| File | Description |
|---|---|
| `test-auth.cjs` | Auth flow E2E test — POST login, register, refresh token, validate JWT structure |
| `test-ai-agents.cjs` | Standalone AI agent test — tests all 8 agents (Contract Analyzer, Draft Generator, Meeting Processor, Research Synthesizer, Document Parser, Embedding Engine, Orchestrator Router, Quality Gate) via HTTP |
| `test-c1-only.cjs` | Crew 1 (Document Intelligence) verification — ClauseExtractor → RiskAnalyzer → PlaybookGuardian, 3-agent sequential pipeline |
| `test-c2-c4-pipeline.cjs` | Crews 2 (Drafting), 3 (Research), 4 (Compliance) + Full Pipeline verification |
| `test-crew-agents.cjs` | Legacy crew test runner (pre-kickoff_async fix) |
| `test-all-crews.cjs` | All 4 crews + pipeline + audit trail comprehensive test |
| `check-frontend.cjs` | Frontend page availability checker — HTTP GET all dashboard pages, reports status codes |
| `check-links.mjs` | Dead link scanner — crawls landing page for broken `href` references |
| `check-theme.js` | Theme drift auditor — checks color token usage across all frontend pages |
| `check-product.js` | Product page consistency checker |
| `check-firm.cjs` | Firm lookup utility — Prisma query to find firm UUID and document IDs |
| `verify-all.py` | pgvector + audit log verification — chunk count, embedding dimension, audit entry count |
| `e2e-auth-test.cjs` | Full auth E2E — register new firm → login → access dashboard → logout |
| `start-ai.bat` | Windows batch launcher for Python AI service (`uvicorn src.main:app --port 8000`) |
| `start-api.mjs` | Express API launcher script |
| `test-consulting-crews.cjs` | Consulting crew test (C5 Proposal/C6 Market Intel/C7 Engagement) |
