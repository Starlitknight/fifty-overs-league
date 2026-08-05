// tests/world-friendly-broadcast.test.mjs — A FRIENDLY IS A BROADCAST.
//
// The umpire plays every accepted friendly; the reading side used to expect
// the browser to re-simulate it, and no longer worked. Now the friendly
// follows the league round's ritual, and the obligations are:
//   1. the umpire banks the match AT THE TEAMSHEET LOCK (T-1h), not at the
//      hour - so the broadcast can start on the named hour exactly;
//   2. before the first ball the commentary is sealed (log null), though the
//      fixture (names, hour) is served;
//   3. from the first ball the whole ball-by-ball serves, and the feed page
//      paces the reveal;
//   4. the result line stays sealed until the broadcast has shown the last
//      ball - first ball + 18s a delivery - then serves;
//   5. a banked friendly is never played twice.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld } from '../init-world.mjs';
import { makeHost } from '../enginehost.mjs';
import { runFriendlies } from '../tick.mjs';
import { EPOCH, DAY } from '../clock.mjs';

const DBNAME = 'foworld_frbroadcast_test';
let pool, host, fid;
const T0 = EPOCH + 100 * DAY + 12 * 3600000;             // day 100, noon
const PLAY = EPOCH + 101 * DAY + 18 * 3600000;           // day 101, 18:00
const LOCK = PLAY - 3600000;

async function rpc(fn, args, nowMs) {
  const c = await pool.connect();
  try {
    if (nowMs != null) await c.query(`SELECT set_config('world.now_ms', $1, false)`, [String(nowMs)]);
    const r = await c.query(`SELECT public.${fn}($1) AS j`, args);
    return r.rows[0].j;
  } finally {
    await c.query(`SELECT set_config('world.now_ms', '', false)`).catch(() => {});
    c.release();
  }
}

before(async () => {
  try { execSync('dropdb --if-exists ' + DBNAME); } catch {}
  execSync('createdb ' + DBNAME);
  process.env.PGDATABASE = DBNAME;
  pool = makePool();
  await migrate(pool);
  host = makeHost();
  await initWorld(pool, { now: T0, host });
  // an accepted friendly between two bot clubs, named for tomorrow evening
  const r = await pool.query(
    `INSERT INTO friendlies(challenger, opponent, c_country, c_slot, c_name, o_country, o_slot, o_name, status, play_at_ms)
     SELECT $1, NULL, 'eng', 1, h.name, 'eng', 2, a.name, 'accepted', $2
       FROM clubs h, clubs a
      WHERE h.country_id='eng' AND h.slot=1 AND a.country_id='eng' AND a.slot=2
     RETURNING id`, [randomUUID(), PLAY]);
  fid = r.rows[0].id;
});
after(async () => { await pool.end(); });

test('the umpire banks at the teamsheet lock, and never twice', async () => {
  // well before the lock: nothing is due
  assert.deepEqual(await runFriendlies(pool, host, { now: LOCK - 30 * 60000 }), [], 'nothing due before the lock');
  // at the lock (the :04 cron after it, in truth): the match banks
  const played = await runFriendlies(pool, host, { now: LOCK + 4 * 60000 });
  assert.deepEqual(played.map(Number), [Number(fid)], 'banked at the lock');
  const f = (await pool.query('SELECT status, result FROM friendlies WHERE id=$1', [fid])).rows[0];
  assert.equal(f.status, 'played');
  assert.ok(f.result && f.result.text, 'a full card is banked');
  const l = (await pool.query(`SELECT log FROM match_logs WHERE match_id=$1`, ['fr:' + fid])).rows[0];
  assert.ok(l && Array.isArray(l.log) && l.log.length > 100, 'the ball-by-ball rides the commentary bank');
  assert.deepEqual(await runFriendlies(pool, host, { now: LOCK + 30 * 60000 }), [], 'a banked friendly is never replayed');
});

test('the commentary is sealed until the first ball, then serves whole', async () => {
  const before9 = await rpc('world_friendly_log', [fid], PLAY - 20 * 60000);
  assert.equal(before9.log, null, 'sealed before the first ball');
  assert.equal(before9.home.name, (await pool.query(`SELECT name FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].name);
  assert.equal(Number(before9.playAtMs), PLAY, 'the hour is public');
  const after9 = await rpc('world_friendly_log', [fid], PLAY + 1000);
  assert.ok(Array.isArray(after9.log) && after9.log.length > 100, 'served from the first ball');
});

test('the result line keeps the broadcast clock', async () => {
  const l = (await pool.query(`SELECT log FROM match_logs WHERE match_id=$1`, ['fr:' + fid])).rows[0];
  const deliveries = l.log.filter(e => (e.no || '') !== '' && !e._top && !e.intro).length;
  const doneMs = PLAY + Math.min(deliveries, 600) * 18000;
  const mid = await rpc('world_friendly_detail', [fid], PLAY + 60000);
  assert.equal(mid.text, null, 'the result is sealed mid-broadcast');
  const early = await rpc('world_friendly_detail', [fid], doneMs - 2000);
  assert.equal(early.text, null, 'still sealed two seconds before the last ball is shown');
  const done = await rpc('world_friendly_detail', [fid], doneMs + 1000);
  assert.ok(done.text && done.text.length > 5, 'the result serves the moment the reveal completes: ' + done.text);
});
