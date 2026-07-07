// Resolver container entrypoint. Polls Supabase for due matches and resolves them
// with the real engine, enforcing the per-league engine-hash pin. Officials run on
// a daily cadence (resolve_at at the league match time); friendlies kick off any
// minute — the same short-interval loop handles both.
//
//   node worker.mjs --once     # one pass (invoke from a platform cron)
//   node worker.mjs            # loop every POLL_SECONDS (default 60)
//
// UNTESTED-live (needs a running Supabase). The resolve → store → consequences
// path it drives is exercised end-to-end in supabase/tests/run_phase4.mjs; this
// file is the thin orchestration that calls those same tested SQL functions.
import { openEngine, resolveMatch, buildHash } from './resolve.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const POLL_SECONDS = Number(process.env.POLL_SECONDS ?? 60);

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}

// service_role RPC against the `app` schema (bypasses RLS — trusted resolver).
async function rpc(fn, args = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
      'content-type': 'application/json',
      'Content-Profile': 'app', 'Accept-Profile': 'app',
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`rpc ${fn} ${res.status}: ${await res.text()}`);
  return res.json();
}
// read a league's pinned build hash
async function leaguePin(leagueId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/leagues?id=eq.${leagueId}&select=build_hash`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Accept-Profile': 'app' },
  });
  const [row] = await res.json();
  return row?.build_hash;
}

async function runOnce(page) {
  let officials = 0, friendlies = 0, skipped = 0;

  // ---- OFFICIAL fixtures due now ----
  for (const fx of await rpc('due_fixtures')) {
    const pin = await leaguePin(fx.league_id);
    if (pin !== buildHash()) { console.warn(`skip fixture ${fx.id}: engine hash != league pin`); skipped++; continue; }
    try {
      await rpc('begin_resolve', { p_fixture_id: fx.id });     // team-lock + lineup lock
    } catch (e) { console.warn(`fixture ${fx.id} not claimed: ${e.message}`); skipped++; continue; }
    const inputs = await rpc('fixture_inputs', { p_fixture_id: fx.id });
    const payload = await resolveMatch(page, inputs, { pinnedHash: pin });
    await rpc('store_official_result', { p_fixture_id: fx.id, p_payload: payload, p_build_hash: buildHash() });
    officials++;
  }

  // ---- FRIENDLIES: lock at kickoff-5min, resolve at kickoff ----
  for (const ch of await rpc('friendlies_to_lock')) {
    await rpc('lock_match_orders', { p_challenge_id: ch.id });
  }
  for (const ch of await rpc('friendlies_to_resolve')) {
    const pin = await leaguePin(ch.league_id);
    if (pin !== buildHash()) { console.warn(`skip friendly ${ch.id}: engine hash != league pin`); skipped++; continue; }
    const inputs = await rpc('friendly_inputs', { p_challenge_id: ch.id });
    const payload = await resolveMatch(page, inputs, { pinnedHash: pin });
    await rpc('store_friendly_result', { p_challenge_id: ch.id, p_payload: payload, p_build_hash: buildHash() });
    friendlies++;
  }

  // ---- expire unaccepted challenges past kickoff ----
  const expired = await rpc('expire_stale_challenges');
  if (officials || friendlies || skipped || expired)
    console.log(`pass: ${officials} official, ${friendlies} friendly, ${skipped} skipped, ${expired} expired`);
}

const eng = await openEngine();
console.log(`resolver up. build ${buildHash().slice(0, 12)}…`);
try {
  if (process.argv.includes('--once')) {
    await runOnce(eng.page);
  } else {
    for (;;) {
      try { await runOnce(eng.page); } catch (e) { console.error('pass error:', e.message); }
      await new Promise(r => setTimeout(r, POLL_SECONDS * 1000));
    }
  }
} finally {
  if (process.argv.includes('--once')) await eng.close();
}
