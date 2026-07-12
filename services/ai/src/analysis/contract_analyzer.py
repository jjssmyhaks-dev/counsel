"""Two-pass contract analysis — M1 module.

Pass 1: Extract clause types using pattern matching.
Pass 2: Evaluate risk against playbook rules.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from .clause_extractor import clause_extractor
from .playbook_evaluator import playbook_evaluator

logger = logging.getLogger(__name__)


class ContractAnalyzer:
    """Two-pass contract analysis engine.

    Combines clause extraction and playbook-based risk evaluation into
    a single pipeline. Works with document chunks returned by the parser.
    """

    async def analyze(
        self,
        document_id: str,
        chunks: List[Any],
        playbook_id: Optional[str] = None,
        custom_rules: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Run the two-pass analysis on a document's chunks.

        Args:
            document_id: Unique identifier for the document.
            chunks: List of Chunk objects with text, section_title, page_number.
            playbook_id: Optional playbook identifier.
            custom_rules: Optional custom playbook rules to use.

        Returns:
            Dict with document_id, clauses (list of ClauseFinding dicts), and summary.
        """
        # Assemble the full text from chunks
        all_clause_findings: List[Dict[str, Any]] = []

        for chunk in chunks:
            chunk_text = chunk.text if hasattr(chunk, "text") else chunk.get("text", "")
            page_number = (
                chunk.page_number if hasattr(chunk, "page_number")
                else chunk.get("page_number")
            )

            if not chunk_text.strip():
                continue

            # Pass 1: Extract clauses from this chunk
            findings = clause_extractor.extract(chunk_text)

            # Attach page reference
            for f in findings:
                f["page_ref"] = page_number

            all_clause_findings.extend(findings)

        # Deduplicate findings (same clause type, similar text)
        all_clause_findings = self._deduplicate_findings(all_clause_findings)

        # Build full text for missing-clause detection
        full_text = "\n\n".join(
            c.text if hasattr(c, "text") else c.get("text", "")
            for c in chunks
        )

        # Pass 2: Evaluate against playbook rules
        evaluated = playbook_evaluator.evaluate(
            clause_findings=all_clause_findings,
            playbook_rules=custom_rules,
            full_text=full_text,
        )

        # Generate summary
        summary = self._generate_summary(evaluated)

        return {
            "document_id": document_id,
            "clauses": evaluated,
            "summary": summary,
        }

    def _deduplicate_findings(
        self,
        findings: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Remove duplicate clause findings (same type, similar excerpt)."""
        seen: Dict[str, Dict[str, Any]] = {}
        for f in findings:
            key = f["clause_type"]
            if key not in seen:
                seen[key] = f
            else:
                # Keep the one with higher confidence or longer excerpt
                existing = seen[key]
                if f.get("confidence", 0) > existing.get("confidence", 0):
                    seen[key] = f
                elif len(f.get("text_excerpt", "")) > len(existing.get("text_excerpt", "")):
                    seen[key] = f
        return list(seen.values())

    @staticmethod
    def _generate_summary(findings: List[Dict[str, Any]]) -> str:
        """Generate a human-readable analysis summary."""
        total = len(findings)
        high = sum(1 for f in findings if f.get("risk_level") == "high")
        medium = sum(1 for f in findings if f.get("risk_level") == "medium")
        low = sum(1 for f in findings if f.get("risk_level") == "low")

        parts = [f"Contract analysis found {total} clause types."]
        if high > 0:
            parts.append(f"{high} high-risk issues requiring attention.")
        if medium > 0:
            parts.append(f"{medium} medium-risk items to review.")
        if low > 0:
            parts.append(f"{low} low-risk items noted.")

        if high > 0:
            parts.append("\nHigh-risk clauses:")
            for f in findings:
                if f.get("risk_level") == "high":
                    parts.append(f"  - {f['clause_type']}: {f.get('rationale', '')[:120]}")

        return "\n".join(parts)


contract_analyzer = ContractAnalyzer()
