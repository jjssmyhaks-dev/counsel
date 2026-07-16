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
    create_audit_logger,
    create_compliance_checker,
    create_negotiator_advisor,
)
from .tasks import (
    DocumentIntelligenceTasks,
    DraftingTasks,
    ResearchTasks,
    ComplianceTasks,
)
from ..orchestrator.audit_agent import audit_trail, AuditAction
from ..orchestrator.structured_logging import create_step_callback, metrics, write_event
from ..orchestrator.retry import with_retry

logger = logging.getLogger(__name__)


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

    tasks = DocumentIntelligenceTasks(
        document_text=document_text,
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
        "raw_output": result.raw if hasattr(result, "raw") else str(result),
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
        "raw_output": result.raw if hasattr(result, "raw") else str(result),
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
        "raw_output": result.raw if hasattr(result, "raw") else str(result),
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
    """Run the 3-agent compliance + negotiation pipeline.

    Flow:
      1. AuditLogger → log the action immutably
      2. ComplianceChecker → validate against regulatory requirements
      3. NegotiatorAdvisor → generate negotiation guidance (if contract issues)
    """
    logger_agent = create_audit_logger()
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
    t_audit = tasks.audit_log(agent=logger_agent, step_callback=sc)
    t_check = tasks.compliance_check(agent=checker, context=[t_audit], step_callback=sc)
    t_advice = tasks.negotiation_advice(agent=advisor, context=[t_check], step_callback=sc)

    crew = Crew(
        agents=[logger_agent, checker, advisor],
        tasks=[t_audit, t_check, t_advice],
        process=Process.sequential,
        verbose=True,
    )

    result = await crew.kickoff_async()
    return {
        "crew": "compliance",
        "status": "completed",
        "raw_output": result.raw if hasattr(result, "raw") else str(result),
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

    # Step 2: Compliance & Negotiation
    logger.info("Starting Compliance crew...")
    compliance_result = await run_compliance_crew(
        output_text=di_result.get("raw_output", ""),
        output_type="contract_analysis",
        firm_id=firm_id,
        user_id=user_id,
        matter_id=matter_id,
        contract_issues=None,  # Will be populated from DI result
    )

    return {
        "pipeline": "full_contract_analysis",
        "status": "completed",
        "document_intelligence": di_result,
        "compliance": compliance_result,
    }
