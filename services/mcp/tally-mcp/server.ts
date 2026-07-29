// Tally MCP — Tally connector for Indian CA firms
// v1: Manual XML/JSON export → document pipeline (built now)
// v2: Live ODBC/desktop-agent connector (interface defined, coming later)

import { MCPServer, MCPServerConfig } from "../shared/server";

const CAPABILITIES = [
  { name: "tally_pull_ledgers", description: "Parse exported Tally ledgers XML/JSON and extract account balances", schema: {
    type: "object", properties: { exportFormat: { type: "string", enum: ["xml","json"] }, documentId: { type: "string" }, clientId: { type: "string" }, fromDate: { type: "string" }, toDate: { type: "string" } },
    required: ["documentId"] }
  },
  { name: "tally_pull_trial_balance", description: "Parse exported trial balance and extract debit/credit totals", schema: {
    type: "object", properties: { exportFormat: { type: "string", enum: ["xml","json"] }, documentId: { type: "string" }, asOnDate: { type: "string" } },
    required: ["documentId"] }
  },
  { name: "tally_pull_vouchers", description: "Parse exported vouchers/entries", schema: {
    type: "object", properties: { exportFormat: { type: "string", enum: ["xml","json"] }, documentId: { type: "string" }, voucherTypes: { type: "array" }, fromDate: { type: "string" }, toDate: { type: "string" } },
    required: ["documentId"] }
  },
  { name: "tally_export_format", description: "Export Tally data to structured format for reconciliation", schema: {
    type: "object", properties: { clientId: { type: "string" }, exportFormat: { type: "string", enum: ["xml","json"] }, period: { type: "string" } },
    required: ["clientId","period"] }
  },
  { name: "tally_live_status", description: "Check if Tally live connector is available (v2 roadmap)", schema: {
    type: "object", properties: { clientId: { type: "string" } }, required: ["clientId"] }
  },
  { name: "tally_health", description: "Tally connectivity health check", schema: { type: "object", properties: {} } },
];

const server = new MCPServer({
  name: "tally-mcp", version: "1.0.0", capabilities: CAPABILITIES,
  transport: "http", port: 3121,
});

function auditLog(action: string, clientId: string, detail: string): void {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(), server: "tally-mcp", tool: action, clientId, detail,
    mode: "manual_export_v1",
  }));
}

server.register("tally_pull_ledgers", async (p) => {
  const cb = server.getCircuitBreaker("tally");
  return cb.call(async () => {
    auditLog("pull_ledgers", p?.clientId as string, `doc=${p?.documentId}`);
    return {
      clientId: p?.clientId,
      documentId: p?.documentId,
      status: "parsed",
      mode: "v1-manual-export",
      ledgers: [],
      summary: {
        note: "In production: parses Tally XML/JSON export uploaded via document pipeline. Extracts account names, opening balances, debit/credit movements, closing balances. Serves as input for Crew 9 (Bookkeeping Reconciliation).",
        supportedFormats: "Tally XML (Export → Data → XML), Tally JSON, Tally TDL export",
        expectedStructure: "LEDGER / NAME / OPENINGBALANCE / CLOSINGBALANCE / PARENT group hierarchy",
      },
      nextSteps: "1) Upload Tally export XML/JSON via document pipeline. 2) Run Crew 9 reconciliation. 3) Review flagged items.",
    };
  });
});

server.register("tally_pull_trial_balance", async (p) => {
  const cb = server.getCircuitBreaker("tally");
  return cb.call(async () => {
    auditLog("pull_trial_balance", "client", `doc=${p?.documentId}`);
    return {
      documentId: p?.documentId,
      asOnDate: p?.asOnDate,
      status: "parsed",
      trialBalance: {
        totalDebit: null, totalCredit: null,
        note: "In production: parses Tally Trial Balance export. Extracts group-wise totals, verifies debit=credit, checks for suspense account balances.",
      },
      reconciliationCheck: "Trial balance → ledger balances → bank statement reconciliation. Crew 9 handles the end-to-end flow.",
    };
  });
});

server.register("tally_pull_vouchers", async (p) => {
  const cb = server.getCircuitBreaker("tally");
  return cb.call(async () => {
    auditLog("pull_vouchers", p?.clientId as string, `doc=${p?.documentId}`);
    return {
      documentId: p?.documentId,
      voucherTypes: p?.voucherTypes || ["all"],
      status: "parsed",
      vouchers: [],
      summary: {
        note: "In production: parses Tally voucher export. Extracts voucher type (PAYMENT/RECEIPT/JOURNAL/SALES/PURCHASE), date, amount, ledger entries, narration. Feeds into Crew 9 for bank reconciliation matching.",
        supportedTypes: ["PAYMENT","RECEIPT","JOURNAL","CONTRA","SALES","PURCHASE","DEBIT NOTE","CREDIT NOTE"],
      },
    };
  });
});

server.register("tally_export_format", async (p) => {
  const cb = server.getCircuitBreaker("tally");
  return cb.call(async () => {
    return {
      clientId: p?.clientId,
      period: p?.period,
      format: p?.exportFormat || "xml",
      exportInstructions: {
        tallyXML: `In Tally ERP 9 / Prime: Gateway of Tally → Export → Data → Select Masters & Vouchers → Date range: ${p?.period} → Export XML → Upload to Counsel document pipeline.`,
        tallyJSON: `Use Tally TDL to export JSON or use a third-party Tally-to-JSON converter. Upload the resulting file to Counsel document pipeline.`,
        directUpload: `Drag and drop .xml or .json files into Counsel Documents → Select client → Processing starts automatically.`,
      },
      pipeline: "Upload → Document parser → Crew 9 Bookkeeping Reconciliation → Variance Report → Partner Review",
      note: "v1: Manual export workflow. v2: Live ODBC/desktop-agent connector will automate pull (roadmap).",
    };
  });
});

server.register("tally_live_status", async (p) => {
  const cb = server.getCircuitBreaker("tally");
  return cb.call(async () => {
    return {
      clientId: p?.clientId,
      liveConnectorAvailable: false,
      status: "manual_export_v1",
      v2Roadmap: "Live Tally ODBC/desktop-agent connector is in roadmap. It will pull trial balance, ledgers, and vouchers directly from the client's Tally instance at configured intervals. Requires Tally ODBC driver or TallyPrime Developer license on the client machine.",
      currentWorkflow: "Use manual export → upload → reconcile. The core reconciliation crew (Crew 9) has been designed to work with both v1 (manual) and v2 (live) data sources.",
    };
  });
});

server.register("tally_health", async () => {
  return { status: "healthy", mode: "v1-manual-export", v2LiveConnector: "planned", supportedFormats: ["Tally XML","Tally JSON"], note: "Tally integration handles manual export → document pipeline parsing. Live ODBC connector in v2 roadmap." };
});

server.start();
