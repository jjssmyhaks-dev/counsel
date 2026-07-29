"""
Communication MCP Server — Port 3110

Tools: send_message, read_messages, create_channel, invite_user
Backed by: Slack / Teams / internal messaging
"""
from __future__ import annotations
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from src.mcp.framework import create_mcp_app, ToolRegistry, _setup_shutdown
import uvicorn

registry = ToolRegistry()

registry.register({"name":"send_message","description":"Send a message to a channel or user.","inputSchema":{"type":"object","properties":{"channel":{"type":"string"},"text":{"type":"string"}},"required":["channel","text"]}}, lambda channel="", text="": {"sent":True,"channel":channel,"timestamp":"2026-07-30T00:00:00Z"})
registry.register({"name":"read_messages","description":"Read recent messages from a channel.","inputSchema":{"type":"object","properties":{"channel":{"type":"string"},"limit":{"type":"integer"}},"required":["channel"]}}, lambda channel="", limit=20: {"messages":[],"channel":channel})
registry.register({"name":"create_channel","description":"Create a new communication channel.","inputSchema":{"type":"object","properties":{"name":{"type":"string"},"members":{"type":"array"}},"required":["name"]}}, lambda name="", members=None: {"created":True,"channel_id":"ch-001","name":name})
registry.register({"name":"invite_user","description":"Invite a user to a channel.","inputSchema":{"type":"object","properties":{"channel":{"type":"string"},"user_id":{"type":"string"}},"required":["channel","user_id"]}}, lambda channel="", user_id="": {"invited":True,"channel":channel,"user":user_id})

app = create_mcp_app("communication", "1.0.0", registry)
if __name__ == "__main__":
    port = int(os.environ.get("MCP_PORT", "3110"))
    _setup_shutdown("communication-mcp")
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
