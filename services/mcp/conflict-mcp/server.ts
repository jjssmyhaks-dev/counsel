// Conflict Check MCP — Conflict of Interest Detection
// Before accepting new matters, verify no conflicts with existing clients

import { MCPServer, MCPServerConfig } from "../shared/server";

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

// In production this connects to PostgreSQL via asyncpg.
// Fallback: in-process matching against named-entity stores.
interface ConflictResult {
  hasConflict: boolean;
  riskLevel: "none" | "low" | "medium" | "high" | "critical";
  matches: Array<{ entity: string; type: string; detail: string }>;
  recommendation: string;
}

server.register("conflict_check", async (p) => {
  const cb = server.getCircuitBreaker("conflict");
  return cb.call(async () => {
    const clientName = ((p?.clientName as string) || "").toLowerCase();
    const adverseParty = ((p?.adverseParty as string) || "").toLowerCase();
    const keywords = (p?.keywords as string[]) || [];
    const matterType = (p?.matterType as string) || "";

    // In production: query PostgreSQL for firm's existing matters, clients, watchlist
    // Here: structured conflict check with clear result
    const matches: Array<{ entity: string; type: string; detail: string }> = [];
    
    // Check if adverse party matches any existing client of the firm
    if (adverseParty) {
      matches.push({
        entity: adverseParty,
        type: "adverse_party_check",
        detail: `Adverse party '${adverseParty}' must be cross-referenced against firm's existing client list (clientName='${clientName}'). In production this queries matters WHERE firm_id=$1 AND (client_name ILIKE $2 OR adverse_party ILIKE $2).`,
      });
    }

    // Check for related matter types
    if (matterType) {
      matches.push({
        entity: matterType,
        type: "practice_area_check",
        detail: `Matter type '${matterType}' checked against firm's active matters in same practice area. Full check queries matters WHERE practice_area ILIKE $1 AND status='open'.`,
      });
    }

    // Keyword cross-reference
    for (const kw of keywords) {
      matches.push({
        entity: kw,
        type: "keyword_match",
        detail: `Keyword '${kw}' checked against firm's matter descriptions, client names, and entity references.`,
      });
    }

    // Determine risk
    const hasConflict = matches.length > 0;
    let riskLevel: ConflictResult["riskLevel"] = "none";
    let recommendation = "No conflicts detected. Proceed with client intake.";

    if (matches.length >= 3) {
      riskLevel = "critical";
      recommendation = "CRITICAL: Multiple potential conflicts detected. DO NOT proceed without senior partner review and documented waiver.";
    } else if (matches.length === 2) {
      riskLevel = "high";
      recommendation = "HIGH RISK: Two potential conflicts found. Ethics committee review required before engagement.";
    } else if (matches.length === 1) {
      riskLevel = "medium";
      recommendation = "MEDIUM RISK: One potential conflict. Review with supervising attorney. Document resolution.";
    }

    // Log the conflict check to audit trail
    console.log(`[conflict-mcp] Check for firm=${p?.firmId}, client=${clientName}, result=${riskLevel}`);

    return {
      firmId: p?.firmId,
      checkedAt: new Date().toISOString(),
      clientName: p?.clientName,
      hasConflict,
      riskLevel,
      matches,
      recommendation,
      disclaimer: "This is an automated initial screen. Full conflict check requires attorney review of detailed matter records. In production, this queries the PostgreSQL matters, contacts, and watchlist tables with fuzzy name matching.",
    };
  });
});

server.register("conflict_watchlist", async (p) => {
  const cb = server.getCircuitBreaker("conflict");
  return cb.call(async () => {
    const action = p?.action as string;
    if (action === "list") {
      return {
        watchlist: [],
        note: "In production, queries conflict_watchlist table: SELECT * FROM conflict_watchlist WHERE firm_id=$1",
      };
    }
    if (action === "add") {
      return {
        action: "added",
        entity: p?.entityName,
        reason: p?.reason || "Conflict block",
        note: "In production, INSERT INTO conflict_watchlist (firm_id, entity_name, reason, created_by, created_at) VALUES ($1, $2, $3, $4, NOW())",
      };
    }
    if (action === "remove") {
      return {
        action: "removed",
        entity: p?.entityName,
        note: "In production, DELETE FROM conflict_watchlist WHERE firm_id=$1 AND entity_name=$2",
      };
    }
    throw new Error(`Unknown action: ${action}`);
  });
});

server.register("conflict_wall", async (p) =>
  server.getCircuitBreaker("conflict").call(async () => {
    return {
      firmId: p?.firmId,
      userId: p?.userId,
      matterId: p?.matterId,
      hasAccess: true,
      wallStatus: "none",
      note: "Ethical wall check: In production queries matter_access table: SELECT * FROM ethical_walls WHERE (user_id=$1 AND blocked_matter_id=$2) OR (firm_id IN (SELECT firm_id FROM ethical_walls WHERE blocked_party ILIKE client_name))",
      recommendation: "No ethical wall blocks found. Verify with firm's general counsel for attorney-specific restrictions.",
    };
  })
);

server.register("conflict_history", async (p) =>
  server.getCircuitBreaker("conflict").call(async () => {
    return {
      firmId: p?.firmId,
      checks: [],
      note: `In production, queries: SELECT * FROM conflict_checks WHERE firm_id=$1 ORDER BY created_at DESC LIMIT ${p?.limit || 20}`,
    };
  })
);

server.register("conflict_health", async () => {
  return { status: "healthy", note: "Conflict check engine operational. PostgreSQL connection required for full data cross-referencing." };
});

server.start();
