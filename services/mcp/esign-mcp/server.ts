// E-Signature MCP — DocuSign + HelloSign/Dropbox Sign
// Send envelopes, check status, download signed docs

import { MCPServer, MCPServerConfig } from "../shared/server";

const CAPABILITIES = [
  { name: "esign_send", description: "Send document for signature", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["docusign", "hellosign"] }, documentBase64: { type: "string" }, signers: { type: "array" }, subject: { type: "string" }, message: { type: "string" }, matterId: { type: "string" } },
    required: ["provider", "documentBase64", "signers", "subject"] }
  },
  { name: "esign_status", description: "Check envelope/signature request status", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["docusign", "hellosign"] }, envelopeId: { type: "string" } },
    required: ["provider", "envelopeId"] }
  },
  { name: "esign_download", description: "Download signed document", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["docusign"] }, envelopeId: { type: "string" } },
    required: ["provider", "envelopeId"] }
  },
  { name: "esign_void", description: "Void/cancel signature request", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["docusign", "hellosign"] }, envelopeId: { type: "string" }, reason: { type: "string" } },
    required: ["provider", "envelopeId"] }
  },
  { name: "esign_list", description: "List recent envelopes/signature requests", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["docusign", "hellosign"] }, status: { type: "string", enum: ["sent", "delivered", "completed", "declined", "voided"] }, fromDate: { type: "string" } },
    required: ["provider"] }
  },
  { name: "esign_health", description: "Health check", schema: { type: "object", properties: {} } },
];

const server = new MCPServer({
  name: "esign-mcp", version: "1.0.0", capabilities: CAPABILITIES,
  transport: "http", port: 3107,
});

async function docusignAPI(endpoint: string, method = "GET", body?: any) {
  const token = process.env.DOCUSIGN_ACCESS_TOKEN || "";
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID || "";
  const baseUrl = process.env.DOCUSIGN_BASE_URL || "https://demo.docusign.net/restapi";
  const res = await fetch(`${baseUrl}/v2.1/accounts/${accountId}${endpoint}`, {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`DocuSign ${res.status}: ${await res.text()}`);
  return res.json();
}

async function hellosignAPI(endpoint: string, method = "GET", body?: any) {
  const apiKey = process.env.HELLOSIGN_API_KEY || "";
  const res = await fetch(`https://api.hellosign.com/v3${endpoint}`, {
    method, headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`HelloSign ${res.status}: ${await res.text()}`);
  return res.json();
}

server.register("esign_send", async (p) => {
  const cb = server.getCircuitBreaker("esign");
  return cb.call(async () => {
    if (p?.provider === "docusign") {
      return docusignAPI("/envelopes", "POST", {
        status: "sent", emailSubject: p.subject,
        documents: [{ documentBase64: p.documentBase64, name: "document.pdf", documentId: "1", fileExtension: "pdf" }],
        recipients: {
          signers: (p.signers as any[])?.map((s: any, i: number) => ({
            email: s.email, name: s.name, recipientId: String(i + 1), routingOrder: String(i + 1),
            tabs: { signHereTabs: [{ documentId: "1", pageNumber: "1", xPosition: "100", yPosition: "100" }] },
          })),
        },
      });
    }
    if (p?.provider === "hellosign") {
      return hellosignAPI("/signature_request/send", "POST", {
        title: p.subject, message: p.message || "", subject: p.subject,
        signers: (p.signers as any[])?.map((s: any) => ({ email_address: s.email, name: s.name })),
        files: [{ content: p.documentBase64, name: "document.pdf" }],
        test_mode: 1,
      });
    }
    throw new Error(`Unknown provider: ${p?.provider}`);
  });
});

server.register("esign_status", async (p) => {
  const cb = server.getCircuitBreaker("esign");
  return cb.call(async () => {
    if (p?.provider === "docusign") return docusignAPI(`/envelopes/${p.envelopeId}`);
    return hellosignAPI(`/signature_request/${p.envelopeId}`);
  });
});

server.register("esign_download", async (p) =>
  server.getCircuitBreaker("esign").call(() =>
    docusignAPI(`/envelopes/${p?.envelopeId}/documents/combined`)
  )
);

server.register("esign_void", async (p) => {
  const cb = server.getCircuitBreaker("esign");
  return cb.call(async () => {
    if (p?.provider === "docusign") return docusignAPI(`/envelopes/${p.envelopeId}`, "PUT", { status: "voided", voidedReason: p.reason || "Cancelled by counsel" });
    return hellosignAPI(`/signature_request/cancel/${p.envelopeId}`, "POST");
  });
});

server.register("esign_list", async (p) => {
  const cb = server.getCircuitBreaker("esign");
  return cb.call(async () => {
    if (p?.provider === "docusign") {
      const qs = new URLSearchParams();
      if (p.fromDate) qs.set("from_date", p.fromDate as string);
      return docusignAPI(`/envelopes?${qs}`);
    }
    return hellosignAPI("/signature_request/list");
  });
});

server.register("esign_health", async () => {
  const ok: any = {};
  try { await docusignAPI("/"); ok.docusign = "healthy"; } catch { ok.docusign = "unreachable"; }
  try { await hellosignAPI("/account"); ok.hellosign = "healthy"; } catch { ok.hellosign = "unreachable"; }
  return { status: Object.values(ok).some(v => v === "healthy") ? "healthy" : "degraded", providers: ok };
});

server.start();
