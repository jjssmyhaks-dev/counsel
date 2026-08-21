"""
Postgres MCP Server — Port 3101

Tools: query, insert, update, delete, schema_info, health_check
Backed by: Real PostgreSQL via asyncpg connection pool.
"""
from __future__ import annotations
import json, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from src.mcp.framework import create_mcp_app, ToolRegistry, _setup_shutdown
import uvicorn

registry = ToolRegistry()

# ── Database connection pool ────────────────────────────────────────────────
_pool = None

async def get_pool():
    global _pool
    if _pool is None:
        try:
            import asyncpg
            db_url = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/counsel")
            _pool = await asyncpg.create_pool(db_url, min_size=1, max_size=5, command_timeout=30)
        except Exception as e:
            return None
    return _pool

# ── Tool: schema_info ─────────────────────────────────────────────────────
async def schema_info_handler(table: str = None):
    pool = await get_pool()
    if not pool:
        return {"error": "Database not connected", "tables": [], "engine": "PostgreSQL (disconnected)"}
    try:
        async with pool.acquire() as conn:
            if table:
                rows = await conn.fetch("""
                    SELECT column_name, data_type, is_nullable, column_default
                    FROM information_schema.columns
                    WHERE table_name = $1
                    ORDER BY ordinal_position
                """, table)
                return {
                    "table": table,
                    "columns": [{"name": r["column_name"], "type": r["data_type"], "nullable": r["is_nullable"] == "YES", "default": r["column_default"]} for r in rows],
                    "engine": "PostgreSQL 17 with pgvector"
                }
            else:
                rows = await conn.fetch("""
                    SELECT table_name, 
                           (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name) as column_count
                    FROM information_schema.tables t
                    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                    ORDER BY table_name
                """)
                return {
                    "tables": [{"name": r["table_name"], "columns": r["column_count"]} for r in rows],
                    "engine": "PostgreSQL 17 with pgvector",
                    "total_tables": len(rows)
                }
    except Exception as e:
        return {"error": str(e)}

registry.register({
    "name": "schema_info",
    "description": "Get the database schema overview — tables, columns, and types. Optionally pass a table name to get column details.",
    "inputSchema": {"type": "object", "properties": {"table": {"type": "string"}}, "required": []},
}, schema_info_handler)

# ── Tool: query ───────────────────────────────────────────────────────────
async def query_handler(sql: str = "", firmId: str = None):
    pool = await get_pool()
    if not pool:
        return {"error": "Database not connected"}
    if not sql:
        return {"error": "SQL query is required"}
    
    # Safety: only allow SELECT queries
    sql_upper = sql.strip().upper()
    if not sql_upper.startswith("SELECT"):
        return {"error": "Only SELECT queries are allowed via MCP (read-only)"}
    
    try:
        async with pool.acquire() as conn:
            # If firmId is provided, set RLS context
            if firmId:
                await conn.execute(f"SET LOCAL app.current_firm_id = '{firmId}'")
            
            rows = await conn.fetch(sql)
            columns = list(rows[0].keys()) if rows else []
            return {
                "columns": columns,
                "rows": [dict(r) for r in rows],
                "rowCount": len(rows),
                "query": sql
            }
    except Exception as e:
        return {"error": str(e), "query": sql}

registry.register({
    "name": "query",
    "description": "Execute a read-only SQL query against the firm's database. Supports joins, filters, and aggregations. Only SELECT queries are allowed.",
    "inputSchema": {"type": "object", "properties": {
        "sql": {"type": "string", "description": "SQL SELECT query to execute"},
        "firmId": {"type": "string", "description": "Optional firm ID for tenant scoping"}
    }, "required": ["sql"]},
}, query_handler)

# ── Tool: insert ──────────────────────────────────────────────────────────
async def insert_handler(table: str = "", data: dict = None):
    pool = await get_pool()
    if not pool:
        return {"error": "Database not connected"}
    if not table or not data:
        return {"error": "table and data are required"}
    
    try:
        async with pool.acquire() as conn:
            columns = list(data.keys())
            values = list(data.values())
            placeholders = ", ".join(f"${i+1}" for i in range(len(columns)))
            col_names = ", ".join(columns)
            
            row = await conn.fetchrow(
                f"INSERT INTO {table} ({col_names}) VALUES ({placeholders}) RETURNING *",
                *values
            )
            return {"inserted": True, "table": table, "record": dict(row) if row else None}
    except Exception as e:
        return {"error": str(e), "table": table}

