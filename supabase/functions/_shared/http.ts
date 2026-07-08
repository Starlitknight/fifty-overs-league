// Small HTTP helpers for the Edge Functions. UNTESTED here (needs a live Deno +
// Supabase runtime); the authorization/validation they call into is the tested
// SQL layer.
import { AuthError } from "./identity.ts";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

/** Wrap a handler: OPTIONS preflight, JSON parse, and error → status mapping. */
export function handler(fn: (req: Request, body: any) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    if (req.method !== "POST") return json({ error: "POST only" }, 405);
    try {
      const body = await req.json().catch(() => ({}));
      return await fn(req, body);
    } catch (e) {
      if (e instanceof AuthError) return json({ error: e.message }, e.status);
      // Postgres RAISE messages surface here; validation failures are 400/403.
      const msg = String((e as Error).message ?? e);
      const status = /founder-only|not your|locked|over budget|not in your|illegal|already|booked|expired/i.test(msg) ? 403 : 400;
      return json({ error: msg }, status);
    }
  };
}
