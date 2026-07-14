"""FastAPI application — Counsel AI Service.

Provides endpoints for document parsing, embedding, indexing,
semantic search (RAG), contract analysis, research synthesis,
draft generation, and meeting transcript processing.
"""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

from pydantic import BaseModel
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .models.schemas import (
    ActionItem,
    Citation,
    Chunk,
    ClauseFinding,
    ContractAnalysisRequest,
    ContractAnalysisResponse,
    DocumentParseRequest,
    DocumentParseResponse,
    DraftRequest,
    DraftResponse,
    EmbeddingRequest,
    EmbeddingResponse,
    Finding,
    HealthResponse,
    IndexRequest,
    IndexResponse,
    MeetingProcessRequest,
    MeetingProcessResponse,
    ResearchSynthesisRequest,
    ResearchSynthesisResponse,
    SearchRequest,
    SearchResponse,
    SearchResult,
)
from .parsers.parser_registry import parser_registry
from .chunking.semantic_chunker import semantic_chunker
from .embeddings.embedder import embedder
from .rag.retriever import retriever
from .analysis.contract_analyzer import contract_analyzer
from .synthesis.research_synthesizer import research_synthesizer
from .drafting.draft_generator import draft_generator
from .meetings.meeting_processor import meeting_processor
from .db.client import close_pool, ensure_tables, get_pool
from .orchestrator.router import RouterAgent
from .orchestrator.quality_gate import QualityGateAgent, GateResult
from .orchestrator.pipeline_orchestrator import PipelineOrchestrator, PipelineJob
from .orchestrator.audit_agent import audit_trail, AuditAction


