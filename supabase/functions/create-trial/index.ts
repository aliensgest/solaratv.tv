// =============================================
// SOLARA TV — create-trial (Supabase Edge Function)
// Creates a FREE 1-day demo M3U (sub=99, 0 credits)
// linked to the user. Max 1 trial per user.
//
// Env (auto-injected): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Env (secrets): ACTIVATION_API_KEY, ACTIVATION_API_URL
// =============================================
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ACTIVATION_API_KEY = Deno.env.get("ACTIVATION_API_KEY") || "";
const ACTIVATION_API_URL = Deno.env.get("ACTIVATION_API_URL") || "https://activationpanel.ru/api/api.php";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || "";
const supabase = SUPABASE_URL && SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY) : null;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function panelRequest(params: Record<string, string>) {
  const url = new URL(ACTIVATION_API_URL);
  url.searchParams.set("api_key", ACTIVATION_API_KEY);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  const text = await res.text();
  let json: any = text;
  try { json = JSON.parse(text); } catch { /* plain text */ }
  return Array.isArray(json) ? json[0] : json;
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
    const { userId } = body || {};
    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing userId" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (!supabase) {
      return new Response(JSON.stringify({ error: "Supabase not configured" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // 1) Limit: max 1 trial per user
    const { data: existing, error: errExisting } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId)
      .ilike("note", "%trial%");
    if (errExisting) console.warn("Trial check failed:", errExisting.message);
    if (existing && existing.length) {
      return new Response(JSON.stringify({ ok: false, error: "You already used your free trial." }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // 2) Create the demo M3U (sub=99 → 1 day, 0 credits, uses a demo ticket)
    const created = await panelRequest({
      action: "new", type: "m3u", sub: "99", pack: "all",
      note: "Free trial (1 day) — auto",
    });
    if (!created || created.status !== "true") {
      return new Response(JSON.stringify({ ok: false, error: "Panel trial create failed", panel: created }), { status: 502, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // 3) Credentials + expiry
    const { username, password } = parseCredentials(created.url || "");
    let expire = "";
    if (username && password) {
      try {
        const info = await panelRequest({ action: "device_info", username, password });
        if (info && info.expire) expire = info.expire;
      } catch { /* non-blocking */ }
    }

    // 4) Save linked to the user
    const { error: insErr } = await supabase.from("subscriptions").insert({
      user_id: userId,
      type: "m3u",
      action: "new",
      username,
      password,
      status: "success",
      note: "Free trial",
      expire_date: expire || null,
      api_response: created,
    });
    if (insErr) {
      console.warn("Trial insert failed:", insErr.message);
      return new Response(JSON.stringify({ ok: false, error: "Could not save trial", detail: insErr.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, username, password, expire }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
