# Counsel — User Journey

## Overview

**Counsel** is an AI workforce platform built for professional services firms — Legal practices, Consulting firms, and Chartered Accountancy (CA) firms. It deploys 25+ specialized AI agents across 9 crews that work alongside your team members to automate document analysis, contract review, legal research, proposal writing, GST reconciliation, audit automation, and compliance tracking.

### Who It's For

| Firm Type | Primary Use Cases | Agents Available |
|-----------|-------------------|-----------------|
| **Legal** | Contract analysis, drafting, legal research, compliance, negotiation strategy | 10 agents (4 crews) |
| **Consulting** | Proposal writing, market intelligence, financial modeling, engagement management | 6 agents (3 crews) |
| **CA Firms** | GST reconciliation, ITR preparation, audit automation, ROC compliance, TDS matching | 15 agents (5 crews) |

Every firm gets tenant-isolated infrastructure — separate database schemas, document indexes, playbook rules, and AI workspace. No data crosses firm boundaries.

---

## Complete User Flow

### Step 1 — Land on Homepage

The user arrives at the Counsel homepage (`/`). They see:

- **Dynamic stats** in the hero section: total documents analyzed, firms active, AI actions logged, average time saved per contract review (pulled from live system metrics)
- **How It Works** section showing the 3-step flow: Upload → Analyze → Act
- **Customer stories** carousel with testimonials from legal, consulting, and CA firms
- **Trial banner** at the bottom: "Start your 14-day free trial. No credit card required."
- **Navigation** with product, solutions, resources, pricing, and demo links

**Decision point:** The user clicks "Start Free Trial" in the nav or trial banner.

### Step 2 — Start Free Trial → Register

The user lands on the Register page (`/register`).

**Registration form fields:**
- Full Name
- Work Email
- Password (with strength indicator)
- **Firm Type** dropdown: Legal | Consulting | Chartered Accountancy
- Firm Name
- Firm Size (Solo, 2-10, 11-50, 51-200, 200+)
- Terms acceptance checkbox

**What happens on submit:**
1. Account created with JWT authentication
2. New firm tenant provisioned in PostgreSQL with RLS policies
3. pgvector index initialized for the firm's document embeddings
4. Demo data seeded (sample documents, matters, playbook rules appropriate to firm type)
5. User redirected to login

**Firm-type-aware routing:**
- **Legal:** Playbook rules seeded with contract negotiation standards (indemnification, liability caps, IP ownership, governing law)
- **Consulting:** Templates seeded for proposals, SOWs, pitch decks, engagement letters
- **CA:** Sample trial balance, GST data, TDS statements, compliance calendar pre-populated with statutory deadlines

### Step 3 — Login → Onboarding Wizard

After login, first-time users see the **Onboarding Wizard** (`/dashboard/onboarding`).

**Firm-Type-Aware Steps:**

**Legal Firm Onboarding:**
1. **Playbook Setup:** Pick negotiation positions for 10+ standard contract clauses (indemnification: mutual vs one-way, liability cap: % of fees vs fixed amount, IP ownership, etc.)
2. **Document Upload:** Upload 3-5 example contracts to teach the AI your firm's language patterns
3. **Integrations Preview:** Option to connect Gmail, DocuSign, and your document storage
4. **Team Invites:** Send email invites to other firm members (assign roles: Partner, Associate, Paralegal)
5. **Completion:** "Your AI workforce is ready. Upload your first contract to see it in action."

**Consulting Firm Onboarding:**
1. **Firm Profile:** Describe your consulting focus areas (Strategy, Operations, Technology, M&A, etc.)
2. **Template Setup:** Upload 3-5 example proposals, SOWs, or pitch decks to match firm voice
3. **Integrations Preview:** Option to connect Salesforce/Clio, Slack/Teams, and billing
4. **Team Invites:** Send email invites (Partner, Engagement Manager, Analyst)
5. **Completion:** "Your AI consulting workforce is ready."

**CA Firm Onboarding:**
1. **Client Setup:** Add first client with PAN, GSTIN, and engagement type (Statutory Audit, Tax Audit, GST, ITR, ROC)
2. **Data Import:** Option to upload trial balance, bank statement, or connect Tally
3. **Compliance Calendar:** Auto-populated with statutory deadlines (GST: 11th/20th monthly, ITR: 31st July, TDS: 7th monthly, ROC: various)
4. **Integrations Preview:** Option to connect Tally, Zoho Books, WhatsApp Business, Income Tax ERI
5. **Completion:** "Your CA AI workforce is ready. Start with a GST reconciliation or audit risk assessment."

