// The ONE identity seam. Every game action keys off manager_id, resolved here.
//
// Flow:  Supabase Auth JWT  →  request.jwt.claim.sub (auth_uid)  →  members.auth_uid  →  manager_id
//
// The mapping and all authorization live in the tested Postgres function
// app.resolve_manager_id(league_id) (see migrations/0001_init.sql). This module
// only carries the caller's JWT to Postgres so that function can read it. To swap
// identity providers, change ONLY this file + app.current_auth_uid() — nothing
// else in the codebase names an auth uid.
//
// Runtime: Supabase Edge Functions (Deno).

import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

/** A Supabase client bound to the caller's JWT. Queries run as the
 *  'authenticated' role with request.jwt.claim.sub set, so RLS + the app.*
 *  SECURITY DEFINER functions authorize exactly this user. */
export function userClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get("Authorization") ?? "";
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export class AuthError extends Error {
  constructor(msg: string, public status = 401) { super(msg); }
}

/** resolveManagerId(request): the caller's manager_id within a league, or throws.
 *  Delegates to app.resolve_manager_id, which raises 'not authenticated' /
 *  'not a member' — surfaced here as AuthError(401/403). */
export async function resolveManagerId(req: Request, leagueId: string): Promise<string> {
  const db = userClient(req);
  // app.* is exposed to PostgREST via config.toml ([api].schemas includes "app").
  const { data, error } = await db.schema("app").rpc("resolve_manager_id", { p_league_id: leagueId });
  if (error) {
    const status = /not authenticated/i.test(error.message) ? 401 : 403;
    throw new AuthError(error.message, status);
  }
  if (!data) throw new AuthError("could not resolve manager", 403);
  return data as string;
}

/** Assert the caller is the league founder (delegates to app.require_founder). */
export async function requireFounder(req: Request, leagueId: string): Promise<string> {
  const db = userClient(req);
  const { data, error } = await db.schema("app").rpc("require_founder", { p_league_id: leagueId });
  if (error) {
    const status = /not authenticated/i.test(error.message) ? 401 : 403;
    throw new AuthError(error.message, status);
  }
  return data as string;
}
