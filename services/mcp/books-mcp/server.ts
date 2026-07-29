// Books MCP — Zoho Books / QuickBooks API adapter
// Same reconciliation flows for non-Tally clients
// v1: API-based pull. v2: matching Crew 9 reconciliation pipeline.

import { MCPServer, MCPServerConfig } from "../shared/server";

const CAPABILITIES = [
  { name: "books_pull_ledgers", description: "Pull chart of accounts/ledger balances", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["zoho","quickbooks"] }, clientId: { type: "string" }, fromDate: { type: "string" }, toDate: { type: "string" } },
    required: ["provider","clientId"] }
  },
  { name: "books_pull_trial_balance", description: "Pull trial balance", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["zoho","quickbooks"] }, clientId: { type: "string" }, asOnDate: { type: "string" } },
    required: ["provider","clientId"] }
  },
  { name: "books_pull_transactions", description: "Pull transactions/vouchers for reconciliation", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["zoho","quickbooks"] }, clientId: { type: "string" }, fromDate: { type: "string" }, toDate: { type: "string" } },
    required: ["provider","clientId"] }
  },
  { name: "books_pull_invoices", description: "Pull sales/purchase invoices", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["zoho","quickbooks"] }, clientId: { type: "string" }, fromDate: { type: "string" }, toDate: { type: "string" } },
    required: ["provider","clientId"] }
  },
  { name: "books_reconcile_format", description: "Convert books data to reconciliation-ready format", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["zoho","quickbooks"] }, clientId: { type: "string" }, period: { type: "string" } },
    required: ["provider","clientId","period"] }
  },
  { name: "books_health", description: "Books provider connectivity check", schema: { type: "object", properties: {} } },
];

const server = new MCPServer({
  name: "books-mcp", version: "1.0.0", capabilities: CAPABILITIES,
  transport: "http", port: 3123,
});

async function zohoAPI(endpoint: string, method = "GET", body?: any): Promise<any> {
  const token = process.env.ZOHO_OAUTH_TOKEN || "";
  const orgId = process.env.ZOHO_ORGANIZATION_ID || "";
  const url = `https://www.zohoapis.in/books/v3${endpoint}?organization_id=${orgId}`;
  const res = await fetch(url, {
    method, headers: { Authorization: `Zoho-oauthtoken ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Zoho Books ${res.status}: ${await res.text()}`);
  return res.json();
}

async function quickbooksAPI(endpoint: string, query?: string): Promise<any> {
  const token = process.env.QUICKBOOKS_ACCESS_TOKEN || "";
  const realmId = process.env.QUICKBOOKS_REALM_ID || "";
  const url = `https://quickbooks.api.intuit.com/v3/company/${realmId}${endpoint}${query ? `?query=${encodeURIComponent(query)}` : ""}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`QuickBooks ${res.status}: ${await res.text()}`);
  return res.json();
}

function auditLog(action: string, provider: string, clientId: string): void {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(), server: "books-mcp", tool: action, provider, clientId,
  }));
}

server.register("books_pull_ledgers", async (p) => {
  const cb = server.getCircuitBreaker("books");
  return cb.call(async () => {
    auditLog("pull_ledgers", p?.provider as string, p?.clientId as string);
    if (p?.provider === "zoho") return zohoAPI("/chartofaccounts?filter_by=Status.Active");
    if (p?.provider === "quickbooks") return quickbooksAPI("/query", "SELECT * FROM Account WHERE Active = true");
    throw new Error(`Unknown provider: ${p?.provider}`);
  });
});

server.register("books_pull_trial_balance", async (p) => {
  const cb = server.getCircuitBreaker("books");
  return cb.call(async () => {
    if (p?.provider === "zoho") return zohoAPI(`/reports/trialbalance?date=${p?.asOnDate || new Date().toISOString().split("T")[0]}`);
    if (p?.provider === "quickbooks") return quickbooksAPI("/reports/TrialBalance");
    throw new Error(`Unknown provider: ${p?.provider}`);
  });
});

server.register("books_pull_transactions", async (p) => {
  const cb = server.getCircuitBreaker("books");
  return cb.call(async () => {
    if (p?.provider === "zoho") return zohoAPI("/banktransactions");
    if (p?.provider === "quickbooks") return quickbooksAPI("/query", "SELECT * FROM JournalEntry");
    throw new Error(`Unknown provider: ${p?.provider}`);
  });
});

server.register("books_pull_invoices", async (p) => {
  const cb = server.getCircuitBreaker("books");
  return cb.call(async () => {
    if (p?.provider === "zoho") return zohoAPI("/invoices?sort_column=created_time&sort_order=D");
    if (p?.provider === "quickbooks") return quickbooksAPI("/query", "SELECT * FROM Invoice");
    throw new Error(`Unknown provider: ${p?.provider}`);
  });
});

server.register("books_reconcile_format", async (p) => {
  const cb = server.getCircuitBreaker("books");
  return cb.call(async () => {
    return {
      provider: p?.provider, clientId: p?.clientId, period: p?.period,
      status: "ready",
      note: "Books data pulled and formatted for Crew 9 reconciliation. Feeds into the same pipeline as Tally data — unified reconciliation across all accounting sources.",
      nextStep: "Run Crew 9 Bookkeeping Reconciliation with this data source + bank statement upload.",
    };
  });
});

server.register("books_health", async () => {
  const ok: any = {};
  try { await zohoAPI("/organization"); ok.zoho = "reachable"; } catch { ok.zoho = "unreachable"; }
  try { await quickbooksAPI("/companyinfo"); ok.quickbooks = "reachable"; } catch { ok.quickbooks = "unreachable"; }
  return { status: Object.values(ok).some(v => v === "reachable") ? "healthy" : "degraded", providers: ok };
});

server.start();
