"""
CRM MCP Server — Port 3111

Tools: search_contacts, get_contact, create_contact, update_contact, list_organizations
Backed by: Salesforce / HubSpot / internal CRM DB
"""
from __future__ import annotations
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from src.mcp.framework import create_mcp_app, ToolRegistry, _setup_shutdown
import uvicorn

registry = ToolRegistry()

registry.register({"name":"search_contacts","description":"Search CRM contacts by name, email, or company.","inputSchema":{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}}, lambda query="": {"contacts":[{"id":"c1","name":"Jane Smith","email":"jane@acme.com","company":"Acme Corp"}],"count":1})
registry.register({"name":"get_contact","description":"Get detailed contact by ID.","inputSchema":{"type":"object","properties":{"contact_id":{"type":"string"}},"required":["contact_id"]}}, lambda contact_id="": {"id":contact_id,"name":"Jane Smith","email":"jane@acme.com","phone":"+1-555-0100"})
registry.register({"name":"create_contact","description":"Create a new contact in the CRM.","inputSchema":{"type":"object","properties":{"name":{"type":"string"},"email":{"type":"string"},"company":{"type":"string"}},"required":["name"]}}, lambda name="", email="", company="": {"created":True,"id":"c-new"})
registry.register({"name":"update_contact","description":"Update an existing contact.","inputSchema":{"type":"object","properties":{"contact_id":{"type":"string"},"name":{"type":"string"},"email":{"type":"string"}},"required":["contact_id"]}}, lambda contact_id="", **kwargs: {"updated":True,"id":contact_id})
registry.register({"name":"list_organizations","description":"List companies/organizations in the CRM.","inputSchema":{"type":"object","properties":{"limit":{"type":"integer"}},"required":[]}}, lambda limit=50: {"organizations":[{"id":"o1","name":"Acme Corp","industry":"Technology"}],"count":1})

app = create_mcp_app("crm", "1.0.0", registry)
if __name__ == "__main__":
    port = int(os.environ.get("MCP_PORT", "3111"))
    _setup_shutdown("crm-mcp")
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
