// Calendar MCP — Google Calendar + Outlook Calendar
// Schedule events, check availability, manage court dates/deadlines

import { MCPServer, MCPServerConfig } from "../shared/server";

const CAPABILITIES = [
  { name: "cal_list_events", description: "List calendar events in date range", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["google", "outlook"] }, timeMin: { type: "string" }, timeMax: { type: "string" }, maxResults: { type: "number", default: 50 } },
    required: ["provider"] }
  },
  { name: "cal_create_event", description: "Create a calendar event with attendees", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["google", "outlook"] }, summary: { type: "string" }, start: { type: "string" }, end: { type: "string" }, attendees: { type: "array" }, description: { type: "string" }, location: { type: "string" } },
    required: ["provider", "summary", "start", "end"] }
  },
  { name: "cal_delete_event", description: "Delete/cancel a calendar event", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["google", "outlook"] }, eventId: { type: "string" } },
    required: ["provider", "eventId"] }
  },
  { name: "cal_find_slots", description: "Find free/busy slots for scheduling", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["google", "outlook"] }, timeMin: { type: "string" }, timeMax: { type: "string" }, durationMinutes: { type: "number", default: 60 } },
    required: ["provider", "timeMin", "timeMax"] }
  },
  { name: "cal_upcoming", description: "Get next N upcoming events (default 10)", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["google", "outlook"] }, maxResults: { type: "number", default: 10 } },
    required: ["provider"] }
  },
  { name: "cal_health", description: "Check calendar provider connectivity", schema: { type: "object", properties: {} } },
];

const server = new MCPServer({
  name: "calendar-mcp", version: "1.0.0", capabilities: CAPABILITIES,
  transport: "http", port: 3105,
});

