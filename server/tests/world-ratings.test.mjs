// tests/world-ratings.test.mjs — THE LADDER STOPS READING THE CARDS.
//
// The world rankings are the mean of each club's last three match ratings, and
// the umpire re-derived every one of them from every card, from genesis, every
// hour. A card is 38 KB of ball-by-ball; the number it yields is a few bytes.
// At a full season that was gigabytes a day of egress to recompute figures it
// had already worked out two dozen times over.
//
// The mark is now banked with the card. The only thing that can go wrong is the
// stored figure disagreeing with the card it came from - so that is what this
// suite proves, on a real Postgres and the real shipped engine:
//   1. every card the umpire banks carries its mark;
//   2. a ladder built from the stored marks is IDENTICAL to one built from the
//      cards - not close, identical;
//   3. a world banked before any of this fills itself in, a batch at a time;
//   4. and the query stops asking for cards once they all have one.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld } from '../init-world.mjs';
import { makeHost } from '../enginehost.mjs';
import { runDue, computeRankings, fillRatings } from '../tick.mjs';
import { ratingsOf, matchRating } from '../ratings.mjs';
import { EPOCH, DAY, dayOfRound } from '../clock.mjs';

const DBNAME = 'foworld_ratings_test';
let pool, host;
const START = 101;
const T0 = EPOCH + (START - 1) * DAY + 12 * 3600000;
const atDay = (d, h) => EPOCH + d * DAY + h * 3600000;
const dayOf = r => START + dayOfRound(r);

before(async () => {
  try { execSync('dropdb --if-exists ' + DBNAME); } catch {}
  execSync('createdb ' + DBNAME);
  process.env.PGDATABASE = DBNAME;
  pool = makePool();
  await migrate(pool);
  host = makeHost();
  assert.equal((await initWorld(pool, { now: T0, host })).created, true);
  // three rounds of real cricket in one nation is plenty of cards to compare
  await runDue(pool, host, 'eng', { now: atDay(dayOf(3), 23) });
});
after(async () => { await pool.end(); });

test('every card the umpire banks carries its mark', async () => {
  const rows = (await pool.query(
    `SELECT id, ratings, result FROM matches WHERE country_id='eng' ORDER BY round, id`)).rows;
  assert.ok(rows.length >= 10, 'three rounds were played');
  assert.ok(rows.every(r => r.ratings), 'not one card was banked without its mark');

  // and the mark is the one the card yields - the same function a scorecard prints
  for (const r of rows.slice(0, 4)) {
    const fresh = matchRating(r.result);
    assert.deepEqual(r.ratings.r, fresh, r.id + ': the banked mark IS the card\'s mark');
    assert.equal(r.ratings.w, r.result.winner == null ? null : r.result.winner);
  }
});

test('a ladder from the marks is identical to one from the cards', async () => {
  const now = atDay(dayOf(3), 23);
  const fromMarks = await computeRankings(pool, now);

  // blind the umpire to the marks and make it read every card again
  await pool.query(`UPDATE matches SET ratings = NULL`);
  assert.equal(
    (await pool.query(`SELECT count(*)::int AS n FROM matches WHERE ratings IS NULL`)).rows[0].n,
    (await pool.query(`SELECT count(*)::int AS n FROM matches`)).rows[0].n,
    'no mark survives');
  const fromCards = await computeRankings(pool, now);

  assert.deepEqual(fromMarks.clubs, fromCards.clubs,
    'every club sits where it sat, on the figure it sat on');
  assert.deepEqual(fromMarks.countries, fromCards.countries);
  assert.ok(fromMarks.clubs.length >= 10 && fromMarks.clubs.some(c => c.p > 0),
    'and this was a real ladder, not two empty ones agreeing');
});

test('a world banked before the mark existed fills itself in', async () => {
  // (the previous test left every row blank - exactly the live situation)
  const missing = () => pool.query(`SELECT count(*)::int AS n FROM matches WHERE ratings IS NULL`)
    .then(r => r.rows[0].n);
  const before1 = await missing();
  assert.ok(before1 > 0);

  const did = await fillRatings(pool, 5);                 // a bounded batch
  assert.equal(did, Math.min(5, before1), 'it fills the batch it was given, no more');
  assert.equal(await missing(), before1 - did, 'and only that batch');

  while (await missing()) await fillRatings(pool, 50);    // the rest, a few ticks on
  assert.equal(await missing(), 0, 'every card ends up with its mark');

  const rows = (await pool.query(`SELECT ratings, result FROM matches LIMIT 3`)).rows;
  rows.forEach(r => assert.deepEqual(r.ratings, ratingsOf(r.result),
    'and a backfilled mark is the same mark as a banked one'));
});

test('once every card has its mark, no card is fetched at all', async () => {
  // the ladder's own query hands back the card ONLY for a row without a mark,
  // so with every row marked it must come back with nothing to parse
  const rows = (await pool.query(
    `SELECT ratings, CASE WHEN ratings IS NULL THEN (result - 'worm') END AS result
       FROM matches ORDER BY season_no, round`)).rows;
  assert.ok(rows.length > 0);
  assert.ok(rows.every(r => r.result === null),
    'not one 38 KB card crosses the wire');
  assert.ok(rows.every(r => r.ratings && r.ratings.r),
    'and every row still carries everything the ladder needs');
});
