"""
Task Planner — LLM-powered task decomposition and execution planning.

Given a user's natural language request + conversation context, the planner:
1. Understands what the user wants
2. Decomposes it into ordered steps (which crew/MCP tool to call, with what params)
3. Identifies which steps need human approval (filing, submission, e-sign)
4. Returns a structured ExecutionPlan the autonomous executor can run

Uses the reasoning LLM (DeepSeek R1) for complex planning, default LLM for simple requests.
"""
from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class StepType(str, Enum):
    CREW = "crew"            # Execute a CrewAI crew pipeline
    MCP_TOOL = "mcp_tool"    # Call an MCP server tool directly
    API_CALL = "api_call"     # Call a REST API endpoint
    LLM_CALL = "llm_call"     # Direct LLM call (simple Q&A)
    WAIT_APPROVAL = "wait_approval"  # Human approval needed


class StepStatus(str, Enum):
    PLANNED = "planned"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"
    AWAITING_APPROVAL = "awaiting_approval"


# ─── Compliance/Filing gates: steps that REQUIRE human approval ────
FILING_APPROVAL_KEYWORDS = {
    "gst_return", "gstr_1", "gstr_3b", "gstr_9", "filing",
    "submit_return", "itr_filing", "it_return", "tax_return",
    "roc_filing", "aoc_4", "mgt_7", "annual_return",
    "esign", "e_sign", "send_contract", "execute_contract",
    "payment", "charge_card", "invoice", "billing",
    "court_filing", "file_matter",
}

FILING_APPROVAL_CREWS = {"ca_gst", "ca_income_tax", "ca_roc"}
FILING_APPROVAL_MCP_TOOLS = {"esign_send", "billing_charge", "court_file"}


@dataclass
class PlanStep:
    """A single step in the execution plan."""
    id: str
    step_type: StepType
    name: str
    description: str
    tool_or_crew: str
    params: Dict[str, Any] = field(default_factory=dict)
    depends_on: Optional[str] = None  # step ID this depends on
    status: StepStatus = StepStatus.PLANNED
    requires_approval: bool = False
    approval_reason: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "step_type": self.step_type.value,
            "name": self.name,
            "description": self.description,
            "tool_or_crew": self.tool_or_crew,
            "params": self.params,
            "depends_on": self.depends_on,
            "status": self.status.value,
            "requires_approval": self.requires_approval,
            "approval_reason": self.approval_reason,
        }


@dataclass
class ExecutionPlan:
    """A complete plan for executing a user request."""
    id: str
    user_request: str
    steps: List[PlanStep]
    context_summary: str = ""
    estimated_duration: str = ""
    created_at: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "user_request": self.user_request,
            "steps": [s.to_dict() for s in self.steps],
            "context_summary": self.context_summary,
            "created_at": self.created_at,
        }

    def get_next_runnable_step(self) -> Optional[PlanStep]:
        """Get the next step that can be executed (not completed, dependencies met)."""
        completed_ids = {s.id for s in self.steps if s.status == StepStatus.COMPLETED}
        for step in self.steps:
            if step.status not in (StepStatus.PLANNED, StepStatus.AWAITING_APPROVAL):
                continue
            if step.requires_approval and step.status != StepStatus.AWAITING_APPROVAL:
                continue
            if step.depends_on and step.depends_on not in completed_ids:
                continue
            return step
        return None

    def is_complete(self) -> bool:
        """Check if all steps are completed or skipped."""
        return all(
            s.status in (StepStatus.COMPLETED, StepStatus.SKIPPED)
            for s in self.steps
        )

    def has_failures(self) -> bool:
        return any(s.status == StepStatus.FAILED for s in self.steps)


# ─── Available Tools Registry ────────────────────────────────────

