// tick.mjs — the umpire. Settles every due, unsettled round for every
// country (P1: England), idempotently and crash-safely.
//
// Idempotency design (BLUEPRINT law 4):
//   - one ticks row per (country, world-day) is the idempotency key;
//     status 'done' short-circuits re-runs entirely.
//   - each match INSERT is its own transaction with the fixture UNIQUE
//     constraint + ON CONFLICT DO NOTHING: a tick killed mid-round leaves
//     the completed matches persisted; the re-run replays only the gap
//     (and replaying an already-persisted match writes nothing).
//   - money and standings derive from the matches table, never incremented
//     imperatively, so partial runs can never double-pay.
//   - recovery for a tick that never fired: runDue() walks every unsettled
//     day from the season's start to now — a dead cron is healed by the
//     next invocation, however late.
import { makePool } from './db.mjs';
import { makeHost, ENGINE_VERSION } from './enginehost.mjs';
import { dayIx, daySettled, seedOf, ROUNDS } from './clock.mjs';

export function matchId(country, seasonNo, round, h, a) {
  return country + ':s' + seasonNo + ':r' + round + ':h' + h + 'a' + a;
}

async function playRound(pool, host, country, season, round, opts) {
  const fixtures = season.schedule[round - 1];
  const clubs = (await pool.query('SELECT slot, name, ground, squad FROM clubs WHERE country_id=$1 ORDER BY slot', [country])).rows;
  const bySlot = Object.fromEntries(clubs.map(c => [c.slot, c]));
  let played = 0;
  for (let i = 0; i < fixtures.length; i++) {
    if (opts && opts.failAfter != null && played >= opts.failAfter) throw new Error('injected-crash');
    const [hs, as] = fixtures[i];
    const id = matchId(country, season.season_no, round, hs, as);
    const exists = await pool.query('SELECT 1 FROM matches WHERE id=$1', [id]);
    if (exists.rowCount) continue;
    const home = bySlot[hs], away = bySlot[as];
    const seed = seedOf(id);
    const resultJson = host.runMatch({ name: home.name, players: home.squad }, { name: away.name, players: away.squad }, 'balanced', seed);
    if (!resultJson) throw new Error('engine failed to complete ' + id);
    await pool.query(
      `INSERT INTO matches(id, country_id, season_no, round, home_slot, away_slot, seed, engine_version, pitch, orders, result, result_canonical)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'{}'::jsonb,$10::jsonb,$11::text) ON CONFLICT (id) DO NOTHING`,
      [id, country, season.season_no, round, hs, as, seed, ENGINE_VERSION, 'balanced', resultJson, resultJson]);
    played++;
  }
  return played;
}

