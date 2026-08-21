"""
Self-Learning Feedback Loop — Agents learn from outcomes.

Tracks:
  - Task success/failure rates per tool/crew
  - User feedback (explicit thumbs up/down, implicit re-prompts)
  - Output quality signals (completeness, relevance, accuracy)
  - Error patterns and recovery strategies

Over time, the system:
  - Adjusts planning preferences (prefer tools that work well)
  - Records failure modes for retry strategy improvement
  - Builds a firm-specific knowledge base of what works
"""
from __future__ import annotations

import json
import logging
import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class FeedbackType(str, Enum):
    EXPLICIT_POSITIVE = "explicit_positive"    # User clicked thumbs up
    EXPLICIT_NEGATIVE = "explicit_negative"    # User clicked thumbs down
    IMPLICIT_POSITIVE = "implicit_positive"    # User continued the conversation (satisfied)
    IMPLICIT_NEGATIVE = "implicit_negative"    # User rephrased/retried (dissatisfied)
    TASK_SUCCESS = "task_success"              # Step completed without error
    TASK_FAILURE = "task_failure"              # Step failed
    APPROVAL_GRANTED = "approval_granted"      # User approved a filing step
    APPROVAL_DENIED = "approval_denied"        # User denied a filing step


@dataclass
class FeedbackEntry:
    id: str
    timestamp: str
    firm_id: str
    user_id: str
    thread_id: str
    plan_id: str
    step_id: Optional[str]
    tool_or_crew: str
    feedback_type: FeedbackType
    score: float  # -1.0 to 1.0
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ToolPerformance:
    """Aggregated performance stats for a tool/crew."""
    tool_name: str
    total_calls: int = 0
    successes: int = 0
    failures: int = 0
    explicit_positive: int = 0
    explicit_negative: int = 0
    implicit_positive: int = 0
    implicit_negative: int = 0
    avg_score: float = 0.0
    last_failure_error: Optional[str] = None
    common_errors: Dict[str, int] = field(default_factory=dict)

    @property
    def success_rate(self) -> float:
        return self.successes / max(self.total_calls, 1)

    @property
    def satisfaction_rate(self) -> float:
        total = self.explicit_positive + self.explicit_negative
        return self.explicit_positive / max(total, 1)

    @property
    def composite_score(self) -> float:
        """Weighted score combining success rate and satisfaction."""
        return (self.success_rate * 0.6 + self.satisfaction_rate * 0.4)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "tool_name": self.tool_name,
            "total_calls": self.total_calls,
            "success_rate": round(self.success_rate, 3),
            "satisfaction_rate": round(self.satisfaction_rate, 3),
            "composite_score": round(self.composite_score, 3),
            "common_errors": self.common_errors,
        }


