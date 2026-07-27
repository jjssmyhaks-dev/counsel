// MCP Server Framework — factory that wraps any MCP server with:
// - Transport (stdio/HTTP SSE)
// - Prometheus metrics
// - Health endpoint
// - Graceful degradation
// - Structured logging

import { execSync } from "node:child_process";
import { createMetricsRegistry } from "./metrics";
import { CircuitBreaker } from "./circuit-breaker";
import {
  MCPRequest,
  MCPResponse,
  MCPCapability,
  MCPHealthStatus,
  MCP_ERROR_CODES,
  mcpSuccess,
  mcpError,
  degradeFallback,
} from "./protocol";

type MethodHandler = (
  params: Record<string, unknown> | undefined,
) => Promise<unknown>;

export interface MCPServerConfig {
  name: string;
  version: string;
  capabilities: MCPCapability[];
  port?: number; // for HTTP mode
  transport?: "stdio" | "http";
}

export class MCPServer {
  readonly name: string;
  readonly version: string;
  readonly capabilities: MCPCapability[];
  readonly transport: "stdio" | "http";
  readonly port: number;

  private handlers = new Map<string, MethodHandler>();
  private metrics: ReturnType<typeof createMetricsRegistry>;
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private startTime: number;
  private totalRequests = 0;
  private errorCount = 0;
  private latencies: number[] = [];

  constructor(config: MCPServerConfig) {
    this.name = config.name;
    this.version = config.version;
    this.capabilities = config.capabilities;
    this.transport = config.transport || "stdio";
    this.port = config.port || 3000;
    this.metrics = createMetricsRegistry(config.name);
    this.startTime = Date.now();

    // Register MCP built-in methods
    this.register("initialize", () => this.initialize());
    this.register("ping", () => ({ pong: true, server: this.name }));
    this.register("tools/list", () => this.listTools());
    this.register("tools/call", (p) => this.callTool(p));
    this.register("health", () => this.getHealth());
    this.register("shutdown", () => this.shutdown());
  }

  register(method: string, handler: MethodHandler): void {
    this.handlers.set(method, handler);
  }

  getCircuitBreaker(service: string): CircuitBreaker {
    const existing = this.circuitBreakers.get(service);
    if (existing) return existing;
    const cb = new CircuitBreaker(service);
    this.circuitBreakers.set(service, cb);
    return cb;
  }

  async handleRequest(req: MCPRequest): Promise<MCPResponse> {
    this.totalRequests++;
    const start = Date.now();
    const handler = this.handlers.get(req.method);

    try {
      this.metrics.activeConnections.inc();

      if (!handler) {
        this.errorCount++;
        this.metrics.errorRate.set((this.errorCount / this.totalRequests) * 100);
        return mcpError(req.id, MCP_ERROR_CODES.METHOD_NOT_FOUND,
          `Method '${req.method}' not found on ${this.name}`);
      }

      const result = await handler(req.params);
      const latency = Date.now() - start;
      this.latencies.push(latency);
      if (this.latencies.length > 1000) this.latencies.shift();

      this.metrics.requestCounter.inc({ method: req.method, status: "success" });
      this.metrics.requestDuration.observe({ method: req.method }, latency);

      return mcpSuccess(req.id, result);
    } catch (e: any) {
      this.errorCount++;
      this.metrics.errorRate.set((this.errorCount / this.totalRequests) * 100);
      this.metrics.requestCounter.inc({ method: req.method, status: "error" });

      const msg = e?.message || "Internal error";
      console.error(`[${this.name}] Error handling '${req.method}':`, msg);

      return mcpError(req.id, MCP_ERROR_CODES.INTERNAL_ERROR, msg);
    } finally {
      this.metrics.activeConnections.dec();
    }
  }

  async start(): Promise<void> {
    if (this.transport === "http") {
      const express = await import("express");
      const app = express.default();
      app.use(express.json());

      app.post("/mcp", async (req: any, res: any) => {
        const response = await this.handleRequest(req.body);
        res.json(response);
      });

      app.get("/health", (_req: any, res: any) => {
        res.json(this.getHealthSync());
      });

      app.get("/metrics", async (_req: any, res: any) => {
        res.set("Content-Type", this.metrics.register.contentType);
        res.end(await this.metrics.register.metrics());
      });

      app.listen(this.port, () => {
        console.log(`[${this.name}] HTTP MCP server on port ${this.port}`);
      });
    } else {
      // Stdio mode — read from stdin, write to stdout
      process.stdin.setEncoding("utf-8");
      let buffer = "";

      process.stdin.on("data", async (chunk: string) => {
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const req = JSON.parse(line);
            const resp = await this.handleRequest(req);
            process.stdout.write(JSON.stringify(resp) + "\n");
          } catch {
            process.stderr.write(`[${this.name}] Invalid JSON: ${line}\n`);
          }
        }
      });

      console.error(`[${this.name}] Stdio MCP server started`);
    }
  }

  // ── Built-in methods ──

  private initialize() {
    return {
      protocolVersion: "2024-11-05",
      serverInfo: { name: this.name, version: this.version },
      capabilities: this.capabilities.map((c) => ({
        name: c.name,
        description: c.description,
      })),
    };
  }

  private listTools() {
    return {
      tools: this.capabilities.map((c) => ({
        name: c.name,
        description: c.description,
        inputSchema: c.schema || { type: "object", properties: {} },
      })),
    };
  }

  private async callTool(params: any) {
    const toolName = params?.name as string;
    const toolArgs = (params?.arguments || params?.args || {}) as Record<string, unknown>;
    const handler = this.handlers.get(toolName);

    if (!handler) {
      return {
        content: [{ type: "text", text: `Tool '${toolName}' not found` }],
        isError: true,
      };
    }

    try {
      const result = await handler(toolArgs);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
      };
    } catch (e: any) {
      return {
        content: [
          { type: "text", text: `Tool error: ${e?.message || "Unknown error"}` },
        ],
        isError: true,
      };
    }
  }

  getHealthSync(): MCPHealthStatus {
    const avgLatency = this.latencies.length
      ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length
      : 0;
    const errorRate = this.totalRequests
      ? (this.errorCount / this.totalRequests) * 100
      : 0;

    let status: "healthy" | "degraded" | "unhealthy" = "healthy";
    if (errorRate > 10) status = "unhealthy";
    else if (errorRate > 2) status = "degraded";

    const uptime = (Date.now() - this.startTime) / 1000;

    return {
      status,
      uptime,
      version: this.version,
      capabilities: this.capabilities.map((c) => c.name),
      metrics: {
        totalRequests: this.totalRequests,
        errorRate: Math.round(errorRate * 100) / 100,
        avgLatencyMs: Math.round(avgLatency * 100) / 100,
      },
    };
  }

  private async getHealth() {
    return this.getHealthSync();
  }

  private shutdown() {
    console.log(`[${this.name}] Shutting down...`);
    process.exit(0);
  }

  getMetrics() {
    return this.metrics;
  }
}
