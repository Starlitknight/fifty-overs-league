// tests/world.test.mjs — the P1 proof obligations, against a real Postgres.
//   createdb foworld_test is handled here; a FAKE CLOCK drives every test.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld } from '../init-world.mjs';
import { makeHost } from '../enginehost.mjs';
import { runTick, runDue, rebuildSnapshots, matchId } from '../tick.mjs';
import { applyLiving } from '../living.mjs';
import { EPOCH, DAY, dayIx, seedOf, CYCLE, ROUNDS, roundOfDay, dayOfRound,
         COLTS_DAYS, PLAYOFF_DAYS, FA_DAYS, CUP_DAYS, TRANSITION_DAY,
         REST_DAYS, isRestDay } from '../clock.mjs';

const DBNAME = 'foworld_test';
let pool, host;
// the eleven that actually walked out in round 1. A season CHANGES men -
// careers, form, tired legs, the work they did in the nets - so a replay has
// to be handed the cricketers of that day, not the cricketers they became.
let genesisSquads;
// the fake clock: world founded the day before season start; time is OURS
const T0 = EPOCH + 100 * DAY + 12 * 3600000;          // day 100, 12:00 UTC
const afterPlay = d => EPOCH + d * DAY + 18 * 3600000; // 18:00 — window closed

before(async () => {
  try { execSync('dropdb --if-exists ' + DBNAME); } catch {}
  execSync('createdb ' + DBNAME);
  process.env.PGDATABASE = DBNAME;
  pool = makePool();
  await migrate(pool);
  host = makeHost();
  const r = await initWorld(pool, { now: T0, host });
  assert.equal(r.created, true);
  assert.equal(r.startDay, 101);
  genesisSquads = (await pool.query('SELECT slot, name, squad FROM clubs')).rows;
});
after(async () => { await pool.end(); });

test('fake-clock tick settles exactly one round: eight matches, both divisions', async () => {
  const res = await runTick(pool, host, 'eng', 101, { now: afterPlay(101) });
  assert.equal(res.skipped, false);
  assert.equal(res.round, 1);
  assert.equal(res.played, 8);
  const n = await pool.query('SELECT count(*)::int AS n FROM matches');
  assert.equal(n.rows[0].n, 8);
});

test('re-running a done tick is a no-op (idempotency key)', async () => {
  const res = await runTick(pool, host, 'eng', 101, { now: afterPlay(101) });
  assert.equal(res.skipped, true);
  const n = await pool.query('SELECT count(*)::int AS n FROM matches');
  assert.equal(n.rows[0].n, 8);
});

test('a tick killed mid-round recovers cleanly on re-run, no double writes', async () => {
  await assert.rejects(
    runTick(pool, host, 'eng', 102, { now: afterPlay(102), failAfter: 2 }),
    /injected-crash/);
  const partial = await pool.query("SELECT count(*)::int AS n FROM matches WHERE round=2");
  assert.equal(partial.rows[0].n, 2, 'crash left exactly the completed matches');
  const tick = await pool.query("SELECT status FROM ticks WHERE key='eng:day:102'");
  assert.equal(tick.rows[0].status, 'running', 'crashed tick still open');
  const res = await runTick(pool, host, 'eng', 102, { now: afterPlay(102) });
  assert.equal(res.skipped, false);
  assert.equal(res.played, 6, 're-run played only the gap');
  const full = await pool.query("SELECT count(*)::int AS n FROM matches WHERE round=2");
  assert.equal(full.rows[0].n, 8);
  const dupes = await pool.query(
    'SELECT country_id, season_no, round, home_slot, away_slot, count(*) FROM matches GROUP BY 1,2,3,4,5 HAVING count(*)>1');
  assert.equal(dupes.rowCount, 0, 'no duplicate fixtures anywhere');
});

