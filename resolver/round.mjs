// Background league round resolver. Your game IS the game: the shared league
// lives as one game snapshot() per league. For each league, collect this round's
// order packets and — once everyone has submitted, or a daily grace has elapsed —
// play the round in the REAL engine (completeRound) and publish the next snapshot.
// The engine is deterministic, so the published snapshot is authoritative and the
// game's own table/fixtures/results screens update on every client that pulls it.
import { openEngine } from './resolve.mjs';
import { assertEnv, rpc, rest } from './sbrest.mjs';

// League matches play once per day at 09:00 New York time. (Friendlies are played
// in-game whenever a manager likes — the resolver only advances league rounds.)
const MATCH_HOUR = 9;
const MATCH_TZ = 'America/New_York';

function tzDateHour(d) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: MATCH_TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: parseInt(p.hour, 10) };
}

export async function advanceLeagues() {
  assertEnv();
  const states = await rest('league_state?select=league_id,snapshot,version,round,updated_at');
  if (!states.length) { console.log('no leagues to advance'); return; }
  const { page, close } = await openEngine();
  try {
    for (const st of states) {
      try { await advanceOne(page, st); }
      catch (e) { console.log('league', st.league_id, 'error:', e.message); }
    }
  } finally { await close(); }
}

async function advanceOne(page, st) {
  const lid = st.league_id, round = st.round, snap = st.snapshot;
  const sched = snap && snap.season && snap.season.schedule;
  if (!sched || round >= sched.length) { console.log(lid, 'season complete'); return; }

  // Gate to one round per day at 09:00 New York time. Managers who have not
  // submitted orders for the round play with the engine's automatic line-up.
  const now = tzDateHour(new Date());
  const last = tzDateHour(new Date(st.updated_at));
  if (now.hour < MATCH_HOUR) { console.log(lid, `before ${MATCH_HOUR}:00 ${MATCH_TZ}`); return; }
  if (last.date >= now.date) { console.log(lid, 'already advanced today'); return; }

  const packets = await rest(`league_packets?league_id=eq.${lid}&round=eq.${round}&select=packet`);

  const newSnap = await page.evaluate(({ snap, pkts }) => {
    window.restoreFrom(snap);
    if (typeof window.mpInit === 'function') window.mpInit();
    // raw packets also carry fo_training / fo_youth club orders for the harness
    window.__FO_PKTS = pkts;
    for (const p of pkts) {
      if (p && typeof p.teamIx === 'number' && p.orders) {
        App.mp.packets[p.teamIx] = { orders: p.orders, round: p.round, club: p.club, manager: p.manager };
      }
    }
    window.completeRound();
    return window.snapshot(true);
  }, { snap, pkts: packets.map(r => r.packet) });

  const newRound = (newSnap.season && typeof newSnap.season.round === 'number') ? newSnap.season.round : round + 1;
  await rpc('push_league_state', { p_league_id: lid, p_snapshot: newSnap, p_round: newRound });
  console.log(lid, `advanced round ${round} -> ${newRound}`);
}

const isMain = process.argv[1] && process.argv[1].endsWith('round.mjs');
if (isMain) advanceLeagues().catch((e) => { console.error(e); process.exit(1); });
