// comps.mjs — THE INVITATIONALS
//
// Competitions managers make themselves. One founds it, names it, picks a cup
// or a round robin at four clubs or eight, and other managers join. Three
// world days later enrolment closes and the umpire takes over.
//
// The law that governs everything else here governs this: once it starts,
// nobody has to be awake. Empty seats are filled with bot clubs so a half-
// subscribed competition still gets played; the sides are the squads as they
// stand, autopicked by the engine exactly as an absent manager's would be;
// and a round settles a day, on the real engine, idempotently.
//
// The draw, the results, the table and the champion are all derived. The only
// stored decisions are who founded what and who joined.
import { dayIx, seedOf } from './clock.mjs';

export const OPEN_DAYS = 3;

// the circle method, same construction the leagues use: n-1 rounds, every
// club meeting every other exactly once
export function roundRobin(n) {
  const idx = Array.from({ length: n }, (_, i) => i), rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      const a = idx[i], b = idx[n - 1 - i];
      pairs.push(r % 2 ? [b, a] : [a, b]);
    }
    rounds.push(pairs);
    idx.splice(1, 0, idx.pop());                 // rotate, seat 0 fixed
  }
  return rounds;
}
// a knockout bracket's first round: top seat plays bottom seat inward
export function bracket(n) {
  const pairs = [];
  for (let i = 0; i < n / 2; i++) pairs.push([i, n - 1 - i]);
  return pairs;
}
export function roundsOf(format, size) {
  return format === 'league' ? size - 1 : Math.log2(size);
}
export function compMatchId(compId, round, gi) {
  return 'comp:' + compId + ':r' + round + ':g' + gi;
}

// ---------------------------------------------------------------------------
// ENROLMENT CLOSES. Whoever is in is in, and the umpire makes the numbers up
// from bot clubs - deterministically, so a re-run fills the same seats with
// the same clubs. A competition nobody but the founder joined still gets
// played; that is the point of filling it.
// ---------------------------------------------------------------------------
export async function closeEnrolment(pool, now = Date.now()) {
  const today = dayIx(now);
  const due = (await pool.query(
    `SELECT * FROM comps WHERE status='open' AND open_until_day <= $1 ORDER BY id`, [today])).rows;
  const started = [];
  for (const cp of due) {
    const seats = (await pool.query(
      'SELECT * FROM comp_clubs WHERE comp_id=$1 ORDER BY seat', [cp.id])).rows;
    // free bot clubs anywhere in the world, in a fixed order, minus anyone
    // already seated - then taken in a shuffle keyed to the competition, so
    // the field is stable across re-runs but not the same nine clubs every time
    const taken = new Set(seats.map(s => s.country_id + ':' + s.slot));
    const pool0 = (await pool.query(
      `SELECT cl.country_id, cl.slot, cl.name FROM clubs cl
         LEFT JOIN claims c ON c.country_id=cl.country_id AND c.slot=cl.slot
        WHERE c.user_id IS NULL ORDER BY cl.country_id, cl.slot`)).rows
      .filter(r => !taken.has(r.country_id + ':' + r.slot));
    const ranked = pool0
      .map(r => ({ r, k: seedOf('fill|' + cp.id + '|' + r.country_id + '|' + r.slot) }))
      .sort((a, b) => a.k - b.k || (a.r.country_id < b.r.country_id ? -1 : 1))
      .map(x => x.r);
    let seat = seats.length, fi = 0;
    while (seat < cp.size && fi < ranked.length) {
      const b = ranked[fi++];
      await pool.query(
        `INSERT INTO comp_clubs(comp_id, seat, country_id, slot, name, user_id)
         VALUES ($1,$2,$3,$4,$5,NULL) ON CONFLICT DO NOTHING`,
        [cp.id, seat, b.country_id, b.slot, b.name]);
      seat++;
    }
    const n = (await pool.query('SELECT count(*)::int AS n FROM comp_clubs WHERE comp_id=$1', [cp.id])).rows[0].n;
    if (n < cp.size) continue;                    // the world is too small; wait
    await pool.query(
      `UPDATE comps SET status='running', start_day=$2, rounds=$3 WHERE id=$1 AND status='open'`,
      [cp.id, today + 1, roundsOf(cp.format, cp.size)]);
    started.push(cp.id);
  }
  return started;
}