test('runDue heals a tick that never fired at all, and rests on the rest day', async () => {
  // days 103 and 104 pass with no cron; one late invocation settles both.
  // Season 1 opens on day 101 (a Monday of the calendar's week), so 103 is
  // the Wednesday international day - no league round - and 104 is round 3.
  const out = await runDue(pool, host, 'eng', { now: afterPlay(104) });
  // A DAY THAT RAN IS NOT THE ONLY THING runDue REPORTS. It also says when it
  // prebanked the day's cards ahead of the window and when the selectors named
  // a national squad - neither of which is a round, and neither of which
  // carries one. Reading every unskipped entry as a round counted those as a
  // nameless extra day; a round is an entry that HAS a round.
  const fresh = out.filter(x => !x.skipped && 'round' in x);
  assert.deepEqual(fresh.map(x => x.round), [null, 3],
    'the rest day, then round 3 - got ' + JSON.stringify(out.map(x => ({ r: x.round, s: x.skipped }))));
  const n = await pool.query('SELECT count(*)::int AS n FROM matches');
  assert.equal(n.rows[0].n, 24, 'three rounds of eight matches - the rest day added none');
});

test('GOLDEN MASTER: server-persisted result is byte-identical to a re-sim from seed + squads', async () => {
  // THE CURRENT ROUND - the only round a broadcast ever replays, and (by
  // design) the only round that still carries its replay blob: the almanack
  // slims older rows to scorecard-only, which is itself asserted below.
  const m = (await pool.query(
    `SELECT * FROM matches WHERE result_canonical IS NOT NULL ORDER BY round DESC, id LIMIT 1`)).rows[0];
  assert.ok(m, 'the freshest round keeps its replay blob');
  const squadOf = async slot => (await pool.query(
    'SELECT name, squad FROM clubs WHERE country_id=$1 AND slot=$2', [m.country_id, slot])).rows[0];
  const home = await squadOf(m.home_slot), away = await squadOf(m.away_slot);
  const fresh = makeHost();  // a brand-new engine VM, as a client would boot
  // the replay reproduces THE MATCH AS PLAYED: the banked pitch, the banked
  // sheets (a bot's doctrine included), the banked living patch and the
  // forecast weather - all deterministic from the row and the world
  const wx = fresh.condFor(m.country_id, m.home_slot, m.season_no, m.round).weather;
  const resim = fresh.runMatch(
    { name: home.name, players: applyLiving(home.squad, m.living[home.name], fresh) },
    { name: away.name, players: applyLiving(away.squad, m.living[away.name], fresh) },
    m.pitch, Number(m.seed), m.orders, wx);
  // THE MATCH, not the paperwork: the canonical blob embeds whole player
  // objects, so its bytes carry harmless noise (a career object rides along
  // and moves on with the men). What must agree is every ball of cricket.
  const facts = j => {
    const o = JSON.parse(j);
    return JSON.stringify({ w: o.winner, t: o.text, m: o.mom,
      i: (o.innings || []).map(inn => inn && ({ bt: inn.batTeam, r: inn.runs, w: inn.wkts, l: inn.legal,
        bat: (inn.bat || []).map(b => [(b.p && b.p.name) || b.p, b.r, b.b, b.out]),
        bowl: Object.entries(inn.bowlers || {}).map(([k, v]) => [k, v.w, v.r, v.b]).sort() })) });
  };
  assert.equal(facts(resim), facts(m.result_canonical), 'every ball of the replay is the banked match');
  assert.equal(Number(m.seed), seedOf(m.id), 'seed derives from match id');
  assert.equal(m.engine_version, 'v2', 'engine version stamped');
  // and the almanack HAS slimmed: rounds behind the current keep the
  // scorecard, not the blob
  const old = (await pool.query(
    `SELECT count(*)::int AS n FROM matches WHERE round < $1 - 1 AND result_canonical IS NOT NULL`,
    [m.round])).rows[0].n;
  assert.equal(old, 0, 'older rounds carry scorecards only');
});

test('standings snapshot derives purely from matches (re-run stable)', async () => {
  const a = await rebuildSnapshots(pool, 'eng', afterPlay(104));
  const b = await rebuildSnapshots(pool, 'eng', afterPlay(104));
  assert.deepEqual(a.table, b.table);
  assert.equal(a.table.reduce((s, r) => s + r.p, 0), 24, '3 rounds x 8 Division One club-entries');
  assert.equal(a.table2.reduce((s, r) => s + r.p, 0), 24, 'and the same again in Division Two');
  assert.equal(a.roundsPlayed, 3);
});

