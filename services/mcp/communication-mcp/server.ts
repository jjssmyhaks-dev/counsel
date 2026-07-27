// Communication MCP — Slack + Microsoft Teams
// Send messages, post alerts, create channels, search

import { MCPServer, MCPServerConfig } from "../shared/server";

const CAPABILITIES = [
  { name: "comm_send_message", description: "Send message to channel or user", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["slack", "teams"] }, channel: { type: "string" }, text: { type: "string" }, blocks: { type: "array" } },
    required: ["provider", "channel", "text"] }
  },
  { name: "comm_list_channels", description: "List available channels", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["slack", "teams"] } },
    required: ["provider"] }
  },
  { name: "comm_search", description: "Search messages across channels", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["slack"] }, query: { type: "string" }, count: { type: "number", default: 20 } },
    required: ["provider", "query"] }
  },
  { name: "comm_create_channel", description: "Create a new channel", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["slack", "teams"] }, name: { type: "string" }, isPrivate: { type: "boolean" } },
    required: ["provider", "name"] }
  },
  { name: "comm_thread_reply", description: "Reply in thread", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["slack"] }, channel: { type: "string" }, threadTs: { type: "string" }, text: { type: "string" } },
    required: ["provider", "channel", "threadTs", "text"] }
  },
  { name: "comm_health", description: "Health check", schema: { type: "object", properties: {} } },
];

const server = new MCPServer({
  name: "communication-mcp", version: "1.0.0", capabilities: CAPABILITIES,
  transport: "http", port: 3110,
});

async function slackAPI(method: string, body?: any) {
  const token = process.env.SLACK_BOT_TOKEN || "";
  const res = await fetch("https://slack.com/api/" + method, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Slack error: ${data.error}`);
  return data;
}

async function teamsAPI(endpoint: string, method = "GET", body?: any) {
  const token = process.env.MS_GRAPH_TOKEN || "";
  const res = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Teams ${res.status}: ${await res.text()}`);
  return res.json();
}

server.register("comm_send_message", async (p) => {
  const cb = server.getCircuitBreaker("communication");
  return cb.call(async () => {
    if (p?.provider === "slack") {
      const payload: any = { channel: p.channel, text: p.text };
      if (p.blocks) payload.blocks = p.blocks;
      return slackAPI("chat.postMessage", payload);
    }
    if (p?.provider === "teams") {
      return teamsAPI(`/teams/${process.env.TEAMS_TEAM_ID}/channels/${p?.channel}/messages`, "POST", {
        body: { contentType: "text", content: p.text },
      });
    }
    throw new Error(`Unknown provider: ${p?.provider}`);
  });
});

server.register("comm_list_channels", async (p) => {
  const cb = server.getCircuitBreaker("communication");
  return cb.call(async () => {
    if (p?.provider === "slack") {
      const data = await slackAPI("conversations.list", { types: "public_channel,private_channel" });
      return { channels: (data.channels || []).map((c: any) => ({ id: c.id, name: c.name, isPrivate: c.is_private, members: c.num_members })) };
    }
    return teamsAPI(`/teams/${process.env.TEAMS_TEAM_ID}/channels`);
  });
});

server.register("comm_search", async (p) => {
  const cb = server.getCircuitBreaker("communication");
  return cb.call(async () => {
    if (p?.provider !== "slack") throw new Error("Search only supports Slack");
    const data = await slackAPI("search.messages", { query: p?.query, count: p?.count || 20 });
    return { messages: (data.messages?.matches || []).map((m: any) => ({ text: m.text, user: m.username, channel: m.channel?.name, permalink: m.permalink, ts: m.ts })) };
  });
});

server.register("comm_create_channel", async (p) => {
  const cb = server.getCircuitBreaker("communication");
  return cb.call(async () => {
    if (p?.provider === "slack") return slackAPI("conversations.create", { name: p?.name, is_private: p?.isPrivate || false });
    if (p?.provider === "teams") return teamsAPI(`/teams/${process.env.TEAMS_TEAM_ID}/channels`, "POST", { displayName: p?.name });
    throw new Error(`Unknown provider: ${p?.provider}`);
  });
});

server.register("comm_thread_reply", async (p) =>
  server.getCircuitBreaker("communication").call(() =>
    slackAPI("chat.postMessage", { channel: p?.channel, thread_ts: p?.threadTs, text: p?.text })
  )
);

server.register("comm_health", async () => {
  const ok: any = {};
  try { await slackAPI("auth.test"); ok.slack = "healthy"; } catch { ok.slack = "unreachable"; }
  try { await teamsAPI("/me"); ok.teams = "healthy"; } catch { ok.teams = "unreachable"; }
  return { status: Object.values(ok).some(v => v === "healthy") ? "healthy" : "degraded", providers: ok };
});

server.start();
