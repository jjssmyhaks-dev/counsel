"""
Agentic Guardrails — Input/output validation, safety checks, and harness.

Before any tool/crew execution:
  1. Input validation (sanity checks on parameters)
  2. Prompt injection detection
  3. PII detection and redaction
  4. Rate limiting per user/firm
  5. Cost tracking and budget enforcement
  6. Output validation (hallucination detection, relevance checks)

This is the safety layer between the planner and the executor.
"""
from __future__ import annotations

import json
import logging
import re
import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# ─── Rate Limiting ────────────────────────────────────────────────

@dataclass
class RateLimitConfig:
    max_requests_per_minute: int = 30
    max_requests_per_hour: int = 200
    max_concurrent_executions: int = 5
    max_tokens_per_hour: int = 500_000  # Cloudflare token budget


class RateLimiter:
    """Per-firm rate limiting with sliding window."""

    def __init__(self, config: Optional[RateLimitConfig] = None):
        self.config = config or RateLimitConfig()
        self._windows: Dict[str, List[float]] = defaultdict(list)
        self._concurrent: Dict[str, int] = defaultdict(int)

    def check_rate_limit(self, firm_id: str) -> Tuple[bool, Optional[str]]:
        """Check if firm is within rate limits. Returns (allowed, reason)."""
        now = time.time()
        window = self._windows[firm_id]

        # Clean old entries (sliding window)
        window = [t for t in window if now - t < 3600]
        self._windows[firm_id] = window

        # Check per-minute limit
        minute_window = [t for t in window if now - t < 60]
        if len(minute_window) >= self.config.max_requests_per_minute:
            return False, f"Rate limit: {self.config.max_requests_per_minute} requests/minute exceeded"

        # Check per-hour limit
        if len(window) >= self.config.max_requests_per_hour:
            return False, f"Rate limit: {self.config.max_requests_per_hour} requests/hour exceeded"

        # Check concurrent limit
        if self._concurrent[firm_id] >= self.config.max_concurrent_executions:
            return False, f"Rate limit: {self.config.max_concurrent_executions} concurrent executions"

        return True, None

    def record_request(self, firm_id: str):
        """Record a request for rate limiting."""
        self._windows[firm_id].append(time.time())
        self._concurrent[firm_id] += 1

    def record_completion(self, firm_id: str):
        """Record completion of a concurrent execution."""
        self._concurrent[firm_id] = max(0, self._concurrent[firm_id] - 1)

    def get_usage(self, firm_id: str) -> Dict[str, Any]:
        """Get current usage stats for a firm."""
        now = time.time()
        window = self._windows[firm_id]
        minute_count = len([t for t in window if now - t < 60])
        hour_count = len([t for t in window if now - t < 3600])
        return {
            "requests_last_minute": minute_count,
            "requests_last_hour": hour_count,
            "concurrent": self._concurrent[firm_id],
            "limits": {
                "per_minute": self.config.max_requests_per_minute,
                "per_hour": self.config.max_requests_per_hour,
                "concurrent": self.config.max_concurrent_executions,
            },
        }


# ─── Input Validation ────────────────────────────────────────────

