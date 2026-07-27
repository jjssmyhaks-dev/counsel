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
        """Check health of all MCP servers."""
        return {
            "postgres-mcp": self._postgres.health(),
            "cloudflare-mcp": self._cloudflare.health(),
            "document-mcp": self._document.health(),
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
