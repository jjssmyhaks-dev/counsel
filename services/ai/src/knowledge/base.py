"""Knowledge Base Manager — CRUD, embedding, and search for structured knowledge.

Knowledge entries follow an open knowledge format with:
- Typed entries (FACT, RULE, PRECEDENT, REGULATION, TEMPLATE, CLAUSE, GUIDELINE)
- Schema.org-inspired metadata (type, context, name, description, datePublished, source)
- Semantic embeddings via Cloudflare bge-base-en-v1.5 (768-dim)
- Graph relations between entries (REFERENCES, SUPPORTS, CONTRADICTS, SUPERSEDES, RELATED_TO)
"""
from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

from ..config import settings
from ..db.client import get_pool
from ..embeddings.embedder import embedder

logger = logging.getLogger(__name__)

# ─── Open Knowledge Format schema ────────────────────────────────
# Inspired by schema.org, JSON-LD, and structured data best practices.
# Each entry carries structured metadata in a standard format.

ENTRY_TYPES = {
    "FACT": "A verifiable factual statement",
    "RULE": "A business or compliance rule",
    "PRECEDENT": "A legal or consulting precedent",
    "REGULATION": "A regulatory requirement (GDPR, CCPA, GST, etc.)",
    "TEMPLATE": "A document or clause template",
    "CLAUSE": "A standard contract clause",
    "GUIDELINE": "A best practice or guideline",
}

RELATION_TYPES = {
    "REFERENCES": "Entry A references Entry B",
    "SUPPORTS": "Entry A supports/validates Entry B",
    "CONTRADICTS": "Entry A contradicts Entry B",
    "SUPERSEDES": "Entry A supersedes/replaces Entry B",
    "RELATED_TO": "Entry A is related to Entry B",
}


