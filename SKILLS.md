# Counsel AI — Skills Catalog

## What Counsel Can Do

Counsel is an AI workforce suite for Legal, Consulting, and CA firms. This document catalogs every skill (capability) the system offers — what it does, what it needs as input, what it produces, and which agents handle it.

---

## Legal Skills (Crews 1–4)

### 1. Contract Analysis & Clause Extraction
**Crew:** C1 — Document Intelligence (ClauseExtractor → RiskAnalyzer → PlaybookGuardian)

| Aspect | Detail |
|--------|--------|
| **Input** | Contract text (PDF/DOCX/txt) or pasted text |
| **What it does** | Identifies and classifies 23+ clause types (indemnification, limitation of liability, IP ownership, termination, governing law, confidentiality, non-compete, force majeure, etc.). Extracts exact text and computes confidence scores. |
| **Output** | JSON array of `{ clause_type, text, confidence, line_range }` |
| **CrewAI Endpoint** | `POST /agents/analyze/contract` |

### 2. Risk Scoring
**Crew:** C1 — Document Intelligence (RiskAnalyzer)

| Aspect | Detail |
|--------|--------|
| **Input** | Extracted clauses from skill #1 |
| **What it does** | Scores each clause on a 1–10 risk scale based on legal exposure, deviation from market standards, and financial impact. For high-risk clauses (7+), provides specific negotiation recommendations. |
| **Output** | JSON array of `{ clause_type, risk_score, rationale, negotiation_recommendation }` |

### 3. Playbook Compliance Check
**Crew:** C1 — Document Intelligence (PlaybookGuardian)

| Aspect | Detail |
|--------|--------|
| **Input** | Extracted clauses + firm's playbook rules (from `PlaybookRule` DB table) |
| **What it does** | Checks every contract clause against the firm's pre-defined playbook. For each rule: pass, violation, or missing. Calculates deviation metrics. |
| **Output** | JSON: `{ rules_checked, violations: [...], missing: [...], compliance_score }` |

### 4. Legal Document Drafting
**Crew:** C2 — Drafting (LegalDrafter → CitationValidator)

| Aspect | Detail |
|--------|--------|
| **Input** | Document type (memo, motion, brief, contract, NDA, email) + context + optional firm templates |
| **What it does** | Generates professional legal documents matching the firm's voice, tone, and formatting. Uses few-shot learning from firm examples. Validates all citations (Bluebook/ALWD format). |
| **Output** | Draft document text + citation validation report |
| **CrewAI Endpoint** | `POST /agents/draft` |

### 5. Legal Research
**Crew:** C3 — Research (LegalResearcher → RAGSynthesizer)

| Aspect | Detail |
|--------|--------|
| **Input** | Legal question or research topic |
| **What it does** | Decomposes complex questions into sub-queries. Searches the firm's entire knowledge base (documents, contracts, memos) via pgvector semantic search. Synthesizes findings into a cited memorandum. |
| **Output** | Research memo with source citations, confidence levels, and open questions |
| **CrewAI Endpoint** | `POST /agents/research` |

### 6. Regulatory Compliance Check
**Crew:** C4 — Compliance (ComplianceChecker)

| Aspect | Detail |
|--------|--------|
| **Input** | AI output or document + applicable regulations (GDPR, CCPA, SOC 2, ISO 27001) |
| **What it does** | Validates outputs against regulatory requirements. Flags compliance concerns including data residency, model bias, client confidentiality, and unauthorized practice of law. |
| **Output** | Compliance report: `{ passed, concerns: [...], risk_level }` |

### 7. Negotiation Strategy
**Crew:** C4 — Compliance (NegotiatorAdvisor)

| Aspect | Detail |
|--------|--------|
| **Input** | Contract issues identified by risk analysis + market context |
| **What it does** | Provides specific counter-positions, fallback positions, and negotiation tactics for each issue. Includes market data on what percentage of similar deals accept each position. |
| **Output** | JSON array of `{ issue, counter_position, fallback, tactic, market_data }` |

---

## Consulting Skills (Crews 5–7)

### 8. RFP Analysis
**Crew:** C5 — Proposal (RFPAnalyzer)

