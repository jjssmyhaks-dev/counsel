// OCR / Document Parsing MCP — AWS Textract + Azure Document Intelligence
// Extract text from scanned PDFs, handwritten notes, forms, tables

import { MCPServer, MCPServerConfig } from "../shared/server";

const CAPABILITIES = [
  { name: "ocr_analyze", description: "Extract text and structure from document", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["textract", "azure"] }, documentBase64: { type: "string" }, features: { type: "array" } },
    required: ["provider", "documentBase64"] }
  },
  { name: "ocr_forms", description: "Extract key-value pairs from forms", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["textract", "azure"] }, documentBase64: { type: "string" } },
    required: ["provider", "documentBase64"] }
  },
  { name: "ocr_tables", description: "Extract tables from documents", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["textract", "azure"] }, documentBase64: { type: "string" } },
    required: ["provider", "documentBase64"] }
  },
  { name: "ocr_async_start", description: "Start async document analysis (large docs)", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["textract"] }, s3Bucket: { type: "string" }, s3Key: { type: "string" } },
    required: ["provider", "s3Bucket", "s3Key"] }
  },
  { name: "ocr_async_result", description: "Get async analysis result", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["textract"] }, jobId: { type: "string" } },
    required: ["provider", "jobId"] }
  },
  { name: "ocr_health", description: "Health check", schema: { type: "object", properties: {} } },
];

const server = new MCPServer({
  name: "ocr-mcp", version: "1.0.0", capabilities: CAPABILITIES,
  transport: "http", port: 3113,
});

async function textractAPI(operation: string, body: any) {
  const region = process.env.AWS_REGION || "us-east-1";
  const res = await fetch(`https://textract.${region}.amazonaws.com/`, {
    method: "POST", headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": `Textract.${operation}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Textract ${res.status}: ${await res.text()}`);
  return res.json();
}

async function azureDocIntel(endpoint: string, method = "POST", body?: any) {
  const key = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY || "";
  const endpoint_base = process.env.AZURE_DOCINTEL_ENDPOINT || "";
  const res = await fetch(`${endpoint_base}${endpoint}`, {
    method, headers: { "Ocp-Apim-Subscription-Key": key, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Azure DocIntel ${res.status}: ${await res.text()}`);
  return res.json();
}

server.register("ocr_analyze", async (p) => {
  const cb = server.getCircuitBreaker("ocr");
  return cb.call(async () => {
    const doc = p?.documentBase64 as string;
    if (p?.provider === "textract") {
      const data = await textractAPI("DetectDocumentText", {
        Document: { Bytes: doc },
      });
      return {
        text: (data.Blocks || []).filter((b: any) => b.BlockType === "LINE").map((b: any) => b.Text).join("\n"),
        pages: data.DocumentMetadata?.Pages || 1,
        blockCount: (data.Blocks || []).length,
      };
    }
    if (p?.provider === "azure") {
      return azureDocIntel("/formrecognizer/documentModels/prebuilt-read:analyze?api-version=2024-02-29-preview", "POST", {
        base64Source: doc,
      });
    }
    throw new Error(`Unknown provider: ${p?.provider}`);
  });
});

server.register("ocr_forms", async (p) => {
  const cb = server.getCircuitBreaker("ocr");
  return cb.call(async () => {
    const doc = p?.documentBase64 as string;
    if (p?.provider === "textract") {
      const data = await textractAPI("AnalyzeDocument", {
        Document: { Bytes: doc },
        FeatureTypes: ["FORMS"],
      });
      const keyValues = (data.Blocks || []).filter((b: any) => b.BlockType === "KEY_VALUE_SET" && b.EntityTypes?.includes("KEY"));
      return {
        fields: keyValues.map((kv: any) => {
          const key = (kv.Relationships || []).find((r: any) => r.Type === "CHILD")?.Ids?.map((id: string) =>
            data.Blocks.find((b: any) => b.Id === id)?.Text).join(" ") || "";
          const value = (kv.Relationships || []).find((r: any) => r.Type === "VALUE")?.Ids?.map((id: string) =>
            data.Blocks.find((b: any) => b.Id === id)?.Text).join(" ") || "";
          return { key, value };
        }),
      };
    }
    if (p?.provider === "azure") {
      return azureDocIntel("/formrecognizer/documentModels/prebuilt-layout:analyze?api-version=2024-02-29-preview", "POST", { base64Source: doc });
    }
    throw new Error(`Unknown provider: ${p?.provider}`);
  });
});

server.register("ocr_tables", async (p) => {
  const cb = server.getCircuitBreaker("ocr");
  return cb.call(async () => {
    const doc = p?.documentBase64 as string;
    if (p?.provider === "textract") {
      const data = await textractAPI("AnalyzeDocument", {
        Document: { Bytes: doc },
        FeatureTypes: ["TABLES"],
      });
      return { tables: (data.Blocks || []).filter((b: any) => b.BlockType === "TABLE"), count: (data.Blocks || []).filter((b: any) => b.BlockType === "TABLE").length };
    }
    if (p?.provider === "azure") {
      return azureDocIntel("/formrecognizer/documentModels/prebuilt-layout:analyze?api-version=2024-02-29-preview", "POST", { base64Source: doc });
    }
    throw new Error(`Unknown provider: ${p?.provider}`);
  });
});

server.register("ocr_async_start", async (p) =>
  server.getCircuitBreaker("ocr").call(() =>
    textractAPI("StartDocumentAnalysis", {
      DocumentLocation: { S3Object: { Bucket: p?.s3Bucket, Name: p?.s3Key } },
      FeatureTypes: ["TABLES", "FORMS"],
    })
  )
);

server.register("ocr_async_result", async (p) =>
  server.getCircuitBreaker("ocr").call(() =>
    textractAPI("GetDocumentAnalysis", { JobId: p?.jobId })
  )
);

server.register("ocr_health", async () => {
  const ok: any = {};
  try { await textractAPI("DetectDocumentText", { Document: { Bytes: Buffer.from("test").toString("base64") } }); ok.textract = "healthy"; } catch { ok.textract = "unreachable"; }
  try { await azureDocIntel("/formrecognizer/info?api-version=2024-02-29-preview", "GET"); ok.azure = "healthy"; } catch { ok.azure = "unreachable"; }
  return { status: Object.values(ok).some(v => v === "healthy") ? "healthy" : "degraded", providers: ok };
});

server.start();
