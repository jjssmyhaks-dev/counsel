"""FastAPI routes for the Knowledge Base system.

Endpoints:
  POST /knowledge/extract     — Extract knowledge from a document
  POST /knowledge/search      — Semantic search across knowledge entries
  POST /knowledge/query       — RAG-augmented query using knowledge + documents
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/knowledge", tags=["Knowledge Base"])


# ── Request/Response Models ────────────────────────────────────


class ExtractRequest(BaseModel):
    document_id: str = Field(..., description="Document ID to extract from")
    knowledge_base_id: str = Field(..., description="Target knowledge base ID")
    firm_id: str = Field(..., description="Firm ID for tenant scoping")
    user_id: str = Field(..., description="User who initiated extraction")
    entry_types: Optional[List[str]] = Field(
        None,
        description="Filter entry types: FACT, RULE, PRECEDENT, REGULATION, TEMPLATE, CLAUSE, GUIDELINE",
    )


class ExtractResponse(BaseModel):
    entries_found: int = 0
    entries_created: int = 0
    entries: List[Dict[str, Any]] = []
    error: Optional[str] = None


class SearchRequest(BaseModel):
    query: str = Field(..., description="Search query")
    firm_id: str = Field(..., description="Firm ID")
    knowledge_base_id: Optional[str] = Field(None, description="Scope to specific KB")
    entry_type: Optional[str] = Field(None, description="Filter by entry type")
    category: Optional[str] = Field(None, description="Filter by category")
    top_k: int = Field(10, ge=1, le=50)
    threshold: float = Field(0.3, ge=0.0, le=1.0)


class SearchResultItem(BaseModel):
    id: str
    title: str
    content: str
    summary: str
    entry_type: str
    category: str
    tags: List[str] = []
    confidence: float
    usage_count: int
    kb_name: str
    similarity: Optional[float] = None


class SearchResponse(BaseModel):
    results: List[SearchResultItem]
    query: str
    total: int


class KBQueryRequest(BaseModel):
    query: str = Field(..., description="Natural language query")
    firm_id: str = Field(..., description="Firm ID")
    knowledge_base_id: Optional[str] = Field(None, description="Scope to specific KB")
    top_k: int = Field(5, ge=1, le=20)


class KBQueryResponse(BaseModel):
    answer: str
    sources: List[Dict[str, Any]]
    confidence: float
    query: str


# ── Routes ─────────────────────────────────────────────────────


@router.post("/extract", response_model=ExtractResponse)
async def extract_knowledge(req: ExtractRequest):
    """Extract structured knowledge entries from a document.

    Uses LLM to identify facts, rules, precedents, regulations, templates,
    clauses, and guidelines. Entries are embedded and stored in the knowledge base.
    """
    try:
        from ..knowledge.ingestion import knowledge_ingester

        result = await knowledge_ingester.extract_and_store(
            document_id=req.document_id,
            firm_id=req.firm_id,
            knowledge_base_id=req.knowledge_base_id,
            user_id=req.user_id,
            entry_types=req.entry_types,
        )

        return ExtractResponse(
            entries_found=result.get("entries_found", 0),
            entries_created=result.get("entries_created", 0),
            entries=result.get("entries", []),
            error=result.get("error"),
        )
    except Exception as e:
        logger.error("Knowledge extraction failed: %s", e, exc_info=True)
        return ExtractResponse(entries_found=0, entries_created=0, error=str(e))


@router.post("/search", response_model=SearchResponse)
async def search_knowledge(req: SearchRequest):
    """Semantic search across knowledge entries.

    Uses pgvector cosine similarity to find the most relevant knowledge entries.
    Falls back to keyword search when embeddings are unavailable.
    """
    try:
        from ..knowledge.base import knowledge_manager

        results = await knowledge_manager.search(
            firm_id=req.firm_id,
            query=req.query,
            knowledge_base_id=req.knowledge_base_id,
            entry_type=req.entry_type,
            category=req.category,
            top_k=req.top_k,
            threshold=req.threshold,
        )

        return SearchResponse(
            results=[SearchResultItem(**r) for r in results],
            query=req.query,
            total=len(results),
        )
    except Exception as e:
        logger.error("Knowledge search failed: %s", e, exc_info=True)
        # Fallback: return empty results
        return SearchResponse(results=[], query=req.query, total=0)


@router.post("/query", response_model=KBQueryResponse)
async def knowledge_query(req: KBQueryRequest):
    """RAG-augmented query: searches knowledge base + documents, generates answer.

    Combines knowledge entries with document chunks for comprehensive answers.
    """
    try:
        from ..knowledge.base import knowledge_manager
        from ..rag.retriever import retriever
        from ..rag.generator import generator
        from ..embeddings.embedder import embedder

        all_contexts: List[str] = []
        sources: List[Dict[str, Any]] = []

        # 1. Search knowledge base
        try:
            kb_results = await knowledge_manager.search(
                firm_id=req.firm_id,
                query=req.query,
                knowledge_base_id=req.knowledge_base_id,
                top_k=req.top_k,
            )
            for r in kb_results:
                all_contexts.append(f"[KB: {r.get('title', 'Unknown')}]\n{r.get('content', '')}")
                sources.append({
                    "type": "knowledge_entry",
                    "id": r.get("id"),
                    "title": r.get("title"),
                    "excerpt": r.get("content", "")[:300],
                    "relevance": r.get("similarity", 0),
                })
        except Exception as kb_err:
            logger.warning("KB search failed: %s", kb_err)

        # 2. Search document chunks
        try:
            query_embedding = await embedder.embed_query(req.query)
            doc_results = await retriever.search(
                query_embedding=query_embedding,
                firm_id=req.firm_id,
                top_k=req.top_k,
            )
            for r in doc_results:
                all_contexts.append(f"[DOC: {r.get('section_title', 'Unknown')}]\n{r.get('text', '')}")
                sources.append({
                    "type": "document_chunk",
                    "id": r.get("chunk_id"),
                    "title": r.get("section_title", "Document section"),
                    "excerpt": r.get("text", "")[:300],
                    "relevance": r.get("similarity", 0),
                })
        except Exception as doc_err:
            logger.warning("Document search failed: %s", doc_err)

        # 3. Generate answer
        if all_contexts:
            answer = await generator.generate_with_context(
                prompt=req.query,
                context_chunks=all_contexts[:10],
                system_prompt=(
                    "You are Counsel AI, an expert legal/consulting/CA assistant. "
                    "Answer the user's question using ONLY the provided sources. "
                    "Cite your sources by title. If the sources don't contain enough "
                    "information, say so clearly. Be precise, professional, and actionable."
                ),
            )
            confidence = min(1.0, len(all_contexts) * 0.15 + 0.3)
        else:
            answer = "No relevant information found in the knowledge base or documents. Try rephrasing your question."
            confidence = 0.0

        return KBQueryResponse(
            answer=answer,
            sources=sources[:10],
            confidence=round(confidence, 2),
            query=req.query,
        )
    except Exception as e:
        logger.error("Knowledge query failed: %s", e, exc_info=True)
        return KBQueryResponse(
            answer="An error occurred while processing your query. Please try again.",
            sources=[],
            confidence=0.0,
            query=req.query,
        )