### Step 4 — Dashboard

The user arrives at their dashboard (`/dashboard`) and sees:

- **Stats cards:** Documents analyzed this month, AI actions run, active matters/engagements, average analysis time
- **Quick Actions:** Upload Document, Create Draft, Run Research, New Matter (for legal) / New Proposal (for consulting) / New Reconciliation (for CA)
- **Recent Activity feed:** Last 10 AI actions with timestamps, document names, and results summary
- **Navigation sidebar:** All modules organized by function

### Step 5 — Upload First Document

User clicks "Upload Document" from the dashboard quick actions or navigates to `/dashboard/documents`.

**Upload flow:**
1. Drag-and-drop or file picker (PDF, DOCX, TXT supported; max 50 MB)
2. Document type selector: Contract, Brief, Memo, Proposal, SOW, Trial Balance, Bank Statement, etc.
3. Matter/engagement association (optional)
4. Document indexed:
   - OCR if scanned (AWS Textract / Azure DocIntel via OCR-MCP)
   - Text extracted and chunked (800-char chunks, 200-char overlap)
   - Embeddings generated via Cloudflare bge-base-en-v1.5 (768-dim)
   - Stored in pgvector with HNSW index
5. Progress indicator: "Indexing document... 76%"
6. Success: "Document indexed. 47 chunks. Run analysis?"

### Step 6 — View Document Analysis

User clicks "Analyze" on a document or navigates to `/dashboard/documents/[id]`.

**What the AI pipeline does (Legal contract example):**

The Document Intelligence crew (3 agents) runs:
1. **ClauseExtractor:** Identifies every clause (23+ categories), extracts exact text with confidence scores
2. **RiskAnalyzer:** Scores each clause 1-10, flags high-risk items (7+), provides market comparisons
3. **PlaybookGuardian:** Checks every clause against firm playbook rules — pass, violation, or missing

**What the user sees:**
- **Document preview pane** (left) with the original document
- **Clause cards** (center) — each clause extracted with:
  - Clause type badge (Indemnification, Limitation of Liability, etc.)
  - Risk score (1-10, color-coded: green/yellow/red)
  - Excerpt from the document
  - Playbook status: ✅ Pass / ⚠️ Violation / ❌ Missing
- **Risk report sidebar** (right):
  - Overall risk score and summary
  - High-risk clauses (7+) with negotiation recommendations
  - Playbook violations with suggested counter-positions
- **Negotiation Advisor** button: Opens the Compliance & Negotiation crew output with detailed counter-positions and market data

**For CA firms (GST Reconciliation example):**
- **Matched entries panel:** Bank entries matched to books with confidence scores
- **Variance breakdown:** Categorized by type (timing, GST mismatch, bank charges, etc.)
- **GST impact summary:** Net effect on GSTR-3B liability
- **Partner-review checklist:** Every unmatched item flagged with action items

### Step 7 — Create Draft

User navigates to `/dashboard/drafts` and clicks "New Draft."

**Draft creation flow:**
1. Select draft type: Contract, Motion, Brief, Memo, Email, Proposal, SOW, Notice Response, Audit Report, etc.
2. Enter instructions in natural language: "Draft an NDA for a software licensing deal with a startup. Mutual confidentiality, 3-year term, California governing law."
3. Optionally select tone examples (2-3 past documents to match firm voice)
4. Associate with a matter/engagement

**What the AI does (Legal Drafting crew, 2 agents):**
1. **LegalDrafter:** Generates the first draft matching firm voice, structure, and formatting
2. **CitationValidator:** Verifies and formats all citations (Bluebook/ALWD), flags unverifiable citations

**What the user sees:**
- Draft editor with the AI-generated document
- Highlighted sections: text generated by AI (purple), placeholders for review (yellow)
- Hover on any clause: shows the source or rationale
- Citation validation report: each citation with status (verified/unverifiable/formatted)
- Edit inline, refine with additional prompts, or save as final

### Step 8 — Run Research

User navigates to `/dashboard/research` or `/dashboard/kb`.

**Research flow:**
1. Enter a query: "What are the enforceability requirements for non-compete clauses in California employment contracts?"
2. Select jurisdiction (optional)
3. Choose search scope: Firm's knowledge base only, or include external case law (CourtListener via court-mcp)

