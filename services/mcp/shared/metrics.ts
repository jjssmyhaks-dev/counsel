// Shared Prometheus metrics for all MCP servers
import client from "prom-client";

// Create a registry per server instance
export function createMetricsRegistry(serverName: string) {
  const register = new client.Registry();
  register.setDefaultLabels({ service: serverName });

  // Standard metrics
  const requestCounter = new client.Counter({
    name: "mcp_requests_total",
    help: "Total MCP requests received",
    labelNames: ["method", "status"],
    registers: [register],
  });

  const requestDuration = new client.Histogram({
    name: "mcp_request_duration_ms",
    help: "MCP request duration in milliseconds",
    labelNames: ["method"],
    buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
    registers: [register],
  });

  const externalCallCounter = new client.Counter({
    name: "mcp_external_calls_total",
    help: "External API calls made",
    labelNames: ["service", "status"],
    registers: [register],
  });

  const errorRate = new client.Gauge({
    name: "mcp_error_rate",
    help: "Error rate as percentage over last window",
    registers: [register],
  });

  const activeConnections = new client.Gauge({
    name: "mcp_active_connections",
    help: "Active MCP connections",
    registers: [register],
  });

  const circuitBreakerState = new client.Gauge({
    name: "mcp_circuit_breaker_state",
    help: "Circuit breaker state (0=closed, 1=half_open, 2=open)",
    labelNames: ["service"],
    registers: [register],
  });

  const lastSuccessTimestamp = new client.Gauge({
    name: "mcp_last_success_timestamp",
    help: "Unix timestamp of last successful external call",
    labelNames: ["service"],
    registers: [register],
  });

  // Collect default metrics
  client.collectDefaultMetrics({ register });

  return {
    register,
    requestCounter,
    requestDuration,
    externalCallCounter,
    errorRate,
    activeConnections,
    circuitBreakerState,
    lastSuccessTimestamp,
  };
}
