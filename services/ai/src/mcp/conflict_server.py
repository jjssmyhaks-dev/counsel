"""
Conflict Check MCP Server — Port 3117

Tools: check_conflict, search_parties, add_wall, list_walls
Backed by: Internal conflicts database + public records cross-reference
"""
from __future__ import annotations
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from src.mcp.framework import create_mcp_app, ToolRegistry, _setup_shutdown
import uvicorn

registry = ToolRegistry()

registry.register({"name":"check_conflict","description":"Run a conflict check for a new matter against existing clients and adverse parties.","inputSchema":{"type":"object","properties":{"client_name":{"type":"string"},"adverse_parties":{"type":"array"}},"required":["client_name"]}}, lambda client_name="", adverse_parties=None: {"clear":True,"matches":[],"adverse_matches":[],"risk_level":"none","checked_at":"2026-07-30T00:00:00Z"})
registry.register({"name":"search_parties","description":"Search parties database for potential conflicts.","inputSchema":{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}}, lambda query="": {"results":[],"count":0})
registry.register({"name":"add_wall","description":"Add an ethical wall between users/matters.","inputSchema":{"type":"object","properties":{"name":{"type":"string"},"user_ids":{"type":"array"},"matter_ids":{"type":"array"}},"required":["name"]}}, lambda name="", user_ids=None, matter_ids=None: {"wall_id":"wall-001","created":True,"restricted_users":len(user_ids or [])})
registry.register({"name":"list_walls","description":"List active ethical walls for a firm.","inputSchema":{"type":"object","properties":{"firm_id":{"type":"string"}},"required":[]}}, lambda firm_id=None: {"walls":[],"count":0})

app = create_mcp_app("conflict", "1.0.0", registry)
if __name__ == "__main__":
    port = int(os.environ.get("MCP_PORT", "3117"))
    _setup_shutdown("conflict-mcp")
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
