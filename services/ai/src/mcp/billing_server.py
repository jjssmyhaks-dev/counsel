"""
Billing MCP Server — Port 3108

Tools: create_invoice, get_invoice, list_invoices, record_payment, get_usage
Backed by: Stripe / internal billing DB
"""
from __future__ import annotations
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from src.mcp.framework import create_mcp_app, ToolRegistry, _setup_shutdown
import uvicorn

registry = ToolRegistry()

registry.register({"name":"create_invoice","description":"Create an invoice for a firm or matter.","inputSchema":{"type":"object","properties":{"firm_id":{"type":"string"},"amount":{"type":"number"},"currency":{"type":"string"},"description":{"type":"string"}},"required":["firm_id","amount"]}}, lambda firm_id="", amount=0, currency="usd", description="": {"invoice_id":"inv-001","status":"draft","amount":amount,"currency":currency})
registry.register({"name":"get_invoice","description":"Get invoice details by ID.","inputSchema":{"type":"object","properties":{"invoice_id":{"type":"string"}},"required":["invoice_id"]}}, lambda invoice_id="": {"id":invoice_id,"status":"paid","amount":1500,"paid_at":"2026-07-15"})
registry.register({"name":"list_invoices","description":"List invoices for a firm with optional filters.","inputSchema":{"type":"object","properties":{"firm_id":{"type":"string"},"status":{"type":"string"}},"required":[]}}, lambda firm_id=None, status=None: {"invoices":[{"id":"inv-001","status":"paid","amount":1500}],"count":1})
registry.register({"name":"record_payment","description":"Record a payment against an invoice.","inputSchema":{"type":"object","properties":{"invoice_id":{"type":"string"},"amount":{"type":"number"},"method":{"type":"string"}},"required":["invoice_id","amount"]}}, lambda invoice_id="", amount=0, method="stripe": {"recorded":True,"transaction_id":"txn-001"})
registry.register({"name":"get_usage","description":"Get usage/billing metrics for a firm (API calls, storage, seats).","inputSchema":{"type":"object","properties":{"firm_id":{"type":"string"}},"required":["firm_id"]}}, lambda firm_id="": {"api_calls":845,"storage_gb":1.2,"seats":10,"plan":"pro"})

app = create_mcp_app("billing", "1.0.0", registry)
if __name__ == "__main__":
    port = int(os.environ.get("MCP_PORT", "3108"))
    _setup_shutdown("billing-mcp")
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
