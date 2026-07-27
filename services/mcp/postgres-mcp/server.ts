#!/usr/bin/env node
// PostgreSQL MCP Server — direct database access for AI agents
// Capabilities: query, execute, schema-inspect, transaction management
// 
// Transport: stdio (for CrewAI agent tools) + HTTP (for monitoring)

import { MCPServer } from "../shared/server";
import { CircuitBreaker } from "../shared/circuit-breaker";
import * as dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const DB_URL = process.env.DATABASE_URL || 
  "postgresql://neondb_owner:npg_OomI1OaGwnqv@ep-super-math-aolcnxm7.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

// Dynamic import asyncpg at runtime (ESM compatibility)
let pool: any = null;
let pgLib: any = null;

async function getPool() {
  if (pool) return pool;
  pgLib = await import("asyncpg");
  pool = await pgLib.createPool(DB_URL, { minSize: 1, maxSize: 5 });
  console.error("[postgres-mcp] Connected to PostgreSQL");
  return pool;
}

const server = new MCPServer({
  name: "postgres-mcp",
  version: "1.0.0",
  transport: "stdio",
  capabilities: [
    {
      name: "pg_query",
      description: "Run a read-only SELECT query against the Counsel database. Use for fetching matters, documents, users, audit logs, etc.",
      schema: {
        type: "object",
        properties: {
          query: { type: "string", description: "SQL SELECT query" },
          params: { type: "array", description: "Query parameters", items: { type: "string" } },
        },
        required: ["query"],
      },
    },
    {
      name: "pg_execute",
      description: "Execute INSERT/UPDATE/DELETE statements. Use for creating matters, updating drafts, logging actions.",
      schema: {
        type: "object",
        properties: {
          query: { type: "string", description: "SQL statement" },
          params: { type: "array", description: "Query parameters" },
        },
        required: ["query"],
      },
    },
    {
      name: "pg_schema",
      description: "Get the database schema — tables, columns, types. Use when you need to know what data is available.",
      schema: { type: "object", properties: {} },
    },
    {
      name: "pg_health",
      description: "Check PostgreSQL connection health and pool stats.",
      schema: { type: "object", properties: {} },
    },
    {
      name: "pg_find_matters",
      description: "Find legal matters by firm, status, client name, or type.",
      schema: {
        type: "object",
        properties: {
          firm_id: { type: "string" },
          status: { type: "string", enum: ["ACTIVE", "CLOSED"] },
          type: { type: "string", enum: ["LEGAL", "CONSULTING"] },
          client_name: { type: "string" },
          limit: { type: "number", default: 20 },
        },
        required: ["firm_id"],
      },
    },
    {
      name: "pg_find_documents",
      description: "Find documents by firm, matter, status.",
      schema: {
        type: "object",
        properties: {
          firm_id: { type: "string" },
          matter_id: { type: "string" },
          status: { type: "string", enum: ["UPLOADED", "PROCESSING", "READY", "FAILED"] },
          limit: { type: "number", default: 20 },
        },
        required: ["firm_id"],
      },
    },
    {
      name: "pg_get_audit_log",
      description: "Query the audit trail for a firm — see who did what and when.",
      schema: {
        type: "object",
        properties: {
          firm_id: { type: "string" },
          user_id: { type: "string" },
          action: { type: "string" },
          limit: { type: "number", default: 50 },
        },
      },
    },
    {
      name: "pg_get_playbook",
      description: "Get a firm's negotiation playbook rules.",
      schema: {
        type: "object",
        properties: {
          firm_id: { type: "string" },
          playbook_id: { type: "string" },
        },
        required: ["firm_id"],
      },
    },
    {
      name: "pg_create_matter",
      description: "Create a new legal or consulting matter.",
      schema: {
        type: "object",
        properties: {
          firm_id: { type: "string" },
          name: { type: "string" },
          type: { type: "string", enum: ["LEGAL", "CONSULTING"] },
          client_name: { type: "string" },
          description: { type: "string" },
          created_by_id: { type: "string" },
        },
        required: ["firm_id", "name", "client_name", "created_by_id"],
      },
    },
    {
      name: "pg_create_draft",
      description: "Save a generated draft to the database.",
      schema: {
        type: "object",
        properties: {
          firm_id: { type: "string" },
          title: { type: "string" },
          content: { type: "string" },
          type: { type: "string", enum: ["EMAIL", "MEMO", "REPORT"] },
          matter_id: { type: "string" },
          created_by_id: { type: "string" },
        },
        required: ["firm_id", "title", "content", "type", "created_by_id"],
      },
    },
  ],
});

// ── Handler implementations ──

