"""
Audit Trail Agent — records every AI action for compliance and review.

Every AI operation (document analysis, draft generation, knowledge query, etc.)
is logged with: who did it, what document/matter, which model, what sources were
retrieved, and what output was generated. This is required for legal/compliance.
"""

import json
import hashlib
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from enum import Enum


class AuditAction(str, Enum):
    DOCUMENT_UPLOADED = "document_uploaded"
    DOCUMENT_PARSED = "document_parsed"
    DOCUMENT_CHUNKED = "document_chunked"
    DOCUMENT_EMBEDDED = "document_embedded"
    DOCUMENT_INDEXED = "document_indexed"
    CONTRACT_ANALYSIS_STARTED = "contract_analysis_started"
    CONTRACT_ANALYSIS_COMPLETED = "contract_analysis_completed"
    CLAUSES_EXTRACTED = "clauses_extracted"
    PLAYBOOK_EVALUATED = "playbook_evaluated"
    RESEARCH_STARTED = "research_started"
    RESEARCH_COMPLETED = "research_completed"
    DRAFT_GENERATED = "draft_generated"
    DRAFT_FINALIZED = "draft_finalized"
    KB_QUERY_EXECUTED = "kb_query_executed"
    MEETING_PROCESSED = "meeting_processed"
    MEETING_ACTION_ITEMS_EXTRACTED = "meeting_action_items_extracted"
    RETRIEVAL_PERFORMED = "retrieval_performed"
    QUALITY_GATE_CHECKED = "quality_gate_checked"
    OUTPUT_DELIVERED = "output_delivered"
    ACCESS_DENIED = "access_denied"
    ERROR_OCCURRED = "error_occurred"


@dataclass
class AuditEntry:
    id: str
    timestamp: str
    action: AuditAction
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    firm_id: Optional[str] = None
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    matter_id: Optional[str] = None
    model_used: Optional[str] = None
    sources: List[str] = field(default_factory=list)
    input_hash: Optional[str] = None  # SHA-256 of input (for privacy — no raw content)
    output_hash: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    ip_address: Optional[str] = None
    duration_ms: Optional[int] = None
    success: bool = True
    error_message: Optional[str] = None


class AuditTrailAgent:
    """
    Immutable, append-only audit log for all AI actions.
    
    In production, this writes to the AuditLog table in Postgres.
    For MVP, entries are stored in memory and can be flushed to DB.
    """

    def __init__(self):
        self._entries: List[AuditEntry] = []
        self._observers: List[callable] = []

    def subscribe(self, observer: callable):
        """Register a callback that fires on every new audit entry."""
        self._observers.append(observer)

    def log(
        self,
        action: AuditAction,
        user_id: Optional[str] = None,
        user_name: Optional[str] = None,
        firm_id: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        matter_id: Optional[str] = None,
        model_used: Optional[str] = None,
        sources: Optional[List[str]] = None,
        input_content: Optional[str] = None,
        output_content: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        duration_ms: Optional[int] = None,
        success: bool = True,
        error_message: Optional[str] = None,
    ) -> AuditEntry:
        """Create an immutable audit log entry."""

        entry = AuditEntry(
            id=f"audit-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{hashlib.sha256(str(len(self._entries)).encode()).hexdigest()[:8]}",
            timestamp=datetime.now(timezone.utc).isoformat(),
            action=action,
            user_id=user_id,
            user_name=user_name,
            firm_id=firm_id,
            resource_type=resource_type,
            resource_id=resource_id,
            matter_id=matter_id,
            model_used=model_used,
            sources=sources or [],
            input_hash=hashlib.sha256(input_content.encode()).hexdigest() if input_content else None,
            output_hash=hashlib.sha256(output_content.encode()).hexdigest() if output_content else None,
            metadata=metadata or {},
            ip_address=ip_address,
            duration_ms=duration_ms,
            success=success,
            error_message=error_message,
        )

        self._entries.append(entry)

        # Notify observers (e.g., DB writer, monitoring)
        for observer in self._observers:
            try:
                observer(entry)
            except Exception:
                pass  # Observer failures shouldn't block audit logging

        return entry

    def query(
        self,
        user_id: Optional[str] = None,
        firm_id: Optional[str] = None,
        action: Optional[AuditAction] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        since: Optional[str] = None,
        until: Optional[str] = None,
        success_only: Optional[bool] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[AuditEntry]:
        """Query the audit log with filters."""
        results = self._entries

        if user_id:
            results = [e for e in results if e.user_id == user_id]
        if firm_id:
            results = [e for e in results if e.firm_id == firm_id]
        if action:
            results = [e for e in results if e.action == action]
        if resource_type:
            results = [e for e in results if e.resource_type == resource_type]
        if resource_id:
            results = [e for e in results if e.resource_id == resource_id]
        if since:
            results = [e for e in results if e.timestamp >= since]
        if until:
            results = [e for e in results if e.timestamp <= until]
        if success_only is not None:
            results = [e for e in results if e.success == success_only]

        return results[offset : offset + limit]

    def get_stats(self, firm_id: Optional[str] = None) -> Dict[str, Any]:
        """Get aggregate audit statistics."""
        entries = [e for e in self._entries if not firm_id or e.firm_id == firm_id]

        action_counts: Dict[str, int] = {}
        for e in entries:
            action_counts[e.action.value] = action_counts.get(e.action.value, 0) + 1

        return {
            "total_entries": len(entries),
            "successful": sum(1 for e in entries if e.success),
            "failed": sum(1 for e in entries if not e.success),
            "by_action": action_counts,
            "oldest_entry": entries[0].timestamp if entries else None,
            "newest_entry": entries[-1].timestamp if entries else None,
        }

    def to_dict_list(self, entries: List[AuditEntry]) -> List[Dict[str, Any]]:
        """Convert audit entries to JSON-serializable dicts."""
        return [
            {
                "id": e.id,
                "timestamp": e.timestamp,
                "action": e.action.value,
                "user_id": e.user_id,
                "user_name": e.user_name,
                "firm_id": e.firm_id,
                "resource_type": e.resource_type,
                "resource_id": e.resource_id,
                "matter_id": e.matter_id,
                "model_used": e.model_used,
                "sources": e.sources,
                "duration_ms": e.duration_ms,
                "success": e.success,
                "error_message": e.error_message,
            }
            for e in entries
        ]


# Global singleton
audit_trail = AuditTrailAgent()
