// Time Tracking MCP — Harvest / Toggl / Clockify
// Billable hours, timesheets, matter-level time entry

import { MCPServer, MCPServerConfig } from "../shared/server";

const CAPABILITIES = [
  { name: "time_start_timer", description: "Start a time entry/timer", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["harvest", "toggl"] }, description: { type: "string" }, projectId: { type: "string" }, matterId: { type: "string" }, billable: { type: "boolean" } },
    required: ["provider", "description"] }
  },
  { name: "time_stop_timer", description: "Stop running timer", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["harvest", "toggl"] }, timeEntryId: { type: "string" } },
    required: ["provider", "timeEntryId"] }
  },
  { name: "time_get_entries", description: "Get time entries by date/project/matter", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["harvest", "toggl"] }, from: { type: "string" }, to: { type: "string" }, matterId: { type: "string" }, userId: { type: "string" } },
    required: ["provider"] }
  },
  { name: "time_matter_summary", description: "Total hours by matter", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["harvest"] }, from: { type: "string" }, to: { type: "string" }, matterId: { type: "string" } },
    required: ["provider"] }
  },
  { name: "time_health", description: "Health check", schema: { type: "object", properties: {} } },
];

const server = new MCPServer({
  name: "time-mcp", version: "1.0.0", capabilities: CAPABILITIES,
  transport: "http", port: 3116,
});

async function harvestAPI(endpoint: string, method = "GET", body?: any) {
  const token = process.env.HARVEST_ACCESS_TOKEN || "";
  const accountId = process.env.HARVEST_ACCOUNT_ID || "";
  const res = await fetch(`https://api.harvestapp.com/v2${endpoint}`, {
    method, headers: { Authorization: `Bearer ${token}`, "Harvest-Account-Id": accountId, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Harvest ${res.status}: ${await res.text()}`);
  return res.json();
}

async function togglAPI(endpoint: string, method = "GET", body?: any) {
  const token = Buffer.from(`${process.env.TOGGL_API_TOKEN || ""}:api_token`).toString("base64");
  const res = await fetch(`https://api.track.toggl.com/api/v9${endpoint}`, {
    method, headers: { Authorization: `Basic ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Toggl ${res.status}: ${await res.text()}`);
  return res.json();
}

server.register("time_start_timer", async (p) => {
  const cb = server.getCircuitBreaker("time");
  return cb.call(async () => {
    if (p?.provider === "harvest") {
      const data = await harvestAPI("/time_entries", "POST", {
        notes: p.description, project_id: p.projectId ? Number(p.projectId) : undefined, billable: p.billable !== false, spent_date: new Date().toISOString().split("T")[0],
      });
      return { timeEntryId: data.id, started: true, timer_started_at: data.timer_started_at };
    }
    if (p?.provider === "toggl") {
      const data = await togglAPI("/me/time_entries", "POST", {
        description: p.description, project_id: p.projectId ? Number(p.projectId) : undefined, billable: p.billable !== false, start: new Date().toISOString(), duration: -1, created_with: "counsel-mcp",
      });
      return { timeEntryId: data.id, started: true };
    }
    throw new Error(`Unknown provider: ${p?.provider}`);
  });
});

server.register("time_stop_timer", async (p) => {
  const cb = server.getCircuitBreaker("time");
  return cb.call(async () => {
    if (p?.provider === "harvest") {
      await harvestAPI(`/time_entries/${p?.timeEntryId}/stop`, "PATCH");
      return { stopped: true };
    }
    if (p?.provider === "toggl") {
      await togglAPI(`/workspaces/${process.env.TOGGL_WORKSPACE_ID}/time_entries/${p?.timeEntryId}/stop`, "PATCH");
      return { stopped: true };
    }
    throw new Error(`Unknown provider: ${p?.provider}`);
  });
});

server.register("time_get_entries", async (p) => {
  const cb = server.getCircuitBreaker("time");
  return cb.call(async () => {
    if (p?.provider === "harvest") {
      const qs = new URLSearchParams();
      if (p?.from) qs.set("from", p.from as string);
      if (p?.to) qs.set("to", p.to as string);
      if (p?.userId) qs.set("user_id", p.userId as string);
      const data = await harvestAPI(`/time_entries?${qs}`);
      return { entries: (data.time_entries || []).map((e: any) => ({ id: e.id, hours: e.hours, notes: e.notes, project: e.project?.name, billable: e.billable, spentDate: e.spent_date })) };
    }
    if (p?.provider === "toggl") {
      const qs = new URLSearchParams();
      if (p?.from) qs.set("start_date", p.from as string);
      if (p?.to) qs.set("end_date", p.to as string);
      const data = await togglAPI(`/me/time_entries?${qs}`);
      return { entries: (data || []).map((e: any) => ({ id: e.id, duration_seconds: e.duration, description: e.description, project_id: e.project_id, billable: e.billable, start: e.start })) };
    }
    throw new Error(`Unknown provider: ${p?.provider}`);
  });
});

server.register("time_matter_summary", async (p) =>
  server.getCircuitBreaker("time").call(async () => {
    const qs = new URLSearchParams();
    if (p?.from) qs.set("from", p.from as string);
    if (p?.to) qs.set("to", p.to as string);
    const data = await harvestAPI(`/reports/time/projects?${qs}`);
    return { summary: (data.results || []).map((r: any) => ({ project: r.project?.name, totalHours: r.total_hours, billableHours: r.billable_hours, unbillableHours: r.unbillable_hours })) };
  })
);

server.register("time_health", async () => {
  const ok: any = {};
  try { await harvestAPI("/users/me"); ok.harvest = "healthy"; } catch { ok.harvest = "unreachable"; }
  try { await togglAPI("/me"); ok.toggl = "healthy"; } catch { ok.toggl = "unreachable"; }
  return { status: Object.values(ok).some(v => v === "healthy") ? "healthy" : "degraded", providers: ok };
});

server.start();
