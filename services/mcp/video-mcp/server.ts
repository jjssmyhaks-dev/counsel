// Video Conferencing MCP — Zoom + Microsoft Teams Meetings
// Create meetings, get recordings, list transcripts

import { MCPServer, MCPServerConfig } from "../shared/server";

const CAPABILITIES = [
  { name: "video_create_meeting", description: "Create a video meeting with settings", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["zoom", "teams"] }, topic: { type: "string" }, startTime: { type: "string" }, durationMinutes: { type: "number", default: 60 }, agenda: { type: "string" }, attendees: { type: "array" } },
    required: ["provider", "topic"] }
  },
  { name: "video_list_recordings", description: "List cloud recordings", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["zoom"] }, from: { type: "string" }, to: { type: "string" } },
    required: ["provider"] }
  },
  { name: "video_get_transcript", description: "Get meeting transcript", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["zoom"] }, meetingId: { type: "string" } },
    required: ["provider", "meetingId"] }
  },
  { name: "video_list_meetings", description: "List upcoming/recent meetings", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["zoom"] }, type: { type: "string", enum: ["upcoming", "past"] } },
    required: ["provider"] }
  },
  { name: "video_health", description: "Health check", schema: { type: "object", properties: {} } },
];

const server = new MCPServer({
  name: "video-mcp", version: "1.0.0", capabilities: CAPABILITIES,
  transport: "http", port: 3115,
});

async function zoomAPI(endpoint: string, method = "GET", body?: any) {
  const accountId = process.env.ZOOM_ACCOUNT_ID || "";
  const clientId = process.env.ZOOM_CLIENT_ID || "";
  const clientSecret = process.env.ZOOM_CLIENT_SECRET || "";
  
  // Server-to-Server OAuth
  const tokenRes = await fetch("https://zoom.us/oauth/token?grant_type=account_credentials&account_id=" + accountId, {
    method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}` },
  });
  const tokenData = await tokenRes.json();
  
  const res = await fetch(`https://api.zoom.us/v2${endpoint}`, {
    method, headers: { Authorization: `Bearer ${tokenData.access_token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Zoom ${res.status}: ${await res.text()}`);
  return res.json();
}

async function teamsMeeting(endpoint: string, method = "GET", body?: any) {
  const token = process.env.MS_GRAPH_TOKEN || "";
  const res = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Teams Meeting ${res.status}: ${await res.text()}`);
  return res.json();
}

server.register("video_create_meeting", async (p) => {
  const cb = server.getCircuitBreaker("video");
  return cb.call(async () => {
    if (p?.provider === "zoom") {
      const data = await zoomAPI("/users/me/meetings", "POST", {
        topic: p.topic, type: 2, // scheduled
        start_time: p.startTime, duration: p.durationMinutes || 60,
        agenda: p.agenda || "", settings: { host_video: true, participant_video: true, join_before_host: false },
      });
      return { meetingId: data.id, joinUrl: data.join_url, startUrl: data.start_url, topic: data.topic };
    }
    if (p?.provider === "teams") {
      const data = await teamsMeeting("/me/onlineMeetings", "POST", {
        subject: p.topic, startDateTime: p.startTime, endDateTime: new Date(new Date(p?.startTime as string).getTime() + (p?.durationMinutes as number || 60) * 60000).toISOString(),
      });
      return { meetingId: data.id, joinUrl: data.joinUrl, subject: data.subject };
    }
    throw new Error(`Unknown provider: ${p?.provider}`);
  });
});

server.register("video_list_recordings", async (p) => {
  const cb = server.getCircuitBreaker("video");
  return cb.call(async () => {
    const qs = new URLSearchParams();
    if (p?.from) qs.set("from", p.from as string);
    if (p?.to) qs.set("to", p.to as string);
    const data = await zoomAPI(`/users/me/recordings?${qs}`);
    return { recordings: (data.meetings || []).map((m: any) => ({ id: m.id, topic: m.topic, startTime: m.start_time, recordingCount: m.recording_count, transcripts: m.recording_files?.filter((f: any) => f.file_type === "TRANSCRIPT").map((f: any) => ({ id: f.id, downloadUrl: f.download_url })) || [] })) };
  });
});

server.register("video_get_transcript", async (p) =>
  server.getCircuitBreaker("video").call(async () => {
    const data = await zoomAPI(`/meetings/${p?.meetingId}/recordings`);
    const transcript = data.recording_files?.find((f: any) => f.file_type === "TRANSCRIPT");
    if (!transcript) return { error: "No transcript found for this meeting" };
    const textRes = await fetch(transcript.download_url, { headers: { Authorization: `Bearer ${process.env.ZOOM_JWT_TOKEN || ""}` } });
    return { meetingId: p?.meetingId, transcript: await textRes.text(), type: transcript.file_extension };
  })
);

server.register("video_list_meetings", async (p) =>
  server.getCircuitBreaker("video").call(() =>
    zoomAPI(`/users/me/meetings?type=${p?.type || "upcoming"}`)
  )
);

server.register("video_health", async () => {
  const ok: any = {};
  try { await zoomAPI("/users/me"); ok.zoom = "healthy"; } catch { ok.zoom = "unreachable"; }
  return { status: ok.zoom === "healthy" ? "healthy" : "degraded", providers: ok };
});

server.start();
