#!/usr/bin/env node
/* tools/ops-map.mjs — CLUB OPERATIONS, AND WHAT IT ACTUALLY SCALES WITH
 *
 * ERA 2 CLUB-SCALE OPERATIONS, sections 1-5. Measurement only. Every constant
 * comes from the shipped `financeconfig.mjs` and every coordinate from the
 * shipped `economy.mjs`; nothing is redefined here.
 *
 * THE QUESTION THIS ANSWERS. The operations line is written as though it had
 * a fixed half and a size-varying half:
 *
 *     ops = OPS_BASE_ROUND + seats x OPS_PER_SEAT_ROUND + (div 1 ? premium)
 *
 * A per-seat term only varies if SEATS vary. This walks the seat ladder the
 * world actually deals and asks how much of the "variable" half moves at all.
 *
 *   node tools/ops-map.mjs
 */
import {
  stature, econStature, foundingSeats, foundingSupport, foundingBankFor,
  MAX_SEATS
} from '../server/economy.mjs';
import {
  OPS_BASE_ROUND, OPS_PER_SEAT_ROUND, OPS_TOPFLIGHT_ROUND, OPS_ASSOC,
  operationsPerRound
} from '../server/financeconfig.mjs';

const $ = n => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString();
const pc = n => (n * 100).toFixed(1) + '%';
const L = s => console.log(s);

L('CLUB OPERATIONS - THE EXACT LAW AND THE LADDER IT IS CHARGED ON');
L('='.repeat(78));
L('');
L('1. THE FORMULA, verbatim from server/financeconfig.mjs:267');
L('');
L('   operationsPerRound(seats, div, natOps) =');
L('     round( (OPS_BASE_ROUND + seats x OPS_PER_SEAT_ROUND');
L('             + (div === 1 ? OPS_TOPFLIGHT_ROUND : 0)) x natOps )');
L('');
L('   OPS_BASE_ROUND       ' + $(OPS_BASE_ROUND) + '   every club, every round it plays');
L('   OPS_PER_SEAT_ROUND   $' + OPS_PER_SEAT_ROUND + '        per seat of CAPACITY (not of crowd)');
L('   OPS_TOPFLIGHT_ROUND  ' + $(OPS_TOPFLIGHT_ROUND) + '   Division One only');
L('   OPS_ASSOC            ' + OPS_ASSOC + '        associate nations, applied to the WHOLE line');
L('');
L('   No cap. No floor. No academy term (academy upkeep is its own ledger');
L('   line, charged beside operations and not part of it). Charged once per');
L('   round the club PLAYS - home and away alike, play-off rounds included');
L('   since Phase 2.');
L('');

// ---------------------------------------------------------------------------
// 2. THE SEAT LADDER. This is the whole point: a per-seat term can only be a
// size term if the seats differ by seat. foundingSeats deliberately does NOT
// steepen with standing - the comment at economy.mjs:112 says so outright,
// because steepening it broke stadium building - so the ground a club is
// dealt spans far less than its income does.
// ---------------------------------------------------------------------------
L('2. THE LADDER THE PER-SEAT TERM IS CHARGED ON (a founded world, full member)');
L('');
L('slot  div  stature  econStat   seats  support   ops/round      base   ground'
  + '   flight   fixed%');
L('-'.repeat(94));
const rows = [];
for (let slot = 0; slot < 16; slot++) {
  const isBoss = slot === 0;
  const div = slot < 8 ? 1 : 2;
  const st = stature(slot, isBoss), es = econStature(slot, isBoss);
  const seats = foundingSeats(slot, isBoss);
  const sup = foundingSupport(slot, isBoss);
  const ops = operationsPerRound(seats, div, 1);
  const ground = Math.round(seats * OPS_PER_SEAT_ROUND);
  const flight = div === 1 ? OPS_TOPFLIGHT_ROUND : 0;
  rows.push({ slot, div, st, es, seats, sup, ops, ground, flight });
  L(String(slot).padStart(4) + String(div).padStart(5)
    + st.toFixed(3).padStart(9) + es.toFixed(3).padStart(10)
    + seats.toLocaleString().padStart(8) + sup.toLocaleString().padStart(9)
    + $(ops).padStart(12) + $(OPS_BASE_ROUND).padStart(10)
    + $(ground).padStart(9) + $(flight).padStart(9)
    + pc(OPS_BASE_ROUND / ops).padStart(9));
}
L('');

