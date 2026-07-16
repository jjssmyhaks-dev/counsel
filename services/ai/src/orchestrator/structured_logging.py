"""Structured logging for CrewAI agent/crew execution.

Replaces print() statements with structured JSON logs that capture:
- Timestamp, crew name, agent name, task description
- Token usage per agent turn
- Timing (duration_ms per task)
- Input/output hashes for audit trail linking
- Error traces with stack context

Also provides a CrewAI callback hook that auto-captures metrics.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional

# ── Structured JSON Logger ──────────────────────────────────────

LOG_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "logs")
MAX_SIZE = 10 * 1024 * 1024

_logger = logging.getLogger("counsel.crew")


def _get_log_path() -> str:
    os.makedirs(LOG_DIR, exist_ok=True)
    return os.path.join(LOG_DIR, f"crew-{datetime.now(tz=timezone.utc).strftime('%Y-%m-%d')}.jsonl")


def _rotate(path: str) -> None:
    if not os.path.exists(path) or os.path.getsize(path) < MAX_SIZE:
        return
    ts = datetime.now(tz=timezone.utc).strftime("%Y%m%d%H%M%S")
    os.rename(path, f"{os.path.splitext(path)[0]}-{ts}.jsonl")


def write_event(entry: Dict[str, Any]) -> None:
    """Write one structured log event to JSONL."""
    path = _get_log_path()
    _rotate(path)
    entry.setdefault("timestamp", datetime.now(tz=timezone.utc).isoformat())
    try:
        with open(path, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, default=str) + "\n")
    except Exception:
        pass  # Logging must not crash the service


# ── CrewAI Callback Hook ─────────────────────────────────────────

class CrewMetrics:
    """Captures per-task metrics for CrewAI callback integration."""

    def __init__(self):
        self.task_start_times: Dict[str, float] = {}
        self.task_token_usage: Dict[str, Dict[str, int]] = {}
        self.crew_name = "unknown"

    def on_task_start(self, task, crew_name: str = ""):
        """Called before a task is executed."""
        self.crew_name = crew_name or "unknown"
        task_id = getattr(task, "description", str(task))[:60]
        self.task_start_times[task_id] = time.time()
        write_event({
            "event": "task_start",
            "crew": self.crew_name,
            "task": task_id,
            "agent": getattr(task, "agent", {}).get("role", "") if hasattr(task, "agent") else "",
        })

    def on_task_complete(self, task, output: Any, crew_name: str = ""):
        """Called after a task completes successfully."""
        task_id = getattr(task, "description", str(task))[:60]
        start = self.task_start_times.pop(task_id, time.time())
        duration_ms = int((time.time() - start) * 1000)

        # Extract token usage if available on output
        token_info = {}
        if hasattr(output, "token_usage") and output.token_usage:
            token_info = dict(output.token_usage)

        output_str = output.raw if hasattr(output, "raw") else str(output)
        output_hash = hashlib.sha256(output_str.encode()).hexdigest()[:16]

        write_event({
            "event": "task_complete",
            "crew": crew_name or self.crew_name,
            "task": task_id,
            "duration_ms": duration_ms,
            "token_usage": token_info,
            "output_hash": output_hash,
            "output_length": len(output_str),
        })

    def on_task_error(self, task, error: Exception, crew_name: str = ""):
        """Called when a task fails."""
        task_id = getattr(task, "description", str(task))[:60]
        write_event({
            "event": "task_error",
            "crew": crew_name or self.crew_name,
            "task": task_id,
            "error": str(error),
            "error_type": type(error).__name__,
        })

    def on_crew_complete(self, crew_name: str, total_tokens: Dict[str, int]):
        """Called when an entire crew finishes."""
        write_event({
            "event": "crew_complete",
            "crew": crew_name,
            "total_tokens": total_tokens,
        })


# Shared instance
metrics = CrewMetrics()


# ── CrewAI Step Callback Wrapper ─────────────────────────────────

def create_step_callback(crew_name: str):
    """Return a step_callback function for CrewAI Task(step_callback=...).

    Usage:
        task = Task(..., step_callback=create_step_callback("document_intelligence"))
    """
    def step_callback(agent_output):
        write_event({
            "event": "agent_step",
            "crew": crew_name,
            "agent": getattr(agent_output, "role", "unknown"),
            "text_length": len(str(agent_output)),
        })
    return step_callback
