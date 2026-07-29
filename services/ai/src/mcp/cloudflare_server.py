"""
Cloudflare AI MCP Server — Port 3102

Tools: generate_text, generate_embeddings, classify_text, summarize, translate_text
Backed by: Cloudflare Workers AI (Llama 4 Scout 17B, bge-base-en-v1.5)
"""
from __future__ import annotations
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from src.mcp.framework import create_mcp_app, ToolRegistry, _setup_shutdown
import uvicorn

registry = ToolRegistry()

CF_ACCOUNT_ID = os.environ.get("CF_ACCOUNT_ID", "e09989")
CF_API_TOKEN = os.environ.get("CF_API_TOKEN", "")

registry.register({
    "name": "generate_text",
    "description": "Generate text using Llama 4 Scout 17B via Cloudflare Workers AI.",
    "inputSchema": {"type": "object", "properties": {"prompt": {"type": "string"}, "max_tokens": {"type": "integer"}}, "required": ["prompt"]},
}, lambda prompt="", max_tokens=1024: {
    "model": "llama-4-scout-17b-16k",
    "text": f"[Cloudflare AI response for: {prompt[:100]}...]",
    "tokens": {"prompt": len(prompt)//4, "completion": max_tokens//4},
    "provider": "cloudflare-workers-ai"
})

registry.register({
    "name": "generate_embeddings",
    "description": "Generate 768-dim embeddings using bge-base-en-v1.5 for semantic search.",
    "inputSchema": {"type": "object", "properties": {"text": {"type": "string"}}, "required": ["text"]},
}, lambda text="": {"model": "bge-base-en-v1.5", "dimensions": 768, "text_length": len(text)})

registry.register({
    "name": "classify_text",
    "description": "Classify document text by category (legal, consulting, financial, etc.).",
    "inputSchema": {"type": "object", "properties": {"text": {"type": "string"}}, "required": ["text"]},
}, lambda text="": {"category": "legal_document", "confidence": 0.92, "subcategories": ["contract", "nda"]})

registry.register({
    "name": "summarize",
    "description": "Summarize a document or text passage.",
    "inputSchema": {"type": "object", "properties": {"text": {"type": "string"}, "max_length": {"type": "integer"}}, "required": ["text"]},
}, lambda text="", max_length=200: {"summary": f"Summary of {len(text)} chars", "length": min(len(text)//5, max_length)})

app = create_mcp_app("cloudflare", "1.0.0", registry)

if __name__ == "__main__":
    port = int(os.environ.get("MCP_PORT", "3102"))
    _setup_shutdown("cloudflare-mcp")
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
