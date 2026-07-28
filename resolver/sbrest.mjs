// Supabase REST helpers for the resolver, using the service_role key (bypasses
// RLS — trusted server). Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from env.
//
// Every call names a SCHEMA. The friends-league tables live in `app`, which is
// what almost everything here wants, so that is the default; the relational
// spine (Phase 1) lives in `game` and passes it explicitly.
const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function assertEnv() {
  if (!URL || !KEY) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
    process.exit(1);
  }
}

function head(schema, extra) {
  return Object.assign({
    apikey: KEY, Authorization: `Bearer ${KEY}`,
    "Content-Profile": schema, "Accept-Profile": schema,
  }, extra || {});
}

// PostgREST's two ways of saying "that isn't here": the table is missing from
// the schema cache (migration not run), or the schema itself is not exposed to
// the API. Both mean the same thing to a caller — carry on without it.
const ABSENT = /PGRST205|PGRST106|does not exist|schema cache|must be one of the following/i;

/** Call a SECURITY DEFINER function via PostgREST RPC. */
export async function rpc(fn, args = {}, schema = "app") {
  const res = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: head(schema, { "content-type": "application/json" }),
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`rpc ${fn} ${res.status}: ${await res.text()}`);
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

/** GET rows from a table/view. */
export async function rest(path, schema = "app") {
  const res = await fetch(`${URL}/rest/v1/${path}`, { headers: head(schema) });
  if (!res.ok) throw new Error(`rest ${path} ${res.status}: ${await res.text()}`);
  return res.json();
}

/**
 * Upsert rows. Returns false if the table (or its schema) is not there yet, so
 * a caller can degrade instead of failing. With opts.select the upserted rows
 * come back — needed when later rows must reference the ids just written.
 */
export async function upsert(table, rows, onConflict, opts = {}) {
  const schema = opts.schema || "app";
  if (!rows || !rows.length) return opts.select ? [] : true;
  const q = [];
  if (onConflict) q.push(`on_conflict=${onConflict}`);
  if (opts.select) q.push(`select=${opts.select}`);
  const res = await fetch(`${URL}/rest/v1/${table}${q.length ? "?" + q.join("&") : ""}`, {
    method: "POST",
    headers: head(schema, {
      "content-type": "application/json",
      Prefer: `resolution=merge-duplicates,return=${opts.select ? "representation" : "minimal"}`,
    }),
    body: JSON.stringify(rows),
  });
  if (res.ok) return opts.select ? res.json() : true;
  const txt = await res.text();
  // the migration has not been run in this project yet — the caller carries on
  if (ABSENT.test(txt)) return false;
  throw new Error(`upsert ${table} ${res.status}: ${txt}`);
}

/**
 * DELETE rows matching a PostgREST filter. `path` MUST carry a filter —
 * PostgREST refuses an unfiltered delete, and so would we.
 */
export async function del(path, schema = "app") {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    method: "DELETE",
    headers: head(schema, { Prefer: "return=minimal" }),
  });
  if (res.ok) return true;
  const txt = await res.text();
  if (ABSENT.test(txt)) return false;
  throw new Error(`delete ${path} ${res.status}: ${txt}`);
}

/** A league's pinned engine build hash. */
export async function leaguePin(leagueId) {
  const [row] = await rest(`leagues?id=eq.${leagueId}&select=build_hash`);
  return row?.build_hash;
}
