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


class AgentResponse(BaseModel):
    crew: str
    status: str
    raw_output: Optional[str] = None
    token_usage: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


# ── Helper: Run crew in thread pool ────────────────────────────


async def _run_in_executor(func, *args, **kwargs):
    """Run a CPU/IO-bound crew function in a thread pool."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, lambda: func(*args, **kwargs))


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

        result = await _run_in_executor(
            run_document_intelligence,
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
        result = await _run_in_executor(
            run_drafting_crew,
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
        raw_results = await retriever.search(
            query_embedding=query_embedding,
            firm_id=req.firm_id,
            matter_id=req.matter_id,
            top_k=req.top_k,
        )

        source_chunks = [r["text"] for r in raw_results]

        if not source_chunks:
            raise HTTPException(
                status_code=404,
                detail="No relevant documents found. Index documents first.",
            )

        # Step 2: Run the research crew
        result = await _run_in_executor(
            run_research_crew,
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
        result = await _run_in_executor(
            run_compliance_crew,
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

        from .crews import run_full_contract_pipeline

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
        "crews": 4,
        "agents": 10,
        "models": {
            "default": settings.cloudflare_text_model,
            "embedding": settings.embedding_model,
            "embedding_dim": settings.embedding_dim,
        },
        "cloudflare": cf_health,
    }
