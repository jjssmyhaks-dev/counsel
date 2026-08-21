"""
Eval Framework — Quality scoring, regression detection, benchmarking.

Measures:
  - Response quality (relevance, completeness, accuracy)
  - Task completion rate
  - User satisfaction signals
  - Cross-firm benchmarking
  - Regression detection over time

Stores eval results for historical analysis and improvement tracking.
"""
from __future__ import annotations

import json
import logging
import re
import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class EvalDimension(str, Enum):
    RELEVANCE = "relevance"          # Does the output address the query?
    COMPLETENESS = "completeness"    # Does it cover all aspects?
    ACCURACY = "accuracy"            # Are facts/legal citations correct?
    SAFETY = "safety"                # Does it avoid harmful content?
    USABILITY = "usability"          # Is it actionable and clear?
    LATENCY = "latency"              # How fast was the response?


@dataclass
class EvalResult:
    id: str
    timestamp: str
    firm_id: str
    plan_id: str
    tool_name: str
    scores: Dict[str, float]  # dimension -> 0.0-1.0
    overall_score: float
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "tool_name": self.tool_name,
            "scores": self.scores,
            "overall_score": round(self.overall_score, 3),
        }


@dataclass
class EvalBenchmark:
    """Aggregated eval stats for a tool across a time period."""
    tool_name: str
    period: str  # "day", "week", "month"
    sample_count: int = 0
    avg_scores: Dict[str, float] = field(default_factory=dict)
    overall_avg: float = 0.0
    p50_score: float = 0.0
    p95_score: float = 0.0
    regression_detected: bool = False


