// Founder-only: lock the manager count, generate the master pool with the REAL
// engine, snake-deal it into equal private buckets, and persist one per manager.
// POST { league_id }.
//
// The master pool comes from the resolver service (headless game engine,
// window.genDraftPool) so ratings/fees stay engine-consistent; RESOLVER_URL points
// at the Phase-4 container. The partition (snakeDeal) and persistence go through
// the tested SQL (lock_managers / write_draft_pool). UNTESTED here (needs live
// Supabase + resolver); snakeDeal itself is unit-tested in tests/run_phase2.mjs and
// on a real pool in tests/draft_realpool.mjs.
import { userClient, requireFounder } from "../_shared/identity.ts";
import { handler, json } from "../_shared/http.ts";
import { snakeDeal, dealReport } from "../_shared/draft.js";

const RESOLVER_URL = Deno.env.get("RESOLVER_URL")!;
const PER_MANAGER = 15;   // equal private bucket size (pool = PER_MANAGER * N)

Deno.serve(handler(async (req, body) => {
  const { league_id } = body ?? {};
  if (!league_id) return json({ error: "league_id required" }, 400);

  await requireFounder(req, league_id);          // founder gate (raises otherwise)
  const db = userClient(req);

  // 1) freeze the roster count; get manager_ids in the deal order
  const { data: managers, error: lockErr } =
    await db.schema("app").rpc("lock_managers", { p_league_id: league_id });
  if (lockErr) throw new Error(lockErr.message);
  const N = (managers as string[]).length;
  if (N < 2) return json({ error: "need at least 2 managers to draft" }, 400);

  // 2) real engine master pool, sized as a multiple of N for equal buckets
  const need = PER_MANAGER * N;
  const poolRes = await fetch(`${RESOLVER_URL}/genpool`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ league_id, count: need }),
  });
  if (!poolRes.ok) throw new Error(`resolver genpool failed: ${poolRes.status}`);
  const master = (await poolRes.json()).players as any[];
  if (master.length < need) throw new Error(`resolver returned ${master.length} < ${need} players`);

  // 3) snake-deal into equal, disjoint, rating-balanced buckets
  const buckets = snakeDeal(master.slice(0, need), N);
  const report = dealReport(buckets);

  // 4) persist each manager's private bucket
  for (let i = 0; i < N; i++) {
    const { error } = await db.schema("app").rpc("write_draft_pool", {
      p_league_id: league_id, p_manager_id: (managers as string[])[i],
      p_players: buckets[i],
    });
    if (error) throw new Error(error.message);
  }
  return json({ ok: true, managers: N, per_manager: PER_MANAGER, report });
}));
