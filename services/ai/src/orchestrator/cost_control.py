"""
AI Cost Control — Token budgets, usage tracking, circuit breakers.

Prevents any single firm from exceeding their AI budget.
Tracks token usage per tool/crew and enforces limits.
"""
from __future__ import annotations

import logging
import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger(__name__)


# ─── Pricing per 1K tokens (Cloudflare Workers AI) ───────────────
MODEL_COSTS = {
    "@cf/meta/llama-4-scout-17b-16e-instruct": 0.0011,
    "@cf/meta/llama-3.3-70b-instruct-fp8-fast": 0.0059,
    "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b": 0.0038,
}

# ─── Default budgets per plan ────────────────────────────────────
PLAN_BUDGETS = {
    "free":       {"tokens_per_month": 10_000,   "cost_per_month_usd": 0.01,   "max_concurrent": 1},
    "starter":    {"tokens_per_month": 50_000,   "cost_per_month_usd": 0.05,   "max_concurrent": 2},
    "professional": {"tokens_per_month": 500_000, "cost_per_month_usd": 0.50,  "max_concurrent": 5},
    "business":   {"tokens_per_month": 2_000_000, "cost_per_month_usd": 2.00,  "max_concurrent": 10},
    "enterprise": {"tokens_per_month": 10_000_000, "cost_per_month_usd": 10.00, "max_concurrent": 50},
}


@dataclass
class FirmUsage:
    """Track AI usage for a single firm."""
    firm_id: str
    plan: str = "free"
    tokens_used_this_month: int = 0
    cost_usd_this_month: float = 0.0
    requests_today: int = 0
    concurrent_requests: int = 0
    circuit_breaker_open: bool = False
    circuit_breaker_until: Optional[float] = None
    last_error: Optional[str] = None
    error_count_1h: int = 0
    error_window_start: float = 0.0

    @property
    def budget(self) -> Dict[str, Any]:
        return PLAN_BUDGETS.get(self.plan, PLAN_BUDGETS["free"])

    @property
    def tokens_remaining(self) -> int:
        return max(0, self.budget["tokens_per_month"] - self.tokens_used_this_month)

    @property
    def cost_remaining(self) -> float:
        return max(0.0, self.budget["cost_per_month_usd"] - self.cost_usd_this_month)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "firm_id": self.firm_id,
            "plan": self.plan,
            "tokens_used": self.tokens_used_this_month,
            "tokens_budget": self.budget["tokens_per_month"],
            "tokens_remaining": self.tokens_remaining,
            "cost_usd": round(self.cost_usd_this_month, 4),
            "cost_budget": self.budget["cost_per_month_usd"],
            "cost_remaining": round(self.cost_remaining, 4),
            "requests_today": self.requests_today,
            "concurrent": self.concurrent_requests,
            "circuit_breaker": self.circuit_breaker_open,
        }


class CostController:
    """
    Enforces AI cost controls per firm.

    Checks before every LLM call:
    1. Token budget not exceeded
    2. Cost budget not exceeded
    3. Circuit breaker not open (too many errors)
    4. Concurrency limit not reached
    5. Daily request limit
    """

    def __init__(self):
        self._firms: Dict[str, FirmUsage] = {}
        self._daily_requests: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))

    def get_usage(self, firm_id: str, plan: str = "free") -> FirmUsage:
        """Get or create usage tracker for a firm."""
        if firm_id not in self._firms:
            self._firms[firm_id] = FirmUsage(firm_id=firm_id, plan=plan)
        usage = self._firms[firm_id]
        usage.plan = plan
        return usage

    def check_allowed(
        self, firm_id: str, plan: str = "free", estimated_tokens: int = 500
    ) -> Tuple[bool, Optional[str], Dict[str, Any]]:
        """
        Check if a request is allowed within budget.

        Returns: (allowed, reason, usage_stats)
        """
        usage = self.get_usage(firm_id, plan)
        budget = usage.budget

        # 1. Circuit breaker check
        now = time.time()
        if usage.circuit_breaker_open:
            if usage.circuit_breaker_until and now < usage.circuit_breaker_until:
                remaining = int(usage.circuit_breaker_until - now)
                return False, f"Circuit breaker open. Retry in {remaining}s", usage.to_dict()
            else:
                usage.circuit_breaker_open = False
                usage.error_count_1h = 0

        # 2. Token budget check
        if usage.tokens_used_this_month + estimated_tokens > budget["tokens_per_month"]:
            return False, f"Monthly token budget exceeded ({usage.tokens_used_this_month}/{budget['tokens_per_month']})", usage.to_dict()

        # 3. Cost budget check
        estimated_cost = (estimated_tokens / 1000) * 0.003  # Average cost
        if usage.cost_usd_this_month + estimated_cost > budget["cost_per_month_usd"]:
            return False, f"Monthly cost budget exceeded (${usage.cost_usd_this_month:.4f}/${budget['cost_per_month_usd']:.2f})", usage.to_dict()

        # 4. Concurrency check
        if usage.concurrent_requests >= budget["max_concurrent"]:
            return False, f"Concurrent request limit ({budget['max_concurrent']}) reached", usage.to_dict()

        # 5. Daily request limit (10x tokens_per_month / 30 / 1000 as rough proxy)
        daily_limit = max(50, budget["tokens_per_month"] // 3000)
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        if self._daily_requests[firm_id][today] >= daily_limit:
            return False, f"Daily request limit ({daily_limit}) reached", usage.to_dict()

        return True, None, usage.to_dict()

    def record_request(
        self, firm_id: str, tokens_in: int, tokens_out: int,
        model: str = "", status: str = "success"
    ):
        """Record a completed request."""
        usage = self._firms.get(firm_id)
        if not usage:
            return

        total_tokens = tokens_in + tokens_out
        cost = (total_tokens / 1000) * MODEL_COSTS.get(model, 0.003)

        usage.tokens_used_this_month += total_tokens
        usage.cost_usd_this_month += cost
        usage.concurrent_requests = max(0, usage.concurrent_requests - 1)

        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        self._daily_requests[firm_id][today] += 1

        if status == "success":
            usage.error_count_1h = 0
        else:
            # Track errors for circuit breaker
            if usage.error_window_start == 0 or (time.time() - usage.error_window_start) > 3600:
                usage.error_window_start = time.time()
                usage.error_count_1h = 0
            usage.error_count_1h += 1

            # Open circuit breaker after 5 errors in 1 hour
            if usage.error_count_1h >= 5:
                usage.circuit_breaker_open = True
                usage.circuit_breaker_until = time.time() + 300  # 5 minutes
                logger.warning("Circuit breaker OPENED for firm %s after %d errors", firm_id, usage.error_count_1h)

    def record_start(self, firm_id: str):
        """Record start of a request (increment concurrency)."""
        usage = self.get_usage(firm_id)
        usage.concurrent_requests += 1

    def get_all_usage(self) -> Dict[str, Dict[str, Any]]:
        """Get usage stats for all firms."""
        return {fid: usage.to_dict() for fid, usage in self._firms.items()}

    def reset_monthly(self):
        """Reset monthly counters (call on 1st of month)."""
        for usage in self._firms.values():
            usage.tokens_used_this_month = 0
            usage.cost_usd_this_month = 0


# Global singleton
cost_controller = CostController()