**What the AI does (Research & Discovery crew, 2 agents):**
1. **LegalResearcher:** Decomposes the query into sub-questions, searches pgvector for relevant document chunks, retrieves matching clauses and precedents
2. **RAGSynthesizer:** Synthesizes findings into a cited legal memorandum with confidence levels (direct quote / paraphrased / inferred), identifies open questions

**What the user sees:**
- Research question at top
- Synthesized answer with inline citations
- Each citation is clickable — opens the source document at the relevant chunk
- Confidence indicators: 🟢 Direct Quote / 🟡 Paraphrased / 🔴 Inferred
- "Open Questions" section at the bottom for further research
- Export options: Copy to clipboard, Save to KB, Add to matter

### Step 9 — Connect Integrations

User navigates to `/dashboard/integrations`.

**Available integrations by firm type:**

| Integration | Legal | Consulting | CA |
|-------------|-------|------------|-----|
| Gmail / Outlook | ✅ | ✅ | ✅ |
| Google Calendar / Outlook Calendar | ✅ | ✅ | ✅ |
| DocuSign / HelloSign | ✅ | ✅ | — |
| S3 / GCS / SharePoint | ✅ | ✅ | ✅ |
| Stripe Billing | ✅ | ✅ | ✅ |
| Salesforce / Clio / HubSpot | ✅ | ✅ | — |
| Slack / Teams | ✅ | ✅ | ✅ |
| Zoom / Teams Meetings | ✅ | ✅ | — |
| Zapier / n8n / Make | ✅ | ✅ | ✅ |
| CourtListener (case law) | ✅ | — | — |
| Harvest / Toggl (time tracking) | ✅ | ✅ | — |
| GSP (ClearTax / Masters India) | — | — | ✅ |
| MCA21 (ROC filings) | — | — | ✅ |
| Income Tax ERI (26AS/AIS) | — | — | ✅ |
| Tally | — | — | ✅ |
| Zoho Books / QuickBooks | — | — | ✅ |
| WhatsApp Business | — | — | ✅ |
| DeepL / Azure Translator | ✅ | ✅ | — |

**Connection experience (non-technical):**
1. User sees an integration card with the provider logo, "Connect" button, and current status
2. Clicking "Connect" opens the provider's OAuth consent screen in a popup
3. User authorizes the requested permissions
4. Counsel receives the OAuth token, stores it encrypted per-firm
5. Connection status changes to "✅ Connected" with the connected account email

**What happens after connection:**
- The corresponding MCP server binds the OAuth token
- AI agents can now call that integration's tools (send email, create calendar event, search CRM contacts, etc.)
- All tool calls are logged in the immutable audit trail

**Security guarantee:** All integrations are **read-only by default**. Agents never auto-modify, auto-send, or auto-file without explicit human approval. For CA integrations (GSP, ERI, MCA), agents explicitly **cannot file** — they only fetch, validate, and prepare data for partner review.

### Step 10 — Settings & Admin

User navigates to `/dashboard/settings` and `/dashboard/admin`.

**Settings pages:**

| Page | What the user does |
|------|-------------------|
| **Firm Profile** (`/dashboard/settings`) | Update firm name, logo, industry, default jurisdiction |
| **Playbook** (`/dashboard/admin/playbook`) | Visual playbook editor: add/edit/remove negotiation rules, set thresholds, reorder priorities |
| **Users** (`/dashboard/admin/users`) | Invite team members, assign roles (Partner, Senior Associate, Associate, Paralegal, CA Partner, Article Clerk, etc.), manage permissions, deactivate accounts |
| **Audit Log** (`/dashboard/admin/audit`) | View immutable audit trail: who did what, when, with which document — filterable by user, action type, date range |
| **Metrics** (`/dashboard/admin/metrics`) | Firm-wide usage analytics: AI actions run, tokens consumed, documents analyzed, average processing time, cost per document |
| **Usage & Billing** (`/dashboard/usage`) | Current plan, usage this month, billing history, upgrade/downgrade options |

**Admin workflow examples:**
- A managing partner reviews the audit log to see which associates ran AI analysis on which documents
- A CA partner adjusts the compliance calendar thresholds (when alerts change from green to yellow)
- A firm admin invites a new associate and assigns their practice area and permission level
- A compliance officer reviews the playbook rules before quarterly update

---

## Integration Setup Guide

