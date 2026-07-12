from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ── Document types ──────────────────────────────────────────────

class Chunk(BaseModel):
    index: int
    text: str
    section_title: Optional[str] = None
    page_number: Optional[int] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class DocumentParseRequest(BaseModel):
    document_id: str
    r2_key: Optional[str] = None
    mime_type: str
    content: Optional[bytes] = None  # raw bytes for MVP direct upload


class DocumentParseResponse(BaseModel):
    document_id: str
    chunks: List[Chunk]
    total_pages: int = 0


class EmbeddingRequest(BaseModel):
    texts: List[str]


class EmbeddingResponse(BaseModel):
    embeddings: List[List[float]]


class IndexRequest(BaseModel):
    document_id: str
    firm_id: str
    matter_id: Optional[str] = None
    chunks: List[Chunk]
    embeddings: List[List[float]]


class IndexResponse(BaseModel):
    document_id: str
    indexed_count: int
    status: str = "indexed"


class SearchRequest(BaseModel):
    query: str
    firm_id: str
    matter_id: Optional[str] = None
    top_k: int = Field(default=5, ge=1, le=50)


class SearchResult(BaseModel):
    chunk_id: str
    document_id: str
    text: str
    section_title: Optional[str] = None
    page_number: Optional[int] = None
    similarity: float


class SearchResponse(BaseModel):
    results: List[SearchResult]
    query: str
    total: int


# ── Contract analysis (M1) ──────────────────────────────────────

class ClauseFinding(BaseModel):
    clause_type: str
    text_excerpt: str
    page_ref: Optional[int] = None
    risk_level: str  # low | medium | high
    rationale: str
    suggested_edit: Optional[str] = None


class ContractAnalysisRequest(BaseModel):
    document_id: str
    chunks: List[Chunk]
    playbook_id: Optional[str] = None


class ContractAnalysisResponse(BaseModel):
    document_id: str
    clauses: List[ClauseFinding]
    summary: str = ""


class PlaybookConfig(BaseModel):
    id: str
    name: str
    rules: List[PlaybookRule]


class PlaybookRule(BaseModel):
    clause_type: str
    name: str
    description: str
    risk_criteria: str
    severity: str  # low | medium | high


# ── Research synthesis (M2) ─────────────────────────────────────

class Finding(BaseModel):
    statement: str
    citations: List[Citation] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0)


class Citation(BaseModel):
    document_id: str
    chunk_id: str
    section_title: Optional[str] = None
    excerpt: str


class ResearchSynthesisRequest(BaseModel):
    matter_id: str
    query: str
    source_document_ids: List[str]


class ResearchSynthesisResponse(BaseModel):
    brief_id: str
    title: str
    findings: List[Finding]
    open_questions: List[str]


# ── Draft generation (M3) ───────────────────────────────────────

class DraftRequest(BaseModel):
    type: str  # email | memo | report
    matter_id: Optional[str] = None
    instructions: str
    tone_examples: Optional[List[str]] = None


class DraftResponse(BaseModel):
    draft_id: str
    content: str
    model_used: str
    draft_type: str


# ── Meeting processing (M4) ─────────────────────────────────────

class ActionItem(BaseModel):
    text: str
    owner_hint: Optional[str] = None
    due_date_hint: Optional[str] = None


class MeetingProcessRequest(BaseModel):
    meeting_id: str
    transcript: str


class MeetingProcessResponse(BaseModel):
    meeting_id: str
    decisions: List[str]
    action_items: List[ActionItem]
    open_questions: List[str]


# ── Health ──────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str = "ok"
    embedding_model: str
    embedding_dim: int
    llm_provider: str


class ErrorResponse(BaseModel):
    error: str
    detail: str