async function googleCalendar(endpoint: string, token: string, method = "GET", body?: any) {
  const res = await fetch(`https://www.googleapis.com/calendar/v3${endpoint}`, {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Google Calendar ${res.status}: ${await res.text()}`);
  return res.json();
}

async function outlookCalendar(endpoint: string, token: string, method = "GET", body?: any) {
  const res = await fetch(`https://graph.microsoft.com/v1.0/me${endpoint}`, {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Outlook Calendar ${res.status}: ${await res.text()}`);
  return res.json();
}

function getToken(p: any): string {
  return (p?._token || process.env.CALENDAR_OAUTH_TOKEN || "") as string;
}

server.register("cal_list_events", async (p) => {
  const cb = server.getCircuitBreaker("calendar");
  return cb.call(async () => {
    const token = getToken(p);
    if (p?.provider === "google") {
      const params = new URLSearchParams({ maxResults: String(p.maxResults || 50) });
      if (p.timeMin) params.set("timeMin", p.timeMin as string);
      if (p.timeMax) params.set("timeMax", p.timeMax as string);
      const data = await googleCalendar(`/calendars/primary/events?${params}`, token);
      return { events: (data.items || []).map((e: any) => ({ id: e.id, summary: e.summary, start: e.start, end: e.end, attendees: e.attendees, link: e.htmlLink })) };
    }
    const filterParts: string[] = [];
    if (p.timeMin) filterParts.push(`start/dateTime ge '${p.timeMin}'`);
    if (p.timeMax) filterParts.push(`end/dateTime le '${p.timeMax}'`);
    const filter = filterParts.length ? `&$filter=${filterParts.join(" and ")}` : "";
    const data = await outlookCalendar(`/calendar/events?$top=${p.maxResults || 50}${filter}`, token);
    return { events: (data.value || []).map((e: any) => ({ id: e.id, summary: e.subject, start: e.start, end: e.end, attendees: e.attendees, link: e.webLink })) };
  });
});

server.register("cal_create_event", async (p) => {
  const cb = server.getCircuitBreaker("calendar");
  return cb.call(async () => {
    const token = getToken(p);
    const eventBody = {
      summary: p?.summary,
      description: p?.description || "",
      location: p?.location || "",
      start: { dateTime: p?.start, timeZone: "UTC" },
      end: { dateTime: p?.end, timeZone: "UTC" },
      attendees: (p?.attendees as any[])?.map((a: string) => ({ email: a })) || [],
    };
    if (p?.provider === "google") {
      const data = await googleCalendar("/calendars/primary/events", token, "POST", eventBody);
      return { eventId: data.id, link: data.htmlLink, status: data.status };
    }
    const outlookBody = { subject: p?.summary, body: { contentType: "Text", content: p?.description || "" }, location: { displayName: p?.location || "" }, start: { dateTime: p?.start, timeZone: "UTC" }, end: { dateTime: p?.end, timeZone: "UTC" }, attendees: (p?.attendees as any[])?.map((a: string) => ({ emailAddress: { address: a }, type: "required" })) || [] };
    const data = await outlookCalendar("/events", token, "POST", outlookBody);
    return { eventId: data.id, link: data.webLink };
  });
});

server.register("cal_delete_event", async (p) => {
  const cb = server.getCircuitBreaker("calendar");
  return cb.call(async () => {
    const token = getToken(p);
    if (p?.provider === "google") { await googleCalendar(`/calendars/primary/events/${p.eventId}`, token, "DELETE"); return { deleted: true }; }
    await outlookCalendar(`/events/${p.eventId}`, token, "DELETE");
    return { deleted: true };
  });
});

server.register("cal_find_slots", async (p) => {
  const cb = server.getCircuitBreaker("calendar");
  return cb.call(async () => {
    const token = getToken(p);
    if (p?.provider === "google") {
      const data = await googleCalendar("/freeBusy", token, "POST", {
        timeMin: p?.timeMin, timeMax: p?.timeMax,
        items: [{ id: "primary" }],
      });
      return { busy: data.calendars?.primary?.busy || [] };
    }
    const data = await outlookCalendar("/calendar/getSchedule", token, "POST", {
      schedules: ["me"],
      startTime: { dateTime: p?.timeMin, timeZone: "UTC" },
      endTime: { dateTime: p?.timeMax, timeZone: "UTC" },
      availabilityViewInterval: p?.durationMinutes || 60,
    });
    return { busy: (data.value || []).flatMap((v: any) => v.scheduleItems || []) };
  });
});

server.register("cal_upcoming", async (p) => {
  const cb = server.getCircuitBreaker("calendar");
  return cb.call(async () => {
    const token = getToken(p);
    const now = new Date().toISOString();
    if (p?.provider === "google") {
      const data = await googleCalendar(`/calendars/primary/events?timeMin=${now}&maxResults=${p?.maxResults || 10}&orderBy=startTime&singleEvents=true`, token);
      return { events: (data.items || []).map((e: any) => ({ id: e.id, summary: e.summary, start: e.start, end: e.end, location: e.location, link: e.htmlLink })) };
    }
    const data = await outlookCalendar(`/calendar/events?$filter=start/dateTime ge '${now}'&$orderby=start/dateTime&$top=${p?.maxResults || 10}`, token);
    return { events: (data.value || []).map((e: any) => ({ id: e.id, summary: e.subject, start: e.start, end: e.end, location: e.location?.displayName, link: e.webLink })) };
  });
});

server.register("cal_health", async () => {
  const ok: any = {};
  try { if (process.env.GOOGLE_CALENDAR_TOKEN) { await googleCalendar("/calendars/primary", process.env.GOOGLE_CALENDAR_TOKEN); ok.google = "healthy"; } } catch { ok.google = "unreachable"; }
  try { if (process.env.MS_GRAPH_TOKEN) { await outlookCalendar("/calendar", process.env.MS_GRAPH_TOKEN); ok.outlook = "healthy"; } } catch { ok.outlook = "unreachable"; }
  return { status: Object.values(ok).some(v => v === "healthy") ? "healthy" : "degraded", providers: ok };
});

server.start();
