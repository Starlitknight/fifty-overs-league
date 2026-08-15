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

// THE MEN THE THREE IMPLEMENTATIONS ARE COMPARED ON, AND WHY THEY MOVED.
//
// These used to be five ratings off the OLD scale - 19,530 up to 58,254, the
// band a rating occupied when it was its own formula. B2 made rating the
// canonical card times a thousand, which does not rescale those numbers, it
// REDEFINES them: 25,704 stopped meaning "the world's median professional" and
// started meaning "a cricketer whose card reads 26", which is a part-timer. So
// the file was quietly comparing the three implementations on a journeyman, four
// amateurs and nobody at all, and the affordability test below - which asks
// whether a median man is a real signing - was asking it about the wrong man.
//
// They are stated as CARDS now, which cannot go stale the way a rating did.
const OVR = o => o * 1000;
const MEN = [
  { rating: OVR(30), age: 24, talents: [] },                        // a journeyman
  { rating: OVR(50), age: 27, talents: [] },                        // the median professional
  { rating: OVR(72), age: 22, talents: ['sixMachine'] },            // a young star with a talent
  { rating: OVR(85), age: 31, talents: [] },                        // a veteran of the top percentile
  { rating: OVR(95), age: 34, talents: ['miser', 'bouncer'] }       // an old great
];
const withWage = m => ({ ...m, wage: wageFromRating(m.rating, m.talents.length) });