// who is playing whom in a given round, from the draw and what has been won
async function fixturesFor(pool, cp, round) {
  const seats = (await pool.query(
    'SELECT * FROM comp_clubs WHERE comp_id=$1 ORDER BY seat', [cp.id])).rows;
  if (cp.format === 'league') {
    const rr = roundRobin(cp.size)[round - 1] || [];
    return rr.map(([a, b]) => [seats[a], seats[b]]);
  }
  if (round === 1) return bracket(cp.size).map(([a, b]) => [seats[a], seats[b]]);
  // a later cup round pairs the winners of the previous one, in order
  const prev = (await pool.query(
    'SELECT * FROM comp_matches WHERE comp_id=$1 AND round=$2 ORDER BY gi', [cp.id, round - 1])).rows;
  if (prev.length < 2) return [];
  const bySeat = Object.fromEntries(seats.map(s => [s.seat, s]));
  const through = prev.map(m => {
    const w = m.result && m.result.winner;
    // a tie in a knockout goes to the higher seat, which is what a seeding is for
    if (w === m.a_name) return bySeat[m.a_seat];
    if (w === m.b_name) return bySeat[m.b_seat];
    return bySeat[Math.min(m.a_seat, m.b_seat)];
  });
  const out = [];
  for (let i = 0; i < through.length; i += 2) if (through[i + 1]) out.push([through[i], through[i + 1]]);
  return out;
}

// ---------------------------------------------------------------------------
// A ROUND A DAY, on the real engine, from the squads as they stand. No orders
// and no lineups: the same autopick an absent manager gets in his league.
// ---------------------------------------------------------------------------
export async function playComps(pool, host, engineVersion, now = Date.now()) {
  const today = dayIx(now);
  const running = (await pool.query(
    `SELECT * FROM comps WHERE status='running' ORDER BY id`)).rows;
  const played = [];
  for (const cp of running) {
    const due = Math.min(cp.rounds, today - cp.start_day + 1);
    for (let round = 1; round <= due; round++) {
      const fx = await fixturesFor(pool, cp, round);
      for (let gi = 0; gi < fx.length; gi++) {
        const [A, B] = fx[gi];
        if (!A || !B) continue;
        const id = compMatchId(cp.id, round, gi);
        if ((await pool.query('SELECT 1 FROM comp_matches WHERE id=$1', [id])).rowCount) continue;
        const sq = async s => (await pool.query(
          'SELECT name, squad FROM clubs WHERE country_id=$1 AND slot=$2', [s.country_id, s.slot])).rows[0];
        const a = await sq(A), b = await sq(B);
        if (!a || !b) continue;
        const seed = seedOf(id);
        const resultJson = host.runMatch(
          { name: a.name, players: a.squad }, { name: b.name, players: b.squad }, 'balanced', seed, null);
        if (!resultJson) throw new Error('engine failed to complete ' + id);
        await pool.query(
          `INSERT INTO comp_matches(id, comp_id, round, gi, a_seat, b_seat, a_name, b_name,
                                    seed, engine_version, result, result_canonical)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::text) ON CONFLICT (id) DO NOTHING`,
          [id, cp.id, round, gi, A.seat, B.seat, a.name, b.name, seed, engineVersion, resultJson, resultJson]);
        played.push(id);
      }
    }
    // finished? crown it
    if (due >= cp.rounds) {
      const last = (await pool.query(
        'SELECT * FROM comp_matches WHERE comp_id=$1 AND round=$2 ORDER BY gi', [cp.id, cp.rounds])).rows;
      const want = cp.format === 'league' ? cp.size / 2 : 1;
      if (last.length >= want) {
        const table = await computeComp(pool, cp.id);
        await pool.query(`UPDATE comps SET status='done', champion=$2 WHERE id=$1 AND status='running'`,
          [cp.id, table.champion]);
      }
    }
  }
  return played;
}

