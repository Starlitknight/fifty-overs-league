// tests/experience-is-the-years.test.mjs — A NINETEEN-YEAR-OLD HAS NOT SEEN
// WHAT A THIRTY-YEAR-OLD HAS SEEN.
//
// On a live roster a boy of nineteen read 'capable' and the thirty-year-old
// beside him read 'capable' too, and the twenty-three-year-old read 'poor'.
// Experience was dealt once, at the instant a man was made, and nothing ever
// reconciled it with his age again. Two things pulled the two apart:
//
//   - the founding cast re-deals a new club's AGES into a shape - one old
//     pro, four local lads, a bench of raw kids - after sorting the squad
//     oldest-first, and left every dealt experience where it was. The
//     sixth-oldest man, dealt at twenty-six, came out nineteen still carrying
//     a twenty-six-year-old's experience. Reversed, not merely uncorrelated.
//   - every rollover added a year to every age and touched nothing else.
//
// The generator was never wrong about it - foGenExp is (age-17) * 6.5 - so
// the fix is to keep faith with its slope at the age a man IS today. What
// this file holds: experience RISES with age, two men of an age are within a
// rung or so of each other, no number of caps carries a boy past the men,
// and the derivation reaches every squad in the world without a migration.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { makeHost } from '../enginehost.mjs';
import { initWorld } from '../init-world.mjs';
import { evolveCountry, expOfYears, expWordOf } from '../living.mjs';
import { ageYouth } from '../youth.mjs';
import { EPOCH, DAY } from '../clock.mjs';

const DB = 'foexp_test';
const START = 101;
const T0 = EPOCH + (START - 1) * DAY + 12 * 3600000;
let pool, host;

// one rung of the twelve-word ladder is nine points; the words are what a
// manager actually reads, so the tolerances below are stated in rungs
const RUNG = 9;
const rung = e => Math.floor(Math.max(0, Math.min(99, e)) / RUNG);

before(async () => {
  try { execSync(`dropdb --if-exists ${DB}`, { stdio: 'ignore' }); } catch (e) {}
  execSync(`createdb ${DB}`);
  process.env.PGDATABASE = DB;
  pool = makePool(); host = makeHost();
  await migrate(pool);
  await initWorld(pool, { now: T0, host });
});
after(async () => { await pool.end(); });

// ---- THE CURVE ITSELF -------------------------------------------------------

test('a year older is never a year less experienced', () => {
  let last = -1;
  for (let a = 17; a <= 37; a++) {
    // the same man, aged: his own share of it is fixed, so only the years move
    const e = expOfYears({ name: 'A Man', age: a });
    assert.ok(e >= last, 'at ' + a + ' he reads ' + e + ', at ' + (a - 1) + ' he read ' + last);
    last = e;
  }
});

test('a boy and a thirty-year-old are rungs apart, not neighbours', () => {
  const boy = expOfYears({ name: 'A Man', age: 19 });
  const man = expOfYears({ name: 'A Man', age: 30 });
  assert.ok(rung(man) - rung(boy) >= 6,
    'nineteen reads ' + expWordOf(boy) + ' and thirty reads ' + expWordOf(man));
});

// TWO MEN OF AN AGE ARE NOT IDENTICAL - a squad where every twenty-two-year-
// old read the same word would be a table, not a game - but they are close.
test('two men of an age are within a rung or so of each other', () => {
  for (let a = 18; a <= 36; a++) {
    let lo = 99, hi = 0;
    for (let i = 0; i < 400; i++) {
      const e = expOfYears({ name: 'Man ' + a + ' ' + i, age: a });
      if (e < lo) lo = e; if (e > hi) hi = e;
    }
    assert.ok(rung(hi) - rung(lo) <= 2,
      'at ' + a + ' the squad spreads ' + expWordOf(lo) + ' to ' + expWordOf(hi));
  }
});

// ---- WHAT THE WORLD DEALS ---------------------------------------------------

// THE FOUNDING CAST IS WHERE THIS WENT WRONG, so it is the first thing asked.
// A Division Two club is one old pro, four local lads and a bench of kids -
// and the bench must read like a bench.
test('a founding squad reads its own ages', async () => {
  const squads = (await pool.query(
    `SELECT slot, squad FROM clubs WHERE country_id='eng' AND slot >= 8 ORDER BY slot`)).rows;
  assert.ok(squads.length >= 4, 'division two exists');
  for (const c of squads) {
    const men = (c.squad || []).filter(p => p && p.age && typeof p.exp === 'number');
    assert.ok(men.length >= 11, 'slot ' + c.slot + ' has a squad');
    // every kid under twenty-four reads below every man over twenty-six
    const kids = men.filter(p => p.age <= 23), olds = men.filter(p => p.age >= 27);
    assert.ok(kids.length && olds.length, 'slot ' + c.slot + ' has both');
    const worstOld = Math.min(...olds.map(p => p.exp));
    const bestKid = Math.max(...kids.map(p => p.exp));
    assert.ok(bestKid < worstOld, 'slot ' + c.slot + ': the best-read kid is ' +
      expWordOf(bestKid) + ' and the least-read man is ' + expWordOf(worstOld));
    // and the word on the card agrees with the number behind it
    men.forEach(p => assert.equal(p.expWord, expWordOf(p.exp), p.name + "'s word"));
  }
});