# ── Lifespan ────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: initialise DB pool, Cloudflare AI, ensure tables exist.

    Shutdown: close the pool cleanly.
    """
    await get_pool()
    try:
        await ensure_tables()
    except Exception:
        pass  # table-creation is best-effort at startup

    # Initialise Cloudflare Workers AI if credentials are configured
    if settings.cloudflare_account_id and settings.cloudflare_api_token:
        from .providers.cloudflare import init_cloudflare
        try:
            cf = init_cloudflare(
                account_id=settings.cloudflare_account_id,
                api_token=settings.cloudflare_api_token,
            )
            health = await cf.check_health()
            print(f"Cloudflare Workers AI initialised: {health}")
        except Exception as e:
            print(f"Cloudflare Workers AI init failed: {e}")

    yield
    await close_pool()


# ── App ─────────────────────────────────────────────────────────

app = FastAPI(
    title="Counsel AI Service",
    version="0.1.0",
    description="AI document processing, RAG, and analysis for legal/consulting firms",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health ──────────────────────────────────────────────────────


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        embedding_model=settings.embedding_model,
        embedding_dim=settings.embedding_dim,
        llm_provider=settings.llm_provider,
    )


@app.get("/health/cloudflare")
async def health_cloudflare():
    """Check Cloudflare Workers AI connectivity."""
    try:
        from .providers.cloudflare import cloudflare_ai
        if cloudflare_ai:
            return await cloudflare_ai.check_health()
        return {"status": "not_configured", "error": "Cloudflare AI not initialized"}
    except Exception as e:
        return {"status": "error", "error": str(e)}


# ── Document parsing ────────────────────────────────────────────


def _decode_content(content_str: str) -> bytes:
    """Decode a base64-encoded content string into raw bytes.

    Handles standard base64, URL-safe base64, and padding variations.
    """
    import base64

    # Normalise URL-safe and padding variations
    # Some clients send URL-safe base64 (using - and _). Convert to standard.
    content_str = content_str.replace('-', '+').replace('_', '/')
    # Add padding if missing (base64 length must be multiple of 4)
    missing_padding = len(content_str) % 4
    if missing_padding:
        content_str += '=' * (4 - missing_padding)

    try:
        return base64.b64decode(content_str, validate=True)
    except Exception:
        # Fallback: try without padding, or with lenient decoding
        try:
            return base64.b64decode(content_str)
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid base64 content: {e}",
            )


@app.post("/parse", response_model=DocumentParseResponse)
async def parse_doc(req: DocumentParseRequest) -> DocumentParseResponse:
    """Parse a document into structured semantic chunks.

    Pipeline: base64 → raw bytes → parser (pages) → semantic chunker → Chunk models.
    """
    if req.content is None:
        raise HTTPException(status_code=400, detail="content is required")

    # Check if mime_type is supported before decoding
    if not parser_registry.supports(req.mime_type):
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported MIME type: {req.mime_type}. Supported types: application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, text/plain",
        )

    # Decode base64 content into raw bytes
    raw_bytes = _decode_content(req.content)

    # Phase 1: parse into (page_number, text) tuples
    try:
        pages = parser_registry.parse(req.mime_type, raw_bytes)
    except ImportError as e:
        raise HTTPException(
            status_code=501,
            detail=f"Parser dependency missing for {req.mime_type}: {e}",
        )
    except ValueError as e:
        raise HTTPException(
            status_code=422,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse document: {e}",
        )

    # Phase 2: semantic chunking
    chunk_dicts = semantic_chunker.chunk_document(
        pages=pages,
        document_id=req.document_id,
    )

    chunks = [
        Chunk(
            index=c["index"],
            text=c["text"],
            section_title=c.get("section_title"),
            page_number=c.get("page_number"),
            metadata=c.get("metadata", {}),
        )
        for c in chunk_dicts
    ]

    return DocumentParseResponse(
        document_id=req.document_id,
        chunks=chunks,
        total_pages=len(pages),
    )


# ── Embedding ───────────────────────────────────────────────────


@app.post("/embed", response_model=EmbeddingResponse)
async def embed_texts(req: EmbeddingRequest) -> EmbeddingResponse:
    """Generate embeddings for a list of text chunks."""
    if not req.texts:
        return EmbeddingResponse(embeddings=[])
    embeddings = await embedder.embed(req.texts)
    return EmbeddingResponse(embeddings=embeddings)


# ── Indexing ────────────────────────────────────────────────────


@app.post("/index", response_model=IndexResponse)
async def index_document(req: IndexRequest) -> IndexResponse:
    """Index document chunks and their embeddings into pgvector."""
    chunk_dicts = [_chunk_to_dict(c) for c in req.chunks]
    count = await retriever.index_chunks(
        document_id=req.document_id,
        firm_id=req.firm_id,
        chunks=chunk_dicts,
        embeddings=req.embeddings,
        matter_id=req.matter_id,
    )
    return IndexResponse(document_id=req.document_id, indexed_count=count)


# ── Search ──────────────────────────────────────────────────────


@app.post("/search", response_model=SearchResponse)
async def search(req: SearchRequest) -> SearchResponse:
    """Semantic search: embed the query, then run pgvector cosine similarity."""
    query_embedding = await embedder.embed_query(req.query)
    raw_results = await retriever.search(
        query_embedding=query_embedding,
        firm_id=req.firm_id,
        matter_id=req.matter_id,
        top_k=req.top_k,
    )

    results = [
        SearchResult(
            chunk_id=r["chunk_id"],
            document_id=r["document_id"],
            text=r["text"],
            section_title=r.get("section_title"),
            page_number=r.get("page_number"),
            similarity=r["similarity"],
        )
        for r in raw_results
    ]

    return SearchResponse(results=results, query=req.query, total=len(results))


# ── Contract analysis (M1) ──────────────────────────────────────


@app.post("/analyze/contract", response_model=ContractAnalysisResponse)
async def analyze_contract(req: ContractAnalysisRequest) -> ContractAnalysisResponse:
    """Run two-pass contract analysis: clause extraction + playbook evaluation."""
    result = await contract_analyzer.analyze(
        document_id=req.document_id,
        chunks=req.chunks,
        playbook_id=req.playbook_id,
    )
    # contract_analyzer returns Dict with keys: document_id, clauses (list of dict), summary
    clauses = [ClauseFinding(**c) for c in result.get("clauses", [])]
    return ContractAnalysisResponse(
        document_id=result["document_id"],
        clauses=clauses,
        summary=result.get("summary", ""),
    )


# ── Research synthesis (M2) ─────────────────────────────────────


@app.post("/synthesize/research", response_model=ResearchSynthesisResponse)
async def synthesize_research(req: ResearchSynthesisRequest) -> ResearchSynthesisResponse:
    """Run map-reduce research synthesis across source documents."""
    result = await research_synthesizer.synthesize(
        matter_id=req.matter_id,
        query=req.query,
        source_document_ids=req.source_document_ids,
    )

    findings = [
        Finding(
            statement=f["statement"],
            citations=[Citation(**c) for c in f.get("citations", [])],
            confidence=f.get("confidence", 0.0),
        )
        for f in result.get("findings", [])
    ]

    return ResearchSynthesisResponse(
        brief_id=result["brief_id"],
        title=result["title"],
        findings=findings,
        open_questions=result.get("open_questions", []),
    )


# ── Draft generation (M3) ───────────────────────────────────────


@app.post("/draft", response_model=DraftResponse)
async def generate_draft(req: DraftRequest) -> DraftResponse:
    """Generate a professional draft: email, memo, or report."""
    result = await draft_generator.generate(
        draft_type=req.type,
        instructions=req.instructions,
        matter_id=req.matter_id,
        tone_examples=req.tone_examples,
    )
    return DraftResponse(
        draft_id=result["draft_id"],
        content=result["content"],
        model_used=result["model_used"],
        draft_type=result["draft_type"],
    )


# ── Meeting processing (M4) ─────────────────────────────────────


@app.post("/process/meeting", response_model=MeetingProcessResponse)
async def process_meeting(req: MeetingProcessRequest) -> MeetingProcessResponse:
    """Process a meeting transcript: extract decisions, action items, and open questions."""
    result = await meeting_processor.process(
        meeting_id=req.meeting_id,
        transcript=req.transcript,
    )

    action_items = [
        ActionItem(
            text=ai["text"],
            owner_hint=ai.get("owner_hint"),
            due_date_hint=ai.get("due_date_hint"),
        )
        for ai in result.get("action_items", [])
    ]

    return MeetingProcessResponse(
        meeting_id=result["meeting_id"],
        decisions=result.get("decisions", []),
        action_items=action_items,
        open_questions=result.get("open_questions", []),
    )


# ── Full pipeline (convenience) ──────────────────────────────────


@app.post("/process/document")
async def full_pipeline(req: DocumentParseRequest):
    """Full pipeline: parse → chunk → embed.

    Returns chunk/embedding counts without indexing (firm_id not available).
    Use /index to persist after this step.
    """
    if req.content is None:
        raise HTTPException(status_code=400, detail="content is required")

    if not parser_registry.supports(req.mime_type):
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported MIME type: {req.mime_type}",
        )

    raw_bytes = _decode_content(req.content)

    try:
        pages = parser_registry.parse(req.mime_type, raw_bytes)
    except ImportError as e:
        raise HTTPException(
            status_code=501,
            detail=f"Parser dependency missing for {req.mime_type}: {e}",
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse document: {e}",
        )

    chunk_dicts = semantic_chunker.chunk_document(
        pages=pages,
        document_id=req.document_id,
    )
    texts = [c["text"] for c in chunk_dicts]
    embeddings = await embedder.embed(texts) if texts else []

    return {
        "document_id": req.document_id,
        "chunks": len(chunk_dicts),
        "embeddings": len(embeddings),
        "status": "processed",
    }


# ── Orchestrator schemas ────────────────────────────────────────


class RouteRequest(BaseModel):
    prompt: str
    context: Optional[Dict[str, Any]] = None


class RouteResponse(BaseModel):
    intent: str
    confidence: float
    reasoning: str
    required_agents: List[str]
    parameters: Dict[str, Any]


class ValidateRequest(BaseModel):
    output: str
    context: Optional[Dict[str, Any]] = None


class ValidateResponse(BaseModel):
    passed: bool
    blocked: bool
    warnings: List[str]
    checks: List[Dict[str, Any]]


class PipelineStartRequest(BaseModel):
    job_type: str
    context: Dict[str, Any]


class PipelineStatusResponse(BaseModel):
    id: str
    type: str
    status: str
    progress: float
    steps: List[Dict[str, Any]]


class AuditQueryRequest(BaseModel):
    user_id: Optional[str] = None
    firm_id: Optional[str] = None
    action: Optional[str] = None
    limit: int = 100
    offset: int = 0


# ── Agent initializations ───────────────────────────────────────

router_agent = RouterAgent()
quality_gate = QualityGateAgent(confidence_threshold=0.7)
pipeline_orchestrator = PipelineOrchestrator()


# ── Orchestrator / Router ───────────────────────────────────────


@app.post("/orchestrator/route", response_model=RouteResponse)
async def route_request(req: RouteRequest) -> RouteResponse:
    """Route a user prompt to determine intent and required agents."""
    decision = router_agent.route(req.prompt, req.context)
    return RouteResponse(
        intent=decision.intent.value,
        confidence=decision.confidence,
        reasoning=decision.reasoning,
        required_agents=decision.required_agents,
        parameters=decision.parameters,
    )


@app.post("/orchestrator/validate", response_model=ValidateResponse)
async def validate_output(req: ValidateRequest) -> ValidateResponse:
    """Run quality gate checks on an AI output."""
    result = quality_gate.validate(req.output, req.context or {})
    return ValidateResponse(
        passed=result.passed,
        blocked=result.blocked,
        warnings=result.warnings,
        checks=[{"check": c["check"], "passed": c["passed"]} for c in result.checks],
    )


@app.post("/orchestrator/pipeline/start", response_model=PipelineStatusResponse)
async def start_pipeline(req: PipelineStartRequest) -> PipelineStatusResponse:
    """Start a new pipeline job (ingestion, analysis, synthesis, etc.)."""
    job = pipeline_orchestrator.create_job(req.job_type, req.context)
    audit_trail.log(
        action=AuditAction.CONTRACT_ANALYSIS_STARTED,
        resource_id=req.context.get("document_id"),
        firm_id=req.context.get("firm_id"),
        metadata={"job_id": job.id, "job_type": req.job_type},
    )
    # Run in background — in production this uses a task queue
    asyncio.create_task(pipeline_orchestrator.run_job(job))
    return PipelineStatusResponse(
        id=job.id,
        type=job.type,
        status=job.status.value,
        progress=job.progress,
        steps=[{"name": s.name, "agent": s.agent, "status": s.status.value} for s in job.steps],
    )


@app.get("/orchestrator/pipeline/{job_id}", response_model=PipelineStatusResponse)
async def get_pipeline_status(job_id: str):
    """Get the current status of a pipeline job."""
    status = pipeline_orchestrator.get_job_status(job_id)
    if not status:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return status


@app.post("/orchestrator/pipeline/{job_id}/cancel")
async def cancel_pipeline(job_id: str):
    """Cancel a running pipeline job."""
    if pipeline_orchestrator.cancel_job(job_id):
        return {"status": "cancelled", "job_id": job_id}
    raise HTTPException(status_code=404, detail=f"Job {job_id} not found or already completed")


@app.post("/orchestrator/audit/query")
async def query_audit_log(req: AuditQueryRequest):
    """Query the audit trail."""
    entries = audit_trail.query(
        user_id=req.user_id,
        firm_id=req.firm_id,
        action=AuditAction(req.action) if req.action else None,
        limit=req.limit,
        offset=req.offset,
    )
    return {
        "entries": audit_trail.to_dict_list(entries),
        "total": len(entries),
        "stats": audit_trail.get_stats(firm_id=req.firm_id),
    }


# ── Helpers ─────────────────────────────────────────────────────


def _chunk_to_dict(chunk: Chunk) -> dict:
    """Convert a Pydantic Chunk model to the plain dict expected by retriever."""
    return {
        "index": chunk.index,
        "text": chunk.text,
        "section_title": chunk.section_title,
        "page_number": chunk.page_number,
        "metadata": chunk.metadata,
    }
