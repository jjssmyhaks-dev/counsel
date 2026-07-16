# Counsel Platform — Code Domain Map

Segments the codebase into **Frontend**, **Backend API**, **AI Agents**, **Database**, **Chrome Extension**, **Scripts & Tooling**, and **Shared Types**.

---

## 🎨 Frontend (`apps/web/`)

| Path | Description |
|---|---|
| `apps/web/src/app/page.tsx` | Landing page — hero, product showcase, How It Works, Scale section |
| `apps/web/src/app/layout.tsx` | Root layout with SEO metadata, fonts (Inter + serif), global styles |
| `apps/web/src/app/globals.css` | Lovable green-serif design tokens (`#15b881`, `#0a8a5f`, `#fefdfb`, `#0c0a09`) |
| `apps/web/src/app/(auth)/login/page.tsx` | Split-layout login page (green panel + form), Password/SSO toggle |
| `apps/web/src/app/(auth)/register/page.tsx` | Register page with matching brand panel |
| `apps/web/src/app/dashboard/layout.tsx` | Authenticated dashboard shell — sidebar, header, tenant guard |
| `apps/web/src/app/dashboard/page.tsx` | Dashboard home — stats, recent activity, quick actions |
| `apps/web/src/app/dashboard/documents/page.tsx` | Document management page |
| `apps/web/src/app/dashboard/matters/page.tsx` | Legal matters overview page |
| `apps/web/src/app/dashboard/drafts/page.tsx` | Drafting interface (native green-serif, no shadcn) |
| `apps/web/src/app/dashboard/research/page.tsx` | Research query interface |
| `apps/web/src/app/dashboard/meetings/page.tsx` | Meeting intelligence page |
| `apps/web/src/app/dashboard/kb/page.tsx` | Knowledge Base / Ask The Firm page |
| `apps/web/src/app/dashboard/admin/page.tsx` | Admin & playbook editor |
| `apps/web/src/app/dashboard/settings/page.tsx` | Firm/user settings |
| `apps/web/src/components/Navbar.tsx` | Public navigation bar with responsive mobile menu |
| `apps/web/src/components/Footer.tsx` | Shared footer (applied to all public pages) |
| `apps/web/src/components/HeroPreview.tsx` | Animated hero dashboard preview with 6 data-rich tabs |
| `apps/web/src/components/ProductShowcase.tsx` | Product feature cards section |
| `apps/web/src/components/HowItWorks.tsx` | 3-step workflow visualization |
| `apps/web/src/components/ScaleSection.tsx` | Pricing/scale comparison section |
| `apps/web/src/components/CustomerStories.tsx` | Social proof carousel |
| `apps/web/src/components/ui/button.tsx` | Button primitive (Lovable green-serif fallback) |
| `apps/web/src/components/ui/card.tsx` | Card primitive |
| `apps/web/src/components/ui/badge.tsx` | Badge/tag component |
| `apps/web/src/lib/api.ts` | API client with auto-fallback to mock data |
| `apps/web/src/lib/auth.ts` | Auth utilities (token management, middleware) |
| `apps/web/src/lib/types.ts` | Frontend TypeScript type definitions |
| `apps/web/src/middleware.ts` | Next.js middleware — route protection, tenant resolution |
| `apps/web/next.config.ts` | Next.js config (rewrites, images, env) |
| `apps/web/tailwind.config.ts` | Tailwind config with Lovable brand colors |

---

## ⚙️ Backend API (`apps/api/`)

| Path | Description |
|---|---|
| `apps/api/src/index.ts` | Express server entry point (port 3001) |
| `apps/api/src/middleware/auth.ts` | JWT auth middleware + public path allowlist + SSO routes |
| `apps/api/src/middleware/errorHandler.ts` | Global error handler with structured error responses |
| `apps/api/src/routes/auth.ts` | POST login/register/refresh/me + SSO authorize/callback |
| `apps/api/src/routes/documents.ts` | Document upload, list, get, delete, analyze |
| `apps/api/src/routes/matters.ts` | Matter CRUD + research trigger |
| `apps/api/src/routes/users.ts` | User management (admin) |
| `apps/api/src/routes/jobs.ts` | Background job status tracking |
| `apps/api/src/routes/kb.ts` | Knowledge Base RAG query endpoint |
| `apps/api/src/lib/jwt.ts` | JWT sign/verify/refresh utilities |
| `apps/api/src/lib/workos.ts` | WorkOS SSO client (SAML/OIDC integration) |
| `apps/api/src/lib/ai-client.ts` | Proxy client forwarding AI requests to Python service (:8000) |
| `apps/api/.env` | API environment variables (JWT secret, WorkOS keys, AI service URL) |

---

## 🤖 AI Agents (`services/ai/`)

### Multi-Agent Crews (CrewAI)

| Path | Description |
|---|---|
| `services/ai/src/agents/crews.py` | 4 crew definitions + full pipeline orchestrator — all async with `kickoff_async()` |
| `services/ai/src/agents/tasks.py` | 10 CrewAI Task builders (clause extraction, risk analysis, drafting, research, compliance) |
| `services/ai/src/agents/definitions.py` | 10 Agent definitions with Cloudflare LLM configurations |
| `services/ai/src/agents/cloudflare_llm.py` | `CloudflareLLM` — CrewAI-compatible bridge (BaseLLM subclass, sync httpx, no model validation) |

### Orchestration & Audit