### How Non-Technical Users Connect Integrations

Every integration follows the same pattern:
1. **Navigate** to `/dashboard/integrations`
2. **Find** the integration card
3. **Click "Connect"** — this initiates an OAuth 2.0 flow
4. **Sign in** to the external service in the popup window
5. **Authorize** the requested permissions (clearly listed before redirect)
6. **Return** to Counsel — connection status updates automatically

### Detailed Integration Guides

#### Email (Gmail / Outlook)
- **Connection:** OAuth 2.0 with Gmail API or Microsoft Graph
- **Data flow:** AI agents can read recent emails (search by query, get threads), send emails (always requires explicit user approval), and attach documents
- **What AI can do:** Send draft documents to clients, search for relevant correspondence in a matter, pull email threads for context
- **Security:** Email-sending actions always show a preview before execution. No automated sending.

#### Calendar (Google / Outlook)
- **Connection:** OAuth 2.0
- **Data flow:** Read/write calendar events
- **What AI can do:** Check availability for meetings, schedule depositions/deadlines, find free slots across team members, sync court dates to matters
- **Security:** Event creation always shows a confirmation. AI never modifies existing events without explicit approval.

#### Document Storage (S3 / GCS / SharePoint)
- **Connection:** API key + bucket/container configuration
- **Data flow:** Upload/download/list documents in the configured storage
- **What AI can do:** Save analyzed documents and generated drafts to firm storage, retrieve reference documents for research
- **Security:** Read/write is scoped to a specific bucket/prefix per firm. No cross-firm access.

#### E-Signature (DocuSign / HelloSign)
- **Connection:** OAuth 2.0
- **Data flow:** Create and manage signature requests, check envelope status
- **What AI can do:** Prepare signature packets for reviewed contracts, track signing status, remind signers (when approved by user)
- **Security:** Envelope creation always shows a preview. Voiding envelopes requires explicit confirmation.

#### CRM (Salesforce / Clio / HubSpot)
- **Connection:** OAuth 2.0
- **Data flow:** Read contacts, deals, matters; create/update records (when authorized)
- **What AI can do:** Search contacts for conflict checks, sync matter information between CRM and Counsel, pull deal context for proposals
- **Security:** Contact creation/updates require explicit approval. Conflict check runs are logged in the audit trail.

#### Communication (Slack / Teams)
- **Connection:** OAuth 2.0
- **Data flow:** Read channels, send messages
- **What AI can do:** Post analysis summaries to team channels, notify of completed drafts, share research findings
- **Security:** Message sending always shows a preview. No automated posting without approval.

#### GST Suvidha Provider — CA Only (ClearTax / Masters India / WhiteBooks)
- **Connection:** API key + GSP credentials
- **Data flow:** Fetch GSTR-2A auto-populated ITC data, retrieve GSTR-1/3B filing status
- **What AI can do:** Match ITC from GSTR-2A against purchase register, validate return data, prepare filing-ready packages
- **⚠️ Critical security:** Agents are **explicitly prohibited from filing**. Only "fetch," "check," and "validate" intents are allowed. Filing is always manual by the CA partner with DSC.

#### Income Tax ERI — CA Only
- **Connection:** API key + PAN + ERI credentials
- **Data flow:** Fetch 26AS tax credit statement, AIS pre-fill data, ITR filing status, notices
- **What AI can do:** Reconcile TDS from 26AS against books, aggregate ITR pre-fill data, identify mismatches
- **⚠️ Critical security:** Agents never auto-file ITR. All data is draft-only, marked for CA partner review and manual submission with DSC.

#### MCA21 / ROC — CA Only
- **Connection:** API key + CIN + MCA credentials
- **Data flow:** Fetch company master data, filing history, charge details, due dates
- **What AI can do:** Track filing deadlines, compile form data for AOC-4/MGT-7/DIR-3 KYC, manage compliance calendar
- **⚠️ Critical security:** Agents never auto-submit forms to MCA21. All form data is draft-only for partner review. DSC-based filing is always manual.

#### Tally — CA Only
- **Connection:** v1: XML export file upload; v2: ODBC connection (roadmap)
- **Data flow:** Import trial balance, ledger accounts, voucher entries
- **What AI can do:** Match bank statements to Tally entries, reconcile GST input credit with purchase register, prepare data for audit sampling
- **Security:** Data imported as read-only snapshot. No write-back to Tally.