server.register("pg_query", async (params) => {
  const p = await getPool();
  const result = await p.query(params?.query as string, (params?.params || []) as any[]);
  return { rows: result.rows || result, count: result.rowCount || (result.rows?.length || 0) };
});

server.register("pg_execute", async (params) => {
  const p = await getPool();
  const result = await p.query(params?.query as string, (params?.params || []) as any[]);
  return { success: true, affected: result.rowCount || 0 };
});

server.register("pg_schema", async () => {
  const p = await getPool();
  const tables = await p.query(`
    SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `);
  // Group by table
  const grouped: Record<string, any[]> = {};
  for (const row of tables.rows || tables) {
    (grouped[row.table_name] = grouped[row.table_name] || []).push(row);
  }
  return { tables: grouped };
});

server.register("pg_health", async () => {
  const p = await getPool();
  const dbHealth = await p.query("SELECT 1 AS ok, NOW() AS server_time, version() AS pg_version");
  return {
    status: "connected",
    database: "PostgreSQL via Neon",
    serverTime: (dbHealth.rows || dbHealth)[0]?.server_time,
    pgVersion: (dbHealth.rows || dbHealth)[0]?.pg_version,
    poolSize: p.totalCount,
    poolIdle: p.idleCount,
  };
});

server.register("pg_find_matters", async (params) => {
  const p = await getPool();
  const { firm_id, status, type, client_name, limit = 20 } = params || {};
  let query = "SELECT id, name, type, status, client_name, description, created_at FROM matters WHERE firm_id = $1";
  const args: any[] = [firm_id];
  let idx = 2;

  if (status) { query += ` AND status = $${idx}`; args.push(status); idx++; }
  if (type) { query += ` AND type = $${idx}`; args.push(type); idx++; }
  if (client_name) { query += ` AND LOWER(client_name) LIKE $${idx}`; args.push(`%${(client_name as string).toLowerCase()}%`); idx++; }

  query += ` ORDER BY created_at DESC LIMIT $${idx}`;
  args.push(limit);

  const result = await p.query(query, args);
  return { matters: result.rows || result, count: result.rowCount || result.length };
});

server.register("pg_find_documents", async (params) => {
  const p = await getPool();
  const { firm_id, matter_id, status, limit = 20 } = params || {};
  let query = "SELECT * FROM documents WHERE firm_id = $1";
  const args: any[] = [firm_id];
  let idx = 2;

  if (matter_id) { query += ` AND matter_id = $${idx}`; args.push(matter_id); idx++; }
  if (status) { query += ` AND status = $${idx}`; args.push(status); idx++; }

  query += ` ORDER BY created_at DESC LIMIT $${idx}`;
  args.push(limit);

  const result = await p.query(query, args);
  return { documents: result.rows || result, count: result.rowCount || result.length };
});

server.register("pg_get_audit_log", async (params) => {
  const p = await getPool();
  const { firm_id, user_id, action, limit = 50 } = params || {};
  let query = "SELECT * FROM audit_logs WHERE 1=1";
  const args: any[] = [];
  let idx = 1;

  if (firm_id) { query += ` AND firm_id = $${idx}`; args.push(firm_id); idx++; }
  if (user_id) { query += ` AND user_id = $${idx}`; args.push(user_id); idx++; }
  if (action) { query += ` AND action = $${idx}`; args.push(action); idx++; }

  query += ` ORDER BY created_at DESC LIMIT $${idx}`;
  args.push(limit);

  const result = await p.query(query, args);
  return { entries: result.rows || result, count: result.rowCount || result.length };
});

server.register("pg_get_playbook", async (params) => {
  const p = await getPool();
  const { firm_id, playbook_id } = params || {};
  let query = "SELECT * FROM playbooks WHERE firm_id = $1";
  const args: any[] = [firm_id];
  if (playbook_id) { query += " AND id = $2"; args.push(playbook_id); }

  const result = await p.query(query, args);
  return { playbooks: result.rows || result, count: result.rowCount || result.length };
});

server.register("pg_create_matter", async (params) => {
  const p = await getPool();
  const { firm_id, name, type = "LEGAL", client_name, description, created_by_id } = params || {};
  const result = await p.query(
    `INSERT INTO matters (firm_id, name, type, client_name, description, created_by_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [firm_id, name, type, client_name, description, created_by_id],
  );
  return { matter: (result.rows || result)[0], created: true };
});

server.register("pg_create_draft", async (params) => {
  const p = await getPool();
  const { firm_id, title, content, type = "MEMO", matter_id, created_by_id } = params || {};
  const result = await p.query(
    `INSERT INTO drafts (firm_id, title, content, type, matter_id, created_by_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [firm_id, title, content, type, matter_id || null, created_by_id],
  );
  return { draft: (result.rows || result)[0], created: true };
});

// ── Start ──

server.start();
