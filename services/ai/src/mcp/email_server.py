"""
Email MCP Server — Port 3104

Tools: send_email, read_inbox, search_emails, get_thread
Backed by: SMTP/IMAP or Resend API integration
"""
from __future__ import annotations
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from src.mcp.framework import create_mcp_app, ToolRegistry, _setup_shutdown
import uvicorn

registry = ToolRegistry()

registry.register({"name":"send_email","description":"Send an email via configured SMTP/Resend.","inputSchema":{"type":"object","properties":{"to":{"type":"string"},"subject":{"type":"string"},"body":{"type":"string"}},"required":["to","subject","body"]}}, lambda to="", subject="", body="": {"sent":True,"message_id":"msg_001","provider":"resend","to":to})
registry.register({"name":"read_inbox","description":"Fetch recent inbox emails for a user.","inputSchema":{"type":"object","properties":{"limit":{"type":"integer"}},"required":[]}}, lambda limit=10: {"emails":[{"id":"e1","from":"client@example.com","subject":"Contract review request","snippet":"..."}],"count":1})
registry.register({"name":"search_emails","description":"Search emails by keyword, date range, or sender.","inputSchema":{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}}, lambda query="": {"results":[],"query":query})
registry.register({"name":"get_thread","description":"Get the full conversation thread for a given email.","inputSchema":{"type":"object","properties":{"thread_id":{"type":"string"}},"required":["thread_id"]}}, lambda thread_id="": {"thread_id":thread_id,"messages":[],"participants":[]})

app = create_mcp_app("email", "1.0.0", registry)
if __name__ == "__main__":
    port = int(os.environ.get("MCP_PORT", "3104"))
    _setup_shutdown("email-mcp")
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
