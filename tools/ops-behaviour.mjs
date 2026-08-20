#!/usr/bin/env node
/* tools/ops-behaviour.mjs — DOES THE LAW BEHAVE, AND IS IT SMOOTH?
 *
 * ERA 2 CLUB-SCALE OPERATIONS, sections 7, 14 and 15.
 *
 *   7   the archetype grid: frugal / normal / aggressive must still MEAN
 *       something at every club size, and aggressive must still be able to
 *       lose money.
 *  14   growth: a club that grows should gradually cost more to run, without
 *       a cliff where one supporter or one seat jumps the bill.
 *  15   the same grid read as strategy rather than as accounting.
 *
 *   node tools/ops-behaviour.mjs
 */
import { seasonOf, makeSquadShop, tierOf, mean, $, SEASON_ROUNDS } from './economy-audit.mjs';
import { shipped } from './ops-laws.mjs';
import { operationsPerRound } from '../server/financeconfig.mjs';
import { econStature, foundingSeats, foundingSupport, MAX_SEATS } from '../server/economy.mjs';

const L = s => console.log(s);
// THE TWO ARMS ARE THE PRIOR LAW AND THE ONE NOW SHIPPED. `shipped` in
// ops-laws.mjs is frozen as literals at the pre-phase constants, so it stays
// the baseline; the candidate column is read from financeconfig rather than
// restated, so this file cannot drift from what the game actually charges.
const cand = ({ seats, div, natOps, support }) =>
  operationsPerRound(seats, div, natOps, support);
const ARMS = [['prior', shipped], ['shipped', cand]];

// ---------------------------------------------------------------------------
// SECTION 14. SMOOTHNESS. Both terms are linear, so a cliff could only come
// from somewhere else - but "it is linear" is an argument, not a measurement,
// and the point of the section is to show the marginal cost a club actually
// meets as it grows.
// ---------------------------------------------------------------------------
L('SECTION 14: WHAT GROWTH COSTS, STEP BY STEP');
L('');
L('  A club growing its FOLLOWING (ground held at 24,000, Division Two)');
L('  support     prior ops     shipped ops   marginal per 1,000 more supporters');
let prev = null;
for (let sup = 6000; sup <= 40000; sup += 4000) {
  const a = shipped({ seats: 24000, div: 2, natOps: 1, support: sup });
  const b = cand({ seats: 24000, div: 2, natOps: 1, support: sup });
  L('  ' + sup.toLocaleString().padStart(7) + $(a).padStart(14) + $(b).padStart(16)
    + (prev == null ? '' : $((b - prev) / 4).padStart(30)));
  prev = b;
}
L('');
L('  A club building its GROUND (following held at 15,000, Division Two)');
L('  seats       prior ops     shipped ops   marginal per 1,000 more seats');
prev = null;
for (let s = 15000; s <= MAX_SEATS; s += 5000) {
  const a = shipped({ seats: s, div: 2, natOps: 1, support: 15000 });
  const b = cand({ seats: s, div: 2, natOps: 1, support: 15000 });
  L('  ' + s.toLocaleString().padStart(7) + $(a).padStart(14) + $(b).padStart(16)
    + (prev == null ? '' : $((b - prev) / 5).padStart(26)));
  prev = b;
}
L('');
L('  Both terms are linear in their coordinate, so the marginal cost is a');
L('  constant and there is no size at which the bill jumps. The following');
L('  itself moves 18% of its gap a round, so nothing steps either.');
L('');

// ---------------------------------------------------------------------------
// SECTIONS 7 AND 15. THE ARCHETYPES. Frugal, normal and aggressive are
// modelled the way a manager actually differs: what he is willing to carry as
// a payroll, and what that payroll buys him on the table. A bigger bill buys a
// better finish - that is why anyone pays it - so an arm that let a club spend
// nothing and finish where it liked would prove nothing.
// ---------------------------------------------------------------------------
const shop = makeSquadShop();
const bySlot = {};
for (const rid of shop.nations) {
  shop.sidesOf(rid).forEach((side, slot) => {
    const isBoss = !!side.boss, div = side.div || (slot < 8 ? 1 : 2);
    const players = shop.deal(`${rid}|${slot}`, rid, side.arch, side.str, tierOf(slot, isBoss, div));
    if (players.length) (bySlot[slot] = bySlot[slot] || []).push({ rid, isBoss, div, wageRound: shop.wageOf(players) });
  });
}

// THE ARCHETYPES, and what each buys. A frugal club carries three quarters of
// the payroll its seat was dealt and finishes two places worse for it; an
// aggressive one carries half again and finishes two places better. The
// positions are clamped to the division. These are the same shapes Phase 2
// used, so the two phases' archetype tables can be read against each other.
const ARCH = [
  { tag: 'FRUGAL', wage: 0.75, posShift: +2 },
  { tag: 'NORMAL', wage: 1.00, posShift: 0 },
  { tag: 'AGGRESSIVE', wage: 1.50, posShift: -2 }
];
const SCALES = [
  { tag: 'flagship', slot: 0, div: 1, pos: 1 },
  { tag: 'large D1', slot: 2, div: 1, pos: 3 },
  { tag: 'small D1', slot: 7, div: 1, pos: 8 },
  { tag: 'mid D2', slot: 11, div: 2, pos: 4 },
  { tag: 'minnow D2', slot: 15, div: 2, pos: 8 }
];

L('SECTIONS 7 AND 15: MANAGEMENT ARCHETYPES, annual net');
L('');
L('club scale     archetype     prior law        shipped       change');
L('-'.repeat(66));
for (const sc of SCALES) {
  for (const ar of ARCH) {
    const pos = Math.max(1, Math.min(8, sc.pos + ar.posShift));
    const wins = 2 * (8 - pos);
    const nets = ARMS.map(([, law]) => mean((bySlot[sc.slot] || []).map((c, i) => seasonOf({
      slot: sc.slot, isBoss: c.isBoss, div: sc.div, country: c.rid,
      wageRound: c.wageRound * ar.wage, pos, posLast: pos, wins,
      seed: sc.slot * 977 + i * 13, opsLaw: law
    }).net)));
    L((ar.tag === 'FRUGAL' ? sc.tag : '').padEnd(15) + ar.tag.padEnd(13)
      + $(nets[0]).padStart(13) + $(nets[1]).padStart(15)
      + ((nets[1] > nets[0] ? '+' : '') + Math.round((nets[1] - nets[0]) / 1000) + 'k').padStart(13));
  }
  L('');
}
L('  The law is charged on the FOLLOWING, which no amount of spending buys');
L('  directly - so an aggressive manager still meets the bill he ran up. That');
L('  is the property section 7 asks for, and it is why operations was the');
L('  right line to move rather than revenue.');
