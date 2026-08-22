"""Knowledge Ingestion Pipeline — extracts structured knowledge from documents.

Uses LLM to extract facts, rules, precedents, regulations, templates, clauses,
and guidelines from document text. Follows Open Knowledge Format (schema.org-inspired).
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

from ..config import settings
from ..db.client import get_pool
from ..embeddings.embedder import embedder

logger = logging.getLogger(__name__)

# ─── Extraction prompts ────────────────────────────────────────────────────

EXTRACTION_SYSTEM_PROMPT = """You are a knowledge extraction specialist for a professional services firm (legal, consulting, or chartered accountancy).

Given a document, extract structured knowledge entries. Each entry must follow the Open Knowledge Format:

ENTRY TYPES:
- FACT: A verifiable factual statement from the document
- RULE: A business rule, policy, or compliance requirement
- PRECEDENT: A legal precedent, case reference, or established practice
- REGULATION: A regulatory requirement (GDPR, CCPA, GST, Income Tax Act, Companies Act, etc.)
- TEMPLATE: A reusable document template, clause, or provision
- CLAUSE: A standard contract clause with its key terms
- GUIDELINE: A best practice, recommendation, or standard procedure

OUTPUT FORMAT (JSON array):
[
  {
    "title": "Short descriptive title",
    "content": "Full text of the knowledge entry (200-2000 chars)",
    "summary": "One-line summary",
    "entry_type": "FACT|RULE|PRECEDENT|REGULATION|TEMPLATE|CLAUSE|GUIDELINE",
    "category": "Category like 'indemnification', 'gst-filing', 'mca-compliance'",
    "tags": ["tag1", "tag2"],
    "confidence": 0.9,
    "metadata": {}
  }
]

GUIDELINES:
1. Extract 5-20 entries per document (quality over quantity)
2. Each entry must be self-contained and useful on its own
3. Include specific numbers, dates, thresholds when present
4. Tag entries with relevant categories for easy retrieval
5. Set confidence based on how clearly the source states the information
6. Do NOT hallucinate or infer information not in the document
7. Focus on actionable knowledge: rules, precedents, guidelines, clauses
8. For CA documents, extract filing deadlines, tax rates, compliance requirements
9. For legal documents, extract clause types, risk factors, negotiation points
10. For consulting documents, extract methodologies, frameworks, benchmarks

Return ONLY the JSON array. No other text."""

EXTRACTION_USER_PROMPT = """Extract knowledge entries from the following document:

DOCUMENT: {document_name}
TYPE: {document_type}
CONTENT:
{content}

