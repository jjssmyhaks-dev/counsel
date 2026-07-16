"""CrewAI audit trail persistence — structured JSON log file.

Watches the in-memory AuditTrailAgent and flushes entries to a rotating
JSON log file on disk. Each line is a JSON object with all audit fields.
File rotates at 10 MB. Log files are stored in the service's logs/ directory.
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

LOG_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "logs")
MAX_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


def get_log_path() -> str:
    """Return the current audit log file path (rotated by date)."""
    os.makedirs(LOG_DIR, exist_ok=True)
    today = datetime.utcnow().strftime("%Y-%m-%d")
    return os.path.join(LOG_DIR, f"audit-{today}.jsonl")


def _rotate_if_needed(path: str) -> None:
    """Rotate the log file if it exceeds MAX_SIZE_BYTES."""
    if not os.path.exists(path):
        return
    if os.path.getsize(path) < MAX_SIZE_BYTES:
        return

    base, ext = os.path.splitext(path)
    ts = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    rotated = f"{base}-{ts}{ext}"
    os.rename(path, rotated)
    logger.info("Rotated audit log: %s → %s", path, rotated)


def write_audit_entry(entry: Any) -> None:
    """Append a single audit entry to the JSONL log file.

    Designed to be used as an AuditTrailAgent observer:
        audit_trail.subscribe(write_audit_entry)
    """
    path = get_log_path()
    _rotate_if_needed(path)

    # Convert dataclass to dict
    if hasattr(entry, "__dataclass_fields__"):
        record = {
            "id": entry.id,
            "timestamp": entry.timestamp,
            "action": entry.action.value if hasattr(entry.action, "value") else str(entry.action),
            "user_id": entry.user_id,
            "user_name": entry.user_name,
            "firm_id": entry.firm_id,
            "resource_type": entry.resource_type,
            "resource_id": entry.resource_id,
            "matter_id": entry.matter_id,
            "model_used": entry.model_used,
            "sources": getattr(entry, "sources", []),
            "input_hash": getattr(entry, "input_hash", None),
            "output_hash": getattr(entry, "output_hash", None),
            "duration_ms": entry.duration_ms,
            "success": entry.success,
            "error_message": entry.error_message,
            "metadata": getattr(entry, "metadata", {}),
        }
    else:
        record = entry

    try:
        with open(path, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, default=str) + "\n")
    except Exception as e:
        logger.error("Failed to write audit entry: %s", e)


def read_audit_log(path: Optional[str] = None, limit: int = 100) -> list:
    """Read audit entries from a JSONL log file (newest first)."""
    path = path or get_log_path()
    if not os.path.exists(path):
        return []

    entries = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    entries.append(json.loads(line))
                except json.JSONDecodeError:
                    pass

    return entries[-limit:]


def setup_audit_persistence(audit_trail_agent) -> None:
    """Wire the audit trail singleton to persist entries to disk.

    Call once at service startup:
        from src.orchestrator.audit_agent import audit_trail
        from src.orchestrator.audit_persistence import setup_audit_persistence
        setup_audit_persistence(audit_trail)
    """
    audit_trail_agent.subscribe(write_audit_entry)
    logger.info("Audit trail persistence enabled → %s", get_log_path())
