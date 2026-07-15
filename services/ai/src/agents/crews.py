"""CrewAI Crew Definitions and Task Pipelines.

Four specialized crews, each with their own process flow and task hierarchy.
All crews use Cloudflare Workers AI (Llama 4 Scout / Llama 3.3 70B / DeepSeek R1)
via the CloudflareLLM wrapper.
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

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
# CREW 1: DOCUMENT INTELLIGENCE
# ═══════════════════════════════════════════════════════════════

def run_document_intelligence(
    document_text: str,
    playbook_rules: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Run the 3-agent document intelligence pipeline.

    Flow:
      1. ClauseExtractor → extract clause types with excerpts
      2. RiskAnalyzer → score each clause on 1-10 risk scale
      3. PlaybookGuardian → check against firm standards

    Args:
        document_text: Full text of the contract/document.
        playbook_rules: Optional list of playbook rule dicts.

    Returns:
        Dict with clauses, risk_assessments, playbook_results, and summary.
    """
    extractor = create_clause_extractor()
    risk_analyzer = create_risk_analyzer()
    guardian = create_playbook_guardian()

    tasks = DocumentIntelligenceTasks(
        document_text=document_text,
        playbook_rules=playbook_rules,
    )

    crew = Crew(
        agents=[extractor, risk_analyzer, guardian],
        tasks=[
            tasks.extract_clauses(),
            tasks.analyze_risks(),
            tasks.check_playbook(),
        ],
        process=Process.sequential,
        verbose=True,
    )

    result = crew.kickoff()
    return {
        "crew": "document_intelligence",
        "status": "completed",
        "raw_output": result.raw if hasattr(result, "raw") else str(result),
        "token_usage": result.token_usage if hasattr(result, "token_usage") else {},
    }


def run_document_intelligence_async(
    document_text: str,
    playbook_rules: Optional[List[Dict[str, Any]]] = None,
):
    """Async wrapper for run_document_intelligence."""
    import asyncio
    loop = asyncio.get_event_loop()
    return loop.run_in_executor(
        None, run_document_intelligence, document_text, playbook_rules
    )


# ═══════════════════════════════════════════════════════════════
# CREW 2: DRAFTING
# ═══════════════════════════════════════════════════════════════

def run_drafting_crew(
    draft_type: str,
    instructions: str,
    tone_examples: Optional[List[str]] = None,
    matter_context: Optional[str] = None,
) -> Dict[str, Any]:
    """Run the 2-agent drafting pipeline.

    Flow:
      1. LegalDrafter → generate first draft with LLM, matching tone
      2. CitationValidator → validate and format all citations

    Args:
        draft_type: "email", "memo", "motion", "brief", "contract", or "report".
        instructions: What the draft should contain.
        tone_examples: Optional list of reference documents for voice matching.
        matter_context: Optional matter background info.

    Returns:
        Dict with draft_content, citations, validation_report.
    """
    drafter = create_legal_drafter()
    validator = create_citation_validator()

    tasks = DraftingTasks(
        draft_type=draft_type,
        instructions=instructions,
        tone_examples=tone_examples,
        matter_context=matter_context,
    )

    crew = Crew(
        agents=[drafter, validator],
        tasks=[
            tasks.generate_draft(),
            tasks.validate_citations(),
        ],
        process=Process.sequential,
        verbose=True,
    )

    result = crew.kickoff()
    return {
        "crew": "drafting",
        "status": "completed",
        "draft_type": draft_type,
        "raw_output": result.raw if hasattr(result, "raw") else str(result),
        "token_usage": result.token_usage if hasattr(result, "token_usage") else {},
    }


# ═══════════════════════════════════════════════════════════════
# CREW 3: RESEARCH & DISCOVERY
# ═══════════════════════════════════════════════════════════════

def run_research_crew(
    query: str,
    source_chunks: List[str],
    jurisdiction: Optional[str] = None,
) -> Dict[str, Any]:
    """Run the 2-agent legal research pipeline.

    Flow:
      1. LegalResearcher → decompose query, search, retrieve relevant info
      2. RAGSynthesizer → synthesize into cited memorandum

    Args:
        query: The legal question to research.
        source_chunks: Pre-retrieved context chunks from pgvector.
        jurisdiction: Optional jurisdiction filter (e.g., "Delaware", "California").

    Returns:
        Dict with memorandum, findings, citations, open_questions.
    """
    researcher = create_legal_researcher()
    synthesizer = create_rag_synthesizer()

    tasks = ResearchTasks(
        query=query,
        source_chunks=source_chunks,
        jurisdiction=jurisdiction,
    )

    crew = Crew(
        agents=[researcher, synthesizer],
        tasks=[
            tasks.research(),
            tasks.synthesize(),
        ],
        process=Process.sequential,
        verbose=True,
    )

    result = crew.kickoff()
    return {
        "crew": "research",
        "status": "completed",
        "query": query,
        "raw_output": result.raw if hasattr(result, "raw") else str(result),
        "token_usage": result.token_usage if hasattr(result, "token_usage") else {},
    }


# ═══════════════════════════════════════════════════════════════
# CREW 4: COMPLIANCE & NEGOTIATION
# ═══════════════════════════════════════════════════════════════

def run_compliance_crew(
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

    Args:
        output_text: The AI-generated output to audit and check.
        output_type: Type of output (e.g., "contract_analysis", "draft", "research").
        firm_id: The firm identifier.
        user_id: The user who initiated the action.
        matter_id: Optional matter context.
        contract_issues: Optional list of issues from contract analysis.

    Returns:
        Dict with audit_entry, compliance_report, negotiation_advice.
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

    crew = Crew(
        agents=[logger_agent, checker, advisor],
        tasks=[
            tasks.audit_log(),
            tasks.compliance_check(),
            tasks.negotiation_advice(),
        ],
        process=Process.sequential,
        verbose=True,
    )

    result = crew.kickoff()
    return {
        "crew": "compliance",
        "status": "completed",
        "raw_output": result.raw if hasattr(result, "raw") else str(result),
        "token_usage": result.token_usage if hasattr(result, "token_usage") else {},
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
      Document Intelligence → Compliance & Negotiation → (optional Drafting)

    Args:
        document_text: Full contract text.
        firm_id: Firm identifier for audit logging.
        user_id: User identifier for audit logging.
        matter_id: Optional matter context.
        playbook_rules: Optional custom playbook rules.

    Returns:
        Complete analysis with all crew outputs merged.
    """
    import asyncio

    # Step 1: Document Intelligence
    logger.info("Starting Document Intelligence crew...")
    di_result = run_document_intelligence(
        document_text=document_text,
        playbook_rules=playbook_rules,
    )

    # Step 2: Compliance & Negotiation
    logger.info("Starting Compliance crew...")
    compliance_result = run_compliance_crew(
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