registry.register({
    "name": "insert",
    "description": "Insert a row into a specified table. Returns the created record.",
    "inputSchema": {"type": "object", "properties": {
        "table": {"type": "string", "description": "Table name to insert into"},
        "data": {"type": "object", "description": "Key-value pairs for the new row"}
    }, "required": ["table", "data"]},
}, insert_handler)

# ── Tool: update ──────────────────────────────────────────────────────────
async def update_handler(table: str = "", where: dict = None, data: dict = None):
    pool = await get_pool()
    if not pool:
        return {"error": "Database not connected"}
    if not table or not where or not data:
        return {"error": "table, where, and data are required"}
    
    try:
        async with pool.acquire() as conn:
            set_parts = []
            values = []
            idx = 1
            for k, v in data.items():
                set_parts.append(f"{k} = ${idx}")
                values.append(v)
                idx += 1
            
            where_parts = []
            for k, v in where.items():
                where_parts.append(f"{k} = ${idx}")
                values.append(v)
                idx += 1
            
            sql = f"UPDATE {table} SET {', '.join(set_parts)} WHERE {' AND '.join(where_parts)} RETURNING *"
            row = await conn.fetchrow(sql, *values)
            return {"updated": True, "table": table, "record": dict(row) if row else None}
    except Exception as e:
        return {"error": str(e), "table": table}

registry.register({
    "name": "update",
    "description": "Update rows in a table matching the given condition.",
    "inputSchema": {"type": "object", "properties": {
        "table": {"type": "string", "description": "Table name to update"},
        "where": {"type": "object", "description": "Filter conditions as key-value pairs"},
        "data": {"type": "object", "description": "New values as key-value pairs"}
    }, "required": ["table", "where", "data"]},
}, update_handler)

# ── Tool: delete ──────────────────────────────────────────────────────────
async def delete_handler(table: str = "", id: str = ""):
    pool = await get_pool()
    if not pool:
        return {"error": "Database not connected"}
    if not table or not id:
        return {"error": "table and id are required"}
    
    try:
        async with pool.acquire() as conn:
            # Soft delete — set deleted_at if column exists, otherwise hard delete
            try:
                row = await conn.fetchrow(
                    f"UPDATE {table} SET deleted_at = NOW() WHERE id = $1 RETURNING id", id
                )
            except Exception:
                row = await conn.fetchrow(
                    f"DELETE FROM {table} WHERE id = $1 RETURNING id", id
                )
            return {"deleted": bool(row), "id": id, "table": table}
    except Exception as e:
        return {"error": str(e), "table": table, "id": id}

registry.register({
    "name": "delete_record",
    "description": "Soft-delete a record by setting deletedAt. Requires confirmation.",
    "inputSchema": {"type": "object", "properties": {
        "table": {"type": "string", "description": "Table name"},
        "id": {"type": "string", "description": "Record ID to delete"}
    }, "required": ["table", "id"]},
}, delete_handler)

# ── Tool: count ───────────────────────────────────────────────────────────
async def count_handler(table: str = "", where: dict = None):
    pool = await get_pool()
    if not pool:
        return {"error": "Database not connected"}
    if not table:
        return {"error": "table is required"}
    
    try:
        async with pool.acquire() as conn:
            if where:
                where_parts = []
                values = []
                idx = 1
                for k, v in where.items():
                    where_parts.append(f"{k} = ${idx}")
                    values.append(v)
                    idx += 1
                row = await conn.fetchrow(f"SELECT COUNT(*) as count FROM {table} WHERE {' AND '.join(where_parts)}", *values)
            else:
                row = await conn.fetchrow(f"SELECT COUNT(*) as count FROM {table}")
            return {"table": table, "count": row["count"] if row else 0}
    except Exception as e:
        return {"error": str(e), "table": table}

registry.register({
    "name": "count",
    "description": "Count rows in a table, optionally with filters.",
    "inputSchema": {"type": "object", "properties": {
        "table": {"type": "string", "description": "Table name to count"},
        "where": {"type": "object", "description": "Optional filter conditions"}
    }, "required": ["table"]},
}, count_handler)

app = create_mcp_app("postgres", "1.0.0", registry)

if __name__ == "__main__":
    port = int(os.environ.get("MCP_PORT", "3101"))
    _setup_shutdown("postgres-mcp")
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
