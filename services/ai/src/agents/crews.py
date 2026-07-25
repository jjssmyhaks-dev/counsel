"""CrewAI Crew Definitions and Task Pipelines.

Four specialized crews, each with their own process flow and task hierarchy.
All crews use Cloudflare Workers AI (Llama 4 Scout / Llama 3.3 70B / DeepSeek R1)
via the CloudflareLLM wrapper.

All crew runners are async — they use `crew.kickoff_async()` to avoid the
asyncio.run() conflict with uvicorn's event loop.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from crewai import Crew, Process

from .definitions import (
    create_clause_extractor,
    create_risk_analyzer,
    create_playbook_guardian,
    create_legal_drafter,
    create_citation_validator,
    create_legal_researcher,
    create_rag_synthesizer,
    create_compliance_checker,
    create_negotiator_advisor,
    create_proposal_writer,
    create_market_intelligence_analyst,
    create_strategic_advisor,
    create_rfp_analyzer,
    create_engagement_manager,
    create_financial_modeler,
)
from .tasks import (
    DocumentIntelligenceTasks,
    DraftingTasks,
    ResearchTasks,
    ComplianceTasks,
    ProposalTasks,
    MarketIntelTasks,
    EngagementTasks,
)
from ..orchestrator.audit_agent import audit_trail, AuditAction
from ..orchestrator.structured_logging import create_step_callback, metrics, write_event
from ..orchestrator.retry import with_retry

logger = logging.getLogger(__name__)


def _serialize_output(result) -> str:
    """Extract raw output from CrewAI result, handling pydantic dicts.

    When output_pydantic is set on a Task, result.raw is a dict (the pydantic
    model serialized), not a string. When not set, it's a plain string.
    """
    import json
    raw = result.raw if hasattr(result, "raw") else str(result)
    if isinstance(raw, dict):
        return json.dumps(raw, default=str)
    if isinstance(raw, str):
        return raw
    return str(raw)


# ── Document truncation ──
# All crews use the same truncation point for consistency across
# a single pipeline run. Tasks receive pre-truncated text rather
# than each slicing independently.
_CLAUSE_EXTRACTION_CHARS = 15000
_RISK_ANALYSIS_CHARS = 8000


def _truncate_for_extraction(text: str) -> str:
    """Truncate document text for clause extraction (first-pass)."""
    return text[:_CLAUSE_EXTRACTION_CHARS]


def _truncate_for_risk(text: str) -> str:
    """Truncate document text for risk analysis (consistent with extraction)."""
    return text[:_RISK_ANALYSIS_CHARS]


# ═══════════════════════════════════════════════════════════════
# CREW 1: DOCUMENT INTELLIGENCE
# ═══════════════════════════════════════════════════════════════

@with_retry("document_intelligence", max_retries=2)
async def run_document_intelligence(
    document_text: str,
    playbook_rules: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Run the 3-agent document intelligence pipeline.

    Flow:
      1. ClauseExtractor → extract clause types with excerpts
      2. RiskAnalyzer → score each clause on 1-10 risk scale
      3. PlaybookGuardian → check against firm standards
    """
    extractor = create_clause_extractor()
    risk_analyzer = create_risk_analyzer()
    guardian = create_playbook_guardian()

    # Pre-truncate consistently — tasks no longer slice independently
    doc_for_extract = _truncate_for_extraction(document_text)
    doc_for_risk = _truncate_for_risk(document_text)

    tasks = DocumentIntelligenceTasks(
        document_text=doc_for_extract,
        risk_context_text=doc_for_risk,
        playbook_rules=playbook_rules,
    )

    sc = create_step_callback("document_intelligence")
    t_extract = tasks.extract_clauses(agent=extractor, step_callback=sc)
    t_risks = tasks.analyze_risks(agent=risk_analyzer, context=[t_extract], step_callback=sc)
    t_playbook = tasks.check_playbook(agent=guardian, context=[t_extract, t_risks], step_callback=sc)

    crew = Crew(
        agents=[extractor, risk_analyzer, guardian],
        tasks=[t_extract, t_risks, t_playbook],
        process=Process.sequential,
        verbose=True,
    )

    result = await crew.kickoff_async()
    token_usage = dict(result.token_usage) if hasattr(result, "token_usage") and result.token_usage else {}
    
    # Log token usage to audit trail
    audit_trail.log(
        action=AuditAction.CONTRACT_ANALYSIS_COMPLETED,
        resource_id="document_intelligence",
        user_id="system",
        metadata={"token_usage": token_usage},
    )
    
    return {
        "crew": "document_intelligence",
        "status": "completed",
        "raw_output": _serialize_output(result),
        "token_usage": token_usage,
    }


