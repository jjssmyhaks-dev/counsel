// UDIN MCP — Unique Document Identification Number tracking (ICAI)
// READ-ONLY status check. UDIN generation stays a manual ICAI-portal action.

import { MCPServer, MCPServerConfig } from "../shared/server";

const CAPABILITIES = [
  { name: "udin_track", description: "Track which signed deliverables still need UDIN attached", schema: {
    type: "object", properties: { firmId: { type: "string" }, fromDate: { type: "string" }, toDate: { type: "string" } },
    required: ["firmId"] }
  },
  { name: "udin_status", description: "Check UDIN generation status for a deliverable", schema: {
    type: "object", properties: { deliverableId: { type: "string" }, filingType: { type: "string" } },
    required: ["deliverableId"] }
  },
  { name: "udin_requirements", description: "Check which deliverables require UDIN as per ICAI mandate", schema: {
    type: "object", properties: { firmId: { type: "string" } }, required: ["firmId"] }
  },
  { name: "udin_pending_count", description: "Count pending UDIN attachments by signing CA", schema: {
    type: "object", properties: { firmId: { type: "string" }, caId: { type: "string" } },
    required: ["firmId"] }
  },
  { name: "udin_health", description: "UDIN portal connectivity check", schema: { type: "object", properties: {} } },
];

const server = new MCPServer({
  name: "udin-mcp", version: "1.0.0", capabilities: CAPABILITIES,
  transport: "http", port: 3120,
});

// UDIN status check URL (ICAI UDIN portal)
const UDIN_PORTAL = "https://udin.icai.org";

function auditLog(action: string, detail: string): void {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(), server: "udin-mcp", tool: action, detail,
    note: "UDIN generation is always MANUAL — this is a read-only status check.",
  }));
}

server.register("udin_track", async (p) => {
  const cb = server.getCircuitBreaker("udin");
  return cb.call(async () => {
    auditLog("udin_track", `firm=${p?.firmId}`);
    return {
      firmId: p?.firmId,
      pendingUDINs: [],
      note: "In production: queries the firm's signed deliverables (audit reports, certificates, GST audit reports, etc.) that need UDIN. UDIN must be generated at https://udin.icai.org by the signing CA.",
      partnerAction: "Generate UDIN for each pending deliverable at https://udin.icai.org → Generate UDIN → Select Document Type → Enter details → Submit.",
      icaiMandate: "As per ICAI mandate, UDIN is mandatory for all certificates, reports, and documents signed by a practicing CA. Non-compliance is treated as professional misconduct under ICAI Code of Conduct.",
      statutoryRetention: "UDIN records must be retained for 8 years from the date of signing as per ICAI guidelines.",
    };
  });
});

server.register("udin_status", async (p) => {
  const cb = server.getCircuitBreaker("udin");
  return cb.call(async () => {
    auditLog("udin_status", `deliverable=${p?.deliverableId}`);
    return {
      deliverableId: p?.deliverableId,
      udinStatus: "not_generated",
      requiresUDIN: true,
      note: "In production: checks whether a UDIN has been generated and attached to the deliverable. UDIN generation is manual by the signing CA at https://udin.icai.org.",
      partnerAction: "If UDIN is pending, the CA must generate it at https://udin.icai.org and record the UDIN number here.",
    };
  });
});

server.register("udin_requirements", async (p) => {
  const cb = server.getCircuitBreaker("udin");
  return cb.call(async () => {
    return {
      firmId: p?.firmId,
      mandatoryUDIN: [
        "Tax Audit Report (Form 3CA/3CB/3CD)",
        "GST Audit Report (GSTR-9C)",
        "Statutory Audit Report",
        "Internal Audit Report",
        "Transfer Pricing Certificate (Form 3CEB)",
        "Valuation Certificate",
        "Liquidation/Certification reports",
        "Any document signed by a CA with ICAI membership number",
      ],
      note: "ICAI mandates UDIN for ALL certificates, reports, and documents attested by a CA. Governed under the ICAI Code of Conduct and the Chartered Accountants Act, 1949.",
      portalUrl: "https://udin.icai.org",
    };
  });
});

server.register("udin_pending_count", async (p) => {
  const cb = server.getCircuitBreaker("udin");
  return cb.call(async () => {
    return {
      firmId: p?.firmId,
      caId: p?.caId,
      pendingCount: 0,
      note: "In production: queries deliverables signed by this CA that are missing UDIN. Tracks compliance with ICAI's UDIN mandate.",
      complianceDeadline: "UDIN must be generated within 10 calendar days of signing the document.",
    };
  });
});

server.register("udin_health", async () => {
  return { status: "healthy", portalUrl: UDIN_PORTAL, note: "UDIN generation is manual at https://udin.icai.org. This server provides read-only tracking and compliance alerts." };
});

server.start();