| Aspect | Detail |
|--------|--------|
| **Input** | RFP/RFQ/RFI document text |
| **What it does** | Parses complex RFPs to extract requirements, evaluation criteria, compliance checklists, win themes. Identifies disqualifiers, differentiators, and ghost criteria (unstated but implied). |
| **Output** | JSON: `{ requirements, evaluation_criteria, win_themes, disqualifiers, compliance_checklist }` |
| **CrewAI Endpoint** | `POST /agents/proposal` |

### 9. Proposal & Pitch Generation
**Crew:** C5 — Proposal (ProposalWriter)

| Aspect | Detail |
|--------|--------|
| **Input** | RFP analysis + client context + firm templates |
| **What it does** | Generates consulting proposals, SOWs, and pitch decks with executive summary, problem statement, methodology, team bios, timeline, and pricing. Matches firm's brand voice. |
| **Output** | Complete proposal document (markdown/structured) |

### 10. Financial Modeling
**Crew:** C5 — Proposal (FinancialModeler)

| Aspect | Detail |
|--------|--------|
| **Input** | Business case + financial parameters + scenarios |
| **What it does** | Builds ROI analyses, cost-benefit assessments, NPV/IRR calculations, sensitivity analyses, scenario planning, and Monte Carlo simulations. All assumptions documented. |
| **Output** | Financial model with scenarios, charts, and sensitivity tables |

### 11. Market Intelligence
**Crew:** C6 — Market Intel (MarketIntelAnalyst → StrategicAdvisor)

| Aspect | Detail |
|--------|--------|
| **Input** | Industry, market, or competitive question |
| **What it does** | SWOT analysis, competitive landscape mapping, TAM/SAM/SOM sizing, growth opportunity assessment. Applies Porter's Five Forces, BCG Matrix, and Blue Ocean frameworks. |
| **Output** | Market intelligence report with cited sources and confidence intervals |
| **CrewAI Endpoint** | `POST /agents/market-intel` |

### 12. Strategic Advisory
**Crew:** C6 — Market Intel (StrategicAdvisor)

| Aspect | Detail |
|--------|--------|
| **Input** | Client situation + business objectives |
| **What it does** | Generates strategic options with trade-off analyses, implementation roadmaps, resource requirements, and success metrics. |
| **Output** | Strategic options report with implementation plan |

### 13. Engagement Management
**Crew:** C7 — Engagement (EngagementManager)

| Aspect | Detail |
|--------|--------|
| **Input** | Project details, scope, timeline, team |
| **What it does** | Creates work breakdown structures, resource plans, risk registers, stakeholder maps, deliverable trackers. Generates status reports and steering committee decks. |
| **Output** | Engagement plan, status report, or steering committee deck |
| **CrewAI Endpoint** | `POST /agents/engagement` |

---

## CA Skills (Crews 9–13)

> **All CA skills carry non-negotiable guardrails:**
> - No auto-filing to any government portal
> - Every output marked "DRAFT — CA REVIEW REQUIRED"
> - All numbers carry provenance (source document → agent → step)
> - UDIN/DSC signing always manual
> - Professional liability disclaimers on every output

### 14. Bank Reconciliation (Bookkeeping)
**Crew:** C9 — Bookkeeping (TransactionMatcher → VarianceAnalyzer → ReconciliationReporter)

| Aspect | Detail |
|--------|--------|
| **Input** | Bank statement + trial balance / books |
| **What it does** | Matches bank entries to book entries by amount, date, narration. Categorizes variances (timing, GST ITC, bank charges, book-only entries). Produces partner-ready reconciliation report with confidence scores. |
| **Output** | Reconciliation report: match rate, variance breakdown, GST impact, action items |
| **CrewAI Endpoint** | `POST /agents/ca/bookkeeping` |

### 15. GST Reconciliation & Filing Prep
**Crew:** C10 — GST (InputTaxReconciler → GSTRValidator → FilingPrepAdvisor)

| Aspect | Detail |
|--------|--------|
| **Input** | GSTR-2A data + purchase register + sales register |
| **What it does** | Matches ITC from GSTR-2A against purchase register. Validates GSTR-1/3B/9 data. Compiles filing-ready packages. All mismatches flagged for partner review. |
| **Output** | ITC reconciliation report + GSTR validation report + filing-ready package |
| **CrewAI Endpoint** | `POST /agents/ca/gst` |