class KnowledgeBaseManager:
    """Manages knowledge bases and entries with pgvector embeddings."""

    async def create_knowledge_base(
        self,
        firm_id: str,
        name: str,
        description: Optional[str] = None,
        kb_type: str = "GENERAL",
        created_by_id: str = "",
    ) -> Dict[str, Any]:
        """Create a new knowledge base."""
        pool = await get_pool()
        kb_id = str(uuid4())
        now = datetime.now(timezone.utc)

        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO knowledge_bases (id, firm_id, name, description, type, status, entry_count, created_by_id, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, 'ACTIVE', 0, $6, $7, $7)
                """,
                kb_id, firm_id, name, description or "", kb_type, created_by_id, now,
            )

        logger.info("Created knowledge base '%s' for firm %s", name, firm_id)
        return {"id": kb_id, "name": name, "type": kb_type, "status": "ACTIVE"}

    async def create_entry(
        self,
        firm_id: str,
        knowledge_base_id: str,
        title: str,
        content: str,
        entry_type: str = "FACT",
        category: Optional[str] = None,
        tags: Optional[List[str]] = None,
        summary: Optional[str] = None,
        source_document_id: Optional[str] = None,
        source_chunk_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        access_level: str = "FIRM",
        created_by_id: str = "",
    ) -> Dict[str, Any]:
        """Create a knowledge entry with embedding."""
        pool = await get_pool()
        entry_id = str(uuid4())
        now = datetime.now(timezone.utc)

        # Build the text to embed (title + content + summary for rich embedding)
        embed_text = f"{title}\n\n{summary or ''}\n\n{content}"[:8000]

        # Generate embedding
        try:
            embedding = await embedder.embed_query(embed_text)
        except Exception as e:
            logger.warning("Embedding failed for entry %s: %s", entry_id, e)
            # Store without embedding — search will fall back to keyword
            embedding = [0.0] * settings.embedding_dim

        vector_str = "[" + ",".join(str(v) for v in embedding) + "]"
        tags_json = json.dumps(tags or [])
        metadata_json = json.dumps(metadata or {})

        # Build schema.org-inspired metadata
        schema_meta = {
            "@context": "https://schema.org",
            "@type": self._schema_type(entry_type),
            "name": title,
            "description": summary or content[:200],
            "datePublished": now.isoformat(),
            "sourceOrganization": firm_id,
            "category": category or "",
            "keywords": ",".join(tags or []),
        }
        # Merge with provided metadata
        full_metadata = {**schema_meta, **(metadata or {})}

        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO knowledge_entries (
                    id, knowledge_base_id, firm_id, title, content, summary,
                    entry_type, category, tags, source_document_id, source_chunk_id,
                    confidence, embedding, metadata, is_active, access_level,
                    usage_count, created_by_id, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, 1.0, $12::vector, $13::jsonb, true, $14, 0, $15, $16, $16)
                """,
                entry_id, knowledge_base_id, firm_id, title, content,
                summary or "", entry_type, category or "", tags_json,
                source_document_id, source_chunk_id, vector_str,
                json.dumps(full_metadata), access_level, created_by_id, now,
            )

            # Update entry count on knowledge base
            await conn.execute(
                "UPDATE knowledge_bases SET entry_count = entry_count + 1, updated_at = $1 WHERE id = $2",
                now, knowledge_base_id,
            )

        logger.info("Created knowledge entry '%s' (type=%s) in KB %s", title, entry_type, knowledge_base_id)
        return {
            "id": entry_id,
            "title": title,
            "entry_type": entry_type,
            "category": category,
            "knowledge_base_id": knowledge_base_id,
        }

    async def search(
        self,
        firm_id: str,
        query: str,
        knowledge_base_id: Optional[str] = None,
        entry_type: Optional[str] = None,
        category: Optional[str] = None,
        top_k: int = 10,
        threshold: float = 0.3,
    ) -> List[Dict[str, Any]]:
        """Semantic search across knowledge entries."""
        pool = await get_pool()

        # Generate query embedding
        try:
            query_embedding = await embedder.embed_query(query)
        except Exception as e:
            logger.warning("Query embedding failed: %s", e)
            return await self._keyword_search(firm_id, query, knowledge_base_id, entry_type, top_k)

        vector_str = "[" + ",".join(str(v) for v in query_embedding) + "]"

        # Build dynamic WHERE clauses
        where_parts = ["ke.firm_id = $2", "ke.is_active = true", "ke.embedding IS NOT NULL"]
        params: list = [vector_str, firm_id]
        param_idx = 3

        if knowledge_base_id:
            where_parts.append(f"ke.knowledge_base_id = ${param_idx}")
            params.append(knowledge_base_id)
            param_idx += 1

        if entry_type:
            where_parts.append(f"ke.entry_type = ${param_idx}")
            params.append(entry_type)
            param_idx += 1

        if category:
            where_parts.append(f"ke.category = ${param_idx}")
            params.append(category)
            param_idx += 1

        where_sql = " AND ".join(where_parts)

        sql = f"""
            SELECT ke.id, ke.title, ke.content, ke.summary, ke.entry_type, ke.category,
                   ke.tags, ke.confidence, ke.usage_count, ke.metadata,
                   kb.name as kb_name,
                   1 - (ke.embedding <=> $1::vector) AS similarity
            FROM knowledge_entries ke
            JOIN knowledge_bases kb ON ke.knowledge_base_id = kb.id
            WHERE {where_sql}
              AND 1 - (ke.embedding <=> $1::vector) > ${param_idx}
            ORDER BY ke.embedding <=> $1
            LIMIT ${param_idx + 1}
        """
        params.extend([threshold, top_k])

        async with pool.acquire() as conn:
            rows = await conn.fetch(sql, *params)

        # Increment usage count for returned entries
        if rows:
            entry_ids = [row["id"] for row in rows]
            async with pool.acquire() as conn:
                await conn.execute(
                    f"UPDATE knowledge_entries SET usage_count = usage_count + 1, last_used_at = NOW() WHERE id IN ({','.join(f'${i+1}' for i in range(len(entry_ids)))})",
                    *entry_ids,
                )

        return [self._row_to_result(row) for row in rows]

    async def _keyword_search(
        self,
        firm_id: str,
        query: str,
        knowledge_base_id: Optional[str] = None,
        entry_type: Optional[str] = None,
        top_k: int = 10,
    ) -> List[Dict[str, Any]]:
        """Fallback keyword search when embeddings are unavailable."""
        pool = await get_pool()
        where_parts = ["ke.firm_id = $1", "ke.is_active = true"]
        params: list = [firm_id]
        param_idx = 2

        # Full-text search
        where_parts.append(f"(ke.title ILIKE ${param_idx} OR ke.content ILIKE ${param_idx} OR ke.summary ILIKE ${param_idx})")
        params.append(f"%{query}%")
        param_idx += 1

        if knowledge_base_id:
            where_parts.append(f"ke.knowledge_base_id = ${param_idx}")
            params.append(knowledge_base_id)
            param_idx += 1

        if entry_type:
            where_parts.append(f"ke.entry_type = ${param_idx}")
            params.append(entry_type)
            param_idx += 1

        where_sql = " AND ".join(where_parts)

        sql = f"""
            SELECT ke.id, ke.title, ke.content, ke.summary, ke.entry_type, ke.category,
                   ke.tags, ke.confidence, ke.usage_count, ke.metadata,
                   kb.name as kb_name
            FROM knowledge_entries ke
            JOIN knowledge_bases kb ON ke.knowledge_base_id = kb.id
            WHERE {where_sql}
            ORDER BY ke.usage_count DESC, ke.created_at DESC
            LIMIT ${param_idx}
        """
        params.append(top_k)

        async with pool.acquire() as conn:
            rows = await conn.fetch(sql, *params)

        return [self._row_to_result(row) for row in rows]

    async def get_related_entries(
        self,
        entry_id: str,
        firm_id: str,
        relation_type: Optional[str] = None,
        depth: int = 1,
    ) -> List[Dict[str, Any]]:
        """Traverse knowledge graph relations from an entry."""
        pool = await get_pool()

        where_parts = ["kr.firm_id = $1", "(kr.source_id = $2 OR kr.target_id = $2)"]
        params: list = [firm_id, entry_id]
        param_idx = 3

        if relation_type:
            where_parts.append(f"kr.relation_type = ${param_idx}")
            params.append(relation_type)
            param_idx += 1

        where_sql = " AND ".join(where_parts)

        sql = f"""
            SELECT DISTINCT ke.id, ke.title, ke.content, ke.summary, ke.entry_type,
                   ke.category, ke.tags, kr.relation_type, kr.weight
            FROM knowledge_relations kr
            JOIN knowledge_entries ke ON (
                (kr.source_id = $2 AND ke.id = kr.target_id) OR
                (kr.target_id = $2 AND ke.id = kr.source_id)
            )
            WHERE {where_sql} AND ke.is_active = true
            ORDER BY kr.weight DESC
            LIMIT ${param_idx}
        """
        params.append(50)

        async with pool.acquire() as conn:
            rows = await conn.fetch(sql, *params)

        return [self._row_to_relation_result(row) for row in rows]

    async def create_relation(
        self,
        firm_id: str,
        source_id: str,
        target_id: str,
        relation_type: str = "RELATED_TO",
        weight: float = 1.0,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Create a relation between two knowledge entries."""
        pool = await get_pool()
        rel_id = str(uuid4())

        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO knowledge_relations (id, firm_id, source_id, target_id, relation_type, weight, metadata, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
                ON CONFLICT (source_id, target_id, relation_type) DO UPDATE SET weight = $6, metadata = $7::jsonb
                """,
                rel_id, firm_id, source_id, target_id, relation_type, weight,
                json.dumps(metadata or {}),
            )

        return {"id": rel_id, "source_id": source_id, "target_id": target_id, "relation_type": relation_type}

    async def list_knowledge_bases(
        self, firm_id: str
    ) -> List[Dict[str, Any]]:
        """List all knowledge bases for a firm."""
        pool = await get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT id, name, description, type, status, entry_count, created_at, updated_at FROM knowledge_bases WHERE firm_id = $1 ORDER BY updated_at DESC",
                firm_id,
            )
        return [dict(row) for row in rows]

    async def list_entries(
        self,
        firm_id: str,
        knowledge_base_id: Optional[str] = None,
        entry_type: Optional[str] = None,
        category: Optional[str] = None,
        page: int = 1,
        limit: int = 20,
    ) -> Dict[str, Any]:
        """List knowledge entries with pagination."""
        pool = await get_pool()
        where_parts = ["ke.firm_id = $1", "ke.is_active = true"]
        params: list = [firm_id]
        param_idx = 2

        if knowledge_base_id:
            where_parts.append(f"ke.knowledge_base_id = ${param_idx}")
            params.append(knowledge_base_id)
            param_idx += 1

        if entry_type:
            where_parts.append(f"ke.entry_type = ${param_idx}")
            params.append(entry_type)
            param_idx += 1

        if category:
            where_parts.append(f"ke.category = ${param_idx}")
            params.append(category)
            param_idx += 1

        where_sql = " AND ".join(where_parts)

        count_sql = f"SELECT COUNT(*) as total FROM knowledge_entries ke WHERE {where_sql}"
        data_sql = f"""
            SELECT ke.id, ke.title, ke.summary, ke.entry_type, ke.category, ke.tags,
                   ke.confidence, ke.usage_count, ke.created_at, kb.name as kb_name
            FROM knowledge_entries ke
            JOIN knowledge_bases kb ON ke.knowledge_base_id = kb.id
            WHERE {where_sql}
            ORDER BY ke.created_at DESC
            LIMIT ${param_idx} OFFSET ${param_idx + 1}
        """
        params_page = params + [limit, (page - 1) * limit]

        async with pool.acquire() as conn:
            total_row = await conn.fetchrow(count_sql, *params)
            rows = await conn.fetch(data_sql, *params_page)

        return {
            "data": [dict(row) for row in rows],
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total_row["total"] if total_row else 0,
                "totalPages": ((total_row["total"] if total_row else 0) + limit - 1) // limit,
            },
        }

    async def delete_entry(self, entry_id: str, firm_id: str) -> bool:
        """Soft-delete a knowledge entry."""
        pool = await get_pool()
        async with pool.acquire() as conn:
            result = await conn.execute(
                "UPDATE knowledge_entries SET is_active = false WHERE id = $1 AND firm_id = $2",
                entry_id, firm_id,
            )
            return result.endswith("1")

    async def delete_knowledge_base(self, kb_id: str, firm_id: str) -> bool:
        """Delete a knowledge base and all its entries."""
        pool = await get_pool()
        async with pool.acquire() as conn:
            # Soft-delete all entries first
            await conn.execute(
                "UPDATE knowledge_entries SET is_active = false WHERE knowledge_base_id = $1 AND firm_id = $2",
                kb_id, firm_id,
            )
            result = await conn.execute(
                "DELETE FROM knowledge_bases WHERE id = $1 AND firm_id = $2",
                kb_id, firm_id,
            )
            return result.endswith("1")

    def _schema_type(self, entry_type: str) -> str:
        """Map Counsel entry type to schema.org type."""
        mapping = {
            "FACT": "Statement",
            "RULE": "Rule",
            "PRECEDENT": "LegalForceStatus",
            "REGULATION": "GovernmentPublication",
            "TEMPLATE": "CreativeWork",
            "CLAUSE": "Rule",
            "GUIDELINE": "HowTo",
        }
        return mapping.get(entry_type, "Thing")

    def _row_to_result(self, row) -> Dict[str, Any]:
        """Convert a database row to a search result dict."""
        return {
            "id": row["id"],
            "title": row["title"],
            "content": row["content"][:500],
            "summary": row["summary"],
            "entry_type": row["entry_type"],
            "category": row["category"],
            "tags": row["tags"] if isinstance(row["tags"], list) else json.loads(row["tags"]) if isinstance(row["tags"], str) else [],
            "confidence": row["confidence"],
            "usage_count": row["usage_count"],
            "metadata": row["metadata"] if isinstance(row["metadata"], dict) else json.loads(row["metadata"]) if isinstance(row["metadata"], str) else {},
            "kb_name": row["kb_name"],
            "similarity": round(row.get("similarity", 0), 4) if "similarity" in row.keys() else None,
        }

    def _row_to_relation_result(self, row) -> Dict[str, Any]:
        """Convert a relation query row to a result dict."""
        return {
            "id": row["id"],
            "title": row["title"],
            "content": row["content"][:300],
            "summary": row["summary"],
            "entry_type": row["entry_type"],
            "category": row["category"],
            "tags": row["tags"] if isinstance(row["tags"], list) else json.loads(row["tags"]) if isinstance(row["tags"], str) else [],
            "relation_type": row["relation_type"],
            "weight": row["weight"],
        }


knowledge_manager = KnowledgeBaseManager()
