"""Clause type extractor using keyword pattern matching.

Identifies common legal clause types from document text using a curated
set of keyword patterns and regex-based heuristics.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple


class ClauseExtractor:
    """Extract clause types from document text using pattern matching."""

    # ── Clause definitions ──────────────────────────────────────
    # Each entry: (clause_type, [keywords], [negative_keywords])

    CLAUSE_PATTERNS: List[Tuple[str, List[str], List[str]]] = [
        (
            "Indemnification",
            [
                "indemnify", "indemnification", "indemnifies",
                "hold harmless", "hold-harmless",
                "indemnity", "indemnitor",
            ],
            ["tax indemnity"],
        ),
        (
            "Limitation of Liability",
            [
                "limitation of liability", "liability cap",
                "maximum liability", "limit.*liability",
                "cap on liability", "exclusion of liability",
                "consequential damages", "incidental damages",
            ],
            [],
        ),
        (
            "Termination",
            [
                "termination", "terminate", "terminates",
                "notice period", "termination for cause",
                "termination for convenience", "right to terminate",
                "survival", "effect of termination",
            ],
            [],
        ),
        (
            "Intellectual Property",
            [
                "intellectual property", "IP assignment",
                "work for hire", "work made for hire",
                "copyright", "patent", "trademark",
                "trade secret", "proprietary rights",
                "ownership of.*IP", "IP rights",
            ],
            ["intellectual property infringement by third parties"],
        ),
        (
            "Confidentiality",
            [
                "confidential", "confidentiality",
                "non-disclosure", "NDA",
                "confidential information", "proprietary information",
                "duty of confidence", "obligation of confidentiality",
            ],
            [],
        ),
        (
            "Governing Law",
            [
                "governing law", "jurisdiction",
                "choice of law", "venue",
                "forum selection", "applicable law",
                "dispute resolution", "arbitration",
            ],
            [],
        ),
        (
            "Force Majeure",
            [
                "force majeure", "act of god",
                "beyond.*reasonable control", "unforeseeable.*circumstances",
                "force majeure event",
            ],
            [],
        ),
        (
            "Payment Terms",
            [
                "payment", "fee", "fees",
                "compensation", "remuneration",
                "invoice", "invoicing",
                "due date", "payment schedule",
                "late payment", "interest.*overdue",
            ],
            ["payment of taxes", "payment of costs related to"],
        ),
        (
            "Representations and Warranties",
            [
                "represent.*warrant", "represents and warrants",
                "representations and warranties",
                "warranty", "warranties",
                "disclaimer of warranty",
            ],
            [],
        ),
        (
            "Insurance",
            [
                "insurance", "insured",
                "coverage", "policy limit",
                "certificate of insurance",
                "additional insured",
            ],
            [],
        ),
        (
            "Assignment",
            [
                "assignment", "assignability",
                "may not assign", "right to assign",
                "successors.*assigns",
            ],
            ["IP assignment", "intellectual property.*assignment"],
        ),
        (
            "Data Protection",
            [
                "data protection", "data privacy",
                "GDPR", "CCPA", "personal data",
                "data processing", "data breach",
                "privacy policy", "data subject",
            ],
            [],
        ),
        (
            "Non-Compete / Non-Solicit",
            [
                "non-compete", "non-solicit",
                "non-solicitation", "restrictive covenant",
                "restraint of trade",
                "shall not compete", "shall not solicit",
            ],
            [],
        ),
        (
            "Severability",
            [
                "severability", "severable",
                "invalid.*unenforceable",
                "void.*provision",
            ],
            [],
        ),
        (
            "Notices",
            [
                "notices", "notice provision",
                "written notice", "address for notice",
                "notice shall be",
            ],
            [],
        ),
        (
            "Entire Agreement",
            [
                "entire agreement", "integration clause",
                "merger clause", "supersedes.*prior",
                "whole agreement",
            ],
            [],
        ),
    ]

    def extract(self, text: str) -> List[Dict[str, Any]]:
        """Extract clause findings from a text block.

        Returns a list of dicts with clause_type, excerpt, and confidence.
        """
        findings: List[Dict[str, Any]] = []
        text_lower = text.lower()

        for clause_type, positive_keywords, negative_keywords in self.CLAUSE_PATTERNS:
            # Check for positive matches
            matched_keywords = []
            for kw in positive_keywords:
                pattern = re.compile(r"\b" + kw + r"\b", re.IGNORECASE)
                if pattern.search(text):
                    matched_keywords.append(kw)

            if not matched_keywords:
                continue

            # Check for negative matches (exclusions)
            negated = False
            for nkw in negative_keywords:
                neg_pattern = re.compile(r"\b" + nkw + r"\b", re.IGNORECASE)
                if neg_pattern.search(text):
                    negated = True
                    break

            if negated:
                continue

            # Extract a relevant excerpt
            excerpt = self._extract_excerpt(text, matched_keywords[0], text_lower)

            # Compute a simple confidence score
            confidence = min(0.95, 0.4 + 0.15 * len(matched_keywords))

            findings.append({
                "clause_type": clause_type,
                "text_excerpt": excerpt,
                "matched_keywords": matched_keywords,
                "confidence": round(confidence, 3),
            })

        return findings

    def _extract_excerpt(self, text: str, keyword: str, text_lower: str) -> str:
        """Extract the sentence or paragraph containing the keyword match."""
        # Find the keyword position
        match = re.search(r"\b" + re.escape(keyword) + r"\b", text, re.IGNORECASE)
        if not match:
            return text[:500]

        pos = match.start()
        # Try to find sentence boundaries
        start = max(0, pos - 200)
        end = min(len(text), pos + 500)

        # Adjust to sentence/paragraph boundaries
        # Go back to the start of a sentence or paragraph
        for i in range(pos, max(0, pos - 200), -1):
            if text[i] in ".!?\n" and i + 1 < len(text) and text[i + 1] in " \n":
                start = max(0, i + 2 if text[i + 1] == " " else i + 1)
                break

        # Go forward to the end of a sentence or paragraph
        for i in range(pos, min(len(text), pos + 500)):
            if text[i] in ".!?" and (i + 1 >= len(text) or text[i + 1] in " \n"):
                end = i + 1
                break

        excerpt = text[start:end].strip()
        if len(excerpt) > 600:
            excerpt = excerpt[:597] + "..."

        return excerpt


clause_extractor = ClauseExtractor()
