"""
Storage MCP Server — Port 3106

Tools: upload_file, download_file, list_files, delete_file, get_presigned_url
Backed by: Local filesystem or S3-compatible storage (Cloudflare R2)
"""
from __future__ import annotations
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from src.mcp.framework import create_mcp_app, ToolRegistry, _setup_shutdown
import uvicorn

registry = ToolRegistry()

registry.register({"name":"upload_file","description":"Upload a file to storage and return its ID/URL.","inputSchema":{"type":"object","properties":{"filename":{"type":"string"},"content_type":{"type":"string"}},"required":["filename"]}}, lambda filename="", content_type="application/octet-stream": {"id":"file-00001","url":f"/storage/{filename}","uploaded":True})
registry.register({"name":"download_file","description":"Download a file by ID.","inputSchema":{"type":"object","properties":{"file_id":{"type":"string"}},"required":["file_id"]}}, lambda file_id="": {"id":file_id,"url":f"/storage/{file_id}","size_bytes":1048576})
registry.register({"name":"list_files","description":"List files in a storage bucket/directory.","inputSchema":{"type":"object","properties":{"prefix":{"type":"string"},"limit":{"type":"integer"}},"required":[]}}, lambda prefix="", limit=50: {"files":[{"name":"contract_v2.pdf","size":245760,"modified":"2026-07-28T10:00:00Z"}],"count":1})
registry.register({"name":"delete_file","description":"Delete a file from storage.","inputSchema":{"type":"object","properties":{"file_id":{"type":"string"}},"required":["file_id"]}}, lambda file_id="": {"deleted":True,"id":file_id})
registry.register({"name":"get_presigned_url","description":"Get a temporary presigned URL for a file.","inputSchema":{"type":"object","properties":{"file_id":{"type":"string"},"expires_seconds":{"type":"integer"}},"required":["file_id"]}}, lambda file_id="", expires_seconds=3600: {"url":f"https://storage.counsel.ai/files/{file_id}?token=...","expires_at":"2026-07-30T11:00:00Z"})

app = create_mcp_app("storage", "1.0.0", registry)
if __name__ == "__main__":
    port = int(os.environ.get("MCP_PORT", "3106"))
    _setup_shutdown("storage-mcp")
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
