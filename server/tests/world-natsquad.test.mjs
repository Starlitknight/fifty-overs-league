// tests/world-natsquad.test.mjs — EVERY NATION HAS A SIDE, ALL SEASON.
//
// What was wrong: a national squad existed only on the three window rounds,
// and only for a nation the day's draw had given a fixture to. Ask the game
// "who plays for England?" on any other day of the season and the honest
// answer was nobody - no squad had been named, so no cricketer anywhere could
// be shown as an international.
//
// What these prove:
//   1. a fifteen stands before round one is bowled, for every nation on earth;
//   2. the selectors meet again before every round, on the form the last round
//      produced, and a man can play his way in and out over a season;
//   3. a naming is banked: healing a day re-reads the decision rather than
//      re-taking it on cricket the selectors could not have seen;
//   4. the touring fifteen IS that round's standing fifteen - one selection,
//      so a nation's squad page and its teamsheet cannot disagree;
//   5. the league snapshot carries the side, which is what earns a player his
//      red star on every surface that draws him.
// A real Postgres and the real shipped engine throughout.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld } from '../init-world.mjs';
import { makeHost } from '../enginehost.mjs';
import { runDue, computeLeague } from '../tick.mjs';
import {
  SQUAD_SIZE, CLUB_LIMIT, ensureNatSquad, natSquadNow, computeNations,
  squadPlayers, seasonSquad, isBowler
} from '../nations.mjs';
import { EPOCH, DAY, WINDOWS, dayOfRound } from '../clock.mjs';

const DBNAME = 'foworld_natsquad_test';
let pool, host;
const START = 101;                                  // season 1 opens on world day 101
const T0 = EPOCH + (START - 1) * DAY + 12 * 3600000;
const atDay = (day, hour) => EPOCH + day * DAY + hour * 3600000;
const dayOf = round => START + dayOfRound(round);
const namesOf = list => (list || []).map(m => m.name);

before(async () => {
  try { execSync('dropdb --if-exists ' + DBNAME); } catch {}
  execSync('createdb ' + DBNAME);
  process.env.PGDATABASE = DBNAME;
  pool = makePool();
  await migrate(pool);
  host = makeHost();
  assert.equal((await initWorld(pool, { now: T0, host })).created, true);
});
after(async () => { await pool.end(); });

test('a nation has a side before a ball is bowled', async () => {
  // settle the opening day only: round one has just been played, and the
  // fifteen that stood before it was named off the FOUNDING squads
  await runDue(pool, host, 'eng', { now: atDay(dayOf(1), 23) });
  const squad = await ensureNatSquad(pool, 'eng', 1, 1);
  assert.equal(squad.length, SQUAD_SIZE, 'fifteen, named before round one');
  assert.equal(new Set(namesOf(squad)).size, SQUAD_SIZE, 'fifteen different men');
  assert.ok(squad.some(m => m.keeper), 'a nation without a keeper has no team');
  assert.ok(squad.filter(m => m.bowler).length >= 5, 'and enough men who bowl');
  const per = {};
  squad.forEach(m => { per[m.slot] = (per[m.slot] || 0) + 1; });
  Object.values(per).forEach(n => assert.ok(n <= CLUB_LIMIT, 'no club is gutted'));
  assert.ok(squad.every(m => m.name && m.club && m.rating > 0 && m.fee > 0),
    'every man names himself, his club, what he is and what his club is owed');
  assert.deepEqual(squad.map(m => m.pick), squad.map((_, i) => i),
    'and reads as a side, in the selectors\' own order');
});

test('every nation on earth, not just the ones with a tour', async () => {
  const cs = (await pool.query('SELECT id FROM countries ORDER BY id')).rows;
  assert.equal(cs.length, 19);
  for (const c of cs) {
    await runDue(pool, host, c.id, { now: atDay(dayOf(1), 23) });
    const now = await natSquadNow(pool, c.id, 1);
    assert.equal(now.squad.length, SQUAD_SIZE, c.id + ' has named a side');
    // round one has been played, so the side that STANDS is the one named for
    // round two - the selectors met again the moment the cricket was read in
    assert.equal(now.round, 2, c.id + '\'s side stands going into round two');
    const first = await ensureNatSquad(pool, c.id, 1, 1);
    assert.equal(first.length, SQUAD_SIZE, c.id + ' also named one before round one');
  }
});

