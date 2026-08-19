// =============================================
// SOLARA TV — payment-hook (Supabase Edge Function)
// Full automation flow:
//   1. Receives { planKey, paypalOrderId, userId }
//   2. Verifies the PayPal order (server-side, secret)
//   3. Creates the M3U subscription on Activation Panel
//   4. Fetches expiry via device_info
//   5. Saves the subscription linked to the user in Supabase
//
// Env (auto-injected by Supabase runtime):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Env (set via `supabase secrets set ...`):
//   PAYPAL_CLIENT_ID, PAYPAL_SECRET, ACTIVATION_API_KEY,
//   ACTIVATION_API_URL, PAYPAL_API
// =============================================
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PAYPAL_CLIENT_ID = Deno.env.get("PAYPAL_CLIENT_ID") || "";
const PAYPAL_SECRET = Deno.env.get("PAYPAL_SECRET") || "";
const ACTIVATION_API_KEY = Deno.env.get("ACTIVATION_API_KEY") || "";
const ACTIVATION_API_URL = Deno.env.get("ACTIVATION_API_URL") || "https://activationpanel.ru/api/api.php";
const PAYPAL_API = Deno.env.get("PAYPAL_API") || "https://api-m.paypal.com";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || "";
const supabase = SUPABASE_URL && SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY) : null;

// Mapping plan -> activation panel params
// (sub 1,3,6,12 per panel API; 2-year = sub 12 + renew 12)
const PLAN_MAP: Record<string, { sub: string; pack: string; renew?: boolean }> = {
  monthly:   { sub: "1",  pack: "all" },
  quarterly: { sub: "3",  pack: "all" },
  semi:      { sub: "6",  pack: "all" },
  annual:    { sub: "12", pack: "all" },
  biennial:  { sub: "12", pack: "all", renew: true }, // 12 + renew 12 = 2 years
  offer3:    { sub: "3",  pack: "all" },
  offer6:    { sub: "6",  pack: "all" },
  offer12:   { sub: "12", pack: "all" },
  offer24:   { sub: "12", pack: "all", renew: true }, // 12 + renew 12 = 2 years
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/* ---------- PayPal ---------- */
async function paypalToken(): Promise<string> {
  const cred = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`);
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${cred}`, "Content-Type": "application/x-www-form-urlencoded" },
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

/* ---------- Activation Panel ---------- */
async function panelRequest(params: Record<string, string>) {
  const url = new URL(ACTIVATION_API_URL);
  url.searchParams.set("api_key", ACTIVATION_API_KEY);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  const text = await res.text();
  let json: any = text;
  try { json = JSON.parse(text); } catch { /* panel may return plain text */ }
  return Array.isArray(json) ? json[0] : json;
}

async function createM3U(sub: string, pack: string, note: string) {
  return panelRequest({ action: "new", type: "m3u", sub, pack, note });
}

async function renewM3U(username: string, password: string, sub: string) {
  return panelRequest({ action: "renew", type: "m3u", username, password, sub });
}

async function deviceInfo(username: string, password: string) {
  return panelRequest({ action: "device_info", username, password });
}

function parseCredentials(url: string): { username: string; password: string } {
  try {
    const u = new URL(url);
    return { username: u.searchParams.get("username") || "", password: u.searchParams.get("password") || "" };
  } catch {
    return { username: "", password: "" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: { ...cors, "Content-Type": "application/json" } });
  }

  try {
    const body = await req.json();
    const { planKey, paypalOrderId, userId, pack, country, note } = body || {};

    const plan = PLAN_MAP[planKey];
    if (!plan) {
      return new Response(JSON.stringify({ error: "Unknown plan: " + planKey }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (!paypalOrderId) {
      return new Response(JSON.stringify({ error: "Missing paypalOrderId" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Client-selected bouquet/package + country + note (fallbacks to plan defaults)
    const packFinal = (pack && pack !== "all" && String(pack).trim()) ? String(pack).trim() : plan.pack;
    const noteClient = (note && note.trim()) ? note.trim() : "";
    const countryClient = (country && country.trim()) ? country.trim() : "";

    // 1) Verify payment
    const token = await paypalToken();
    const order = await verifyOrder(paypalOrderId, token);
    if (order.status !== "COMPLETED") {
      return new Response(JSON.stringify({ error: "Order not completed", status: order.status }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const amount = order.purchase_units?.[0]?.amount?.value || "";
    const currency = order.purchase_units?.[0]?.amount?.currency_code || "EUR";
    const parts = [];
    if (countryClient) parts.push(`Country: ${countryClient}`);
    if (noteClient) parts.push(noteClient);
    parts.push(`PayPal ${paypalOrderId} — ${amount} ${currency} (auto)`);
    const note = parts.join(" | ");

    // 2) Create M3U on the panel
    const created = await createM3U(plan.sub, packFinal, note);
    if (!created || created.status !== "true") {
      return new Response(JSON.stringify({ ok: false, error: "Panel create failed", panel: created }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // 3) Extract credentials from the returned URL
    let { username, password } = parseCredentials(created.url || "");

    // 4) 2-year plan → renew for an extra 12 months
    if (plan.renew && username && password) {
      const renewed = await renewM3U(username, password, "12");
      if (!renewed || renewed.status !== "true") {
        console.warn("Renew (2nd year) failed:", renewed);
      }
    }

    // 5) Fetch expiry
    let expire = "";
    if (username && password) {
      try {
        const info = await deviceInfo(username, password);
        if (info && info.expire) expire = info.expire;
      } catch { /* non-blocking */ }
    }

    // 6) Save to Supabase linked to the user
    let saved = false;
    if (supabase && userId) {
      const row = {
        user_id: userId,
        type: "m3u",
        action: "new",
        username,
        password,
        package_id: null,
        bouquet_ids: plan.pack === "all" ? null : plan.pack,
        status: "success",
        note: note,
        expire_date: expire || null,
        api_response: created,
      };
      const { error } = await supabase.from("subscriptions").insert(row);
      if (error) console.warn("Supabase insert failed:", error.message);
      else saved = true;
    }

    return new Response(JSON.stringify({
      ok: true,
      paypalStatus: order.status,
      amount, currency,
      username, password, expire,
      saved,
      panel: created,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});