class EvalFramework:
    """
    Evaluates agent outputs on multiple dimensions.

    Two evaluation modes:
    1. Heuristic evals (fast, no LLM call) — length, structure, relevance checks
    2. LLM-as-judge evals (accurate, uses LLM) — quality, accuracy, completeness
    """

    def __init__(self, use_llm_judge: bool = True):
        self._use_llm_judge = use_llm_judge
        self._results: Dict[str, List[EvalResult]] = defaultdict(list)  # firm_id -> results
        self._max_results_per_firm = 500

    def evaluate(
        self,
        firm_id: str,
        plan_id: str,
        tool_name: str,
        input_text: str,
        output_text: str,
        execution_time_ms: int = 0,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> EvalResult:
        """
        Evaluate an agent output on multiple dimensions.

        Returns EvalResult with scores for each dimension.
        """
        scores = {}

        # 1. Heuristic evaluations (always run, fast)
        scores.update(self._heuristic_eval(input_text, output_text, execution_time_ms))

        # 2. LLM-as-judge (if enabled, more accurate)
        if self._use_llm_judge and len(output_text) > 100:
            llm_scores = self._llm_judge_eval(input_text, output_text, tool_name)
            # Blend heuristic and LLM scores (LLM takes precedence when available)
            for dim, score in llm_scores.items():
                scores[dim] = score

        # 3. Calculate overall score
        weights = {
            "relevance": 0.25,
            "completeness": 0.20,
            "accuracy": 0.25,
            "safety": 0.15,
            "usability": 0.15,
        }
        overall = sum(scores.get(dim, 0.5) * w for dim, w in weights.items())

        result = EvalResult(
            id=f"eval_{int(time.time() * 1000)}",
            timestamp=datetime.now(timezone.utc).isoformat(),
            firm_id=firm_id,
            plan_id=plan_id,
            tool_name=tool_name,
            scores=scores,
            overall_score=overall,
            metadata=metadata or {},
        )

        # Store
        self._results[firm_id].append(result)
        if len(self._results[firm_id]) > self._max_results_per_firm:
            self._results[firm_id] = self._results[firm_id][-self._max_results_per_firm:]

        logger.info(
            "Eval: firm=%s tool=%s overall=%.3f scores=%s",
            firm_id, tool_name, overall, json.dumps({k: round(v, 2) for k, v in scores.items()}),
        )

        return result

    def _heuristic_eval(
        self, input_text: str, output_text: str, execution_time_ms: int
    ) -> Dict[str, float]:
        """Fast heuristic-based evaluation."""
        scores = {}

        # Relevance: word overlap between input and output
        input_words = set(input_text.lower().split())
        output_words = set(output_text.lower().split())
        if input_words:
            overlap = len(input_words & output_words) / len(input_words)
            scores["relevance"] = min(1.0, overlap * 2)  # Boost since partial overlap is good

        # Completeness: length-based heuristic
        if len(output_text) > 1000:
            scores["completeness"] = 0.9
        elif len(output_text) > 300:
            scores["completeness"] = 0.7
        elif len(output_text) > 100:
            scores["completeness"] = 0.5
        else:
            scores["completeness"] = 0.3

        # Safety: check for harmful content
        harmful = re.search(r'\b(?:kill|murder|hack|bomb|bribe)\b', output_text, re.IGNORECASE)
        scores["safety"] = 0.2 if harmful else 0.9

        # Usability: check for structure (headings, lists, code blocks)
        has_structure = bool(re.search(r'(?:^|\n)[#*\-1]', output_text))
        scores["usability"] = 0.8 if has_structure else 0.5

        # Latency
        if execution_time_ms < 5000:
            scores["latency"] = 1.0
        elif execution_time_ms < 15000:
            scores["latency"] = 0.7
        elif execution_time_ms < 30000:
            scores["latency"] = 0.4
        else:
            scores["latency"] = 0.2

        return scores

    def _llm_judge_eval(
        self, input_text: str, output_text: str, tool_name: str
    ) -> Dict[str, float]:
        """Use LLM to evaluate output quality (more accurate but slower)."""
        try:
            from ..agents.cloudflare_llm import get_default_llm

            judge_prompt = f"""You are an expert evaluator for a legal/consulting/CA AI platform.
Evaluate the following AI output on these dimensions (0.0 to 1.0 each):

INPUT/QUERY: {input_text[:2000]}

AI OUTPUT (tool: {tool_name}): {output_text[:3000]}

Rate each dimension:
- relevance: Does the output address the query?
- completeness: Does it cover all necessary aspects?
- accuracy: Are facts/legal references correct? (assume they are unless obviously wrong)
- usability: Is it well-structured, clear, and actionable?

Respond with ONLY a JSON object:
{{"relevance": 0.0-1.0, "completeness": 0.0-1.0, "accuracy": 0.0-1.0, "usability": 0.0-1.0}}"""

            llm = get_default_llm(temperature=0.1)
            response = llm.call([
                {"role": "system", "content": "You are a strict, calibrated evaluator. Respond only with JSON."},
                {"role": "user", "content": judge_prompt},
            ])

            if not response:
                return {}

            # Parse JSON from response
            json_match = re.search(r'\{[^{}]*\}', response)
            if json_match:
                scores = json.loads(json_match.group())
                # Validate range
                return {
                    k: max(0.0, min(1.0, float(v)))
                    for k, v in scores.items()
                    if k in ("relevance", "completeness", "accuracy", "usability")
                }

        except Exception as e:
            logger.warning("LLM judge eval failed: %s", e)

        return {}

    def get_benchmarks(
        self, firm_id: str, period: str = "week"
    ) -> List[EvalBenchmark]:
        """Get aggregated eval benchmarks for a firm."""
        results = self._results.get(firm_id, [])
        now = time.time()

        # Filter by period
        period_seconds = {"day": 86400, "week": 604800, "month": 2592000}.get(period, 604800)
        recent = [r for r in results if (now - _parse_ts(r.timestamp)) < period_seconds]

        # Group by tool
        by_tool: Dict[str, List[EvalResult]] = defaultdict(list)
        for r in recent:
            by_tool[r.tool_name].append(r)

        benchmarks = []
        for tool_name, tool_results in by_tool.items():
            scores_list = [r.scores for r in tool_results]
            overall_list = [r.overall_score for r in tool_results]

            avg_scores = {}
            for dim in ["relevance", "completeness", "accuracy", "safety", "usability", "latency"]:
                dim_scores = [s.get(dim, 0.5) for s in scores_list]
                avg_scores[dim] = round(sum(dim_scores) / max(len(dim_scores), 1), 3)

            sorted_overall = sorted(overall_list)
            p50_idx = len(sorted_overall) // 2
            p95_idx = int(len(sorted_overall) * 0.95)

            benchmarks.append(EvalBenchmark(
                tool_name=tool_name,
                period=period,
                sample_count=len(tool_results),
                avg_scores=avg_scores,
                overall_avg=round(sum(overall_list) / max(len(overall_list), 1), 3),
                p50_score=round(sorted_overall[p50_idx], 3) if sorted_overall else 0,
                p95_score=round(sorted_overall[min(p95_idx, len(sorted_overall) - 1)], 3) if sorted_overall else 0,
            ))

        return sorted(benchmarks, key=lambda b: b.overall_avg, reverse=True)

    def detect_regressions(self, firm_id: str) -> List[Dict[str, Any]]:
        """Compare recent eval scores against historical baseline."""
        results = self._results.get(firm_id, [])
        if len(results) < 20:
            return []

        now = time.time()
        recent = [r for r in results if (now - _parse_ts(r.timestamp)) < 86400]
        baseline = [r for r in results if (now - _parse_ts(r.timestamp)) >= 86400]

        if len(recent) < 5 or len(baseline) < 10:
            return []

        regressions = []
        recent_avg = sum(r.overall_score for r in recent) / len(recent)
        baseline_avg = sum(r.overall_score for r in baseline) / len(baseline)

        if recent_avg < baseline_avg * 0.85:  # 15% regression threshold
            regressions.append({
                "type": "overall_quality",
                "recent_avg": round(recent_avg, 3),
                "baseline_avg": round(baseline_avg, 3),
                "regression_pct": round((1 - recent_avg / baseline_avg) * 100, 1),
                "recent_samples": len(recent),
                "baseline_samples": len(baseline),
            })

        return regressions

    def get_quality_report(self, firm_id: str) -> Dict[str, Any]:
        """Get a comprehensive quality report."""
        benchmarks = self.get_benchmarks(firm_id, "week")
        regressions = self.detect_regressions(firm_id)
        results = self._results.get(firm_id, [])

        return {
            "total_evaluations": len(results),
            "benchmarks": [b.__dict__ for b in benchmarks],
            "regressions": regressions,
            "overall_quality_trend": self._compute_trend(results),
        }

    def _compute_trend(self, results: List[EvalResult]) -> str:
        """Compute quality trend: improving, stable, or declining."""
        if len(results) < 10:
            return "insufficient_data"

        recent_5 = sum(r.overall_score for r in results[-5:]) / 5
        prev_5 = sum(r.overall_score for r in results[-10:-5]) / 5

        if recent_5 > prev_5 + 0.05:
            return "improving"
        elif recent_5 < prev_5 - 0.05:
            return "declining"
        return "stable"


def _parse_ts(ts: str) -> float:
    """Parse ISO timestamp to epoch seconds."""
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        return dt.timestamp()
    except Exception:
        return 0.0


# Global singleton
eval_framework = EvalFramework()
