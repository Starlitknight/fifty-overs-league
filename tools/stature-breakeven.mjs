#!/usr/bin/env node
/* tools/stature-breakeven.mjs — IS THERE A COORDINATE THAT SAVES THE BOTTOM?
 *
 * ERA 2 ECONOMIC STATURE REALISM, the question every candidate law runs into.
 * Sweeping the coordinate for one seat and reading off where its annual result
 * crosses zero says whether the seat's trouble is its commercial SCALE at all.
 *
 * If break-even sits inside the ladder, a stature law can fix the seat and the
 * only argument is where to put it. If break-even sits ABOVE the flagship's
 * own coordinate, no placement of any floor can save the club, and its problem
 * is on the cost side - which makes it somebody else's phase.
 *
 *   node tools/stature-breakeven.mjs
 */
import { seasonOf, makeSquadShop, tierOf, mean, $ } from './economy-audit.mjs';
import { FOUNDING_SUPPORT, FOUNDING_SEATS, econStature } from '../server/economy.mjs';
import { FOUNDING_BANK_ERA2, OPS_BASE_ROUND, OPS_PER_SEAT_ROUND } from '../server/financeconfig.mjs';
import { ROUNDS } from '../server/clock.mjs';

const bankOf = st => Math.round(FOUNDING_BANK_ERA2 * (0.55 + 0.75 * st) / 1000) * 1000;
const seatsOf = st => Math.round(FOUNDING_SEATS * (1 + 0.95 * st) / 1000) * 1000;
const supOf = st => Math.round(FOUNDING_SUPPORT * (0.40 + 1.62 * Math.pow(st, 1.45)));

const shop = makeSquadShop();
const seats = [];
for (const rid of shop.nations) {
  shop.sidesOf(rid).forEach((side, slot) => {
    const isBoss = !!side.boss, div = side.div || (slot < 8 ? 1 : 2);
    const players = shop.deal(`${rid}|${slot}`, rid, side.arch, side.str, tierOf(slot, isBoss, div));
    if (players.length) seats.push({ rid, slot, isBoss, div, wageRound: shop.wageOf(players) });
  });
}

// one season at a given coordinate, averaged over the sixteen nations' draws
const netAt = (slot, div, pos, st) => mean(seats.filter(s => s.slot === slot).map(s => seasonOf({
  slot, isBoss: slot === 0, div, country: s.rid, wageRound: s.wageRound,
  pos, posLast: pos, wins: 2 * (8 - pos), posCountry: slot + 1, clubsInCountry: 16,
  rounds: ROUNDS, homeRounds: ROUNDS / 2,
  bank0: bankOf(st), seats: seatsOf(st), support: supOf(st),
  statOverride: st, statRawOverride: st, seed: 7 + slot
}).net));

console.log('=== THE COORDINATE SWEEP: annual net against stature ===\n');
console.log('  Each seat, at its own expected finish, swept across the whole coordinate');
console.log('  range and well past it. The flagship\'s own coordinate is 1.000.\n');
const GRID = [0.40, 0.466, 0.50, 0.55, 0.62, 0.70, 0.80, 0.90, 1.00, 1.20, 1.50, 2.00];
console.log('  seat  div  pos ' + GRID.map(g => g.toFixed(2).padStart(11)).join(''));
const CASES = [
  [15, 2, 8], [14, 2, 7], [13, 2, 6], [12, 2, 5],
  [11, 2, 4], [8, 2, 1], [7, 1, 8], [6, 1, 7], [4, 1, 5]
];
const breakeven = {};
for (const [slot, div, pos] of CASES) {
  const row = GRID.map(g => netAt(slot, div, pos, g));
  console.log('  ' + String(slot).padStart(4) + String(div).padStart(5) + String(pos).padStart(5)
    + row.map(v => $(v).padStart(11)).join(''));
  // find the crossing, if there is one inside the swept range
  let be = null;
  for (let i = 1; i < GRID.length; i++) {
    if (row[i - 1] < 0 && row[i] >= 0) {
      be = GRID[i - 1] + (GRID[i] - GRID[i - 1]) * (-row[i - 1]) / (row[i] - row[i - 1]);
      break;
    }
  }
  breakeven[slot] = row[0] >= 0 ? 'always solvent' : be;
}

console.log('\n=== WHERE EACH SEAT BREAKS EVEN ===\n');
for (const [slot, div, pos] of CASES) {
  const be = breakeven[slot];
  const now = econStature(slot, slot === 0);
  console.log('  slot ' + String(slot).padStart(2) + '  (D' + div + ', ' + pos + 'th)'
    + '   today ' + now.toFixed(3)
    + '   break-even ' + (be == null ? 'NEVER, at any coordinate swept (up to 2.00)'
      : typeof be === 'string' ? be : be.toFixed(3)
        + (be > 1 ? '   <- ABOVE THE FLAGSHIP. No floor can reach it.' : '')));
}

console.log('\n=== WHY: THE COST FLOOR A SMALL CLUB CANNOT MOVE ===\n');
console.log('  Club operations are charged per round as');
console.log(`    ${$(OPS_BASE_ROUND)} + seats x $${OPS_PER_SEAT_ROUND}` + ' (+ the top-flight premium)');
console.log('  which is a cost of BEING a club, and it does not scale down with a');
console.log('  club\'s commercial size. For the bottom of division two:\n');
for (const [slot, div, pos] of [[15, 2, 8], [12, 2, 5], [8, 2, 1]]) {
  const g = seats.filter(s => s.slot === slot);
  const st = econStature(slot, false);
  const y = seasonOf({ slot, isBoss: false, div, country: g[0].rid,
    wageRound: mean(g.map(s => s.wageRound)), pos, posLast: pos, wins: 2 * (8 - pos),
    posCountry: slot + 1, clubsInCountry: 16, rounds: ROUNDS, homeRounds: ROUNDS / 2,
    bank0: bankOf(st), seats: seatsOf(st), support: supOf(st),
    statOverride: st, statRawOverride: st, seed: 7 + slot });
  console.log('  slot ' + String(slot).padStart(2)
    + '   revenue ' + $(y.revenue).padStart(11)
    + '   ops ' + $(y.ops).padStart(11) + ' = ' + (100 * y.ops / y.revenue).toFixed(0) + '% of revenue'
    + '   wages ' + (100 * y.wages / y.revenue).toFixed(0) + '%'
    + '   together ' + (100 * (y.ops + y.wages) / y.revenue).toFixed(0) + '%');
}
