// =============================================
// SOLARA TV — get-options (Supabase Edge Function)
// GET → returns available bouquets/packages from the
// Activation Panel (server-side, API key never exposed).
//
// Env (secrets): ACTIVATION_API_KEY, ACTIVATION_API_URL
// =============================================
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const ACTIVATION_API_KEY = Deno.env.get("ACTIVATION_API_KEY") || "";
const ACTIVATION_API_URL = Deno.env.get("ACTIVATION_API_URL") || "https://activationpanel.ru/api/api.php";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const url = new URL(ACTIVATION_API_URL);
    url.searchParams.set("api_key", ACTIVATION_API_KEY);
    url.searchParams.set("action", "bouquet");
    const res = await fetch(url.toString());
    const text = await res.text();
    let data: any = text;
    try { data = JSON.parse(text); } catch { /* plain text */ }

    // Normalize: array of {id, name} or empty when no custom bouquets
    let bouquets: { id: string; name: string }[] = [];
    if (Array.isArray(data)) {
      bouquets = data.map((b: any) => ({
        id: String(b.id || b.ID || ""),
        name: String(b.name || b.Name || "Package"),
      })).filter((b: any) => b.id);
    }

    return new Response(JSON.stringify({ ok: true, bouquets }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, bouquets: [], error: String(err?.message || err) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
