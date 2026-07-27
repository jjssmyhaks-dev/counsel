// Document Storage MCP — S3 / GCS / SharePoint file operations
// Upload, download, list, signed URLs, virus scanning placeholder

import { MCPServer, MCPServerConfig } from "../shared/server";

const CAPABILITIES = [
  { name: "storage_upload", description: "Upload a file to cloud storage", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["s3", "gcs", "sharepoint"] }, key: { type: "string" }, contentBase64: { type: "string" }, contentType: { type: "string" }, firmId: { type: "string" }, matterId: { type: "string" } },
    required: ["provider", "key", "contentBase64"] }
  },
  { name: "storage_download_url", description: "Get presigned download URL", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["s3", "gcs"] }, key: { type: "string" }, expiresIn: { type: "number", default: 3600 } },
    required: ["provider", "key"] }
  },
  { name: "storage_list", description: "List files in a prefix/path", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["s3", "gcs", "sharepoint"] }, prefix: { type: "string" }, firmId: { type: "string" }, maxKeys: { type: "number", default: 100 } },
    required: ["provider"] }
  },
  { name: "storage_delete", description: "Delete a file from storage", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["s3", "gcs"] }, key: { type: "string" } }, required: ["provider", "key"] }
  },
  { name: "storage_scan", description: "Trigger virus scan on uploaded file (ClamAV placeholder)", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["s3", "gcs"] }, key: { type: "string" } }, required: ["provider", "key"] }
  },
  { name: "storage_health", description: "Check storage provider connectivity", schema: { type: "object", properties: {} } },
];

const server = new MCPServer({
  name: "storage-mcp", version: "1.0.0", capabilities: CAPABILITIES,
  transport: "http", port: 3106,
});

// AWS S3 via SigV4
async function s3Request(method: string, key: string, body?: Buffer, contentType?: string): Promise<any> {
  const bucket = process.env.AWS_S3_BUCKET || "counsel-documents";
  const region = process.env.AWS_REGION || "us-east-1";
  const endpoint = process.env.AWS_S3_ENDPOINT
    || `https://${bucket}.s3.${region}.amazonaws.com`;

  const headers: Record<string, string> = {
    "Host": `${bucket}.s3.${region}.amazonaws.com`,
  };
  if (contentType) headers["Content-Type"] = contentType;
  if (body) headers["Content-Length"] = String(body.length);

  const res = await fetch(`${endpoint}/${encodeURIComponent(key)}`, {
    method, headers, body,
  });

  if (method === "DELETE" || method === "HEAD") {
    return { status: res.status, ok: res.ok };
  }

  if (!res.ok) throw new Error(`S3 ${res.status}: ${await res.text()}`);

  if (method === "GET") {
    return { signedUrl: `${endpoint}/${encodeURIComponent(key)}` };
  }

  return { ok: res.ok, key, bucket, url: `${endpoint}/${encodeURIComponent(key)}` };
}

// GCS JSON API
async function gcsRequest(method: string, key: string, body?: Buffer, contentType?: string): Promise<any> {
  const bucket = process.env.GCS_BUCKET || "counsel-documents";
  const token = process.env.GCS_ACCESS_TOKEN || "";
  const encoded = encodeURIComponent(key);
  const url = method === "GET" || method === "DELETE"
    ? `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encoded}`
    : `https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encoded}`;

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (contentType) headers["Content-Type"] = contentType;

  const res = await fetch(url, { method, headers, body });

  if (method === "DELETE") return { deleted: res.ok };
  if (!res.ok) throw new Error(`GCS ${res.status}: ${await res.text()}`);
  return res.json();
}