#### WhatsApp Business — CA Only
- **Connection:** WhatsApp Business API via Meta
- **Data flow:** Send templated messages, receive document submissions from clients
- **What AI can do:** Send compliance deadline reminders, request documents from clients (bank statements, bills), share reconciliation status updates
- **Security:** Message sending always shows a preview. WhatsApp is used for nudges and requests, never for filing confirmations (those go through proper channels).

---

## Agent Architecture

### All 25 Agents — Roles, Tools, and MCP Servers

#### Legal Vertical — 10 Agents, 4 Crews

| # | Agent | Crew | Role | LLM | MCP Tools | Delegation |
|---|-------|------|------|-----|-----------|------------|
| 1 | **ClauseExtractor** | Document Intelligence | Extracts and classifies legal clauses (23+ types) with confidence scores. Self-contained — no external tools needed. | Low-temp default (0.1) | None | No |
| 2 | **RiskAnalyzer** | Document Intelligence | Scores every clause on 1-10 risk scale with market comparison and negotiation recommendations. | Power LLM (0.2) | cloudflare, document | Yes |
| 3 | **PlaybookGuardian** | Document Intelligence | Checks every clause against firm playbook rules — pass/violation/missing with counter-positions. | Power LLM (0.15) | cloudflare, document | Yes |
| 4 | **LegalDrafter** | Drafting | Generates professional legal documents from instructions, matching firm voice and formatting. | Power LLM (0.4) | cloudflare | Yes |
| 5 | **CitationValidator** | Drafting | Validates and formats all legal citations (Bluebook/ALWD). Flags unverifiable citations. | Default LLM (0.05) | cloudflare | No |
| 6 | **LegalResearcher** | Research & Discovery | Decomposes complex legal questions, searches firm knowledge base + case law, never fabricates. | Reasoning LLM | cloudflare, document | Yes |
| 7 | **RAGSynthesizer** | Research & Discovery | Synthesizes research into cited memoranda with confidence levels (direct/paraphrased/inferred). | Power LLM (0.25) | cloudflare, document | Yes |
| 8 | **ComplianceChecker** | Compliance | Validates AI outputs against GDPR, CCPA, SOC 2, ISO 27001, and firm-specific data policies. | Default LLM (0.1) | cloudflare, document | No |
| 9 | **NegotiatorAdvisor** | Compliance | Provides counter-positions, fallback positions, and market data for every contract issue. | Power LLM (0.35) | cloudflare | Yes |
| 10 | **AuditLogger** | (Infrastructure) | Immutable append-only audit logging for all AI actions. Singleton, in-memory + JSONL persistence. | N/A | postgres | No |

#### Consulting Vertical — 6 Agents, 3 Crews

| # | Agent | Crew | Role | LLM | MCP Tools | Delegation |
|---|-------|------|------|-----|-----------|------------|
| 11 | **ProposalWriter** | Proposal | Generates consulting proposals, pitch decks, SOWs with executive summary, methodology, pricing. | Power LLM (0.4) | cloudflare | Yes |
| 12 | **MarketIntelligenceAnalyst** | Market Intel | Analyzes markets, competitors, trends; produces SWOT, competitive landscapes, TAM/SAM/SOM. | Reasoning LLM | cloudflare | Yes |
| 13 | **StrategicAdvisor** | Market Intel / Engagement | Applies strategic frameworks (Porter, BCG, Blue Ocean); generates options with trade-off analysis. | Power LLM (0.3) | cloudflare | Yes |
| 14 | **RFPAnalyzer** | Proposal | Parses complex RFPs/RFQs; extracts requirements, evaluation criteria, win themes, disqualifiers. | Default LLM (0.1) | cloudflare | No |
| 15 | **EngagementManager** | Engagement | Structures engagements with WBS, resource plans, risk registers, stakeholder maps, deliverable trackers. | Power LLM (0.25) | cloudflare | Yes |
| 16 | **FinancialModeler** | Proposal | Builds financial models, ROI analyses, Monte Carlo simulations with clear assumptions and methodology. | Reasoning LLM | cloudflare | Yes |

#### CA Vertical — 15 Agents, 5 Crews

