// CRM MCP — Salesforce / Clio / HubSpot
// Client engagement, deal pipeline, matter linking, contact management

import { MCPServer, MCPServerConfig } from "../shared/server";

const CAPABILITIES = [
  { name: "crm_search_contacts", description: "Search contacts across CRM", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["salesforce", "clio", "hubspot"] }, query: { type: "string" }, firmId: { type: "string" }, limit: { type: "number", default: 20 } },
    required: ["provider", "query"] }
  },
  { name: "crm_get_deals", description: "Get deal pipeline / opportunities", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["salesforce", "clio", "hubspot"] }, stage: { type: "string" }, firmId: { type: "string" }, limit: { type: "number", default: 20 } },
    required: ["provider"] }
  },
  { name: "crm_get_matters", description: "Get legal matters from Clio", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["clio"] }, status: { type: "string", enum: ["open", "closed", "pending"] }, clientId: { type: "string" }, limit: { type: "number", default: 20 } },
    required: ["provider"] }
  },
  { name: "crm_sync_contact", description: "Create/update contact in CRM", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["salesforce", "clio", "hubspot"] }, email: { type: "string" }, firstName: { type: "string" }, lastName: { type: "string" }, firmId: { type: "string" }, phone: { type: "string" } },
    required: ["provider", "email", "lastName"] }
  },
  { name: "crm_get_activities", description: "Get recent activities/timeline", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["salesforce", "clio"] }, contactId: { type: "string" }, matterId: { type: "string" }, limit: { type: "number", default: 20 } },
    required: ["provider"] }
  },
  { name: "crm_health", description: "CRM health check", schema: { type: "object", properties: {} } },
];

const server = new MCPServer({
  name: "crm-mcp", version: "1.0.0", capabilities: CAPABILITIES,
  transport: "http", port: 3111,
});

async function salesforceQuery(soql: string) {
  const token = process.env.SALESFORCE_ACCESS_TOKEN || "";
  const instanceUrl = process.env.SALESFORCE_INSTANCE_URL || "";
  const res = await fetch(`${instanceUrl}/services/data/v60.0/query?q=${encodeURIComponent(soql)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Salesforce ${res.status}: ${await res.text()}`);
  return res.json();
}

