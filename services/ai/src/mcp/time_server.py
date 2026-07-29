"""
Time MCP Server — Port 3116

Tools: start_timer, stop_timer, get_timesheet, create_entry, list_entries
Backed by: Internal billing/time tracking database
"""
from __future__ import annotations
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from src.mcp.framework import create_mcp_app, ToolRegistry, _setup_shutdown
import uvicorn

registry = ToolRegistry()

registry.register({"name":"start_timer","description":"Start a time tracking timer for a matter/task.","inputSchema":{"type":"object","properties":{"matter_id":{"type":"string"},"description":{"type":"string"}},"required":["matter_id"]}}, lambda matter_id="", description="": {"timer_id":"tmr-001","started_at":"2026-07-30T00:00:00Z","matter_id":matter_id})
registry.register({"name":"stop_timer","description":"Stop a running timer and save the time entry.","inputSchema":{"type":"object","properties":{"timer_id":{"type":"string"}},"required":["timer_id"]}}, lambda timer_id="": {"stopped":True,"duration_minutes":45,"billable":True,"entry_id":"entry-001"})
registry.register({"name":"get_timesheet","description":"Get timesheet for a user in a date range.","inputSchema":{"type":"object","properties":{"user_id":{"type":"string"},"start_date":{"type":"string"},"end_date":{"type":"string"}},"required":["user_id"]}}, lambda user_id="", start_date=None, end_date=None: {"entries":[{"id":"e1","matter":"Merger Due Diligence","hours":2.5,"date":"2026-07-29"}],"total_hours":2.5})
registry.register({"name":"create_entry","description":"Manually create a time entry.","inputSchema":{"type":"object","properties":{"matter_id":{"type":"string"},"hours":{"type":"number"},"description":{"type":"string"},"date":{"type":"string"}},"required":["matter_id","hours"]}}, lambda matter_id="", hours=0, description="", date="": {"created":True,"entry_id":"entry-002","hours":hours})
registry.register({"name":"list_entries","description":"List time entries with filters.","inputSchema":{"type":"object","properties":{"user_id":{"type":"string"},"matter_id":{"type":"string"},"billed":{"type":"boolean"}},"required":[]}}, lambda user_id=None, matter_id=None, billed=None: {"entries":[],"count":0})

app = create_mcp_app("time", "1.0.0", registry)
if __name__ == "__main__":
    port = int(os.environ.get("MCP_PORT", "3116"))
    _setup_shutdown("time-mcp")
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