test('the selectors meet again before every round', async () => {
  await runDue(pool, host, 'eng', { now: atDay(dayOf(3), 23) });
  const rows = (await pool.query(
    `SELECT round FROM nat_squad WHERE country_id='eng' AND season_no=1 ORDER BY round`)).rows;
  assert.deepEqual(rows.map(r => r.round), [1, 2, 3, 4],
    'a naming for every round played, plus the one about to be played - not ' +
    'one per season, and not one per window');

  // and the meeting is a real one: it reads the form the last round produced,
  // so a side can change. Whether it DOES change is the cricket's business;
  // what must hold is that the selectors were free to.
  const now = await natSquadNow(pool, 'eng', 1);
  assert.equal(now.round, 4, 'three rounds played, so the side stands for the fourth');
  assert.equal(now.squad.length, SQUAD_SIZE);
  const r2 = (await pool.query(
    `SELECT squad FROM nat_squad WHERE country_id='eng' AND season_no=1 AND round=3`)).rows[0].squad;
  const was = new Set(namesOf(r2)), is = new Set(namesOf(now.squad));
  assert.deepEqual(now.in.slice().sort(), namesOf(now.squad).filter(n => !was.has(n)).sort(),
    'who came in is exactly who was not there last time');
  assert.deepEqual(now.out.slice().sort(), namesOf(r2).filter(n => !is.has(n)).sort(),
    'and who went out is exactly who is no longer there');
  assert.equal(now.in.length, now.out.length, 'a fifteen stays a fifteen');
});

test('a naming is banked: healing a day cannot re-pick it', async () => {
  const before1 = await ensureNatSquad(pool, 'eng', 1, 2);
  // a fortnight of cricket later, ask the selectors for round two again
  await runDue(pool, host, 'eng', { now: atDay(dayOf(6), 23) });
  const after1 = await ensureNatSquad(pool, 'eng', 1, 2);
  assert.deepEqual(namesOf(after1), namesOf(before1),
    'the fifteen that stood before round two is still that fifteen');
});

test('the touring fifteen IS that round\'s standing fifteen', async () => {
  const win = WINDOWS[0];
  await runDue(pool, host, 'eng', { now: atDay(dayOf(win), 23) });
  const standing = await ensureNatSquad(pool, 'eng', 1, win);
  const toured = (await pool.query(
    `SELECT player FROM callups WHERE country_id='eng' AND season_no=1 AND round=$1 ORDER BY pick`,
    [win])).rows.map(r => r.player);
  assert.equal(toured.length, SQUAD_SIZE, 'England toured that window');
  assert.deepEqual(toured, namesOf(standing),
    'one selection, in one order - the squad page and the teamsheet agree');
});

test('the league snapshot carries the side, which is what earns the red star', async () => {
  const lg = await computeLeague(pool, 'eng', 1, atDay(dayOf(WINDOWS[0]), 23));
  assert.ok(lg.nat, 'the snapshot names the nation\'s side');
  assert.equal(lg.nat.squad.length, SQUAD_SIZE);
  assert.ok(lg.nat.round >= 1);
  assert.ok(Array.isArray(lg.nat.in) && Array.isArray(lg.nat.out));
  // a starred man is a real man in a real club in this very table
  const clubs = new Set(lg.table.map(t => t.slot));
  assert.ok(lg.nat.squad.every(m => clubs.has(m.slot)),
    'every international plays for a club in this league');
  const held = (await pool.query(
    `SELECT slot, p->>'name' AS name FROM clubs, jsonb_array_elements(squad) p
      WHERE country_id='eng'`)).rows;
  const onBooks = new Set(held.map(r => r.slot + '|' + r.name));
  assert.ok(lg.nat.squad.every(m => onBooks.has(m.slot + '|' + m.name)),
    'and is on that club\'s books this minute, so the star lands on a real row');
});

