import sys, os
_src_dir = os.path.dirname(os.path.abspath(__file__))
if _src_dir not in sys.path:
    sys.path.insert(0, _src_dir)

from config import config as settings
from models.schemas import (
    ActionItem, Citation, Chunk, ClauseFinding,
    ContractAnalysisRequest, ContractAnalysisResponse,
    DocumentParseRequest, DocumentParseResponse,
    DraftRequest, DraftResponse,
    EmbeddingRequest, EmbeddingResponse,
    Finding, HealthResponse, IndexRequest, IndexResponse,
    MeetingProcessRequest, MeetingProcessResponse,
    SearchRequest, SearchResponse, SearchResult,
)
from parsers.parser_registry import parser_registry
from chunking.semantic_chunker import semantic_chunker
from embeddings.embedder import embedder
from rag.retriever import retriever
from analysis.contract_analyzer import contract_analyzer
from synthesis.research_synthesizer import research_synthesizer
from drafting.draft_generator import draft_generator
from meetings.meeting_processor import meeting_processor
from db.client import close_pool, ensure_tables, get_pool
from orchestrator.router import RouterAgent
from orchestrator.quality_gate import QualityGateAgent, GateResult
from orchestrator.pipeline_orchestrator import PipelineOrchestrator, PipelineJob
from orchestrator.audit_agent import audit_trail, AuditAction