### 16. Audit Automation
**Crew:** C11 — Audit (RiskAssessmentEngine → SamplingRecommendation → AuditReportCompiler)

| Aspect | Detail |
|--------|--------|
| **Input** | Trial balance + financial statements + compliance data |
| **What it does** | Identifies audit risk areas per SA 315. Recommends sampling methodology per SA 530. Compiles audit report drafts per SA 700/705/706. Includes CARO 2020 annexure and Form 3CD data. |
| **Output** | Risk assessment + sampling plan + draft audit report |
| **CrewAI Endpoint** | `POST /agents/ca/audit` |

### 17. Income Tax (TDS Reconciliation + ITR Prep)
**Crew:** C12 — Income Tax (TDSReconciler → ITRDataAggregator → NoticeResponseDrafter)

| Aspect | Detail |
|--------|--------|
| **Input** | 26AS data + AIS pre-fill + client books |
| **What it does** | Reconciles TDS credits from 26AS against books. Aggregates ITR pre-fill data. Drafts responses to Income Tax notices (143(1), 148, 156, 245, etc.). |
| **Output** | TDS reconciliation + ITR data package + notice response drafts |
| **CrewAI Endpoint** | `POST /agents/ca/income-tax` |

### 18. ROC Compliance
**Crew:** C13 — ROC (FilingDeadlineTracker → FormDataCompiler → ComplianceCalendarManager)

| Aspect | Detail |
|--------|--------|
| **Input** | Company financials + board resolutions + compliance data |
| **What it does** | Tracks all ROC/MCA filing deadlines (AOC-4, MGT-7, DIR-3 KYC, ADT-1, etc.). Compiles form-ready data. Maintains unified compliance calendar with proactive alerts. |
| **Output** | Deadline tracker + form data packages + compliance calendar |
| **CrewAI Endpoint** | `POST /agents/ca/roc` |

---

## Core Platform Skills

### 19. Semantic Document Search (RAG)
**MCP Server:** document | **Engine:** pgvector

| Aspect | Detail |
|--------|--------|
| **Input** | Natural language query |
| **What it does** | Searches the firm's entire document corpus using pgvector cosine similarity (768-dim embeddings). Returns ranked results with relevance scores. |
| **Output** | `{ answer, confidence, source_chunks: [{ document_name, excerpt, relevance }] }` |
| **API Endpoint** | `POST /api/v1/kb/query` |

### 20. Document Upload & Indexing
**MCP Servers:** postgres, cloudflare | **Engine:** RAG pipeline

| Aspect | Detail |
|--------|--------|
| **Input** | File (PDF, DOCX, TXT, CSV) |
| **What it does** | Parses document → semantic chunking → Cloudflare bge-base-en-v1.5 embedding (768-dim) → pgvector HNSW indexing. Supports envelope encryption (R2 SSE-C). |
| **Output** | Document metadata + chunk count + embedding status |
| **API Endpoint** | `POST /api/v1/documents/upload` |

### 21. Chat Interface (Autonomous)
**Engine:** Autonomous Chat Engine

| Aspect | Detail |
|--------|--------|
| **Input** | Natural language message + optional context (tool, thread) |
| **What it does** | Classifies intent, plans multi-step execution, dispatches to appropriate crew(s), manages approval gates, evaluates output quality, returns response with actions and suggestions. |
| **Output** | `{ content, thread_id, actions, tool_suggestions, entities, requires_approval }` |
| **API Endpoint** | `POST /api/v1/chat/message` |

### 22. Meeting Intelligence
**MCP Server:** communication | **Engine:** meeting_processor.py

| Aspect | Detail |
|--------|--------|
| **Input** | Meeting transcript (text) |
| **What it does** | Extracts action items, decisions, key topics, and participant roles from meeting transcripts. Generates meeting summaries. |
| **Output** | `{ summary, action_items: [...], decisions: [...], participants: [...] }` |
| **API Endpoint** | `POST /api/v1/meetings/transcripts` |

### 23. AI Draft Generation
**Crew:** C2 — Drafting | **API Route:** drafts

