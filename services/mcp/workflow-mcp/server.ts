// Workflow Automation MCP — Zapier / n8n / Make
// Trigger workflows, list automations, check execution status
// Enables connecting to 1000+ apps without building each integration

import { MCPServer, MCPServerConfig } from "../shared/server";

const CAPABILITIES = [
  { name: "workflow_trigger", description: "Trigger a webhook workflow", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["zapier", "n8n", "make"] }, webhookUrl: { type: "string" }, payload: { type: "object" } },
    required: ["provider", "webhookUrl", "payload"] }
  },
  { name: "workflow_list", description: "List active workflows/automations", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["n8n"] }, active: { type: "boolean" } },
    required: ["provider"] }
  },
  { name: "workflow_execute", description: "Execute n8n workflow by ID with data", schema: {
    type: "object", properties: { workflowId: { type: "string" }, data: { type: "object" } },
    required: ["workflowId"] }
  },
  { name: "workflow_status", description: "Check execution status", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["n8n"] }, executionId: { type: "string" } },
    required: ["provider", "executionId"] }
  },
  { name: "workflow_health", description: "Health check", schema: { type: "object", properties: {} } },
];

const server = new MCPServer({
  name: "workflow-mcp", version: "1.0.0", capabilities: CAPABILITIES,
  transport: "http", port: 3112,
});

async function n8nAPI(endpoint: string, method = "GET", body?: any) {
  const apiKey = process.env.N8N_API_KEY || "";
  const baseUrl = process.env.N8N_BASE_URL || "http://localhost:5678";
  const res = await fetch(`${baseUrl}/api/v1${endpoint}`, {
    method, headers: { "X-N8N-API-KEY": apiKey, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`n8n ${res.status}: ${await res.text()}`);
  return res.json();
}

server.register("workflow_trigger", async (p) => {
  const cb = server.getCircuitBreaker("workflow");
  return cb.call(async () => {
    const res = await fetch(p?.webhookUrl as string, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p?.payload || {}),
    });
    if (!res.ok) throw new Error(`Webhook ${res.status}: ${await res.text()}`);
    return { triggered: true, status: res.status, provider: p?.provider };
  });
});

server.register("workflow_list", async (p) => {
  const cb = server.getCircuitBreaker("workflow");
  return cb.call(async () => {
    const qs = p?.active !== undefined ? `?active=${p.active}` : "";
    const data = await n8nAPI(`/workflows${qs}`);
    return { workflows: (data.data || []).map((w: any) => ({ id: w.id, name: w.name, active: w.active, updatedAt: w.updatedAt })), count: data.data?.length || 0 };
  });
});

server.register("workflow_execute", async (p) =>
  server.getCircuitBreaker("workflow").call(() =>
    n8nAPI(`/workflows/${p?.workflowId}/execute`, "POST", { data: p?.data || {} })
  )
);

server.register("workflow_status", async (p) =>
  server.getCircuitBreaker("workflow").call(() =>
    n8nAPI(`/executions/${p?.executionId}`)
  )
);

server.register("workflow_health", async () => {
  try { await fetch(`${process.env.N8N_BASE_URL || "http://localhost:5678"}/healthz`); return { status: "healthy" }; }
  catch { return { status: "unreachable", note: "n8n not running or N8N_BASE_URL not configured" }; }
});

server.start();
