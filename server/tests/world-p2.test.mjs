// tests/world-p2.test.mjs — the P2 proof obligations: the WHOLE planet on
// the real engine, against a real Postgres, on a fake clock.
//
//   1. the world's shape comes from the shipped build (no forked config):
//      19 nations, ten sides each, boss in slot 0, and the server clock's
//      natHour agrees with the client planet's for every nation.
//   2. initWorld founds all 19 leagues in one transaction.
//   3. expandWorld is the P1->P2 in-place upgrade: it founds only missing
//      countries, never touches existing ones, and regenerates byte-identical
//      squads (position-stable seeds).
//   4. one runAllDue settles round 1 in every nation - 95 real engine
//      matches - and world/today aggregates all 19 with leaders and hours.
//   5. a second runAllDue is a complete no-op (idempotency at planet scale).
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld, expandWorld, countryConfigs } from '../init-world.mjs';
import { makeHost } from '../enginehost.mjs';
import { runAllDue } from '../tick.mjs';
import { EPOCH, DAY, natHour } from '../clock.mjs';

const DBNAME = 'foworld_p2_test';
let pool, host;
const T0 = EPOCH + 100 * DAY + 12 * 3600000;            // day 100, 12:00 UTC
// 02:00 on day 102: every nation's day-101 window has closed (latest is the
// 22:00 leagues, whose play ends 01:00 next day), and NO day-102 window has
const ALL_SETTLED = EPOCH + 102 * DAY + 2 * 3600000;

before(async () => {
  try { execSync('dropdb --if-exists ' + DBNAME); } catch {}
  execSync('createdb ' + DBNAME);
  process.env.PGDATABASE = DBNAME;
  pool = makePool();
  await migrate(pool);
  host = makeHost();
});
after(async () => { await pool.end(); });

test('the world shape comes from the shipped build and the clocks agree', () => {
  const cfgs = countryConfigs(host);
  assert.equal(cfgs.length, 19, '19 nations');
  assert.ok(cfgs.some(c => c.id === 'eng'), 'England present');
  for (const c of cfgs) {
    assert.equal(c.clubs.length, 10, c.id + ' seats ten clubs');
    assert.equal(c.clubs.filter(x => x.boss).length, 1, c.id + ' has exactly one boss');
    assert.equal(c.clubs[0].boss, true, c.id + ' boss sits in slot 0');
    assert.equal(natHour(c.id), c.hour, c.id + ': server natHour must equal the shipped client\'s');
  }
  assert.equal(natHour('eng'), 14, 'England is the 14:00 league');
});

test('initWorld founds all 19 leagues', async () => {
  const r = await initWorld(pool, { now: T0, host });
  assert.equal(r.created, true);
  assert.equal(r.startDay, 101);
  assert.equal(r.countries.length, 19);
  const nC = await pool.query('SELECT count(*)::int AS n FROM countries');
  const nK = await pool.query('SELECT count(*)::int AS n FROM clubs');
  const nS = await pool.query('SELECT count(*)::int AS n FROM seasons');
  assert.equal(nC.rows[0].n, 19);
  assert.equal(nK.rows[0].n, 190);
  assert.equal(nS.rows[0].n, 19);
});

test('expandWorld re-founds a missing country with byte-identical squads', async () => {
  const beforeSquads = (await pool.query("SELECT slot, name, squad FROM clubs WHERE country_id='can' ORDER BY slot")).rows;
  assert.equal(beforeSquads.length, 10);
  await pool.query("DELETE FROM seasons WHERE country_id='can'");
  await pool.query("DELETE FROM clubs WHERE country_id='can'");
  await pool.query("DELETE FROM countries WHERE id='can'");
  const x = await expandWorld(pool, { now: T0, host });
  assert.deepEqual(x.added, ['can'], 'only the missing country is founded');
  const afterSquads = (await pool.query("SELECT slot, name, squad FROM clubs WHERE country_id='can' ORDER BY slot")).rows;
  assert.equal(afterSquads.length, 10);
  for (let i = 0; i < 10; i++) {
    assert.equal(afterSquads[i].name, beforeSquads[i].name);
    assert.equal(JSON.stringify(afterSquads[i].squad), JSON.stringify(beforeSquads[i].squad),
      'slot ' + i + ' squad regenerated identically from its stable seed');
  }
  const again = await expandWorld(pool, { now: T0, host });
  assert.deepEqual(again.added, [], 'a complete world expands to nothing');
});

