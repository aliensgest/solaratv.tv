// =============================================
// SOLARA TV — payment-hook (Supabase Edge Function)
// Phase 2 automation:
//   1. Receives { planKey, paypalOrderId } from the client
//   2. Verifies the order with PayPal REST API (server-side, secret)
//   3. If COMPLETED → creates the subscription on Activation Panel
//
// Env vars (set via `supabase secrets set ...`):
//   PAYPAL_CLIENT_ID      — public client id
//   PAYPAL_SECRET         — SECRET (never in client code)
//   ACTIVATION_API_KEY    — panel API key (never in client code)
//   ACTIVATION_API_URL    — panel endpoint
//   PAYPAL_API            — https://api-m.paypal.com (live) or sandbox
// =============================================
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID") || "";
const PAYPAL_SECRET = Deno.env.get("PAYPAL_SECRET") || "";
const ACTIVATION_API_KEY = Deno.env.get("ACTIVATION_API_KEY") || "";
const ACTIVATION_API_URL = Deno.env.get("ACTIVATION_API_URL") || "https://activationpanel.ru/api/api.php";
const PAYPAL_API = Deno.env.get("PAYPAL_API") || "https://api-m.paypal.com";

// Mapping plan -> activation panel params
const PLAN_MAP: Record<string, { sub: string; pack: string }> = {
  monthly:   { sub: "1",  pack: "all" },
  quarterly: { sub: "3",  pack: "all" },
  semi:      { sub: "6",  pack: "all" },
  annual:    { sub: "12", pack: "all" },
  biennial:  { sub: "24", pack: "all" },
  offer3:    { sub: "3",  pack: "all" },
  offer6:    { sub: "6",  pack: "all" },
  offer12:   { sub: "12", pack: "all" },
  offer24:   { sub: "24", pack: "all" },
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function paypalToken(): Promise<string> {
  const cred = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`);
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${cred}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const json = await res.json();
  if (!res.ok) throw new Error("PayPal auth failed: " + JSON.stringify(json));
  return json.access_token;
}

async function verifyOrder(orderId: string, token: string) {
  const res = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const order = await res.json();
  if (!res.ok) throw new Error("Verify order failed: " + JSON.stringify(order));
  return order;
}

async function createPanelSubscription(sub: string, pack: string, note: string) {
  const url = new URL(ACTIVATION_API_URL);
  url.searchParams.set("api_key", ACTIVATION_API_KEY);
  url.searchParams.set("action", "new");
  url.searchParams.set("type", "m3u");
  url.searchParams.set("sub", sub);
  url.searchParams.set("pack", pack);
  url.searchParams.set("note", note.slice(0, 200));
  const res = await fetch(url.toString());
  const text = await res.text();
  let json: any = text;
  try { json = JSON.parse(text); } catch { /* panel may return plain text */ }
  return Array.isArray(json) ? json[0] : json;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), {
      status: 405, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { planKey, paypalOrderId } = body || {};

    const plan = PLAN_MAP[planKey];
    if (!plan) {
      return new Response(JSON.stringify({ error: "Unknown plan: " + planKey }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (!paypalOrderId) {
      return new Response(JSON.stringify({ error: "Missing paypalOrderId" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // 1) Verify the payment actually completed
    const token = await paypalToken();
    const order = await verifyOrder(paypalOrderId, token);
    if (order.status !== "COMPLETED") {
      return new Response(JSON.stringify({ error: "Order not completed", status: order.status }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const amount = order.purchase_units?.[0]?.amount?.value || "";
    const currency = order.purchase_units?.[0]?.amount?.currency_code || "EUR";
    const note = `PayPal ${paypalOrderId} — ${amount} ${currency} (auto)`;

    // 2) Create the subscription on the Activation Panel
    const panel = await createPanelSubscription(plan.sub, plan.pack, note);

    return new Response(JSON.stringify({
      ok: true,
      paypalStatus: order.status,
      amount,
      currency,
      panel,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
