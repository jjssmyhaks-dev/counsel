// Email MCP — Gmail + Outlook email operations
// Gmail API (OAuth) + Microsoft Graph (OAuth)
// Enables agents to read/send emails, list threads, attach drafts

import { MCPServer, MCPServerConfig } from "../shared/server";

const CAPABILITIES = [
  { name: "email_send", description: "Send email via Gmail or Outlook", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["gmail", "outlook"] }, to: { type: "string" }, subject: { type: "string" }, body: { type: "string" }, attachments: { type: "array" } },
    required: ["provider", "to", "subject", "body"] }
  },
  { name: "email_read", description: "Read recent emails from inbox", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["gmail", "outlook"] }, maxResults: { type: "number", default: 20 }, query: { type: "string" } },
    required: ["provider"] }
  },
  { name: "email_thread", description: "Get a single email thread", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["gmail", "outlook"] }, threadId: { type: "string" } }, required: ["provider", "threadId"] }
  },
  { name: "email_drafts", description: "List email drafts", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["gmail", "outlook"] } }, required: ["provider"] }
  },
  { name: "email_search", description: "Search emails by query", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["gmail", "outlook"] }, query: { type: "string" }, maxResults: { type: "number", default: 20 } },
    required: ["provider", "query"] }
  },
  { name: "email_health", description: "Check email provider connectivity", schema: { type: "object", properties: {} } },
];

const config: MCPServerConfig = {
  name: "email-mcp", version: "1.0.0", capabilities: CAPABILITIES,
  transport: "http", port: 3104,
};

const server = new MCPServer(config);

// Microsoft Graph client
async function graphRequest(endpoint: string, token: string, method = "GET", body?: any) {
  const res = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Graph API ${res.status}: ${await res.text()}`);
  return res.json();
}

// Gmail API client
async function gmailRequest(endpoint: string, token: string, method = "GET", body?: any) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1${endpoint}`, {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Gmail API ${res.status}: ${await res.text()}`);
  return res.json();
}

server.register("email_send", async (p) => {
  const cb = server.getCircuitBreaker("email");
  const provider = p?.provider as string;
  const token = (p?._token || process.env.EMAIL_OAUTH_TOKEN) as string;

  return cb.call(async () => {
    if (provider === "gmail") {
      const raw = Buffer.from(
        `From: me\r\nTo: ${p?.to}\r\nSubject: ${p?.subject}\r\n\r\n${p?.body}`
      ).toString("base64url");
      return gmailRequest("/users/me/messages/send", token, "POST", { raw });
    }
    if (provider === "outlook") {
      return graphRequest("/me/sendMail", token, "POST", {
        message: {
          subject: p?.subject,
          body: { contentType: "Text", content: p?.body },
          toRecipients: [{ emailAddress: { address: p?.to } }],
        },
      });
    }
    throw new Error(`Unknown provider: ${provider}`);
  });
});

server.register("email_read", async (p) => {
  const cb = server.getCircuitBreaker("email");
  const provider = p?.provider as string;
  const token = (p?._token || process.env.EMAIL_OAUTH_TOKEN) as string;

  return cb.call(async () => {
    if (provider === "gmail") {
      const data: any = await gmailRequest(
        `/users/me/messages?maxResults=${p?.maxResults || 20}${p?.query ? `&q=${encodeURIComponent(p.query as string)}` : ""}`, token
      );
      return { messages: data.messages || [] };
    }
    if (provider === "outlook") {
      const data: any = await graphRequest(
        `/me/messages?$top=${p?.maxResults || 20}${p?.query ? `&$search="${p.query}"` : ""}`, token
      );
      return { messages: (data.value || []).map((m: any) => ({ id: m.id, threadId: m.conversationId, snippet: m.bodyPreview, from: m.from?.emailAddress?.address, subject: m.subject, receivedAt: m.receivedDateTime })) };
    }
    throw new Error(`Unknown provider: ${provider}`);
  });
});

server.register("email_thread", async (p) =>
  server.getCircuitBreaker("email").call(async () => {
    const provider = p?.provider as string;
    const token = (p?._token || process.env.EMAIL_OAUTH_TOKEN) as string;
    if (provider === "gmail") return gmailRequest(`/users/me/threads/${p?.threadId}`, token);
    return graphRequest(`/me/messages?$filter=conversationId eq '${p?.threadId}'`, token);
  })
);

server.register("email_drafts", async (p) =>
  server.getCircuitBreaker("email").call(async () => {
    const provider = p?.provider as string;
    const token = (p?._token || process.env.EMAIL_OAUTH_TOKEN) as string;
    if (provider === "gmail") return gmailRequest("/users/me/drafts", token);
    return graphRequest("/me/mailFolders/drafts/messages", token);
  })
);

server.register("email_search", async (p) =>
  server.getCircuitBreaker("email").call(async () => {
    const provider = p?.provider as string;
    const token = (p?._token || process.env.EMAIL_OAUTH_TOKEN) as string;
    if (provider === "gmail") return gmailRequest(`/users/me/messages?q=${encodeURIComponent((p?.query as string) || "")}&maxResults=${p?.maxResults || 20}`, token);
    return graphRequest(`/me/messages?$search="${p?.query}"&$top=${p?.maxResults || 20}`, token);
  })
);

server.register("email_health", async () => {
  const ok: any = {};
  try {
    if (process.env.MS_GRAPH_TOKEN) { await graphRequest("/me", process.env.MS_GRAPH_TOKEN, "GET"); ok.outlook = "healthy"; }
  } catch { ok.outlook = "unreachable"; }
  try {
    if (process.env.GMAIL_OAUTH_TOKEN) { await gmailRequest("/users/me/profile", process.env.GMAIL_OAUTH_TOKEN); ok.gmail = "healthy"; }
  } catch { ok.gmail = "unreachable"; }
  return { status: Object.values(ok).some(v => v === "healthy") ? "healthy" : "degraded", providers: ok };
});

server.start();
