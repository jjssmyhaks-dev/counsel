"""
Autonomous Chat Engine — The main entry point for the chat-first interface.

This replaces the simple keyword-based chat endpoint with an autonomous
agent that:
1. Maintains conversation memory across turns
2. Plans multi-step execution using LLM decomposition
3. Executes plans step-by-step with cross-crew chaining
4. Enforces compliance/filing approval gates
5. Streams progress updates
6. Stores results in thread context for future reference
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .conversation_memory import memory_store, ThreadContext, TaskContext
from .task_planner import task_planner, ExecutionPlan, StepStatus
from .autonomous_executor import AutonomousExecutor
from .audit_agent import audit_trail, AuditAction
from .feedback_loop import feedback_loop, FeedbackType
from .guardrails import guardrails
from .evals import eval_framework
from .security import security, SecurityContext, UserRole

logger = logging.getLogger(__name__)


class AutonomousChatEngine:
    """
    The autonomous chat engine — the core orchestrator.

    For each user message:
    1. Load or create conversation thread
    2. Add user message to history
    3. Build LLM context from history + entities + task history
    4. Plan execution steps
    5. Execute steps (with approval gates if needed)
    6. Store results in thread
    7. Return response for chat UI
    """

    def plan_and_preview(
        self, firm_id: str, user_id: str, message: str, thread_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Plan an execution and return the plan preview (without executing).
        Used when the user wants to review before approving.
        """
        thread = memory_store.get_or_create_thread(firm_id, user_id, thread_id)

        # Build context for planning
        context_parts = []
        task_history = memory_store.get_task_history(firm_id, thread.thread_id)
        if task_history and task_history != "No tasks have been executed in this conversation yet.":
            context_parts.append(f"Previous tasks in this conversation:\n{task_history}")

        # Add entity context
        if thread.entities:
            context_parts.append(f"Entities mentioned: {json.dumps(thread.entities)}")

        # Add user preferences
        if thread.user_preferences:
            context_parts.append(f"User preferences: {json.dumps(thread.user_preferences)}")

        conversation_context = "\n\n".join(context_parts) if context_parts else None

        # Plan
        plan = task_planner.plan(message, conversation_context)

        # Check if any steps need approval
        approval_steps = [s for s in plan.steps if s.requires_approval]

        return {
            "thread_id": thread.thread_id,
            "plan": plan.to_dict(),
            "requires_approval": len(approval_steps) > 0,
            "approval_steps": [
                {"step_id": s.id, "name": s.name, "reason": s.approval_reason}
                for s in approval_steps
            ],
        }

    async def chat(
        self,
        firm_id: str,
        user_id: str,
        message: str,
        thread_id: Optional[str] = None,
        approved_steps: Optional[List[str]] = None,
        on_progress: Optional[callable] = None,
        user_role: str = "ASSOCIATE",
    ) -> Dict[str, Any]:
        """
        Process a chat message autonomously.

        Args:
            firm_id: Tenant firm ID
            user_id: User who sent the message
            message: User's natural language message
            thread_id: Existing thread ID (or None to create new)
            approved_steps: List of step IDs that were pre-approved by user
            on_progress: Callback for streaming progress updates
            user_role: User's role for RBAC

        Returns:
            {
                "thread_id": str,
                "message_id": str,
                "content": str,  # Response content for chat display
                "plan": {...},   # Execution plan details
                "entities": {...},  # Updated entities
                "tool_suggestions": [...],  # Suggested next actions
            }
        """
        # 0. Security context
        ctx = SecurityContext(
            firm_id=firm_id, user_id=user_id,
            user_role=UserRole(user_role) if user_role in [r.value for r in UserRole] else UserRole.ASSOCIATE,
        )
        valid, reason = security.validate_session(ctx)
        if not valid:
            return {"thread_id": thread_id or "", "message_id": "", "content": f"Security error: {reason}", "plan": None, "entities": {}, "tool_suggestions": []}

        # 0b. Rate limit check
        rate_allowed, rate_reason = guardrails.rate_limiter.check_rate_limit(firm_id)
        if not rate_allowed:
            return {"thread_id": thread_id or "", "message_id": "", "content": f"{rate_reason}. Please wait a moment.", "plan": None, "entities": {}, "tool_suggestions": []}

        # 0c. Input validation + PII detection
        valid, reason, sanitized_message = guardrails.input_validator.validate_message(message)
        if not valid:
            return {"thread_id": thread_id or "", "message_id": "", "content": f"Input rejected: {reason}", "plan": None, "entities": {}, "tool_suggestions": []}
        message = sanitized_message

        # 1. Load or create thread
        thread = memory_store.get_or_create_thread(firm_id, user_id, thread_id)

        # 2. Add user message to history
        user_msg = memory_store.add_message(firm_id, thread.thread_id, "user", message)

        # 3. Build LLM context from conversation history
        context_parts = []
        task_history = memory_store.get_task_history(firm_id, thread.thread_id)
        if task_history and "No tasks" not in task_history:
            context_parts.append(f"Previous tasks in this conversation:\n{task_history}")

        if thread.entities:
            context_parts.append(f"Entities mentioned so far: {json.dumps(thread.entities)}")

        if thread.user_preferences:
            context_parts.append(f"User preferences: {json.dumps(thread.user_preferences)}")

        # Add recent messages for context
        recent = memory_store.get_llm_context_messages(firm_id, thread.thread_id, limit=10)
        if len(recent) > 2:
            history_text = "\n".join([f"{m['role']}: {m['content'][:200]}" for m in recent[:-1]])
            context_parts.append(f"Recent conversation:\n{history_text}")

        conversation_context = "\n\n".join(context_parts) if context_parts else None

        # 4. Plan execution
        plan = task_planner.plan(message, conversation_context)
        logger.info("Plan created: %s with %d steps", plan.id, len(plan.steps))

        # 5. Handle approval gates
        approval_steps = [s for s in plan.steps if s.requires_approval]
        if approval_steps and not approved_steps:
            # Some steps need approval — return plan for user review
            # Mark non-approval steps as approved by default
            for step in plan.steps:
                if not step.requires_approval:
                    continue
                if step.id in (approved_steps or []):
                    step.requires_approval = False  # User approved this step

            # Re-check if any still need approval
            still_needing = [s for s in plan.steps if s.requires_approval]
            if still_needing:
                # Return plan preview for user approval
                response_content = self._format_approval_request(still_needing, plan)
                assistant_msg = memory_store.add_message(
                    firm_id, thread.thread_id, "assistant", response_content,
                    metadata={"type": "approval_request", "plan_id": plan.id}
                )
                return {
                    "thread_id": thread.thread_id,
                    "message_id": assistant_msg.id if assistant_msg else "",
                    "content": response_content,
                    "plan": plan.to_dict(),
                    "entities": thread.entities,
                    "requires_approval": True,
                    "approval_steps": [
                        {"step_id": s.id, "name": s.name, "reason": s.approval_reason, "tool": s.tool_or_crew}
                        for s in still_needing
                    ],
                }

        # 6. Execute the plan
        executor = AutonomousExecutor(on_progress=on_progress)
        result = await executor.execute(
            plan=plan,
            firm_id=firm_id,
            user_id=user_id,
            thread_context={"entities": thread.entities, "preferences": thread.user_preferences},
        )

        # 7. Store task results + feedback + evals
        for step in plan.steps:
            task = TaskContext(
                task_id=step.id,
                task_type=step.step_type.value,
                tool_name=step.tool_or_crew,
                status=step.status.value,
                started_at=datetime.now(timezone.utc).isoformat(),
                completed_at=datetime.now(timezone.utc).isoformat() if step.status == StepStatus.COMPLETED else None,
                result_summary=step.result.get("raw_output", "")[:500] if step.result else None,
                input_params=step.params,
                output_data=step.result or {},
                error=step.error,
            )
            memory_store.complete_task(
                firm_id, thread.thread_id, task.task_id,
                status=task.status,
                result_summary=task.result_summary,
                output_data=task.output_data,
                error=task.error,
            )

            # Record feedback for self-learning
            if step.status == StepStatus.COMPLETED:
                feedback_loop.record_feedback(
                    firm_id=firm_id, user_id=user_id, thread_id=thread.thread_id,
                    plan_id=plan.id, step_id=step.id, tool_or_crew=step.tool_or_crew,
                    feedback_type=FeedbackType.TASK_SUCCESS,
                )
                # Post-execution output validation
                output_text = step.result.get("raw_output", "") if step.result else ""
                if output_text:
                    guardrails.post_execution_check(firm_id, step.tool_or_crew, output_text, message)
                    # Run eval
                    eval_framework.evaluate(
                        firm_id=firm_id, plan_id=plan.id, tool_name=step.tool_or_crew,
                        input_text=message, output_text=output_text,
                    )
            elif step.status == StepStatus.FAILED:
                feedback_loop.record_feedback(
                    firm_id=firm_id, user_id=user_id, thread_id=thread.thread_id,
                    plan_id=plan.id, step_id=step.id, tool_or_crew=step.tool_or_crew,
                    feedback_type=FeedbackType.TASK_FAILURE,
                    metadata={"error": step.error or ""},
                )

        # 8. Build response
        content = result.get("final_output", "I wasn't able to complete your request.")
        if not content or content == "No output generated.":
            content = "I processed your request but didn't generate a readable output. Could you rephrase?"

        # Add plan summary
        plan_summary = f"\n\n*Completed {result.get('completed_steps', 0)}/{result.get('total_steps', 0)} steps.*"
        if result.get("status") == "partial":
            plan_summary = f"\n\n*Completed {result.get('completed_steps', 0)}/{result.get('total_steps', 0)} steps (some failed).*"
        content += plan_summary

        # 9. Add assistant message to history
        assistant_msg = memory_store.add_message(
            firm_id, thread.thread_id, "assistant", content,
            metadata={
                "plan_id": plan.id,
                "steps_completed": result.get("completed_steps"),
                "steps_total": result.get("total_steps"),
                "status": result.get("status"),
            }
        )

        # 10. Generate tool suggestions for next action
        suggestions = self._generate_suggestions(thread, plan)

        # 11. Extract user preferences from conversation
        self._extract_preferences(thread, message)

        # 12. Audit log
        audit_trail.log(
            action=AuditAction.CONTRACT_ANALYSIS_COMPLETED,
            resource_id=f"chat_{plan.id}",
            firm_id=firm_id,
            user_id=user_id,
            metadata={
                "plan_id": plan.id,
                "steps": len(plan.steps),
                "status": result.get("status"),
                "tools_used": [s.tool_or_crew for s in plan.steps],
            },
        )

        return {
            "thread_id": thread.thread_id,
            "message_id": assistant_msg.id if assistant_msg else "",
            "content": content,
            "plan": result,
            "entities": thread.entities,
            "tool_suggestions": suggestions,
        }

    def get_thread_history(self, firm_id: str, thread_id: str) -> List[Dict[str, Any]]:
        """Get full message history for a thread."""
        thread = memory_store.get_thread(firm_id, thread_id)
        if not thread:
            return []
        return [m.to_dict() for m in thread.messages]

    def list_threads(self, firm_id: str, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """List all threads for a firm/user."""
        return memory_store.list_threads(firm_id, user_id)

    def _format_approval_request(self, steps: List, plan: ExecutionPlan) -> str:
        """Format a human-readable approval request."""
        lines = [
            "### ⚠️ Approval Required",
            "",
            "The following actions require your explicit approval before execution:",
            "",
        ]
        for step in steps:
            lines.append(f"**{step.name}** ({step.tool_or_crew})")
            lines.append(f"  Reason: {step.approval_reason}")
            lines.append(f"  Parameters: {json.dumps(step.params, indent=2)[:300]}")
            lines.append("")

        lines.append("Reply with **'approve all'** or **'approve [step name]'** to proceed.")
        lines.append("Or describe what you'd like to change.")
        return "\n".join(lines)

    def _generate_suggestions(self, thread: ThreadContext, plan: ExecutionPlan) -> List[Dict[str, str]]:
        """Generate contextual tool suggestions based on what was done."""
        suggestions = []
        tools_used = {s.tool_or_crew for s in plan.steps}

        # Suggest complementary tools based on what was just done
        if "document_intelligence" in tools_used:
            suggestions.append({"id": "draft", "name": "Draft Redlines", "icon": "edit"})
            suggestions.append({"id": "compliance", "name": "Check Compliance", "icon": "shield"})
        if "drafting" in tools_used:
            suggestions.append({"id": "compliance", "name": "Review Draft for Compliance", "icon": "shield"})
            suggestions.append({"id": "email_send", "name": "Email Draft for Review", "icon": "mail"})
        if "research" in tools_used:
            suggestions.append({"id": "drafting", "name": "Draft Based on Research", "icon": "edit"})
        if "ca_gst" in tools_used:
            suggestions.append({"id": "ca_bookkeeping", "name": "Reconcile Books", "icon": "book"})
        if "ca_audit" in tools_used:
            suggestions.append({"id": "ca_roc", "name": "Check ROC Deadlines", "icon": "calendar"})

        # If nothing specific, show general suggestions
        if not suggestions:
            suggestions = [
                {"id": "document_intelligence", "name": "Analyze Contract", "icon": "scale"},
                {"id": "drafting", "name": "Draft Document", "icon": "edit"},
                {"id": "research", "name": "Legal Research", "icon": "search"},
                {"id": "ca_gst", "name": "GST Reconciliation", "icon": "calculator"},
            ]

        return suggestions[:5]

    def _extract_preferences(self, thread: ThreadContext, message: str):
        """Extract user preferences from conversation."""
        lower = message.lower()
        prefs = {}

        # Jurisdiction
        if "india" in lower or "indian" in lower:
            prefs["jurisdiction"] = "India"
        elif "us" in lower or "united states" in lower or "american" in lower:
            prefs["jurisdiction"] = "US"
        elif "uk" in lower or "united kingdom" in lower or "british" in lower:
            prefs["jurisdiction"] = "UK"

        # Tone preference
        if "formal" in lower:
            prefs["preferred_tone"] = "formal"
        elif "casual" in lower or "informal" in lower:
            prefs["preferred_tone"] = "casual"

        # Practice area focus
        if any(kw in lower for kw in ["gst", "gstr", "indirect tax"]):
            prefs["focus_area"] = "gst"
        elif any(kw in lower for kw in ["income tax", "tds", "itr"]):
            prefs["focus_area"] = "income_tax"
        elif any(kw in lower for kw in ["contract", "nda", "agreement"]):
            prefs["focus_area"] = "contracts"
        elif any(kw in lower for kw in ["compliance", "audit", "roc"]):
            prefs["focus_area"] = "compliance"

        if prefs:
            thread.user_preferences.update(prefs)


# Global singleton
autonomous_chat = AutonomousChatEngine()