AVAILABLE_TOOLS = {
    # Legal vertical crews
    "document_intelligence": {"type": "crew", "vertical": "legal", "description": "Analyze contracts: extract clauses, assess risk, check playbook"},
    "drafting": {"type": "crew", "vertical": "legal", "description": "Draft legal documents (memos, briefs, motions, contracts)"},
    "research": {"type": "crew", "vertical": "legal", "description": "Legal research with RAG-backed citations"},
    "compliance": {"type": "crew", "vertical": "legal", "description": "Regulatory compliance check (GDPR, CCPA, SOC2, ISO27001)"},
    "full_pipeline": {"type": "crew", "vertical": "legal", "description": "Complete contract analysis pipeline (DI → Compliance)"},

    # Consulting vertical crews
    "proposal": {"type": "crew", "vertical": "consulting", "description": "Generate proposals, SOWs, pitch decks with financial modeling"},
    "market_intel": {"type": "crew", "vertical": "consulting", "description": "Market intelligence, SWOT, competitive landscape analysis"},
    "engagement": {"type": "crew", "vertical": "consulting", "description": "Engagement management: WBS, resource plans, risk registers"},

    # CA vertical crews
    "ca_bookkeeping": {"type": "crew", "vertical": "ca", "description": "Bank-to-book reconciliation, variance analysis"},
    "ca_gst": {"type": "crew", "vertical": "ca", "description": "GST reconciliation, GSTR validation, filing prep", "filing_adjacent": True},
    "ca_audit": {"type": "crew", "vertical": "ca", "description": "Statutory/internal audit: risk assessment, sampling, report drafting"},
    "ca_income_tax": {"type": "crew", "vertical": "ca", "description": "TDS reconciliation, ITR data aggregation, notice responses", "filing_adjacent": True},
    "ca_roc": {"type": "crew", "vertical": "ca", "description": "ROC compliance: deadline tracking, AOC-4/MGT-7 forms", "filing_adjacent": True},

    # MCP tools (direct)
    "email_send": {"type": "mcp_tool", "mcp": "email", "description": "Send an email via Gmail/Microsoft Graph"},
    "email_read": {"type": "mcp_tool", "mcp": "email", "description": "Read emails from inbox"},
    "calendar_upcoming": {"type": "mcp_tool", "mcp": "calendar", "description": "Get upcoming calendar events"},
    "calendar_create": {"type": "mcp_tool", "mcp": "calendar", "description": "Create a calendar event"},
    "crm_search": {"type": "mcp_tool", "mcp": "crm", "description": "Search contacts/deals in CRM"},
    "document_search": {"type": "mcp_tool", "mcp": "document", "description": "Semantic search across firm documents"},
    "storage_upload": {"type": "mcp_tool", "mcp": "storage", "description": "Upload a file to cloud storage"},
    "esign_send": {"type": "mcp_tool", "mcp": "esign", "description": "Send document for e-signature", "filing_adjacent": True},
    "billing_subscription": {"type": "mcp_tool", "mcp": "billing", "description": "Check subscription/billing status"},
    "court_search": {"type": "mcp_tool", "mcp": "court", "description": "Search case law via CourtListener"},
    "time_entries": {"type": "mcp_tool", "mcp": "time", "description": "Get time tracking entries"},
    "ocr_analyze": {"type": "mcp_tool", "mcp": "ocr", "description": "OCR and extract text from documents/images"},
    "translation_translate": {"type": "mcp_tool", "mcp": "translation", "description": "Translate text between languages"},
    "workflow_trigger": {"type": "mcp_tool", "mcp": "workflow", "description": "Trigger an n8n/zapier workflow"},

    # Direct LLM
    "general_qa": {"type": "llm", "description": "General question answering about law, tax, compliance"},
}

# ─── Intent → Tool Mapping ───────────────────────────────────────

INTENT_TOOL_MAP = {
    # Contract/Legal
    "analyze_contract": "document_intelligence",
    "review_contract": "document_intelligence",
    "check_contract": "document_intelligence",
    "draft_document": "drafting",
    "write_memo": "drafting",
    "draft_email": "drafting",
    "legal_research": "research",
    "find_cases": "research",
    "check_compliance": "compliance",
    "gdpr_check": "compliance",

    # Consulting
    "create_proposal": "proposal",
    "write_proposal": "proposal",
    "market_analysis": "market_intel",
    "competitor_analysis": "market_intel",
    "swot_analysis": "market_intel",
    "project_plan": "engagement",

    # CA vertical
    "reconcile_books": "ca_bookkeeping",
    "bank_reconciliation": "ca_bookkeeping",
    "bookkeeping": "ca_bookkeeping",
    "gst_reconciliation": "ca_gst",
    "gst_return": "ca_gst",
    "gstr_1": "ca_gst",
    "gstr_3b": "ca_gst",
    "gst_filing": "ca_gst",
    "statutory_audit": "ca_audit",
    "internal_audit": "ca_audit",
    "audit_report": "ca_audit",
    "income_tax": "ca_income_tax",
    "tds_reconciliation": "ca_income_tax",
    "itr_filing": "ca_income_tax",
    "tax_notice": "ca_income_tax",
    "roc_compliance": "ca_roc",
    "mca_filing": "ca_roc",
    "annual_return": "ca_roc",

    # MCP tools
    "send_email": "email_send",
    "read_email": "email_read",
    "calendar": "calendar_upcoming",
    "create_event": "calendar_create",
    "search_crm": "crm_search",
    "search_documents": "document_search",
    "upload_file": "storage_upload",
    "send_for_signature": "esign_send",
    "billing": "billing_subscription",
    "search_cases": "court_search",
    "time_tracking": "time_entries",
    "ocr_scan": "ocr_analyze",
    "translate": "translation_translate",
}