| # | Agent | Crew | Role | LLM | Tools |
|---|-------|------|------|-----|-------|
| 17 | **TransactionMatcher** | Bookkeeping (Crew 9) | Matches bank statement entries to book entries by amount, date, narration, counterparty. | Fast LLM | postgres |
| 18 | **VarianceAnalyzer** | Bookkeeping (Crew 9) | Categorizes reconciliation variances: timing, GST mismatch, bank charges, rounding. | Fast LLM | postgres |
| 19 | **ReconciliationReporter** | Bookkeeping (Crew 9) | Produces partner-ready reconciliation reports with confidence scores and action items. | Reasoning LLM | postgres |
| 20 | **InputTaxReconciler** | GST (Crew 10) | Matches GSTR-2A ITC against purchase register; flags mismatches for partner review. | Fast LLM | postgres |
| 21 | **GSTRValidator** | GST (Crew 10) | Validates GSTR-1/3B/9 data against source documents and GST rules with HSN validation. | Fast LLM | postgres |
| 22 | **FilingPrepAdvisor** | GST (Crew 10) | Compiles validated GST data into filing-ready packages (all marked partner-review). | Reasoning LLM | postgres |
| 23 | **RiskAssessmentEngine** | Audit (Crew 11) | Identifies audit risk areas per SA 315 from trial balance, ratios, trends, anomalies. | Reasoning LLM | postgres |
| 24 | **SamplingRecommendation** | Audit (Crew 11) | Recommends audit sample sizes and selection methodology per SA 530. | Fast LLM | postgres |
| 25 | **AuditReportCompiler** | Audit (Crew 11) | Compiles audit findings into structured draft reports (SA 700/705/706, CARO 2020, Form 3CD). | Reasoning LLM | postgres |
| 26 | **TDSReconciler** | Income Tax (Crew 12) | Reconciles TDS credits from 26AS/AIS against client books; identifies mismatches. | Fast LLM | postgres |
| 27 | **ITRDataAggregator** | Income Tax (Crew 12) | Aggregates ITR-relevant data from 26AS, AIS, and client books into pre-fill format. | Fast LLM | postgres |
| 28 | **NoticeResponseDrafter** | Income Tax (Crew 12) | Drafts professional responses to Income Tax notices under various sections. | Reasoning LLM | postgres |
| 29 | **FilingDeadlineTracker** | ROC (Crew 13) | Tracks all ROC/MCA statutory filing deadlines; alerts on upcoming/overdue with severity levels. | Fast LLM | postgres |
| 30 | **FormDataCompiler** | ROC (Crew 13) | Compiles financial and compliance data into ROC-form-ready format. | Fast LLM | postgres |
| 31 | **ComplianceCalendarManager** | ROC (Crew 13) | Maintains unified compliance calendar across all verticals with proactive alerts. | Reasoning LLM | postgres |

### Context and Memory Architecture

Counsel uses **CrewAI Memory** for persistent context across agent runs:

- **Short-term memory:** Episode-specific — what happened in the current pipeline run. Each crew's execution has its own short-term context. Reset between runs.
- **Long-term memory (LanGraphStorage):** Persistent across runs. Agents remember previous interactions with the same matter, document, or query. Reused when the same agent is invoked for a related task.
- **Entity memory (LanGraphStorage):** Tracks entities and relationships — clients, matters, documents, clauses. Enables agents to recall "this is the same NDA we analyzed last week" or "this client always negotiates indemnification."

**How memory flows through the pipeline:**
1. Each crew's execution stores its outputs and context in CrewAI memory
2. Downstream crews can access upstream crew outputs through `context=[previous_task]`
3. The full pipeline orchestrator (`run_full_contract_pipeline`) passes document intelligence results as contract issues into the compliance crew
4. All agent actions are logged to the immutable audit trail (database + JSONL files)

### Knowledge Bases by Firm Type

| Firm Type | Knowledge Base Contents | RAG Source |
|-----------|------------------------|------------|
| **Legal** | Firm's past contracts, briefs, memos, research notes, playbook rules, client communications | pgvector index of firm documents |
| **Consulting** | Past proposals, SOWs, pitch decks, market analyses, engagement deliverables, client deliverables | pgvector index of firm documents |
| **CA** | Trial balances, bank statements, GST returns, ITR filings, audit reports, compliance calendars, client financial data | pgvector index of firm documents |

**Externally accessible knowledge sources:**
- **CourtListener** (via court-mcp, port 3109): Case law, opinions, statutes — available to Legal firms
- **MCA21** (via mca-mcp, port 3119): Company data, filing history — available to CA firms
- **Income Tax Portal** (via eri-mcp, port 3122): 26AS, AIS, notices — available to CA firms