| Aspect | Detail |
|--------|--------|
| **Input** | Document type + context + optional templates |
| **What it does** | Generates AI-assisted drafts for legal documents, proposals, memos, emails. Uses few-shot learning from firm examples. |
| **Output** | Draft content with formatting |
| **API Endpoint** | `POST /api/v1/drafts` |

---

## Platform Skills (No AI)

### 24. Authentication & SSO
| Feature | Description |
|---------|-------------|
| Email/password | JWT-based login with bcrypt password hashing |
| Registration | Creates firm + admin user in one step |
| SSO | WorkOS SAML/OIDC integration |
| Token refresh | Automatic JWT refresh before expiry |
| Password reset | Email-based reset flow (Resend) |

### 25. Multi-Tenant RBAC
| Role | Scope |
|------|-------|
| `super_admin` | All firm settings, billing, RBAC |
| `admin` | Invite members, manage roles, audit logs |
| `member` | Full feature access |
| `viewer` | Read-only |

30+ granular permissions across documents, matters, drafts, billing, admin, and chat.

### 26. Billing & Subscriptions
| Provider | Capabilities |
|----------|-------------|
| **Stripe** | Checkout, webhooks, customer portal, subscription lifecycle |
| **Razorpay** | UPI, Cards (Visa/MC/RuPay), Net Banking, NEFT/RTGS |
| **Pricing** | 5 tiers: Free (₹0), Starter (₹999/mo), Professional (₹4,999/mo), Business (₹14,999/mo), Enterprise (custom) |

### 27. Onboarding & Team Management
| Feature | Description |
|---------|-------------|
| Onboarding wizard | Company size selector → plan recommendation → team setup |
| Email invites | Send team invites via Resend with branded emails |
| Invite flow | Accept invite link → create account → join firm |
| Access control | Super admin manages roles and permissions |

### 28. Admin Dashboard
| Page | Description |
|------|-------------|
| `/dashboard/admin/users` | User management, role editing, member removal |
| `/dashboard/admin/evals` | AI quality scores, regressions, tool performance |
| `/dashboard/admin/feature-connector` | MCP server health map |
| `/dashboard/admin/audit` | Audit log viewer |

### 29. Compliance Calendar
| Feature | Description |
|---------|-------------|
| Unified calendar | GST, Income Tax, TDS, ROC deadlines in one view |
| Auto-alerts | Proactive notifications before deadlines |
| Status tracking | Upcoming → Due this week → Overdue → Completed |

### 30. Document Management
| Feature | Description |
|---------|-------------|
| Upload | PDF, DOCX, TXT, CSV with drag-and-drop |
| RAG indexing | Auto-embed and index for semantic search |
| Encryption | Envelope encryption with per-firm keys (Cloudflare R2) |
| Soft delete | Archive without permanent deletion |

---

## MCP Server Tools (66 tools across 17 servers)

Each MCP server exposes multiple tools that agents can call:

| Server | Tools | Description |
|--------|-------|-------------|
| `postgres` | 9 | SELECT, INSERT, UPDATE, DELETE, COUNT, search, schema_info, transactions, audit |
| `cloudflare` | 3 | text_generate, embed, model_list |
| `document` | 5 | search, index, delete, list, stats |
| `email` | 4 | send, send_bulk, templates, verify |
| `calendar` | 5 | list_events, create_event, update_event, delete_event, search_events |
| `storage` | 5 | upload, download, delete, list, presign |
| `video` | 4 | create_meeting, list_meetings, get_recording, get_transcript |
| `esign` | 5 | create_envelope, send, status, download, void |
| `crm` | 5 | list_contacts, create_contact, search, update, activities |
| `translation` | 3 | translate, detect_language, batch_translate |
| `ocr` | 3 | extract_text, extract_tables, detect_language |
| `court` | 4 | search_cases, get_opinion, get_citations, check_recap |
| `conflict` | 3 | check_client, check_matter, full_scan |
| `workflow` | 4 | trigger_webhook, list_automations, check_status, list_results |
| `billing` | 3 | create_subscription, get_usage, list_invoices |
| `time` | 3 | log_time, get_entries, get_report |
| `communication` | 4 | send_whatsapp, send_slack, send_teams, list_channels |