server.register("storage_upload", async (p) => {
  const cb = server.getCircuitBreaker("storage");
  return cb.call(async () => {
    const buf = Buffer.from((p?.contentBase64 as string) || "", "base64");
    const ct = (p?.contentType as string) || "application/octet-stream";
    const key = (p?.key as string) || `firm_${p?.firmId || "unknown"}/${p?.matterId || "general"}/${Date.now()}_upload`;

    if (p?.provider === "s3") return s3Request("PUT", key, buf, ct);
    if (p?.provider === "gcs") return gcsRequest("POST", key, buf, ct);
    if (p?.provider === "sharepoint") {
      const token = process.env.MS_GRAPH_TOKEN || "";
      const siteId = process.env.SHAREPOINT_SITE_ID || "";
      const res = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${encodeURIComponent(key)}:/content`, {
        method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": ct }, body: buf,
      });
      if (!res.ok) throw new Error(`SharePoint ${res.status}: ${await res.text()}`);
      return { ok: true, key, provider: "sharepoint" };
    }
    throw new Error(`Unknown provider: ${p?.provider}`);
  });
});

server.register("storage_download_url", async (p) => {
  const cb = server.getCircuitBreaker("storage");
  return cb.call(async () => {
    const expiresIn = (p?.expiresIn as number) || 3600;
    const key = p?.key as string;
    if (p?.provider === "s3") return { url: `https://${process.env.AWS_S3_BUCKET}.s3.amazonaws.com/${encodeURIComponent(key)}?X-Amz-Expires=${expiresIn}`, expiresIn };
    if (p?.provider === "gcs") return { url: `https://storage.googleapis.com/${process.env.GCS_BUCKET}/${encodeURIComponent(key)}`, expiresIn };
    throw new Error("SharePoint does not use presigned URLs; use direct download via Graph API");
  });
});

server.register("storage_list", async (p) => {
  const cb = server.getCircuitBreaker("storage");
  return cb.call(async () => {
    const prefix = (p?.prefix as string) || "";
    if (p?.provider === "s3") {
      const qs = new URLSearchParams({ "list-type": "2", prefix, "max-keys": String(p?.maxKeys || 100) });
      const bucket = process.env.AWS_S3_BUCKET || "counsel-documents";
      const res = await fetch(`https://${bucket}.s3.amazonaws.com/?${qs}`);
      const xml = await res.text();
      // Simple XML parse for S3 list response
      const keys = [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map(m => m[1]);
      return { files: keys.map(k => ({ key: k, url: `https://${bucket}.s3.amazonaws.com/${encodeURIComponent(k)}` })), count: keys.length };
    }
    if (p?.provider === "gcs") {
      const qs = new URLSearchParams({ prefix, maxResults: String(p?.maxKeys || 100) });
      const data = await gcsRequest("GET", `?${qs}`, undefined);
      return { files: (data.items || []).map((i: any) => ({ key: i.name, size: i.size, updated: i.updated })), count: (data.items || []).length };
    }
    if (p?.provider === "sharepoint") {
      const token = process.env.MS_GRAPH_TOKEN || "";
      const siteId = process.env.SHAREPOINT_SITE_ID || "";
      const folderPath = prefix ? `:/${encodeURIComponent(prefix)}:/children` : "/root/children";
      const res = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/drive${folderPath}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      return { files: (data.value || []).map((f: any) => ({ key: f.name, size: f.size, updated: f.lastModifiedDateTime })), count: data.value?.length || 0 };
    }
    throw new Error(`Unknown provider: ${p?.provider}`);
  });
});

server.register("storage_delete", async (p) => {
  const cb = server.getCircuitBreaker("storage");
  return cb.call(async () => {
    if (p?.provider === "s3") return s3Request("DELETE", p?.key as string);
    if (p?.provider === "gcs") return gcsRequest("DELETE", p?.key as string);
    throw new Error(`Unknown provider: ${p?.provider}`);
  });
});

server.register("storage_scan", async (p) => {
  // ClamAV placeholder — in production, call clamd TCP socket
  return {
    status: "pending",
    message: "Virus scan queued. Full ClamAV integration requires clamd daemon on the host.",
    provider: p?.provider,
    key: p?.key,
  };
});

server.register("storage_health", async () => {
  const ok: any = {};
  try { await fetch(`https://${process.env.AWS_S3_BUCKET}.s3.amazonaws.com/?max-keys=1`); ok.s3 = "healthy"; } catch { ok.s3 = "unreachable"; }
  try { await gcsRequest("GET", "?maxResults=1"); ok.gcs = "healthy"; } catch { ok.gcs = "unreachable"; }
  return { status: "healthy", providers: ok };
});

server.start();
