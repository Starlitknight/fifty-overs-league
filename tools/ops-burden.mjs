#!/usr/bin/env node
/* tools/ops-burden.mjs — WHAT OPERATIONS COSTS EACH SEAT, AGAINST WHAT IT EARNS
 *
 * ERA 2 CLUB-SCALE OPERATIONS, sections 3 and 4. Measurement only.
 *
 * Walks the corrected seat model (tools/economy-audit.mjs, validated against a
 * real settled world by tools/econ-model-check.mjs) over every nation the
 * shipped generator deals, and reports, for every seat: what it earns, what
 * operations takes, what wages take, and how much of its operations is a
 * charge it cannot move.
 *
 *   node tools/ops-burden.mjs
 */
import { seasonOf, makeSquadShop, tierOf, pct, mean, $, SEASON_ROUNDS }
  from './economy-audit.mjs';
import { foundingSeats } from '../server/economy.mjs';
import { OPS_BASE_ROUND, OPS_PER_SEAT_ROUND } from '../server/financeconfig.mjs';

const pcs = n => (n * 100).toFixed(0) + '%';
const L = s => console.log(s);

// THE EXPECTED FINISH OF A SEAT. A seat's economics are only meaningful at the
// position its dealt squad actually reaches; pricing slot 15 as though it
// finished first would measure a club that does not exist. The mapping is the
// one the pyramid model uses: the dealt strength order IS the expected order.
const posOf = slot => (slot < 8 ? slot + 1 : slot - 7);
const winsOf = pos => Math.round(SEASON_ROUNDS * (8 - pos) / 7 * 0.85 + 1);

// THE SQUADS ARE THE WORLD'S OWN. Every nation the shipped generator deals is
// walked, so a seat's payroll is the payroll sixteen real leagues actually
// hand it rather than a number this tool invented.
const shop = makeSquadShop();
const bySlot = {};
for (const rid of shop.nations) {
  const sides = shop.sidesOf(rid);
  sides.forEach((side, slot) => {
    const isBoss = !!side.boss, div = side.div || (slot < 8 ? 1 : 2);
    const players = shop.deal(`${rid}|${slot}`, rid, side.arch, side.str,
      tierOf(slot, isBoss, div));
    if (!players.length) return;
    (bySlot[slot] = bySlot[slot] || []).push({ rid, isBoss, div, wageRound: shop.wageOf(players) });
  });
}

const seats = [];
for (let slot = 0; slot < 16; slot++) {
  const isBoss = slot === 0, div = slot < 8 ? 1 : 2, pos = posOf(slot);
  const runs = (bySlot[slot] || []).map((c, i) => seasonOf({
    slot, isBoss: c.isBoss, div, country: c.rid, pos, wins: winsOf(pos),
    wageRound: c.wageRound, seed: slot * 977 + i * 13
  }));
  const g = f => runs.map(f);
  seats.push({
    slot, div, pos,
    revenue: mean(g(r => r.revenue)), ops: mean(g(r => r.ops)),
    wages: mean(g(r => r.wages)), net: mean(g(r => r.net)),
    netP10: pct(g(r => r.net), 0.10), netP90: pct(g(r => r.net), 0.90),
    support0: mean(g(r => r.support0)), support: mean(g(r => r.support)),
    seats: runs[0].seats
  });
}

L('CLUB OPERATIONS AGAINST WHAT A SEAT EARNS   (' + (bySlot[0]||[]).length + ' nations, era 2)');
L('='.repeat(96));
L('');
L('slot div pos      revenue    operations     wages   ops/rev  wage/rev  both/rev'
  + '      annual net');
L('-'.repeat(96));
for (const s of seats) {
  if (s.slot === 8) L('-'.repeat(96) + '   <- division two');
  L(String(s.slot).padStart(4) + String(s.div).padStart(4) + String(s.pos).padStart(4)
    + $(s.revenue).padStart(13) + $(s.ops).padStart(14) + $(s.wages).padStart(10)
    + pcs(s.ops / s.revenue).padStart(10) + pcs(s.wages / s.revenue).padStart(10)
    + pcs((s.ops + s.wages) / s.revenue).padStart(10)
    + $(s.net).padStart(16));
}
L('');

