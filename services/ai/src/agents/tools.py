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

def compliance_lookup(category: str = "", rule_name: str = "", framework: str = "") -> str:
    """Look up compliance/playbook rules by category, rule name, or framework.

    Use this to check contract provisions against the firm's negotiation
    playbook, or to look up regulatory requirements from GDPR/CCPA/SOC2/ISO27001.

    Args:
        category: Filter by category (financial, legal, ip, privacy, operational).
        rule_name: Filter by specific rule name (partial match supported).
        framework: Look up regulatory framework rules instead. One of:
                   GDPR, CCPA, SOC2, ISO27001.

    Returns:
        JSON string with matching compliance rules.
    """
    # Regulatory framework lookup (new format)
    if framework:
        fw = framework.upper()
        regulatory = _COMPLIANCE_RULES.get("regulatory_frameworks", {})
        fw_rules = regulatory.get(fw, [])
        return json.dumps({
            "total_rules": len(fw_rules),
            "framework": fw,
            "filters": {"category": category or "all", "rule_name": rule_name or "all"},
            "rules": fw_rules,
        }, indent=2)

    # Contract negotiation playbook (legacy format)
    contract_rules = _COMPLIANCE_RULES.get("contract_negotiation", _COMPLIANCE_RULES)
    matches = []
    category_lower = category.lower() if category else ""
    name_lower = rule_name.lower() if rule_name else ""

    for rule in contract_rules:
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
# Tool: Financial Calculator (Real NPV/IRR, not LLM-estimated)
# ═══════════════════════════════════════════════════════════════

def financial_calculator(cash_flows: str, discount_rate: str = "0.10") -> str:
    """Compute NPV, IRR, and payback period from cash flow series.

    Use this tool instead of estimating financial numbers yourself.
    Returns real computed values using numpy-financial.

    Args:
        cash_flows: JSON array of numbers, e.g. "[-100000, 30000, 40000, 50000]".
                    Period 0 = initial investment (negative).
        discount_rate: Annual discount rate as decimal, e.g. "0.10" for 10%.

    Returns:
        JSON string with npv, irr, payback_period_years.
    """
    import json as _json
    import numpy_financial as npf

    try:
        flows = _json.loads(cash_flows) if isinstance(cash_flows, str) else cash_flows
        rate = float(discount_rate) if isinstance(discount_rate, str) else discount_rate

        npv = npf.npv(rate, flows)
        try:
            irr_val = npf.irr(flows)
        except Exception:
            irr_val = None

        # Payback period
        cumulative = 0.0
        payback = None
        for i, cf in enumerate(flows):
            cumulative += cf
            if cumulative >= 0 and payback is None and i > 0:
                # Linear interpolation for fractional year
                prev_cum = cumulative - cf
                fraction = abs(prev_cum) / (abs(prev_cum) + abs(cf)) if cf != 0 else 0
                payback = i - 1 + fraction

        return _json.dumps({
            "npv": round(npv, 2),
            "irr": round(irr_val, 4) if irr_val is not None else None,
            "payback_period_years": round(payback, 2) if payback is not None else None,
            "discount_rate": rate,
            "periods": len(flows),
        })
    except Exception as e:
        return _json.dumps({"error": f"Financial calculation failed: {str(e)}"})


def sensitivity_analysis(cash_flows: str, discount_rate: str = "0.10", variance_pct: str = "0.20") -> str:
    """Run best/base/worst case sensitivity analysis.

    Args:
        cash_flows: JSON array of base-case cash flows.
        discount_rate: Annual discount rate.
        variance_pct: Variance percentage (e.g. "0.20" for +/-20%).

    Returns:
        JSON with base_case, best_case, worst_case NPV/IRR/payback.
    """
    import json as _json

    flows = _json.loads(cash_flows) if isinstance(cash_flows, str) else cash_flows
    v = float(variance_pct) if isinstance(variance_pct, str) else variance_pct

    base = _json.loads(financial_calculator(flows, discount_rate))

    best_cf = [cf * (1 + v) if cf > 0 else cf for cf in flows]
    worst_cf = [cf * (1 - v) if cf > 0 else cf for cf in flows]

    best = _json.loads(financial_calculator(best_cf, discount_rate))
    worst = _json.loads(financial_calculator(worst_cf, discount_rate))

    return _json.dumps({
        "base_case": base,
        "best_case": {"npv": best.get("npv"), "irr": best.get("irr"), "payback_period_years": best.get("payback_period_years")},
        "worst_case": {"npv": worst.get("npv"), "irr": worst.get("irr"), "payback_period_years": worst.get("payback_period_years")},
        "variance_pct": v,
    })


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
FINANCIAL_TOOLS = [financial_calculator, sensitivity_analysis]
ALL_TOOLS = [retrieval_search, compliance_lookup, document_reader, financial_calculator, sensitivity_analysis]

# Map tool names to functions for dynamic tool dispatch
TOOL_BY_NAME = {
    "retrieval_search": retrieval_search,
    "compliance_lookup": compliance_lookup,
    "document_reader": document_reader,
    "financial_calculator": financial_calculator,
    "sensitivity_analysis": sensitivity_analysis,
}


def get_tool(name: str):
    """Get a tool function by name. Raises ValueError if not found."""
    tool = TOOL_BY_NAME.get(name)
    if not tool:
        raise ValueError(f"Unknown tool: {name}. Available: {list(TOOL_BY_NAME.keys())}")
    return tool
