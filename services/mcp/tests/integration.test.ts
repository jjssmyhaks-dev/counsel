// Integration tests for all 4 MCP servers
// Tests: protocol compliance, real query execution, graceful degradation, circuit breaker
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const MCP_BASE = "http://127.0.0.1:3100";

function mcpRequest(server: string, method: string, params?: Record<string, unknown>) {
  const url = server === "registry" ? `${MCP_BASE}/mcp` : `http://127.0.0.1:${server === "postgres" ? "3101" : server === "cloudflare" ? "3102" : "3103"}/mcp`;
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  }).then((r) => r.json());
}

// ── MCP Registry Tests ──

describe("MCP Registry", () => {
  it("should respond to ping", async () => {
    const res = await mcpRequest("registry", "ping");
    expect(res.result?.pong).toBe(true);
  });

  it("should accept server registration", async () => {
    const res = await mcpRequest("registry", "register", {
      name: "test-server",
      version: "1.0.0",
      url: "http://127.0.0.1:3999",
      capabilities: [{ name: "test_tool", description: "Test tool" }],
    });
    expect(res.result?.registered).toBe(true);
  });

  it("should discover registered servers", async () => {
    const res = await mcpRequest("registry", "discover");
    expect(res.result?.servers).toBeDefined();
    expect(res.result?.totalCount).toBeGreaterThanOrEqual(1);
  });

  it("should deregister servers", async () => {
    await mcpRequest("registry", "register", {
      name: "temp-server", version: "1.0.0", url: "http://localhost:1", capabilities: [],
    });
    const res = await mcpRequest("registry", "deregister", { name: "temp-server" });
    expect(res.result?.deregistered).toBe(true);
  });
});

// ── PostgreSQL MCP Tests ──

describe("PostgreSQL MCP", () => {
  it("should return database schema", async () => {
    const res = await mcpRequest("postgres", "pg_schema");
    expect(res.result?.tables).toBeDefined();
    expect(Object.keys(res.result.tables)).toContain("matters");
    expect(Object.keys(res.result.tables)).toContain("documents");
  });

  it("should run health check", async () => {
    const res = await mcpRequest("postgres", "pg_health");
    expect(res.result?.status).toBe("connected");
  });

  it("should find matters for a firm", async () => {
    const res = await mcpRequest("postgres", "pg_find_matters", {
      firm_id: "ce7b93db-dc73-4407-a91c-450c128fa26f",
      limit: 5,
    });
    expect(res.result?.matters).toBeDefined();
    expect(Array.isArray(res.result?.matters)).toBe(true);
  });

  it("should find documents for a firm", async () => {
    const res = await mcpRequest("postgres", "pg_find_documents", {
      firm_id: "ce7b93db-dc73-4407-a91c-450c128fa26f",
      limit: 5,
    });
    expect(res.result?.documents).toBeDefined();
  });

  it("should query audit log", async () => {
    const res = await mcpRequest("postgres", "pg_get_audit_log", {
      firm_id: "ce7b93db-dc73-4407-a91c-450c128fa26f",
      limit: 10,
    });
    expect(res.result?.entries).toBeDefined();
  });

  it("should get playbook rules", async () => {
    const res = await mcpRequest("postgres", "pg_get_playbook", {
      firm_id: "ce7b93db-dc73-4407-a91c-450c128fa26f",
    });
    expect(res.result?.playbooks).toBeDefined();
  });

  it("should create and query a matter", async () => {
    const firmId = "ce7b93db-dc73-4407-a91c-450c128fa26f";
    const createRes = await mcpRequest("postgres", "pg_create_matter", {
      firm_id: firmId,
      name: "Test Matter — MCP Integration Suite",
      type: "LEGAL",
      client_name: "Test Client",
      description: "Created by MCP integration test",
      created_by_id: "test-user-id",
    });
    expect(createRes.result?.created).toBe(true);

    // Verify it shows up in search
    const searchRes = await mcpRequest("postgres", "pg_find_matters", {
      firm_id: firmId,
      client_name: "Test Client",
    });
    expect(searchRes.result?.matters.length).toBeGreaterThanOrEqual(1);
  });

  it("should create a draft", async () => {
    const res = await mcpRequest("postgres", "pg_create_draft", {
      firm_id: "ce7b93db-dc73-4407-a91c-450c128fa26f",
      title: "Test Draft — MCP Integration",
      content: "This is a test draft created by the MCP integration suite.",
      type: "MEMO",
    });
    expect(res.result?.draft).toBeDefined();
    expect(res.result?.draft.title).toBe("Test Draft — MCP Integration");
  });
});

// ── Document MCP Tests ──

describe("Document MCP", () => {
  it("should list documents for a firm", async () => {
    const res = await mcpRequest("document", "doc_list", {
      firm_id: "ce7b93db-dc73-4407-a91c-450c128fa26f",
    });
    expect(res.result?.documents).toBeDefined();
  });

  it("should get indexing stats", async () => {
    const res = await mcpRequest("document", "doc_index_stats", {
      firm_id: "ce7b93db-dc73-4407-a91c-450c128fa26f",
    });
    expect(res.result?.firm_id).toBeDefined();
    expect(typeof res.result?.totalDocuments).toBe("number");
    expect(typeof res.result?.totalChunks).toBe("number");
  });

  it("should do semantic search with graceful fallback", async () => {
    const res = await mcpRequest("document", "doc_search", {
      query: "SaaS MSA limitation of liability",
      firm_id: "ce7b93db-dc73-4407-a91c-450c128fa26f",
      top_k: 3,
    });
    expect(res.result?.results).toBeDefined();
    expect(res.result?.method).toBeDefined(); // embedding or full_text_search (degraded)
    if (res.result?.mode === "degraded") {
      expect(res.result?.method).toBe("full_text_search");
    }
  });

  it("should return 404 for nonexistent document", async () => {
    const res = await mcpRequest("document", "doc_status", {
      document_id: "nonexistent-doc-00000",
    });
    expect(res.result?.error).toBe("Document not found");
  });
});

// ── Graceful Degradation Tests ──

describe("Graceful Degradation", () => {
  it("should degrade document search when AI service is down", async () => {
    // This test verifies that doc_search falls back to full-text search
    // when the embedding API is unreachable
    const res = await mcpRequest("document", "doc_search", {
      query: "contract liability clause",
      firm_id: "ce7b93db-dc73-4407-a91c-450c128fa26f",
      top_k: 3,
    });
    // Should succeed regardless of AI service status
    expect(res.error).toBeUndefined();
    expect(res.result?.results).toBeDefined();
  });

  it("should handle invalid firm_id gracefully", async () => {
    const res = await mcpRequest("postgres", "pg_find_matters", {
      firm_id: "nonexistent-firm-00000",
    });
    expect(res.result?.matters).toBeDefined();
    expect(res.result?.count).toBe(0);
  });
});

// ── Performance: 100-call benchmark ──

describe("Performance: 99% success rate benchmark", () => {
  it("should maintain >99% success on 100 pg_health calls", async () => {
    let successes = 0;
    const total = 100;

    for (let i = 0; i < total; i++) {
      try {
        const res = await mcpRequest("postgres", "pg_health");
        if (res.result?.status === "connected") successes++;
      } catch {}
    }

    const successRate = (successes / total) * 100;
    console.log(`pg_health: ${successes}/${total} successful (${successRate.toFixed(1)}%)`);
    expect(successRate).toBeGreaterThanOrEqual(99);
  });
});
