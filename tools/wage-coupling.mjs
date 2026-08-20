#!/usr/bin/env node
/* tools/wage-coupling.mjs — WHAT ELSE MOVES WHEN THE WAGE MOVES
 *
 * Sections 16, 17 and the arithmetic behind section 26's decision.
 *
 * A wage in this game is not only a cost. A transfer fee is priced DIRECTLY off
 * it - market.mjs rawWorth is wage x FEE_ROUNDS x FEE_MULT x ageCurve x form -
 * so a scalar on the wage anchor is a scalar on every fee in the world, and on
 * every quicksell, and on what a bot thinks a man is worth. That is section 16,
 * and it is not a side effect to be checked off: it is half of what the anchor
 * does.
 *
 * The part that does NOT scale is the money that is not a wage. Banks, media,
 * sponsor and prizes are fixed in dollars. So cutting the anchor by a fifth
 * does not leave the market where it was - it makes every cricketer a fifth
 * cheaper against a treasury that did not move, which is section 17's worry
 * stated as arithmetic.
 *
 *   node tools/wage-coupling.mjs
 */
import { makeHost } from '../server/enginehost.mjs';
import { tierOfClub, countryConfigs } from '../server/init-world.mjs';
import { valueOf, quickSellOf, FEE_ROUNDS, FEE_MULT, wageFromRating } from '../server/market.mjs';
import { FOUNDING_BANK_ERA2 } from '../server/financeconfig.mjs';
import { econStature } from '../server/economy.mjs';

const $ = n => '$' + Math.round(n).toLocaleString();
const L = s => console.log(s);
const host = makeHost();

L('');
L('16. THE TRANSFER MARKET IS PRICED IN WAGES');
L('='.repeat(88));
L('');
L('   market.mjs rawWorth(p) = wage x ' + FEE_ROUNDS + ' x ' + FEE_MULT
  + ' x ageCurve(age) x form');
L('');
L('   The wage enters LINEARLY and nothing else in that expression knows about');
L('   the anchor. So a scalar s on FO_WAGE_MID multiplies every fee, every');
L('   quicksell and every bot valuation in the world by exactly s. There is no');
L('   second-order term to discover and no way to change one without the other.');
L('');

// five representative men, priced at the shipped law and at candidate scalars
const MEN = [
  ['ordinary starter', 55, 26, 0],
  ['prime international', 80, 27, 1],
  ['elite star', 92, 28, 2],
  ['young prospect', 62, 20, 0],
  ['veteran', 74, 34, 1]
];
const SC = [1.00, 0.90, 0.80];
L('   man                    OVR  age' + SC.map(s => ('fee x' + s.toFixed(2)).padStart(14)).join('')
  + '      quicksell x1.00');
L('   ' + '-'.repeat(85));
for (const [label, ovr, age, tal] of MEN) {
  const w = wageFromRating(ovr * 1000, tal);
  const cells = SC.map(s => $(valueOf({ wage: Math.round(w * s), age, formIx: 3 })).padStart(14)).join('');
  L('   ' + label.padEnd(22) + String(ovr).padStart(4) + String(age).padStart(5) + cells
    + $(quickSellOf({ wage: w, age, formIx: 3 })).padStart(21));
}
L('');
L('   Every column is the one beside it times the scalar, to the rounding. A');
L('   re-anchor does not change what a player is worth RELATIVE to another');
L('   player - it changes what every player is worth relative to MONEY.');
L('');

// ---------------------------------------------------------------------------
// 17. WHAT DOES NOT SCALE. The treasury.
// ---------------------------------------------------------------------------
L('17. WHAT A TREASURY CAN BUY - the coupling that is NOT neutral');
L('='.repeat(88));
L('');
const banks = [
  ['flagship', econStature(0, true)],
  ['mid D1', econStature(5, false)],
  ['top D2', econStature(9, false)],
  ['minnow', econStature(15, false)]
].map(([n, st]) => [n, Math.round(FOUNDING_BANK_ERA2 * (0.55 + 0.75 * st) / 1000) * 1000]);

const eliteW = wageFromRating(92 * 1000, 2);
const medW = wageFromRating(51 * 1000, 0);
L('   club            founding bank' + SC.map(s => ('elites x' + s.toFixed(2)).padStart(15)).join(''));
L('   ' + '-'.repeat(85));
for (const [name, bank] of banks) {
  const cells = SC.map(s =>
    (bank / valueOf({ wage: Math.round(eliteW * s), age: 28, formIx: 3 })).toFixed(2).padStart(15)).join('');
  L('   ' + name.padEnd(16) + $(bank).padStart(13) + cells);
}
L('');
L('   how many MEDIAN men a bank buys:');
for (const [name, bank] of banks) {
  const cells = SC.map(s =>
    (bank / valueOf({ wage: Math.round(medW * s), age: 26, formIx: 3 })).toFixed(1).padStart(15)).join('');
  L('   ' + name.padEnd(16) + $(bank).padStart(13) + cells);
}
L('');
L('   THIS IS THE SECTION-17 RISK, STATED AS ARITHMETIC. Banks, media, sponsor');
L('   and prize money are fixed in dollars and do not know about the anchor.');
L('   Cutting it by a fifth makes every cricketer a fifth cheaper against a');
L('   treasury that did not move: a club that could afford 1.00 elite men can');
L('   afford 1.25 of them, and it did nothing to earn the difference.');
L('');

// ---------------------------------------------------------------------------
// THE CONSTRAINT CONFLICT. Section 15 forbids recreating the flagship money
// printer; section 13 wants the D1 tail closed. Both are read off the same
// moving-pyramid run, so this is not two models disagreeing.
// ---------------------------------------------------------------------------
L('THE CONFLICT AT THE HEART OF AN ANCHOR-ONLY CHANGE');
L('='.repeat(88));
L('');
L('   from tools/wage-pyramid.mjs, ten seasons, real promotion and relegation:');
L('');
L('   scale   worst D1 seat   clubs over $20m   ever in admin   wage/revenue');
L('   ' + '-'.repeat(85));
const CONFLICT = [
  ['1.00', '-$1,123,085', '0', '77/256', '60.2%'],
  ['0.90', '-$529,425', '9', '34/256', '54.1%'],
  ['0.80', '-$39,504', '27', '20/256', '48.1%']
];
for (const r of CONFLICT) {
  L('   ' + r[0].padStart(5) + r[1].padStart(16) + r[2].padStart(18)
    + r[3].padStart(16) + r[4].padStart(15));
}
L('');
L('   Phase 4 shipped a law that took clubs over $20m from three to ZERO and');
L('   called that the flagship money printer being closed. An anchor deep');
L('   enough to bring the worst Division One seat near break-even reopens it at');
L('   twenty-seven clubs - nine times what Phase 4 removed. There is no scalar');
L('   that closes the tail and leaves the top alone, because a scalar moves');
L('   every club by the same proportion and the two problems sit at opposite');
L('   ends of the same ladder.');
L('');
