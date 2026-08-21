"""
Autonomous Executor — Runs ExecutionPlans step-by-step.

Responsibilities:
- Execute crew pipelines (calling into crews.py)
- Execute MCP tools (calling MCP servers via HTTP)
- Chain dependent steps (output of one step feeds into the next)
- Handle retries and error recovery
- Enforce filing approval gates
- Report progress at each step
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

from .task_planner import (
    ExecutionPlan, PlanStep, StepType, StepStatus,
    AVAILABLE_TOOLS,
)
from .audit_agent import audit_trail, AuditAction

logger = logging.getLogger(__name__)


# ─── MCP Server Endpoints ────────────────────────────────────────

MCP_SERVER_ENDPOINTS = {
    "email": {"base_url": "http://localhost:3104", "tools": ["send", "read", "search", "thread"]},
    "calendar": {"base_url": "http://localhost:3105", "tools": ["upcoming", "list_events", "create_event", "find_slots"]},
    "storage": {"base_url": "http://localhost:3106", "tools": ["upload", "download_url", "list"]},
    "esign": {"base_url": "http://localhost:3107", "tools": ["send", "status", "void"]},
    "billing": {"base_url": "http://localhost:3108", "tools": ["subscription", "invoice", "usage"]},
    "court": {"base_url": "http://localhost:3109", "tools": ["search", "get_opinion", "cite", "statutes"]},
    "communication": {"base_url": "http://localhost:3110", "tools": ["send_message", "list_channels"]},
    "crm": {"base_url": "http://localhost:3111", "tools": ["search_contacts", "get_deals", "get_matters", "sync_contact"]},
    "workflow": {"base_url": "http://localhost:3112", "tools": ["trigger", "execute"]},
    "ocr": {"base_url": "http://localhost:3113", "tools": ["analyze", "forms", "tables"]},
    "translation": {"base_url": "http://localhost:3114", "tools": ["translate_text", "translate_languages"]},
    "video": {"base_url": "http://localhost:3115", "tools": ["create_meeting", "list_recordings", "get_transcript"]},
    "time": {"base_url": "http://localhost:3116", "tools": ["start_timer", "stop_timer", "get_entries"]},
    "conflict": {"base_url": "http://localhost:3117", "tools": ["check", "watchlist", "wall", "history"]},
    "document": {"base_url": "http://localhost:3103", "tools": ["search", "get", "chunk", "embed", "status"]},
}


class AutonomousExecutor:
    """
    Executes an ExecutionPlan, running each step sequentially
    with dependency resolution and error recovery.
    """

    def __init__(self, on_progress: Optional[Callable] = None):
        """
        Args:
            on_progress: Optional callback called with (step_id, status, message)
                         for streaming progress updates to the chat UI.
        """
        self.on_progress = on_progress

    def _report_progress(self, step_id: str, status: str, message: str):
        """Report progress via callback."""
        if self.on_progress:
            try:
                self.on_progress(step_id, status, message)
            except Exception:
                pass

    async def execute(
        self,
        plan: ExecutionPlan,
        firm_id: str,
        user_id: str,
        thread_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Execute all steps in the plan.

        Returns:
            {
                "plan_id": str,
                "status": "completed" | "failed" | "partial",
                "steps": [...step results...],
                "final_output": str,  # Combined output for chat display
                "approval_required": [...] if any steps need approval
            }
        """
        results = []
        step_outputs: Dict[str, Any] = {}  # step_id -> output, for chaining
        approval_required = []

        for step in plan.steps:
            # Check if dependencies are satisfied
            if step.depends_on and step.depends_on not in step_outputs:
                step.status = StepStatus.SKIPPED
                step.error = f"Dependency {step.depends_on} not satisfied"
                results.append(step.to_dict())
                continue

            # Check if approval is needed
            if step.requires_approval:
                step.status = StepStatus.AWAITING_APPROVAL
                approval_required.append({
                    "step_id": step.id,
                    "step_name": step.name,
                    "tool_or_crew": step.tool_or_crew,
                    "reason": step.approval_reason,
                    "params": step.params,
                })
                results.append(step.to_dict())
                continue

            # Execute the step
            step.status = StepStatus.RUNNING
            self._report_progress(step.id, "running", f"Executing: {step.name}")

            try:
                # Merge step params with any upstream outputs
                exec_params = dict(step.params)
                if step.depends_on and step.depends_on in step_outputs:
                    upstream = step_outputs[step.depends_on]
                    if isinstance(upstream, dict):
                        exec_params["upstream_result"] = upstream.get("raw_output", "")
                    elif isinstance(upstream, str):
                        exec_params["upstream_result"] = upstream

                # Execute based on step type
                if step.step_type == StepType.CREW:
                    output = await self._execute_crew(step.tool_or_crew, exec_params, firm_id, user_id)
                elif step.step_type == StepType.MCP_TOOL:
                    output = await self._execute_mcp_tool(step.tool_or_crew, exec_params, firm_id)
                elif step.step_type == StepType.LLM_CALL:
                    output = await self._execute_llm_call(step.tool_or_crew, exec_params)
                else:
                    output = {"error": f"Unknown step type: {step.step_type}"}

                step.status = StepStatus.COMPLETED
                step.result = output
                step_outputs[step.id] = output
                self._report_progress(step.id, "completed", f"✅ {step.name} completed")

            except Exception as e:
                logger.error("Step %s failed: %s", step.id, e, exc_info=True)
                step.status = StepStatus.FAILED
                step.error = str(e)
                self._report_progress(step.id, "failed", f"❌ {step.name} failed: {str(e)[:100]}")

                # Log to audit trail
                audit_trail.log(
                    action=AuditAction.ERROR_OCCURRED,
                    resource_id=step.tool_or_crew,
                    user_id=user_id,
                    firm_id=firm_id,
                    success=False,
                    error_message=str(e)[:500],
                    metadata={"step_id": step.id, "plan_id": plan.id},
                )

            results.append(step.to_dict())

        # Determine overall status
        completed = sum(1 for s in plan.steps if s.status == StepStatus.COMPLETED)
        failed = sum(1 for s in plan.steps if s.status == StepStatus.FAILED)
        if failed > 0 and completed > 0:
            overall_status = "partial"
        elif failed > 0:
            overall_status = "failed"
        else:
            overall_status = "completed"

        # Combine outputs for chat display
        final_output = self._combine_outputs(plan.steps)

        return {
            "plan_id": plan.id,
            "status": overall_status,
            "steps": results,
            "final_output": final_output,
            "approval_required": approval_required if approval_required else None,
            "completed_steps": completed,
            "total_steps": len(plan.steps),
        }

    async def _execute_crew(
        self, crew_name: str, params: Dict[str, Any], firm_id: str, user_id: str
    ) -> Dict[str, Any]:
        """Execute a CrewAI crew pipeline."""
        from ..agents.crews import (
            run_document_intelligence,
            run_drafting_crew,
            run_research_crew,
            run_compliance_crew,
            run_proposal_crew,
            run_market_intel_crew,
            run_engagement_crew,
            run_ca_bookkeeping_reconciliation,
            run_ca_gst,
            run_ca_audit,
            run_ca_income_tax,
            run_ca_roc,
        )

        message = params.get("message", "")
        upstream = params.get("upstream_result", "")

        # Route to the correct crew
        crew_dispatch = {
            "document_intelligence": lambda: run_document_intelligence(document_text=upstream or message),
            "drafting": lambda: run_drafting_crew(
                draft_type=params.get("draft_type", "memo"),
                instructions=upstream or message,
                matter_context=params.get("matter_context"),
            ),
            "research": lambda: run_research_crew(
                query=message,
                source_chunks=[upstream] if upstream else [],
                jurisdiction=params.get("jurisdiction"),
            ),
            "compliance": lambda: run_compliance_crew(
                output_text=upstream or message,
                output_type=params.get("output_type", "general"),
                firm_id=firm_id,
                user_id=user_id,
            ),
            "proposal": lambda: run_proposal_crew(
                proposal_type=params.get("proposal_type", "proposal"),
                client_context=upstream or message,
                scope=params.get("scope", "TBD"),
                timeline=params.get("timeline", "TBD"),
                budget_range=params.get("budget_range", "TBD"),
            ),
            "market_intel": lambda: run_market_intel_crew(
                industry=params.get("industry", "general"),
                company=params.get("company", ""),
                question=message,
            ),
            "engagement": lambda: run_engagement_crew(
                project_name=params.get("project_name", "Chat Request"),
                client_name=params.get("client_name", ""),
                scope=upstream or message,
                start_date=params.get("start_date", ""),
                end_date=params.get("end_date", ""),
            ),
            "ca_bookkeeping": lambda: run_ca_bookkeeping_reconciliation(
                client_name=params.get("client_name", "Client"),
                period=params.get("period", "Q1 2026"),
                trial_balance_ref=upstream or message,
            ),
            "ca_gst": lambda: run_ca_gst(
                client_name=params.get("client_name", "Client"),
                gstin=params.get("gstin", ""),
                period=params.get("period", ""),
            ),
            "ca_audit": lambda: run_ca_audit(
                client_name=params.get("client_name", "Client"),
                year=params.get("year", "2025-26"),
                engagement_type=params.get("engagement_type", "Statutory Audit"),
            ),
            "ca_income_tax": lambda: run_ca_income_tax(
                client_name=params.get("client_name", "Client"),
                pan=params.get("pan", ""),
                assessment_year=params.get("assessment_year", "2026-27"),
            ),
            "ca_roc": lambda: run_ca_roc(
                client_name=params.get("client_name", "Client"),
                cin=params.get("cin", ""),
            ),
        }

        if crew_name not in crew_dispatch:
            return {"error": f"Unknown crew: {crew_name}", "raw_output": f"Crew '{crew_name}' not found."}

        result = await crew_dispatch[crew_name]()
        return result

    async def _execute_mcp_tool(
        self, tool_name: str, params: Dict[str, Any], firm_id: str
    ) -> Dict[str, Any]:
        """Execute an MCP tool by calling its HTTP server."""
        # Parse tool name: "email_send" -> mcp="email", tool="send"
        parts = tool_name.split("_", 1)
        mcp_name = parts[0] if len(parts) > 1 else tool_name
        tool_action = parts[1] if len(parts) > 1 else "execute"

        mcp_info = MCP_SERVER_ENDPOINTS.get(mcp_name)
        if not mcp_info:
            return {"error": f"Unknown MCP server: {mcp_name}"}

        import httpx
        url = f"{mcp_info['base_url']}/{tool_action}"
        payload = {
            "firm_id": firm_id,
            "params": params,
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
                return resp.json()
        except httpx.ConnectError:
            # MCP server not running — graceful fallback
            return {
                "status": "unavailable",
                "message": f"MCP server '{mcp_name}' is not running. Start it with: cd services/mcp/{mcp_name} && npm start",
                "tool": tool_name,
                "params_received": params,
            }
        except Exception as e:
            return {"error": f"MCP call failed: {str(e)}", "tool": tool_name}

    async def _execute_llm_call(
        self, tool_name: str, params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Execute a direct LLM call for general Q&A."""
        try:
            from ..agents.cloudflare_llm import get_default_llm
            llm = get_default_llm(temperature=0.3)
            message = params.get("message", "")
            upstream = params.get("upstream_result", "")

            context = upstream if upstream else ""
            prompt = f"{context}\n\nUser question: {message}" if context else message

            response = llm.call([
                {"role": "system", "content": "You are Counsel AI, an expert legal/consulting/CA assistant. Provide helpful, accurate, and actionable responses. For Indian tax/compliance matters, reference relevant sections of the Income Tax Act, GST Act, and Companies Act where applicable."},
                {"role": "user", "content": prompt},
            ])
            return {"raw_output": response or "I don't have enough context to answer that. Could you provide more details?"}
        except Exception as e:
            return {"error": f"LLM call failed: {str(e)}", "raw_output": "I encountered an error processing your request. Please try again."}

    def _combine_outputs(self, steps: List[PlanStep]) -> str:
        """Combine step outputs into a single response for the chat UI."""
        parts = []
        for step in steps:
            if step.status == StepStatus.COMPLETED and step.result:
                output = step.result.get("raw_output", "")
                if output:
                    if len(parts) > 0:
                        parts.append(f"\n\n---\n\n")
                    parts.append(f"**{step.name}:**\n\n{output}")
            elif step.status == StepStatus.FAILED:
                parts.append(f"\n\n**{step.name}:** ❌ Failed — {step.error or 'Unknown error'}")
            elif step.status == StepStatus.AWAITING_APPROVAL:
                parts.append(f"\n\n**{step.name}:** ⏳ Awaiting approval — {step.approval_reason}")

        return "\n".join(parts) if parts else "No output generated."


# Global singleton
autonomous_executor = AutonomousExecutor()
