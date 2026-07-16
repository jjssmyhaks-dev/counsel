"""pgvector similarity search retriever.

Matches the actual document_chunks schema (no matter_id column).
Uses 384-dim vectors from SentenceTransformer fallback.
"""
from __future__ import annotations

import logging
from typing import Dict, List, Optional

from ..config import settings
from ..db.client import get_pool

logger = logging.getLogger(__name__)


class Retriever:
    """Retrieve relevant document chunks via pgvector cosine similarity."""

    def __init__(self):
        self.similarity_threshold = settings.similarity_threshold

    async def index_chunks(
        self,
        document_id: str,
        firm_id: str,
        chunks: list[dict],
        embeddings: list[list[float]],
        matter_id: Optional[str] = None,
    ) -> int:
        """Insert chunks and their embeddings into pgvector."""
        pool = await get_pool()
        count = 0

        async with pool.acquire() as conn:
            async with conn.transaction():
                for chunk, embedding in zip(chunks, embeddings):
                    chunk_id = chunk.get("chunk_id") or f"{document_id}_c{chunk.get('index', count)}"
                    vector_str = "[" + ",".join(str(v) for v in embedding) + "]"

                    import json
                    metadata = json.dumps(chunk.get("metadata", {}))

                    await conn.execute(
                        """
                        INSERT INTO document_chunks (id, document_id, firm_id,
                            chunk_index, text, section_title, page_number, embedding, metadata)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector, $9::jsonb)
                        ON CONFLICT (id) DO UPDATE SET
                            text = EXCLUDED.text,
                            embedding = EXCLUDED.embedding,
                            updated_at = NOW()
                        """,
                        chunk_id,
                        document_id,
                        firm_id,
                        chunk.get("index", count),
                        chunk.get("text", ""),
                        chunk.get("section_title"),
                        chunk.get("page_number"),
                        vector_str,
                        metadata,
                    )
                    count += 1

        logger.info("Indexed %d chunks for document %s", count, document_id)
        return count

    async def search(
        self,
        query_embedding: List[float],
        firm_id: str,
        matter_id: Optional[str] = None,
        top_k: int = 5,
        threshold: Optional[float] = None,
    ) -> List[Dict]:
        """Perform pgvector cosine similarity search."""
        threshold = threshold or self.similarity_threshold
        vector_str = "[" + ",".join(str(v) for v in query_embedding) + "]"

        sql = """
            SELECT dc.id, dc.document_id, dc.chunk_index, dc.text,
                   dc.section_title, dc.page_number,
                   1 - (dc.embedding <=> $1::vector) AS similarity
            FROM document_chunks dc
            WHERE dc.firm_id = $2
              AND dc.embedding IS NOT NULL
              AND 1 - (dc.embedding <=> $1::vector) > $3
            ORDER BY dc.embedding <=> $1
            LIMIT $4
        """

        pool = await get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(sql, vector_str, firm_id, threshold, top_k)

        results = []
        for row in rows:
            results.append({
                "chunk_id": row["id"],
                "document_id": row["document_id"],
                "text": row["text"],
                "section_title": row["section_title"],
                "page_number": row["page_number"],
                "similarity": round(row["similarity"], 4),
            })

        return results

    async def search_by_document_ids(
        self,
        query_embedding: List[float],
        firm_id: str,
        document_ids: List[str],
        top_k: int = 5,
        threshold: Optional[float] = None,
    ) -> List[Dict]:
        """Similarity search scoped to specific document IDs."""
        threshold = threshold or self.similarity_threshold
        vector_str = "[" + ",".join(str(v) for v in query_embedding) + "]"

        doc_placeholders = ",".join(f"${i + 3}" for i in range(len(document_ids)))
        params: list = [vector_str, firm_id, *document_ids, threshold, top_k]

        sql = f"""
            SELECT dc.id, dc.document_id, dc.chunk_index, dc.text,
                   dc.section_title, dc.page_number,
                   1 - (dc.embedding <=> $1::vector) AS similarity
            FROM document_chunks dc
            WHERE dc.firm_id = $2
              AND dc.document_id IN ({doc_placeholders})
              AND dc.embedding IS NOT NULL
              AND 1 - (dc.embedding <=> $1::vector) > ${len(params) - 1}
            ORDER BY dc.embedding <=> $1
            LIMIT ${len(params)}
        """

        pool = await get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(sql, *params)

        results = []
        for row in rows:
            results.append({
                "chunk_id": row["id"],
                "document_id": row["document_id"],
                "text": row["text"],
                "section_title": row["section_title"],
                "page_number": row["page_number"],
                "similarity": round(row["similarity"], 4),
            })

        return results


retriever = Retriever()
