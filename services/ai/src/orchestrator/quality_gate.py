"""
Quality Gate Agent — validates AI outputs before they're returned to the user.

Checks: prompt injection, hallucinated citations, missing disclaimers,
confidence thresholds, and output format compliance.
"""

import re
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any


@dataclass
class GateResult:
    passed: bool
    checks: List[Dict[str, Any]] = field(default_factory=list)
    blocked: bool = False
    warnings: List[str] = field(default_factory=list)
    sanitized_output: Optional[str] = None


class QualityGateAgent:
    """
    Runs a series of quality and safety checks on AI-generated outputs.
    Acts as the last line of defense before content reaches the user.
    """

    # Phrases that indicate the model is fabricating rather than retrieving
    HALLUCINATION_SIGNALS = [
        r"I (?:believe|think|assume|guess|imagine|suppose)",
        r"(?:probably|possibly|maybe|perhaps|likely)",
        r"to the best of my knowledge",
        r"as far as I know",
        r"based on my training",
        r"in my opinion",
        r"it appears that",
        r"it seems (?:likely|probable)",
        r"without access to",
        r"I don't have (?:access to|information about)",
    ]

    # Patterns that suggest the model is trying to follow instructions from retrieved content
    PROMPT_INJECTION_SIGNALS = [
        r"ignore (?:all )?(?:previous|above|prior) (?:instructions?|prompts?)",
        r"you are now",
        r"your new (?:role|task|job|purpose)",
        r"disregard (?:all )?(?:previous|above) (?:instructions?|prompts?)",
        r"system prompt",
        r"you must (?:always|never)",
        r"from now on you (?:are|will|must)",
    ]

    # Legal disclaimer that must appear on contract-related outputs
    LEGAL_DISCLAIMER = (
        "⚠️ AI-Assisted Analysis — This output was generated with AI and is not a substitute "
        "for professional legal judgment. Please review thoroughly before relying on it."
    )

    def __init__(self, confidence_threshold: float = 0.7):
        self.confidence_threshold = confidence_threshold

    def validate(
        self, output: str, context: Optional[Dict[str, Any]] = None
    ) -> GateResult:
        """
        Run all quality checks on the AI output.

        Args:
            output: The generated text/content
            context: Context including intent, sources, confidence scores, etc.

        Returns:
            GateResult with pass/fail, warnings, and sanitized output
        """
        checks = []
        warnings = []
        blocked = False

        # 1. Prompt injection check (BLOCKING)
        injection_check = self._check_prompt_injection(output)
        checks.append({"check": "prompt_injection", "passed": injection_check["passed"], "detail": injection_check})
        if not injection_check["passed"]:
            warnings.append("Prompt injection pattern detected in output — output blocked.")
            blocked = True

        # 2. Hallucination check
        hallucination_check = self._check_hallucination(output)
        checks.append({"check": "hallucination", "passed": hallucination_check["passed"], "detail": hallucination_check})
        if not hallucination_check["passed"]:
            warnings.append("Potential hallucination detected in output.")

        # 3. Confidence threshold check
        if context and "confidence" in context:
            conf = context["confidence"]
            checks.append({
                "check": "confidence_threshold",
                "passed": conf >= self.confidence_threshold,
                "detail": {"actual": conf, "threshold": self.confidence_threshold},
            })
            if conf < self.confidence_threshold:
                warnings.append(f"Confidence ({conf:.2f}) below threshold ({self.confidence_threshold:.2f}).")

        # 4. Citation validity check
        if context and context.get("requires_citations", False):
            citation_check = self._check_citations(output, context.get("available_sources", []))
            checks.append({"check": "citations", "passed": citation_check["passed"], "detail": citation_check})
            if not citation_check["passed"]:
                warnings.append("Citations may reference non-existent or unavailable sources.")

        # 5. Legal disclaimer check
        if context and context.get("is_legal_content", False):
            disclaimer_check = self.LEGAL_DISCLAIMER in output
            checks.append({"check": "legal_disclaimer", "passed": disclaimer_check})
            if not disclaimer_check:
                warnings.append("Legal content missing required AI disclaimer.")
                # Auto-append disclaimer to sanitized output
                output = output + "\n\n---\n" + self.LEGAL_DISCLAIMER

        # 6. Output length/quality check
        length_check = len(output.strip()) > 0
        checks.append({"check": "non_empty_output", "passed": length_check})
        if not length_check:
            warnings.append("Output is empty.")

        passed = not blocked  # Passes if not blocked (warnings are non-blocking)

        return GateResult(
            passed=passed,
            checks=checks,
            blocked=blocked,
            warnings=warnings,
            sanitized_output=output if not blocked else None,
        )

    def _check_prompt_injection(self, output: str) -> Dict[str, Any]:
        """Scan for instruction-like text in the output that came from retrieved content."""
        output_lower = output.lower()
        matches = []
        for pattern in self.PROMPT_INJECTION_SIGNALS:
            found = re.findall(pattern, output_lower, re.IGNORECASE)
            if found:
                matches.extend(found)

        return {
            "passed": len(matches) == 0,
            "matches": matches,
            "match_count": len(matches),
        }

    def _check_hallucination(self, output: str) -> Dict[str, Any]:
        """Detect language patterns that suggest the model is guessing."""
        output_lower = output.lower()
        matches = []
        for pattern in self.HALLUCINATION_SIGNALS:
            found = re.findall(pattern, output_lower, re.IGNORECASE)
            if found:
                matches.extend(found)

        # Allow a few hedges (legitimate uncertainty) but flag excessive hedging
        is_excessive = len(matches) > 3
        return {
            "passed": not is_excessive,
            "matches": matches,
            "match_count": len(matches),
            "is_excessive": is_excessive,
        }

    def _check_citations(self, output: str, available_sources: List[str]) -> Dict[str, Any]:
        """Verify that cited sources actually exist in the available set."""
        if not available_sources:
            return {"passed": True, "detail": "No sources to check against."}

        # Extract potential document references from output
        # Pattern: document IDs, filenames, or "Source: X" references
        cited = set()
        for pattern in [r"Source:\s*(\S+)", r"Document\s+(\S+)", r"from\s+'([^']+)'"]:
            found = re.findall(pattern, output, re.IGNORECASE)
            cited.update(found)

        source_set = set(s.lower() for s in available_sources)
        missing = [c for c in cited if c.lower() not in source_set]

        return {
            "passed": len(missing) == 0,
            "cited": list(cited),
            "missing": missing,
            "available_count": len(available_sources),
        }
