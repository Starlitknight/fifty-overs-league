// tests/a-country-remembers-where-it-got-to.test.mjs — CONTINUING MUST EQUAL
// STARTING AGAIN.
//
// The living fold replays a country's whole record on every settle. That is
// what makes the world driftless, and it is also work that grows with the age
// of the world and never stops: at a thousand world days one settle of one
// country reads 2,832 banked matches and 6,144 nets sessions, and there are
// sixteen countries and three settles an hour.
//
// So a country now writes down where it got to and folds only the rounds
// since. THE GENESIS FOLD IS NOT GONE - it is what runs with no mark, on a
// version change, or when the record beneath the mark has moved - and it is
// the oracle every test here measures continuation against. That comparison is
// the entire safety argument: a checkpoint that quietly disagrees with genesis
// would corrupt the world slowly and invisibly, and nothing else would catch
// it.
//
// Every test below is the same shape. Fold a world one way, fold it the other,
// and require the two to be the same world.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld } from '../init-world.mjs';
import { makeHost } from '../enginehost.mjs';
import { runDue } from '../tick.mjs';
import { evolveCountry, lastFoldReport, LIVING_VERSION } from '../living.mjs';
import { EPOCH, DAY } from '../clock.mjs';

const DB = 'fockpt_test';
const T0 = EPOCH + 100 * DAY + 12 * 3600000;
const LAST_DAY = 22;                       // enough cricket for real books
let pool, host;

before(async () => {
  try { execSync(`dropdb --if-exists ${DB}`, { stdio: 'ignore' }); } catch (e) {}
  execSync(`createdb ${DB}`);
  process.env.PGDATABASE = DB;
  pool = makePool(); host = makeHost();
  await migrate(pool);
  await initWorld(pool, { now: T0, host });
  for (let d = 1; d <= LAST_DAY; d++) await runDue(pool, host, 'eng', { now: T0 + d * DAY });
});
after(async () => { await pool.end(); });

// SEMANTIC, NOT SERIALISED: jsonb hands documents back with their keys in its
// own order, so two identical worlds are spelled differently.
const canon = v => JSON.stringify(v === undefined ? null : v, (k, val) =>
  (val && typeof val === 'object' && !Array.isArray(val))
    ? Object.keys(val).sort().reduce((o, kk) => { o[kk] = val[kk]; return o; }, {}) : val);

// THE WHOLE OF WHAT A FOLD PRODUCES. Not a sample of it: the squads (skills,
// form, legs, experience, talents), the youth, the nets chart, the worth of
// every eleven, and every man's book and story. If continuation differs from
// genesis anywhere the fold can reach, it differs here.
async function worldOf(country = 'eng') {
  const clubs = (await pool.query(
    `SELECT slot, squad, youth, nets_history, best_xi_strength
       FROM clubs WHERE country_id=$1 ORDER BY slot`, [country])).rows;
  const hist = (await pool.query(
    `SELECT pid, career, intl, mile FROM player_history ORDER BY pid`)).rows;
  return canon({ clubs, hist });
}

const wipe = () => pool.query('DELETE FROM living_checkpoint');
const fold = (at, opts) => evolveCountry(pool, 'eng', T0 + at * DAY, host, opts);

// fold from genesis, with no mark written or read, and return the world
async function genesis(at) {
  await wipe();
  await fold(at, { fromGenesis: true });
  await wipe();                                  // leave no mark behind either
  return worldOf();
}

// ---- THE HEADLINE ----------------------------------------------------------

test('a country folded from a mark is the country folded from genesis', async () => {
  const A = await genesis(LAST_DAY);
  await wipe();
  await fold(10);                                // fold to a mark part way in
  assert.equal(lastFoldReport().checkpoint, 'no checkpoint', 'the first fold has nothing to continue from');
  await fold(LAST_DAY);                          // and continue from it
  assert.equal(lastFoldReport().checkpoint, 'hit', 'the second continued');
  assert.equal(await worldOf(), A, 'continuing lands on the world genesis lands on');
});