test('the nations page shows the standing side, with the tour squad beside it', async () => {
  const na = await computeNations(pool, atDay(dayOf(WINDOWS[0]), 23));
  const e = na.nations.eng;
  const now = await natSquadNow(pool, 'eng', 1);
  assert.equal(e.squad.length, SQUAD_SIZE, 'the side as it stands');
  assert.equal(e.namedBefore, now.round, 'named before the most recent round played');
  assert.deepEqual(namesOf(e.squad), namesOf(now.squad));
  assert.ok(e.changes && Array.isArray(e.changes.in) && Array.isArray(e.changes.out));
  assert.ok(e.squad.every(m => m.club && m.fee > 0));

  // THE TOUR SQUAD IS A DIFFERENT FACT and keeps its own place: the men who
  // actually flew at the last window, whose clubs were paid and who won caps.
  // Weeks of cricket later the standing side may have moved on from it, which
  // is exactly what a living national side does.
  assert.equal(e.window, WINDOWS[0], 'the last window England toured in');
  assert.deepEqual(namesOf(e.tourSquad),
    namesOf(await ensureNatSquad(pool, 'eng', 1, WINDOWS[0])),
    'and it is the side that stood before THAT round');

  // a nation that had the window off still has a side - the whole point
  const off = Object.values(na.nations).find(n => !n.tourSquad.length);
  if (off) assert.equal(off.squad.length, SQUAD_SIZE,
    'a nation with no fixture still has a named fifteen');
});

test('the World Cup side is the side as it stands', async () => {
  const wc = await seasonSquad(pool, 'eng', 1);
  const now = await natSquadNow(pool, 'eng', 1);
  assert.deepEqual(wc.map(p => p.name), namesOf(now.squad),
    'the men their selectors last named are the men who go');
  assert.ok(wc.length >= 11 && wc.some(p => p.keeper) && wc.filter(isBowler).length >= 5,
    'and it is a side that can take the field');
});

test('a world already playing when the selectors arrived is caught up', async () => {
  // EXACTLY THE LIVE CASE. A league had banked rounds before any of this
  // existed, so no naming was ever made for them - and runTick short-circuits
  // on a day it has already settled, so it would never go back and make one.
  // The league would sit there with no side named until its next round came
  // round, telling every manager his country had picked nobody.
  await pool.query(`DELETE FROM nat_squad WHERE country_id='eng'`);
  const played = (await pool.query(
    `SELECT COALESCE(MAX(round),0) AS r FROM matches WHERE country_id='eng' AND season_no=1`)).rows[0].r | 0;
  assert.ok(played >= 1, 'England has banked rounds');
  assert.equal(
    (await pool.query(`SELECT 1 FROM nat_squad WHERE country_id='eng'`)).rowCount, 0,
    'and no side named for any of them');

  // a tick with no new day due - every day is already settled
  const out = await runDue(pool, host, 'eng', { now: atDay(dayOf(played), 23) });
  assert.ok(out.every(x => x.day == null || x.skipped),
    'no cricket was played by this run');

  const now = await natSquadNow(pool, 'eng', 1);
  assert.equal(now.squad.length, SQUAD_SIZE, 'and yet England has a side again');
  assert.equal(now.round, played + 1, 'named for the round it is about to play');

  // and it reached the client, not just the table
  const lg = (await pool.query(
    `SELECT body FROM snapshots WHERE key='league/eng'`)).rows[0].body;
  assert.equal(lg.nat.squad.length, SQUAD_SIZE, 'the published snapshot carries it');
  assert.deepEqual(namesOf(lg.nat.squad), namesOf(now.squad));

  // running again names nothing new: the catch-up is not a treadmill
  const again = await runDue(pool, host, 'eng', { now: atDay(dayOf(played), 23) });
  assert.ok(!again.some(x => x.namedNatSquad), 'a second run has nothing to do');
});
