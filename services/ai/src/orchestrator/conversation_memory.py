"""
Conversation Memory — Thread-scoped memory for multi-turn chat.

Stores:
  - Message history per thread (user + assistant + tool calls)
  - Extracted entities (matters, documents, clients, deadlines)
  - Task context (what was done, what's pending)
  - User preferences (learned from conversation)

Storage: In-memory dict with optional Postgres persistence.
Each firm's threads are fully isolated (tenant-scoped).
"""
from __future__ import annotations

import json
import logging
import time
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ─── Data Models ────────────────────────────────────────────────


@dataclass
class ChatMessage:
    id: str
    role: str  # "user", "assistant", "tool", "system"
    content: str
    timestamp: str
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "role": self.role,
            "content": self.content,
            "timestamp": self.timestamp,
            "metadata": self.metadata,
        }


@dataclass
class TaskContext:
    """Tracks what autonomous tasks have been executed in this thread."""
    task_id: str
    task_type: str  # "crew", "mcp_tool", "pipeline"
    tool_name: str
    status: str  # "pending", "running", "completed", "failed"
    started_at: str
    completed_at: Optional[str] = None
    result_summary: Optional[str] = None
    input_params: Dict[str, Any] = field(default_factory=dict)
    output_data: Dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None


@dataclass
class ThreadContext:
    """Full context for a chat thread."""
    thread_id: str
    firm_id: str
    user_id: str
    messages: List[ChatMessage] = field(default_factory=list)
    entities: Dict[str, List[str]] = field(default_factory=dict)
    # e.g. {"matters": ["M-001"], "documents": ["doc-abc"], "clients": ["Sterling"]}
    active_tasks: List[TaskContext] = field(default_factory=list)
    completed_tasks: List[TaskContext] = field(default_factory=list)
    user_preferences: Dict[str, Any] = field(default_factory=dict)
    # e.g. {"preferred_tone": "formal", "jurisdiction": "India"}
    created_at: str = ""
    updated_at: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "thread_id": self.thread_id,
            "firm_id": self.firm_id,
            "user_id": self.user_id,
            "message_count": len(self.messages),
            "entities": self.entities,
            "active_tasks": len(self.active_tasks),
            "completed_tasks": len(self.completed_tasks),
            "user_preferences": self.user_preferences,
        }

    def get_recent_messages(self, limit: int = 20) -> List[Dict[str, str]]:
        """Get recent messages formatted for LLM context window."""
        recent = self.messages[-limit:]
        return [{"role": m.role, "content": m.content} for m in recent]

    def get_task_history_summary(self) -> str:
        """Summarize what tasks were done in this thread for LLM context."""
        if not self.completed_tasks:
            return "No tasks have been executed in this conversation yet."
        lines = []
        for task in self.completed_tasks[-10:]:  # Last 10 tasks
            status_icon = "✅" if task.status == "completed" else "❌"
            lines.append(f"{status_icon} {task.tool_name}: {task.result_summary or task.status}")
        return "\n".join(lines)

    def extract_entities_from_message(self, message: str):
        """Extract mentioned entities (matters, documents, clients) from a message."""
        import re
        # Matter IDs: M-XXXX pattern
        matters = re.findall(r'\bM-\d+\b', message, re.IGNORECASE)
        if matters:
            self.entities.setdefault("matters", [])
            for m in matters:
                if m not in self.entities["matters"]:
                    self.entities["matters"].append(m)

        # GSTIN pattern (15 chars)
        gstins = re.findall(r'\b\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z0-9]\b', message)
        if gstins:
            self.entities.setdefault("gstins", [])
            for g in gstins:
                if g not in self.entities["gstins"]:
                    self.entities["gstins"].append(g)

        # PAN pattern
        pans = re.findall(r'\b[A-Z]{5}\d{4}[A-Z]\b', message)
        if pans:
            self.entities.setdefault("pans", [])
            for p in pans:
                if p not in self.entities["pans"]:
                    self.entities["pans"].append(p)


# ─── In-Memory Store (per-firm isolated) ────────────────────────