class FeedbackLoop:
    """
    Self-learning system that tracks outcomes and adjusts behavior.

    Per-firm learning: each firm's feedback is isolated.
    Cross-firm patterns: anonymized aggregate stats for global improvement.
    """

    def __init__(self):
        # firm_id -> { tool_name: ToolPerformance }
        self._performance: Dict[str, Dict[str, ToolPerformance]] = defaultdict(
            lambda: defaultdict(ToolPerformance)
        )
        # firm_id -> list of recent feedback (bounded)
        self._feedback_log: Dict[str, List[FeedbackEntry]] = defaultdict(list)
        # Global error patterns: { error_pattern: count }
        self._global_error_patterns: Dict[str, int] = defaultdict(int)
        # Firm-specific learned preferences: firm_id -> { tool: preference_score }
        self._learned_preferences: Dict[str, Dict[str, float]] = defaultdict(dict)
        self._max_feedback_per_firm = 1000

    def record_feedback(
        self,
        firm_id: str,
        user_id: str,
        thread_id: str,
        plan_id: str,
        step_id: Optional[str],
        tool_or_crew: str,
        feedback_type: FeedbackType,
        score: float = 0.0,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        """Record a feedback event."""
        entry = FeedbackEntry(
            id=f"fb_{int(time.time() * 1000)}",
            timestamp=datetime.now(timezone.utc).isoformat(),
            firm_id=firm_id,
            user_id=user_id,
            thread_id=thread_id,
            plan_id=plan_id,
            step_id=step_id,
            tool_or_crew=tool_or_crew,
            feedback_type=feedback_type,
            score=score,
            metadata=metadata or {},
        )

        # Store feedback
        self._feedback_log[firm_id].append(entry)
        if len(self._feedback_log[firm_id]) > self._max_feedback_per_firm:
            self._feedback_log[firm_id] = self._feedback_log[firm_id][-self._max_feedback_per_firm:]

        # Update performance stats
        perf = self._performance[firm_id][tool_or_crew]
        perf.tool_name = tool_or_crew
        perf.total_calls += 1

        if feedback_type == FeedbackType.TASK_SUCCESS:
            perf.successes += 1
        elif feedback_type == FeedbackType.TASK_FAILURE:
            perf.failures += 1
            error_msg = (metadata or {}).get("error", "")
            if error_msg:
                perf.last_failure_error = error_msg[:200]
                # Track error patterns
                pattern = _extract_error_pattern(error_msg)
                perf.common_errors[pattern] = perf.common_errors.get(pattern, 0) + 1
                self._global_error_patterns[pattern] += 1

        elif feedback_type == FeedbackType.EXPLICIT_POSITIVE:
            perf.explicit_positive += 1
            perf.avg_score = (perf.avg_score * (perf.total_calls - 1) + 1.0) / perf.total_calls
        elif feedback_type == FeedbackType.EXPLICIT_NEGATIVE:
            perf.explicit_negative += 1
            perf.avg_score = (perf.avg_score * (perf.total_calls - 1) + (-1.0)) / perf.total_calls
        elif feedback_type == FeedbackType.IMPLICIT_POSITIVE:
            perf.implicit_positive += 1
        elif feedback_type == FeedbackType.IMPLICIT_NEGATIVE:
            perf.implicit_negative += 1

        # Update learned preferences
        self._update_preferences(firm_id, tool_or_crew, feedback_type)

        logger.info(
            "Feedback recorded: firm=%s tool=%s type=%s score=%.2f",
            firm_id, tool_or_crew, feedback_type.value, score,
        )

    def get_tool_performance(self, firm_id: str, tool_name: Optional[str] = None) -> Dict[str, Any]:
        """Get performance stats for a tool or all tools in a firm."""
        firm_perf = self._performance.get(firm_id, {})
        if tool_name:
            perf = firm_perf.get(tool_name)
            return perf.to_dict() if perf else {"tool_name": tool_name, "total_calls": 0}
        return {name: perf.to_dict() for name, perf in firm_perf.items()}

    def get_recommended_tool(self, firm_id: str, candidate_tools: List[str]) -> Optional[str]:
        """Among candidate tools, recommend the one with the best composite score."""
        firm_perf = self._performance.get(firm_id, {})
        best_tool = None
        best_score = -1.0

        for tool in candidate_tools:
            perf = firm_perf.get(tool)
            if perf and perf.total_calls >= 3:  # Need minimum data
                score = perf.composite_score
                # Boost tools this firm has had good experience with
                learned = self._learned_preferences.get(firm_id, {}).get(tool, 0)
                score += learned * 0.2
                if score > best_score:
                    best_score = score
                    best_tool = tool

        return best_tool

    def get_error_patterns(self, firm_id: Optional[str] = None, top_n: int = 10) -> List[Dict[str, Any]]:
        """Get the most common error patterns."""
        if firm_id:
            # Firm-specific errors
            firm_perf = self._performance.get(firm_id, {})
            patterns = defaultdict(int)
            for perf in firm_perf.values():
                for pattern, count in perf.common_errors.items():
                    patterns[pattern] += count
        else:
            patterns = self._global_error_patterns

        sorted_patterns = sorted(patterns.items(), key=lambda x: x[1], reverse=True)[:top_n]
        return [{"pattern": p, "count": c} for p, c in sorted_patterns]

    def get_learning_summary(self, firm_id: str) -> Dict[str, Any]:
        """Get a summary of what the system has learned for a firm."""
        firm_perf = self._performance.get(firm_id, {})
        firm_prefs = self._learned_preferences.get(firm_id, {})
        firm_feedback = self._feedback_log.get(firm_id, [])

        total_calls = sum(p.total_calls for p in firm_perf.values())
        total_successes = sum(p.successes for p in firm_perf.values())
        total_explicit = sum(p.explicit_positive + p.explicit_negative for p in firm_perf.values())

        # Find best and worst tools
        tools_by_score = sorted(
            [(name, p.composite_score) for name, p in firm_perf.items() if p.total_calls >= 3],
            key=lambda x: x[1], reverse=True,
        )

        return {
            "firm_id": firm_id,
            "total_interactions": total_calls,
            "overall_success_rate": round(total_successes / max(total_calls, 1), 3),
            "explicit_feedback_count": total_explicit,
            "best_tools": tools_by_score[:3],
            "worst_tools": tools_by_score[-3:] if len(tools_by_score) > 3 else [],
            "learned_preferences": firm_prefs,
            "recent_feedback_count": len(firm_feedback),
        }

    def detect_regressions(self, firm_id: str, window_hours: int = 24) -> List[Dict[str, Any]]:
        """Detect if any tool's performance has degraded recently."""
        regressions = []
        firm_perf = self._performance.get(firm_id, {})
        now = time.time()

        for tool_name, perf in firm_perf.items():
            if perf.total_calls < 5:
                continue

            # Check recent failure rate
            recent_feedback = [
                f for f in self._feedback_log.get(firm_id, [])
                if f.tool_or_crew == tool_name
                and (now - _parse_timestamp(f.timestamp)) < window_hours * 3600
            ]

            if len(recent_feedback) < 3:
                continue

            recent_failures = sum(
                1 for f in recent_feedback
                if f.feedback_type in (FeedbackType.TASK_FAILURE, FeedbackType.EXPLICIT_NEGATIVE)
            )
            recent_rate = recent_failures / len(recent_feedback)

            if recent_rate > 0.5 and perf.success_rate > 0.7:
                regressions.append({
                    "tool": tool_name,
                    "overall_success_rate": round(perf.success_rate, 3),
                    "recent_failure_rate": round(recent_rate, 3),
                    "recent_samples": len(recent_feedback),
                    "last_error": perf.last_failure_error,
                })

        return regressions

    def _update_preferences(self, firm_id: str, tool: str, feedback_type: FeedbackType):
        """Update learned preferences based on feedback."""
        prefs = self._learned_preferences[firm_id]
        current = prefs.get(tool, 0.0)

        if feedback_type in (FeedbackType.EXPLICIT_POSITIVE, FeedbackType.TASK_SUCCESS):
            prefs[tool] = min(current + 0.1, 1.0)
        elif feedback_type in (FeedbackType.EXPLICIT_NEGATIVE, FeedbackType.TASK_FAILURE):
            prefs[tool] = max(current - 0.15, -1.0)
        elif feedback_type == FeedbackType.IMPLICIT_POSITIVE:
            prefs[tool] = min(current + 0.05, 1.0)
        elif feedback_type == FeedbackType.IMPLICIT_NEGATIVE:
            prefs[tool] = max(current - 0.05, -1.0)


def _extract_error_pattern(error_msg: str) -> str:
    """Extract a reusable error pattern from an error message."""
    import re
    # Remove specific IDs, numbers, timestamps
    normalized = re.sub(r'\b[0-9a-f]{8,}\b', '<ID>', error_msg)
    normalized = re.sub(r'\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}', '<TIMESTAMP>', normalized)
    normalized = re.sub(r'\b\d+\b', '<N>', normalized)
    # Truncate
    return normalized[:150]


def _parse_timestamp(ts: str) -> float:
    """Parse ISO timestamp to epoch seconds."""
    try:
        from datetime import datetime
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        return dt.timestamp()
    except Exception:
        return 0.0


# Global singleton
feedback_loop = FeedbackLoop()
