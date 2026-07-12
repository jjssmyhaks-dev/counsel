"""Full RAG pipeline orchestration.

Handles the end-to-end flow:
  parse → chunk → embed → index → search → generate
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from uuid import uuid4

from ..chunking.semantic_chunker import semantic_chunker
from ..db.client import get_pool
from ..embeddings.embedder import embedder
from ..models.schemas import (
    Chunk,
    DocumentParseResponse,
    IndexResponse,
    SearchResult,
    SearchResponse,
)
from ..parsers.parser_registry import parser_registry
from .generator import generator
from .retriever import retriever

logger = logging.getLogger(__name__)


class RAGPipeline:
    """Orchestrates the full RAG pipeline for a document."""

    async def process_document(
        self,
        document_id: str,
        mime_type: str,
        content: bytes,
        firm_id: str,
        matter_id: Optional[str] = None,
    ) -> dict:
        """Full pipeline: parse → chunk → embed → index."""
        # 1. Parse
        pages = parser_registry.parse(mime_type, content)
        headings = parser_registry.detect_headings(mime_type, content)

        # 2. Chunk
        raw_chunks = semantic_chunker.chunk_document(
            pages=pages,
            headings=[(h_text, h_idx) for h_text, h_idx in headings] if headings else None,
            document_id=document_id,
        )
        if not raw_chunks:
            raise ValueError(f"No chunks produced for document {document_id}")

        # 3. Embed
        texts = [c["text"] for c in raw_chunks]
        embeddings = embedder.embed_batch(texts)

        # 4. Index
        indexed_count = await retriever.index_chunks(
            document_id=document_id,
            firm_id=firm_id,
            chunks=raw_chunks,
            embeddings=embeddings,
            matter_id=matter_id,
        )

        # Convert raw_chunks to Chunk model objects for the response
        chunks_model = [
            Chunk(
                index=c["index"],
                text=c["text"],
                section_title=c.get("section_title"),
                page_number=c.get("page_number"),
                metadata=c.get("metadata", {}),
            )
            for c in raw_chunks
        ]

        total_pages = len(pages) if pages else 0

        return {
            "document_id": document_id,
            "chunks": chunks_model,
            "total_pages": total_pages,
            "indexed_count": indexed_count,
        }

    async def search(
        self,
        query: str,
        firm_id: str,
        matter_id: Optional[str] = None,
        top_k: int = 5,
    ) -> SearchResponse:
        """Perform a RAG search query."""
        query_embedding = embedder.embed_query(query)

        results = await retriever.search(
            query_embedding=query_embedding,
            firm_id=firm_id,
            matter_id=matter_id,
            top_k=top_k,
        )

        search_results = [
            SearchResult(
                chunk_id=r["chunk_id"],
                document_id=r["document_id"],
                text=r["text"],
                section_title=r.get("section_title"),
                page_number=r.get("page_number"),
                similarity=r["similarity"],
            )
            for r in results
        ]

        return SearchResponse(results=search_results, query=query, total=len(search_results))


pipeline = RAGPipeline()
