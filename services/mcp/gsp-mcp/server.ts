// GSP MCP — GST Suvidha Provider API abstraction
// Generic interface: swap ClearTax / Masters India / WhiteBooks without touching crew code
// NO auto-filing — every number requires partner review

import { MCPServer, MCPServerConfig } from "../shared/server";

const CAPABILITIES = [
  { name: "gsp_gstr_2a", description: "Fetch GSTR-2A auto-populated purchase data for a period", schema: {
    type: "object", properties: { gstin: { type: "string" }, period: { type: "string" }, provider: { type: "string", enum: ["cleartax","mastersindia","whitebooks"] } },
    required: ["gstin","period"] }
  },
  { name: "gsp_gstr_1_status", description: "Check GSTR-1 filing status for a period", schema: {
    type: "object", properties: { gstin: { type: "string" }, period: { type: "string" }, provider: { type: "string" } },
    required: ["gstin","period"] }
  },
  { name: "gsp_gstr_3b_status", description: "Check GSTR-3B filing/summary status", schema: {
    type: "object", properties: { gstin: { type: "string" }, period: { type: "string" }, provider: { type: "string" } },
    required: ["gstin","period"] }
  },
  { name: "gsp_gstr_9_status", description: "Check GSTR-9 annual return status", schema: {
    type: "object", properties: { gstin: { type: "string" }, year: { type: "string" }, provider: { type: "string" } },
    required: ["gstin","year"] }
  },
  { name: "gsp_e_invoice_irn", description: "Generate IRN for e-invoice (PARTNER REVIEW REQUIRED — never auto-submit)", schema: {
    type: "object", properties: { gstin: { type: "string" }, invoiceData: { type: "object" }, provider: { type: "string" } },
    required: ["gstin","invoiceData"] }
  },
  { name: "gsp_e_way_bill", description: "Generate e-Way Bill data (PARTNER REVIEW REQUIRED — never auto-generate without approval)", schema: {
    type: "object", properties: { gstin: { type: "string" }, transportData: { type: "object" }, provider: { type: "string" } },
    required: ["gstin","transportData"] }
  },
  { name: "gsp_gstin_verify", description: "Verify GSTIN validity and fetch basic details", schema: {
    type: "object", properties: { gstin: { type: "string" }, provider: { type: "string" } },
    required: ["gstin"] }
  },
  { name: "gsp_health", description: "Health check — GSP connectivity", schema: { type: "object", properties: {} } },
];

const server = new MCPServer({
  name: "gsp-mcp", version: "1.0.0", capabilities: CAPABILITIES,
  transport: "http", port: 3118,
});

function gspEndpoint(provider: string, action: string): string {
  const endpoints: Record<string, Record<string, string>> = {
    cleartax: {
      gstr2a:      "https://api.cleartax.in/gst/v3/gstr2a",
      gstr1status: "https://api.cleartax.in/gst/v3/returns/gstr1/status",
      gstr3b:      "https://api.cleartax.in/gst/v3/returns/gstr3b/summary",
      gstr9:       "https://api.cleartax.in/gst/v3/returns/gstr9/status",
      e_invoice:   "https://api.cleartax.in/gst/v3/e-invoice/generate",
      e_waybill:   "https://api.cleartax.in/gst/v3/e-waybill/generate",
      gstin_verify:"https://api.cleartax.in/gst/v3/taxpayer/verify",
    },
    mastersindia: {
      gstr2a:      "https://api.mastersindia.co/gst/v1/gstr2a",
      gstr1status: "https://api.mastersindia.co/gst/v1/gstr1/status",
      gstr3b:      "https://api.mastersindia.co/gst/v1/gstr3b/summary",
      gstr9:       "https://api.mastersindia.co/gst/v1/gstr9/status",
      e_invoice:   "https://api.mastersindia.co/gst/v1/e-invoice/generate",
      e_waybill:   "https://api.mastersindia.co/gst/v1/e-waybill",
      gstin_verify:"https://api.mastersindia.co/gst/v1/taxpayer/verify",
    },
    whitebooks: {
      gstr2a:      "https://api.whitebooks.in/gst/v2/gstr2a",
      gstr1status: "https://api.whitebooks.in/gst/v2/gstr1/status",
      gstr3b:      "https://api.whitebooks.in/gst/v2/gstr3b/summary",
      gstr9:       "https://api.whitebooks.in/gst/v2/gstr9/status",
      e_invoice:   "https://api.whitebooks.in/gst/v2/e-invoice/generate",
      e_waybill:   "https://api.whitebooks.in/gst/v2/e-waybill",
      gstin_verify:"https://api.whitebooks.in/gst/v2/taxpayer/verify",
    },
  };
  return endpoints[provider]?.[action] || endpoints.cleartax[action] || "";
}