test('the league week is Mon Tue . Thu Fri . Sun-is-cup-day, without anyone online', async () => {
  // days 105-110 are days-in-season 4-9: round 4 (Fri), the Saturday
  // international day, the FA Cup Sunday (no league), then rounds 5 and 6
  // (Mon, Tue) and the Wednesday international day. The calendar's shape,
  // asserted from the outside.
  const out = await runDue(pool, host, 'eng', { now: afterPlay(110) });
  const fresh = out.filter(x => !x.skipped);
  assert.deepEqual(fresh.map(x => x.round), [4, null, null, 5, 6, null]);
  const snap = (await pool.query("SELECT body FROM snapshots WHERE key='league/eng'")).rows[0].body;
  assert.equal(snap.roundsPlayed, 6);
});

test('the calendar is 42 days: six exact weeks, fourteen rounds plus finals', async () => {
  assert.equal(CYCLE, 42, 'a season is six exact weeks, so di % 7 is the weekday forever');
  assert.equal(CYCLE % 7, 0, 'and it must stay a whole number of weeks');
  const seen = [];
  for (let di = 0; di < CYCLE; di++) seen.push(roundOfDay(di));
  // fourteen league days plus the two playoff nights (rounds 15 and 16)
  assert.equal(seen.filter(r => r !== null).length, ROUNDS + 2, 'sixteen days with club cricket');
  assert.deepEqual(seen.slice(0, 8), [1, 2, null, 3, 4, null, null, 5], 'Mon Tue . Thu Fri . Sun');
  // THE QUIET WEEK carries no league cricket at all - the league stands down
  // for week four (once the Colts Week; the cup is retired for now, 075).
  for (const di of [COLTS_DAYS.r16, COLTS_DAYS.qf, COLTS_DAYS.sf, COLTS_DAYS.final]) {
    assert.equal(roundOfDay(di), null, 'day ' + di + ' carries no league cricket');
  }
  assert.deepEqual([seen[21], seen[22], seen[23], seen[24], seen[25], seen[26], seen[27]],
    [null, null, null, null, null, null, null], 'the whole of week four is clear of the league');
  // and the league comes back on the far side of it for its last two rounds
  assert.deepEqual([seen[28], seen[29]], [13, 14], 'rounds 13 and 14 follow the quiet week');
  assert.deepEqual([seen[31], seen[32]], [15, 16], 'playoff semis Thursday, the final Friday');
  for (let r = 1; r <= 16; r++) {
    assert.equal(roundOfDay(dayOfRound(r)), r, 'round ' + r + ' maps to its day and back');
  }
  assert.deepEqual([roundOfDay(0), roundOfDay(1), roundOfDay(2)], [1, 2, null]);
});

// The scouting cadence is one recruit per rest day, so what counts as a rest
// day is a rule a manager plans around - it has to be derived, and it has to
// be the same list on the client. If this number moves, the academy's whole
// economy moves with it.
test('a season has fifteen rest days, and they are derived from the calendar', async () => {
  // the whole quiet week rests since the Colts Cup was retired (075)
  assert.deepEqual(REST_DAYS, [2, 5, 9, 12, 16, 19, 21, 22, 23, 24, 25, 26, 27, 30, 33]);
  for (const di of REST_DAYS) {
    assert.equal(roundOfDay(di), null, 'day ' + di + ' has no league cricket');
    assert.ok(isRestDay(di), 'day ' + di + ' reads as a rest day');
  }
  // no day is both a rest day and a fixture of some other competition
  for (const di of [PLAYOFF_DAYS.final, FA_DAYS.final, CUP_DAYS.final, TRANSITION_DAY]) {
    assert.equal(isRestDay(di), false, 'day ' + di + ' has cricket or the turning of the year on it');
  }
});
