// tests/world-pitch.test.mjs — THE HOME CLUB CALLS THE PITCH.
//
// Conditions were the weather's business. The nation's climate and the home
// groundsman's leaning dealt every fixture a surface, and the umpire bowled on
// exactly what the fixtures page promised - which meant the one lever every
// home captain in cricket actually pulls was the one a manager did not have.
//
// Migration 083 hands it over, under three rules, and these hold all three:
//
//   HIS OWN GROUND. A call is written under the caller's own club and read
//   under the HOST's. A call for somebody else's home match is not rejected,
//   it is simply a row nothing ever looks at - which is why this needs no
//   fixture table to check against.
//
//   TWO DAYS' NOTICE. A square takes days to prepare, and a pitch chosen the
//   night before is a trick played on a side that has already picked its
//   spinners. The deadline counts from round_play_ms, the same first ball the
//   teamsheet lock counts from, so the two can never drift apart.
//
//   SAID ONCE. The primary key is the match. A groundsman told to prepare a
//   green top and then a turner on Wednesday prepares neither.
//
// And the point of all of it: the umpire must actually bowl on it, and the
// card must say so.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld } from '../init-world.mjs';
import { makeHost } from '../enginehost.mjs';
import { runDue } from '../tick.mjs';
import { EPOCH, DAY, dayOfRound, scheduleOf } from '../clock.mjs';

const DBNAME = 'foworld_pitch_test';
const U = '77777777-7777-4777-8777-777777777777';
const START = 101;
const T0 = EPOCH + (START - 1) * DAY + 12 * 3600000;
const atDay = (d, h) => EPOCH + d * DAY + h * 3600000;
const dayOf = r => START + dayOfRound(r);

let pool, host;
// the caller's own claim, exactly as a phone reaches the RPC
async function rpc(sql, args, user = U) {
  const c = await pool.connect();
  try {
    await c.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: user })]);
    return await c.query(sql, args);
  } finally {
    await c.query(`SELECT set_config('request.jwt.claims', '', false)`).catch(() => {});
    c.release();
  }
}
// the world's clock, pinned, for the length of one statement
async function atNow(ms, sql, args, user = U) {
  const c = await pool.connect();
  try {
    await c.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: user })]);
    await c.query(`SELECT set_config('world.now_ms', $1, false)`, [String(ms)]);
    return await c.query(sql, args);
  } finally {
    await c.query(`SELECT set_config('world.now_ms', '', false)`).catch(() => {});
    await c.query(`SELECT set_config('request.jwt.claims', '', false)`).catch(() => {});
    c.release();
  }
}

// the rounds this slot is at home in division one's draw, in order
function homeRounds(country, seasonNo, slot) {
  const out = [];
  const sched = scheduleOf(country, seasonNo, [0, 1, 2, 3, 4, 5, 6, 7], 1);
  sched.forEach((rd, i) => rd.forEach(f => { if (f[0] === slot) out.push(i + 1); }));
  return out;
}

before(async () => {
  try { execSync('dropdb --if-exists ' + DBNAME); } catch {}
  execSync('createdb ' + DBNAME);
  process.env.PGDATABASE = DBNAME;
  pool = makePool();
  await migrate(pool);
  host = makeHost();
  await initWorld(pool, { now: T0, host });
  // a manager in Division One, so his home rounds come off the same draw the
  // umpire schedules with
  await pool.query(
    `INSERT INTO claims(user_id, display_name, country_id, slot, levelled)
     VALUES ($1,'Groundsman','eng',3,true)`, [U]);
});
after(async () => { await pool.end(); });

test('the seven surfaces are the engine own, and nothing else may be called', async () => {
  const kinds = (await pool.query('SELECT world_pitch_kinds() AS k')).rows[0].k;
  assert.deepEqual(kinds, ['balanced', 'flat', 'green', 'dry', 'slow', 'cracked', 'twoPaced'],
    'the shipped client\'s own pitch ids');
  const r = homeRounds('eng', 1, 3)[0];
  await assert.rejects(
    rpc('SELECT public.world_call_pitch($1,$2,$3)', [1, r, 'bouncy']),
    /no groundsman can prepare that/, 'a surface the engine cannot bowl on is refused');
  // and the notice is the same two days the ground page counts down
  assert.equal(Number((await pool.query('SELECT world_pitch_notice() AS n')).rows[0].n), 172800000);
});

test('a call inside forty-eight hours is refused, and the same call outside them stands', async () => {
  const r = homeRounds('eng', 1, 3).find(x => x >= 6);
  const ball = Number((await pool.query('SELECT round_play_ms($1,$2,$3) AS m', ['eng', 1, r])).rows[0].m);

  // an hour late is late
  await assert.rejects(
    atNow(ball - 47 * 3600000, 'SELECT public.world_call_pitch($1,$2,$3)', [1, r, 'dry']),
    /48 hours before the first ball/, 'the square is already being prepared');
  // the instant itself is shut - the boundary belongs to the groundsman
  await assert.rejects(
    atNow(ball - 48 * 3600000, 'SELECT public.world_call_pitch($1,$2,$3)', [1, r, 'dry']),
    /48 hours/, 'the deadline is the deadline');
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM pitch_calls')).rows[0].n, 0,
    'nothing late was written');

  // a minute the right side of it stands
  const ok = (await atNow(ball - 48 * 3600000 - 60000,
    'SELECT public.world_call_pitch($1,$2,$3) AS r', [1, r, 'dry'])).rows[0].r;
  assert.equal(ok.ok, true);
  assert.equal(ok.pitch, 'dry');
  assert.equal(Number(ok.shuts), ball - 172800000, 'the call names the instant it shut');
});

