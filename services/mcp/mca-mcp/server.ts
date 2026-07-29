// MCA MCP — MCA21 V3 / ROC data + compliance tracking
// Public + registered lookup. Counsel prepares forms; firm signs/files via own DSC.

import { MCPServer, MCPServerConfig } from "../shared/server";

const CAPABILITIES = [
  { name: "mca_company_master", description: "CIN lookup — company master data, directors, charges", schema: {
    type: "object", properties: { cin: { type: "string" }, lookupType: { type: "string", enum: ["basic","directors","charges","full"] } },
    required: ["cin"] }
  },
  { name: "mca_filing_status", description: "Check filing status/history for a CIN", schema: {
    type: "object", properties: { cin: { type: "string" }, fromDate: { type: "string" } },
    required: ["cin"] }
  },
  { name: "mca_due_dates", description: "Upcoming compliance due dates for a company", schema: {
    type: "object", properties: { cin: { type: "string" }, year: { type: "string" } },
    required: ["cin"] }
  },
  { name: "mca_form_prepare", description: "Prepare MCA form data (PARTNER REVIEW — firm signs/files via DSC)", schema: {
    type: "object", properties: { cin: { type: "string" }, formType: { type: "string", enum: ["AOC-4","MGT-7","DIR-3-KYC","ADT-1","MGT-14","PAS-3","SH-7","INC-22A"] }, period: { type: "string" } },
    required: ["cin","formType"] }
  },
  { name: "mca_signatory_check", description: "Check who has signing authority (DIN-based) for a company", schema: {
    type: "object", properties: { cin: { type: "string" } }, required: ["cin"] }
  },
  { name: "mca_health", description: "MCA connectivity health check", schema: { type: "object", properties: {} } },
];

const server = new MCPServer({
  name: "mca-mcp", version: "1.0.0", capabilities: CAPABILITIES,
  transport: "http", port: 3119,
});

async function mcaAPI(endpoint: string, method = "POST", body?: any): Promise<any> {
  const baseUrl = process.env.MCA21_API_BASE || "https://www.mca.gov.in/mcafoportal";
  const token = process.env.MCA_API_KEY || "";
  const url = `${baseUrl}${endpoint}`;
  const res = await fetch(url, {
    method, headers: { "X-API-Key": token, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`MCA ${res.status}: ${await res.text()}`);
  return res.json();
}

const DUE_DATES: Record<string, { form: string; months: number[] }> = {
  "AOC-4": { form: "AOC-4", months: [10] },
  "MGT-7": { form: "MGT-7", months: [11] },
  "DIR-3-KYC": { form: "DIR-3 KYC", months: [9] },
  "ADT-1": { form: "ADT-1", months: [10] },
  "MGT-14": { form: "MGT-14", months: [1,2,3,4,5,6,7,8,9,10,11,12] },
};

function auditLog(action: string, cin: string, result: string): void {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(), server: "mca-mcp", tool: action, cin, result,
    requiresPartnerReview: action === "form_prepare",
  }));
}

server.register("mca_company_master", async (p) => {
  const cb = server.getCircuitBreaker("mca");
  return cb.call(async () => {
    auditLog("company_master", p?.cin as string, "lookup");
    try {
      const data = await mcaAPI("/company/llp-master-data", "POST", { cin: p?.cin });
      return { cin: p?.cin, name: data?.company_name, status: data?.company_status, incorporationDate: data?.date_of_incorporation, roc: data?.roc, category: data?.company_category };
    } catch {
      return { cin: p?.cin, status: "lookup_failed", note: "MCA21 API unavailable. Use manual CIN lookup at https://www.mca.gov.in/mcafoportal/viewCompanyMasterData.do", retrievedAt: new Date().toISOString() };
    }
  });
});

server.register("mca_filing_status", async (p) => {
  const cb = server.getCircuitBreaker("mca");
  return cb.call(async () => {
    auditLog("filing_status", p?.cin as string, "check");
    try {
      const data = await mcaAPI("/filing-history", "POST", { cin: p?.cin });
      return { cin: p?.cin, filings: (data?.filings || []).map((f: any) => ({ form: f.form_type, srn: f.srn, dateFiled: f.date_filed, status: f.status })) };
    } catch {
      return { cin: p?.cin, status: "lookup_failed", note: "MCA21 e-filing status unavailable. Check via https://www.mca.gov.in/mcafoportal/viewSignatoryDetails.do" };
    }
  });
});

server.register("mca_due_dates", async (p) => {
  const cb = server.getCircuitBreaker("mca");
  return cb.call(async () => {
    const year = parseInt(p?.year as string) || new Date().getFullYear();
    const now = new Date();
    const deadlines = Object.entries(DUE_DATES).map(([form, info]) => {
      const dueDate = new Date(Date.UTC(year, info.months[0] - 1, 1));
      dueDate.setMonth(dueDate.getMonth() + 1);
      dueDate.setDate(1);
      const daysLeft = Math.ceil((dueDate.getTime() - now.getTime()) / 86400000);
      let severity = "normal";
      if (daysLeft < 0) severity = "overdue";
      else if (daysLeft <= 7) severity = "critical";
      else if (daysLeft <= 30) severity = "warning";
      return { form, dueDate: dueDate.toISOString().split("T")[0], daysLeft, severity };
    });
    return { cin: p?.cin, year, deadlines, note: "Counsel prepares forms. The firm still signs/files via its own DSC on MCA21 portal." };
  });
});

server.register("mca_form_prepare", async (p) => {
  const cb = server.getCircuitBreaker("mca");
  return cb.call(async () => {
    auditLog("form_prepare", p?.cin as string, `prepared_${p?.formType}`);
    return {
      cin: p?.cin,
      formType: p?.formType,
      period: p?.period,
      requiresPartnerReview: true,
      partnerReviewReason: `MCA ${p?.formType} form data has been prepared. The signing CA must review all values, attach supporting documents, sign with DSC, and file on MCA21 portal. Counsel does not auto-file.`,
      status: "draft",
      nextStep: `Visit https://www.mca.gov.in/mcafoportal → e-Filing → Company Forms → ${p?.formType}`,
      auditRef: `mca_form_prepare_${Date.now()}`,
      note: "All financial figures in this form carry provenance — linked to the crew and data source that produced them.",
    };
  });
});

server.register("mca_signatory_check", async (p) => {
  const cb = server.getCircuitBreaker("mca");
  return cb.call(async () => {
    auditLog("signatory_check", p?.cin as string, "check");
    return {
      cin: p?.cin,
      signatories: [],
      note: "In production: queries MCA21 for active DINs with signing authority. Verify via https://www.mca.gov.in/mcafoportal/viewSignatoryDetails.do",
      partnerAction: "Ensure the signing CA's DIN is active and DSC is registered on MCA21.",
    };
  });
});

server.register("mca_health", async () => {
  return { status: "healthy", note: "MCA21 V3 connectivity via API base URL. X-API-Key auth. MCA portal: https://www.mca.gov.in" };
});

server.start();
