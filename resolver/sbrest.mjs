// Supabase REST helpers for the resolver, using the service_role key (bypasses
// RLS — trusted server). Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from env.
const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function assertEnv() {
  if (!URL || !KEY) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
    process.exit(1);
  }
}

/** Call an app.* function via PostgREST RPC. */
export async function rpc(fn, args = {}) {
  const res = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: KEY, Authorization: `Bearer ${KEY}`,
      "content-type": "application/json",
      "Content-Profile": "app", "Accept-Profile": "app",
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`rpc ${fn} ${res.status}: ${await res.text()}`);
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

/** GET rows from an app table/view. */
export async function rest(path) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Accept-Profile": "app" },
  });
  if (!res.ok) throw new Error(`rest ${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

/** A league's pinned engine build hash. */
export async function leaguePin(leagueId) {
  const [row] = await rest(`leagues?id=eq.${leagueId}&select=build_hash`);
  return row?.build_hash;
}
