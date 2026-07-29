# MCP servers package
# Each module is an independently runnable FastAPI server.
# Import the framework and individual servers as needed.
#
# Usage:
#   python -m src.mcp.postgres_server      -> Port 3101
#   python -m src.mcp.cloudflare_server    -> Port 3102
#   ... etc for all 17 servers
#
# Start all at once:
#   node scripts/start-mcp-servers.cjs