---

## How Skills Connect

```
User asks "Analyze this contract for risks"
  │
  ▼
Chat Interface → Intent Classification (contract_analysis)
  │
  ▼
Task Planner → Plan: [Extract Clauses] → [Score Risk] → [Check Playbook] → [Compliance]
  │
  ▼
Executor → Crew 1: Document Intelligence
  │
  ├─→ ClauseExtractor (23+ types, confidence scores)
  │       ↓
  ├─→ RiskAnalyzer (1-10 scale, negotiation recs)
  │       ↓
  └─→ PlaybookGuardian (firm rules enforcement)
          ↓
  ComplianceChecker (GDPR/CCPA validation)
          ↓
  NegotiatorAdvisor (counter-positions)
  │
  ▼
Eval Framework → Score: relevance=0.9, completeness=0.85, accuracy=0.8, safety=0.95, usability=0.85
  │
  ▼
Feedback Loop → Record: task_success + tool preference
  │
  ▼
Response → Chat UI (with entities, actions, tool suggestions)
```

---

## Invoking Skills

### Via Chat (Recommended)
```
POST /api/v1/chat/message
{
  "message": "Analyze this contract for risk clauses",
  "context": { "toolId": "upload_document" }
}
```

### Via Direct API (Crew Endpoints)
```
POST /agents/analyze/contract
{
  "document_text": "...",
  "playbook_rules": [...]
}
```

### Via Chat Tools
The chat interface provides 15 quick-access tools:

| Tool | Category | Description |
|------|----------|-------------|
| `create_matter` | work | Open a new legal/consulting matter |
| `add_client` | ca | Register a new client with tax IDs |
| `upload_document` | documents | Upload and analyze a document |
| `search_documents` | documents | Semantic search across all documents |
| `legal_research` | research | Legal research, case law, statutes |
| `draft_document` | drafts | AI-assisted drafting |
| `create_proposal` | consulting | Generate consulting proposals |
| `market_intel` | consulting | Industry research & competitive analysis |
| `schedule_meeting` | meetings | Schedule client meetings |
| `compliance_calendar` | ca | Tax filings, GST, ROC calendar |
| `check_compliance` | compliance | Playbook & regulatory check |
| `financial_analysis` | analysis | NPV, IRR, sensitivity analysis |
| `reconciliation` | ca | Bank & ledger reconciliation |
| `manage_engagements` | consulting | Track client engagements |
| `manage_integrations` | integrations | Connect CRM, billing, DMS |

---

## Feature Availability by Plan

| Feature | Free | Starter (₹999) | Professional (₹4,999) | Business (₹14,999) | Enterprise |
|---------|------|-----------------|------------------------|---------------------|------------|
| Chat (limited) | ✅ 50 msgs/mo | ✅ 500 msgs/mo | ✅ Unlimited | ✅ Unlimited | ✅ Unlimited |
| Document upload | ❌ | ✅ 10/mo | ✅ 100/mo | ✅ Unlimited | ✅ Unlimited |
| RAG search | ❌ | ✅ | ✅ | ✅ | ✅ |
| Contract analysis | ❌ | ✅ | ✅ | ✅ | ✅ |
| Drafting | ❌ | ✅ 5/mo | ✅ 50/mo | ✅ Unlimited | ✅ Unlimited |
| Legal research | ❌ | ✅ | ✅ | ✅ | ✅ |
| Bookkeeping | ❌ | ❌ | ✅ | ✅ | ✅ |
| GST compliance | ❌ | ❌ | ✅ | ✅ | ✅ |
| Audit automation | ❌ | ❌ | ❌ | ✅ | ✅ |
| Income tax | ❌ | ❌ | ✅ | ✅ | ✅ |
| ROC compliance | ❌ | ❌ | ❌ | ✅ | ✅ |
| Team members | 1 | 3 | 10 | 50 | Unlimited |
| Custom playbook | ❌ | ❌ | ✅ | ✅ | ✅ |
| API access | ❌ | ❌ | ✅ | ✅ | ✅ |
| SSO | ❌ | ❌ | ❌ | ✅ | ✅ |
| Dedicated support | ❌ | ❌ | ❌ | ✅ | ✅ (SLA) |
