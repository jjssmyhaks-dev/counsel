"""
eSign MCP Server — Port 3107

Tools: create_envelope, get_envelope_status, send_reminder, void_envelope, list_templates
Backed by: DocuSign / Dropbox Sign (HelloSign) API
"""
from __future__ import annotations
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from src.mcp.framework import create_mcp_app, ToolRegistry, _setup_shutdown
import uvicorn

registry = ToolRegistry()

registry.register({"name":"create_envelope","description":"Create a signing envelope with documents and recipients.","inputSchema":{"type":"object","properties":{"document_id":{"type":"string"},"signers":{"type":"array"},"message":{"type":"string"}},"required":["document_id","signers"]}}, lambda document_id="", signers=None, message="": {"envelope_id":"env-0001","status":"sent","signers":len(signers or [])})
registry.register({"name":"get_envelope_status","description":"Get the current status of a signing envelope.","inputSchema":{"type":"object","properties":{"envelope_id":{"type":"string"}},"required":["envelope_id"]}}, lambda envelope_id="": {"envelope_id":envelope_id,"status":"sent","signers":[{"name":"Jane Doe","status":"pending"}]})
registry.register({"name":"send_reminder","description":"Send a reminder email to pending signers.","inputSchema":{"type":"object","properties":{"envelope_id":{"type":"string"}},"required":["envelope_id"]}}, lambda envelope_id="": {"sent":True,"envelope_id":envelope_id})
registry.register({"name":"void_envelope","description":"Void a pending signing envelope.","inputSchema":{"type":"object","properties":{"envelope_id":{"type":"string"},"reason":{"type":"string"}},"required":["envelope_id"]}}, lambda envelope_id="", reason="": {"voided":True,"envelope_id":envelope_id,"reason":reason})
registry.register({"name":"list_templates","description":"List available signing templates.","inputSchema":{"type":"object","properties":{},"required":[]}}, lambda: {"templates":[{"id":"tpl-001","name":"Standard NDA","fields":12}]})

app = create_mcp_app("esign", "1.0.0", registry)
if __name__ == "__main__":
    port = int(os.environ.get("MCP_PORT", "3107"))
    _setup_shutdown("esign-mcp")
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
