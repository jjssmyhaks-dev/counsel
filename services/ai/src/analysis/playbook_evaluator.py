"""Playbook evaluator — compare extracted clauses against playbook rules."""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional


class PlaybookEvaluator:
    """Evaluates extracted clauses against playbook-defined risk criteria."""

    # ── Default standard playbook ───────────────────────────────

    DEFAULT_RULES: List[Dict[str, Any]] = [
        {
            "clause_type": "Indemnification",
            "name": "Mutual Indemnification",
            "description": "Both parties should indemnify each other.",
            "risk_criteria": "missing:mutual, one_sided",
            "severity": "high",
            "suggested_template": (
                "Each Party shall indemnify, defend, and hold harmless the "
                "other Party against all claims, damages, losses and expenses "
                "arising out of [each Party's respective obligations]."
            ),
        },
        {
            "clause_type": "Limitation of Liability",
            "name": "Reasonable Liability Cap",
            "description": "Liability should be capped at fees paid.",
            "risk_criteria": "missing:cap, unlimited, excludes:fees",
            "severity": "high",
            "suggested_template": (
                "Neither Party's aggregate liability shall exceed the total "
                "fees paid or payable under this Agreement during the twelve "
                "(12) months preceding the claim."
            ),
        },
        {
            "clause_type": "Termination",
            "name": "Adequate Notice Period",
            "description": "Termination should have a reasonable notice period (30+ days).",
            "risk_criteria": "missing:notice, notice<30, immediate, at_will",
            "severity": "medium",
            "suggested_template": (
                "Either Party may terminate this Agreement upon thirty (30) "
                "days' prior written notice to the other Party."
            ),
        },
        {
            "clause_type": "Intellectual Property",
            "name": "Clear IP Ownership",
            "description": "IP ownership should be explicitly stated.",
            "risk_criteria": "ambiguous, missing:assignment, no_work_for_hire",
            "severity": "high",
            "suggested_template": (
                "All work product created under this Agreement shall be "
                "'work made for hire' and all right, title and interest "
                "therein shall vest exclusively in Client."
            ),
        },
        {
            "clause_type": "Confidentiality",
            "name": "Robust Confidentiality",
            "description": "Confidentiality obligations should be mutual and include return/destruction.",
            "risk_criteria": "one_sided, no_return, no_destruction",
            "severity": "medium",
            "suggested_template": (
                "Each Party shall maintain the confidentiality of all "
                "Confidential Information and, upon termination, shall "
                "return or destroy all such information."
            ),
        },
        {
            "clause_type": "Governing Law",
            "name": "Favorable Governing Law",
            "description": "Check if governing law is favorable to client.",
            "risk_criteria": "unfavorable:counterparty_state, foreign_jurisdiction",
            "severity": "low",
            "suggested_template": None,
        },
        {
            "clause_type": "Data Protection",
            "name": "Data Protection Compliance",
            "description": "Data protection provisions should meet regulatory standards.",
            "risk_criteria": "missing:dpa, no_data_processing_terms, no_breach_notification",
            "severity": "high",
            "suggested_template": (
                "Data Processor shall implement appropriate technical and "
                "organizational measures to protect Personal Data and shall "
                "notify Data Controller without undue delay upon becoming "
                "aware of a Personal Data Breach."
            ),
        },
        {
            "clause_type": "Force Majeure",
            "name": "Balanced Force Majeure",
            "description": "Force majeure should not excuse payment obligations.",
            "risk_criteria": "excuses:payment, overly_broad, no_notice_requirement",
            "severity": "medium",
            "suggested_template": None,
        },
    ]

    def evaluate(
        self,
        clause_findings: List[Dict[str, Any]],
        playbook_rules: Optional[List[Dict[str, Any]]] = None,
        full_text: str = "",
    ) -> List[Dict[str, Any]]:
        """Evaluate clause findings against playbook rules.

        Returns a list of evaluated findings with risk_level, rationale,
        and suggested_edit.
        """
        if playbook_rules is None:
            playbook_rules = self.DEFAULT_RULES

        rules_by_type: Dict[str, Dict[str, Any]] = {}
        for rule in playbook_rules:
            rules_by_type[rule["clause_type"]] = rule

        evaluated = []

        # Evaluate each found clause
        for finding in clause_findings:
            clause_type = finding["clause_type"]
            rule = rules_by_type.get(clause_type)

            if rule is None:
                # No specific rule — mark as informational
                finding["risk_level"] = "low"
                finding["rationale"] = (
                    f"The document contains a '{clause_type}' clause. "
                    "No specific playbook rule configured for this clause type. "
                    "Review for standard commercial terms."
                )
                finding["suggested_edit"] = None
                evaluated.append(finding)
                continue

            # Apply risk criteria analysis
            risk_level, rationale, suggested = self._apply_rule(
                finding, rule, full_text
            )

            finding["risk_level"] = risk_level
            finding["rationale"] = rationale
            finding["suggested_edit"] = suggested
            evaluated.append(finding)

        # Check for missing expected clauses
        found_types = {f["clause_type"] for f in clause_findings}
        for clause_type, rule in rules_by_type.items():
            if clause_type not in found_types and rule.get("severity") in ("high", "medium"):
                excerpt_start = full_text[:300].strip() if full_text else ""
                evaluated.append({
                    "clause_type": clause_type,
                    "text_excerpt": excerpt_start + "..." if excerpt_start else "[No text — clause missing]",
                    "matched_keywords": [],
                    "confidence": 1.0,
                    "risk_level": rule["severity"],
                    "rationale": (
                        f"MISSING: The document does not contain a {clause_type} clause. "
                        f"Playbook rule '{rule['name']}' requires this provision. "
                        f"Risk: {rule['description']}"
                    ),
                    "suggested_edit": rule.get("suggested_template"),
                })

        return evaluated

    def _apply_rule(
        self,
        finding: Dict[str, Any],
        rule: Dict[str, Any],
        full_text: str,
    ) -> tuple:
        """Apply a playbook rule to a clause finding.

        Returns (risk_level, rationale, suggested_edit).
        """
        clause_type = finding["clause_type"]
        text_excerpt = finding.get("text_excerpt", "")
        criteria = rule.get("risk_criteria", "")
        severity = rule.get("severity", "medium")

        flags: List[str] = []
        risk_level = "low"

        # Analyse the text against criteria
        text_lower = text_excerpt.lower()

        if "one_sided" in criteria:
            if not self._is_mutual(text_lower):
                flags.append("Clause appears one-sided (not mutual)")
                risk_level = self._max_risk(risk_level, severity)

        if "missing:mutual" in criteria:
            mutual_indicators = ["each party", "mutual", "both parties", "reciprocal"]
            if not any(ind in text_lower for ind in mutual_indicators):
                flags.append("Clause is not mutual")
                risk_level = self._max_risk(risk_level, severity)

        if "unlimited" in criteria:
            if "unlimited" in text_lower or "uncapped" in text_lower:
                flags.append("Liability is unlimited or uncapped")
                risk_level = self._max_risk(risk_level, "high")

        if "missing:cap" in criteria:
            cap_indicators = ["cap", "maximum", "not exceed", "shall not exceed", "aggregate"]
            if not any(ind in text_lower for ind in cap_indicators):
                flags.append("No liability cap identified")
                risk_level = self._max_risk(risk_level, "medium")

        if "missing:notice" in criteria or "notice<30" in criteria:
            notice_found = False
            notice_match = re.search(r"(\d+)\s*(?:-?\s*)?days?(?:\'|s)?\s*notice", text_lower)
            if notice_match:
                days = int(notice_match.group(1))
                if days < 30:
                    flags.append(f"Notice period is only {days} days (playbook requires 30+)")
                    risk_level = self._max_risk(risk_level, "medium")
                notice_found = True
            if not notice_found:
                flags.append("No notice period specified")
                risk_level = self._max_risk(risk_level, "medium")

        if "missing:assignment" in criteria or "no_work_for_hire" in criteria:
            if not re.search(r"work\s+(made\s+)?for\s+hire", text_lower):
                flags.append("No 'work for hire' language found")
                risk_level = self._max_risk(risk_level, "high")

        if "ambiguous" in criteria:
            if len(text_excerpt) < 100:
                flags.append("Clause text is very brief — may be ambiguous")
                risk_level = self._max_risk(risk_level, "medium")

        if "missing:dpa" in criteria:
            dpa_indicators = ["data processing agreement", "data processing addendum", "DPA"]
            if not any(ind in text_lower for ind in dpa_indicators):
                flags.append("No Data Processing Agreement referenced")
                risk_level = self._max_risk(risk_level, "high")

        if "no_breach_notification" in criteria:
            if "notify" not in text_lower and "notification" not in text_lower:
                flags.append("No breach notification provision")
                risk_level = self._max_risk(risk_level, "high")

        if "excuses:payment" in criteria:
            if "payment" in text_lower and "excuse" not in text_lower:
                # Check if payment obligations are explicitly carved out
                if "notwithstanding" not in text_lower:
                    flags.append("Force majeure may excuse payment obligations")
                    risk_level = self._max_risk(risk_level, "medium")

        # Build rationale
        if not flags:
            rationale = (
                f"The '{clause_type}' clause appears to meet playbook standards "
                f"under rule '{rule['name']}'. {rule['description']}"
            )
            risk_level = "low"
        else:
            rationale = " | ".join(flags) + f". Playbook rule: {rule['description']}"

        suggested = rule.get("suggested_template") if risk_level in ("medium", "high") else None

        return risk_level, rationale, suggested

    @staticmethod
    def _is_mutual(text: str) -> bool:
        """Check if clause text indicates mutual obligations."""
        mutual_signals = [
            "each party", "either party", "both parties",
            "mutual", "reciprocal", "party shall",
        ]
        return sum(1 for s in mutual_signals if s in text) >= 1

    @staticmethod
    def _max_risk(current: str, new: str) -> str:
        """Return the higher of two risk levels."""
        order = {"low": 0, "medium": 1, "high": 2}
        return new if order.get(new, 0) > order.get(current, 0) else current


playbook_evaluator = PlaybookEvaluator()
