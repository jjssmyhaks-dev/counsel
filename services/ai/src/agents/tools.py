"""Raw tools for CrewAI agents.

These are plain functions registered as CrewAI tools via the `tools`
parameter on Agent(). Each tool follows CrewAI's tool protocol:
- Accepts keyword arguments for its input schema
- Returns a string (the tool output)
- Has a docstring describing what it does and what inputs it takes

Architecture:
  - retrieval_search: Semantic search across the firm's document index
  - compliance_lookup: Look up playbook rules by category/keyword
  - document_reader: Read a document by id from the knowledge base
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Load compliance rules on module import
_RULES_PATH = os.path.join(os.path.dirname(__file__), "compliance_rules.json")
_COMPLIANCE_RULES: List[Dict[str, Any]] = []
try:
    with open(_RULES_PATH, "r", encoding="utf-8") as f:
        _COMPLIANCE_RULES = json.load(f)
    logger.info("Loaded %d compliance rules from %s", len(_COMPLIANCE_RULES), _RULES_PATH)
except Exception as e:
    logger.warning("Could not load compliance rules: %s", e)


# ═══════════════════════════════════════════════════════════════
# Tool: Semantic Search (RAG)
# ═══════════════════════════════════════════════════════════════

def retrieval_search(query: str, top_k: int = 5) -> str:
    """Semantic search across the firm's indexed documents (pgvector).

    Use this to find relevant clauses, precedents, or knowledge
    related to a legal or consulting question. Returns ranked results
    with excerpts and relevance scores.

    Args:
        query: The search query (natural language question or keyword phrase).
        top_k: Number of top results to return (default 5, max 20).

    Returns:
        JSON string with search results containing id, score, excerpt, and
        metadata for each match.
    """
    import asyncio

    top_k = min(max(top_k, 1), 20)

    try:
        result = _search_documents_sync(query, top_k)
        return json.dumps(result, indent=2, default=str)
    except Exception as e:
        logger.error("Retrieval search failed: %s", e)
        return json.dumps({
            "error": f"Search unavailable: {str(e)}",
            "results": [],
            "query": query,
        })


def _search_documents_sync(query: str, top_k: int) -> Dict[str, Any]:
    """Execute embedding-based semantic search synchronously."""
    # Attempt to import the embedder and DB client
    try:
        from ..rag.retriever import get_retriever
        retriever = get_retriever()
        results = retriever.search(query, top_k=top_k)
        return {
            "query": query,
            "total_results": len(results),
            "results": [
                {
                    "id": r.get("id", ""),
                    "score": round(r.get("score", 0.0), 4),
                    "excerpt": r.get("content", "")[:500],
                    "metadata": r.get("metadata", {}),
                }
                for r in results
            ],
        }
    except ImportError:
        return _fallback_document_search(query, top_k)
    except Exception:
        return _fallback_document_search(query, top_k)


def _fallback_document_search(query: str, top_k: int) -> Dict[str, Any]:
    """Fallback when pgvector is unavailable: keyword-based search."""
    # Try loading sample docs if available
    sample_dir = os.path.join(os.path.dirname(__file__), "..", "..", "data", "samples")
    if not os.path.isdir(sample_dir):
        return {
            "query": query,
            "total_results": 0,
            "results": [],
            "note": "Document index not available. Please upload documents first.",
        }

    results = []
    query_lower = query.lower()
    for fname in os.listdir(sample_dir):
        if not fname.endswith(".txt"):
            continue
        fpath = os.path.join(sample_dir, fname)
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                content = f.read()
            if any(word in content.lower() for word in query_lower.split()):
                results.append({
                    "id": fname.replace(".txt", ""),
                    "score": 0.5,
                    "excerpt": content[:500],
                    "metadata": {"source": fname},
                })
        except Exception:
            pass

    results = sorted(results, key=lambda r: r["score"], reverse=True)[:top_k]
    return {
        "query": query,
        "total_results": len(results),
        "results": results,
    }


# ═══════════════════════════════════════════════════════════════
# Tool: Compliance Rules Lookup
# ═══════════════════════════════════════════════════════════════

def compliance_lookup(category: str = "", rule_name: str = "") -> str:
    """Look up compliance/playbook rules by category or rule name.

    Use this to check contract provisions against the firm's negotiation
    playbook. Returns matching rules with required values, acceptable
    ranges, and risk weights.

    Args:
        category: Filter by category (financial, legal, ip, privacy, operational).
                  Empty string returns all categories.
        rule_name: Filter by specific rule name (partial match supported).
                   Empty string returns all rules in category.

    Returns:
        JSON string with matching compliance rules.
    """
    matches = []
    category_lower = category.lower() if category else ""
    name_lower = rule_name.lower() if rule_name else ""

    for rule in _COMPLIANCE_RULES:
        if category_lower and rule.get("category", "").lower() != category_lower:
            continue
        if name_lower and name_lower not in rule.get("rule_name", "").lower():
            continue
        matches.append({
            "rule_name": rule["rule_name"],
            "description": rule["description"],
            "required_value": rule["required_value"],
            "acceptable_range": rule["acceptable_range"],
            "category": rule["category"],
            "risk_weight": rule["risk_weight"],
        })

    return json.dumps({
        "total_rules": len(matches),
        "filters": {"category": category or "all", "rule_name": rule_name or "all"},
        "rules": matches,
    }, indent=2)


# ═══════════════════════════════════════════════════════════════
# Tool: Document Reader
# ═══════════════════════════════════════════════════════════════

def document_reader(document_id: str) -> str:
    """Read a document from the knowledge base by its ID.

    Args:
        document_id: The unique identifier of the document to retrieve.

    Returns:
        Full text of the document, or an error message.
    """
    sample_dir = os.path.join(os.path.dirname(__file__), "..", "..", "data", "samples")
    fpath = os.path.join(sample_dir, f"{document_id}.txt")

    if not os.path.exists(fpath):
        # Try without .txt
        fpath = os.path.join(sample_dir, document_id)
        if not os.path.exists(fpath):
            return json.dumps({
                "error": f"Document '{document_id}' not found",
                "document_id": document_id,
            })

    try:
        with open(fpath, "r", encoding="utf-8") as f:
            content = f.read()
        return json.dumps({
            "document_id": document_id,
            "content": content[:8000],  # Trim for token efficiency
            "total_chars": len(content),
            "truncated": len(content) > 8000,
        })
    except Exception as e:
        return json.dumps({
            "error": f"Failed to read document: {str(e)}",
            "document_id": document_id,
        })


# ═══════════════════════════════════════════════════════════════
# Tool registry for Agent(..., tools=[...])
# ═══════════════════════════════════════════════════════════════

RESEARCH_TOOLS = [retrieval_search, document_reader]
COMPLIANCE_TOOLS = [compliance_lookup, document_reader]
ALL_TOOLS = [retrieval_search, compliance_lookup, document_reader]

# Map tool names to functions for dynamic tool dispatch
TOOL_BY_NAME = {
    "retrieval_search": retrieval_search,
    "compliance_lookup": compliance_lookup,
    "document_reader": document_reader,
}


def get_tool(name: str):
    """Get a tool function by name. Raises ValueError if not found."""
    tool = TOOL_BY_NAME.get(name)
    if not tool:
        raise ValueError(f"Unknown tool: {name}. Available: {list(TOOL_BY_NAME.keys())}")
    return tool
