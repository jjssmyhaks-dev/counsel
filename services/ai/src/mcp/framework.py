"""
Real MCP Server Framework — Counsel Platform

Each MCP category runs as an independent FastAPI process exposing
JSON-RPC 2.0 tools.list and tools/call endpoints.

Usage:
    python -m src.mcp.postgres_server    # Port 3101
    python -m src.mcp.cloudflare_server  # Port 3102
    ...

All servers follow the same pattern:
    GET  /health           -> {"status":"ok","server":"postgres","version":"1.0.0"}
    POST /mcp              -> JSON-RPC body with method=tools/list or tools/call
"""
from __future__ import annotations

import json
import logging
import os
import sys
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional
from functools import wraps

# Configure structured JSON logging
logging.basicConfig(
    level=logging.INFO,
    format='{"time":"%(asctime)s","level":"%(levelname)s","name":"%(name)s","message":"%(message)s"}',
    stream=sys.stdout,
)
logger = logging.getLogger("mcp-server")


# ── JSON-RPC 2.0 Response Helpers ──────────────────────────────────────────

def jsonrpc_result(id: Any, result: Any) -> Dict[str, Any]:
    return {"jsonrpc": "2.0", "id": id, "result": result}

def jsonrpc_error(id: Any, code: int, message: str) -> Dict[str, Any]:
    return {"jsonrpc": "2.0", "id": id, "error": {"code": code, "message": message}}

def jsonrpc_method_not_found(id: Any) -> Dict[str, Any]:
    return jsonrpc_error(id, -32601, "Method not found")


# ── Tool Registry ──────────────────────────────────────────────────────────

class ToolRegistry:
    """Registers tool definitions with real implementations."""

    def __init__(self):
        self._tools: Dict[str, Dict[str, Any]] = {}  # name -> {definition, handler}

    def register(self, definition: Dict[str, Any], handler: Callable):
        name = definition.get("name", "unknown")
        self._tools[name] = {"definition": definition, "handler": handler}

    def list_tools(self) -> List[Dict[str, Any]]:
        return [t["definition"] for t in self._tools.values()]

    def call_tool(self, name: str, arguments: Dict[str, Any]) -> Any:
        if name not in self._tools:
            return {"error": f"Tool '{name}' not found"}
        try:
            return self._tools[name]["handler"](**arguments)
        except Exception as e:
            logger.error("Tool %s failed: %s", name, e, exc_info=True)
            return {"error": str(e)}

    def has(self, name: str) -> bool:
        return name in self._tools


# ── FastAPI App Factory ────────────────────────────────────────────────────

def create_mcp_app(server_name: str, version: str, registry: ToolRegistry):
    """Create a FastAPI app exposing a standard MCP JSON-RPC endpoint."""
    from fastapi import FastAPI, Request
    from fastapi.responses import JSONResponse
    from fastapi.middleware.cors import CORSMiddleware

    app = FastAPI(
        title=f"Counsel MCP — {server_name}",
        version=version,
        docs_url=None,
        redoc_url=None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

    @app.get("/health")
    async def health():
        return {
            "status": "ok",
            "server": server_name,
            "version": version,
            "tool_count": len(registry.list_tools()),
            "tools": [t["name"] for t in registry.list_tools()],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    @app.post("/mcp")
    async def mcp_endpoint(req: Request):
        body = await req.json()
        req_id = body.get("id")
        method = body.get("method", "")
        params = body.get("params", {})

        logger.info("MCP request id=%s method=%s", req_id, method)

        if method == "tools/list":
            return JSONResponse(jsonrpc_result(req_id, {"tools": registry.list_tools()}))

        if method == "tools/call":
            tool_name = params.get("name", "")
            arguments = params.get("arguments", {})
            result = registry.call_tool(tool_name, arguments)
            return JSONResponse(jsonrpc_result(req_id, result))

        return JSONResponse(jsonrpc_method_not_found(req_id))

    return app


# ── Graceful Shutdown ─────────────────────────────────────────────────────

import signal as _signal

def _setup_shutdown(app_name: str):
    def _handler(sig, frame):
        logger.info("%s received signal %s, shutting down gracefully", app_name, sig)
        sys.exit(0)
    _signal.signal(_signal.SIGINT, _handler)
    _signal.signal(_signal.SIGTERM, _handler)
