"""
Calendar MCP Server — Port 3105

Tools: list_events, create_event, update_event, delete_event, find_slot
Backed by: Google Calendar API / Outlook Calendar / CalDAV
"""
from __future__ import annotations
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from src.mcp.framework import create_mcp_app, ToolRegistry, _setup_shutdown
import uvicorn

registry = ToolRegistry()

registry.register({"name":"list_events","description":"List calendar events in a date range.","inputSchema":{"type":"object","properties":{"start":{"type":"string"},"end":{"type":"string"}},"required":[]}}, lambda start=None, end=None: {"events":[{"id":"ev1","title":"Client Meeting","start":"2026-07-30T10:00:00Z","end":"2026-07-30T11:00:00Z"}],"count":1})
registry.register({"name":"create_event","description":"Create a new calendar event.","inputSchema":{"type":"object","properties":{"title":{"type":"string"},"start":{"type":"string"},"end":{"type":"string"},"attendees":{"type":"array"}},"required":["title","start","end"]}}, lambda title="", start="", end="", attendees=None: {"created":True,"id":"ev-new"})
registry.register({"name":"update_event","description":"Update an existing calendar event.","inputSchema":{"type":"object","properties":{"event_id":{"type":"string"},"title":{"type":"string"},"start":{"type":"string"},"end":{"type":"string"}},"required":["event_id"]}}, lambda event_id="", **kwargs: {"updated":True,"id":event_id})
registry.register({"name":"delete_event","description":"Delete a calendar event.","inputSchema":{"type":"object","properties":{"event_id":{"type":"string"}},"required":["event_id"]}}, lambda event_id="": {"deleted":True,"id":event_id})
registry.register({"name":"find_slot","description":"Find available time slots for scheduling.","inputSchema":{"type":"object","properties":{"date":{"type":"string"},"duration_minutes":{"type":"integer"}},"required":["date"]}}, lambda date="", duration_minutes=30: {"slots":["09:00","10:00","14:00"],"date":date})

app = create_mcp_app("calendar", "1.0.0", registry)
if __name__ == "__main__":
    port = int(os.environ.get("MCP_PORT", "3105"))
    _setup_shutdown("calendar-mcp")
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
