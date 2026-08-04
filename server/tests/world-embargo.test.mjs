// tests/world-embargo.test.mjs — THE BROADCAST EMBARGO, proved.
//
// The umpire banks a round an hour before its first ball (the prebank), so
// the banked cricket exists while the match is still, to every honest eye,
// in the future. Migration 047 makes the two read RPCs keep the broadcast's
// clock. The obligations:
//   1. before the first ball, the commentary refuses - even though the row
//      is banked and inside its seven days;
//   2. from the first ball, the commentary serves in full (the feed page
//      paces the reveal; one fetch is the egress promise);
//   3. the CARD stays sealed while the broadcast is still showing the match
//      - a full scorecard names the winner;
//   4. the card opens at exactly first-ball + deliveries x 18s, the same
//      moment the feed's reveal completes;
//   5. a match with no play window (round null) is history and serves as it
//      always did.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld } from '../init-world.mjs';
import { makeHost } from '../enginehost.mjs';
import { runDue } from '../tick.mjs';
import { EPOCH, DAY, natHour } from '../clock.mjs';

const DBNAME = 'foworld_embargo_test';
let pool, host;
const T0 = EPOCH + 100 * DAY + 12 * 3600000;            // day 100, noon
const START = 101;                                       // initWorld's start day
// England is the 14:00 league; round 1 plays on the season's first day
const PLAY = EPOCH + START * DAY + 14 * 3600000;
const PREBANK = PLAY - 3600000 + 4 * 60000;              // 13:04, the ':4' cron

async function rpc(fn, args, nowMs) {
  const c = await pool.connect();
  try {
    if (nowMs != null) await c.query(`SELECT set_config('world.now_ms', $1, false)`, [String(nowMs)]);
    const r = await c.query(`SELECT public.${fn}($1, $2) AS j`, args);
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
  assert.equal(natHour('eng'), 14, 'the test clock assumes the 14:00 league');
  // the prebank pass: an hour before England's first ball, round 1 banks
  const out = await runDue(pool, host, 'eng', { now: PREBANK });
  assert.ok(out.some(x => x.prebanked > 0), 'round 1 prebanked at 13:04');
});
after(async () => { await pool.end(); });

let mid, deliveries;

test('before the first ball the commentary refuses', async () => {
  const r = await pool.query(`SELECT match_id FROM match_logs WHERE country_id='eng' LIMIT 1`);
  mid = r.rows[0].match_id;
  const j = await rpc('world_match_log', ['eng', mid], PLAY - 30 * 60000);
  assert.equal(j.log, null, 'banked, inside its week - and still sealed at 13:30');
});

test('from the first ball the commentary serves in full', async () => {
  const j = await rpc('world_match_log', ['eng', mid], PLAY + 60000);
  assert.ok(Array.isArray(j.log) && j.log.length > 100, 'the whole book, one fetch');
  deliveries = j.log.filter(e => (e.no || '') !== '' && !e._top && !e.intro).length;
  assert.ok(deliveries > 100 && deliveries <= 700, 'a real match of deliveries: ' + deliveries);
});

test('the card stays sealed while the broadcast is showing the match', async () => {
  const early = await rpc('world_match_card', ['eng', mid], PLAY - 30 * 60000);
  assert.equal(early.card, null, 'no card an hour before the first ball');
  const mid9 = await rpc('world_match_card', ['eng', mid], PLAY + 60000);
  assert.equal(mid9.card, null, 'no card one minute into the broadcast');
});

test('the card opens at the very moment the reveal completes', async () => {
  const doneMs = PLAY + Math.min(deliveries, 600) * 18000;
  const before9 = await rpc('world_match_card', ['eng', mid], doneMs - 1000);
  assert.equal(before9.card, null, 'one second before the last shown ball: sealed');
  const after9 = await rpc('world_match_card', ['eng', mid], doneMs + 1000);
  assert.ok(after9.card && after9.card.innings, 'one second after: the full card');
  const j = await rpc('world_match_log', ['eng', mid], doneMs + 1000);
  assert.ok(Array.isArray(j.log), 'and the commentary still serves');
});

test('a match with no play window serves as it always did', async () => {
  // a copy of the banked match filed under round 17: the calendar stages no
  // round 17, so round_play_ms is null - no window, no embargo
  await pool.query(
    `INSERT INTO matches (id, country_id, season_no, round, home_slot, away_slot, seed, engine_version, pitch, result)
     SELECT 'test:nowindow', country_id, season_no, 17, home_slot, 15, seed, engine_version, pitch, result
       FROM matches WHERE id = $1`, [mid]);
  const j = await rpc('world_match_card', ['eng', 'test:nowindow'], PLAY - 2 * 3600000);
  assert.ok(j.card && j.card.innings, 'calendar-less cricket is history, not a future');
});
