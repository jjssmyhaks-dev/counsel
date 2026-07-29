"""
Workflow MCP Server — Port 3112

Tools: create_workflow, get_workflow_status, trigger_step, list_workflows, cancel_workflow
Backed by: Temporal / internal workflow engine
"""
from __future__ import annotations
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from src.mcp.framework import create_mcp_app, ToolRegistry, _setup_shutdown
import uvicorn

registry = ToolRegistry()

registry.register({"name":"create_workflow","description":"Create a new automated workflow (e.g., client onboarding, contract review).","inputSchema":{"type":"object","properties":{"name":{"type":"string"},"steps":{"type":"array"}},"required":["name","steps"]}}, lambda name="", steps=None: {"workflow_id":"wf-001","status":"created","steps":len(steps or [])})
registry.register({"name":"get_workflow_status","description":"Get the current step and status of a workflow.","inputSchema":{"type":"object","properties":{"workflow_id":{"type":"string"}},"required":["workflow_id"]}}, lambda workflow_id="": {"id":workflow_id,"status":"running","current_step":2,"total_steps":5,"progress":0.4})
registry.register({"name":"trigger_step","description":"Manually advance/trigger a specific workflow step.","inputSchema":{"type":"object","properties":{"workflow_id":{"type":"string"},"step":{"type":"string"}},"required":["workflow_id","step"]}}, lambda workflow_id="", step="": {"triggered":True,"workflow_id":workflow_id,"step":step})
registry.register({"name":"list_workflows","description":"List all workflows for a firm.","inputSchema":{"type":"object","properties":{"firm_id":{"type":"string"}},"required":[]}}, lambda firm_id=None: {"workflows":[{"id":"wf-001","name":"Contract Review Pipeline","status":"active"}],"count":1})
registry.register({"name":"cancel_workflow","description":"Cancel a running workflow.","inputSchema":{"type":"object","properties":{"workflow_id":{"type":"string"},"reason":{"type":"string"}},"required":["workflow_id"]}}, lambda workflow_id="", reason="": {"cancelled":True,"id":workflow_id})

app = create_mcp_app("workflow", "1.0.0", registry)
if __name__ == "__main__":
    port = int(os.environ.get("MCP_PORT", "3112"))
    _setup_shutdown("workflow-mcp")
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
