// WhatsApp MCP — WhatsApp Business API for CA firm client communication
// Status updates, document collection reminders, compliance due-date nudges

import { MCPServer, MCPServerConfig } from "../shared/server";

const CAPABILITIES = [
  { name: "whatsapp_send_template", description: "Send a WhatsApp template message (compliance reminder, document request, status update)", schema: {
    type: "object", properties: { to: { type: "string" }, templateName: { type: "string" }, languageCode: { type: "string", default: "en" }, parameters: { type: "array" } },
    required: ["to","templateName"] }
  },
  { name: "whatsapp_compliance_nudge", description: "Send compliance due-date reminder to client", schema: {
    type: "object", properties: { clientId: { type: "string" }, phone: { type: "string" }, complianceType: { type: "string", enum: ["GST","ITR","TDS","ROC","AUDIT"] }, dueDate: { type: "string" }, clientName: { type: "string" } },
    required: ["clientId","phone","complianceType","dueDate"] }
  },
  { name: "whatsapp_doc_request", description: "Request documents from client via WhatsApp", schema: {
    type: "object", properties: { clientId: { type: "string" }, phone: { type: "string" }, documentList: { type: "array" }, deadline: { type: "string" }, clientName: { type: "string" } },
    required: ["clientId","phone","documentList"] }
  },
  { name: "whatsapp_status_update", description: "Send filing/engagement status update to client", schema: {
    type: "object", properties: { clientId: { type: "string" }, phone: { type: "string" }, statusType: { type: "string", enum: ["filing_submitted","filing_accepted","filing_rejected","review_needed","completed"] }, detail: { type: "string" }, clientName: { type: "string" } },
    required: ["clientId","phone","statusType"] }
  },
  { name: "whatsapp_message_log", description: "Get WhatsApp message history for a client", schema: {
    type: "object", properties: { clientId: { type: "string" }, limit: { type: "number", default: 20 } },
    required: ["clientId"] }
  },
  { name: "whatsapp_health", description: "WhatsApp Business API health check", schema: { type: "object", properties: {} } },
];

const server = new MCPServer({
  name: "whatsapp-mcp", version: "1.0.0", capabilities: CAPABILITIES,
  transport: "http", port: 3124,
});

async function waAPI(endpoint: string, method = "POST", body?: any): Promise<any> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN || "";
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}${endpoint}`;
  const res = await fetch(url, {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${await res.text()}`);
  return res.json();
}

function auditLog(action: string, to: string, detail: string): void {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(), server: "whatsapp-mcp", tool: action, recipient: to, detail,
  }));
}

server.register("whatsapp_send_template", async (p) => {
  const cb = server.getCircuitBreaker("whatsapp");
  return cb.call(async () => {
    auditLog("send_template", p?.to as string, p?.templateName as string);
    const body = {
      messaging_product: "whatsapp", to: p?.to, type: "template",
      template: {
        name: p?.templateName, language: { code: p?.languageCode || "en" },
        components: p?.parameters ? [{ type: "body", parameters: (p.parameters as any[]).map((v: any) => ({ type: "text", text: v })) }] : [],
      },
    };
    return waAPI("/messages", "POST", body);
  });
});

server.register("whatsapp_compliance_nudge", async (p) => {
  const cb = server.getCircuitBreaker("whatsapp");
  return cb.call(async () => {
    auditLog("compliance_nudge", p?.phone as string, `${p?.complianceType} due ${p?.dueDate}`);
    const message = `📋 *Compliance Reminder — Counsel AI*\n\nDear ${p?.clientName || "Client"},\n\nYour *${p?.complianceType}* is due on *${p?.dueDate}*. Please provide the necessary documents at the earliest to ensure timely filing.\n\n_Sent via Counsel — your CA's AI assistant._`;
    return waAPI("/messages", "POST", {
      messaging_product: "whatsapp", to: p?.phone, type: "text", text: { body: message, preview_url: false },
    });
  });
});

server.register("whatsapp_doc_request", async (p) => {
  const cb = server.getCircuitBreaker("whatsapp");
  return cb.call(async () => {
    const docs = (p?.documentList as any[])?.map((d: any) => `• ${d}`).join("\n") || "";
    const message = `📎 *Documents Required — Counsel AI*\n\nDear ${p?.clientName || "Client"},\n\nWe need the following by *${p?.deadline || "this week"}*:\n\n${docs}\n\nPlease WhatsApp the documents or upload via the secure link shared separately.\n\n_Sent via Counsel — your CA's AI assistant._`;
    auditLog("doc_request", p?.phone as string, `${(p?.documentList as any[])?.length || 0} docs`);
    return waAPI("/messages", "POST", {
      messaging_product: "whatsapp", to: p?.phone, type: "text", text: { body: message, preview_url: false },
    });
  });
});

server.register("whatsapp_status_update", async (p) => {
  const cb = server.getCircuitBreaker("whatsapp");
  return cb.call(async () => {
    const statusMsgs: Record<string, string> = {
      filing_submitted: `✅ Your filing has been *submitted*. The government portal is processing it. We'll update you once accepted.`,
      filing_accepted: `🎉 Great news! Your filing has been *accepted* by the tax department. ${p?.detail || ""}`,
      filing_rejected: `⚠️ Your filing needs *additional review*. ${p?.detail || "Our team will contact you shortly."}`,
      review_needed: `👀 Your ${p?.detail || "document"} is ready for *your review*. Please check and confirm.`,
      completed: `✅ *Completed!* ${p?.detail || "All done. Thank you for your cooperation."}`,
    };
    const msg = statusMsgs[p?.statusType as string] || p?.detail || "Status update";
    auditLog("status_update", p?.phone as string, p?.statusType as string);
    return waAPI("/messages", "POST", {
      messaging_product: "whatsapp", to: p?.phone, type: "text", text: { body: `📢 *Update — Counsel AI*\n\nDear ${p?.clientName || "Client"},\n\n${msg}\n\n_Sent via Counsel_`, preview_url: false },
    });
  });
});

server.register("whatsapp_message_log", async (p) => {
  const cb = server.getCircuitBreaker("whatsapp");
  return cb.call(async () => {
    return {
      clientId: p?.clientId,
      messages: [],
      note: "In production: fetches WhatsApp message history for this client via WhatsApp Business API webhook events stored in PostgreSQL.",
    };
  });
});

server.register("whatsapp_health", async () => {
  try {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
    await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}`, { headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN || ""}` } });
    return { status: "healthy", provider: "WhatsApp Business API (Meta)" };
  } catch { return { status: "unreachable", note: "WhatsApp Business API requires: Facebook Business verification, phone number ID, permanent access token. Setup at https://developers.facebook.com" }; }
});

server.start();
