#!/usr/bin/env node
// MCP Registry Server — central service discovery & health aggregation
// All MCP servers register here. AI agent framework queries /discover to find tools.
// 
// Transport: HTTP only (port 3100) — not stdio
// Prometheus metrics at /metrics, health at /health

import { MCPServer, MCPServerConfig } from "../shared/server";
import { execSync } from "node:child_process";

interface RegisteredServer {
  name: string;
  version: string;
  url: string;
  registeredAt: string;
  lastHealthCheck: string;
  status: "healthy" | "degraded" | "unhealthy";
  capabilities: { name: string; description: string }[];
}

const registry = new Map<string, RegisteredServer>();

const server = new MCPServer({
  name: "mcp-registry",
  version: "1.0.0",
  transport: "http",
  port: 3100,
  capabilities: [
    {
      name: "register",
      description: "Register an MCP server in the central registry. Call on startup.",
      schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          version: { type: "string" },
          url: { type: "string" },
          capabilities: { type: "array" },
        },
        required: ["name", "version", "url", "capabilities"],
      },
    },
    {
      name: "discover",
      description: "Get all registered MCP servers and their capabilities. Used by the AI agent framework for tool discovery.",
      schema: { type: "object", properties: {} },
    },
    {
      name: "deregister",
      description: "Remove a server from the registry.",
      schema: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
    },
    {
      name: "health_all",
      description: "Run health checks on all registered servers and return aggregated status.",
      schema: { type: "object", properties: {} },
    },
    {
      name: "health_server",
      description: "Get health status of a specific registered server.",
      schema: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
    },
  ],
});

// ── Handlers ──

server.register("register", async (params) => {
  const { name, version, url, capabilities } = (params || {}) as Record<string, any>;
  const existing = registry.get(name as string);

  const entry: RegisteredServer = {
    name: name as string,
    version: version as string,
    url: url as string,
    registeredAt: new Date().toISOString(),
    lastHealthCheck: new Date().toISOString(),
    status: "healthy",
    capabilities: capabilities as any[],
  };

  registry.set(name as string, entry);
  console.log(`[registry] ${name} v${version} registered <- ${url}`);

  return {
    registered: true,
    action: existing ? "updated" : "created",
    totalServers: registry.size,
  };
});

server.register("discover", async () => {
  const servers = Array.from(registry.values()).map((s) => ({
    name: s.name,
    version: s.version,
    status: s.status,
    url: s.url,
    capabilities: s.capabilities.map((c) => `${c.name}: ${c.description}`),
    lastHealth: s.lastHealthCheck,
  }));

  const allTools = Array.from(registry.values()).flatMap((s) =>
    s.capabilities.map((c) => ({
      tool: c.name,
      description: c.description,
      server: s.name,
      serverStatus: s.status,
    })),
  );

  return {
    servers,
    totalCount: registry.size,
    healthyCount: Array.from(registry.values()).filter((s) => s.status === "healthy").length,
    allTools,
    timestamp: new Date().toISOString(),
  };
});

server.register("deregister", async (params) => {
  const { name } = (params || {}) as Record<string, string>;
  const existed = registry.delete(name);
  return { deregistered: existed, remaining: registry.size };
});

server.register("health_all", async () => {
  const results: Record<string, any> = {};
  let healthy = 0;
  let degraded = 0;
  let unhealthy = 0;

  for (const [name, entry] of registry) {
    try {
      const res = await fetch(`${entry.url}/health`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        results[name] = data;
        entry.lastHealthCheck = new Date().toISOString();
        entry.status = data.status || "healthy";
        if (data.status === "degraded") degraded++;
        else healthy++;

        // Update circuit breaker metric
        const cb = server.getCircuitBreaker(name);
        const cbState = cb.getCircuitState();
        server.getMetrics().circuitBreakerState.set(
          { service: name },
          cbState === "closed" ? 0 : cbState === "half_open" ? 1 : 2,
        );
      } else {
        results[name] = { status: "unhealthy", httpStatus: res.status };
        entry.status = "degraded";
        degraded++;
      }
    } catch (e: any) {
      results[name] = { status: "unhealthy", error: e?.message };
      entry.status = "unhealthy";
      entry.lastHealthCheck = new Date().toISOString();
      unhealthy++;
    }
  }

  return {
    servers: results,
    summary: { total: registry.size, healthy, degraded, unhealthy },
    timestamp: new Date().toISOString(),
  };
});

server.register("health_server", async (params) => {
  const { name } = (params || {}) as Record<string, string>;
  const entry = registry.get(name);
  if (!entry) return { error: `Server '${name}' not found in registry` };

  try {
    const res = await fetch(`${entry.url}/health`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { status: "unhealthy", httpStatus: res.status };
    const data = await res.json();
    entry.lastHealthCheck = new Date().toISOString();
    entry.status = data.status || "healthy";
    return data;
  } catch (e: any) {
    entry.status = "unhealthy";
    return { status: "unhealthy", error: e?.message };
  }
});

// ── Auto-register known servers on startup ──

async function autoRegister() {
  const knownServers = [
    { name: "postgres-mcp", url: "http://127.0.0.1:3101", capabilities: ["query", "schema", "matters", "documents", "audit"] },
    { name: "cloudflare-mcp", url: "http://127.0.0.1:3102", capabilities: ["text_gen", "embeddings", "chat"] },
    { name: "document-mcp", url: "http://127.0.0.1:3103", capabilities: ["search", "list", "chunks", "index"] },
  ];

  for (const known of knownServers) {
    try {
      const res = await fetch(`${known.url}/health`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        registry.set(known.name, {
          name: known.name,
          version: "1.0.0",
          url: known.url,
          registeredAt: new Date().toISOString(),
          lastHealthCheck: new Date().toISOString(),
          status: "healthy",
          capabilities: known.capabilities.map((c) => ({ name: c, description: `Auto-discovered ${c} capability` })),
        });
        console.log(`[registry] Auto-discovered: ${known.name} @ ${known.url}`);
      }
    } catch {
      console.log(`[registry] ${known.name} not yet running — will register when it comes online`);
    }
  }
}

setTimeout(autoRegister, 3000);

server.start();