| Path | Description |
|---|---|
| `services/ai/src/orchestrator/router.py` | Request router dispatching to correct crew |
| `services/ai/src/orchestrator/pipeline_orchestrator.py` | Pipeline coordinator for full contract flow |
| `services/ai/src/orchestrator/audit_agent.py` | Immutable audit trail singleton (in-memory + observer pattern) |
| `services/ai/src/orchestrator/audit_persistence.py` | JSONL file persistence with date rotation (10 MB chunks) |
| `services/ai/src/orchestrator/structured_logging.py` | JSONL crew execution logs — task_start/complete/error/crew_complete events + step_callbacks |
| `services/ai/src/orchestrator/retry.py` | `@with_retry(crew_name)` decorator — exponential backoff, retryable exception filtering |

### RAG Pipeline (pgvector)

| Path | Description |
|---|---|
| `services/ai/src/embeddings/embedder.py` | Cloudflare bge-base-en-v1.5 embedder (768-dim) with local fallback |
| `services/ai/src/rag/retriever.py` | pgvector cosine similarity search + chunk indexing |
| `services/ai/src/rag/pipeline.py` | Full RAG pipeline (ingest → chunk → embed → search → synthesize) |
| `services/ai/src/db/client.py` | asyncpg connection pool + `document_chunks` table management (vector(768)) |

### Analysis & Drafting

| Path | Description |
|---|---|
| `services/ai/src/analysis/contract_analyzer.py` | Standalone contract analysis (pre-CrewAI fallback) |
| `services/ai/src/analysis/clause_extractor.py` | Clause type identification + extraction logic |
| `services/ai/src/drafting/draft_generator.py` | Standalone draft generation (pre-CrewAI fallback) |

### Providers & Config

| Path | Description |
|---|---|
| `services/ai/src/providers/cloudflare.py` | Cloudflare Workers AI API client (61 models, health check) |
| `services/ai/src/config.py` | Pydantic settings — database URL, Cloudflare credentials, model IDs |
| `services/ai/src/main.py` | FastAPI app entry point — router mounting, startup hooks, audit persistence wiring |
| `services/ai/src/routes/agents.py` | 5 FastAPI endpoints (analyze/draft/research/compliance/pipeline) |
| `services/ai/requirements.txt` | Python dependencies (crewai, httpx, asyncpg, pydantic, etc.) |
| `services/ai/.env` | AI service environment variables |

### Indexing & Data Scripts

| Path | Description |
|---|---|
| `services/ai/scripts/index_cf_embeddings.py` | Index 4 sample legal docs → 16 chunks × 768-dim Cloudflare embeddings |
| `services/ai/scripts/index_sample_docs.py` | Alternative indexing script (local embeddings fallback) |
| `services/ai/logs/audit-2026-07-16.jsonl` | 8 audit trail entries (production runs) |
| `services/ai/logs/crew-2026-07-16.jsonl` | Structured crew execution log |

---

## 🗄️ Database (`packages/database/`)

| Path | Description |
|---|---|
| `packages/database/prisma/schema.prisma` | Prisma schema — 16 models (firms, users, documents, matters, document_chunks, audit_log, playbook_rules) with pgvector |
| `packages/database/prisma/seed.ts` | Seed data — Sterling & Associates firm, 3 users, 3 matters, 8 playbook rules |
| `packages/database/.env` | Database connection string (Neon serverless, Singapore region) |

---

## 🧩 Chrome Extension (`extensions/chrome/`)

| Path | Description |
|---|---|
| `extensions/chrome/manifest.json` | Manifest V3 — Gmail compose/read injection permissions |

---

## 🔧 Scripts & Tooling (`scripts/`)

| Path | Description |
|---|---|
| `scripts/test-auth.cjs` | Auth flow E2E test (login, register, SSO) |
| `scripts/test-ai-agents.cjs` | Test all 8 standalone AI agents via HTTP |
| `scripts/test-c1-only.cjs` | Crew 1 (Document Intelligence) verification |
| `scripts/test-c2-c4-pipeline.cjs` | Crews 2-4 + Full Pipeline verification |
| `scripts/check-frontend.cjs` | Frontend page status checker |
| `scripts/check-links.mjs` | Dead link scanner |
| `scripts/check-theme.js` | Theme drift audit |
| `scripts/check-product.js` | Product page consistency check |
| `scripts/check-firm.cjs` | Firm lookup utility (Prisma query) |
| `scripts/start-ai.bat` | Windows batch launcher for Python AI service |
| `scripts/verify-all.py` | pgvector + audit log verification |
| `scripts/start-api.mjs` | Express API launcher |
| `scripts/e2e-auth-test.cjs` | Full auth E2E (register → login → dashboard) |

---

## 📦 Root & Config

| Path | Description |
|---|---|
| `package.json` | Monorepo root — workspace config, scripts, dependencies |
| `.gitignore` | Git ignore rules |
| `README.md` | Project documentation — architecture, getting started, API reference |

---

## 📊 Domain Summary

| Domain | Files | Key Technologies |
|---|---|---|
| **Frontend** | ~25 | Next.js 15, Tailwind CSS, Lovable green-serif theme |
| **Backend API** | ~12 | Express, TypeScript, JWT, WorkOS SSO, BullMQ |
| **AI Agents** | ~22 | CrewAI (10 agents, 4 crews), Cloudflare Workers AI (Llama 4 Scout, DeepSeek R1), pgvector, SentenceTransformers |
| **Database** | 3 | Prisma, PostgreSQL, pgvector (768-dim) |
| **Chrome Extension** | 1 | Manifest V3, Gmail hooks |
| **Scripts** | ~12 | Node.js test runners, theme/link auditors |
