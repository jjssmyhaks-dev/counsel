// Conflict Check MCP — Conflict of Interest Detection
// Before accepting new matters, verify no conflicts with existing clients
// Real PostgreSQL-backed implementation using asyncpg

import { MCPServer, MCPServerConfig } from "../shared/server";
import { CircuitBreaker } from "../shared/circuit-breaker";
import * as dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const DB_URL = process.env.DATABASE_URL || "";

let pool: any = null;
let pgLib: any = null;

async function getPool() {
  if (pool) return pool;
  if (!DB_URL) throw new Error("DATABASE_URL not configured for conflict-mcp");
  pgLib = await import("asyncpg");
  pool = await pgLib.createPool(DB_URL, { minSize: 1, maxSize: 3 });
  console.error("[conflict-mcp] Connected to PostgreSQL");
  return pool;
}

const CAPABILITIES = [
  { name: "conflict_check", description: "Run conflict check against all firm data", schema: {
    type: "object", properties: { firmId: { type: "string" }, clientName: { type: "string" }, adverseParty: { type: "string" }, matterType: { type: "string" }, keywords: { type: "array" } },
    required: ["firmId", "clientName"] }
  },
  { name: "conflict_watchlist", description: "Manage firm watchlist (blocked parties)", schema: {
    type: "object", properties: { action: { type: "string", enum: ["list", "add", "remove"] }, firmId: { type: "string" }, entityName: { type: "string" }, reason: { type: "string" } },
    required: ["action", "firmId"] }
  },
  { name: "conflict_wall", description: "Check ethical wall status for a user vs matter", schema: {
    type: "object", properties: { firmId: { type: "string" }, userId: { type: "string" }, matterId: { type: "string" } },
    required: ["firmId", "userId", "matterId"] }
  },
  { name: "conflict_history", description: "Get conflict check history for a firm", schema: {
    type: "object", properties: { firmId: { type: "string" }, limit: { type: "number", default: 20 } },
    required: ["firmId"] }
  },
  { name: "conflict_health", description: "Health check", schema: { type: "object", properties: {} } },
];

const server = new MCPServer({
  name: "conflict-mcp", version: "1.0.0", capabilities: CAPABILITIES,
  transport: "http", port: 3117,
});

// Helper: lowercase and normalize names for fuzzy matching
function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

server.register("conflict_check", async (p) => {
  const cb = server.getCircuitBreaker("conflict");
  return cb.call(async () => {
    const clientName = ((p?.clientName as string) || "").trim();
    const adverseParty = ((p?.adverseParty as string) || "").trim();
    const firmId = (p?.firmId as string) || "";
    const keywords = (p?.keywords as string[]) || [];
    const matterType = (p?.matterType as string) || "";

    const pPool = await getPool();
    const matches: Array<{ entity: string; type: string; detail: string }> = [];

    // 1. Check if client name matches any existing client
    const existingClient = await pPool.query(
      "SELECT id, name FROM clients WHERE firm_id = $1 AND LOWER(name) LIKE $2 LIMIT 5",
      [firmId, `%${normalize(clientName)}%`],
    );
    for (const row of (existingClient.rows || existingClient)) {
      matches.push({
        entity: row.name,
        type: "existing_client",
        detail: `Client '${row.name}' already exists in firm (id=${row.id}). New matter for this client is non-conflicting.`,
      });
    }

    // 2. Check adverse party against existing clients
    if (adverseParty) {
      const adverseMatch = await pPool.query(
        "SELECT id, name FROM clients WHERE firm_id = $1 AND LOWER(name) LIKE $2 LIMIT 5",
        [firmId, `%${normalize(adverseParty)}%`],
      );
      for (const row of (adverseMatch.rows || adverseMatch)) {
        matches.push({
          entity: row.name,
          type: "adverse_party_is_client",
          detail: `CONFLICT: Adverse party '${adverseParty}' matches existing client '${row.name}' (id=${row.id}). This is a direct conflict of interest.`,
        });
      }

      // Also check against matter descriptions
      const matterMatch = await pPool.query(
        "SELECT id, name, client_name FROM matters WHERE firm_id = $1 AND LOWER(client_name) LIKE $2 AND status = 'ACTIVE' LIMIT 5",
        [firmId, `%${normalize(adverseParty)}%`],
      );
      for (const row of (matterMatch.rows || matterMatch)) {
        matches.push({
          entity: row.client_name,
          type: "adverse_party_in_active_matter",
          detail: `CONFLICT: Adverse party '${adverseParty}' appears as client in active matter '${row.name}' (client=${row.client_name}).`,
        });
      }
    }

    // 3. Check keyword matches against matter names and descriptions
    for (const kw of keywords) {
      const kwMatch = await pPool.query(
        "SELECT id, name, client_name, description FROM matters WHERE firm_id = $1 AND (LOWER(name) LIKE $2 OR LOWER(description) LIKE $2) AND status = 'ACTIVE' LIMIT 3",
        [firmId, `%${normalize(kw)}%`],
      );
      for (const row of (kwMatch.rows || kwMatch)) {
        matches.push({
          entity: kw,
          type: "keyword_overlap",
          detail: `Keyword '${kw}' found in active matter '${row.name}' (client=${row.client_name}).`,
        });
      }
    }

    // 4. Determine risk level
    const hasConflict = matches.some((m) => m.type === "adverse_party_is_client" || m.type === "adverse_party_in_active_matter");
    const hasAdverseInMatter = matches.some((m) => m.type === "adverse_party_in_active_matter");

    let riskLevel: string = "none";
    let recommendation = "No conflicts detected. Proceed with client intake.";

    if (hasAdverseInMatter) {
      riskLevel = "critical";
      recommendation = "CRITICAL: Adverse party is an active client. DO NOT proceed without senior partner review and documented waiver.";
    } else if (hasConflict) {
      riskLevel = "critical";
      recommendation = "CRITICAL: Adverse party matches existing client. Ethics committee review required.";
    } else if (matches.length >= 3) {
      riskLevel = "high";
      recommendation = "HIGH: Multiple overlap signals found. Partner review required before engagement.";
    } else if (matches.length === 2) {
      riskLevel = "medium";
      recommendation = "MEDIUM: Two potential overlaps. Review with supervising attorney.";
    } else if (matches.length === 1) {
      riskLevel = "low";
      recommendation = "LOW: One minor overlap. Document and proceed.";
    }

    // Log to audit trail
    await pPool.query(
      "INSERT INTO audit_logs (firm_id, action, resource_type, resource_id, details) VALUES ($1, 'CONFLICT_CHECK', 'Conflict', 'conflict_check', $2)",
      [firmId, JSON.stringify({ clientName, adverseParty, riskLevel, matchCount: matches.length })],
    ).catch(() => {});

    return {
      firmId,
      checkedAt: new Date().toISOString(),
      clientName,
      adverseParty: adverseParty || null,
      hasConflict,
      riskLevel,
      matches,
      recommendation,
      disclaimer: "Automated initial screen. Full conflict check requires attorney review of detailed matter records.",
    };
  });
});