class InputValidator:
    """Validates and sanitizes inputs before tool/crew execution."""

    # Maximum input sizes
    MAX_MESSAGE_LENGTH = 50_000
    MAX_PARAM_SIZE = 10_000

    # Prompt injection patterns
    INJECTION_PATTERNS = [
        r'ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)',
        r'you\s+are\s+now\s+(?:a|an|the)\s+',
        r'system\s*:\s*',
        r'act\s+as\s+(?:if\s+)?(?:you\s+are\s+)?(?:a|an|the)\s+',
        r'forget\s+(?:everything|all|your)\s+',
        r'override\s+(?:your\s+)?(?:instructions?|rules?|safety)',
        r'\[INST\]|\[/INST\]|<\|im_start\|>|<\|im_end\|>',
        r'<\|system\|>|<\|user\|>|<\|assistant\|>',
        r'###\s*(system|human|assistant)\s*:',
    ]

    def __init__(self):
        self._injection_re = re.compile(
            '|'.join(self.INJECTION_PATTERNS), re.IGNORECASE
        )

    def validate_message(self, message: str) -> Tuple[bool, Optional[str], str]:
        """
        Validate and sanitize a user message.

        Returns: (is_valid, error_reason, sanitized_message)
        """
        if not message or not message.strip():
            return False, "Empty message", ""

        # Length check
        if len(message) > self.MAX_MESSAGE_LENGTH:
            return False, f"Message too long ({len(message)} chars, max {self.MAX_MESSAGE_LENGTH})", ""

        # Prompt injection detection
        if self.detect_injection(message):
            logger.warning("Prompt injection detected in message: %s...", message[:100])
            return False, "Message contains potentially unsafe content", ""

        # Sanitize
        sanitized = self._sanitize(message)
        return True, None, sanitized

    def detect_injection(self, text: str) -> bool:
        """Detect potential prompt injection attempts."""
        return bool(self._injection_re.search(text))

    def validate_params(self, tool_name: str, params: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Validate parameters for a tool call."""
        # Check total param size
        params_str = json.dumps(params)
        if len(params_str) > self.MAX_PARAM_SIZE:
            return False, f"Parameters too large ({len(params_str)} chars)"

        # Check for suspicious patterns in string params
        for key, value in params.items():
            if isinstance(value, str) and self.detect_injection(value):
                return False, f"Potentially unsafe content in parameter '{key}'"

        return True, None

    def _sanitize(self, text: str) -> str:
        """Sanitize user input."""
        # Remove null bytes
        text = text.replace('\x00', '')
        # Strip control characters (except newlines and tabs)
        text = re.sub(r'[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
        # Limit consecutive whitespace
        text = re.sub(r' {4,}', '    ', text)
        return text.strip()


# ─── PII Detection ────────────────────────────────────────────────

class PIIDetector:
    """Detects and redacts Personally Identifiable Information."""

    PII_PATTERNS = {
        "pan": r'\b[A-Z]{5}\d{4}[A-Z]\b',
        "gstin": r'\b\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z0-9]\b',
        "aadhaar": r'\b\d{4}\s?\d{4}\s?\d{4}\b',
        "email": r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        "phone_india": r'\b(?:\+91|91)?[-.\s]?\d{10}\b',
        "ifsc": r'\b[A-Z]{4}0[A-Z0-9]{6}\b',
        "account_number": r'\b\d{9,18}\b',
    }

    def __init__(self):
        self._patterns = {k: re.compile(v, re.IGNORECASE) for k, v in self.PII_PATTERNS.items()}

    def detect_pii(self, text: str) -> Dict[str, List[str]]:
        """Detect PII in text. Returns {type: [matches]}."""
        results = {}
        for pii_type, pattern in self._patterns.items():
            matches = pattern.findall(text)
            if matches:
                results[pii_type] = list(set(matches))
        return results

    def redact_pii(self, text: str) -> Tuple[str, Dict[str, List[str]]]:
        """Redact PII from text. Returns (redacted_text, detected_pii)."""
        detected = {}
        redacted = text

        for pii_type, pattern in self._patterns.items():
            matches = pattern.findall(redacted)
            if matches:
                detected[pii_type] = list(set(matches))
                for match in set(matches):
                    # Keep first 2 and last 1 chars for verification
                    if len(match) > 4:
                        masked = match[:2] + '*' * (len(match) - 3) + match[-1]
                    else:
                        masked = '*' * len(match)
                    redacted = redacted.replace(match, f"[{pii_type.upper()}: {masked}]")

        return redacted, detected

    def should_redact_for_llm(self, text: str) -> bool:
        """Check if text contains PII that should be redacted before sending to LLM."""
        pii = self.detect_pii(text)
        # Always redact PAN, Aadhaar, account numbers
        sensitive = {"pan", "aadhaar", "account_number"}
        return bool(pii.keys() & sensitive)


# ─── Output Validation ────────────────────────────────────────────

class OutputValidator:
    """Validates agent outputs for quality and safety."""

    # Patterns that indicate hallucinated legal citations
    FAKE_CITATION_PATTERNS = [
        r'(?:Section|Article|Rule)\s+\d+[A-Z]?\s+(?:of\s+the\s+)?(?:Indian|Indian\s+)?(?:Penal\s+Code|Contract\s+Act)',
        r'\d{4}\s+SC\s+\d+',
        r'\d{4}\s+AIR\s+\d+',
    ]

    def __init__(self):
        self._citation_re = re.compile('|'.join(self.FAKE_CITATION_PATTERNS), re.IGNORECASE)

    def validate_output(
        self,
        output: str,
        tool_name: str,
        input_context: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Validate an agent output.

        Returns:
            {
                "valid": bool,
                "quality_score": float (0-1),
                "issues": [str],
                "suggestions": [str],
            }
        """
        issues = []
        suggestions = []
        score = 1.0

        if not output or not output.strip():
            return {"valid": False, "quality_score": 0.0, "issues": ["Empty output"], "suggestions": ["Retry with more context"]}

        # Length check
        if len(output) < 50:
            issues.append("Output is very short — may be incomplete")
            score -= 0.2

        if len(output) > 50_000:
            issues.append("Output is very long — may need summarization")
            score -= 0.1

        # Relevance check: does output mention the input topic?
        if input_context:
            input_words = set(input_context.lower().split())
            output_words = set(output.lower().split())
            overlap = len(input_words & output_words) / max(len(input_words), 1)
            if overlap < 0.1 and len(input_words) > 5:
                issues.append("Output may not be relevant to the input")
                score -= 0.3
                suggestions.append("Check if the right tool was used for this request")

        # Disclaimer check for CA vertical
        if tool_name.startswith("ca_"):
            if "professional responsibility" not in output.lower() and "review" not in output.lower():
                suggestions.append("CA outputs should include a disclaimer about professional review")

        # Citation check for legal vertical
        if tool_name in ("document_intelligence", "research", "compliance"):
            # Flag potentially hallucinated citations
            fake_citations = self._citation_re.findall(output)
            if fake_citations:
                issues.append(f"Potentially unverifiable citations detected: {len(fake_citations)}")
                score -= 0.15
                suggestions.append("Verify all citations against actual case law databases")

        # JSON parse check for structured outputs
        if output.strip().startswith('{') or output.strip().startswith('['):
            try:
                json.loads(output)
            except json.JSONDecodeError:
                issues.append("Output appears to be malformed JSON")
                score -= 0.2

        # Safety check: no harmful content
        harmful_patterns = [
            r'\b(?:kill|murder|assault|hack|bomb)\b',
            r'\b(?:bribe|corrupt|fraud|money\s+laundering)\b',
        ]
        for pattern in harmful_patterns:
            if re.search(pattern, output, re.IGNORECASE):
                issues.append("Output may contain unsafe/inappropriate content")
                score -= 0.5

        return {
            "valid": len(issues) == 0 or score > 0.3,
            "quality_score": max(0.0, min(1.0, score)),
            "issues": issues,
            "suggestions": suggestions,
        }


# ─── Cost Tracking ────────────────────────────────────────────────

@dataclass
class CostEntry:
    timestamp: str
    firm_id: str
    tool_name: str
    tokens_used: int
    estimated_cost_usd: float


class CostTracker:
    """Track AI usage costs per firm."""

    # Approximate costs per 1K tokens (Cloudflare Workers AI)
    COST_PER_1K_TOKENS = {
        "default": 0.0011,     # Llama 4 Scout
        "power": 0.0059,       # Llama 3.3 70B
        "reasoning": 0.0038,   # DeepSeek R1
    }

    def __init__(self, budget_per_firm_usd: float = 100.0):
        self._budget = budget_per_firm_usd
        self._usage: Dict[str, List[CostEntry]] = defaultdict(list)

    def record_usage(self, firm_id: str, tool_name: str, tokens: int, tier: str = "default"):
        """Record token usage."""
        cost = (tokens / 1000) * self.COST_PER_1K_TOKENS.get(tier, 0.0011)
        entry = CostEntry(
            timestamp=datetime.now(timezone.utc).isoformat(),
            firm_id=firm_id,
            tool_name=tool_name,
            tokens_used=tokens,
            estimated_cost_usd=cost,
        )
        self._usage[firm_id].append(entry)

    def check_budget(self, firm_id: str) -> Tuple[bool, Optional[str]]:
        """Check if firm is within budget."""
        total = sum(e.estimated_cost_usd for e in self._usage.get(firm_id, []))
        if total >= self._budget:
            return False, f"Budget exceeded: ${total:.2f} / ${self._budget:.2f}"
        return True, None

    def get_usage(self, firm_id: str) -> Dict[str, Any]:
        """Get usage stats for a firm."""
        entries = self._usage.get(firm_id, [])
        total_cost = sum(e.estimated_cost_usd for e in entries)
        total_tokens = sum(e.tokens_used for e in entries)
        return {
            "total_cost_usd": round(total_cost, 4),
            "total_tokens": total_tokens,
            "budget_remaining": round(self._budget - total_cost, 4),
            "requests": len(entries),
        }


# ─── Guardrails Harness (combines all checks) ────────────────────

class GuardrailHarness:
    """
    The main guardrails harness that combines all safety checks.
    Called before and after every tool/crew execution.
    """

    def __init__(self):
        self.rate_limiter = RateLimiter()
        self.input_validator = InputValidator()
        self.pii_detector = PIIDetector()
        self.output_validator = OutputValidator()
        self.cost_tracker = CostTracker()

    def pre_execution_check(
        self,
        firm_id: str,
        user_id: str,
        tool_name: str,
        params: Dict[str, Any],
    ) -> Tuple[bool, Optional[str], Dict[str, Any]]:
        """
        Run all pre-execution checks.

        Returns: (allowed, error_reason, metadata)
        """
        metadata = {"tool": tool_name, "checks": []}

        # 1. Rate limit check
        allowed, reason = self.rate_limiter.check_rate_limit(firm_id)
        if not allowed:
            return False, reason, metadata
        metadata["checks"].append("rate_limit: pass")

        # 2. Input validation
        message = params.get("message", "")
        if message:
            valid, reason, sanitized = self.input_validator.validate_message(message)
            if not valid:
                return False, f"Input validation failed: {reason}", metadata
            params["message"] = sanitized
            metadata["checks"].append("input_validation: pass")

        # 3. Prompt injection check
        for key, value in params.items():
            if isinstance(value, str) and self.input_validator.detect_injection(value):
                return False, f"Potential prompt injection in parameter '{key}'", metadata
        metadata["checks"].append("injection_check: pass")

        # 4. PII check — redact before sending to LLM
        if message and self.pii_detector.should_redact_for_llm(message):
            redacted, pii_found = self.pii_detector.redact_pii(message)
            params["message"] = redacted
            metadata["pii_redacted"] = list(pii_found.keys())
            metadata["checks"].append("pii_redaction: applied")

        # 5. Param validation
        valid, reason = self.input_validator.validate_params(tool_name, params)
        if not valid:
            return False, f"Parameter validation failed: {reason}", metadata
        metadata["checks"].append("param_validation: pass")

        # 6. Budget check
        within_budget, reason = self.cost_tracker.check_budget(firm_id)
        if not within_budget:
            return False, reason, metadata
        metadata["checks"].append("budget: pass")

        # Record the request
        self.rate_limiter.record_request(firm_id)

        return True, None, metadata

    def post_execution_check(
        self,
        firm_id: str,
        tool_name: str,
        output: str,
        input_context: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Run post-execution validation on the output.

        Returns validation result with quality score and issues.
        """
        # Record completion
        self.rate_limiter.record_completion(firm_id)

        # Validate output
        validation = self.output_validator.validate_output(output, tool_name, input_context)

        # Record cost estimate
        tokens = len(output.split()) * 1.3  # Rough token estimate
        self.cost_tracker.record_usage(firm_id, tool_name, int(tokens))

        return validation

    def get_safety_report(self, firm_id: str) -> Dict[str, Any]:
        """Get a comprehensive safety report for a firm."""
        return {
            "rate_limits": self.rate_limiter.get_usage(firm_id),
            "costs": self.cost_tracker.get_usage(firm_id),
        }


# Global singleton
guardrails = GuardrailHarness()
