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
import { EPOCH, DAY, dayIx, seedOf } from '../clock.mjs';

const DBNAME = 'foworld_test';
let pool, host;
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

test('runDue heals a tick that never fired at all', async () => {
  // days 103 and 104 pass with no cron; one late invocation settles both
  const out = await runDue(pool, host, 'eng', { now: afterPlay(104) });
  const fresh = out.filter(x => !x.skipped);
  assert.deepEqual(fresh.map(x => x.round), [3, 4]);
  const n = await pool.query('SELECT count(*)::int AS n FROM matches');
  assert.equal(n.rows[0].n, 20);
});

test('GOLDEN MASTER: server-persisted result is byte-identical to a re-sim from seed + squads', async () => {
  const m = (await pool.query("SELECT * FROM matches WHERE round=1 ORDER BY id LIMIT 1")).rows[0];
  const clubs = (await pool.query('SELECT slot, name, squad FROM clubs')).rows;
  const home = clubs.find(c => c.slot === m.home_slot), away = clubs.find(c => c.slot === m.away_slot);
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
  assert.equal(a.table.reduce((s, r) => s + r.p, 0), 40, '4 rounds x 10 club-entries');
  assert.equal(a.roundsPlayed, 4);
});

test('the season advances one round per day without anyone online', async () => {
  const out = await runDue(pool, host, 'eng', { now: afterPlay(110) });
  const fresh = out.filter(x => !x.skipped);
  assert.deepEqual(fresh.map(x => x.round), [5, 6, 7, 8, 9, 10]);
  const snap = (await pool.query("SELECT body FROM snapshots WHERE key='league/eng'")).rows[0].body;
  assert.equal(snap.roundsPlayed, 10);
});
