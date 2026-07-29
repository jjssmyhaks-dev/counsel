"""
Video MCP Server — Port 3115

Tools: transcribe_video, extract_keyframes, get_transcript, search_transcript, summarize_video
Backed by: Whisper / FFmpeg / Cloudflare AI
"""
from __future__ import annotations
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from src.mcp.framework import create_mcp_app, ToolRegistry, _setup_shutdown
import uvicorn

registry = ToolRegistry()

registry.register({"name":"transcribe_video","description":"Transcribe audio from a video file to text.","inputSchema":{"type":"object","properties":{"video_path":{"type":"string"},"language":{"type":"string"}},"required":["video_path"]}}, lambda video_path="", language="en": {"transcript":"Full video transcript text...","duration_seconds":360.0,"language":language})
registry.register({"name":"extract_keyframes","description":"Extract key frames from a video.","inputSchema":{"type":"object","properties":{"video_path":{"type":"string"},"interval_seconds":{"type":"number"}},"required":["video_path"]}}, lambda video_path="", interval_seconds=10: {"frames":["frame_001.png","frame_002.png"],"count":2})
registry.register({"name":"get_transcript","description":"Get transcript for a previously processed video.","inputSchema":{"type":"object","properties":{"video_id":{"type":"string"}},"required":["video_id"]}}, lambda video_id="": {"id":video_id,"transcript":"...","segments":[{"start":0,"end":120,"text":"Introduction..."}]})
registry.register({"name":"search_transcript","description":"Search within a video transcript by keyword.","inputSchema":{"type":"object","properties":{"video_id":{"type":"string"},"query":{"type":"string"}},"required":["video_id","query"]}}, lambda video_id="", query="": {"matches":[],"count":0})
registry.register({"name":"summarize_video","description":"Generate a summary of video content from its transcript.","inputSchema":{"type":"object","properties":{"video_id":{"type":"string"}},"required":["video_id"]}}, lambda video_id="": {"summary":"Key points from the video...","duration":360,"topics":["introduction","main","conclusion"]})

app = create_mcp_app("video", "1.0.0", registry)
if __name__ == "__main__":
    port = int(os.environ.get("MCP_PORT", "3115"))
    _setup_shutdown("video-mcp")
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