test('one runAllDue settles round 1 across the whole planet', async () => {
  const all = await runAllDue(pool, host, { now: ALL_SETTLED });
  const countries = Object.keys(all);
  assert.equal(countries.length, 19);
  for (const c of countries) {
    const fresh = all[c].filter(x => !x.skipped);
    assert.equal(fresh.length, 1, c + ' settles exactly one day');
    assert.equal(fresh[0].round, 1, c + ' plays round 1');
    assert.equal(fresh[0].played, 5, c + ' plays five matches');
  }
  const n = await pool.query('SELECT count(*)::int AS n FROM matches');
  assert.equal(n.rows[0].n, 95, '19 nations x 5 matches');
  const today = (await pool.query("SELECT body FROM snapshots WHERE key='world/today'")).rows[0].body;
  assert.equal(today.countries.length, 19, 'world/today carries every league');
  for (const c of today.countries) {
    assert.equal(c.roundsPlayed, 1);
    assert.ok(c.leader, c.id + ' has a leader');
    assert.equal(c.hourUtc, natHour(c.id));
  }
  const leagues = await pool.query("SELECT count(*)::int AS n FROM snapshots WHERE key LIKE 'league/%'");
  assert.equal(leagues.rows[0].n, 19, 'one league snapshot per nation');
});

test('a second runAllDue is a planet-wide no-op', async () => {
  const all = await runAllDue(pool, host, { now: ALL_SETTLED });
  for (const c of Object.keys(all)) {
    assert.ok(all[c].every(x => x.skipped), c + ' re-run entirely skipped');
  }
  const n = await pool.query('SELECT count(*)::int AS n FROM matches');
  assert.equal(n.rows[0].n, 95, 'no new matches anywhere');
});

// ONE NATION'S BAD DAY IS NOT THE PLANET'S. A failure settling one country
// used to abort runAllDue outright, so every nation after it in id order
// silently stopped playing - the tail of the alphabet (rsa, sub, usa, wal,
// win, zim) simply never updated while England carried on.
test('a country that fails to settle does not stop the rest of the world', async () => {
  const now = EPOCH + 103 * DAY + 2 * 3600000;   // day 103's windows are all shut
  // a host that refuses to play for one nation only: 'ned' sits fourth in id
  // order, so nine nations come after it
  let broke = 0;
  const flaky = {
    ...host,
    runMatch(home, away, pitch, seed, orders) {
      if (/Haarlem|Amsterdam|Utrecht|Rotterdam|Deventer|Voorburg|Groningen|Eindhoven|Delft|VOC/.test(home.name + away.name)) {
        broke++; throw new Error('injected: the Dutch could not take the field');
      }
      return host.runMatch(home, away, pitch, seed, orders);
    }
  };
  const out = await runAllDue(pool, flaky, { now });
  assert.ok(broke > 0, 'the injected failure genuinely fired');
  assert.ok(out.ned.some(x => x && x.failed), 'the Netherlands is reported as failed');
  const after = ['nzl', 'pak', 'rsa', 'sub', 'zim'];
  for (const c of after) {
    assert.ok(!(out[c] || []).some(x => x && x.failed), c + ' played on regardless');
    const n = (await pool.query(
      'SELECT count(*)::int AS n FROM matches WHERE country_id=$1', [c])).rows[0].n;
    assert.ok(n > 0, c + ' has banked cricket');
  }
  // and the world heals: a good host settles what the bad one missed
  await runAllDue(pool, host, { now });
  const ned = (await pool.query(
    `SELECT count(*)::int AS n FROM matches WHERE country_id='ned'`)).rows[0].n;
  assert.ok(ned > 0, 'the Netherlands played once the trouble passed');
});