test('a groundsman takes his orders once', async () => {
  const r = homeRounds('eng', 1, 3).find(x => x >= 6);
  const ball = Number((await pool.query('SELECT round_play_ms($1,$2,$3) AS m', ['eng', 1, r])).rows[0].m);
  await assert.rejects(
    atNow(ball - 10 * DAY, 'SELECT public.world_call_pitch($1,$2,$3)', [1, r, 'green']),
    /already has his orders for this match: dry/,
    'the second call is refused by name, so the page can say which one stands');
  const rows = (await pool.query('SELECT pitch FROM pitch_calls WHERE round=$1', [r])).rows;
  assert.deepEqual(rows.map(x => x.pitch), ['dry'], 'and the first one is untouched');
});

test('the board a ground publishes says what is called and when it shuts', async () => {
  const rows = (await pool.query(`SELECT public.world_pitch_calls('eng', 3) AS r`)).rows[0].r;
  assert.equal(rows.length, 1, 'one call standing');
  const r = homeRounds('eng', 1, 3).find(x => x >= 6);
  const ball = Number((await pool.query('SELECT round_play_ms($1,$2,$3) AS m', ['eng', 1, r])).rows[0].m);
  assert.equal(rows[0].round, r);
  assert.equal(rows[0].pitch, 'dry');
  assert.equal(Number(rows[0].shuts), ball - 172800000);
  // a ground that has been told nothing publishes an empty board rather than
  // nothing at all - the page needs to tell those two apart
  assert.deepEqual((await pool.query(`SELECT public.world_pitch_calls('eng', 6) AS r`)).rows[0].r, []);
});

test('the umpire bowls on the called pitch, and the card says so', async () => {
  const r = homeRounds('eng', 1, 3).find(x => x >= 6);
  const forecast = host.condFor('eng', 3, 1, r).pitch;
  assert.notEqual(forecast, 'dry', 'the call is a real departure from what the square would have done');

  await runDue(pool, host, 'eng', { now: atDay(dayOf(r), 23) });
  const rows = (await pool.query(
    `SELECT home_slot, round, pitch FROM matches WHERE country_id='eng' AND round=$1 ORDER BY home_slot`, [r])).rows;
  assert.ok(rows.length >= 4, 'the round was bowled');
  const mine = rows.find(x => x.home_slot === 3);
  assert.ok(mine, 'my club was at home in round ' + r);
  assert.equal(mine.pitch, 'dry', 'the umpire rolled out what was asked for, and banked it');

  // EVERY OTHER GROUND IS UNTOUCHED. One club calling its own square must not
  // move a fixture it has nothing to do with.
  rows.filter(x => x.home_slot !== 3).forEach(x => {
    assert.equal(x.pitch, host.condFor('eng', x.home_slot, 1, r).pitch,
      'slot ' + x.home_slot + ' still plays the forecast');
  });
});

test('a call for a match you do not host is a row nothing ever reads', async () => {
  // the whole security model: a row is written under the CALLER's club and
  // read under the HOST's, so this needs no fixture check to be safe
  const away = homeRounds('eng', 1, 3);
  const r2 = [...Array(12).keys()].map(i => i + 1).find(x => away.indexOf(x) < 0 && x > 8);
  const ball = Number((await pool.query('SELECT round_play_ms($1,$2,$3) AS m', ['eng', 1, r2])).rows[0].m);
  const ok = (await atNow(ball - 5 * DAY,
    'SELECT public.world_call_pitch($1,$2,$3) AS r', [1, r2, 'cracked'])).rows[0].r;
  assert.equal(ok.ok, true, 'the call is accepted - it is his own ground he is preparing');

  await runDue(pool, host, 'eng', { now: atDay(dayOf(r2), 23) });
  const rows = (await pool.query(
    `SELECT home_slot, pitch FROM matches WHERE country_id='eng' AND round=$1`, [r2])).rows;
  assert.ok(!rows.some(x => x.home_slot === 3), 'he really was away that round');
  rows.forEach(x => assert.equal(x.pitch, host.condFor('eng', x.home_slot, 1, r2).pitch,
    'nobody else\'s square moved: slot ' + x.home_slot));
});

test('a world where nobody has called anything plays exactly as it always did', async () => {
  // the guard on the whole change: 083 must be invisible until a manager uses
  // it, or every forecast the fixtures page ever printed becomes a lie
  const rows = (await pool.query(
    `SELECT m.round, m.home_slot, m.pitch FROM matches m
      WHERE m.country_id='eng'
        AND NOT EXISTS (SELECT 1 FROM pitch_calls p
                         WHERE p.country_id=m.country_id AND p.slot=m.home_slot
                           AND p.season_no=m.season_no AND p.round=m.round)`)).rows;
  assert.ok(rows.length >= 20, 'a season of uncalled matches to check (' + rows.length + ')');
  rows.forEach(m => assert.equal(m.pitch, host.condFor('eng', m.home_slot, 1, m.round).pitch,
    'round ' + m.round + ' slot ' + m.home_slot + ' played the forecast'));
});

test('an unclaimed stranger cannot prepare a square', async () => {
  await assert.rejects(
    rpc('SELECT public.world_call_pitch($1,$2,$3)', [1, 12, 'flat'],
      '88888888-8888-4888-8888-888888888888'),
    /claim a club first/);
});
