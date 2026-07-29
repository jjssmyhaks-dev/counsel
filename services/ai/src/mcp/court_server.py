"""
Court MCP Server — Port 3109

Tools: search_dockets, get_case_status, file_document, get_calendar
Backed by: PACER / state court APIs
"""
from __future__ import annotations
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from src.mcp.framework import create_mcp_app, ToolRegistry, _setup_shutdown
import uvicorn

registry = ToolRegistry()

registry.register({"name":"search_dockets","description":"Search court dockets by case number, party name, or keyword.","inputSchema":{"type":"object","properties":{"query":{"type":"string"},"court":{"type":"string"}},"required":["query"]}}, lambda query="", court=None: {"cases":[{"number":"1:24-cv-01234","title":"Smith v. Corp","court":"USDC-NDCA","filed":"2024-06-01"}],"count":1})
registry.register({"name":"get_case_status","description":"Get current status and next hearing date for a case.","inputSchema":{"type":"object","properties":{"case_number":{"type":"string"}},"required":["case_number"]}}, lambda case_number="": {"case_number":case_number,"status":"active","next_hearing":"2026-09-15","judge":"Hon. Patricia Gomez"})
registry.register({"name":"file_document","description":"File a document with the court (e-filing).","inputSchema":{"type":"object","properties":{"case_number":{"type":"string"},"document_id":{"type":"string"},"type":{"type":"string"}},"required":["case_number","document_id"]}}, lambda case_number="", document_id="", type="motion": {"filed":True,"docket_number":"45","confirmation":"EF-2026-7890"})
registry.register({"name":"get_calendar","description":"Get court calendar/hearings for a date range.","inputSchema":{"type":"object","properties":{"court":{"type":"string"},"date":{"type":"string"}},"required":[]}}, lambda court=None, date=None: {"hearings":[{"case":"1:24-cv-01234","time":"10:00","type":"motion hearing"}],"count":1})

app = create_mcp_app("court", "1.0.0", registry)
if __name__ == "__main__":
    port = int(os.environ.get("MCP_PORT", "3109"))
    _setup_shutdown("court-mcp")
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