**Knowledge isolation:** Each firm's knowledge base is fully isolated. pgvector queries are tenant-scoped. Firm A's documents are never accessible to Firm B's agents, even within the same database cluster (enforced by PostgreSQL RLS).

---

## MCP Server Inventory

### Complete List — 25 Servers, ~145 Tools

#### Tier 1 — Core Infrastructure

| # | Server | Port | Tools | Purpose | Used By |
|---|--------|------|-------|---------|---------|
| 1 | **Registry** | 3100 | 6 | Service discovery, health aggregation, tool discovery | All agents (indirectly) |
| 2 | **PostgreSQL** | 3101 | 10 | Database CRUD, schema discovery, matter/document/audit/playbook queries | All agents |
| 3 | **Cloudflare AI** | 3102 | 5 | Text generation, embeddings, multi-turn chat — 3 model tiers (fast/power/reasoning) | All agents |
| 4 | **Document RAG** | 3103 | 5 | pgvector semantic search, document listing, chunk retrieval, index stats | Research, Analysis agents |

#### Tier 2 — Required Integrations

| # | Server | Port | Tools | Purpose | Used By |
|---|--------|------|-------|---------|---------|
| 5 | **Email** | 3104 | 6 | Gmail/Outlook — send, read, search, get threads | Drafting, Compliance, CA crews |
| 6 | **Calendar** | 3105 | 6 | Google/Outlook Calendar — list events, create events, find free slots | All agents |
| 7 | **Storage** | 3106 | 6 | S3/GCS/SharePoint — upload, download, list files | Document processing |
| 8 | **E-Signature** | 3107 | 6 | DocuSign/HelloSign — send envelopes, check status, void requests | Legal Drafting crew |
| 9 | **Billing** | 3108 | 6 | Stripe — subscriptions, invoices, usage records | Admin/Settings |
| 10 | **Court Lookup** | 3109 | 6 | CourtListener — case law search, opinion retrieval, citation validation, statutes | Legal Research crew |
| 11 | **Communication** | 3110 | 6 | Slack/Teams — send messages, list channels | All agents |
| 12 | **CRM** | 3111 | 6 | Salesforce/Clio/HubSpot — search contacts, get deals/matters, sync records | Consulting + Legal |

#### Tier 3 — Extended Capabilities

| # | Server | Port | Tools | Purpose | Used By |
|---|--------|------|-------|---------|---------|
| 13 | **Workflow** | 3112 | 5 | Zapier/n8n/Make — trigger webhooks, execute automations | All agents |
| 14 | **OCR** | 3113 | 6 | AWS Textract/Azure DocIntel — text extraction, form fields, tables | Document processing |
| 15 | **Translation** | 3114 | 5 | DeepL/Azure Translator — text translation, language listing | Research, Multi-jurisdiction |
| 16 | **Video** | 3115 | 5 | Zoom/Teams Meetings — create meetings, list recordings, get transcripts | Meeting Intelligence |
| 17 | **Time Tracking** | 3116 | 5 | Harvest/Toggl — start/stop timers, get entries by matter | Legal + Consulting |
| 18 | **Conflict Check** | 3117 | 5 | COI detection — check new matters, manage watchlist, ethical walls | Legal firms |

#### CA Vertical — Government & Accounting

| # | Server | Port | Tools | Purpose | Used By |
|---|--------|------|-------|---------|---------|
| 19 | **GSP (GST)** | 3118 | 8 | ClearTax/Masters India/WhiteBooks — fetch GSTR-2A, check filing status, validate returns | CA GST crew |
| 20 | **MCA / ROC** | 3119 | 6 | MCA21 V3 — company master data, filing history, charge details, due dates | CA ROC crew |
| 21 | **UDIN (ICAI)** | 3120 | 5 | UDIN tracking — read-only from ICAI portal, track document-wise UDIN | CA Audit + ROC crews |
| 22 | **Tally** | 3121 | 6 | v1: XML export import (manual); v2: ODBC connection (roadmap) | CA Bookkeeping crew |
| 23 | **Income Tax ERI** | 3122 | 6 | 26AS/AIS fetch, ITR status, notice retrieval | CA Income Tax crew |
| 24 | **Books (Zoho/QB)** | 3123 | 6 | Zoho Books + QuickBooks Online — ledger, invoices, expenses | CA Bookkeeping crew |
| 25 | **WhatsApp Business** | 3124 | 6 | Send compliance nudges, request documents, share status updates | CA Compliance crew |

