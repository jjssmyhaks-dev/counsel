"""CrewAI Task Definitions for Counsel AI Multi-Agent System.

Each task is a self-contained unit of work with clear inputs, expected outputs,
and a human-readable description. Tasks are designed to chain through CrewAI's
sequential process mode.

CrewAI 1.x requirements:
- Each Task must have an explicit `agent`.
- `context` must be a list of Task objects (not dicts).

Note: Pydantic schemas are defined in schemas.py for documentation and
optional downstream validation. output_pydantic is NOT wired into tasks
because CrewAI 1.15.2 TaskOutput rejects dict .raw when pydantic models
parse successfully (version incompatibility with dict-or-string raw).
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from crewai import Task


# ═══════════════════════════════════════════════════════════════
# CREW 1: DOCUMENT INTELLIGENCE TASKS
# ═══════════════════════════════════════════════════════════════

class DocumentIntelligenceTasks:
    """Tasks for the Document Intelligence crew."""

    def __init__(
        self,
        document_text: str,
        playbook_rules: Optional[List[Dict[str, Any]]] = None,
        risk_context_text: Optional[str] = None,
    ):
        self.document_text = document_text
        self.risk_context_text = risk_context_text or document_text
        self.playbook_rules = playbook_rules or []

    def extract_clauses(self, agent, step_callback=None) -> Task:
        """Task: Extract all legal clauses from the document."""
        return self._extract_clauses_task(agent=agent)

    def _extract_clauses_task(self, agent=None, step_callback=None) -> Task:
        playbook_context = ""
        if self.playbook_rules:
            rules_summary = "\n".join(
                f"- {r.get('rule_name', 'Unknown')}: {r.get('description', 'No description')}"
                for r in self.playbook_rules
            )
            playbook_context = (
                f"\n\nFIRM PLAYBOOK RULES TO BE AWARE OF:\n{rules_summary}"
            )

        return Task(
            agent=agent,
            step_callback=step_callback,
            description=(
                f"Extract all legal clauses from the following contract document. "
                f"Identify the clause type, extract the exact text, and provide a "
                f"confidence score (0-1) for each extraction.\n\n"
                f"Specifically look for these clause types:\n"
                f"- Indemnification\n"
                f"- Limitation of Liability\n"
                f"- Termination\n"
                f"- Intellectual Property\n"
                f"- Confidentiality\n"
                f"- Governing Law / Jurisdiction\n"
                f"- Force Majeure\n"
                f"- Payment Terms\n"
                f"- Representations and Warranties\n"
                f"- Insurance\n"
                f"- Assignment\n"
                f"- Data Protection / Privacy\n"
                f"- Non-Compete / Non-Solicit\n"
                f"- Severability\n"
                f"- Notices\n"
                f"- Entire Agreement\n"
                f"{playbook_context}\n\n"
                f"DOCUMENT TEXT:\n```\n{self.document_text}\n```\n\n"
                f"Output a structured list of clauses with: clause_type, text_excerpt, "
                f"confidence (0-1), and any notable observations."
            ),
            expected_output=(
                "A JSON-serializable structure containing: "
                "1. document_summary (brief overview of the document) "
                "2. clauses (list of extracted clauses, each with clause_type, "
                "   text_excerpt, confidence, and observations) "
                "3. missing_clause_types (list of standard clause types not found)"
            ),
        )

    def analyze_risks(self, agent, context: Optional[List[Task]] = None, step_callback=None) -> Task:
        """Task: Score each clause on a 1-10 risk scale."""
        return Task(
            agent=agent,
            step_callback=step_callback,
            description=(
                f"Analyze the risk profile of each extracted clause from the document. "
                f"For each clause:\n"
                f"1. Assign a risk score (1-10, 10=extremely high risk)\n"
                f"2. Explain why the score was assigned (specific legal reasoning)\n"
                f"3. Compare to market standards where applicable\n"
                f"4. Estimate potential financial exposure if the clause is enforced\n\n"
                f"DOCUMENT TEXT:\n```\n{self.risk_context_text}\n```\n\n"
                f"Use the clause extraction results from the previous task as input."
            ),
            expected_output=(
                "A risk assessment matrix containing: "
                "1. overall_risk_score (aggregate 1-10) "
                "2. risk_breakdown (per clause: clause_type, risk_score, rationale, "
                "   financial_exposure_estimate, market_standard_comparison) "
                "3. critical_issues (clauses with risk >= 7 that need immediate attention) "
                "4. negotiation_priority (ordered list of what to negotiate first)"
            ),
            context=context or [],
        )

    def check_playbook(self, agent, context: Optional[List[Task]] = None, step_callback=None) -> Task:
        """Task: Validate document against firm playbook rules."""
        rules_text = "\n".join(
            f"Rule {i+1}: {r.get('rule_name', 'Unknown')}\n"
            f"  Description: {r.get('description', 'No description')}\n"
            f"  Required: {r.get('required_value', 'Not specified')}\n"
            f"  Acceptable range: {r.get('acceptable_range', 'Not specified')}\n"
            for i, r in enumerate(self.playbook_rules)
        ) if self.playbook_rules else "No specific playbook rules provided. Check against standard industry best practices."

        return Task(
            agent=agent,
            step_callback=step_callback,
            description=(
                f"Validate every clause in the contract against the firm's playbook rules. "
                f"For each rule, determine:\n"
                f"- PASS: The clause complies with the playbook\n"
                f"- VIOLATION: The clause violates the playbook (specify what's wrong)\n"
                f"- MISSING: The required clause/provision is absent\n\n"
                f"PLAYBOOK RULES:\n{rules_text}\n\n"
                f"DOCUMENT TEXT:\n```\n{self.risk_context_text}\n```\n\n"
                f"Use the clause extraction and risk analysis results from previous tasks."
            ),
            expected_output=(
                "A playbook compliance report containing: "
                "1. compliance_summary (total rules, passed, violations, missing) "
                "2. compliance_details (per rule: rule_name, status [PASS/VIOLATION/MISSING], "
                "   actual_value, required_value, deviation, recommended_action) "
                "3. critical_violations (playbook violations that are showstoppers) "
                "4. negotiation_playbook (for each violation, specific counter-position language)"
            ),
            context=context or [],
        )


# ═══════════════════════════════════════════════════════════════
# CREW 2: DRAFTING TASKS
# ═══════════════════════════════════════════════════════════════

class DraftingTasks:
    """Tasks for the Drafting crew."""

    def __init__(
        self,
        draft_type: str,
        instructions: str,
        tone_examples: Optional[List[str]] = None,
        matter_context: Optional[str] = None,
    ):
        self.draft_type = draft_type
        self.instructions = instructions
        self.tone_examples = tone_examples or []
        self.matter_context = matter_context

    def generate_draft(self, agent, step_callback=None) -> Task:
        """Task: Generate the first draft."""
        tone_context = ""
        if self.tone_examples:
            tone_context = (
                "\n\nTONE/STYLE REFERENCE DOCUMENTS (match this voice):\n"
                + "\n---\n".join(self.tone_examples[:3])
            )

        matter = f"\n\nMATTER CONTEXT:\n{self.matter_context}" if self.matter_context else ""

        return Task(
            agent=agent,
            step_callback=step_callback,
            description=(
                f"Generate a professional legal {self.draft_type} based on the following "
                f"instructions. The draft must be complete, properly formatted, and ready "
                f"for attorney review.\n\n"
                f"DRAFT TYPE: {self.draft_type}\n"
                f"INSTRUCTIONS: {self.instructions}\n"
                f"{tone_context}\n"
                f"{matter}\n\n"
                f"Requirements:\n"
                f"- Use proper legal formatting and structure\n"
                f"- Include appropriate headers, signature blocks, and date lines\n"
                f"- Mark any placeholders with [BRACKETS]\n"
                f"- If {self.draft_type} is 'motion' or 'brief', include proper court caption\n"
                f"- If {self.draft_type} is 'contract', include proper party identification\n"
                f"- If {self.draft_type} is 'email', use professional legal email format\n"
                f"- Match the tone of any provided reference documents"
            ),
            expected_output=(
                "A complete draft document containing: "
                "1. draft_content (the full draft text with proper formatting) "
                "2. metadata (draft_type, word_count, sections_count) "
                "3. placeholders (list of [BRACKETED] items that need attorney input) "
                "4. tone_notes (how the draft matches the reference tone)"
            ),
        )

    def validate_citations(self, agent, context: Optional[List[Task]] = None, step_callback=None) -> Task:
        """Task: Validate all citations in the draft."""
        return Task(
            agent=agent,
            step_callback=step_callback,
            description=(
                f"Review the generated {self.draft_type} for all legal citations. "
                f"For each citation found:\n"
                f"1. Verify the citation format (Bluebook standard)\n"
                f"2. Flag any citation that appears to be fabricated or unverifiable\n"
                f"3. Note any missing pinpoint citations\n"
                f"4. Suggest alternative citations where more authoritative sources exist\n\n"
                f"INSTRUCTIONS CONTEXT: {self.instructions}\n\n"
                f"Use the draft content from the previous task as input."
            ),
            expected_output=(
                "A citation validation report containing: "
                "1. citations_found (list of all citations identified) "
                "2. validation_results (per citation: text, format_check, verifiability, notes) "
                "3. fabricated_citations (citations that cannot be verified) "
                "4. suggested_improvements (better citations to use instead)"
            ),
            context=context or [],
        )


# ═══════════════════════════════════════════════════════════════
# CREW 3: RESEARCH TASKS
# ═══════════════════════════════════════════════════════════════

class ResearchTasks:
    """Tasks for the Research & Discovery crew."""

    def __init__(
        self,
        query: str,
        source_chunks: List[str],
        jurisdiction: Optional[str] = None,
    ):
        self.query = query
        self.source_chunks = source_chunks
        self.jurisdiction = jurisdiction

    def research(self, agent, step_callback=None) -> Task:
        """Task: Research the legal question."""
        sources = "\n\n---\n\n".join(
            f"[SOURCE {i+1}]:\n{chunk[:2000]}"
            for i, chunk in enumerate(self.source_chunks[:15])
        )

        jurisdiction_text = (
            f"\n\nJURISDICTION: {self.jurisdiction}. Prioritize sources and analysis "
            f"relevant to {self.jurisdiction} law."
        ) if self.jurisdiction else ""

        return Task(
            agent=agent,
            step_callback=step_callback,
            description=(
                f"Research the following legal question using the provided source documents. "
                f"Decompose the question into sub-questions if needed for thorough coverage.\n\n"
                f"QUESTION: {self.query}\n"
                f"{jurisdiction_text}\n\n"
                f"SOURCE DOCUMENTS:\n{sources}\n\n"
                f"Instructions:\n"
                f"- Only use information from the provided sources\n"
                f"- If a source is ambiguous or incomplete, note the limitation\n"
                f"- Identify the strongest authorities on each sub-question\n"
                f"- Never fabricate — if the sources don't answer a question, say so"
            ),
            expected_output=(
                "A research findings document containing: "
                "1. question_decomposition (sub-questions identified) "
                "2. findings (per sub-question: answer, source_refs, confidence) "
                "3. key_authorities (most important sources identified) "
                "4. gaps (questions the sources could not answer) "
                "5. jurisdiction_notes (jurisdiction-specific observations)"
            ),
        )

    def synthesize(self, agent, context: Optional[List[Task]] = None, step_callback=None) -> Task:
        """Task: Synthesize research into a memorandum."""
        return Task(
            agent=agent,
            step_callback=step_callback,
            description=(
                f"Synthesize the research findings into a clear, well-structured legal "
                f"memorandum. Every factual claim must cite a source with confidence level "
                f"(DIRECT_QUOTE, PARAPHRASED, or INFERRED).\n\n"
                f"ORIGINAL QUESTION: {self.query}\n\n"
                f"Structure the memorandum:\n"
                f"1. EXECUTIVE SUMMARY — 2-3 paragraph high-level answer\n"
                f"2. LEGAL FRAMEWORK — applicable statutes, rules, standards\n"
                f"3. ANALYSIS — detailed answer with citations to sources\n"
                f"4. OPEN QUESTIONS — what remains uncertain or needs further research\n"
                f"5. RECOMMENDATIONS — practical next steps for the attorney\n\n"
                f"Use the research findings from the previous task as input."
            ),
            expected_output=(
                "A structured legal memorandum containing: "
                "1. title and metadata "
                "2. executive_summary "
                "3. legal_framework "
                "4. analysis (with source citations and confidence levels) "
                "5. open_questions "
                "6. recommendations "
                "7. source_index (mapping of citation IDs to full source references)"
            ),
            context=context or [],
        )


# ═══════════════════════════════════════════════════════════════
# CREW 4: COMPLIANCE TASKS
# ═══════════════════════════════════════════════════════════════

class ComplianceTasks:
    """Tasks for the Compliance & Negotiation crew."""

    def __init__(
        self,
        output_text: str,
        output_type: str,
        firm_id: str,
        user_id: str,
        matter_id: Optional[str] = None,
        contract_issues: Optional[List[Dict[str, Any]]] = None,
    ):
        self.output_text = output_text
        self.output_type = output_type
        self.firm_id = firm_id
        self.user_id = user_id
        self.matter_id = matter_id
        self.contract_issues = contract_issues or []

    def compliance_check(self, agent, context: Optional[List[Task]] = None, step_callback=None) -> Task:
        """Task: Validate output against regulatory requirements."""
        issues_summary = ""
        if self.contract_issues:
            issues_summary = (
                "\n\nCONTRACT ISSUES IDENTIFIED:\n" +
                "\n".join(
                    f"- {i.get('clause_type', 'Unknown')}: Risk {i.get('risk_score', 'N/A')}/10"
                    for i in self.contract_issues[:10]
                )
            )

        return Task(
            agent=agent,
            step_callback=step_callback,
            description=(
                f"Validate the following AI-generated output against regulatory requirements:\n"
                f"- SOC 2 Type II: Data handling, access controls, audit trails\n"
                f"- ISO 27001: Information security management\n"
                f"- GDPR: Personal data handling, right to explanation\n"
                f"- CCPA: California consumer privacy rights\n"
                f"- Client confidentiality: No cross-client data leakage\n\n"
                f"OUTPUT TYPE: {self.output_type}\n"
                f"FIRM: {self.firm_id}\n"
                f"USER: {self.user_id}\n"
                f"{issues_summary}\n\n"
                f"OUTPUT CONTENT (first 5000 chars):\n```\n{self.output_text[:5000]}\n```\n\n"
                f"Flag any compliance concern. Be conservative — if unsure, flag it."
            ),
            expected_output=(
                "A compliance verification report containing: "
                "1. overall_status (PASS / NEEDS_REVIEW / FAIL) "
                "2. framework_results (per framework: status, findings, recommendations) "
                "3. flagged_concerns (specific issues that need attention) "
                "4. data_privacy_notes (GDPR/CCPA specific observations) "
                "5. remediation_steps (how to fix any identified issues)"
            ),
            context=context or [],
        )

    def negotiation_advice(self, agent, context: Optional[List[Task]] = None, step_callback=None) -> Task:
        """Task: Generate negotiation guidance from contract issues."""
        if not self.contract_issues:
            return Task(
                agent=agent,
                step_callback=step_callback,
                description=(
                    "No contract issues to analyze. Simply confirm that no negotiation "
                    "advice is needed for this output and summarize why."
                ),
                expected_output="A one-line confirmation that no negotiation advice is required.",
                context=context or [],
            )

        issues_text = "\n".join(
            f"Issue {i+1}: {issue.get('clause_type', 'Unknown')}\n"
            f"  Risk Score: {issue.get('risk_score', 'N/A')}/10\n"
            f"  Deviation: {issue.get('deviation', 'Not specified')}\n"
            f"  Required: {issue.get('required_value', 'Not specified')}\n"
            f"  Actual: {issue.get('actual_value', 'Not specified')}"
            for i, issue in enumerate(self.contract_issues[:10])
        )

        return Task(
            agent=agent,
            step_callback=step_callback,
            description=(
                f"Generate a strategic negotiation playbook for the following contract issues. "
                f"For each issue, provide:\n"
                f"1. OPENING POSITION — strongest argument to start with\n"
                f"2. FALLBACK POSITION — acceptable compromise\n"
                f"3. WALKAWAY POINT — when to refuse and escalate\n"
                f"4. MARKET DATA — what percentage of similar deals accept this position\n"
                f"5. NEGOTIATION TACTIC — specific technique to use\n\n"
                f"CONTRACT ISSUES:\n{issues_text}\n\n"
                f"Use the compliance check results from the previous task for context "
                f"about regulatory constraints."
            ),
            expected_output=(
                "A negotiation playbook containing: "
                "1. strategy_summary (overall negotiation approach) "
                "2. per_issue_guidance (for each issue: opening, fallback, walkaway, "
                "   market_data, tactic) "
                "3. priority_order (which issues to negotiate first) "
                "4. leverage_points (areas of strength identified) "
                "5. risk_escalation_triggers (when to involve senior partners)"
            ),
            context=context or [],
        )


# ---------------------------------------------------------------
# CONSULTING TASKS (Proposal, Market Intel, Engagement)
# ---------------------------------------------------------------

class ProposalTasks:
    def __init__(self, proposal_type, client_context, scope, timeline, budget_range, past_examples=None, firm_name=""):
        self.proposal_type = proposal_type; self.client_context = client_context
        self.scope = scope; self.timeline = timeline; self.budget_range = budget_range
        self.past_examples = past_examples or []; self.firm_name = firm_name

    def analyze_rfp(self, agent, step_callback=None) -> Task:
        return Task(agent=agent, step_callback=step_callback,
            description=f"Analyze the following RFP/client brief for {self.proposal_type}. Extract: 1. Key requirements 2. Ghost criteria (unstated needs) 3. Evaluation factors 4. Disqualifiers 5. Win themes (3-4 differentiating narratives). CLIENT: {self.client_context} SCOPE: {self.scope} TIMELINE: {self.timeline} BUDGET: {self.budget_range}",
            expected_output="RFP analysis: 1. requirements_summary 2. ghost_criteria 3. win_themes (3-4) 4. disqualifiers 5. evaluation_scorecard")

    def write_proposal(self, agent, context=None, step_callback=None) -> Task:
        examples = "\n---\n".join(self.past_examples[:2]) if self.past_examples else ""
        return Task(agent=agent, step_callback=step_callback, context=context or [],
            description=f"Write a complete consulting {self.proposal_type} for {self.firm_name or 'our firm'}. Structure: 1. Executive Summary (1pg) 2. Situation Assessment 3. Proposed Methodology (phased with deliverables) 4. Team (roles + bios) 5. Timeline (Gantt with milestones) 6. Pricing (aligned with {self.budget_range}) 7. Why Us (differentiators, past work) 8. Next Steps (clear CTA). CLIENT: {self.client_context} SCOPE: {self.scope} EXAMPLES:\n{examples}",
            expected_output="Complete proposal: 1. executive_summary 2. situation_assessment 3. methodology 4. team_section 5. timeline 6. pricing 7. differentiators 8. metadata")

    def build_financials(self, agent, context=None, step_callback=None) -> Task:
        return Task(agent=agent, step_callback=step_callback, context=context or [],
            description=f"Build financial model for this proposal. Include: 1. Fee breakdown by phase 2. Resource plan (team days x rates) 3. ROI projection (3-year) 4. Sensitivity analysis (best/base/worst) 5. Assumptions log. BUDGET: {self.budget_range} SCOPE: {self.scope}",
            expected_output="Financial model: 1. fee_breakdown 2. resource_plan 3. roi_projection 4. sensitivity_table 5. key_metrics (NPV, payback, BCR)")


class MarketIntelTasks:
    def __init__(self, industry, company, question, depth="comprehensive"):
        self.industry = industry; self.company = company; self.question = question; self.depth = depth

    def research_market(self, agent, step_callback=None) -> Task:
        return Task(agent=agent, step_callback=step_callback,
            description=f"Market research for {self.industry} / {self.company}. Question: {self.question}. Depth: {self.depth}. Cover: 1. Market size (TAM/SAM/SOM with growth rates) 2. Key trends (5-7) 3. Competitive landscape (5-8 mapped) 4. Customer segments 5. SWOT for {self.company} 6. Growth opportunities (whitespace, adjacencies). Cite sources.",
            expected_output="Market report: 1. executive_summary 2. market_sizing 3. trends_analysis 4. competitive_landscape 5. swot 6. growth_recommendations")

    def synthesize_strategy(self, agent, context=None, step_callback=None) -> Task:
        return Task(agent=agent, step_callback=step_callback, context=context or [],
            description=f"Based on market research, develop strategy for {self.company} ({self.industry}). Deliver: 1. Strategic options (3-4 paths) 2. Framework application (Porter, BCG, etc.) 3. Trade-off analysis 4. Clear recommendation 5. Implementation roadmap (90d/6m/12m) 6. Success metrics (KPIs). Original question: {self.question}",
            expected_output="Strategy doc: 1. strategic_options 2. trade_off_matrix 3. primary_recommendation 4. implementation_roadmap 5. kpi_dashboard 6. risk_mitigation")


class EngagementTasks:
    def __init__(self, project_name, client_name, scope, start_date, end_date, team_size=3):
        self.project_name = project_name; self.client_name = client_name
        self.scope = scope; self.start_date = start_date; self.end_date = end_date
        self.team_size = team_size

    def structure_engagement(self, agent, step_callback=None) -> Task:
        return Task(agent=agent, step_callback=step_callback,
            description=f"Structure engagement for {self.project_name} ({self.client_name}). SCOPE: {self.scope} TIMELINE: {self.start_date} to {self.end_date} TEAM: {self.team_size} people. Deliver: 1. Work Breakdown Structure (phases, workstreams) 2. Resource plan (roles, allocation %) 3. Risk register (top 10) 4. Stakeholder map (power/interest) 5. Deliverable tracker 6. Communication plan.",
            expected_output="Engagement setup: 1. wbs 2. resource_plan 3. risk_register 4. stakeholder_map 5. deliverable_tracker 6. communication_plan")

    def status_report(self, agent, context=None, step_callback=None) -> Task:
        return Task(agent=agent, step_callback=step_callback, context=context or [],
            description=f"Generate client status report for {self.project_name} ({self.client_name}). Include: 1. Executive summary (RAG status, 3 bullets) 2. Accomplishments this period 3. Planned next period 4. Key metrics (progress %, budget burn) 5. Risks & issues 6. Decisions required. Max 3 pages. Professional consulting format for C-suite.",
            expected_output="Status report: 1. executive_summary (RAG) 2. accomplishments 3. planned 4. kpi_dashboard 5. risks 6. decisions_required")


# ─── CA Vertical Task Builders (Crews 9-13) ─────────────────────────────────

class CABookkeepingTasks:
    """Crew 9: Bookkeeping Reconciliation — task builders."""

    def __init__(self, client_name: str, period: str, trial_balance_ref: str = "", bank_stmt_ref: str = ""):
        self.client_name = client_name
        self.period = period
        self.trial_balance_ref = trial_balance_ref
        self.bank_stmt_ref = bank_stmt_ref

    def match_transactions(self, agent, step_callback=None) -> Task:
        return Task(agent=agent, step_callback=step_callback,
            description=f"MATCH bank statement entries to {self.client_name}'s books for period {self.period}. Match by: amount, date (±3 days), narration/keywords, counterparty name. Trial balance ref: {self.trial_balance_ref}. Bank statement ref: {self.bank_stmt_ref}. Flag unmatched items — never auto-resolve. Every match must carry provenance (source doc, row/line, date). Treat PAN/GSTIN-linked data as sensitive. NO pattern learning across clients.",
            expected_output="Matched transactions: 1. matched_entries (with provenance per entry) 2. unmatched_bank_entries 3. unmatched_book_entries 4. match_rate % 5. confidence_score per match")

    def analyze_variances(self, agent, context=None, step_callback=None) -> Task:
        return Task(agent=agent, step_callback=step_callback, context=context or [],
            description=f"ANALYZE variances from {self.client_name}'s reconciliation (period: {self.period}). Categorize each: timing difference, GST input credit mismatch, bank charges not in books, book entries not in bank, rounding errors. Calculate net impact on GST liability. Flag material variances (over ₹10,000 individually or ₹50,000 aggregate). Never adjust entries without partner approval — you analyze, the CA decides.",
            expected_output="Variance analysis: 1. variance_by_category (count, amount, gst_impact) 2. material_variances (flagged for partner) 3. gst_liability_impact 4. recommendations_per_variance 5. partner_review_checklist")

    def compile_report(self, agent, context=None, step_callback=None) -> Task:
        return Task(agent=agent, step_callback=step_callback, context=context or [],
            description=f"COMPILE reconciliation report for {self.client_name} ({self.period}). Include: 1. Executive summary (match rate %, variance, GST impact) 2. Variance breakdown by category 3. Prioritized partner review list 4. Action items with deadlines 5. Confidence scores per section. Footer MUST state: 'This report is AI-generated. All flagged items require CA partner review before any filing or adjustment.' Every number carries provenance.",
            expected_output="Reconciliation report: 1. executive_summary 2. variance_breakdown (table) 3. partner_review_items (prioritized) 4. action_items 5. confidence_scores 6. provenance_track")


class CAGSTTasks:
    """Crew 10: GST & Indirect Tax — task builders."""

    def __init__(self, client_name: str, gstin: str, period: str):
        self.client_name = client_name
        self.gstin = gstin
        self.period = period

    def reconcile_itc(self, agent, step_callback=None) -> Task:
        return Task(agent=agent, step_callback=step_callback,
            description=f"RECONCILE GSTR-2A ITC for {self.client_name} (GSTIN: {self.gstin}, period: {self.period}). Match every GSTR-2A invoice against purchase register. Flag: ITC claimed but supplier not filed, ITC in 2A not in books, timing differences, ineligible ITC (personal/motor vehicle/exempt). Section 16(4) deadline awareness. Never auto-claim or auto-disallow — every mismatch to partner review.",
            expected_output="ITC reconciliation: 1. matched_invoices (count, amount) 2. itc_claimed_supplier_not_filed 3. itc_2a_not_in_books 4. timing_differences 5. ineligible_itc_items 6. net_itc_eligible 7. partner_review_items")

    def validate_returns(self, agent, context=None, step_callback=None) -> Task:
        return Task(agent=agent, step_callback=step_callback, context=context or [],
            description=f"VALIDATE GSTR-1 and GSTR-3B data for {self.client_name} ({self.gstin}, period: {self.period}). Cross-check against: sales register, purchase register, ITC reconciliation, e-invoice data, HSN/SAC codes, place of supply. Every validation is a 'suggestion for partner review' — not a correction. NEVER call GSP with 'file' intent.",
            expected_output="GST validation: 1. gstr1_validation (outward supplies) 2. gstr3b_validation (summary) 3. hsn_sac_issues 4. place_of_supply_issues 5. gstr1_vs_3b_reconciliation 6. partner_review_suggestions")

    def prep_filing_package(self, agent, context=None, step_callback=None) -> Task:
        return Task(agent=agent, step_callback=step_callback, context=context or [],
            description=f"PREPARE GST filing package for {self.client_name} ({self.gstin}, period: {self.period}). Compile: GSTR-3B summary values, GSTR-1 invoice data, reconciliation notes, filing checklist. Every number carries provenance. Mark ALL as 'DRAFT — partner review required.' Include partner verification checklist. Note: UDIN must be generated after filing.",
            expected_output="Filing package: 1. gstr3b_values (draft) 2. gstr1_data (draft) 3. reconciliation_notes 4. partner_checklist 5. udin_reminder 6. disclaimer (no auto-file)")


class CAAuditTasks:
    """Crew 11: Audit & Assurance — task builders."""

    def __init__(self, client_name: str, year: str, engagement_type: str = "Statutory Audit"):
        self.client_name = client_name
        self.year = year
        self.engagement_type = engagement_type

    def assess_risks(self, agent, step_callback=None) -> Task:
        return Task(agent=agent, step_callback=step_callback,
            description=f"ASSESS audit risks for {self.client_name} (FY {self.year}, {self.engagement_type}) per SA 315. Analyze trial balance for: unusual ratios, large round-number transactions, related-party volumes, cash transactions above ₹2 lakh, revenue recognition patterns, quarter-over-quarter fluctuations. Risk ratings: LOW/MEDIUM/HIGH. Cite applicable SA standard per flag. Never conclude 'no risk.'",
            expected_output="Risk assessment: 1. risk_matrix (area, risk_level, sa_standard, evidence) 2. key_risk_indicators 3. material_misstatement_risk 4. fraud_risk_factors 5. recommended_audit_procedures")

    def recommend_samples(self, agent, context=None, step_callback=None) -> Task:
        return Task(agent=agent, step_callback=step_callback, context=context or [],
            description=f"RECOMMEND audit samples for {self.client_name} (FY {self.year}) per SA 530. Based on risk assessment: sample size, selection method (random/stratified/MUS), tolerable error, expected error rate. Higher risk → MUS for overstatement. Lower risk → random selection. Document: population size, sample size, selection method, rationale per SA 530 paragraphs.",
            expected_output="Sampling plan: 1. sample_sizes_by_area 2. selection_methods 3. tolerable_error_per_area 4. sa_530_rationale 5. sampling_risks")

    def compile_audit_report(self, agent, context=None, step_callback=None) -> Task:
        return Task(agent=agent, step_callback=step_callback, context=context or [],
            description=f"COMPILE audit report draft for {self.client_name} (FY {self.year}). Format per SA 700/705/706: Independent Auditor's Report, CARO 2020 annexure, Tax Audit Form 3CD data. Every opinion marked 'DRAFT — partner review.' Flag material misstatements with quantification. Footer: 'This is AI-assisted. Signing CA bears professional responsibility.' UDIN reminder.",
            expected_output="Audit report draft: 1. auditors_report (SA 700) 2. caro_2020_annexure 3. form_3cd_data 4. material_misstatements 5. emphasis_of_matter 6. partner_review_checklist 7. udin_reminder")


class CAIncomeTaxTasks:
    """Crew 12: Income Tax & TDS — task builders."""

    def __init__(self, client_name: str, pan: str, assessment_year: str):
        self.client_name = client_name
        self.pan = pan
        self.assessment_year = assessment_year

    def reconcile_tds(self, agent, step_callback=None) -> Task:
        return Task(agent=agent, step_callback=step_callback,
            description=f"RECONCILE TDS for {self.client_name} (PAN: {self.pan}, AY {self.assessment_year}). Match 26AS TDS entries against books. Flag: TDS not deposited by deductor, deposited but not booked, PAN mismatch, rate mismatch. Every mismatch carries deductor TAN, amount, period. Section 199: TDS credit in year income assessable. All mismatches to partner review.",
            expected_output="TDS reconciliation: 1. matched_entries 2. tds_not_deposited 3. tds_not_booked 4. pan_mismatches 5. rate_mismatches 6. follow_up_actions (with deductor TAN)")

    def aggregate_itr_data(self, agent, context=None, step_callback=None) -> Task:
        return Task(agent=agent, step_callback=step_callback, context=context or [],
            description=f"AGGREGATE ITR data for {self.client_name} (PAN: {self.pan}, AY {self.assessment_year}). From 26AS, AIS, and books: Schedule BP (P&L), Schedule CG (capital gains), Schedule OS (other sources), Schedule TDS, Schedule IT. Match AIS against books (AIS often has errors). Recommend ITR form. All data 'DRAFT — verify before filing.' ITR filing manual by CA with DSC.",
            expected_output="ITR data: 1. schedule_bp 2. schedule_cg 3. schedule_os 4. schedule_tds 5. schedule_it 6. itr_form_recommendation 7. ais_vs_books_differences 8. total_tax_liability_estimate")

    def draft_notice_response(self, agent, context=None, step_callback=None) -> Task:
        return Task(agent=agent, step_callback=step_callback, context=context or [],
            description=f"DRAFT notice response for {self.client_name} (PAN: {self.pan}). Analyze notice (section, AY, issue). Gather relevant data. Draft structured response with: 1. Notice reference 2. Grounds 3. Supporting documents list 4. Legal citations. MARK: 'DRAFT — CA REVIEW & SUBMISSION REQUIRED.' Late response = penalties. Retain for 8 years from end of AY.",
            expected_output="Notice response: 1. notice_details 2. response_body 3. supporting_documents 4. legal_citations 5. submission_checklist 6. deadline_tracking")


class CAROCTasks:
    """Crew 13: ROC/Corporate Compliance — task builders."""

    def __init__(self, client_name: str, cin: str):
        self.client_name = client_name
        self.cin = cin

    def track_deadlines(self, agent, step_callback=None) -> Task:
        return Task(agent=agent, step_callback=step_callback,
            description=f"TRACK all ROC/MCA deadlines for {self.client_name} (CIN: {self.cin}). Monitor: AOC-4 (AGM+30d), MGT-7 (AGM+60d), DIR-3 KYC (Sep 30), ADT-1 (AGM+15d), MGT-14 (event-based). Severity: >30d green, 7-30d yellow, <7d orange, overdue red. Never auto-file — Counsel prepares, CA signs with DSC.",
            expected_output="Deadline tracker: 1. all_deadlines (form, due_date, severity, status) 2. overdue_items 3. upcoming_7days 4. upcoming_30days 5. filing_checklist_per_form")

    def compile_form_data(self, agent, context=None, step_callback=None) -> Task:
        return Task(agent=agent, step_callback=step_callback, context=context or [],
            description=f"COMPILE form data for {self.client_name} (CIN: {self.cin}). For AOC-4: BS/PL from signed FS. For MGT-7: director details, shareholding. For DIR-3 KYC: DIN, PAN, passport verified against MCA. Every field carries data source provenance. All outputs 'DRAFT — PARTNER REVIEW.' CA signs with DSC on MCA21.",
            expected_output="Form data: 1. aoc4_data 2. mgt7_data 3. dir3_kyc_data 4. adt1_data 5. provenance_per_field 6. partner_verification_checklist")

    def manage_calendar(self, agent, context=None, step_callback=None) -> Task:
        return Task(agent=agent, step_callback=step_callback, context=context or [],
            description=f"MANAGE unified compliance calendar for {self.client_name} (CIN: {self.cin}). Consolidate ALL deadlines: GST, Income Tax, TDS, ROC, Audit. Prioritize by urgency. Track status. Auto-calculate due dates. Generate alerts for WhatsApp/Email. Never mark 'filed' without recorded human sign-off + UDIN.",
            expected_output="Compliance calendar: 1. consolidated_calendar (all types) 2. priority_sorted 3. auto_calculated_dates 4. status_tracking 5. alert_schedule 6. whatsapp_nudge_drafts")
