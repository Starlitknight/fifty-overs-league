// world-fee-agrees.test.mjs — ONE SUM, THREE PLACES, NO DRIFT.
//
// What a cricketer is worth is written out three times, because the three
// callers cannot share code: the umpire's arithmetic in server/market.mjs, the
// promise the page makes before the button is pressed in engine 55-market, and
// the plpgsql in migration 065 that actually moves the money. A manager quoted
// one price and paid another is the bug this file exists to prevent, and it is
// the exact bug 061 shipped in a different form.
//
// So this asserts they agree, on the same men, to the pound.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { valueOf, quickSellOf, wageFromRating, ageCurve, FEE_ROUNDS, FEE_MULT } from '../market.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = p => fs.readFileSync(path.join(HERE, '..', '..', p), 'utf8');

// the men the three implementations are compared on: a journeyman, the median,
// a young star with a talent, a veteran of the top percentile, an old great
const MEN = [
  { rating: 19530, age: 24, talents: [] },
  { rating: 25704, age: 27, talents: [] },
  { rating: 35784, age: 22, talents: ['sixMachine'] },
  { rating: 48006, age: 31, talents: [] },
  { rating: 58254, age: 34, talents: ['miser', 'bouncer'] }
];
const withWage = m => ({ ...m, wage: wageFromRating(m.rating, m.talents.length) });

test('the engine and the service derive the same wage from a rating', () => {
  // 00-core.js foWageOf is the authority; market.mjs mirrors it for players
  // whose wage has not been stored yet
  const core = read('engine/src/00-core.js');
  const R50 = +/const FO_WAGE_R50=(\d+)/.exec(core)[1];
  const MID = +/const FO_WAGE_MID=(\d+)/.exec(core)[1];
  const K = +/const FO_WAGE_K=([\d.]+)/.exec(core)[1];
  assert.equal(R50, 25704, 'the median the service mirrors');
  assert.equal(MID, 9290, 'the calibrated midpoint the service mirrors');
  assert.equal(K, 2.0, 'the convexity the service mirrors');
  for (const m of MEN) {
    const engine = Math.max(400, Math.round(MID * Math.pow(m.rating / R50, K) *
      (1 + 0.06 * m.talents.length) / 10) * 10);
    assert.equal(wageFromRating(m.rating, m.talents.length), engine,
      'rating ' + m.rating + ' must cost the same to employ in both');
  }
});

test('a fee is a season of wages, and the page quotes what the umpire charges', () => {
  const client = read('engine/src/league/55-market.js');
  assert.match(client, /FEE_ROUNDS = 18/, 'the page uses a season of matchdays');
  assert.match(client, /FEE_MULT = 2\.4/, 'and the same multiple');
  assert.match(client, /W_R50 = 25704, W_MID = 9290, W_K = 2\.0/, 'and the same wage curve');
  assert.equal(FEE_ROUNDS, 18);
  assert.equal(FEE_MULT, 2.4);
  for (const m of MEN.map(withWage)) {
    // what the page shows for a quicksell: half of what he is worth
    const page = Math.max(3000, Math.round(
      m.wage * 18 * 2.4 * ageCurve(m.age) * 0.5 / 500) * 500);
    const umpire = quickSellOf(m);
    assert.equal(page, umpire, 'rating ' + m.rating + ' age ' + m.age +
      ': the page promised ' + page + ' and the umpire pays ' + umpire);
  }
});

test('migration 065 carries the same constants as the code it mirrors', () => {
  const sql = read('server/migrations/065-a-fee-is-priced-in-wages.sql');
  assert.match(sql, /9290 \* power\(rating \/ 25704\.0, 2\.0\)/,
    'the wage curve, written out for plpgsql');
  assert.match(sql, /1 \+ 0\.06 \* tal/, 'the talent premium');
  assert.match(sql, /wage \* 18 \* 2\.4 \* curve \* 0\.5/,
    'a season, the multiple, the age curve and the quicksell half');
  assert.match(sql, /greatest\(3000,/, 'and the same floor');
  // the age curve itself, band for band
  for (const [age, mult] of [[21, 1.18], [25, 1.12], [28, 1.0], [31, 0.82], [33, 0.6]]) {
    assert.equal(ageCurve(age), mult, 'age ' + age + ' bends the same way in both');
    assert.ok(sql.includes('<=' + age + ' THEN ' + mult) ||
              sql.includes('<= ' + age + ' THEN ' + mult) ||
              sql.includes('$2::int<=' + age + ' THEN ' + mult),
      'the SQL bends age ' + age + ' by ' + mult);
  }
});

test('the best cricketer alive is not affordable out of petty cash', () => {
  const median = valueOf(withWage(MEN[1]));
  const best = valueOf(withWage({ rating: 58254, age: 27, talents: [] }));
  assert.ok(median > 300000 && median < 500000,
    'a median man is a real signing, not a rounding error: ' + median);
  assert.ok(best / median > 4,
    'and the best man alive costs a multiple of him, not a fraction more: x' +
    (best / median).toFixed(1));
});