Return the JSON array of knowledge entries:"""


class KnowledgeIngester:
    """Extracts structured knowledge from documents and stores them in the knowledge base."""

    async def extract_and_store(
        self,
        document_id: str,
        firm_id: str,
        knowledge_base_id: str,
        user_id: str,
        entry_types: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Extract knowledge from a document and store entries in the knowledge base.

        Steps:
        1. Fetch document content from DB (or file)
        2. Call LLM to extract structured knowledge entries
        3. Embed each entry
        4. Store in the knowledge base
        5. Auto-detect and create relations between entries
        """
        pool = await get_pool()

        # 1. Get document info
        async with pool.acquire() as conn:
            doc_row = await conn.fetchrow(
                "SELECT id, original_name, mime_type, firm_id FROM documents WHERE id = $1 AND firm_id = $2",
                document_id, firm_id,
            )
            if not doc_row:
                return {"error": "Document not found", "entries_created": 0}

        # 2. Get document chunks for content
        async with pool.acquire() as conn:
            chunks = await conn.fetch(
                "SELECT text FROM document_chunks WHERE document_id = $1 AND firm_id = $2 ORDER BY chunk_index",
                document_id, firm_id,
            )

        if not chunks:
            return {"error": "No content chunks found for document", "entries_created": 0}

        # Combine chunks (limit to ~8000 chars for LLM context)
        full_text = "\n\n".join([c["text"] for c in chunks])[:8000]

        # 3. Call LLM for extraction
        entries = await self._extract_entries(
            document_name=doc_row["original_name"],
            document_type=doc_row["mime_type"],
            content=full_text,
            entry_types=entry_types,
        )

        if not entries:
            return {"entries_found": 0, "entries_created": 0}

        # 4. Embed and store each entry
        created_count = 0
        created_entries = []

        for entry in entries:
            try:
                # Generate embedding
                embed_text = f"{entry.get('title', '')}\n\n{entry.get('summary', '')}\n\n{entry.get('content', '')}"[:8000]
                embedding = await embedder.embed_query(embed_text)
                vector_str = "[" + ",".join(str(v) for v in embedding) + "]"

                entry_id = str(uuid4())
                now = datetime.now(timezone.utc)

                # Build schema.org metadata
                schema_meta = {
                    "@context": "https://schema.org",
                    "@type": self._schema_type(entry.get("entry_type", "FACT")),
                    "name": entry.get("title", ""),
                    "description": entry.get("summary", entry.get("content", "")[:200]),
                    "datePublished": now.isoformat(),
                    "sourceOrganization": firm_id,
                    "category": entry.get("category", ""),
                    "keywords": ",".join(entry.get("tags", [])),
                    "sourceDocumentId": document_id,
                }

                tags_json = json.dumps(entry.get("tags", []))
                metadata_json = json.dumps({**schema_meta, **(entry.get("metadata") or {})})

                async with pool.acquire() as conn:
                    await conn.execute(
                        """
                        INSERT INTO knowledge_entries (
                            id, knowledge_base_id, firm_id, title, content, summary,
                            entry_type, category, tags, source_document_id,
                            confidence, embedding, metadata, is_active, access_level,
                            usage_count, created_by_id, created_at, updated_at
                        ) VALUES (
                            $1, $2, $3, $4, $5, $6,
                            $7, $8, $9::jsonb, $10,
                            $11, $12::vector, $13::jsonb, true, 'FIRM',
                            0, $14, $15, $15
                        )
                        """,
                        entry_id,
                        knowledge_base_id,
                        firm_id,
                        entry.get("title", "Untitled"),
                        entry.get("content", ""),
                        entry.get("summary", ""),
                        entry.get("entry_type", "FACT"),
                        entry.get("category", ""),
                        tags_json,
                        document_id,
                        entry.get("confidence", 0.8),
                        vector_str,
                        metadata_json,
                        user_id,
                        now,
                    )

                    # Update entry count
                    await conn.execute(
                        "UPDATE knowledge_bases SET entry_count = entry_count + 1, updated_at = $1 WHERE id = $2",
                        now, knowledge_base_id,
                    )

                created_count += 1
                created_entries.append({
                    "id": entry_id,
                    "title": entry.get("title"),
                    "entry_type": entry.get("entry_type"),
                    "category": entry.get("category"),
                })

            except Exception as e:
                logger.warning("Failed to store entry '%s': %s", entry.get("title", ""), e)
                continue

        # 5. Auto-create relations between entries in the same KB
        if created_count > 1:
            await self._auto_create_relations(knowledge_base_id, firm_id, created_entries)

        logger.info(
            "Knowledge ingestion complete: %d entries created from document %s",
            created_count, document_id,
        )

        return {
            "entries_found": len(entries),
            "entries_created": created_count,
            "entries": created_entries,
        }

    async def _extract_entries(
        self,
        document_name: str,
        document_type: str,
        content: str,
        entry_types: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """Call LLM to extract structured knowledge entries from text."""
        try:
            from ..rag.generator import generator

            user_prompt = EXTRACTION_USER_PROMPT.format(
                document_name=document_name,
                document_type=document_type,
                content=content,
            )

            response = await generator.generate(
                prompt=user_prompt,
                system_prompt=EXTRACTION_SYSTEM_PROMPT,
                max_tokens=8192,
            )

            # Parse JSON response
            # Try to extract JSON from markdown code blocks first
            if "```json" in response:
                json_start = response.index("```json") + 7
                json_end = response.index("```", json_start)
                response = response[json_start:json_end].strip()
            elif "```" in response:
                json_start = response.index("```") + 3
                json_end = response.index("```", json_start)
                response = response[json_start:json_end].strip()

            entries = json.loads(response)

            if not isinstance(entries, list):
                entries = [entries]

            # Filter by requested entry types
            if entry_types:
                entries = [e for e in entries if e.get("entry_type") in entry_types]

            # Validate and clean entries
            valid_entries = []
            for entry in entries:
                if entry.get("title") and entry.get("content"):
                    valid_entries.append({
                        "title": entry["title"][:500],
                        "content": entry["content"][:5000],
                        "summary": entry.get("summary", "")[:2000],
                        "entry_type": entry.get("entry_type", "FACT"),
                        "category": entry.get("category", ""),
                        "tags": entry.get("tags", []),
                        "confidence": min(1.0, max(0.1, entry.get("confidence", 0.8))),
                        "metadata": entry.get("metadata", {}),
                    })

            return valid_entries

        except json.JSONDecodeError as e:
            logger.warning("Failed to parse LLM extraction response as JSON: %s", e)
            return []
        except Exception as e:
            logger.error("Knowledge extraction failed: %s", e)
            return []

    async def _auto_create_relations(
        self,
        knowledge_base_id: str,
        firm_id: str,
        entries: List[Dict[str, Any]],
    ) -> None:
        """Automatically create relations between entries with similar content."""
        pool = await get_pool()

        # Simple relation strategy: entries in the same KB with overlapping tags get RELATED_TO
        for i, entry_a in enumerate(entries):
            for entry_b in entries[i + 1:]:
                tags_a = set(entry_a.get("tags", []))
                tags_b = set(entry_b.get("tags", []))
                common_tags = tags_a & tags_b

                if common_tags and entry_a["id"] != entry_b["id"]:
                    try:
                        rel_id = str(uuid4())
                        weight = min(10.0, len(common_tags) * 2.0)
                        async with pool.acquire() as conn:
                            await conn.execute(
                                """
                                INSERT INTO knowledge_relations (id, firm_id, source_id, target_id, relation_type, weight, metadata, created_at)
                                VALUES ($1, $2, $3, $4, 'RELATED_TO', $5, $6::jsonb, NOW())
                                ON CONFLICT (source_id, target_id, relation_type) DO NOTHING
                                """,
                                rel_id, firm_id, entry_a["id"], entry_b["id"],
                                weight,
                                json.dumps({"common_tags": list(common_tags), "auto_created": True}),
                            )
                    except Exception:
                        continue

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


knowledge_ingester = KnowledgeIngester()