// ---------------------------------------------------------------------------
// THE MISMATCH IN ONE PLACE. Everything above is the symptom; this is the
// quantity the phase is about.
// ---------------------------------------------------------------------------
const top = seats[0], bot = seats[15];
const ratio = (a, b) => (a / b).toFixed(2) + 'x';
L('THE LADDERS, TOP CLUB AGAINST BOTTOM CLUB');
L('');
L('  revenue        ' + $(top.revenue).padStart(12) + ' -> ' + $(bot.revenue).padStart(12)
  + '   ' + ratio(top.revenue, bot.revenue));
L('  wages          ' + $(top.wages).padStart(12) + ' -> ' + $(bot.wages).padStart(12)
  + '   ' + ratio(top.wages, bot.wages));
L('  operations     ' + $(top.ops).padStart(12) + ' -> ' + $(bot.ops).padStart(12)
  + '   ' + ratio(top.ops, bot.ops) + '   <- and $30,000 a round of that is the division premium');
const topClub = top.ops - 30000 * SEASON_ROUNDS, botClub = bot.ops;
L('  ops, club half ' + $(topClub).padStart(12) + ' -> ' + $(botClub).padStart(12)
  + '   ' + ratio(topClub, botClub) + '   <- what actually scales with the club');
L('  supporters     ' + Math.round(top.support).toLocaleString().padStart(12) + ' -> '
  + Math.round(bot.support).toLocaleString().padStart(12)
  + '   ' + ratio(top.support, bot.support) + '   <- a coordinate that DOES separate them');
L('  capacity       ' + top.seats.toLocaleString().padStart(12) + ' -> '
  + bot.seats.toLocaleString().padStart(12) + '   ' + ratio(top.seats, bot.seats));
L('');
L('  A club that earns ' + ratio(top.revenue, bot.revenue) + ' what another earns, and pays '
  + ratio(top.wages, bot.wages) + ' the wages,');
L('  is charged ' + ratio(topClub, botClub) + ' to operate. That is the whole finding.');
L('');

// ---------------------------------------------------------------------------
// SECTION 4: HOW MUCH OF THE COST IS UNMOVABLE. Two readings, because the
// naive one flatters the law: "fixed" is not only OPS_BASE_ROUND, it is every
// dollar a club is charged that does not respond to how big the club is.
// Nine seats share one capacity, so for them the ground term is fixed too.
// ---------------------------------------------------------------------------
L('SECTION 4: THE SHARE OF OPERATIONS A CLUB CANNOT MOVE');
L('');
L('  reading A - the base alone is "fixed"');
L('  reading B - fixed is everything that does not differ from the BOTTOM club,');
L('              i.e. what this seat is charged over and above a minnow');
L('');
L('  slot    ops/round    base    ground   reading A    over a minnow   reading B');
L('  ' + '-'.repeat(76));
const minSeats = foundingSeats(15, false);
for (const s of [0, 3, 7, 8, 11, 15]) {
  const isBoss = s === 0, div = s < 8 ? 1 : 2;
  const sc = foundingSeats(s, isBoss);
  const ground = Math.round(sc * OPS_PER_SEAT_ROUND);
  const opsR = OPS_BASE_ROUND + ground + (div === 1 ? 30000 : 0);
  const overMinnow = Math.round((sc - minSeats) * OPS_PER_SEAT_ROUND);
  L('  ' + String(s).padStart(4) + $(opsR).padStart(13) + $(OPS_BASE_ROUND).padStart(9)
    + $(ground).padStart(10) + pcs(OPS_BASE_ROUND / opsR).padStart(12)
    + $(overMinnow).padStart(17) + pcs(1 - overMinnow / opsR).padStart(12));
}
L('');
L('  Reading B is the honest one. For every seat from 7 down - nine of the');
L('  sixteen clubs in a nation - it is 100%: not one dollar of their operations');
L('  responds to anything about the club.');
