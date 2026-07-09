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

// Play accepted human-vs-human challenge friendlies that have come due.
// Squads come from the league snapshot; each side's attached lineup is used
// when present. Friendlies: the result is recorded on the challenge row only.
async function playChallenges(page) {
  let due = [];
  try {
    due = await rest(`league_challenges?status=eq.accepted&result=is.null&play_at=lte.${encodeURIComponent(new Date().toISOString())}&select=*`);
  } catch (e) { return; }   // table absent until 0017 is run
  for (const ch of due) {
    try {
      const st = (await rest(`league_state?league_id=eq.${ch.league_id}&select=snapshot`))[0];
      if (!st) continue;
      const result = await page.evaluate(({ snap, ch }) => {
        window.restoreFrom(snap);
        const home = GD.teams.find(t => t.name === ch.challenger_club);
        const away = GD.teams.find(t => t.name === ch.opponent_club);
        if (!home || !away) return { error: 'club missing' };
        const o = ch.orders || {};
        const r = window.__resolveMatch(home, away, o[home.name] || null, o[away.name] || null,
          { pitch: ch.pitch || 'balanced', weather: ch.weather || 'Sunny', ground: home.ground, friendly: true, seed: (Date.parse(ch.play_at) % 2147483647) });
        return { result_text: r.result_text, winner: r.winner_team, mom: r.mom, scorecard: r.scorecard, worm: r.worm, pitch: r.pitch };
      }, { snap: st.snapshot, ch });
      await rpc('challenge_record_result', { p_id: ch.id, p_result: result });
      console.log('challenge', ch.id, 'played:', result.result_text || result.error);
    } catch (e) { console.log('challenge', ch.id, 'error:', e.message); }
  }
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
    await playChallenges(page);
  } finally { await close(); }
}

async function advanceOne(page, st) {
  const lid = st.league_id, round = st.round, snap = st.snapshot;
  const sched = snap && snap.season && snap.season.schedule;

  // Gate to one ROUND per day at 09:00 New York time. The snapshot carries the
  // date of the last resolver advance; updated_at alone is not enough - any
  // client write (a manager joining, a season restart) also bumps it and would
  // silently eat the day's round. Snapshots without the stamp (client-pushed)
  // get a two-hour grace so a freshly started season still has time for orders.
  const now = tzDateHour(new Date());
  const last = tzDateHour(new Date(st.updated_at));
  if (now.hour < MATCH_HOUR) { console.log(lid, `before ${MATCH_HOUR}:00 ${MATCH_TZ}`); return; }
  const advDate = snap && snap.__foAdvDate ? String(snap.__foAdvDate) : null;
  const blocked = advDate
    ? advDate >= now.date
    : (last.date >= now.date && Date.now() - Date.parse(st.updated_at) < 2 * 3600 * 1000);
  if (blocked) { console.log(lid, advDate ? 'already advanced today' : 'fresh client push - waiting out the grace period'); return; }

  // Season over: the next 09:00 runs the engine's own rollover — prize money
  // for every club, age decline, retirements (seeded from the season number,
  // so it is deterministic), then a fresh schedule starting at round 0.
  if (!sched || round >= sched.length) {
    const rolled = await page.evaluate(({ snap }) => {
      window.restoreFrom(snap);
      if (typeof window.mpInit === 'function') window.mpInit();
      window.seasonEnd();
      // the engine pays the snapshot club's prize through its ledger (App.fin);
      // mirror it onto the club record so every manager's fair books agree
      try { var me = userTeam(); if (App.fin && me && App.fin.bank !== me.bank) me.bank = App.fin.bank; } catch (e) {}
      return window.snapshot(true);
    }, { snap });
    rolled.__foAdvDate = now.date;
    await rpc('push_league_state', { p_league_id: lid, p_snapshot: rolled, p_round: 0 });
    console.log(lid, `season rolled over -> season ${rolled.seasonNo || '?'} round 0`);
    return;
  }

  const packets = await rest(`league_packets?league_id=eq.${lid}&round=eq.${round}&select=packet`);

  const newSnap = await page.evaluate(({ snap, pkts }) => {
    window.restoreFrom(snap);
    if (typeof window.mpInit === 'function') window.mpInit();
    // dedupe near-duplicate player names (deterministic; clients run the same
    // pass), then translate any order packet still using a pre-rename name
    if (typeof window.foUniqueNames === 'function') window.foUniqueNames();
    const RN = window.__FO_RENAMES || {};
    const foRemapOrders = (o) => {
      if (!o) return;
      if (Array.isArray(o.batOrder)) o.batOrder = o.batOrder.map((n) => RN[n] || n);
      if (RN[o.captain]) o.captain = RN[o.captain];
      if (RN[o.keeper]) o.keeper = RN[o.keeper];
      if (o.spells) for (const e of ['north', 'south']) (o.spells[e] || []).forEach((sp) => { if (sp && RN[sp.bowler]) sp.bowler = RN[sp.bowler]; });
    };
    // raw packets also carry fo_training / fo_youth club orders for the harness
    window.__FO_PKTS = pkts;
    for (const p of pkts) {
      if (p && typeof p.teamIx === 'number' && p.orders) {
        foRemapOrders(p.orders);
        App.mp.packets[p.teamIx] = { orders: p.orders, round: p.round, club: p.club, manager: p.manager };
      }
    }
    window.completeRound();
    return window.snapshot(true);
  }, { snap, pkts: packets.map(r => r.packet) });

  newSnap.__foAdvDate = now.date;
  const newRound = (newSnap.season && typeof newSnap.season.round === 'number') ? newSnap.season.round : round + 1;
  await rpc('push_league_state', { p_league_id: lid, p_snapshot: newSnap, p_round: newRound });
  console.log(lid, `advanced round ${round} -> ${newRound}`);
}

const isMain = process.argv[1] && process.argv[1].endsWith('round.mjs');
if (isMain) advanceLeagues().catch((e) => { console.error(e); process.exit(1); });
