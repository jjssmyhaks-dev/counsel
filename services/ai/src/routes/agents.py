"""FastAPI routes for the CrewAI multi-agent system.

Exposes the four crews as HTTP endpoints:
  POST /agents/analyze/contract  — Document Intelligence crew
  POST /agents/draft             — Drafting crew
  POST /agents/research          — Research & Discovery crew
  POST /agents/compliance        — Compliance & Negotiation crew
  POST /agents/pipeline/full     — Full pipeline (all 4 crews)
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..config import settings
from ..providers.cloudflare import get_cloudflare
from ..embeddings.embedder import embedder
from ..rag.retriever import retriever
from ..orchestrator.audit_agent import audit_trail, AuditAction
from ..agents.crews import (
    run_document_intelligence,
    run_drafting_crew,
    run_research_crew,
    run_compliance_crew,
    run_proposal_crew,
    run_market_intel_crew,
    run_engagement_crew,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agents", tags=["Multi-Agent AI"])


# ── Request/Response Models ────────────────────────────────────


class ContractAnalysisAgentRequest(BaseModel):
    document_text: str = Field(..., description="Full text of the contract")
    firm_id: str = Field(..., description="Firm identifier for audit")
    user_id: str = Field(..., description="User who initiated analysis")
    matter_id: Optional[str] = Field(None, description="Associated matter")
    playbook_rules: Optional[List[Dict[str, Any]]] = Field(
        None, description="Custom playbook rules"
    )


class DraftAgentRequest(BaseModel):
    draft_type: str = Field(
        ..., description="email, memo, motion, brief, contract, or report"
    )
    instructions: str = Field(..., description="What to draft")
    tone_examples: Optional[List[str]] = Field(
        None, description="Reference documents for voice matching"
    )
    matter_context: Optional[str] = Field(None, description="Matter background")


class ResearchAgentRequest(BaseModel):
    query: str = Field(..., description="Legal research question")
    firm_id: str = Field(..., description="Firm for document retrieval")
    matter_id: Optional[str] = Field(None, description="Limit to specific matter")
    jurisdiction: Optional[str] = Field(None, description="Jurisdiction filter")
    top_k: int = Field(10, description="Number of chunks to retrieve")


class ComplianceAgentRequest(BaseModel):
    output_text: str = Field(..., description="AI output to audit/check")
    output_type: str = Field(..., description="contract_analysis, draft, or research")
    firm_id: str = Field(..., description="Firm identifier")
    user_id: str = Field(..., description="User identifier")
    matter_id: Optional[str] = Field(None)
    contract_issues: Optional[List[Dict[str, Any]]] = Field(None)


class FullPipelineRequest(BaseModel):
    document_text: str = Field(..., description="Full contract text")
    firm_id: str = Field(..., description="Firm for audit")
    user_id: str = Field(..., description="User identifier")
    matter_id: Optional[str] = Field(None)
    playbook_rules: Optional[List[Dict[str, Any]]] = Field(None)


# ── Consulting request models ──

class ProposalAgentRequest(BaseModel):
    proposal_type: str = Field(..., description="proposal, pitch_deck, SOW, or RFP_response")
    client_context: str = Field(..., description="Client background and needs")
    scope: str = Field(..., description="Project scope description")
    timeline: str = Field(..., description="Project timeline")
    budget_range: str = Field(..., description="Budget range")
    past_examples: Optional[List[str]] = Field(None, description="Past proposals for voice/tone")
    firm_name: str = Field("", description="Firm name for branding")


class MarketIntelRequest(BaseModel):
    industry: str = Field(..., description="Target industry")
    company: str = Field(..., description="Target company")
    question: str = Field(..., description="Research question")
    depth: str = Field("comprehensive", description="quick, standard, or comprehensive")


class EngagementRequest(BaseModel):
    project_name: str = Field(..., description="Project name")
    client_name: str = Field(..., description="Client name")
    scope: str = Field(..., description="Project scope")
    start_date: str = Field(..., description="Start date")
    end_date: str = Field(..., description="End date")
    team_size: int = Field(3, description="Team size")


class AgentResponse(BaseModel):
    crew: str
    status: str
    raw_output: Optional[str] = None
    token_usage: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


# ── Crew Endpoints ─────────────────────────────────────────────


@router.post("/analyze/contract", response_model=AgentResponse)
async def analyze_contract(req: ContractAnalysisAgentRequest):
    """Run the Document Intelligence crew on a contract.

    Pipeline: ClauseExtractor → RiskAnalyzer → PlaybookGuardian
    """
    try:
        audit_trail.log(
            action=AuditAction.CONTRACT_ANALYSIS_STARTED,
            resource_id="contract_analysis",
            firm_id=req.firm_id,
            user_id=req.user_id,
            metadata={"matter_id": req.matter_id, "text_length": len(req.document_text)},
        )

        result = await run_document_intelligence(
            document_text=req.document_text,
            playbook_rules=req.playbook_rules,
        )

        return AgentResponse(
            crew=result.get("crew", "document_intelligence"),
            status=result.get("status", "completed"),
            raw_output=result.get("raw_output"),
            token_usage=result.get("token_usage"),
        )
    except Exception as e:
        logger.error("Contract analysis crew failed: %s", e, exc_info=True)
        return AgentResponse(
            crew="document_intelligence",
            status="failed",
            error=str(e),
        )


@router.post("/draft", response_model=AgentResponse)
async def generate_draft(req: DraftAgentRequest):
    """Run the Drafting crew.

    Pipeline: LegalDrafter → CitationValidator
    """
    try:
        result = await run_drafting_crew(
            draft_type=req.draft_type,
            instructions=req.instructions,
            tone_examples=req.tone_examples,
            matter_context=req.matter_context,
        )

        return AgentResponse(
            crew=result.get("crew", "drafting"),
            status=result.get("status", "completed"),
            raw_output=result.get("raw_output"),
            token_usage=result.get("token_usage"),
        )
    except Exception as e:
        logger.error("Drafting crew failed: %s", e, exc_info=True)
        return AgentResponse(
            crew="drafting",
            status="failed",
            error=str(e),
        )


@router.post("/research", response_model=AgentResponse)
async def research_query(req: ResearchAgentRequest):
    """Run the Research & Discovery crew.

    Pipeline: RAG retrieval → LegalResearcher → RAGSynthesizer
    """
    try:
        # Step 1: Retrieve relevant chunks via pgvector
        query_embedding = await embedder.embed_query(req.query)
        try:
            raw_results = await retriever.search(
                query_embedding=query_embedding,
                firm_id=req.firm_id,
                matter_id=req.matter_id,
                top_k=req.top_k,
            )
            source_chunks = [r["text"] for r in raw_results]
        except Exception as search_err:
            logger.warning("pgvector search failed, using query as context: %s", search_err)
            source_chunks = []

        # If no indexed docs found, use the query itself as context so the crew can still reason
        if not source_chunks:
            source_chunks = [
                f"[Research Query]: {req.query}",
                "[Note: No indexed documents found for this firm. The researcher should provide a general analysis based on legal knowledge and standard practices.]",
            ]

        # Step 2: Run the research crew
        result = await run_research_crew(
            query=req.query,
            source_chunks=source_chunks,
            jurisdiction=req.jurisdiction,
        )

        return AgentResponse(
            crew=result.get("crew", "research"),
            status=result.get("status", "completed"),
            raw_output=result.get("raw_output"),
            token_usage=result.get("token_usage"),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Research crew failed: %s", e, exc_info=True)
        return AgentResponse(
            crew="research",
            status="failed",
            error=str(e),
        )


@router.post("/compliance", response_model=AgentResponse)
async def check_compliance(req: ComplianceAgentRequest):
    """Run the Compliance & Negotiation crew.

    Pipeline: AuditLogger → ComplianceChecker → NegotiatorAdvisor
    """
    try:
        result = await run_compliance_crew(
            output_text=req.output_text,
            output_type=req.output_type,
            firm_id=req.firm_id,
            user_id=req.user_id,
            matter_id=req.matter_id,
            contract_issues=req.contract_issues,
        )

        return AgentResponse(
            crew=result.get("crew", "compliance"),
            status=result.get("status", "completed"),
            raw_output=result.get("raw_output"),
            token_usage=result.get("token_usage"),
        )
    except Exception as e:
        logger.error("Compliance crew failed: %s", e, exc_info=True)
        return AgentResponse(
            crew="compliance",
            status="failed",
            error=str(e),
        )


@router.post("/pipeline/full", response_model=AgentResponse)
async def full_pipeline(req: FullPipelineRequest):
    """Run all 4 crews in sequence: Document Intelligence → Compliance.

    This is the master workflow for complete contract analysis.
    """
    try:
        audit_trail.log(
            action=AuditAction.CONTRACT_ANALYSIS_STARTED,
            resource_id="full_pipeline",
            firm_id=req.firm_id,
            user_id=req.user_id,
            metadata={"matter_id": req.matter_id, "has_playbook": bool(req.playbook_rules)},
        )

        from ..agents.crews import run_full_contract_pipeline

        result = await run_full_contract_pipeline(
            document_text=req.document_text,
            firm_id=req.firm_id,
            user_id=req.user_id,
            matter_id=req.matter_id,
            playbook_rules=req.playbook_rules,
        )

        audit_trail.log(
            action=AuditAction.CONTRACT_ANALYSIS_COMPLETED,
            resource_id="full_pipeline",
            firm_id=req.firm_id,
            user_id=req.user_id,
        )

        return AgentResponse(
            crew="full_pipeline",
            status=result.get("status", "completed"),
            raw_output=str(result.get("document_intelligence", {}).get("raw_output", "")),
            token_usage=(
                result.get("document_intelligence", {}).get("token_usage", {})
            ),
        )
    except Exception as e:
        logger.error("Full pipeline failed: %s", e, exc_info=True)
        return AgentResponse(
            crew="full_pipeline",
            status="failed",
            error=str(e),
        )


@router.get("/status")
async def agents_status():
    """Health check and status for the multi-agent system."""
    try:
        cf = get_cloudflare()
        cf_health = await cf.check_health()
    except Exception:
        cf_health = {"status": "unavailable"}

    return {
        "status": "operational",
        "framework": "CrewAI",
        "crews": 13,
        "agents": 31,
        "models": {
            "default": settings.cloudflare_text_model,
            "embedding": settings.embedding_model,
            "embedding_dim": settings.embedding_dim,
        },
        "cloudflare": cf_health,
    }




# ---------------------------------------------------------------
# CHAT ENDPOINT — Intent Router for Chat-First Interface
# ---------------------------------------------------------------


class ChatRequest(BaseModel):
    message: str = Field(..., description="User's natural language message")
    firm_id: str = Field(..., description="Tenant firm ID")
    user_id: str = Field(..., description="User who sent the message")
    thread_id: Optional[str] = Field(None, description="Existing conversation thread ID")
    context: Optional[Dict[str, Any]] = Field(None, description="Optional context: toolId, matterId, etc.")
    tools: Optional[List[Dict[str, Any]]] = Field(None, description="Available tool definitions")
    approved_steps: Optional[List[str]] = Field(None, description="Step IDs pre-approved by user")


class ChatResponse(BaseModel):
    id: str
    role: str = "assistant"
    content: str
    timestamp: str
    thread_id: Optional[str] = None
    actions: Optional[List[Dict[str, Any]]] = None
    toolSuggestions: Optional[List[Dict[str, Any]]] = None
    result: Optional[Dict[str, Any]] = None
    requiresApproval: Optional[bool] = None
    approvalSteps: Optional[List[Dict[str, Any]]] = None
    entities: Optional[Dict[str, Any]] = None


# Intent classification keywords mapped to crew endpoints
_INTENT_MAP = {
    "analyze_contract": {"crew": "document_intelligence", "keywords": ["analyze", "contract", "review contract", "clause", "risk"], "endpoint": "/analyze/contract"},
    "draft": {"crew": "drafting", "keywords": ["draft", "write", "compose", "memorandum", "memo", "brief", "motion", "contract draft"], "endpoint": "/draft"},
    "research": {"crew": "research", "keywords": ["research", "case law", "precedent", "find cases", "legal question"], "endpoint": "/research"},
    "compliance": {"crew": "compliance", "keywords": ["compliance", "gdpr", "ccpa", "soc2", "regulatory", "check compliance"], "endpoint": "/compliance"},
    "proposal": {"crew": "proposal", "keywords": ["proposal", "sow", "pitch", "rfp", "bid"], "endpoint": "/proposal"},
    "market_intel": {"crew": "market_intel", "keywords": ["market", "competitor", "swot", "industry", "tam", "competitive"], "endpoint": "/market-intel"},
    "engagement": {"crew": "engagement", "keywords": ["engagement", "project plan", "wbs", "status report", "deliverable"], "endpoint": "/engagement"},
    "bookkeeping": {"crew": "ca_bookkeeping", "keywords": ["reconcile", "bank statement", "bookkeeping", "trial balance", "variance", "match transaction"], "endpoint": "/ca/bookkeeping"},
    "gst": {"crew": "ca_gst", "keywords": ["gst", "gstr", "input tax credit", "itc", "gstin", "gst reconciliation", "gst return"], "endpoint": "/ca/gst"},
    "audit": {"crew": "ca_audit", "keywords": ["audit", "statutory audit", "internal audit", "sa 315", "sa 530", "audit report", "sampling"], "endpoint": "/ca/audit"},
    "income_tax": {"crew": "ca_income_tax", "keywords": ["income tax", "tds", "itr", "26as", "tax notice", "pan", "assessment year", "tax reconciliation"], "endpoint": "/ca/income-tax"},
    "roc": {"crew": "ca_roc", "keywords": ["roc", "mca", "aoc-4", "mgt-7", "filing deadline", "company filing", "director", "din"], "endpoint": "/ca/roc"},
}


def _classify_intent(message: str) -> str:
    """Simple keyword-based intent classification."""
    lower = message.lower()
    for intent, config in _INTENT_MAP.items():
        for kw in config["keywords"]:
            if kw in lower:
                return intent
    return "general"


@router.post("/chat", response_model=ChatResponse)
async def chat_message(req: ChatRequest):
    """Autonomous chat endpoint — plans, executes, and tracks multi-step tasks.

    Uses the autonomous engine for:
    - Conversation memory across turns
    - LLM-powered task decomposition
    - Cross-crew chaining
    - MCP tool calling
    - Filing approval gates
    - Entity extraction
    """
    import uuid
    from datetime import datetime, timezone

    msg_id = f"msg_{uuid.uuid4().hex[:12]}"
    ts = datetime.now(timezone.utc).isoformat()

    try:
        from ..orchestrator.autonomous_chat import autonomous_chat

        # Use autonomous engine
        result = await autonomous_chat.chat(
            firm_id=req.firm_id,
            user_id=req.user_id,
            message=req.message,
            thread_id=req.thread_id,
            approved_steps=req.approved_steps,
        )

        return ChatResponse(
            id=result.get("message_id", msg_id),
            role="assistant",
            content=result.get("content", ""),
            timestamp=ts,
            thread_id=result.get("thread_id"),
            toolSuggestions=result.get("tool_suggestions"),
            result=result.get("plan"),
            requiresApproval=result.get("requires_approval"),
            approvalSteps=result.get("approval_steps"),
            entities=result.get("entities"),
        )

    except Exception as e:
        logger.error("Autonomous chat failed: %s", e, exc_info=True)
        # Fallback to simple LLM response
        try:
            from ..agents.cloudflare_llm import get_default_llm
            llm = get_default_llm(temperature=0.3)
            response = llm.call([
                {"role": "system", "content": "You are Counsel AI, an expert legal/consulting/CA assistant."},
                {"role": "user", "content": req.message},
            ])
            return ChatResponse(
                id=msg_id, role="assistant",
                content=response or "I encountered an error. Please try again.",
                timestamp=ts,
            )
        except Exception:
            return ChatResponse(
                id=msg_id, role="assistant",
                content="I encountered an error processing your request. Please try again.",
                timestamp=ts,
            )


@router.get("/chat/threads")
async def list_chat_threads(firm_id: str, user_id: Optional[str] = None):
    """List all chat threads for a firm."""
    from ..orchestrator.autonomous_chat import autonomous_chat
    threads = autonomous_chat.list_threads(firm_id, user_id)
    return {"threads": threads}


@router.get("/chat/threads/{thread_id}/messages")
async def get_thread_messages(firm_id: str, thread_id: str):
    """Get message history for a thread."""
    from ..orchestrator.autonomous_chat import autonomous_chat
    messages = autonomous_chat.get_thread_history(firm_id, thread_id)
    return {"messages": messages}


@router.post("/chat/plan")
async def preview_chat_plan(req: ChatRequest):
    """Preview the execution plan without executing (for approval flow)."""
    from ..orchestrator.autonomous_chat import autonomous_chat
    result = autonomous_chat.plan_and_preview(
        firm_id=req.firm_id,
        user_id=req.user_id,
        message=req.message,
        thread_id=req.thread_id,
    )
    return result


# ---------------------------------------------------------------
# CONSULTING ROUTES
# ---------------------------------------------------------------

@router.post("/proposal", response_model=AgentResponse)
async def generate_proposal(req: ProposalAgentRequest):
    """Run the Proposal Generation crew.

    Pipeline: RFPAnalyzer ? ProposalWriter ? FinancialModeler
    """
    try:
        result = await run_proposal_crew(
            proposal_type=req.proposal_type,
            client_context=req.client_context,
            scope=req.scope,
            timeline=req.timeline,
            budget_range=req.budget_range,
            past_examples=req.past_examples,
            firm_name=req.firm_name,
        )
        return AgentResponse(
            crew=result.get("crew", "proposal"),
            status=result.get("status", "completed"),
            raw_output=result.get("raw_output"),
            token_usage=result.get("token_usage"),
        )
    except Exception as e:
        logger.error("Proposal crew failed: %s", e, exc_info=True)
        return AgentResponse(crew="proposal", status="failed", error=str(e))


@router.post("/market-intel", response_model=AgentResponse)
async def market_intelligence(req: MarketIntelRequest):
    """Run the Market Intelligence crew.

    Pipeline: MarketAnalyst ? StrategyAdvisor
    """
    try:
        result = await run_market_intel_crew(
            industry=req.industry,
            company=req.company,
            question=req.question,
            depth=req.depth,
        )
        return AgentResponse(
            crew=result.get("crew", "market_intel"),
            status=result.get("status", "completed"),
            raw_output=result.get("raw_output"),
            token_usage=result.get("token_usage"),
        )
    except Exception as e:
        logger.error("Market intel crew failed: %s", e, exc_info=True)
        return AgentResponse(crew="market_intel", status="failed", error=str(e))


@router.post("/engagement", response_model=AgentResponse)
async def manage_engagement(req: EngagementRequest):
    """Run the Engagement Management crew.

    Pipeline: EngagementManager ? StrategyAdvisor (status report)
    """
    try:
        result = await run_engagement_crew(
            project_name=req.project_name,
            client_name=req.client_name,
            scope=req.scope,
            start_date=req.start_date,
            end_date=req.end_date,
            team_size=req.team_size,
        )
        return AgentResponse(
            crew=result.get("crew", "engagement"),
            status=result.get("status", "completed"),
            raw_output=result.get("raw_output"),
            token_usage=result.get("token_usage"),
        )
    except Exception as e:
        logger.error("Engagement crew failed: %s", e, exc_info=True)
        return AgentResponse(crew="engagement", status="failed", error=str(e))


# ---------------------------------------------------------------
# CA VERTICAL ROUTES (Crews 9–13)
# ---------------------------------------------------------------


class CABookkeepingRequest(BaseModel):
    client_name: str = Field("Client", description="Client name")
    period: str = Field("Q1 2026", description="Reporting period")
    trial_balance_ref: str = Field("", description="Reference to trial balance document")
    bank_stmt_ref: str = Field("", description="Reference to bank statement document")


class CAGSTRequest(BaseModel):
    client_name: str = Field("Client")
    gstin: str = Field("", description="GSTIN")
    period: str = Field("", description="Tax period")


class CAAuditRequest(BaseModel):
    client_name: str = Field("Client")
    year: str = Field("2025-26", description="Financial year")
    engagement_type: str = Field("Statutory Audit")


class CAIncomeTaxRequest(BaseModel):
    client_name: str = Field("Client")
    pan: str = Field("", description="PAN number")
    assessment_year: str = Field("2026-27")


class CAROCRequest(BaseModel):
    client_name: str = Field("Client")
    cin: str = Field("", description="Corporate Identity Number")


@router.post("/ca/bookkeeping", response_model=AgentResponse)
async def ca_bookkeeping(req: CABookkeepingRequest):
    """Run Bookkeeping Reconciliation crew (C9)."""
    try:
        from ..agents.crews import run_ca_bookkeeping_reconciliation
        result = await run_ca_bookkeeping_reconciliation(
            client_name=req.client_name, period=req.period,
            trial_balance_ref=req.trial_balance_ref, bank_stmt_ref=req.bank_stmt_ref,
        )
        return AgentResponse(crew="ca_bookkeeping", status="completed",
                            raw_output=result.get("raw_output"),
                            token_usage=result.get("token_usage"))
    except Exception as e:
        logger.error("CA bookkeeping crew failed: %s", e, exc_info=True)
        return AgentResponse(crew="ca_bookkeeping", status="failed", error=str(e))


@router.post("/ca/gst", response_model=AgentResponse)
async def ca_gst(req: CAGSTRequest):
    """Run GST Reconciliation crew (C10)."""
    try:
        from ..agents.crews import run_ca_gst
        result = await run_ca_gst(client_name=req.client_name, gstin=req.gstin, period=req.period)
        return AgentResponse(crew="ca_gst", status="completed",
                            raw_output=result.get("raw_output"),
                            token_usage=result.get("token_usage"))
    except Exception as e:
        logger.error("CA GST crew failed: %s", e, exc_info=True)
        return AgentResponse(crew="ca_gst", status="failed", error=str(e))


@router.post("/ca/audit", response_model=AgentResponse)
async def ca_audit(req: CAAuditRequest):
    """Run Audit & Assurance crew (C11)."""
    try:
        from ..agents.crews import run_ca_audit
        result = await run_ca_audit(client_name=req.client_name, year=req.year, engagement_type=req.engagement_type)
        return AgentResponse(crew="ca_audit", status="completed",
                            raw_output=result.get("raw_output"),
                            token_usage=result.get("token_usage"))
    except Exception as e:
        logger.error("CA audit crew failed: %s", e, exc_info=True)
        return AgentResponse(crew="ca_audit", status="failed", error=str(e))


@router.post("/ca/income-tax", response_model=AgentResponse)
async def ca_income_tax(req: CAIncomeTaxRequest):
    """Run Income Tax & TDS crew (C12)."""
    try:
        from ..agents.crews import run_ca_income_tax
        result = await run_ca_income_tax(client_name=req.client_name, pan=req.pan, assessment_year=req.assessment_year)
        return AgentResponse(crew="ca_income_tax", status="completed",
                            raw_output=result.get("raw_output"),
                            token_usage=result.get("token_usage"))
    except Exception as e:
        logger.error("CA income tax crew failed: %s", e, exc_info=True)
        return AgentResponse(crew="ca_income_tax", status="failed", error=str(e))


@router.post("/ca/roc", response_model=AgentResponse)
async def ca_roc(req: CAROCRequest):
    """Run ROC Compliance crew (C13)."""
    try:
        from ..agents.crews import run_ca_roc
        result = await run_ca_roc(client_name=req.client_name, cin=req.cin)
        return AgentResponse(crew="ca_roc", status="completed",
                            raw_output=result.get("raw_output"),
                            token_usage=result.get("token_usage"))
    except Exception as e:
        logger.error("CA ROC crew failed: %s", e, exc_info=True)
        return AgentResponse(crew="ca_roc", status="failed", error=str(e))