# ═══════════════════════════════════════════════════════════════
# CREW 2: DRAFTING
# ═══════════════════════════════════════════════════════════════

@with_retry("drafting", max_retries=2)
async def run_drafting_crew(
    draft_type: str,
    instructions: str,
    tone_examples: Optional[List[str]] = None,
    matter_context: Optional[str] = None,
) -> Dict[str, Any]:
    """Run the 2-agent drafting pipeline.

    Flow:
      1. LegalDrafter → generate first draft with LLM, matching tone
      2. CitationValidator → validate and format all citations
    """
    drafter = create_legal_drafter()
    validator = create_citation_validator()

    tasks = DraftingTasks(
        draft_type=draft_type,
        instructions=instructions,
        tone_examples=tone_examples,
        matter_context=matter_context,
    )

    sc = create_step_callback("drafting")
    t_draft = tasks.generate_draft(agent=drafter, step_callback=sc)
    t_citations = tasks.validate_citations(agent=validator, context=[t_draft], step_callback=sc)

    crew = Crew(
        agents=[drafter, validator],
        tasks=[t_draft, t_citations],
        process=Process.sequential,
        verbose=True,
    )

    result = await crew.kickoff_async()
    return {
        "crew": "drafting",
        "status": "completed",
        "draft_type": draft_type,
        "raw_output": _serialize_output(result),
        "token_usage": dict(result.token_usage) if hasattr(result, "token_usage") and result.token_usage else {},
    }


# ═══════════════════════════════════════════════════════════════
# CREW 3: RESEARCH & DISCOVERY
# ═══════════════════════════════════════════════════════════════

@with_retry("research", max_retries=2)
async def run_research_crew(
    query: str,
    source_chunks: List[str],
    jurisdiction: Optional[str] = None,
) -> Dict[str, Any]:
    """Run the 2-agent legal research pipeline.

    Flow:
      1. LegalResearcher → decompose query, search, retrieve relevant info
      2. RAGSynthesizer → synthesize into cited memorandum
    """
    researcher = create_legal_researcher()
    synthesizer = create_rag_synthesizer()

    tasks = ResearchTasks(
        query=query,
        source_chunks=source_chunks,
        jurisdiction=jurisdiction,
    )

    sc = create_step_callback("research")
    t_research = tasks.research(agent=researcher, step_callback=sc)
    t_synthesize = tasks.synthesize(agent=synthesizer, context=[t_research], step_callback=sc)

    crew = Crew(
        agents=[researcher, synthesizer],
        tasks=[t_research, t_synthesize],
        process=Process.sequential,
        verbose=True,
    )

    result = await crew.kickoff_async()
    return {
        "crew": "research",
        "status": "completed",
        "query": query,
        "raw_output": _serialize_output(result),
        "token_usage": dict(result.token_usage) if hasattr(result, "token_usage") and result.token_usage else {},
    }


# ═══════════════════════════════════════════════════════════════
# CREW 4: COMPLIANCE & NEGOTIATION
# ═══════════════════════════════════════════════════════════════