// ---------------------------------------------------------------------------
// 3. HOW MUCH OF THE "VARIABLE" HALF ACTUALLY VARIES.
// ---------------------------------------------------------------------------
const flag = rows[0], d1bot = rows[7], d2top = rows[8], d2bot = rows[15];
const spread = (a, b) => (a / b).toFixed(3) + 'x';
L('3. WHAT THE LADDER SPANS, top to bottom');
L('');
L('   seats            ' + flag.seats.toLocaleString() + ' -> ' + d2bot.seats.toLocaleString()
  + '   ' + spread(flag.seats, d2bot.seats));
L('   supporters       ' + flag.sup.toLocaleString() + ' -> ' + d2bot.sup.toLocaleString()
  + '   ' + spread(flag.sup, d2bot.sup));
L('   econStature      ' + flag.es.toFixed(3) + ' -> ' + d2bot.es.toFixed(3)
  + '     ' + spread(flag.es, d2bot.es));
L('   ops/round        ' + $(flag.ops) + ' -> ' + $(d2bot.ops)
  + '   ' + spread(flag.ops, d2bot.ops) + '   (with the division premium)');
L('   ops, no premium  ' + $(flag.ops - flag.flight) + ' -> ' + $(d2bot.ops)
  + '   ' + spread(flag.ops - flag.flight, d2bot.ops) + '   <- the CLUB-SCALE half alone');
L('');
const idSeats = rows.filter(r => r.seats === d2bot.seats).map(r => r.slot);
L('   Seats are IDENTICAL for slots ' + idSeats[0] + '-' + idSeats[idSeats.length - 1]
  + ' (' + idSeats.length + ' of 16 clubs). For those seats the');
L('   per-seat term is not a size term at all: it is a second fixed charge of '
  + $(d2bot.ground) + '.');
L('');
L('   Effective fixed cost by that reading (base + an unvarying ground term):');
for (const r of [flag, rows[4], d1bot, d2top, d2bot]) {
  const trulyVar = Math.round((r.seats - d2bot.seats) * OPS_PER_SEAT_ROUND);
  L('     slot ' + String(r.slot).padStart(2) + '  ops ' + $(r.ops).padStart(9)
    + '   varies with own size: ' + $(trulyVar).padStart(8)
    + '   = ' + pc(trulyVar / r.ops).padStart(6) + ' of its operations');
}
L('');

// ---------------------------------------------------------------------------
// 4. AND WHAT IT LOOKS LIKE IF THE CLUB BUILDS. Capacity is the one part of
// the coordinate a manager can move, so the law's sensitivity to growth is
// the sensitivity to a stand.
// ---------------------------------------------------------------------------
L('4. THE ONE WAY A CLUB CAN MOVE ITS OWN OPERATIONS: build seats');
L('');
L('   seats     ops/round D2   ops/round D1   marginal per 1,000 seats');
for (let s = 15000; s <= MAX_SEATS; s += 5000) {
  const o2 = operationsPerRound(s, 2, 1), o1 = operationsPerRound(s, 1, 1);
  L('   ' + s.toLocaleString().padStart(6) + $(o2).padStart(15) + $(o1).padStart(15)
    + $(1000 * OPS_PER_SEAT_ROUND).padStart(20));
}
L('');
L('   A club that builds from its founded ground to the ' + MAX_SEATS.toLocaleString()
  + '-seat ceiling adds');
L('   ' + $((MAX_SEATS - d2bot.seats) * OPS_PER_SEAT_ROUND) + ' a round to its operations - perfectly smooth, no cliff.');
L('');
L('5. CONSUMERS OF THE LAW (every runtime caller)');
L('');
L('   server/economy.mjs:922    the settle walk - CHARGES the ledger. Inside');
L('                             `if (curEra2)`, so era 1 never reaches it.');
L('   server/economy.mjs:1054   the decomposition served to the client, also');
L('                             era-2 only (`opsBreakdown: curEra2 ? ...`).');
L('   server/botfinance.mjs:99  the bot posture projection. `botMoney` returns');
L('                             `healthy` before this in era 1.');
L('   engine/src/league/43-finance.js:1257  RENDERS the served breakdown and');
L('                             owns no copy of the constants.');
L('   tests + tools             world-economy.test.mjs:208 asserts the charged');
L('                             line equals the law; :405 asserts the served');
L('                             rate equals the charged rate.');
