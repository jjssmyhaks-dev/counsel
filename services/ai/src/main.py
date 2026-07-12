"""FastAPI application — Counsel AI Service.

Provides endpoints for document parsing, embedding, indexing,
semantic search (RAG), contract analysis, research synthesis,
draft generation, and meeting transcript processing.
"""
from __future__ import annotations

from contextlib import asynccontextmanager

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


# ── Lifespan ────────────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: initialise DB pool and ensure tables exist.

    Shutdown: close the pool cleanly.
    """
    await get_pool()
    try:
        await ensure_tables()
    except Exception:
        pass  # table-creation is best-effort at startup
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


# ── Document parsing ────────────────────────────────────────────


@app.post("/parse", response_model=DocumentParseResponse)
async def parse_doc(req: DocumentParseRequest) -> DocumentParseResponse:
    """Parse a document into structured semantic chunks.

    Pipeline: raw bytes → parser (pages) → semantic chunker → Chunk models.
    """
    if req.content is None:
        raise HTTPException(status_code=400, detail="content is required")

    # Phase 1: parse into (page_number, text) tuples
    pages = parser_registry.parse(req.mime_type, req.content)

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
    return EmbeddingResponse(embeddings=embedder.embed(req.texts))


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
    query_embedding = embedder.embed_query(req.query)
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

    pages = parser_registry.parse(req.mime_type, req.content)
    chunk_dicts = semantic_chunker.chunk_document(
        pages=pages,
        document_id=req.document_id,
    )
    texts = [c["text"] for c in chunk_dicts]
    embeddings = embedder.embed(texts) if texts else []

    return {
        "document_id": req.document_id,
        "chunks": len(chunk_dicts),
        "embeddings": len(embeddings),
        "status": "processed",
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