@with_retry("compliance", max_retries=2)
async def run_compliance_crew(
    output_text: str,
    output_type: str,
    firm_id: str,
    user_id: str,
    matter_id: Optional[str] = None,
    contract_issues: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Run the 2-agent compliance + negotiation pipeline.

    Audit logging is handled by the @with_retry decorator, which calls
    audit_trail.log() on every attempt (success/failure/retry).

    Flow:
      1. ComplianceChecker → validate against regulatory requirements
      2. NegotiatorAdvisor → generate negotiation guidance (if contract issues)
    """
    checker = create_compliance_checker()
    advisor = create_negotiator_advisor()

    tasks = ComplianceTasks(
        output_text=output_text,
        output_type=output_type,
        firm_id=firm_id,
        user_id=user_id,
        matter_id=matter_id,
        contract_issues=contract_issues,
    )

    sc = create_step_callback("compliance")
    t_check = tasks.compliance_check(agent=checker, step_callback=sc)
    t_advice = tasks.negotiation_advice(agent=advisor, context=[t_check], step_callback=sc)

    crew = Crew(
        agents=[checker, advisor],
        tasks=[t_check, t_advice],
        process=Process.sequential,
        verbose=True,
    )

    result = await crew.kickoff_async()
    return {
        "crew": "compliance",
        "status": "completed",
        "raw_output": _serialize_output(result),
        "token_usage": dict(result.token_usage) if hasattr(result, "token_usage") and result.token_usage else {},
    }


# ═══════════════════════════════════════════════════════════════
# ORCHESTRATOR: Full Pipeline
# ═══════════════════════════════════════════════════════════════

async def run_full_contract_pipeline(
    document_text: str,
    firm_id: str,
    user_id: str,
    matter_id: Optional[str] = None,
    playbook_rules: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Run the complete contract analysis pipeline across all crews.

    This is the master orchestrator that chains all 4 crews:
      Document Intelligence → Compliance & Negotiation

    Args:
        document_text: Full contract text.
        firm_id: Firm identifier for audit logging.
        user_id: User identifier for audit logging.
        matter_id: Optional matter context.
        playbook_rules: Optional custom playbook rules.

    Returns:
        Complete analysis with all crew outputs merged.
    """
    # Step 1: Document Intelligence
    logger.info("Starting Document Intelligence crew...")
    di_result = await run_document_intelligence(
        document_text=document_text,
        playbook_rules=playbook_rules,
    )

    # Step 2: Parse risk_breakdown from DI result into contract_issues
    contract_issues = _parse_risk_breakdown(di_result.get("raw_output", ""))

    # Step 3: Compliance & Negotiation
    logger.info("Starting Compliance crew with %d contract issues...", len(contract_issues))
    compliance_result = await run_compliance_crew(
        output_text=di_result.get("raw_output", ""),
        output_type="contract_analysis",
        firm_id=firm_id,
        user_id=user_id,
        matter_id=matter_id,
        contract_issues=contract_issues,
    )

    return {
        "pipeline": "full_contract_analysis",
        "status": "completed",
        "document_intelligence": di_result,
        "compliance": compliance_result,
        "contract_issues_count": len(contract_issues),
    }




def _parse_risk_breakdown(raw_output: str) -> List[Dict[str, Any]]:
    """Extract contract_issues from DI raw_output risk_breakdown.

    Attempts structured parsing first (pydantic RiskMatrix), then
    falls back to JSON substring extraction for free-text outputs,
    then to keyword-based clause-name extraction.
    """
    import json
    import re
    from .schemas import RiskMatrix

    # Try pydantic parse first
    try:
        parsed = RiskMatrix.model_validate_json(raw_output)
        issues = []
        for item in parsed.risk_breakdown:
            issues.append({
                "clause_type": item.clause_type,
                "risk_score": item.risk_score,
                "deviation": item.rationale[:200] if item.rationale else "",
                "required_value": "",
                "actual_value": item.market_standard_comparison or "",
            })
        # Apply priority ordering from negotiation_priority
        for i, clause_type in enumerate(parsed.negotiation_priority):
            for issue in issues:
                if issue["clause_type"] == clause_type:
                    issue.setdefault("priority", i + 1)
        return sorted(issues, key=lambda x: x.get("priority", 999))
    except Exception:
        pass

    # Try JSON substring extraction (free-text LLM output often wraps JSON in ```json blocks)
    json_match = re.search(r'\{[^{}]*"risk_breakdown"[^{}]*\[.*?\][^{}]*\}', raw_output, re.DOTALL)
    if json_match:
        try:
            data = json.loads(json_match.group())
            breakdown = data.get("risk_breakdown", [])
            return [
                {
                    "clause_type": item.get("clause_type", "Unknown"),
                    "risk_score": item.get("risk_score", 5),
                    "deviation": item.get("rationale", "")[:200],
                    "required_value": item.get("required_value", ""),
                    "actual_value": item.get("actual_value", ""),
                }
                for item in breakdown
            ]
        except (json.JSONDecodeError, AttributeError):
            pass

    # If the output is itself a dict, try extracting directly
    if isinstance(raw_output, dict):
        breakdown = raw_output.get("risk_breakdown", [])
        if breakdown:
            return [
                {
                    "clause_type": item.get("clause_type", "Unknown"),
                    "risk_score": item.get("risk_score", 5),
                    "deviation": item.get("rationale", "")[:200],
                }
                for item in breakdown
            ]

    # Fallback: extract known clause types from flat text
    logger.info("No structured risk_breakdown found; extracting clauses from raw text")
    return _extract_clause_lines(raw_output)


def _extract_clause_lines(raw_output: str) -> List[Dict[str, Any]]:
    """Last-resort fallback: parse clause names from free-text raw_output."""
    import re
    known_clauses = [
        "Indemnification", "Limitation of Liability", "Termination",
        "Intellectual Property", "Confidentiality", "Governing Law",
        "Force Majeure", "Payment Terms", "Representations and Warranties",
        "Insurance", "Assignment", "Data Protection", "Privacy",
        "Non-Compete", "Non-Solicit", "Severability", "Notices",
        "Entire Agreement",
    ]
    issues = []
    output_lower = raw_output.lower()
    for clause in known_clauses:
        if clause.lower() in output_lower:
            # Try to find a risk score near the clause name
            score_match = re.search(
                rf'{re.escape(clause)}.*?(\d+(?:\.\d+)?)\s*(?:/10|out of 10)',
                raw_output, re.IGNORECASE
            )
            risk_score = float(score_match.group(1)) if score_match else 5.0
            issues.append({
                "clause_type": clause,
                "risk_score": risk_score,
                "deviation": "Extracted from free-text output",
            })
    return issues


# ---------------------------------------------------------------
# CONSULTING CREWS (3 Crews, 6 Agents)
# ---------------------------------------------------------------

# -- Crew 5: Proposal Generation --

@with_retry("proposal", max_retries=2)
async def run_proposal_crew(
    proposal_type: str,
    client_context: str,
    scope: str,
    timeline: str,
    budget_range: str,
    past_examples: Optional[List[str]] = None,
    firm_name: str = "",
) -> Dict[str, Any]:
    rfp = create_rfp_analyzer()
    writer = create_proposal_writer()
    modeler = create_financial_modeler()
    tasks = ProposalTasks(proposal_type=proposal_type, client_context=client_context,
                          scope=scope, timeline=timeline, budget_range=budget_range,
                          past_examples=past_examples, firm_name=firm_name)
    sc = create_step_callback("proposal")
    t_rfp = tasks.analyze_rfp(agent=rfp, step_callback=sc)
    t_write = tasks.write_proposal(agent=writer, context=[t_rfp], step_callback=sc)
    t_fin = tasks.build_financials(agent=modeler, context=[t_rfp, t_write], step_callback=sc)
    crew = Crew(agents=[rfp, writer, modeler], tasks=[t_rfp, t_write, t_fin], process=Process.sequential, verbose=True)
    result = await crew.kickoff_async()
    return {"crew": "proposal", "status": "completed", "raw_output": _serialize_output(result),
            "token_usage": dict(result.token_usage) if hasattr(result, "token_usage") and result.token_usage else {}}


# -- Crew 6: Market Intelligence --

@with_retry("market_intel", max_retries=2)
async def run_market_intel_crew(
    industry: str, company: str, question: str, depth: str = "comprehensive",
) -> Dict[str, Any]:
    analyst = create_market_intelligence_analyst()
    strategist = create_strategic_advisor()
    tasks = MarketIntelTasks(industry=industry, company=company, question=question, depth=depth)
    sc = create_step_callback("market_intel")
    t_research = tasks.research_market(agent=analyst, step_callback=sc)
    t_synthesize = tasks.synthesize_strategy(agent=strategist, context=[t_research], step_callback=sc)
    crew = Crew(agents=[analyst, strategist], tasks=[t_research, t_synthesize], process=Process.sequential, verbose=True)
    result = await crew.kickoff_async()
    return {"crew": "market_intel", "status": "completed", "raw_output": _serialize_output(result),
            "token_usage": dict(result.token_usage) if hasattr(result, "token_usage") and result.token_usage else {}}


# -- Crew 7: Engagement Management --

@with_retry("engagement", max_retries=2)
async def run_engagement_crew(
    project_name: str, client_name: str, scope: str, start_date: str, end_date: str, team_size: int = 3,
) -> Dict[str, Any]:
    mgr = create_engagement_manager()
    strategist = create_strategic_advisor()
    tasks = EngagementTasks(project_name=project_name, client_name=client_name, scope=scope,
                            start_date=start_date, end_date=end_date, team_size=team_size)
    sc = create_step_callback("engagement")
    t_structure = tasks.structure_engagement(agent=mgr, step_callback=sc)
    t_report = tasks.status_report(agent=strategist, context=[t_structure], step_callback=sc)
    crew = Crew(agents=[mgr, strategist], tasks=[t_structure, t_report], process=Process.sequential, verbose=True)
    result = await crew.kickoff_async()
    return {"crew": "engagement", "status": "completed", "raw_output": _serialize_output(result),
            "token_usage": dict(result.token_usage) if hasattr(result, "token_usage") and result.token_usage else {}}
