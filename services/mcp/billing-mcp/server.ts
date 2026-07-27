// Billing MCP — Stripe payment processing
// Subscriptions, invoices, usage-based billing, payment status

import { MCPServer, MCPServerConfig } from "../shared/server";

const CAPABILITIES = [
  { name: "billing_subscription", description: "Get/create/update firm subscription", schema: {
    type: "object", properties: { action: { type: "string", enum: ["get", "create", "update", "cancel"] }, firmId: { type: "string" }, priceId: { type: "string" }, subscriptionId: { type: "string" } },
    required: ["action"] }
  },
  { name: "billing_invoice", description: "List/get invoices for a firm", schema: {
    type: "object", properties: { action: { type: "string", enum: ["list", "get", "pay", "send"] }, firmId: { type: "string" }, invoiceId: { type: "string" } },
    required: ["action"] }
  },
  { name: "billing_usage", description: "Record usage-based billing events", schema: {
    type: "object", properties: { firmId: { type: "string" }, eventName: { type: "string" }, quantity: { type: "number", default: 1 } },
    required: ["firmId", "eventName"] }
  },
  { name: "billing_customer", description: "Manage Stripe customer records", schema: {
    type: "object", properties: { action: { type: "string", enum: ["get", "create", "update"] }, firmId: { type: "string" }, email: { type: "string" }, name: { type: "string" }, paymentMethodId: { type: "string" } },
    required: ["action"] }
  },
  { name: "billing_portal", description: "Generate customer portal session URL", schema: {
    type: "object", properties: { firmId: { type: "string" }, returnUrl: { type: "string" } },
    required: ["firmId"] }
  },
  { name: "billing_health", description: "Stripe connectivity check", schema: { type: "object", properties: {} } },
];

const server = new MCPServer({
  name: "billing-mcp", version: "1.0.0", capabilities: CAPABILITIES,
  transport: "http", port: 3108,
});

async function stripeAPI(endpoint: string, method = "GET", body?: any) {
  const key = process.env.STRIPE_SECRET_KEY || "";
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Stripe-Version": "2024-06-20",
  };
  if (body) headers["Content-Type"] = "application/x-www-form-urlencoded";
  const url = `https://api.stripe.com/v1${endpoint}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? new URLSearchParams(body).toString() : undefined,
  });
  if (!res.ok) throw new Error(`Stripe ${res.status}: ${await res.text()}`);
  return res.json();
}

server.register("billing_subscription", async (p) => {
  const cb = server.getCircuitBreaker("billing");
  return cb.call(async () => {
    const action = p?.action as string;
    if (action === "get") return stripeAPI(`/subscriptions/${p?.subscriptionId}`);
    if (action === "create") return stripeAPI("/subscriptions", "POST", {
      customer: p?.firmId, items: JSON.stringify([{ price: p?.priceId }]),
    });
    if (action === "update") return stripeAPI(`/subscriptions/${p?.subscriptionId}`, "POST", {
      items: JSON.stringify([{ id: p?.subscriptionId, price: p?.priceId }]),
    });
    if (action === "cancel") return stripeAPI(`/subscriptions/${p?.subscriptionId}`, "DELETE");
    throw new Error(`Unknown action: ${action}`);
  });
});

server.register("billing_invoice", async (p) => {
  const cb = server.getCircuitBreaker("billing");
  return cb.call(async () => {
    const action = p?.action as string;
    if (action === "list") return stripeAPI(`/invoices?customer=${p?.firmId}&limit=20`);
    if (action === "get") return stripeAPI(`/invoices/${p?.invoiceId}`);
    if (action === "pay") return stripeAPI(`/invoices/${p?.invoiceId}/pay`, "POST");
    if (action === "send") return stripeAPI(`/invoices/${p?.invoiceId}/send`, "POST");
    throw new Error(`Unknown action: ${action}`);
  });
});

server.register("billing_usage", async (p) => {
  const cb = server.getCircuitBreaker("billing");
  return cb.call(() => stripeAPI("/billing/meter_events", "POST", {
    event_name: p?.eventName, payload: JSON.stringify({
      stripe_customer_id: p?.firmId, value: String(p?.quantity || 1),
    }),
  }));
});

server.register("billing_customer", async (p) => {
  const cb = server.getCircuitBreaker("billing");
  return cb.call(async () => {
    const action = p?.action as string;
    if (action === "get") return stripeAPI(`/customers/${p?.firmId}`);
    if (action === "create") return stripeAPI("/customers", "POST", { email: p?.email, name: p?.name, metadata: { firmId: p?.firmId as string } });
    if (action === "update") return stripeAPI(`/customers/${p?.firmId}`, "POST", { invoice_settings: { default_payment_method: p?.paymentMethodId } });
    throw new Error(`Unknown action: ${action}`);
  });
});

server.register("billing_portal", async (p) => {
  const cb = server.getCircuitBreaker("billing");
  return cb.call(async () => {
    const data = await stripeAPI("/billing_portal/sessions", "POST", {
      customer: p?.firmId, return_url: p?.returnUrl || "https://app.counsel.ai/dashboard",
    });
    return { url: data.url };
  });
});

server.register("billing_health", async () => {
  try { await stripeAPI("/customers?limit=1"); return { status: "healthy" }; }
  catch { return { status: "unreachable" }; }
});

server.start();