// AND AT EVERY BOUNDARY, not one convenient one.
//
// The boundary is a ROUND, and cutting by world DAY barely tests it: rounds are
// prebanked - the umpire simulates a round at its first ball - so a whole season
// can be on the books by the second world day, and a mark cut on day ten then
// has nothing left to read. So the cut is made at every round there is, from
// before any cricket to after all of it, and each one must land on the world
// genesis lands on.
test('the mark may be cut at any round in the record and the world is the same', async () => {
  const A = await genesis(LAST_DAY);
  const top = (await pool.query(
    `SELECT max(season_no) s, max(round) r FROM matches WHERE country_id='eng' AND result IS NOT NULL`)).rows[0];
  assert.ok(top.r >= 8, 'a season of rounds to cut through: ' + top.r);
  let sawWork = 0;
  for (let r = 0; r <= top.r; r++) {
    await wipe();
    await fold(LAST_DAY, { markAt: { s: top.s, r } });   // fold only through round r
    assert.equal(lastFoldReport().through.r, r, 'the mark was cut where it was asked for');
    await fold(LAST_DAY);                                // then read the rest
    const rep = lastFoldReport();
    assert.equal(rep.checkpoint, 'hit', 'round ' + r + ': it did not continue');
    if (rep.replayedMatches > 0) sawWork++;
    assert.equal(await worldOf(), A, 'a mark cut at round ' + r + ' gives a different world');
  }
  // and the sweep really did make it work for its answer, rather than cutting
  // every mark at the end of the record and comparing nothing to nothing
  assert.ok(sawWork >= top.r - 1,
    'only ' + sawWork + ' of ' + (top.r + 1) + ' cuts had cricket left to read');
});

// ---- CONTINUING, AND CONTINUING, AND CONTINUING ----------------------------
//
// One hop proves the arithmetic. Errors that accumulate need many, which is the
// shape the real world runs in: a mark is cut every settle, three times an hour
// forever, and each is built on the one before.
test('a mark built on a mark built on a mark still equals genesis', async () => {
  const A = await genesis(LAST_DAY);
  await wipe();
  for (let d = 1; d <= LAST_DAY; d++) await fold(d);
  assert.equal(await worldOf(), A, 'twenty-two marks in a row drifted from genesis');
  const r = lastFoldReport();
  assert.equal(r.checkpoint, 'hit');
  assert.equal(r.replayedMatches, 0, 'and the last one had nothing new to read');
});

