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
import { EPOCH, DAY, dayIx, seedOf, CYCLE, ROUNDS, roundOfDay, dayOfRound } from '../clock.mjs';

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

test('fake-clock tick settles exactly one round of five matches', async () => {
  const res = await runTick(pool, host, 'eng', 101, { now: afterPlay(101) });
  assert.equal(res.skipped, false);
  assert.equal(res.round, 1);
  assert.equal(res.played, 5);
  const n = await pool.query('SELECT count(*)::int AS n FROM matches');
  assert.equal(n.rows[0].n, 5);
});

test('re-running a done tick is a no-op (idempotency key)', async () => {
  const res = await runTick(pool, host, 'eng', 101, { now: afterPlay(101) });
  assert.equal(res.skipped, true);
  const n = await pool.query('SELECT count(*)::int AS n FROM matches');
  assert.equal(n.rows[0].n, 5);
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
  assert.equal(res.played, 3, 're-run played only the gap');
  const full = await pool.query("SELECT count(*)::int AS n FROM matches WHERE round=2");
  assert.equal(full.rows[0].n, 5);
  const dupes = await pool.query(
    'SELECT country_id, season_no, round, home_slot, away_slot, count(*) FROM matches GROUP BY 1,2,3,4,5 HAVING count(*)>1');
  assert.equal(dupes.rowCount, 0, 'no duplicate fixtures anywhere');
});

test('runDue heals a tick that never fired at all, and rests on the rest day', async () => {
  // days 103 and 104 pass with no cron; one late invocation settles both.
  // Season 1 opens on day 101, so 103 is round 3 and 104 is the block's REST
  // DAY - no round, no matches, and the day still marked done.
  const out = await runDue(pool, host, 'eng', { now: afterPlay(104) });
  const fresh = out.filter(x => !x.skipped);
  assert.deepEqual(fresh.map(x => x.round), [3, null], 'round 3, then the rest day');
  const n = await pool.query('SELECT count(*)::int AS n FROM matches');
  assert.equal(n.rows[0].n, 15, 'three rounds of five matches - the rest day added none');
});

test('GOLDEN MASTER: server-persisted result is byte-identical to a re-sim from seed + squads', async () => {
  const m = (await pool.query("SELECT * FROM matches WHERE round=1 ORDER BY id LIMIT 1")).rows[0];
  const home = genesisSquads.find(c => c.slot === m.home_slot);
  const away = genesisSquads.find(c => c.slot === m.away_slot);
  const fresh = makeHost();  // a brand-new engine VM, as a client would boot
  const resim = fresh.runMatch({ name: home.name, players: home.squad }, { name: away.name, players: away.squad }, m.pitch, Number(m.seed));
  assert.equal(resim, m.result_canonical, 'byte-identical replay of the canonical string');
  assert.deepEqual(JSON.parse(resim), m.result, 'semantically identical to the queryable jsonb');
  assert.equal(Number(m.seed), seedOf(m.id), 'seed derives from match id');
  assert.equal(m.engine_version, 'v1', 'engine version stamped');
});

test('standings snapshot derives purely from matches (re-run stable)', async () => {
  const a = await rebuildSnapshots(pool, 'eng', afterPlay(104));
  const b = await rebuildSnapshots(pool, 'eng', afterPlay(104));
  assert.deepEqual(a.table, b.table);
  assert.equal(a.table.reduce((s, r) => s + r.p, 0), 30, '3 rounds x 10 club-entries');
  assert.equal(a.roundsPlayed, 3);
});

test('the season advances THREE ROUNDS THEN A DAY OFF without anyone online', async () => {
  // days 105-110 are days-in-season 4-9: rounds 4, 5, 6, then the rest day
  // that closes the second block, then rounds 7 and 8. The calendar's shape,
  // asserted from the outside.
  const out = await runDue(pool, host, 'eng', { now: afterPlay(110) });
  const fresh = out.filter(x => !x.skipped);
  assert.deepEqual(fresh.map(x => x.round), [4, 5, 6, null, 7, 8]);
  const snap = (await pool.query("SELECT body FROM snapshots WHERE key='league/eng'")).rows[0].body;
  assert.equal(snap.roundsPlayed, 8);
});

test('the calendar is 30 days: 18 rounds in six blocks, then the closing week', async () => {
  const seen = [];
  for (let di = 0; di < CYCLE; di++) seen.push(roundOfDay(di));
  assert.equal(seen.filter(r => r !== null).length, ROUNDS, 'eighteen match days');
  assert.equal(seen.filter(r => r === null).length, CYCLE - ROUNDS, 'twelve days without league cricket');
  assert.deepEqual(seen.slice(0, 8), [1, 2, 3, null, 4, 5, 6, null], 'three on, one off');
  for (let r = 1; r <= ROUNDS; r++) {
    assert.equal(roundOfDay(dayOfRound(r)), r, 'round ' + r + ' maps to its day and back');
  }
  // and the first three days are what they always were, so a world mid-season
  // when the calendar changed keeps every result it had already played
  assert.deepEqual([roundOfDay(0), roundOfDay(1), roundOfDay(2)], [1, 2, 3]);
});