async function clioAPI(endpoint: string, method = "GET", body?: any) {
  const token = process.env.CLIO_ACCESS_TOKEN || "";
  const res = await fetch(`https://app.clio.com/api/v4${endpoint}`, {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Clio ${res.status}: ${await res.text()}`);
  return res.json();
}

async function hubspotAPI(endpoint: string, method = "GET", body?: any) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN || "";
  const res = await fetch(`https://api.hubapi.com${endpoint}`, {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`HubSpot ${res.status}: ${await res.text()}`);
  return res.json();
}

server.register("crm_search_contacts", async (p) => {
  const cb = server.getCircuitBreaker("crm");
  return cb.call(async () => {
    const q = p?.query;
    if (p?.provider === "salesforce") {
      const data = await salesforceQuery(`SELECT Id, Name, Email, Phone, Account.Name FROM Contact WHERE Name LIKE '%${q}%' OR Email LIKE '%${q}%' LIMIT ${p?.limit || 20}`);
      return { contacts: data.records, count: data.totalSize };
    }
    if (p?.provider === "clio") {
      const data = await clioAPI(`/contacts?query=${encodeURIComponent(q as string)}&limit=${p?.limit || 20}`);
      return { contacts: (data.data || []).map((c: any) => ({ id: c.id, name: c.name, email: c.email, phone: c.phone_number, type: c.type })), count: data.meta?.total_count || 0 };
    }
    if (p?.provider === "hubspot") {
      const data = await hubspotAPI(`/crm/v3/objects/contacts/search`, "POST", {
        filterGroups: [{ filters: [{ propertyName: "email", operator: "CONTAINS_TOKEN", value: q }] }],
        limit: p?.limit || 20,
      });
      return { contacts: (data.results || []).map((c: any) => ({ id: c.id, email: c.properties?.email, name: `${c.properties?.firstname} ${c.properties?.lastname}` })), count: data.total };
    }
    throw new Error(`Unknown provider: ${p?.provider}`);
  });
});

server.register("crm_get_deals", async (p) => {
  const cb = server.getCircuitBreaker("crm");
  return cb.call(async () => {
    if (p?.provider === "salesforce") {
      const stageFilter = p?.stage ? ` AND StageName = '${p.stage}'` : "";
      const data = await salesforceQuery(`SELECT Id, Name, Amount, StageName, CloseDate FROM Opportunity WHERE IsClosed = false${stageFilter} LIMIT ${p?.limit || 20}`);
      return { deals: data.records, count: data.totalSize };
    }
    if (p?.provider === "clio") {
      const data = await clioAPI(`/matters?status=${p?.stage || "open"}&limit=${p?.limit || 20}`);
      return { matters: (data.data || []).map((m: any) => ({ id: m.id, display_number: m.display_number, description: m.description, status: m.status, client: m.client?.name, open_date: m.open_date, close_date: m.close_date })), count: data.meta?.total_count || 0 };
    }
    if (p?.provider === "hubspot") {
      const data = await hubspotAPI("/crm/v3/objects/deals?limit=" + (p?.limit || 20));
      return { deals: (data.results || []).map((d: any) => ({ id: d.id, name: d.properties?.dealname, amount: d.properties?.amount, stage: d.properties?.dealstage })), count: data.total };
    }
    throw new Error(`Unknown provider: ${p?.provider}`);
  });
});

server.register("crm_get_matters", async (p) => {
  const cb = server.getCircuitBreaker("crm");
  return cb.call(async () => {
    const qs = new URLSearchParams({ limit: String(p?.limit || 20) });
    if (p?.status) qs.set("status", p.status as string);
    if (p?.clientId) qs.set("client_id", p.clientId as string);
    const data = await clioAPI(`/matters?${qs}`);
    return { matters: (data.data || []).map((m: any) => ({ id: m.id, display_number: m.display_number, description: m.description, status: m.status, practice_area: m.practice_area?.name, responsible_attorney: m.responsible_attorney?.name })), count: data.meta?.total_count || 0 };
  });
});

server.register("crm_sync_contact", async (p) => {
  const cb = server.getCircuitBreaker("crm");
  return cb.call(async () => {
    if (p?.provider === "salesforce") {
      return salesforceQuery(`SELECT Id FROM Contact WHERE Email = '${p.email}' LIMIT 1`).then(async (existing) => {
        if (existing.totalSize > 0) {
          const id = existing.records[0].Id;
          const res = await fetch(`${process.env.SALESFORCE_INSTANCE_URL}/services/data/v60.0/sobjects/Contact/${id}`, {
            method: "PATCH", headers: { Authorization: `Bearer ${process.env.SALESFORCE_ACCESS_TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify({ FirstName: p.firstName, LastName: p.lastName, Phone: p.phone }),
          });
          return { action: "updated", id, status: res.status };
        }
        return { action: "salesforce_create_requires_rest_api", note: "Use Salesforce REST POST /sobjects/Contact/" };
      });
    }
    if (p?.provider === "clio") {
      const data = await clioAPI("/contacts", "POST", {
        data: { name: `${p.firstName} ${p.lastName}`, email: p.email, phone_number: p.phone, type: "Person" },
      });
      return { action: "created", id: data.data?.id };
    }
    if (p?.provider === "hubspot") {
      const data = await hubspotAPI("/crm/v3/objects/contacts", "POST", {
        properties: { email: p.email, firstname: p.firstName, lastname: p.lastName, phone: p.phone || "" },
      });
      return { action: "created", id: data.id };
    }
    throw new Error(`Unknown provider: ${p?.provider}`);
  });
});

server.register("crm_get_activities", async (p) => {
  const cb = server.getCircuitBreaker("crm");
  return cb.call(async () => {
    if (p?.provider === "salesforce") {
      const filter = p?.contactId ? `WHERE WhoId = '${p.contactId}'` : "LIMIT 20";
      const data = await salesforceQuery(`SELECT Id, Subject, ActivityDate, Description FROM Task ${filter}`);
      return { activities: data.records };
    }
    if (p?.provider === "clio") {
      const data = await clioAPI(`/activities?limit=${p?.limit || 20}${p?.matterId ? `&matter_id=${p.matterId}` : ""}`);
      return { activities: (data.data || []).map((a: any) => ({ id: a.id, type: a.type, subject: a.subject, description: a.description, date: a.date, time: a.time })) };
    }
    throw new Error(`Unknown provider: ${p?.provider}`);
  });
});

server.register("crm_health", async () => {
  const ok: any = {};
  try { await salesforceQuery("SELECT Id FROM User LIMIT 1"); ok.salesforce = "healthy"; } catch { ok.salesforce = "unreachable"; }
  try { await clioAPI("/users/who_am_i"); ok.clio = "healthy"; } catch { ok.clio = "unreachable"; }
  try { await hubspotAPI("/crm/v3/objects/contacts?limit=1"); ok.hubspot = "healthy"; } catch { ok.hubspot = "unreachable"; }
  return { status: Object.values(ok).some(v => v === "healthy") ? "healthy" : "degraded", providers: ok };
});

server.start();
