#!/usr/bin/env node
// Document RAG MCP Server — semantic search + document management for AI agents
// Capabilities: search, index, list documents, retrieve chunks, check status
//
// Connects to: Neon PostgreSQL (pgvector) + Python AI service (embedding API)

import { MCPServer } from "../shared/server";
import { CircuitBreaker } from "../shared/circuit-breaker";
import * as dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";
const DB_URL = process.env.DATABASE_URL || 
  "postgresql://neondb_owner:npg_OomI1OaGwnqv@ep-super-math-aolcnxm7.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

let pool: any = null;
let pgLib: any = null;

async function getPool() {
  if (pool) return pool;
  pgLib = await import("asyncpg");
  pool = await pgLib.createPool(DB_URL, { minSize: 1, maxSize: 5 });
  return pool;
}

const server = new MCPServer({
  name: "document-mcp",
  version: "1.0.0",
  transport: "stdio",
  capabilities: [
    {
      name: "doc_search",
      description: "Semantic search across a firm's document index using pgvector cosine similarity.",
      schema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          firm_id: { type: "string", description: "Firm identifier" },
          matter_id: { type: "string", description: "Optional matter scope" },
          top_k: { type: "number", default: 5, description: "Number of results" },
        },
        required: ["query", "firm_id"],
      },
    },
    {
      name: "doc_list",
      description: "List documents for a firm with optional filters.",
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
      name: "doc_chunks",
      description: "Get all chunks for a document.",
      schema: {
        type: "object",
        properties: {
          document_id: { type: "string" },
          limit: { type: "number", default: 50 },
        },
        required: ["document_id"],
      },
    },
    {
      name: "doc_status",
      description: "Get document processing status and metadata.",
      schema: {
        type: "object",
        properties: { document_id: { type: "string" } },
        required: ["document_id"],
      },
    },
    {
      name: "doc_index_stats",
      description: "Get indexing statistics for a firm.",
      schema: {
        type: "object",
        properties: { firm_id: { type: "string" } },
        required: ["firm_id"],
      },
    },
  ],
});

const aiBreaker = server.getCircuitBreaker("ai-embedding-service");

// ── Handlers ──

server.register("doc_search", async (params) => {
  const { query, firm_id, matter_id, top_k = 5 } = (params || {}) as Record<string, any>;
  const p = await getPool();

  // Step 1: Get embedding from AI service
  let embedding: number[];
  try {
    embedding = await aiBreaker.execute(async () => {
      const res = await fetch(`${AI_SERVICE_URL}/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: [query] }),
      });
      if (!res.ok) throw new Error(`Embedding service returned ${res.status}`);
      const data = await res.json();
      return data.embeddings?.[0] || data[0];
    });
  } catch (e: any) {
    // Graceful degradation: fallback to full-text search on pg
    console.error(`[document-mcp] Embedding failed, falling back to text search: ${e.message}`);
    const textResults = await p.query(
      `SELECT id, document_id, chunk_index, text, section_title, page_number
       FROM document_chunks
       WHERE firm_id = $1 ${matter_id ? "AND matter_id = $3" : ""}
         AND text ILIKE $${matter_id ? "4" : "3"}
       LIMIT $${matter_id ? "5" : "4"}`,
      matter_id
        ? [firm_id, matter_id, `%${query}%`, top_k]
        : [firm_id, `%${query}%`, top_k],
    );
    return {
      results: textResults.rows || textResults,
      method: "full_text_search",
      mode: "degraded",
      count: textResults.rowCount || (textResults.rows || textResults).length,
    };
  }

  // Step 2: pgvector cosine similarity search
  const embeddingStr = `[${embedding.join(",")}]`;
  const result = await p.query(
    `SELECT dc.id, dc.document_id, dc.chunk_index, dc.text, dc.section_title, dc.page_number,
            1 - (dc.embedding <=> $1::vector) AS similarity
     FROM document_chunks dc
     WHERE dc.firm_id = $2 ${matter_id ? "AND dc.matter_id = $4" : ""}
     ORDER BY dc.embedding <=> $1::vector
     LIMIT $${matter_id ? "5" : "4"}`,
    matter_id
      ? [embeddingStr, firm_id, matter_id, top_k]
      : [embeddingStr, firm_id, top_k],
  );

  return {
    results: result.rows || result,
    count: result.rowCount || (result.rows || result).length,
    method: "pgvector_cosine",
    query,
  };
});

server.register("doc_list", async (params) => {
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

server.register("doc_chunks", async (params) => {
  const p = await getPool();
  const { document_id, limit = 50 } = params || {};
  const result = await p.query(
    `SELECT id, chunk_index, text, section_title, page_number, metadata
     FROM document_chunks WHERE document_id = $1
     ORDER BY chunk_index LIMIT $2`,
    [document_id, limit],
  );
  return { chunks: result.rows || result, count: result.rowCount || result.length, document_id };
});

server.register("doc_status", async (params) => {
  const p = await getPool();
  const { document_id } = params || {};
  const result = await p.query("SELECT * FROM documents WHERE id = $1", [document_id]);
  if (!(result.rows || result).length) {
    return { error: "Document not found", document_id };
  }
  const doc = (result.rows || result)[0];
  const chunkCount = await p.query(
    "SELECT COUNT(*) as cnt FROM document_chunks WHERE document_id = $1",
    [document_id],
  );
  return {
    document: doc,
    chunkCount: (chunkCount.rows || chunkCount)[0]?.cnt || 0,
  };
});

server.register("doc_index_stats", async (params) => {
  const p = await getPool();
  const { firm_id } = params || {};
  const [docCount, chunkCount, statusBreakdown] = await Promise.all([
    p.query("SELECT COUNT(*) as cnt FROM documents WHERE firm_id = $1", [firm_id]),
    p.query("SELECT COUNT(*) as cnt FROM document_chunks WHERE firm_id = $1", [firm_id]),
    p.query(
      "SELECT status, COUNT(*) as cnt FROM documents WHERE firm_id = $1 GROUP BY status",
      [firm_id],
    ),
  ]);

  return {
    firm_id,
    totalDocuments: (docCount.rows || docCount)[0]?.cnt || 0,
    totalChunks: (chunkCount.rows || chunkCount)[0]?.cnt || 0,
    byStatus: statusBreakdown.rows || statusBreakdown,
  };
});

server.start();