// ---------------------------------------------------------------------------
// THE CARD, derived from the banked results alone: a table for a round robin,
// a bracket for a cup, and whoever ends up holding it.
// ---------------------------------------------------------------------------
export async function computeComp(pool, compId) {
  const cp = (await pool.query('SELECT * FROM comps WHERE id=$1', [compId])).rows[0];
  if (!cp) return null;
  const seats = (await pool.query(
    'SELECT * FROM comp_clubs WHERE comp_id=$1 ORDER BY seat', [compId])).rows;
  const ms = (await pool.query(
    'SELECT * FROM comp_matches WHERE comp_id=$1 ORDER BY round, gi', [compId])).rows;
  const T = Object.fromEntries(seats.map(s => [s.seat,
    { seat: s.seat, name: s.name, country: s.country_id, managed: !!s.user_id,
      p: 0, w: 0, l: 0, t: 0, pts: 0, rf: 0, ra: 0, of: 0, oa: 0 }]));
  const results = [];
  for (const m of ms) {
    const r = m.result;
    const seatOf = nm => nm === m.a_name ? m.a_seat : nm === m.b_name ? m.b_seat : null;
    for (const inn of (r.innings || [])) {
      if (!inn) continue;
      const bs = seatOf(inn.batTeam), os = seatOf(inn.bowlTeam);
      if (bs == null || os == null || !T[bs] || !T[os]) continue;
      T[bs].rf += inn.runs; T[bs].of += inn.wkts >= 10 ? 50 : inn.legal / 6;
      T[os].ra += inn.runs; T[os].oa += inn.wkts >= 10 ? 50 : inn.legal / 6;
    }
    if (T[m.a_seat]) T[m.a_seat].p++;
    if (T[m.b_seat]) T[m.b_seat].p++;
    const ws = r.winner == null ? null : seatOf(r.winner);
    if (ws == null) { [m.a_seat, m.b_seat].forEach(s => { if (T[s]) { T[s].t++; T[s].pts++; } }); }
    else if (T[ws]) {
      T[ws].w++; T[ws].pts += 2;
      const lo = ws === m.a_seat ? m.b_seat : m.a_seat; if (T[lo]) T[lo].l++;
    }
    const sideOf = s2 => {
      const inn = (r.innings || []).find(x => x && seatOf(x.batTeam) === s2);
      if (!inn) return null;
      return { r: inn.runs, w: inn.wkts, ov: Math.floor(inn.legal / 6) + '.' + (inn.legal % 6) };
    };
    results.push({ id: m.id, round: m.round, gi: m.gi, a: m.a_name, b: m.b_name,
      as: sideOf(m.a_seat), bs: sideOf(m.b_seat),
      winner: ws == null ? null : T[ws] && T[ws].name, text: r.text });
  }
  const table = Object.values(T).map(x => ({ ...x, nrr: x.of && x.oa ? +(x.rf / x.of - x.ra / x.oa).toFixed(3) : 0 }))
    .sort((a, b) => b.pts - a.pts || b.nrr - a.nrr || a.seat - b.seat);
  const roundsPlayed = ms.length ? Math.max(...ms.map(m => m.round)) : 0;
  let champion = null;
  if (cp.format === 'league') {
    if (roundsPlayed >= (cp.rounds || 0) && table[0] && table[0].p) champion = table[0].name;
  } else {
    const fin = results.filter(x => x.round === (cp.rounds || 0));
    if (fin.length === 1 && fin[0].winner) champion = fin[0].winner;
  }
  return {
    id: cp.id, name: cp.name, format: cp.format, size: cp.size, status: cp.status,
    rounds: cp.rounds, roundsPlayed, startDay: cp.start_day, opensUntil: cp.open_until_day,
    clubs: seats.map(s => ({ seat: s.seat, name: s.name, country: s.country_id, managed: !!s.user_id })),
    table, results, champion: champion || cp.champion || null
  };
}

// the whole shelf, plus a card apiece, in one snapshot a phone can read
export async function rebuildComps(pool) {
  const ids = (await pool.query(
    `SELECT id FROM comps WHERE status <> 'open' ORDER BY id DESC LIMIT 40`)).rows.map(r => r.id);
  const cards = [];
  for (const id of ids) { const c = await computeComp(pool, id); if (c) cards.push(c); }
  const body = { comps: cards };
  await pool.query(`INSERT INTO snapshots(key, body, updated_at) VALUES ('comps',$1,now())
    ON CONFLICT (key) DO UPDATE SET body=EXCLUDED.body, updated_at=now()`, [JSON.stringify(body)]);
  return cards.length;
}

// one call for the umpire: close what is due, play what is due, rebuild
export async function runComps(pool, host, engineVersion, now = Date.now()) {
  const started = await closeEnrolment(pool, now);
  const played = await playComps(pool, host, engineVersion, now);
  if (started.length || played.length) await rebuildComps(pool);
  return { started, played };
}
