"""MCP Client for CrewAI — bridges CrewAI tools to MCP servers.

Usage in definitions.py:
    from src.agents.mcp_client import MCPToolRegistry
    registry = MCPToolRegistry()
    agent = Agent(tools=registry.get_crew_tools(["postgres", "cloudflare"]))
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Default MCP server ports (Docker container names in production)
MCP_REGISTRY_URL = os.environ.get("MCP_REGISTRY_URL", "http://127.0.0.1:3100")
MCP_POSTGRES_URL = os.environ.get("MCP_POSTGRES_URL", "http://127.0.0.1:3101")
MCP_CLOUDFLARE_URL = os.environ.get("MCP_CLOUDFLARE_URL", "http://127.0.0.1:3102")
MCP_DOCUMENT_URL = os.environ.get("MCP_DOCUMENT_URL", "http://127.0.0.1:3103")
MCP_EMAIL_URL = os.environ.get("MCP_EMAIL_URL", "http://127.0.0.1:3104")
MCP_CALENDAR_URL = os.environ.get("MCP_CALENDAR_URL", "http://127.0.0.1:3105")
MCP_STORAGE_URL = os.environ.get("MCP_STORAGE_URL", "http://127.0.0.1:3106")
MCP_ESIGN_URL = os.environ.get("MCP_ESIGN_URL", "http://127.0.0.1:3107")
MCP_BILLING_URL = os.environ.get("MCP_BILLING_URL", "http://127.0.0.1:3108")
MCP_COURT_URL = os.environ.get("MCP_COURT_URL", "http://127.0.0.1:3109")
MCP_COMMUNICATION_URL = os.environ.get("MCP_COMMUNICATION_URL", "http://127.0.0.1:3110")
MCP_CRM_URL = os.environ.get("MCP_CRM_URL", "http://127.0.0.1:3111")
MCP_WORKFLOW_URL = os.environ.get("MCP_WORKFLOW_URL", "http://127.0.0.1:3112")
MCP_OCR_URL = os.environ.get("MCP_OCR_URL", "http://127.0.0.1:3113")
MCP_TRANSLATION_URL = os.environ.get("MCP_TRANSLATION_URL", "http://127.0.0.1:3114")
MCP_VIDEO_URL = os.environ.get("MCP_VIDEO_URL", "http://127.0.0.1:3115")
MCP_TIME_URL = os.environ.get("MCP_TIME_URL", "http://127.0.0.1:3116")
MCP_CONFLICT_URL = os.environ.get("MCP_CONFLICT_URL", "http://127.0.0.1:3117")

try:
    import httpx
    _has_httpx = True
except ImportError:
    _has_httpx = False


class MCPClient:
    """Low-level MCP JSON-RPC client."""

    def __init__(self, server_url: str, server_name: str):
        self.server_url = server_url.rstrip("/")
        self.server_name = server_name
        self._request_id = 0
        self._client = httpx.Client(timeout=60.0) if _has_httpx else None

    def _next_id(self) -> int:
        self._request_id += 1
        return self._request_id

    def call(self, method: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Make a JSON-RPC call to the MCP server. Falls back gracefully."""
        request_id = self._next_id()
        payload = {
            "jsonrpc": "2.0",
            "id": request_id,
            "method": method,
            "params": params or {},
        }

        if self._client:
            try:
                resp = self._client.post(
                    f"{self.server_url}/mcp",
                    json=payload,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    if "result" in data:
                        return data["result"]
                    if "error" in data:
                        logger.warning(
                            "MCP error from %s/%s: %s",
                            self.server_name, method, data["error"],
                        )
                        return {"error": data["error"].get("message", "Unknown error")}
                return {"error": f"HTTP {resp.status_code}"}
            except Exception as e:
                logger.error("MCP call failed to %s/%s: %s", self.server_name, method, e)
                return {"error": f"MCP unavailable: {str(e)}"}
        else:
            return {"error": "MCP client not available (httpx not installed)"}

    def health(self) -> Dict[str, Any]:
        """Check server health."""
        if self._client:
            try:
                resp = self._client.get(f"{self.server_url}/health", timeout=5.0)
                if resp.status_code == 200:
                    return resp.json()
            except Exception:
                pass
        return {"status": "unknown"}


class MCPToolBridge:
    """Creates CrewAI-compatible tool functions from MCP server methods.

    Each MCP method becomes a Python function that CrewAI agents can call.
    """

    def __init__(self, client: MCPClient, tool_definitions: List[Dict[str, Any]]):
        self.client = client
        self.tool_definitions = tool_definitions

    def create_tool(self, defn: Dict[str, Any]):
        """Create a closure that wraps an MCP call as a CrewAI tool."""
        client = self.client
        method = defn["method"]
        tool_name = defn["name"]
        description = defn.get("description", f"MCP tool: {method}")

        def tool_func(**kwargs) -> str:
            """Auto-generated docstring."""
            result = client.call(method, kwargs)
            if isinstance(result, dict) and "error" in result and "rows" not in result:
                return json.dumps(result)
            return json.dumps(result, indent=2, default=str)

        # Set docstring for CrewAI tool introspection
        tool_func.__name__ = tool_name
        tool_func.__doc__ = description

        return tool_func

    def get_all_tools(self) -> list:
        """Return a list of tool functions for CrewAI Agent(tools=[...])."""
        return [self.create_tool(d) for d in self.tool_definitions]


# ── Pre-configured tool bridges ──

POSTGRES_TOOLS_MAP = [
    {"name": "mcp_pg_query", "method": "pg_query",
     "description": "Run a SQL SELECT query against the Counsel database. Use for fetching matters, documents, users, audit logs."},
    {"name": "mcp_pg_execute", "method": "pg_execute",
     "description": "Execute INSERT/UPDATE/DELETE in the database. Use for creating matters, updating drafts, logging actions."},
    {"name": "mcp_pg_schema", "method": "pg_schema",
     "description": "Get database schema — tables, columns, types. Use to discover available data."},
    {"name": "mcp_pg_find_matters", "method": "pg_find_matters",
     "description": "Find legal matters by firm, status, client name, or type."},
    {"name": "mcp_pg_find_documents", "method": "pg_find_documents",
     "description": "Find documents by firm, matter, or status."},
    {"name": "mcp_pg_get_audit_log", "method": "pg_get_audit_log",
     "description": "Query the firm's audit trail — see who did what and when."},
    {"name": "mcp_pg_get_playbook", "method": "pg_get_playbook",
     "description": "Get a firm's negotiation playbook rules."},
    {"name": "mcp_pg_create_matter", "method": "pg_create_matter",
     "description": "Create a new legal matter in the database."},
    {"name": "mcp_pg_create_draft", "method": "pg_create_draft",
     "description": "Save a generated draft to the database."},
]

CLOUDFLARE_TOOLS_MAP = [
    {"name": "mcp_cf_text_gen", "method": "cf_text_gen",
     "description": "Generate text using Cloudflare Workers AI. Model: fast/power/reasoning."},
    {"name": "mcp_cf_embed", "method": "cf_embed",
     "description": "Generate 768-dim embeddings for text chunks."},
    {"name": "mcp_cf_chat", "method": "cf_chat",
     "description": "Multi-turn chat with Cloudflare LLM."},
]

DOCUMENT_TOOLS_MAP = [
    {"name": "mcp_doc_search", "method": "doc_search",
     "description": "Semantic search across a firm's document index using pgvector cosine similarity."},
    {"name": "mcp_doc_list", "method": "doc_list",
     "description": "List all documents for a firm with optional filters."},
    {"name": "mcp_doc_chunks", "method": "doc_chunks",
     "description": "Get all text chunks for a specific document."},
    {"name": "mcp_doc_status", "method": "doc_status",
     "description": "Get document processing status and metadata."},
    {"name": "mcp_doc_index_stats", "method": "doc_index_stats",
     "description": "Get indexing statistics for a firm (total docs, chunks, by status)."},
]

# ── T2/T3 new MCP tool maps ──

EMAIL_TOOLS_MAP = [
    {"name": "mcp_email_send", "method": "email_send",
     "description": "Send email via Gmail or Outlook. Use for delivering drafts, meeting summaries, notifications."},
    {"name": "mcp_email_read", "method": "email_read",
     "description": "Read recent emails from inbox. Use to check for new client communications."},
    {"name": "mcp_email_thread", "method": "email_thread",
     "description": "Get a full email thread by ID."},
    {"name": "mcp_email_search", "method": "email_search",
     "description": "Search emails by query."},
]

CALENDAR_TOOLS_MAP = [
    {"name": "mcp_cal_upcoming", "method": "cal_upcoming",
     "description": "Get next 10 upcoming calendar events."},
    {"name": "mcp_cal_list_events", "method": "cal_list_events",
     "description": "List events in date range."},
    {"name": "mcp_cal_create_event", "method": "cal_create_event",
     "description": "Schedule a meeting/deposition/deadline with attendees."},
    {"name": "mcp_cal_find_slots", "method": "cal_find_slots",
     "description": "Find available free/busy slots."},
]

STORAGE_TOOLS_MAP = [
    {"name": "mcp_storage_upload", "method": "storage_upload",
     "description": "Upload document to S3/GCS/SharePoint."},
    {"name": "mcp_storage_download_url", "method": "storage_download_url",
     "description": "Get presigned download URL."},
    {"name": "mcp_storage_list", "method": "storage_list",
     "description": "List files in storage prefix."},
]

ESIGN_TOOLS_MAP = [
    {"name": "mcp_esign_send", "method": "esign_send",
     "description": "Send document for e-signature via DocuSign or HelloSign."},
    {"name": "mcp_esign_status", "method": "esign_status",
     "description": "Check envelope/signature request status."},
    {"name": "mcp_esign_void", "method": "esign_void",
     "description": "Cancel/void a signature request."},
]

BILLING_TOOLS_MAP = [
    {"name": "mcp_billing_subscription", "method": "billing_subscription",
     "description": "Get/create/update/cancel firm Stripe subscription."},
    {"name": "mcp_billing_invoice", "method": "billing_invoice",
     "description": "Manage invoices — list, get, pay, send."},
    {"name": "mcp_billing_usage", "method": "billing_usage",
     "description": "Record usage-based billing event."},
]

COURT_TOOLS_MAP = [
    {"name": "mcp_court_search", "method": "court_search",
     "description": "Search case law by query, court, date range via CourtListener."},
    {"name": "mcp_court_get_opinion", "method": "court_get_opinion",
     "description": "Get full opinion text by ID."},
    {"name": "mcp_court_cite", "method": "court_cite",
     "description": "Citation lookup and validation."},
    {"name": "mcp_court_statutes", "method": "court_statutes",
     "description": "Search statutes and regulations."},
]

COMMUNICATION_TOOLS_MAP = [
    {"name": "mcp_comm_send", "method": "comm_send_message",
     "description": "Send Slack/Teams message to a channel."},
    {"name": "mcp_comm_list_channels", "method": "comm_list_channels",
     "description": "List available Slack/Teams channels."},
]

CRM_TOOLS_MAP = [
    {"name": "mcp_crm_search_contacts", "method": "crm_search_contacts",
     "description": "Search contacts in CRM (Salesforce/Clio/HubSpot)."},
    {"name": "mcp_crm_get_deals", "method": "crm_get_deals",
     "description": "Get deal pipeline from CRM."},
    {"name": "mcp_crm_get_matters", "method": "crm_get_matters",
     "description": "Get Clio legal matters."},
    {"name": "mcp_crm_sync_contact", "method": "crm_sync_contact",
     "description": "Create/update CRM contact."},
]

WORKFLOW_TOOLS_MAP = [
    {"name": "mcp_workflow_trigger", "method": "workflow_trigger",
     "description": "Trigger a Zapier/n8n/Make webhook automation."},
    {"name": "mcp_workflow_execute", "method": "workflow_execute",
     "description": "Execute n8n workflow with data."},
]

OCR_TOOLS_MAP = [
    {"name": "mcp_ocr_analyze", "method": "ocr_analyze",
     "description": "Extract text from scanned documents (Textract/Azure)."},
    {"name": "mcp_ocr_forms", "method": "ocr_forms",
     "description": "Extract form fields and key-value pairs."},
    {"name": "mcp_ocr_tables", "method": "ocr_tables",
     "description": "Extract tables from documents."},
]

TRANSLATION_TOOLS_MAP = [
    {"name": "mcp_translate_text", "method": "translate_text",
     "description": "Translate text via DeepL or Azure Translator."},
    {"name": "mcp_translate_languages", "method": "translate_languages",
     "description": "List supported translation languages."},
]

VIDEO_TOOLS_MAP = [
    {"name": "mcp_video_create_meeting", "method": "video_create_meeting",
     "description": "Create Zoom/Teams meeting with settings."},
    {"name": "mcp_video_list_recordings", "method": "video_list_recordings",
     "description": "List cloud recordings."},
    {"name": "mcp_video_get_transcript", "method": "video_get_transcript",
     "description": "Download meeting transcript."},
]

TIME_TOOLS_MAP = [
    {"name": "mcp_time_start_timer", "method": "time_start_timer",
     "description": "Start billable time entry (Harvest/Toggl)."},
    {"name": "mcp_time_stop_timer", "method": "time_stop_timer",
     "description": "Stop running timer."},
    {"name": "mcp_time_get_entries", "method": "time_get_entries",
     "description": "Get time entries by date/project/matter."},
]

CONFLICT_TOOLS_MAP = [
    {"name": "mcp_conflict_check", "method": "conflict_check",
     "description": "Run conflict-of-interest check on new client/matter."},
    {"name": "mcp_conflict_watchlist", "method": "conflict_watchlist",
     "description": "Manage firm's blocked-party watchlist."},
    {"name": "mcp_conflict_wall", "method": "conflict_wall",
     "description": "Check ethical wall status for user vs matter."},
]


class MCPToolRegistry:
    """Central registry that connects CrewAI agents to all MCP servers.

    Usage:
        registry = MCPToolRegistry()
        # Per-crew tool allocation
        di_tools = registry.get_crew_tools(["postgres", "document"])
        research_tools = registry.get_crew_tools(["postgres", "document", "cloudflare"])
        drafting_tools = registry.get_crew_tools(["postgres", "cloudflare"])
        compliance_tools = registry.get_crew_tools(["postgres"])
        consulting_tools = registry.get_crew_tools(["postgres", "cloudflare", "document"])
    """

    def __init__(self):
        self._postgres = MCPClient(MCP_POSTGRES_URL, "postgres-mcp")
        self._cloudflare = MCPClient(MCP_CLOUDFLARE_URL, "cloudflare-mcp")
        self._document = MCPClient(MCP_DOCUMENT_URL, "document-mcp")
        # Tier 2
        self._email = MCPClient(MCP_EMAIL_URL, "email-mcp")
        self._calendar = MCPClient(MCP_CALENDAR_URL, "calendar-mcp")
        self._storage = MCPClient(MCP_STORAGE_URL, "storage-mcp")
        self._esign = MCPClient(MCP_ESIGN_URL, "esign-mcp")
        self._billing = MCPClient(MCP_BILLING_URL, "billing-mcp")
        self._court = MCPClient(MCP_COURT_URL, "court-mcp")
        self._communication = MCPClient(MCP_COMMUNICATION_URL, "communication-mcp")
        self._crm = MCPClient(MCP_CRM_URL, "crm-mcp")
        # Tier 3
        self._workflow = MCPClient(MCP_WORKFLOW_URL, "workflow-mcp")
        self._ocr = MCPClient(MCP_OCR_URL, "ocr-mcp")
        self._translation = MCPClient(MCP_TRANSLATION_URL, "translation-mcp")
        self._video = MCPClient(MCP_VIDEO_URL, "video-mcp")
        self._time = MCPClient(MCP_TIME_URL, "time-mcp")
        self._conflict = MCPClient(MCP_CONFLICT_URL, "conflict-mcp")

        self._bridges: Dict[str, MCPToolBridge] = {}
        self._all_tools_cache: Dict[str, list] = {}

    def _get_bridge(self, server: str) -> MCPToolBridge:
        if server in self._bridges:
            return self._bridges[server]

        if server == "postgres":
            bridge = MCPToolBridge(self._postgres, POSTGRES_TOOLS_MAP)
        elif server == "cloudflare":
            bridge = MCPToolBridge(self._cloudflare, CLOUDFLARE_TOOLS_MAP)
        elif server == "document":
            bridge = MCPToolBridge(self._document, DOCUMENT_TOOLS_MAP)
        elif server == "email":
            bridge = MCPToolBridge(self._email, EMAIL_TOOLS_MAP)
        elif server == "calendar":
            bridge = MCPToolBridge(self._calendar, CALENDAR_TOOLS_MAP)
        elif server == "storage":
            bridge = MCPToolBridge(self._storage, STORAGE_TOOLS_MAP)
        elif server == "esign":
            bridge = MCPToolBridge(self._esign, ESIGN_TOOLS_MAP)
        elif server == "billing":
            bridge = MCPToolBridge(self._billing, BILLING_TOOLS_MAP)
        elif server == "court":
            bridge = MCPToolBridge(self._court, COURT_TOOLS_MAP)
        elif server == "communication":
            bridge = MCPToolBridge(self._communication, COMMUNICATION_TOOLS_MAP)
        elif server == "crm":
            bridge = MCPToolBridge(self._crm, CRM_TOOLS_MAP)
        elif server == "workflow":
            bridge = MCPToolBridge(self._workflow, WORKFLOW_TOOLS_MAP)
        elif server == "ocr":
            bridge = MCPToolBridge(self._ocr, OCR_TOOLS_MAP)
        elif server == "translation":
            bridge = MCPToolBridge(self._translation, TRANSLATION_TOOLS_MAP)
        elif server == "video":
            bridge = MCPToolBridge(self._video, VIDEO_TOOLS_MAP)
        elif server == "time":
            bridge = MCPToolBridge(self._time, TIME_TOOLS_MAP)
        elif server == "conflict":
            bridge = MCPToolBridge(self._conflict, CONFLICT_TOOLS_MAP)
        else:
            raise ValueError(f"Unknown MCP server: {server}")

        self._bridges[server] = bridge
        return bridge

    def get_crew_tools(self, servers: List[str]) -> list:
        """Get all MCP tool functions for a crew, given its required servers.

        Returns a list of Python functions ready for CrewAI Agent(tools=[...]).
        Falls back gracefully if MCP servers are unreachable — tools will
        return error JSON instead of crashing.
        """
        cache_key = ",".join(sorted(servers))
        if cache_key in self._all_tools_cache:
            return self._all_tools_cache[cache_key]

        tools = []
        for server in servers:
            try:
                bridge = self._get_bridge(server)
                server_tools = bridge.get_all_tools()
                tools.extend(server_tools)
                logger.info("MCP: loaded %d tools from %s", len(server_tools), server)
            except Exception as e:
                logger.warning("MCP: could not load tools from %s: %s", server, e)

        self._all_tools_cache[cache_key] = tools
        return tools

    def health_check(self) -> Dict[str, Any]:
        """Check health of all 18 MCP servers."""
        return {
            "t1-core": {
                "postgres-mcp": self._postgres.health(),
                "cloudflare-mcp": self._cloudflare.health(),
                "document-mcp": self._document.health(),
            },
            "t2-required": {
                "email-mcp": self._email.health(),
                "calendar-mcp": self._calendar.health(),
                "storage-mcp": self._storage.health(),
                "esign-mcp": self._esign.health(),
                "billing-mcp": self._billing.health(),
                "court-mcp": self._court.health(),
                "communication-mcp": self._communication.health(),
                "crm-mcp": self._crm.health(),
            },
            "t3-nice-to-have": {
                "workflow-mcp": self._workflow.health(),
                "ocr-mcp": self._ocr.health(),
                "translation-mcp": self._translation.health(),
                "video-mcp": self._video.health(),
                "time-mcp": self._time.health(),
                "conflict-mcp": self._conflict.health(),
            },
        }

    def discover_tools(self) -> Dict[str, int]:
        """Query registry to discover all available tools."""
        registry_client = MCPClient(MCP_REGISTRY_URL, "mcp-registry")
        result = registry_client.call("discover")
        if "error" in result:
            return {"error": str(result["error"])}
        tools = result.get("allTools", [])
        return {
            "total_tools": len(tools),
            "by_server": {
                s: len([t for t in tools if t.get("server") == s])
                for s in ["postgres-mcp", "cloudflare-mcp", "document-mcp"]
            },
        }


# Singleton
mcp_registry = MCPToolRegistry()