test('the engine and the service derive the same wage from a rating', () => {
  // 00-core.js foWageOf is the authority; market.mjs mirrors it for players
  // whose wage has not been stored yet
  // THE CONSTANTS ARE READ, NOT RESTATED. This used to assert the three
  // literals - 25704, 9290, 2.0 - which made it a guard against changing them
  // rather than a guard against the mirrors DRIFTING, and those are different
  // jobs. B2 had to change them (the median rating was measured against a
  // rating formula that no longer exists, so the curve was working around a
  // point 3.78x off) and the literal assertions could only say "no".
  //
  // What must never differ is the two implementations, so that is what is
  // checked: whatever the engine says, the service must say the same.
  const core = read('engine/src/00-core.js');
  const OVR50 = +/const FO_WAGE_OVR50=(\d+)/.exec(core)[1];
  const R50 = OVR50 * 1000;
  const MID = +/const FO_WAGE_MID=(\d+)/.exec(core)[1];
  const K = +/const FO_WAGE_K=([\d.]+)/.exec(core)[1];
  assert.match(core, /const FO_WAGE_R50=FO_WAGE_OVR50\*1000;/,
    'the midpoint is stated in CARD terms, which is the thing that cannot go stale');
  assert.ok(R50 > 0 && MID > 0 && K > 0, 'a curve to mirror');
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
  // and the page's own copy of the curve is the engine's, read the same way
  const core2 = read('engine/src/00-core.js');
  const cOVR = +/const FO_WAGE_OVR50=(\d+)/.exec(core2)[1];
  const cMID = +/const FO_WAGE_MID=(\d+)/.exec(core2)[1];
  const cK = +/const FO_WAGE_K=([\d.]+)/.exec(core2)[1];
  const seen = /W_R50 = (\d+) \* 1000, W_MID = (\d+), W_K = ([\d.]+)/.exec(client);
  assert.ok(seen, 'the page states the wage curve where it can be read');
  assert.equal(+seen[1], cOVR, 'the page mirrors the engine median');
  assert.equal(+seen[2], cMID, 'and the engine midpoint');
  assert.equal(+seen[3], cK, 'and the engine convexity');
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

// THE THIRD MIRROR, AND THE ONE THAT MOVES THE MONEY.
//
// 065 wrote the wage curve out for plpgsql and its own header says "if any of
// the four move, all four move". When B2 rebased the curve, only the engine and
// market.mjs moved - the SQL kept 9290 x (rating/25704)^2, a curve around a
// median that no longer exists, which on a canonical rating of 50,000 prices a
// median professional at $35,150 a round instead of $9,290 and would have sold
// him to the bank for $13.7m. Nothing failed because the line is a fallback and
// every dealt cricketer carries a stored wage; it was waiting for the first man
// who did not. 098 restates it, and this now reads the CURRENT migration.
//
// It also reads the constants out of the engine rather than restating them, for
// the same reason the wage test above does: asserting literals guards against
// changing a constant, which is a different job from guarding against the
// mirrors drifting apart.
test('the quicksell migration carries the same constants as the code it mirrors', () => {
  const sql = read('server/migrations/098-the-money-moves-on-the-canonical-card.sql');
  const core = read('engine/src/00-core.js');
  const OVR50 = +/const FO_WAGE_OVR50=(\d+)/.exec(core)[1];
  const MID = +/const FO_WAGE_MID=(\d+)/.exec(core)[1];
  const K = +/const FO_WAGE_K=([\d.]+)/.exec(core)[1];
  assert.ok(sql.includes(MID + ' * power(rating / ' + (OVR50 * 1000) + '.0, ' + K.toFixed(1) + ')'),
    'the wage curve, written out for plpgsql, on the engine\'s own constants');
  assert.ok(sql.includes('coalesce((man->>\'rating\')::numeric, ' + (OVR50 * 1000) + ')'),
    'and a man with no rating defaults to the world\'s median card');
  // and the curve it REPLACES must not still be reachable: 065 cannot be edited
  // (it has run in production) but nothing may re-introduce its constants
  const old065 = read('server/migrations/065-a-fee-is-priced-in-wages.sql');
  assert.match(old065, /9290 \* power\(rating \/ 25704\.0, 2\.0\)/,
    'the superseded curve is still in 065, where history keeps it');
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

// ---- THE ECONOMIC CONTRACT ------------------------------------------------
//
// What the transfer market is FOR, asserted against the money a club actually
// has. Everything below is measured on the dealt world (tools/economy-audit-b2):
//
//   wages    min 400  p10 1,030  median 9,290  p90 33,930  p99 53,690  max 71,900
//   fees     median 414,500  p90 1,466,000  p99 2,263,000  max 3,106,000
//   payroll  flagship 6.22m a season against 6.9m of income; newcomer 776k
//   banks    flagship 4.375m at founding, newcomer 3.473m
//
// A FEE IS DERIVED FROM A WAGE and stays that way. The alternative - a second
// curve off the card - would be a second opinion about what a cricketer is
// worth, and the whole of B2 is the removal of second opinions. The multiple
// (FEE_ROUNDS x FEE_MULT = 43.2 wages) is unchanged BY MEASUREMENT rather than
// by inertia: the wage rebase carried fees down with it by construction, and the
// four things a transfer market has to be are all true at the bottom of that
// fall. Multiplying it back up by 3.78 to "restore" the old fees would restore
// them against a payroll that was 341% of a flagship's income, which is the
// state the rebase existed to end.
test('the transfer market prices a squad-shaping decision, not a line item', () => {
  const at = (ovr, age = 27, tal = []) => valueOf(withWage({ rating: OVR(ovr), age, talents: tal }));
  const median = at(50);
  // 1. A MEDIAN PROFESSIONAL IS A REAL SIGNING. Against a newcomer's founding
  //    bank of 3.47m he is a considered purchase, not a rounding error - and his
  //    wage adds about a sixth to that club's whole payroll.
  assert.ok(median > 300000 && median < 500000,
    'a median man is a real signing: ' + median);
  // 2. AN 80+ STAR IS EXPENSIVE: half a flagship's founding capital.
  const star = at(82);
  assert.ok(star > 1500000, 'an 80+ cricketer costs real money: ' + star);
  assert.ok(star / median > 3.5, 'and a multiple of a median man: x' + (star / median).toFixed(1));
  // 3. A 90+ IS A SACRIFICE. More than half a flagship's bank in fee, and a
  //    wage that is a seventh of its entire payroll.
  const great = at(95);
  assert.ok(great > 2500000, 'a generational cricketer costs a fortune: ' + great);
  assert.ok(great / median > 6,
    'and the best man alive costs a multiple of him, not a fraction more: x' +
    (great / median).toFixed(1));
  assert.ok(wageFromRating(OVR(95), 0) * 14 > 0.13 * 6216000,
    'and his wage alone is a seventh of a flagship payroll');
  // 4. THE MARKET STAYS USABLE. A weak club's whole season of surplus (about
  //    3m at a d2a) has to buy something worth having, or there is no market -
  //    the strongest cricketer a mid-table side can reach must be a good one.
  assert.ok(at(70) < 1500000, 'a strong professional is within a middling club\'s reach: ' + at(70));
  assert.ok(at(30) < 100000, 'and a squad filler is cheap: ' + at(30));
  // 5. THE CURVE IS CONVEX ALL THE WAY UP - two good players are never one great
  //    one, which is the decision the market exists to pose.
  const steps = [30, 50, 70, 82, 90, 95].map(o => at(o));
  for (let i = 2; i < steps.length; i++)
    assert.ok(steps[i] / steps[i - 1] > 1, 'the price never flattens at ' + [30, 50, 70, 82, 90, 95][i]);
  assert.ok((at(95) - at(90)) > (at(50) - at(45)),
    'and five cards at the top cost more than five in the middle');
});
