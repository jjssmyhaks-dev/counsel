# Counsel AI — Agent Architecture

## Overview

Counsel is an autonomous multi-agent system built on [CrewAI](https://www.crewai.com/) and powered by [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/). It orchestrates **31 agents across 13 crews** spanning three professional verticals — Legal, Consulting, and Chartered Accountancy (CA) — to handle contract analysis, research synthesis, document drafting, bookkeeping, tax compliance, and strategic advisory tasks.

Every agent operates within a **guardrails harness** that enforces rate limiting, prompt injection detection, PII redaction, output validation, and cost budgets. A **self-learning feedback loop** tracks outcomes and adjusts behavior over time. A **5-dimension eval framework** scores every output for quality, and a **regression detection system** alerts when quality drops.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        User (Chat UI)                               │
│                    POST /api/v1/chat/message                        │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Autonomous Chat Engine                            │
│  ┌──────────────┐ ┌──────────┐ ┌───────────┐ ┌──────────────────┐  │
│  │ Conversation  │ │  Task    │ │ Guardrails│ │   Eval Framework │  │
│  │ Memory       │ │ Planner  │ │  (Safety) │ │   (Quality)      │  │
│  └──────┬───────┘ └────┬─────┘ └─────┬─────┘ └────────┬─────────┘  │
│         │              │              │                 │            │
│  ┌──────┴───────┐ ┌────┴─────┐ ┌─────┴─────┐ ┌────────┴─────────┐  │
│  │ Conversation  │ │Autonomous│ │  Cost     │ │  Feedback Loop   │  │
│  │ Memory       │ │ Executor │ │  Control  │ │  (Self-Learning) │  │
│  └──────────────┘ └────┬─────┘ └───────────┘ └──────────────────┘  │
│                        │                                            │
│  ┌─────────────────────┴─────────────────────────────────────────┐  │
│  │                   Security (RBAC + Audit)                     │  │
│  └─────────────────────┬─────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ dispatch
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     CrewAI Agent Registry                           │
│                                                                     │
│  LEGAL (4 crews)  │  CONSULTING (3 crews)  │  CA (5 crews)         │
│  10 agents        │  6 agents              │  15 agents            │
│                   │                        │                       │
│  C1: Doc Intel    │  C5: Proposal          │  C9:  Bookkeeping     │
│  C2: Drafting     │  C6: Market Intel      │  C10: GST             │
│  C3: Research     │  C7: Engagement        │  C11: Audit           │
│  C4: Compliance   │                        │  C12: Income Tax      │
│                   │                        │  C13: ROC              │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ MCP Bridge
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     MCP Servers (17 servers)                        │
│  postgres │ cloudflare │ document │ email │ calendar │ crm │ ...   │
│  storage  │ video      │ translation │ esign │ ocr │ court │ ...  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Agent Inventory

### Legal Vertical — 4 Crews, 10 Agents

| Crew | Agent | Role | LLM Tier | Temperature |
|------|-------|------|----------|-------------|
| **C1: Document Intelligence** | ClauseExtractor | Senior Contract Clause Extraction Specialist | Default (17B) | 0.10 |
| | RiskAnalyzer | Contract Risk Assessment Analyst | Power (70B) | 0.20 |
| | PlaybookGuardian | Playbook Compliance Guardian | Power (70B) | 0.15 |
| **C2: Drafting** | LegalDrafter | Legal Document Drafting Specialist | Power (70B) | 0.40 |
| | CitationValidator | Legal Citation Validation Specialist | Default (17B) | 0.05 |
| **C3: Research** | LegalResearcher | Legal Research Strategist | Reasoning (R1) | default |
| | RAGSynthesizer | Legal Research Synthesis Expert | Power (70B) | 0.25 |
| **C4: Compliance** | ComplianceChecker | Regulatory Compliance Verification Specialist | Default (17B) | 0.10 |
| | NegotiatorAdvisor | Legal Negotiation Strategy Advisor | Power (70B) | 0.35 |
| | AuditLogger | (built into pipeline) | — | — |

**Crew 1 — Document Intelligence Flow:**
```
Document → ClauseExtractor (23+ clause types)
         → RiskAnalyzer (score 1-10, negotiation recs)
         → PlaybookGuardian (firm rule enforcement)
```

**Crew 2 — Drafting Flow:**
```
Prompt + Context → LegalDrafter (few-shot, firm voice)
                 → CitationValidator (Bluebook/ALWD format)
```

**Crew 3 — Research Flow:**
```
Query → LegalResearcher (decompose + search RAG)
      → RAGSynthesizer (cite sources + confidence levels)
```

**Crew 4 — Compliance Flow:**
```
Output → ComplianceChecker (GDPR/CCPA/SOC2/ISO27001)
       → NegotiatorAdvisor (counter-positions + fallbacks)
```

---

### Consulting Vertical — 3 Crews, 6 Agents

| Crew | Agent | Role | LLM Tier | Temperature |
|------|-------|------|----------|-------------|
| **C5: Proposal** | RFPAnalyzer | RFP & Bid Analysis Specialist | Default (17B) | 0.10 |
| | ProposalWriter | Senior Proposal & Pitch Specialist | Power (70B) | 0.40 |
| | FinancialModeler | Financial Modeling & Analytics Specialist | Reasoning (R1) | default |
| **C6: Market Intel** | MarketIntelAnalyst | Market Intelligence & Competitive Analysis | Reasoning (R1) | default |
| | StrategicAdvisor | Strategy & Transformation Advisory | Power (70B) | 0.30 |
| **C7: Engagement** | EngagementManager | Engagement Delivery & PMO Specialist | Power (70B) | 0.25 |

**Crew 5 — Proposal Flow:**
```
RFP → RFPAnalyzer (extract requirements + win themes)
    → ProposalWriter (exec summary, methodology, pricing)
    → FinancialModeler (ROI, Monte Carlo, sensitivity analysis)
```

---

### CA Vertical — 5 Crews, 15 Agents

| Crew | Agent | Role | LLM Tier | Temperature |
|------|-------|------|----------|-------------|
| **C9: Bookkeeping** | TransactionMatcher | Transaction Matcher | Default (17B) | 0.05 |
| | VarianceAnalyzer | Variance Analyzer | Default (17B) | 0.05 |
| | ReconciliationReporter | Reconciliation Reporter | Reasoning (R1) | default |
| **C10: GST** | InputTaxReconciler | Input Tax Reconciler | Default (17B) | 0.05 |
| | GSTRValidator | GSTR Validator | Default (17B) | 0.05 |
| | FilingPrepAdvisor | Filing Prep Advisor | Reasoning (R1) | default |
| **C11: Audit** | RiskAssessmentEngine | Risk Assessment Engine | Reasoning (R1) | default |
| | SamplingRecommendation | Sampling Recommendation Agent | Default (17B) | 0.05 |
| | AuditReportCompiler | Audit Report Compiler | Reasoning (R1) | default |
| **C12: Income Tax** | TDSReconciler | TDS Reconciler | Default (17B) | 0.05 |
| | ITRDataAggregator | ITR Data Aggregator | Default (17B) | 0.05 |
| | NoticeResponseDrafter | Notice Response Drafter | Reasoning (R1) | default |
| **C13: ROC** | FilingDeadlineTracker | Filing Deadline Tracker | Default (17B) | 0.05 |
| | FormDataCompiler | Form Data Compiler | Default (17B) | 0.05 |
| | ComplianceCalendarManager | Compliance Calendar Manager | Reasoning (R1) | default |

**CA Non-Negotiable Guardrails (enforced in every CA agent):**
- No auto-filing to any government portal
- All filing-bound numbers carry provenance (source document → agent → step)
- UDIN/DSC signing always requires manual human action
- PAN/GSTIN data never used for model training
- Every output marked "DRAFT — CA REVIEW REQUIRED"

---

## LLM Architecture

Three-tier model selection based on task complexity:

| Tier | Model | Provider | Use Case | Cost (per 1K tokens) |
|------|-------|----------|----------|---------------------|
| **Default** | Llama 4 Scout (17B) | Cloudflare Workers AI | Extraction, validation, matching, citation | $0.0011 |
| **Power** | Llama 3.3 70B | Cloudflare Workers AI | Drafting, synthesis, negotiation, strategy | $0.0059 |
| **Reasoning** | DeepSeek R1 (32B distill) | Cloudflare Workers AI | Research, risk assessment, financial modeling | $0.0038 |

The `CloudflareLLM` class (`services/ai/src/agents/cloudflare_llm.py`) is a custom CrewAI-compatible bridge that subclasses `BaseLLM` directly to bypass model-name validation. It uses synchronous `httpx` for thread-pool compatibility with CrewAI's execution model. Falls back from Power → Default on failure.

---

## Orchestrator Components

### Autonomous Chat Engine (`autonomous_chat.py`)

The main entry point for chat-first interactions. For each user message:

1. **Load/create conversation thread** — with full message history
2. **Build LLM context** — from history + entity tracking + task history
3. **Plan execution** — LLM decomposes the request into steps
4. **Enforce guardrails** — rate limiting, injection detection, PII redaction
5. **Execute steps** — with approval gates for filing/financial actions
6. **Evaluate output** — 5-dimension scoring (heuristic + optional LLM-as-judge)
7. **Record feedback** — track success/failure for self-learning
8. **Return response** — with entities, actions, and tool suggestions

### Task Planner (`task_planner.py`)

LLM-based task decomposition. Breaks complex requests into ordered steps, each assigned to the appropriate crew/agent. Supports:
- Single-crew execution (simple requests)
- Cross-crew chaining (e.g., research → draft → compliance check)
- Approval gates (filed actions require human confirmation)

### Autonomous Executor (`autonomous_executor.py`)

Runs planned steps sequentially with:
- Per-step retry logic (exponential backoff: 2s → 4s, max 2 retries)
- Error classification (retryable vs. permanent)
- Progress callbacks for streaming updates
- Audit trail logging for every action

### Conversation Memory (`conversation_memory.py`)

Thread-scoped memory that tracks:
- Full message history per thread
- Extracted entities (client names, matter numbers, dates, amounts)
- Task execution history within the thread
- User preferences (learned over time)

---

## Safety & Guardrails (`guardrails.py`)

### Rate Limiting

| Limit | Value | Scope |
|-------|-------|-------|
| Requests per minute | 30 | Per firm |
| Requests per hour | 200 | Per firm |
| Concurrent executions | 5 | Per firm |
| Tokens per hour | 500,000 | Per firm |

### Prompt Injection Detection

10+ regex patterns detect and block:
- "Ignore previous instructions" variants
- Role hijacking ("You are now a...")
- System prompt injection (`[INST]`, `<|im_start|>`, etc.)
- Instruction override attempts

### PII Detection & Redaction

Detects and redacts before sending to LLM:
- Indian PAN (format: `ABCDE1234F`)
- GSTIN (format: `22AAAAA0000A1Z5`)
- Aadhaar (12-digit)
- Email addresses
- Phone numbers (Indian format)
- IFSC codes

### Output Validation

- Hallucination detection (checks citation references exist)
- Prompt injection in outputs (re-scans LLM output)
- Legal disclaimer enforcement for CA outputs
- Confidence threshold checks

---

## Self-Learning Feedback Loop (`feedback_loop.py`)

Tracks outcomes per tool/crew per firm:

| Feedback Type | Signal | Source |
|---------------|--------|--------|
| `explicit_positive` | Thumbs up | Chat UI button |
| `explicit_negative` | Thumbs down | Chat UI button |
| `implicit_positive` | User continued conversation | Message sequence |
| `implicit_negative` | User rephrased/retried | Message pattern |
| `task_success` | Step completed without error | Executor |
| `task_failure` | Step failed | Executor |
| `approval_granted` | User approved filing step | Approval gate |
| `approval_denied` | User denied filing step | Approval gate |

**Learning mechanisms:**
- Per-firm tool preference scores (weighted by success rate + satisfaction)
- Global error pattern tracking (anonymized across firms)
- Regression detection (compares recent 24h vs. 7-day baseline)
- Failure mode recording for retry strategy improvement

---

## Eval Framework (`evals.py`)

### 5 Quality Dimensions

| Dimension | Weight | What It Measures |
|-----------|--------|------------------|
| **Relevance** | 25% | Does the output address the query? |
| **Completeness** | 20% | Does it cover all aspects of the request? |
| **Accuracy** | 25% | Are facts, legal citations, and numbers correct? |
| **Safety** | 15% | Does it avoid harmful, biased, or leaked content? |
| **Usability** | 15% | Is it actionable, well-structured, and clear? |

### Evaluation Modes

1. **Heuristic evals** (fast, always runs) — word overlap, length checks, structure detection
2. **LLM-as-judge** (accurate, optional) — sends output to a separate LLM call for quality assessment

### Regression Detection

- Compares last 24 hours vs. previous 7 days
- Flags when overall quality drops >15% from baseline
- Per-tool regression detection (minimum 3 recent + 5 baseline samples)
- Alerts via Slack webhook, email (Resend), or generic webhook

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/evals/report` | GET | Quality report for the firm |
| `/api/v1/evals/benchmarks` | GET | Per-tool benchmark statistics |
| `/api/v1/evals/regressions` | GET | Detect quality regressions |
| `/api/v1/evals/feedback` | GET/POST | List or persist feedback |
| `/api/v1/evals/tool/:name` | GET | Single tool deep-dive |
| `/api/v1/evals/score` | POST | Internal scoring (AI service) |

---

## Cost Control (`cost_control.py`)

### Per-Plan Budgets

| Plan | Tokens/Month | Max Concurrent | Cost Cap (USD) |
|------|-------------|----------------|-----------------|
| Free | 10,000 | 1 | $0.01 |
| Starter | 50,000 | 2 | $0.05 |
| Professional | 500,000 | 5 | $0.50 |
| Business | 2,000,000 | 10 | $2.00 |
| Enterprise | 10,000,000 | 50 | $10.00 |

### Circuit Breaker

When a firm exceeds budget or hits repeated errors:
- Circuit opens for 5 minutes
- All AI requests rejected with clear error message
- Auto-resolves after cooldown period

---

## Security (`security.py`)

### RBAC Enforcement

| Role | Permissions |
|------|-------------|
| `super_admin` | All firm settings, billing, RBAC management |
| `admin` | Invite members, manage roles, view audit logs |
| `member` | Full feature access, chat, documents, matters |
| `viewer` | Read-only access to all firm data |

### Orchestrator-Level Security

Every tool/crew execution is checked:
- User role must have permission for the requested action
- Filing actions restricted to admin+ roles
- Financial modifications require explicit approval
- All actions logged to immutable audit trail

### Audit Trail

- Database table (`AuditLog`) — every API action
- JSONL file logger — date-rotated, 10 MB chunks
- In-memory observer pattern — real-time tracking during execution
- Fields: timestamp, user, firm, action, resource, input/output hashes

---

## MCP Bridge (`agents/mcp_client.py`)

Agents access external tools through MCP (Model Context Protocol) servers:

| MCP Server | Port | Purpose | Status |
|------------|------|---------|--------|
| `postgres` | 5001 | Database CRUD (asyncpg) | ✅ Real |
| `cloudflare` | 5002 | LLM + embeddings | ✅ Real |
| `document` | 5003 | pgvector semantic search | ✅ Real |
| `email` | 5004 | Resend API (branded emails) | ✅ Real |
| `calendar` | 5005 | Google Calendar API | 🔌 Needs API key |
| `storage` | 5006 | Cloudflare R2 (S3-compatible) | 🔌 Needs API key |
| `video` | 5007 | Zoom/Google Meet API | 🔌 Needs API key |
| `esign` | 5008 | DocuSign eSignature API | 🔌 Needs API key |
| `crm` | 5009 | Salesforce/Clio API | 🔌 Needs API key |
| `translation` | 5010 | DeepL API | 🔌 Needs API key |
| `ocr` | 5011 | AWS Textract | 🔌 Needs API key |
| `court` | 5012 | CourtListener API | 🔌 Needs API key |
| `conflict` | 5013 | PostgreSQL conflict check | ✅ Real |
| `workflow` | 5014 | n8n/Zapier webhooks | 🔌 Needs API key |
| `billing` | 5015 | Stripe/Razorpay | ✅ Real |
| `time` | 5016 | Harvest/Toggl API | 🔌 Needs API key |
| `communication` | 5017 | Slack/WhatsApp API | 🔌 Needs API key |

**MCP Bridge Flow:**
```
Agent → CrewAI Tool → MCP Client (httpx) → MCP Server → External API
                                                     → PostgreSQL
                                                     → pgvector
```

The MCP bridge gracefully degrades — if an MCP server is unreachable, agents continue without those tools rather than failing.

---

## File Structure

```
services/ai/src/
├── agents/
│   ├── definitions.py       # 31 agent definitions (Legal + Consulting + CA)
│   ├── crews.py             # 13 crew definitions + pipeline orchestrator
│   ├── tasks.py             # CrewAI task builders (617 lines)
│   ├── schemas.py           # Pydantic schemas for structured output
│   ├── tools.py             # CrewAI-compatible tool wrappers
│   ├── mcp_client.py        # MCP bridge — connects agents to MCP servers
│   └── cloudflare_llm.py    # Custom CrewAI LLM bridge for Cloudflare Workers AI
├── orchestrator/
│   ├── autonomous_chat.py   # Main chat entry point (autonomous engine)
│   ├── autonomous_executor.py # Step-by-step execution with retry
│   ├── task_planner.py      # LLM-based task decomposition
│   ├── conversation_memory.py # Thread memory + entity tracking
│   ├── guardrails.py        # Rate limiting, injection, PII, output validation
│   ├── evals.py             # 5-dimension quality scoring + regression detection
│   ├── feedback_loop.py     # Self-learning from outcomes
│   ├── quality_gate.py      # Output quality gate (hallucination, citation check)
│   ├── cost_control.py      # Token budgets + circuit breaker
│   ├── security.py          # RBAC at orchestrator level
│   ├── audit_agent.py       # Immutable audit trail
│   ├── audit_persistence.py # JSONL file logger
│   ├── structured_logging.py # JSONL crew execution logs
│   ├── retry.py             # @with_retry decorator (exponential backoff)
│   ├── pipeline_orchestrator.py # Multi-step pipeline coordinator
│   ├── alerts.py            # Regression alert system (Slack/email/webhook)
│   └── scalability.py       # Connection pooling + caching
├── mcp/                     # 17 MCP server implementations
├── rag/                     # pgvector retriever + RAG pipeline
├── embeddings/              # Cloudflare bge-base-en-v1.5 (768-dim)
├── analysis/                # Contract analysis, clause extraction
├── drafting/                # Document generation
├── chunking/                # Semantic text chunking
├── meetings/                # Meeting transcript processing
├── parsers/                 # PDF, DOCX, TXT parsers
├── providers/               # Cloudflare API client
├── db/                      # asyncpg connection pool
├── routes/                  # FastAPI route handlers
├── synthesis/               # Research synthesis
├── models/                  # Shared Pydantic schemas
└── config.py                # Pydantic settings
```

---

## Golden Test Dataset

`services/ai/tests/eval-golden/` contains 50+ curated test prompts:

| Vertical | Prompts | What's Tested |
|----------|---------|---------------|
| Legal | 20 | Clause extraction, risk analysis, drafting, research, compliance |
| Consulting | 15 | Proposals, market intel, financial modeling, engagements |
| CA | 15 | Bookkeeping, GST, audit, income tax, ROC compliance |

Run regression tests:
```bash
cd services/ai
python -m tests.eval_golden.run_evals
```

---

## Running Locally

```bash
# Start AI service (port 8000)
cd services/ai
python -m uvicorn src.main:app --host 0.0.0.0 --port 8000

# With Docker Compose (all services)
docker compose -f docker-compose.dev.yml up
```

### Health Check
```bash
curl http://localhost:8000/health
# → {"status": "ok", "agents": 31, "crews": 13, "mcp_servers": 17}
```
