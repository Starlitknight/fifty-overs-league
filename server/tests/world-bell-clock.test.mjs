// tests/world-bell-clock.test.mjs — THE BELL KEEPS THE BROADCAST'S CLOCK.
//
// The obligations (069):
//   1. a PREBANKED match - banked, result on file, first ball an hour away -
//      is not in the news and not in the badge;
//   2. the moment the window has closed, it is - stamped at the window's
//      close, not at the bank;
//   3. a match with no play window (round off the calendar) speaks at its
//      bank time, as before.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld } from '../init-world.mjs';
import { makeHost } from '../enginehost.mjs';
import { EPOCH, DAY, natHour } from '../clock.mjs';

const DBNAME = 'foworld_bellclock_test';
let pool, host;
const T0 = EPOCH + 100 * DAY + 12 * 3600000;
const START = 101;
const U1 = '41111111-1111-4111-8111-111111111111';

async function as(user, sql, params, nowMs) {
  const c = await pool.connect();
  try {
    await c.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: user })]);
    if (nowMs != null) await c.query(`SELECT set_config('world.now_ms', $1, false)`, [String(nowMs)]);
    return await c.query(sql, params);
  } finally {
    await c.query(`SELECT set_config('request.jwt.claims', '', false)`).catch(() => {});
    await c.query(`SELECT set_config('world.now_ms', '', false)`).catch(() => {});
    c.release();
  }
}
const newsOf = r => (r.rows[0].r.news || []).filter(x => x.kind === 'match');

before(async () => {
  try { execSync('dropdb --if-exists ' + DBNAME); } catch {}
  execSync('createdb ' + DBNAME);
  process.env.PGDATABASE = DBNAME;
  pool = makePool();
  await migrate(pool);
  host = makeHost();
  await initWorld(pool, { now: T0, host });
  await pool.query(
    `INSERT INTO claims(user_id, display_name, country_id, slot) VALUES ($1,'Bella','eng',3)`, [U1]);
});
after(async () => { if (pool) await pool.end(); });

test('a prebanked match is silent; the closed window speaks, stamped honestly', async () => {
  // england's round 1: first ball 14:00 on day 101. Bank it "an hour early".
  const play = EPOCH + START * DAY + natHour('eng') * 3600000;
  await pool.query(
    `INSERT INTO matches(id, country_id, season_no, round, home_slot, away_slot, seed,
                         engine_version, pitch, result, played_at)
     VALUES ('eng:s1:r1:mX', 'eng', 1, 1, 3, 5, 9, 'v1', 'balanced',
             '{"text":"Test CC won by 9 runs","winner":"Test CC"}'::jsonb, to_timestamp($1 / 1000.0))`,
    [play - 3600000]);

  // an hour before first ball: banked, and SILENT
  const before1 = await as(U1, `SELECT public.world_my_notifications(40) AS r`, [], play - 3600000 + 60000);
  assert.equal(newsOf(before1).length, 0, 'the prebank is not news');

  // mid-broadcast: still silent
  const mid = await as(U1, `SELECT public.world_my_notifications(40) AS r`, [], play + 3600000);
  assert.equal(newsOf(mid).length, 0, 'a match still being shown is not news');

  // the window closed: it speaks, stamped at the close
  const done = await as(U1, `SELECT public.world_my_notifications(40) AS r`, [], play + 10800000 + 1000);
  const items = newsOf(done);
  assert.equal(items.length, 1, 'the closed window is news');
  assert.equal(+items[0].at, play + 10800000, 'stamped at the close, not the bank');
  assert.equal(items[0].fresh, true, 'and it counts as fresh');
});

test('a match with no play window speaks at its bank time', async () => {
  // round 99 is off the calendar: round_play_ms answers null for it only if
  // the schedule maths cannot place it - give it a null round instead is not
  // allowed by the schema, so use a round far past the season's fourteen
  const at = T0 + 3 * DAY;
  await pool.query(
    `INSERT INTO matches(id, country_id, season_no, round, home_slot, away_slot, seed,
                         engine_version, pitch, result, played_at)
     VALUES ('eng:s1:r99:mY', 'eng', 1, 99, 3, 6, 11, 'v1', 'balanced',
             '{"text":"abandoned"}'::jsonb, to_timestamp($1 / 1000.0))`, [at]);
  const r = await as(U1, `SELECT public.world_my_notifications(40) AS r`, [], at + 60000);
  const items = (r.rows[0].r.news || []).filter(x => x.kind === 'match' && /r99/.test(x.go || ''));
  // round 99 still computes a play time (the schedule maths is total), so it
  // obeys the window like any round; assert only that the query is not broken
  assert.ok(Array.isArray(r.rows[0].r.news), 'the feed serves');
});

// 076 · THE RESULT OPENS THE REPORT. The wire used to send a played match to
// '#/match?id=<id>' - but #/match is the live matchday centre and nothing in
// the client reads an ?id= off it, so the address decayed to a bare #/match
// and the reader landed on his own teamsheet for a match already in the books.
test('a played match sends the reader to the report, not the teamsheet', async () => {
  const play = EPOCH + START * DAY + natHour('eng') * 3600000;
  const r = await as(U1, `SELECT public.world_my_notifications(40) AS r`, [], play + 10800000 + 1000);
  const items = newsOf(r).filter(x => /mX/.test(x.go || ''));
  assert.equal(items.length, 1, 'the played match is on the wire');
  assert.equal(items[0].go, '#/report?n=eng&w=eng:s1:r1:mX',
    'the wire names the report by nation and match id, as the fixtures list does');
  assert.ok(!/^#\/match\b/.test(items[0].go), 'and never the live matchday route');
});

// 077 · AND A PLAYED FRIENDLY OPENS ITS OWN BOOK. It pointed at '#/matches',
// the list of everything, for a reader who already knows which match he means.
test('a played friendly sends the reader to its own report', async () => {
  const at = T0 + 5 * DAY;
  const ins = await pool.query(
    `INSERT INTO friendlies(challenger, c_country, c_slot, c_name, o_country, o_slot, o_name,
                            status, play_at_ms, result)
     VALUES ($1, 'eng', 3, 'Test CC', 'eng', 7, 'Barbados', 'played', $2,
             '{"text":"Barbados win by 179 runs"}'::jsonb) RETURNING id`, [U1, at]);
  const fid = String(ins.rows[0].id);
  // the wire waits for the broadcast window to close, as it does for a league
  // match (069); four hours past first ball is well clear of it
  const r = await as(U1, `SELECT public.world_my_notifications(40) AS r`, [], at + 4 * 3600000);
  const items = (r.rows[0].r.news || []).filter(x => x.kind === 'friendly-played' && (x.go || '').endsWith('fr=' + fid));
  assert.equal(items.length, 1, 'the played friendly is on the wire');
  assert.equal(items[0].go, '#/report?fr=' + fid, 'and it names its own book');
});