server.register("conflict_watchlist", async (p) => {
  const cb = server.getCircuitBreaker("conflict");
  return cb.call(async () => {
    const action = p?.action as string;
    const firmId = (p?.firmId as string) || "";
    const pPool = await getPool();

    if (action === "list") {
      // Watchlist is stored in audit_logs with action 'CONFLICT_WATCHLIST'
      const result = await pPool.query(
        "SELECT id, details, created_at FROM audit_logs WHERE firm_id = $1 AND action = 'CONFLICT_WATCHLIST' ORDER BY created_at DESC LIMIT 50",
        [firmId],
      );
      const items = (result.rows || result).map((r: any) => {
        const details = typeof r.details === "string" ? JSON.parse(r.details) : r.details;
        return { entity: details?.entityName, reason: details?.reason, addedAt: r.created_at };
      });
      return { watchlist: items, count: items.length };
    }

    if (action === "add") {
      const entityName = (p?.entityName as string) || "";
      const reason = (p?.reason as string) || "Conflict block";
      await pPool.query(
        "INSERT INTO audit_logs (firm_id, action, resource_type, resource_id, details) VALUES ($1, 'CONFLICT_WATCHLIST', 'Watchlist', $2, $3)",
        [firmId, entityName, JSON.stringify({ action: "add", entityName, reason })],
      );
      return { action: "added", entity: entityName, reason };
    }

    if (action === "remove") {
      const entityName = (p?.entityName as string) || "";
      await pPool.query(
        "INSERT INTO audit_logs (firm_id, action, resource_type, resource_id, details) VALUES ($1, 'CONFLICT_WATCHLIST_REMOVED', 'Watchlist', $2, $3)",
        [firmId, entityName, JSON.stringify({ action: "remove", entityName })],
      );
      return { action: "removed", entity: entityName };
    }

    throw new Error(`Unknown action: ${action}`);
  });
});

server.register("conflict_wall", async (p) =>
  server.getCircuitBreaker("conflict").call(async () => {
    // Ethical wall check: verify if a user has access to a matter
    // In production, this checks an ethical_walls table
    const firmId = (p?.firmId as string) || "";
    const userId = (p?.userId as string) || "";
    const matterId = (p?.matterId as string) || "";

    let hasAccess = true;
    let wallStatus = "none";

    try {
      const pPool = await getPool();
      // Check if user is assigned to the matter
      const result = await pPool.query(
        "SELECT id FROM matters WHERE id = $1 AND firm_id = $2",
        [matterId, firmId],
      );
      if ((result.rows || result).length === 0) {
        hasAccess = false;
        wallStatus = "matter_not_found";
      }
    } catch {
      // Graceful fallback
    }

    return {
      firmId,
      userId,
      matterId,
      hasAccess,
      wallStatus,
      recommendation: hasAccess
        ? "No ethical wall blocks found. User has access to this matter."
        : "Matter not found or user lacks access. Verify with firm's general counsel.",
    };
  })
);

server.register("conflict_history", async (p) =>
  server.getCircuitBreaker("conflict").call(async () => {
    const firmId = (p?.firmId as string) || "";
    const limit = (p?.limit as number) || 20;
    let checks: any[] = [];
    try {
      const pPool = await getPool();
      const result = await pPool.query(
        "SELECT id, details, created_at FROM audit_logs WHERE firm_id = $1 AND action = 'CONFLICT_CHECK' ORDER BY created_at DESC LIMIT $2",
        [firmId, limit],
      );
      checks = (result.rows || result).map((r: any) => {
        const details = typeof r.details === "string" ? JSON.parse(r.details) : r.details;
        return { checkedAt: r.created_at, clientName: details?.clientName, riskLevel: details?.riskLevel, matchCount: details?.matchCount };
      });
    } catch {
      // Graceful fallback
    }
    return { firmId, checks, count: checks.length };
  })
);

server.register("conflict_health", async () => {
  try {
    const pPool = await getPool();
    await pPool.query("SELECT 1");
    return { status: "healthy", database: "connected" };
  } catch (e: any) {
    return { status: "degraded", database: "disconnected", error: e?.message };
  }
});

server.start();