test('and the day-by-day march agrees with genesis at every step, not just the end', async () => {
  await wipe();
  for (let d = 1; d <= LAST_DAY; d++) {
    await fold(d);
    const marched = await worldOf();
    const mark = (await pool.query('SELECT * FROM living_checkpoint')).rows;
    const A = await genesis(d);
    // put the mark back so the march continues from where it was
    await pool.query('DELETE FROM living_checkpoint');
    for (const m of mark) await pool.query(
      `INSERT INTO living_checkpoint(country_id, living_version, through_season, through_round,
         seen_matches, seen_nat, seen_training, state)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [m.country_id, m.living_version, m.through_season, m.through_round,
       m.seen_matches, m.seen_nat, m.seen_training, JSON.stringify(m.state)]);
    assert.equal(marched, A, 'the marched world and the genesis world part company on day ' + d);
  }
});

// ---- IDEMPOTENCE -----------------------------------------------------------

test('settling twice with nothing new reads nothing and changes nothing', async () => {
  await wipe();
  await fold(LAST_DAY);
  const before = await worldOf();
  const mark = canon((await pool.query(
    'SELECT through_season, through_round, seen_matches, state FROM living_checkpoint')).rows);
  const touched = await fold(LAST_DAY);
  const r = lastFoldReport();
  assert.equal(r.checkpoint, 'hit', 'it continued');
  assert.equal(r.replayedMatches, 0, 'and read no new cricket');
  assert.equal(touched, 0, 'so it wrote no squad (Phase 3 still holds)');
  assert.equal(await worldOf(), before, 'and changed nothing');
  assert.equal(canon((await pool.query(
    'SELECT through_season, through_round, seen_matches, state FROM living_checkpoint')).rows), mark,
    'the mark itself is unchanged too');
});

// ---- WHEN THE MARK MUST NOT BE TRUSTED -------------------------------------

test('a mark from another fold version is refused, and genesis rebuilds it', async () => {
  await wipe();
  await fold(LAST_DAY);
  await pool.query('UPDATE living_checkpoint SET living_version = living_version - 1');
  await fold(LAST_DAY);
  assert.match(lastFoldReport().checkpoint, /version/, 'it noticed');
  assert.equal((await pool.query(
    'SELECT living_version c FROM living_checkpoint')).rows[0].c, LIVING_VERSION,
    'and wrote a fresh one at the current version');
});

// THE ONE THAT MATTERS MOST. A watermark alone trusts that the past never
// changes underneath it. A healed day, a repaired card or a hand-edited blob
// would leave the mark describing a record that no longer exists - and the
// continuation would be wrong from then on, quietly, forever.
test('a mark whose record has moved beneath it is refused', async () => {
  await wipe();
  await fold(LAST_DAY);
  const A = await worldOf();
  // delete a match from BELOW the mark: the past is now a different past
  const gone = (await pool.query(
    `SELECT id FROM matches WHERE country_id='eng' AND result IS NOT NULL ORDER BY season_no, round LIMIT 1`
  )).rows[0].id;
  await pool.query('DELETE FROM matches WHERE id=$1', [gone]);
  await fold(LAST_DAY);
  assert.match(lastFoldReport().checkpoint, /beneath the mark has moved/, 'it noticed');
  assert.notEqual(await worldOf(), A, 'and folded the smaller record it actually has');
});

test('a mark that cannot be read at all simply means genesis', async () => {
  await wipe();
  await fold(LAST_DAY);
  const A = await worldOf();
  await pool.query(`UPDATE living_checkpoint SET state = '{"men":"nonsense"}'::jsonb`);
  await fold(LAST_DAY);
  assert.equal(await worldOf(), A, 'a corrupt mark costs a slow settle, never a wrong world');
});

// ---- THE CRASH -------------------------------------------------------------
//
// The mark is written last, so a settle killed part way leaves it BEHIND the
// world and never ahead. Behind is a few rounds read twice; ahead would be
// history nobody ever folds.
test('a settle killed before it marks itself replays, and lands in the same place', async () => {
  const A = await genesis(LAST_DAY);
  await wipe();
  const top = (await pool.query(
    `SELECT max(season_no) s, max(round) r FROM matches WHERE country_id='eng' AND result IS NOT NULL`)).rows[0];
  await fold(LAST_DAY, { markAt: { s: top.s, r: Math.max(0, top.r - 4) } });
  const stale = (await pool.query('SELECT * FROM living_checkpoint')).rows[0];
  await fold(LAST_DAY);                             // world advances, mark advances
  // now simulate the crash: put the OLD mark back, as if the last settle died
  // after writing the clubs but before writing the mark
  await pool.query(
    `UPDATE living_checkpoint SET through_season=$2, through_round=$3,
       seen_matches=$4, seen_nat=$5, seen_training=$6, state=$7::jsonb WHERE country_id=$1`,
    [stale.country_id, stale.through_season, stale.through_round, stale.seen_matches,
     stale.seen_nat, stale.seen_training, JSON.stringify(stale.state)]);
  await fold(LAST_DAY);
  assert.equal(lastFoldReport().checkpoint, 'hit', 'it continued from the older mark');
  assert.ok(lastFoldReport().replayedMatches > 0, 'reading the rounds again');
  assert.equal(await worldOf(), A, 'and landed exactly where genesis lands');
});

// ---- WHAT THE MARK IS ALLOWED TO CONTAIN -----------------------------------

test('the mark is the accumulator, not a copy of the world', async () => {
  await wipe();
  await fold(LAST_DAY);
  const st = (await pool.query('SELECT state FROM living_checkpoint')).rows[0].state;
  assert.ok(Array.isArray(st.men) && st.men.length, 'the men are in it');
  // a man in the mark carries his running totals and nothing about his kit
  const one = st.men.find(m => m.car && m.car.m > 0);
  assert.ok(one, 'somebody with a book');
  assert.deepEqual(Object.keys(one).sort(), ['apps', 'caps', 'car', 'intl', 'mile', 'name', 'slot'],
    'and nothing else: no skills, no rating, no wage, no squad row');
});

// THE APPS TAIL, which is the only lossy thing in the mark and therefore the
// only thing that needs a proof rather than a comparison. Fatigue is a 0.65
// daily decay on a total clamped to 80 and finally rounded, so an afternoon d
// days back can move the answer only while 80 * 0.65^d >= 0.5 - that is d <=
// 12. The mark keeps forty days.
test('the appearances the mark drops could not have changed a thing', async () => {
  const DECAY = 0.35, CEIL = 80;
  const residual = d => CEIL * Math.pow(1 - DECAY, d);
  assert.ok(residual(11) >= 0.5, 'eleven days back can still just move a rounded figure');
  assert.ok(residual(12) < 0.5, 'twelve cannot');
  assert.ok(residual(40) < 1e-5, 'and forty is five orders of magnitude below it: ' + residual(40));
  // and the mark never drops a man below what form reads
  await wipe();
  await fold(LAST_DAY);
  const st = (await pool.query('SELECT state FROM living_checkpoint')).rows[0].state;
  const played = st.men.filter(m => m.caps > 0);
  assert.ok(played.length, 'men who have played');
  for (const m of played) {
    assert.ok(m.apps.length >= Math.min(m.caps, 5),
      m.name + ' kept ' + m.apps.length + ' of ' + m.caps + ' - form reads five');
  }
});

// ---- AND THE MARK DOES NOT GROW WITH THE WORLD -----------------------------

test('the mark stays the same size as the record grows', async () => {
  await wipe();
  await fold(8);
  const early = JSON.stringify((await pool.query('SELECT state FROM living_checkpoint')).rows[0].state).length;
  await fold(LAST_DAY);
  const late = JSON.stringify((await pool.query('SELECT state FROM living_checkpoint')).rows[0].state).length;
  // it grows a little - a story gains lines and a career gains figures - but
  // nowhere near in proportion to the cricket, which is the whole point
  assert.ok(late < early * 3, 'the mark tripled while the record did not: ' + early + ' -> ' + late);
});

// ---- THE MARK IS CUT ABOVE EVERYTHING, NOT ABOVE THE MATCHES ---------------
//
// A club's nets are planned round by round and the plan is banked before the
// round is played, so training_rounds runs AHEAD of the banked cards. A mark
// cut at the last match leaves those sessions above the line - already folded
// into the state, and about to be folded into it again. Every man in a managed
// club then drifts upward one settle at a time.
test('the mark clears the last of every record, not the last match', async () => {
  await wipe();
  await fold(LAST_DAY);
  const mark = (await pool.query('SELECT through_season, through_round FROM living_checkpoint')).rows[0];
  const top = (await pool.query(
    `SELECT max(s) s, max(r) r FROM (
       SELECT max(season_no) s, max(round) r FROM matches WHERE country_id='eng' AND result IS NOT NULL
       UNION ALL SELECT max(season_no), max(round) FROM training_rounds WHERE country_id='eng') x`)).rows[0];
  assert.ok(mark.through_season > top.s ||
    (mark.through_season === top.s && mark.through_round >= top.r),
    'the mark (' + mark.through_season + '/' + mark.through_round + ') is below some record (' +
    top.s + '/' + top.r + ') that has already been folded in');
});

// and the proof of what that bug costs: settle the same evening twice and the
// nets book must be the same book
test('settling one evening twice writes one nets book', async () => {
  await wipe();
  await fold(LAST_DAY);
  const before = (await pool.query(
    `SELECT slot, nets_history FROM clubs WHERE country_id='eng' ORDER BY slot`)).rows;
  await fold(LAST_DAY);
  assert.equal(canon((await pool.query(
    `SELECT slot, nets_history FROM clubs WHERE country_id='eng' ORDER BY slot`)).rows), canon(before),
    'the book grew on a settle that worked no new sessions');
});