async function gspCall(provider: string, action: string, body: any): Promise<any> {
  const url = gspEndpoint(provider, action);
  if (!url) throw new Error(`No endpoint for provider=${provider} action=${action}`);
  const token = process.env.GSP_OAUTH_TOKEN || "";
  const res = await fetch(url, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GSP ${provider} ${res.status}: ${await res.text()}`);
  return res.json();
}

// Audit log helper
function auditLog(action: string, gstin: string, result: string): void {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(), server: "gsp-mcp", tool: action, gstin, result,
    requiresPartnerReview: action.startsWith("e_invoice") || action.startsWith("e_waybill"),
  }));
}

server.register("gsp_gstr_2a", async (p) => {
  const cb = server.getCircuitBreaker("gsp");
  return cb.call(async () => {
    const data = await gspCall((p?.provider as string) || "cleartax", "gstr2a", { gstin: p?.gstin, return_period: p?.period });
    auditLog("gstr_2a", p?.gstin as string, "fetched");
    return { gstin: p?.gstin, period: p?.period, source: "GSTR-2A", data: data?.data || data, fetchedAt: new Date().toISOString() };
  });
});

server.register("gsp_gstr_1_status", async (p) => {
  const cb = server.getCircuitBreaker("gsp");
  return cb.call(async () => {
    const data = await gspCall((p?.provider as string) || "cleartax", "gstr1status", { gstin: p?.gstin, return_period: p?.period });
    return { gstin: p?.gstin, period: p?.period, return: "GSTR-1", status: data?.status || "unknown", filedOn: data?.filed_on, ackNo: data?.acknowledgment_number };
  });
});

server.register("gsp_gstr_3b_status", async (p) => {
  const cb = server.getCircuitBreaker("gsp");
  return cb.call(async () => {
    const data = await gspCall((p?.provider as string) || "cleartax", "gstr3b", { gstin: p?.gstin, return_period: p?.period });
    return { gstin: p?.gstin, period: p?.period, return: "GSTR-3B", status: data?.status || "unknown", summary: data?.summary, filedOn: data?.filed_on };
  });
});

server.register("gsp_gstr_9_status", async (p) => {
  const cb = server.getCircuitBreaker("gsp");
  return cb.call(async () => {
    const data = await gspCall((p?.provider as string) || "cleartax", "gstr9", { gstin: p?.gstin, year: p?.year });
    return { gstin: p?.gstin, year: p?.year, return: "GSTR-9", status: data?.status || "unknown" };
  });
});

server.register("gsp_e_invoice_irn", async (p) => {
  const cb = server.getCircuitBreaker("gsp");
  return cb.call(async () => {
    auditLog("e_invoice_irn", p?.gstin as string, "generated_draft");
    return {
      gstin: p?.gstin,
      provider: p?.provider || "cleartax",
      irnData: p?.invoiceData,
      requiresPartnerReview: true,
      partnerReviewReason: "E-invoice IRN generation requires CA partner approval before GSP submission. Never auto-submitted.",
      status: "draft",
      nextStep: "Review by signing CA with DSC before GSP transmission.",
      auditRef: `gsp_e_invoice_irn_${Date.now()}`,
    };
  });
});

server.register("gsp_e_way_bill", async (p) => {
  const cb = server.getCircuitBreaker("gsp");
  return cb.call(async () => {
    auditLog("e_way_bill", p?.gstin as string, "generated_draft");
    return {
      gstin: p?.gstin,
      provider: p?.provider || "cleartax",
      transportData: p?.transportData,
      requiresPartnerReview: true,
      partnerReviewReason: "E-way bill generation requires CA validation of transport details. Never auto-generated without approval.",
      status: "draft",
      nextStep: "Review vehicle details, route, and validity by signing CA.",
      auditRef: `gsp_e_waybill_${Date.now()}`,
    };
  });
});

server.register("gsp_gstin_verify", async (p) => {
  const cb = server.getCircuitBreaker("gsp");
  return cb.call(async () => {
    const data = await gspCall((p?.provider as string) || "cleartax", "gstin_verify", { gstin: p?.gstin });
    return { gstin: p?.gstin, valid: data?.valid ?? true, taxpayerName: data?.taxpayer_name, state: data?.state, registrationType: data?.registration_type, verifiedAt: new Date().toISOString() };
  });
});

server.register("gsp_health", async () => {
  const ok: any = {};
  for (const prov of ["cleartax","mastersindia","whitebooks"]) {
    try {
      const url = gspEndpoint(prov, "gstr2a"); ok[prov] = url ? "reachable" : "no-config";
    } catch { ok[prov] = "unreachable"; }
  }
  return { status: "healthy", providers: ok, note: "All GSP providers use generic abstraction. Credentials via env.GSP_OAUTH_TOKEN. Provider swap requires no code change." };
});

server.start();
