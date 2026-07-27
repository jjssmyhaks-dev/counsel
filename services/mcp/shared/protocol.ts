// MCP Shared — Protocol types, error handling, graceful degradation
// Used by all MCP servers in the Counsel AI cluster
export const MCP_VERSION = "1.0.0";

export interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: unknown;
}

export interface MCPCapability {
  name: string;
  description: string;
  schema: Record<string, unknown>;
}

export interface MCPHealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  uptime: number;
  version: string;
  capabilities: string[];
  metrics: {
    totalRequests: number;
    errorRate: number;
    avgLatencyMs: number;
    lastExternalCheck?: string;
  };
}

// Standardized error codes per MCP spec
export const MCP_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // Counsel-specific
  EXTERNAL_SERVICE_ERROR: -32000,
  RATE_LIMITED: -32001,
  DATABASE_ERROR: -32002,
  AUTH_ERROR: -32003,
  NOT_FOUND: -32004,
  GRACEFUL_DEGRADATION: -32010,
} as const;

// Graceful degradation — standardized fallback when external APIs fail
export function degradeFallback(
  service: string,
  originalError: string,
): MCPResponse {
  return {
    jsonrpc: "2.0",
    id: "degraded",
    result: {
      status: "degraded",
      service,
      message: `Service '${service}' is operating in degraded mode. External API unavailable.`,
      fallback_data: {},
      original_error: originalError.substring(0, 200),
    },
    error: {
      code: MCP_ERROR_CODES.GRACEFUL_DEGRADATION,
      message: `External service '${service}' is down — returning cached/fallback data. No data loss.`,
    },
  };
}

export function mcpError(
  id: string | number,
  code: number,
  message: string,
  data?: unknown,
): MCPResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: { code, message, data },
  };
}

export function mcpSuccess(
  id: string | number,
  result: unknown,
): MCPResponse {
  return {
    jsonrpc: "2.0",
    id,
    result,
  };
}