### How to Start/Stop MCP Servers

**Start all MCP servers:**
```bash
cd services/mcp
docker compose --profile mcp up -d
```

**Start specific tiers:**
```bash
# Tier 1 only (core infrastructure)
docker compose up -d registry postgres-mcp cloudflare-mcp document-mcp

# Tier 1 + Tier 2 (core + required integrations)
docker compose --profile t2 up -d

# Everything including monitoring
docker compose --profile full up -d
```

**Health check all servers:**
```bash
for port in $(seq 3100 3124); do
  echo -n "Port $port: "
  curl -s http://localhost:$port/health | jq -r '.status // "no response"'
done
```

**Stop all MCP servers:**
```bash
docker compose --profile mcp down
```

**Per-server logs:**
```bash
docker logs counsel-postgres-mcp --tail 50
docker logs counsel-cloudflare-mcp --tail 50
docker logs counsel-document-mcp --tail 50
```

**Circuit breaker:** All MCP servers include a circuit breaker (5 failures → OPEN, 30s cooldown). When external services are down, agents receive graceful fallback responses instead of crashing.

**Prometheus metrics:** 6 metrics per server (request count, latency histogram, error count, circuit breaker state, tool call count, health status). Grafana dashboards auto-provisioned for all 25 servers.

---

## Agent-to-MCP Tool Allocation Summary

| Crew | Agents | MCP Servers Assigned |
|------|--------|---------------------|
| **Document Intelligence** | ClauseExtractor, RiskAnalyzer, PlaybookGuardian | cloudflare, document, (postgres for playbook) |
| **Drafting** | LegalDrafter, CitationValidator | cloudflare, postgres, email, esign, court |
| **Research** | LegalResearcher, RAGSynthesizer | cloudflare, document, postgres, court |
| **Compliance** | ComplianceChecker, NegotiatorAdvisor | cloudflare, document, postgres |
| **Proposal** | ProposalWriter, RFPAnalyzer, FinancialModeler | cloudflare, postgres, document |
| **Market Intel** | MarketIntelligenceAnalyst, StrategicAdvisor | cloudflare, postgres |
| **Engagement** | EngagementManager, StrategicAdvisor | cloudflare, postgres |
| **CA Bookkeeping** | TransactionMatcher, VarianceAnalyzer, ReconciliationReporter | postgres, tally, books |
| **CA GST** | InputTaxReconciler, GSTRValidator, FilingPrepAdvisor | postgres, gsp |
| **CA Audit** | RiskAssessmentEngine, SamplingRecommendation, AuditReportCompiler | postgres, udin |
| **CA Income Tax** | TDSReconciler, ITRDataAggregator, NoticeResponseDrafter | postgres, eri |
| **CA ROC** | FilingDeadlineTracker, FormDataCompiler, ComplianceCalendarManager | postgres, mca, udin |

---

## Infrastructure Overview

| Component | Technology | Role |
|-----------|-----------|------|
| **Frontend** | Next.js 15 (App Router) + Tailwind CSS | 43 dynamic pages, green-serif professional theme |
| **Core API** | Node.js + Express + TypeScript | REST API, auth, tenant RLS, document management |
| **AI Service** | Python FastAPI + CrewAI Multi-Agent | 25 agents, 9 crews, Cloudflare LLM bridge |
| **Database** | PostgreSQL 15 + pgvector (HNSW) | Multi-tenant data + vector embeddings |
| **ORM** | Prisma | 16 models, migrations, seed data |
| **Queue** | Redis/BullMQ | Async document processing, batch jobs |
| **Storage** | Cloudflare R2 (S3-compatible) | Document storage, zero egress fees |
| **LLM** | Cloudflare Workers AI (Llama 4 Scout, Llama 3.3 70B, DeepSeek R1) | 3-tier model architecture |
| **Embeddings** | Cloudflare bge-base-en-v1.5 (768-dim) | Semantic search via pgvector |
| **Auth** | JWT + WorkOS SSO (SAML/OIDC) + OAuth2 | Authentication and integration connections |
| **Monitoring** | Prometheus + Grafana | 25 server dashboards, 6 alert rules per server |
| **CI/CD** | GitHub Actions | Test → Build → Push → Rolling Deploy + Trivy Security Scan |
| **Extension** | Chrome Manifest V3 | Gmail compose/read integration |
