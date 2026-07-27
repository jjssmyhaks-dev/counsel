// Court/Regulatory Lookup MCP — CourtListener + PACER
// Case law, statutes, regulations, docket search

import { MCPServer, MCPServerConfig } from "../shared/server";

const CAPABILITIES = [
  { name: "court_search", description: "Search case law by query, court, date range", schema: {
    type: "object", properties: { query: { type: "string" }, court: { type: "string" }, filedAfter: { type: "string" }, filedBefore: { type: "string" }, maxResults: { type: "number", default: 20 } },
    required: ["query"] }
  },
  { name: "court_get_opinion", description: "Get full opinion text by ID", schema: {
    type: "object", properties: { opinionId: { type: "number" } }, required: ["opinionId"] }
  },
  { name: "court_docket", description: "Get docket entries for a case", schema: {
    type: "object", properties: { docketId: { type: "number" } }, required: ["docketId"] }
  },
  { name: "court_cite", description: "Citation lookup and Shepardize-like check", schema: {
    type: "object", properties: { citation: { type: "string" } }, required: ["citation"] }
  },
  { name: "court_statutes", description: "Search statutes and regulations", schema: {
    type: "object", properties: { query: { type: "string" }, jurisdiction: { type: "string" } },
    required: ["query"] }
  },
  { name: "court_health", description: "CourtListener API health check", schema: { type: "object", properties: {} } },
];

const server = new MCPServer({
  name: "court-mcp", version: "1.0.0", capabilities: CAPABILITIES,
  transport: "http", port: 3109,
});

async function courtListener(endpoint: string, params?: Record<string, any>) {
  const token = process.env.COURTLISTENER_API_KEY || "";
  const qs = new URLSearchParams();
  if (params) for (const [k, v] of Object.entries(params)) { qs.set(k, String(v)); }
  const url = `https://www.courtlistener.com/api/rest/v4/${endpoint}${qs.toString() ? "?" + qs.toString() : ""}`;
  const res = await fetch(url, {
    headers: { Authorization: token ? `Token ${token}` : "", "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`CourtListener ${res.status}: ${await res.text()}`);
  return res.json();
}

server.register("court_search", async (p) => {
  const cb = server.getCircuitBreaker("court");
  return cb.call(async () => {
    const params: any = { q: p?.query };
    if (p?.court) params.court = p.court;
    if (p?.filedAfter) params.filed_after = p.filedAfter;
    if (p?.filedBefore) params.filed_before = p.filedBefore;
    const data = await courtListener("search/", params);
    return {
      count: data.count,
      results: (data.results || []).slice(0, p?.maxResults as number || 20).map((r: any) => ({
        id: r.id, caseName: r.caseName, court: r.court, dateFiled: r.dateFiled, citation: r.citation, snippet: r.snippet, absolute_url: r.absolute_url,
      })),
    };
  });
});

server.register("court_get_opinion", async (p) =>
  server.getCircuitBreaker("court").call(async () => {
    const data = await courtListener(`opinions/${p?.opinionId}/`);
    return { id: data.id, plain_text: data.plain_text, html: data.html, dateFiled: data.date_created, per_curiam: data.per_curiam };
  })
);

server.register("court_docket", async (p) =>
  server.getCircuitBreaker("court").call(async () => {
    const data = await courtListener(`dockets/${p?.docketId}/`);
    return { id: data.id, caseName: data.case_name, court: data.court, entries: (data.docket_entries || []).map((e: any) => ({ entryNumber: e.entry_number, description: e.description, dateFiled: e.date_filed })) };
  })
);

server.register("court_cite", async (p) =>
  server.getCircuitBreaker("court").call(async () => {
    const data = await courtListener("search/", { q: p?.citation, type: "o" });
    return {
      citation: p?.citation,
      found: data.count > 0,
      results: (data.results || []).slice(0, 5).map((r: any) => ({
        caseName: r.caseName, court: r.court, dateFiled: r.dateFiled, status: r.status, citingCount: r.citeCount,
      })),
      note: "CourtListener citation check. Full Shepardize requires paid PACER/Shepard's subscription.",
    };
  })
);

server.register("court_statutes", async (p) =>
  server.getCircuitBreaker("court").call(async () => {
    const params: any = { q: p?.query, type: "s" };
    if (p?.jurisdiction) params.jurisdiction = p.jurisdiction;
    const data = await courtListener("search/", params);
    return { count: data.count, results: (data.results || []).slice(0, 20).map((r: any) => ({ id: r.id, name: r.name, citation: r.citation, jurisdiction: r.jurisdiction })) };
  })
);

server.register("court_health", async () => {
  try { await courtListener("courts/?page_size=1"); return { status: "healthy" }; }
  catch { return { status: "unreachable" }; }
});

server.start();
