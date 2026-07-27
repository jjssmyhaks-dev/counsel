// Translation MCP — DeepL + Azure Translator
// Multi-language contract translation, cross-border matters

import { MCPServer, MCPServerConfig } from "../shared/server";

const CAPABILITIES = [
  { name: "translate_text", description: "Translate text between languages", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["deepl", "azure"] }, text: { type: "string" }, sourceLang: { type: "string" }, targetLang: { type: "string" }, formality: { type: "string", enum: ["default", "formal", "informal"] } },
    required: ["provider", "text", "targetLang"] }
  },
  { name: "translate_document", description: "Translate a full document", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["deepl"] }, documentBase64: { type: "string" }, filename: { type: "string" }, targetLang: { type: "string" } },
    required: ["provider", "documentBase64", "filename", "targetLang"] }
  },
  { name: "translate_languages", description: "List supported languages", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["deepl", "azure"] } },
    required: ["provider"] }
  },
  { name: "translate_usage", description: "Get translation usage/quota", schema: {
    type: "object", properties: { provider: { type: "string", enum: ["deepl"] } },
    required: ["provider"] }
  },
  { name: "translate_health", description: "Health check", schema: { type: "object", properties: {} } },
];

const server = new MCPServer({
  name: "translation-mcp", version: "1.0.0", capabilities: CAPABILITIES,
  transport: "http", port: 3114,
});

async function deeplAPI(endpoint: string, method = "POST", body?: any) {
  const apiKey = process.env.DEEPL_API_KEY || "";
  const res = await fetch(`https://api-free.deepl.com/v2${endpoint}`, {
    method, headers: { Authorization: `DeepL-Auth-Key ${apiKey}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`DeepL ${res.status}: ${await res.text()}`);
  return res.json();
}

async function azureTranslate(body: any) {
  const key = process.env.AZURE_TRANSLATOR_KEY || "";
  const region = process.env.AZURE_TRANSLATOR_REGION || "global";
  const res = await fetch(`https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${body.targetLang}${body.sourceLang ? `&from=${body.sourceLang}` : ""}`, {
    method: "POST", headers: { "Ocp-Apim-Subscription-Key": key, "Ocp-Apim-Subscription-Region": region, "Content-Type": "application/json" },
    body: JSON.stringify([{ Text: body.text }]),
  });
  if (!res.ok) throw new Error(`Azure Translate ${res.status}: ${await res.text()}`);
  return res.json();
}

server.register("translate_text", async (p) => {
  const cb = server.getCircuitBreaker("translation");
  return cb.call(async () => {
    if (p?.provider === "deepl") {
      const body: any = { text: [p.text], target_lang: (p.targetLang as string).toUpperCase() };
      if (p.sourceLang) body.source_lang = (p.sourceLang as string).toUpperCase();
      if (p.formality && p.formality !== "default") body.formality = p.formality;
      const data = await deeplAPI("/translate", "POST", body);
      return { translations: (data.translations || []).map((t: any) => ({ text: t.text, detectedSourceLang: t.detected_source_language })) };
    }
    if (p?.provider === "azure") {
      const data = await azureTranslate({ text: p.text, targetLang: p.targetLang, sourceLang: p.sourceLang });
      return { translations: (data || []).map((t: any) => ({ text: t.translations?.[0]?.text, detectedSourceLang: t.detectedLanguage?.language })) };
    }
    throw new Error(`Unknown provider: ${p?.provider}`);
  });
});

server.register("translate_document", async (p) => {
  const cb = server.getCircuitBreaker("translation");
  return cb.call(async () => {
    const data = await deeplAPI("/document", "POST", {
      target_lang: (p?.targetLang as string).toUpperCase(),
      filename: p?.filename || "document.pdf",
    });
    return { documentId: data.document_id, documentKey: data.document_key, status: "queued" };
  });
});

server.register("translate_languages", async (p) => {
  const cb = server.getCircuitBreaker("translation");
  return cb.call(async () => {
    if (p?.provider === "deepl") return deeplAPI("/languages?type=target", "GET");
    if (p?.provider === "azure") {
      const key = process.env.AZURE_TRANSLATOR_KEY || "";
      const res = await fetch("https://api.cognitive.microsofttranslator.com/languages?api-version=3.0", {
        headers: { "Ocp-Apim-Subscription-Key": key },
      });
      return res.json();
    }
    throw new Error(`Unknown provider: ${p?.provider}`);
  });
});

server.register("translate_usage", async (p) =>
  server.getCircuitBreaker("translation").call(() =>
    deeplAPI("/usage", "GET")
  )
);

server.register("translate_health", async () => {
  const ok: any = {};
  try { await deeplAPI("/usage", "GET"); ok.deepl = "healthy"; } catch { ok.deepl = "unreachable"; }
  try { await azureTranslate({ text: "hello", targetLang: "es" }); ok.azure = "healthy"; } catch { ok.azure = "unreachable"; }
  return { status: Object.values(ok).some(v => v === "healthy") ? "healthy" : "degraded", providers: ok };
});

server.start();
