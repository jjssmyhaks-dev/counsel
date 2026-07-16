"""CrewAI Task Definitions for Counsel AI Multi-Agent System.

Each task is a self-contained unit of work with clear inputs, expected outputs,
and a human-readable description. Tasks are designed to chain through CrewAI's
sequential process mode.

CrewAI 1.x requirements:
- Each Task must have an explicit `agent`.
- `context` must be a list of Task objects (not dicts).
Task builders therefore accept the agent and optional context tasks.
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
    ):
        self.document_text = document_text
        self.playbook_rules = playbook_rules or []

    def extract_clauses(self, agent) -> Task:
        """Task: Extract all legal clauses from the document."""
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
                f"DOCUMENT TEXT:\n```\n{self.document_text[:15000]}\n```\n\n"
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

    def analyze_risks(self, agent, context: Optional[List[Task]] = None) -> Task:
        """Task: Score each clause on a 1-10 risk scale."""
        return Task(
            agent=agent,
            description=(
                f"Analyze the risk profile of each extracted clause from the document. "
                f"For each clause:\n"
                f"1. Assign a risk score (1-10, 10=extremely high risk)\n"
                f"2. Explain why the score was assigned (specific legal reasoning)\n"
                f"3. Compare to market standards where applicable\n"
                f"4. Estimate potential financial exposure if the clause is enforced\n\n"
                f"DOCUMENT TEXT:\n```\n{self.document_text[:8000]}\n```\n\n"
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

    def check_playbook(self, agent, context: Optional[List[Task]] = None) -> Task:
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
            description=(
                f"Validate every clause in the contract against the firm's playbook rules. "
                f"For each rule, determine:\n"
                f"- PASS: The clause complies with the playbook\n"
                f"- VIOLATION: The clause violates the playbook (specify what's wrong)\n"
                f"- MISSING: The required clause/provision is absent\n\n"
                f"PLAYBOOK RULES:\n{rules_text}\n\n"
                f"DOCUMENT TEXT:\n```\n{self.document_text[:8000]}\n```\n\n"
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

    def generate_draft(self, agent) -> Task:
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

    def validate_citations(self, agent, context: Optional[List[Task]] = None) -> Task:
        """Task: Validate all citations in the draft."""
        return Task(
            agent=agent,
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

    def research(self, agent) -> Task:
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

    def synthesize(self, agent, context: Optional[List[Task]] = None) -> Task:
        """Task: Synthesize research into a memorandum."""
        return Task(
            agent=agent,
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

    def audit_log(self, agent) -> Task:
        """Task: Log the action in the immutable audit trail."""
        import hashlib
        import datetime

        content_hash = hashlib.sha256(self.output_text.encode()).hexdigest()[:16]
        timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()

        return Task(
            agent=agent,
            description=(
                f"Create an audit trail entry for the following AI action:\n\n"
                f"TIMESTAMP: {timestamp}\n"
                f"OUTPUT TYPE: {self.output_type}\n"
                f"FIRM ID: {self.firm_id}\n"
                f"USER ID: {self.user_id}\n"
                f"MATTER ID: {self.matter_id or 'N/A'}\n"
                f"CONTENT HASH: {content_hash}\n\n"
                f"Verify that this entry meets SOC 2 Type II and ISO 27001 requirements "
                f"for audit trail immutability and completeness."
            ),
            expected_output=(
                "An audit trail entry containing: "
                "1. entry_id (unique identifier) "
                "2. timestamp (ISO 8601 with timezone) "
                "3. action_type (from OUTPUT_TYPE) "
                "4. actor (user_id, firm_id) "
                "5. resource (matter_id if applicable) "
                "6. content_hash (SHA-256) "
                "7. compliance_checks (SOC2, ISO27001, GDPR status)"
            ),
        )

    def compliance_check(self, agent, context: Optional[List[Task]] = None) -> Task:
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

    def negotiation_advice(self, agent, context: Optional[List[Task]] = None) -> Task:
        """Task: Generate negotiation guidance from contract issues."""
        if not self.contract_issues:
            return Task(
                agent=agent,
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
