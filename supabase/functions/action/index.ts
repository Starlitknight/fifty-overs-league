// Single constrained-action dispatcher. POST { league_id, action, args }.
// The caller's JWT flows to Postgres (userClient), so every app.* function
// self-authorizes via app.resolve_manager_id / app.require_founder. The client
// can ONLY invoke this allowlist — it never writes tables directly.
//
// UNTESTED here (needs live Supabase/Deno). The authorization + all validation
// live in the tested SQL functions (see migrations/0002 + tests/run_phase2.mjs).
import { userClient } from "../_shared/identity.ts";
import { handler, json } from "../_shared/http.ts";

// action -> { rpc, params(args, leagueId) }. Params are named to match the SQL.
const ACTIONS: Record<string, (a: any, lid: string) => Record<string, unknown>> = {
  create_team:      (a, lid) => ({ p_league_id: lid, p_name: a.name, p_ground: a.ground, p_home_pitch: a.home_pitch }),
  sign_player:      (a, lid) => ({ p_league_id: lid, p_name: a.name }),
  drop_player:      (a, lid) => ({ p_league_id: lid, p_name: a.name }),
  confirm_squad:    (_a, lid) => ({ p_league_id: lid }),
  submit_orders:    (a, lid) => ({ p_league_id: lid, p_fixture_id: a.fixture_id ?? null, p_challenge_id: a.challenge_id ?? null, p_orders: a.orders ?? {} }),
  issue_challenge:  (a, lid) => ({ p_league_id: lid, p_to_team_id: a.to_team_id, p_pitch: a.pitch, p_weather: a.weather, p_seed: a.seed, p_kickoff_at: a.kickoff_at }),
  accept_challenge: (a, lid) => ({ p_league_id: lid, p_challenge_id: a.challenge_id }),
  founder_edit:     (a, lid) => ({ p_league_id: lid, p_action: a.action, p_payload: a.payload }),
};

Deno.serve(handler(async (req, body) => {
  const { league_id, action, args = {} } = body ?? {};
  if (!league_id || !action) return json({ error: "league_id and action required" }, 400);
  const build = ACTIONS[action];
  if (!build) return json({ error: `unknown action ${action}` }, 400);

  const db = userClient(req);
  const { data, error } = await db.schema("app").rpc(action, build(args, league_id));
  if (error) throw new Error(error.message);
  return json({ ok: true, action, data });
}));