class ConversationMemoryStore:
    """
    Thread-scoped conversation memory.

    Structure: firm_id -> { thread_id: ThreadContext }
    All queries are scoped by firm_id for tenant isolation.
    """

    def __init__(self, max_threads_per_firm: int = 100, max_messages_per_thread: int = 500):
        self._store: Dict[str, Dict[str, ThreadContext]] = defaultdict(dict)
        self._max_threads = max_threads_per_firm
        self._max_messages = max_messages_per_thread

    def create_thread(self, firm_id: str, user_id: str) -> ThreadContext:
        """Create a new conversation thread."""
        now = datetime.now(timezone.utc).isoformat()
        thread = ThreadContext(
            thread_id=f"thread_{uuid.uuid4().hex[:12]}",
            firm_id=firm_id,
            user_id=user_id,
            created_at=now,
            updated_at=now,
        )
        self._store[firm_id][thread.thread_id] = thread
        logger.info("Created thread %s for firm=%s user=%s", thread.thread_id, firm_id, user_id)
        return thread

    def get_thread(self, firm_id: str, thread_id: str) -> Optional[ThreadContext]:
        """Get a thread by ID, scoped to firm."""
        return self._store.get(firm_id, {}).get(thread_id)

    def get_or_create_thread(
        self, firm_id: str, user_id: str, thread_id: Optional[str] = None
    ) -> ThreadContext:
        """Get existing thread or create new one."""
        if thread_id:
            thread = self.get_thread(firm_id, thread_id)
            if thread:
                return thread
        return self.create_thread(firm_id, user_id)

    def add_message(
        self,
        firm_id: str,
        thread_id: str,
        role: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[ChatMessage]:
        """Add a message to a thread."""
        thread = self.get_thread(firm_id, thread_id)
        if not thread:
            logger.warning("Thread %s not found for firm %s", thread_id, firm_id)
            return None

        msg = ChatMessage(
            id=f"msg_{uuid.uuid4().hex[:12]}",
            role=role,
            content=content,
            timestamp=datetime.now(timezone.utc).isoformat(),
            metadata=metadata or {},
        )
        thread.messages.append(msg)

        # Trim old messages if over limit
        if len(thread.messages) > self._max_messages:
            thread.messages = thread.messages[-self._max_messages:]

        # Extract entities from user messages
        if role == "user":
            thread.extract_entities_from_message(content)

        thread.updated_at = datetime.now(timezone.utc).isoformat()
        return msg

    def add_task_context(
        self, firm_id: str, thread_id: str, task: TaskContext
    ):
        """Record a task execution in the thread context."""
        thread = self.get_thread(firm_id, thread_id)
        if not thread:
            return
        thread.active_tasks.append(task)

    def complete_task(
        self,
        firm_id: str,
        thread_id: str,
        task_id: str,
        status: str = "completed",
        result_summary: Optional[str] = None,
        output_data: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
    ):
        """Mark a task as completed and move it to history."""
        thread = self.get_thread(firm_id, thread_id)
        if not thread:
            return

        for task in thread.active_tasks:
            if task.task_id == task_id:
                task.status = status
                task.completed_at = datetime.now(timezone.utc).isoformat()
                task.result_summary = result_summary
                task.output_data = output_data or {}
                task.error = error
                thread.active_tasks.remove(task)
                thread.completed_tasks.append(task)

                # Keep completed task history bounded
                if len(thread.completed_tasks) > 50:
                    thread.completed_tasks = thread.completed_tasks[-50:]
                return

    def get_llm_context_messages(self, firm_id: str, thread_id: str, limit: int = 20) -> List[Dict[str, str]]:
        """Get message history formatted for LLM context window."""
        thread = self.get_thread(firm_id, thread_id)
        if not thread:
            return []
        return thread.get_recent_messages(limit)

    def get_task_history(self, firm_id: str, thread_id: str) -> str:
        """Get human-readable task history for LLM context."""
        thread = self.get_thread(firm_id, thread_id)
        if not thread:
            return ""
        return thread.get_task_history_summary()

    def list_threads(self, firm_id: str, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """List all threads for a firm, optionally filtered by user."""
        firm_threads = self._store.get(firm_id, {})
        result = []
        for tid, thread in firm_threads.items():
            if user_id and thread.user_id != user_id:
                continue
            result.append(thread.to_dict())
        return sorted(result, key=lambda x: x.get("updated_at", ""), reverse=True)

    def update_preferences(self, firm_id: str, thread_id: str, prefs: Dict[str, Any]):
        """Update user preferences extracted from conversation."""
        thread = self.get_thread(firm_id, thread_id)
        if thread:
            thread.user_preferences.update(prefs)


# Global singleton
memory_store = ConversationMemoryStore()
