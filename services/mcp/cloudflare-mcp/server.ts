#!/usr/bin/env node
// Cloudflare Workers AI MCP Server — LLM & embedding bridge for AI agents
// Capabilities: text generation, embeddings, multi-model routing
//
// Supported models:
//   - @cf/meta/llama-4-scout-17b-8k-instruct (default, fast)
//   - @cf/meta/llama-3.3-70b-instruct-fp8-fast (power)
//   - @cf/deepseek-ai/deepseek-r1-distill-qwen-32b (reasoning)
//   - @cf/baai/bge-base-en-v1.5 (embeddings, 768-dim)

import { MCPServer } from "../shared/server";
import { CircuitBreaker } from "../shared/circuit-breaker";
import * as dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "e0998960bd56497ccb758f3ad450ba15";
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";

const MODEL_MAP: Record<string, string> = {
  fast: "@cf/meta/llama-4-scout-17b-8k-instruct",
  power: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  reasoning: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
  embeddings: "@cf/baai/bge-base-en-v1.5",
};

const server = new MCPServer({
  name: "cloudflare-mcp",
  version: "1.0.0",
  transport: "stdio",
  capabilities: [
    {
      name: "cf_text_gen",
      description: "Generate text using Cloudflare Workers AI. Supports fast, power, and reasoning models.",
      schema: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "The full prompt to send to the LLM" },
          model: { type: "string", enum: ["fast", "power", "reasoning"], description: "Model tier" },
          max_tokens: { type: "number", default: 2000, description: "Max tokens to generate" },
          temperature: { type: "number", default: 0.2, description: "Temperature (0-1)" },
          system_prompt: { type: "string", description: "Optional system prompt" },
        },
        required: ["prompt"],
      },
    },
    {
      name: "cf_embed",
      description: "Generate 768-dim embeddings for text chunks. Returns embedding vectors.",
      schema: {
        type: "object",
        properties: {
          texts: { type: "array", items: { type: "string" }, description: "Texts to embed" },
        },
        required: ["texts"],
      },
    },
    {
      name: "cf_chat",
      description: "Chat-style generation with message history. For multi-turn agent conversations.",
      schema: {
        type: "object",
        properties: {
          messages: {
            type: "array",
            description: "Chat messages",
            items: {
              type: "object",
              properties: {
                role: { type: "string", enum: ["system", "user", "assistant"] },
                content: { type: "string" },
              },
            },
          },
          model: { type: "string", enum: ["fast", "power", "reasoning"] },
          max_tokens: { type: "number", default: 2000 },
          temperature: { type: "number", default: 0.2 },
        },
        required: ["messages"],
      },
    },
    {
      name: "cf_health",
      description: "Check Cloudflare Workers AI connectivity and available models.",
      schema: { type: "object", properties: {} },
    },
    {
      name: "cf_list_models",
      description: "List all available text generation and embedding models.",
      schema: { type: "object", properties: {} },
    },
  ],
});

const cfBreaker = server.getCircuitBreaker("cloudflare-workers-ai");

// HTTP client for Cloudflare API
async function cfRequest(endpoint: string, body: Record<string, unknown>) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${endpoint}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (CF_API_TOKEN) {
    headers["Authorization"] = `Bearer ${CF_API_TOKEN}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloudflare LLM call failed: ${res.status} ${res.statusText} - ${text.substring(0, 300)}`);
  }

  const data = await res.json();
  if (!data.success) {
    throw new Error(`Cloudflare API error: ${JSON.stringify(data.errors)}`);
  }
  return data.result;
}

// ── Handlers ──

server.register("cf_text_gen", async (params) => {
  const {
    prompt,
    model = "fast",
    max_tokens = 2000,
    temperature = 0.2,
    system_prompt,
  } = (params || {}) as Record<string, any>;

  const modelPath = MODEL_MAP[model] || MODEL_MAP.fast;

  return cfBreaker.execute(async () => {
    const messages: { role: string; content: string }[] = [];
    if (system_prompt) messages.push({ role: "system", content: system_prompt as string });
    messages.push({ role: "user", content: prompt as string });

    const result = await cfRequest(modelPath, {
      messages,
      max_tokens: max_tokens as number,
      temperature: temperature as number,
    });

    return {
      text: result.response || result,
      model: modelPath,
      tokens: result.usage || {},
    };
  });
});

server.register("cf_embed", async (params) => {
  const { texts } = (params || {}) as Record<string, any>;
  const modelPath = MODEL_MAP.embeddings;

  return cfBreaker.execute(async () => {
    const result = await cfRequest(modelPath, {
      text: texts,
    });

    return {
      embeddings: result.data || result,
      dimensions: (result.data?.[0] || result[0])?.length || 768,
      model: modelPath,
      count: Array.isArray(texts) ? texts.length : 1,
    };
  });
});

server.register("cf_chat", async (params) => {
  const {
    messages,
    model = "fast",
    max_tokens = 2000,
    temperature = 0.2,
  } = (params || {}) as Record<string, any>;

  const modelPath = MODEL_MAP[model] || MODEL_MAP.fast;

  return cfBreaker.execute(async () => {
    const result = await cfRequest(modelPath, {
      messages,
      max_tokens: max_tokens as number,
      temperature: temperature as number,
    });

    const response = result.response || result;
    messages.push({ role: "assistant", content: response });

    return {
      response: response,
      messages,
      model: modelPath,
      tokens: result.usage || {},
    };
  });
});

server.register("cf_health", async () => {
  try {
    const result = await cfRequest(MODEL_MAP.fast, {
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
    });
    return { status: "connected", accountId: CF_ACCOUNT_ID, testResult: "ok" };
  } catch (e: any) {
    return { status: "error", accountId: CF_ACCOUNT_ID, error: e?.message };
  }
});

server.register("cf_list_models", async () => {
  return { models: MODEL_MAP };
});

// ── Start ──

server.start();