def _needs_approval(tool_or_crew: str, params: Dict[str, Any]) -> tuple[bool, Optional[str]]:
    """Check if a step requires human approval before execution."""
    tool_info = AVAILABLE_TOOLS.get(tool_or_crew, {})

    # Check if the tool/crew is filing-adjacent
    if tool_info.get("filing_adjacent"):
        return True, f"This action ({tool_or_crew}) involves a filing or submission that requires human approval."

    # Check tool name against approval keywords
    for keyword in FILING_APPROVAL_KEYWORDS:
        if keyword in tool_or_crew.lower():
            return True, f"Action '{tool_or_crew}' matches filing/submission criteria."

    # Check MCP tool names
    if tool_or_crew in FILING_APPROVAL_MCP_TOOLS:
        return True, f"MCP tool '{tool_or_crew}' triggers an external action requiring approval."

    # Check params for filing indicators
    params_str = json.dumps(params).lower()
    if any(kw in params_str for kw in ["submit", "file", "send", "execute", "charge"]):
        if tool_or_crew.startswith("ca_") or tool_or_crew in ("esign_send", "billing_charge"):
            return True, "Parameters indicate a submission/filing action."

    return False, None


class TaskPlanner:
    """
    Decomposes user requests into executable step plans.

    Uses two strategies:
    1. Simple pattern matching for common requests (fast, no LLM call)
    2. LLM-powered planning for complex/multi-step requests
    """

    def __init__(self):
        self._tools = AVAILABLE_TOOLS
        self._intent_map = INTENT_TOOL_MAP

    def plan(self, user_message: str, conversation_context: Optional[str] = None) -> ExecutionPlan:
        """
        Create an execution plan for a user request.

        Args:
            user_message: The user's natural language request
            conversation_context: Optional summary of conversation history

        Returns:
            ExecutionPlan with ordered steps
        """
        plan_id = f"plan_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc).isoformat()

        # Try simple pattern-based planning first
        steps = self._simple_plan(user_message)

        if not steps:
            # Fall back to LLM-powered planning
            steps = self._llm_plan(user_message, conversation_context)

        # If still no steps, route to general QA
        if not steps:
            steps = [
                PlanStep(
                    id=f"step_{uuid.uuid4().hex[:8]}",
                    step_type=StepType.LLM_CALL,
                    name="General Response",
                    description=user_message[:200],
                    tool_or_crew="general_qa",
                    params={"message": user_message},
                )
            ]

        # Check approval requirements
        for step in steps:
            needs_approval, reason = _needs_approval(step.tool_or_crew, step.params)
            if needs_approval:
                step.requires_approval = True
                step.approval_reason = reason

        return ExecutionPlan(
            id=plan_id,
            user_request=user_message,
            steps=steps,
            context_summary=conversation_context or "",
            created_at=now,
        )

    def _simple_plan(self, message: str) -> List[PlanStep]:
        """Fast pattern-based planning for common single-step requests."""
        lower = message.lower()
        steps = []

        # Check each intent pattern
        for intent_key, tool_name in self._intent_map.items():
            # Convert snake_case intent to searchable patterns
            keywords = intent_key.replace("_", " ").split()
            if all(kw in lower for kw in keywords):
                tool_info = self._tools.get(tool_name, {})
                step_type = StepType.CREW if tool_info.get("type") == "crew" else (
                    StepType.MCP_TOOL if tool_info.get("type") == "mcp_tool" else StepType.LLM_CALL
                )
                steps.append(PlanStep(
                    id=f"step_{uuid.uuid4().hex[:8]}",
                    step_type=step_type,
                    name=intent_key.replace("_", " ").title(),
                    description=tool_info.get("description", message[:200]),
                    tool_or_crew=tool_name,
                    params={"message": message},
                ))
                break  # One step for simple requests

        # Multi-step detection: check for "and then", "after that", "also", "then"
        if any(connector in lower for connector in [" and then ", " after that ", " also ", " then ", " afterwards "]):
            # Detect compound requests and chain them
            steps = self._detect_compound_request(message)

        return steps

    def _detect_compound_request(self, message: str) -> List[PlanStep]:
        """Detect and decompose compound requests into multiple steps."""
        import re
        # Split on common connectors
        parts = re.split(r'\b(?:and then|after that|then|also|afterwards)\b', message, flags=re.IGNORECASE)
        parts = [p.strip() for p in parts if p.strip()]

        if len(parts) <= 1:
            return []

        steps = []
        prev_step_id = None
        for part in parts:
            sub_steps = self._simple_plan(part)
            if sub_steps:
                step = sub_steps[0]
                step.depends_on = prev_step_id
                prev_step_id = step.id
                steps.append(step)

        return steps

    def _llm_plan(self, message: str, context: Optional[str] = None) -> List[PlanStep]:
        """LLM-powered planning for complex requests."""
        try:
            from ..agents.cloudflare_llm import get_default_llm

            tools_desc = "\n".join([
                f"  - {name}: {info['description']} (type: {info['type']})"
                for name, info in self._tools.items()
            ])

            system_prompt = f"""You are a task planner for a legal/consulting/CA AI platform.
Given a user request, decompose it into ordered steps using available tools.

AVAILABLE TOOLS:
{tools_desc}

Respond with a JSON array of steps. Each step:
{{
  "name": "short step name",
  "description": "what this step does",
  "tool": "tool_or_crew_name from the list above",
  "params": {{"message": "the relevant part of the user request"}},
  "depends_on": null  // or the index of the step this depends on
}}

Rules:
- Only use tools from the available list
- For filing/submission actions (GST returns, ITR, ROC filings, e-signatures), add a step with "requires_approval": true
- Chain dependent steps (e.g., research before drafting)
- If the request is simple, return a single step
- Respond ONLY with the JSON array, no other text"""

            context_block = ""
            if context:
                context_block = f"\n\nCONVERSATION CONTEXT:\n{context}"

            llm = get_default_llm(temperature=0.1)
            response = llm.call([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Plan this request: {message}{context_block}"},
            ])

            # Parse LLM response
            if not response:
                return []

            # Extract JSON from response (may be wrapped in ```json blocks)
            import re
            json_match = re.search(r'\[[\s\S]*?\]', response)
            if not json_match:
                return []

            plan_data = json.loads(json_match.group())
            steps = []
            step_ids = []

            for i, item in enumerate(plan_data):
                step_id = f"step_{uuid.uuid4().hex[:8]}"
                step_ids.append(step_id)
                depends_on = None
                if item.get("depends_on") is not None and isinstance(item["depends_on"], int):
                    dep_idx = item["depends_on"]
                    if 0 <= dep_idx < len(step_ids):
                        depends_on = step_ids[dep_idx]

                tool_name = item.get("tool", "general_qa")
                tool_info = self._tools.get(tool_name, {})
                step_type = StepType.CREW if tool_info.get("type") == "crew" else (
                    StepType.MCP_TOOL if tool_info.get("type") == "mcp_tool" else StepType.LLM_CALL
                )

                steps.append(PlanStep(
                    id=step_id,
                    step_type=step_type,
                    name=item.get("name", f"Step {i+1}"),
                    description=item.get("description", ""),
                    tool_or_crew=tool_name,
                    params=item.get("params", {"message": message}),
                    depends_on=depends_on,
                    requires_approval=item.get("requires_approval", False),
                ))

            return steps

        except Exception as e:
            logger.error("LLM planning failed: %s", e)
            return []


# Global singleton
task_planner = TaskPlanner()