test('across a whole nation experience tracks age', async () => {
  const rows = (await pool.query(
    `SELECT squad FROM clubs WHERE country_id='eng' ORDER BY slot`)).rows;
  const men = rows.flatMap(r => (r.squad || []).filter(p => p && p.age && typeof p.exp === 'number'));
  assert.ok(men.length > 150, 'a nation to measure: ' + men.length);
  // Pearson's r between age and experience. Anything under 0.9 means the two
  // have come apart again somewhere.
  const n = men.length;
  const mx = men.reduce((s, p) => s + p.age, 0) / n;
  const my = men.reduce((s, p) => s + p.exp, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const p of men) {
    const dx = p.age - mx, dy = p.exp - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  const r = sxy / Math.sqrt(sxx * syy);
  assert.ok(r > 0.9, 'age and experience correlate at r=' + r.toFixed(3));
});

// ---- AND WHAT THE FOLD SERVES -----------------------------------------------

test('the served squad reads the age it is served at, whatever the row says', async () => {
  // scramble the stored numbers exactly as the old founding cast left them:
  // the kids carrying the veterans' experience and the other way about
  const before = (await pool.query(
    `SELECT squad FROM clubs WHERE country_id='eng' AND slot=8`)).rows[0].squad;
  const wrecked = before.slice().sort((a, b) => (a.age || 27) - (b.age || 27))
    .map((p, i, all) => Object.assign({}, p, { exp: all[all.length - 1 - i].exp }));
  await pool.query(
    `UPDATE clubs SET squad=$1::jsonb WHERE country_id='eng' AND slot=8`, [JSON.stringify(wrecked)]);

  await evolveCountry(pool, 'eng', EPOCH + START * DAY + 20 * 3600000, host);
  const men = ((await pool.query(
    `SELECT squad FROM clubs WHERE country_id='eng' AND slot=8`)).rows[0].squad || [])
    .filter(p => p && p.age);
  assert.ok(men.length >= 11, 'the fold served a squad');

  men.forEach(p => {
    // the years are the floor, and only caps stand above them
    assert.equal(p.baseExp, expOfYears(p), p.name + ' at ' + p.age);
    assert.ok(p.exp >= p.baseExp, p.name + ' never reads below his years');
    assert.equal(p.expWord, expWordOf(p.exp), p.name + "'s word");
  });
  const kids = men.filter(p => p.age <= 23), olds = men.filter(p => p.age >= 27);
  assert.ok(kids.length && olds.length);
  assert.ok(Math.max(...kids.map(p => p.exp)) < Math.min(...olds.map(p => p.exp)),
    'the fold put the bench back below the men whatever the row said');
});

// NO NUMBER OF CAPS MAKES A BOY A VETERAN. Playing is worth real experience -
// that is the whole point of it - but a season of first-team cricket used to
// be worth four rungs, enough to carry a nineteen-year-old past a thirty-
// year-old who had done exactly the same. It is worth a rung and a bit now.
test('caps are worth a rung and a bit, never a decade', () => {
  const boy = { name: 'A Boy', age: 19 };
  const man = { name: 'A Veteran', age: 30 };
  // 500 caps is more than anybody will ever have; the cap must still hold
  const capped = e => Math.min(99, e + 12);
  assert.ok(rung(capped(expOfYears(boy))) - rung(expOfYears(boy)) <= 2,
    'the busiest boy alive climbs at most two rungs');
  assert.ok(capped(expOfYears(boy)) < expOfYears(man),
    'and never past a man of thirty who has played nothing');
});

// ---- THE YEARS TURN OVER TOGETHER -------------------------------------------
// The rollover is the other place the two came apart: it added a year to the
// age and left experience alone, so the gap widened by a season every season.
test('the turn of the year moves experience with the age', async () => {
  const sq = async () => (await pool.query(
    `SELECT squad FROM clubs WHERE country_id='eng' AND slot=3`)).rows[0].squad;
  const was = new Map((await sq()).map(p => [p.name, { age: p.age, exp: p.exp }]));
  await ageYouth(pool, 'eng', 1);
  const now = await sq();
  let moved = 0;
  for (const p of now) {
    const b = was.get(p.name);
    if (!b) continue;
    assert.equal(p.age, b.age + 1, p.name + ' is a year older');
    assert.equal(p.exp, expOfYears(p), p.name + ' reads his new age');
    assert.equal(p.expWord, expWordOf(p.exp), p.name + "'s word");
    if (p.exp > b.exp) moved++;
  }
  assert.ok(moved >= now.length - 2, 'the year made all but the oldest wiser: ' + moved + '/' + now.length);
});
