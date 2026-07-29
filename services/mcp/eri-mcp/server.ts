// ERI MCP — Income Tax e-Filing ERI API for CA firms
// READ-ONLY status checks for 26AS/AIS/pre-fill data
// Actual ERI registration is a program-level dependency (M19) — not a simple API key

import { MCPServer, MCPServerConfig } from "../shared/server";

const CAPABILITIES = [
  { name: "eri_26as_fetch", description: "Fetch 26AS tax credit statement for a PAN for a financial year", schema: {
    type: "object", properties: { pan: { type: "string" }, financialYear: { type: "string" }, assessmentYear: { type: "string" } },
    required: ["pan","financialYear"] }
  },
  { name: "eri_ais_fetch", description: "Fetch Annual Information Statement (AIS) — pre-fill data for ITR", schema: {
    type: "object", properties: { pan: { type: "string" }, financialYear: { type: "string" } },
    required: ["pan","financialYear"] }
  },
  { name: "eri_itr_status", description: "Check ITR filing status for a PAN", schema: {
    type: "object", properties: { pan: { type: "string" }, assessmentYear: { type: "string" } },
    required: ["pan","assessmentYear"] }
  },
  { name: "eri_tds_return_status", description: "Check TDS return filing status", schema: {
    type: "object", properties: { tan: { type: "string" }, formType: { type: "string", enum: ["24Q","26Q","27Q","27EQ"] }, quarter: { type: "string" } },
    required: ["tan","formType","quarter"] }
  },
  { name: "eri_notice_list", description: "List income tax notices/compliance for a PAN", schema: {
    type: "object", properties: { pan: { type: "string" }, fromDate: { type: "string" } }, required: ["pan"] }
  },
  { name: "eri_health", description: "ERI connectivity and registration status check", schema: { type: "object", properties: {} } },
];

const server = new MCPServer({
  name: "eri-mcp", version: "1.0.0", capabilities: CAPABILITIES,
  transport: "http", port: 3122,
});

function auditLog(action: string, pan: string, result: string): void {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(), server: "eri-mcp", tool: action, pan, result,
    note: "READ-ONLY status. Actual filing requires ERI registration (M19).",
  }));
}

// ERI status check — in production, this hits Income Tax e-Filing API via registered ERI
// For now: returns structured data with clear partner-action guidance
const ERI_REGISTRATION_NOTE = "ERI registration with Income Tax Department is a program-level dependency (M19). Requires: formal ERI application + technical evaluation + compliance check + integration testing with ITD sandbox. Once registered, this MCP will connect to ITD production APIs for 26AS/AIS fetch, ITR/TDS return status, and notice tracking.";

server.register("eri_26as_fetch", async (p) => {
  const cb = server.getCircuitBreaker("eri");
  return cb.call(async () => {
    auditLog("26as_fetch", p?.pan as string, "status_check");
    return {
      pan: p?.pan,
      financialYear: p?.financialYear,
      assessmentYear: p?.assessmentYear || "auto-calculated",
      status: "read_only_status_check",
      taxCredits: {
        tds: [], tcs: [], selfAssessmentTax: [], advanceTax: [],
        note: "In production (M19): fetches 26AS data from ITD via registered ERI. Tax credits matched against client's books for TDS reconciliation (Crew 12).",
      },
      eriRegistrationRequired: true,
      partnerAction: `26AS can also be viewed at https://incometaxindiaefiling.gov.in → My Account → View 26AS (TRACES) → Login → Select Assessment Year ${p?.assessmentYear || "current"}.`,
      dataSensitivity: "PAN-linked tax data is sensitive — no training, no sharing outside the firm's RLS scope.",
      statutoryRetention: "Income Tax Act requires retention of 26AS data for 8 years from the end of the relevant assessment year.",
    };
  });
});

server.register("eri_ais_fetch", async (p) => {
  const cb = server.getCircuitBreaker("eri");
  return cb.call(async () => {
    auditLog("ais_fetch", p?.pan as string, "prefill_check");
    return {
      pan: p?.pan,
      financialYear: p?.financialYear,
      status: "read_only_status_check",
      prefillData: {
        salaryIncome: null, houseProperty: null, capitalGains: null, businessIncome: null, otherIncome: null,
        note: "In production (M19): fetches AIS pre-fill data from ITD via registered ERI. Aggregated by Crew 12 for ITR pre-fill. Always partner-review before use.",
      },
      requiresPartnerReview: true,
      partnerAction: `AIS can also be viewed at https://incometaxindiaefiling.gov.in → My Account → AIS → Select FY ${p?.financialYear}. Cross-verify AIS data with client-provided documents.`,
    };
  });
});

server.register("eri_itr_status", async (p) => {
  const cb = server.getCircuitBreaker("eri");
  return cb.call(async () => {
    auditLog("itr_status", p?.pan as string, "check");
    return {
      pan: p?.pan, assessmentYear: p?.assessmentYear,
      status: "not_filed",
      filingStatus: "In production (M19): checks ITR filing status via ITD e-Filing API.",
      partnerAction: `Visit https://incometaxindiaefiling.gov.in → My Account → View Returns/Forms → Select AY ${p?.assessmentYear}. ITR filing is manual by the CA using DSC.`,
      requiresDSC: true,
    };
  });
});

server.register("eri_tds_return_status", async (p) => {
  const cb = server.getCircuitBreaker("eri");
  return cb.call(async () => {
    auditLog("tds_return_status", p?.tan as string, "check");
    return {
      tan: p?.tan, formType: p?.formType, quarter: p?.quarter,
      status: "not_filed",
      note: "In production (M19): checks TDS return filing status via TRACES/ITD.",
      partnerAction: `File TDS returns via TRACES (https://www.tdscpc.gov.in) or ITD e-Filing. Form ${p?.formType} for Q${p?.quarter}.`,
    };
  });
});

server.register("eri_notice_list", async (p) => {
  const cb = server.getCircuitBreaker("eri");
  return cb.call(async () => {
    auditLog("notice_list", p?.pan as string, "check");
    return {
      pan: p?.pan,
      notices: [],
      note: "In production (M19): fetches pending notices/compliance actions from ITD e-Filing portal.",
      partnerAction: `Check notices at https://incometaxindiaefiling.gov.in → Worklist → Pending Actions. Notice responses are drafted by Counsel (Crew 12) but MUST be reviewed and submitted by the CA.`,
      crewNote: "Crew 12 (Income Tax & TDS) can draft notice responses — all go to partner-review queue.",
    };
  });
});

server.register("eri_health", async () => {
  return { status: "healthy", eriRegistrationStatus: "pending_m19", note: ERI_REGISTRATION_NOTE, itdPortal: "https://incometaxindiaefiling.gov.in" };
});

server.start();
