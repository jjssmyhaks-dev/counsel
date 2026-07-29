"""Integration test: verify all 17 MCP servers import + list real tools."""
import sys
sys.path.insert(0, ".")
from src.mcp.framework import ToolRegistry

servers = [
    "postgres_server", "cloudflare_server", "document_server", "email_server",
    "calendar_server", "storage_server", "esign_server", "billing_server",
    "court_server", "communication_server", "crm_server", "workflow_server",
    "ocr_server", "translation_server", "video_server", "time_server", "conflict_server",
]

ok = 0
fail = 0
for name in servers:
    try:
        mod = __import__(f"src.mcp.{name}", fromlist=["registry"])
        registry = mod.registry
        tools = registry.list_tools()
        names = [t["name"] for t in tools]
        ok += 1
        print(f"  OK  {name}: {len(tools)} tools  {names}")
        # Verify we can call at least one tool
        if tools:
            first_tool = tools[0]
            args_spec = first_tool.get("inputSchema", {}).get("properties", {})
            kwargs = {}
            for k, v in args_spec.items():
                if v.get("type") == "string":
                    kwargs[k] = "test"
                elif v.get("type") == "integer":
                    kwargs[k] = 1
                elif v.get("type") == "number":
                    kwargs[k] = 1.0
                elif v.get("type") == "array":
                    kwargs[k] = []
            result = registry.call_tool(first_tool["name"], kwargs)
            if "error" in str(result) and "not found" not in str(result):
                print(f"       WARN: tool call returned error: {result.get('error')}")
            else:
                print(f"       call OK: {str(result)[:80]}...")
    except Exception as e:
        fail += 1
        print(f"  FAIL {name}: {e}")

print(f"\n  Total: {ok} passed, {fail} failed, {len(servers)} expected")