// standings derived purely from persisted matches — re-runnable, never drifts
export async function rebuildSnapshots(pool, country, now) {
  const season = (await pool.query('SELECT * FROM seasons WHERE country_id=$1 ORDER BY season_no DESC LIMIT 1', [country])).rows[0];
  const clubs = (await pool.query('SELECT slot, name, ground, is_boss FROM clubs WHERE country_id=$1 ORDER BY slot', [country])).rows;
  const ms = (await pool.query('SELECT * FROM matches WHERE country_id=$1 AND season_no=$2 ORDER BY round, id', [country, season.season_no])).rows;
  const T = Object.fromEntries(clubs.map(c => [c.slot, { slot: c.slot, name: c.name, boss: c.is_boss, p: 0, w: 0, l: 0, t: 0, pts: 0, rf: 0, ra: 0, of: 0, oa: 0 }]));
  const results = [];
  for (const m of ms) {
    const r = m.result, i1 = r.innings[0], i2 = r.innings[1];
    const bySlot = { [m.home_slot]: null, [m.away_slot]: null };
    const slotOf = nm => clubs.find(c => c.name === nm)?.slot;
    for (const inn of [i1, i2]) {
      if (!inn) continue;
      const bs = slotOf(inn.batTeam), os = slotOf(inn.bowlTeam);
      if (bs == null || os == null) continue;
      T[bs].p += 0; // played counted once below
      T[bs].rf += inn.runs; T[bs].of += inn.wkts >= 10 ? 50 : inn.legal / 6;
      T[os].ra += inn.runs; T[os].oa += inn.wkts >= 10 ? 50 : inn.legal / 6;
    }
    for (const s of [m.home_slot, m.away_slot]) T[s].p++;
    if (r.winner === null) { T[m.home_slot].t++; T[m.away_slot].t++; T[m.home_slot].pts++; T[m.away_slot].pts++; }
    else { const ws = slotOf(r.winner); if (ws != null) { T[ws].w++; T[ws].pts += 2; T[ws === m.home_slot ? m.away_slot : m.home_slot].l++; } }
    results.push({ id: m.id, round: m.round, home: clubs.find(c => c.slot === m.home_slot).name, away: clubs.find(c => c.slot === m.away_slot).name, winner: r.winner, text: r.text, seed: String(m.seed), engineVersion: m.engine_version });
  }
  const table = Object.values(T).map(x => ({ ...x, nrr: x.of && x.oa ? +(x.rf / x.of - x.ra / x.oa).toFixed(3) : 0 }))
    .sort((a, b) => b.pts - a.pts || b.nrr - a.nrr || a.slot - b.slot);
  const league = { country, seasonNo: season.season_no, startDay: season.start_day, rounds: ROUNDS, roundsPlayed: ms.length ? Math.max(...ms.map(m => m.round)) : 0, table, results, generatedAtDay: dayIx(now) };
  await pool.query(`INSERT INTO snapshots(key, body, updated_at) VALUES ($1,$2,now())
    ON CONFLICT (key) DO UPDATE SET body=EXCLUDED.body, updated_at=now()`, ['league/' + country, JSON.stringify(league)]);
  const today = { day: dayIx(now), engineVersion: ENGINE_VERSION, countries: [{ id: country, seasonNo: season.season_no, roundsPlayed: league.roundsPlayed, leader: table[0] ? table[0].name : null }] };
  await pool.query(`INSERT INTO snapshots(key, body, updated_at) VALUES ('world/today',$1,now())
    ON CONFLICT (key) DO UPDATE SET body=EXCLUDED.body, updated_at=now()`, [JSON.stringify(today)]);
  return league;
}

export async function runTick(pool, host, country, day, { now = Date.now(), failAfter = null } = {}) {
  const key = country + ':day:' + day;
  const claim = await pool.query(
    `INSERT INTO ticks(key, status) VALUES ($1,'running')
     ON CONFLICT (key) DO UPDATE SET key=EXCLUDED.key RETURNING status`, [key]);
  if (claim.rows[0].status === 'done') return { skipped: true };
  const season = (await pool.query('SELECT * FROM seasons WHERE country_id=$1 ORDER BY season_no DESC LIMIT 1', [country])).rows[0];
  if (!season) throw new Error('no season for ' + country);
  const round = day - season.start_day + 1;
  let played = 0;
  if (round >= 1 && round <= ROUNDS) played = await playRound(pool, host, country, season, round, { failAfter });
  await rebuildSnapshots(pool, country, now);
  await pool.query(`UPDATE ticks SET status='done', finished_at=now(), detail=$2 WHERE key=$1`,
    [key, JSON.stringify({ round: round >= 1 && round <= ROUNDS ? round : null, played })]);
  return { skipped: false, round, played };
}

// heal any gap: settle every due day since the season began
export async function runDue(pool, host, country, { now = Date.now(), failAfter = null } = {}) {
  const season = (await pool.query('SELECT * FROM seasons WHERE country_id=$1 ORDER BY season_no DESC LIMIT 1', [country])).rows[0];
  if (!season) return [];
  const out = [];
  for (let day = season.start_day; day <= dayIx(now); day++) {
    if (!daySettled(now, day, country)) break;
    if (day - season.start_day + 1 > ROUNDS) break;
    out.push({ day, ...(await runTick(pool, host, country, day, { now, failAfter })) });
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pool = makePool();
  runDue(pool, makeHost(), 'eng').then(r => {
    console.error(r.length ? r.map(x => 'day ' + x.day + (x.skipped ? ' (already done)' : ' round ' + x.round + ': ' + x.played + ' played')).join('\n') : 'nothing due');
    return pool.end();
  }).catch(e => { console.error(e); process.exit(1); });
}
