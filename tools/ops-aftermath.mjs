#!/usr/bin/env node
/* tools/ops-aftermath.mjs — WHAT IS LEFT ONCE OPERATIONS SCALES
 *
 * ERA 2 CLUB-SCALE OPERATIONS, sections 16, 17 and 18. Measurement only, and
 * deliberately run AFTER the law changed: both questions below are about
 * whether a problem still exists, and neither can be answered from the old
 * world.
 *
 *  16  does the tierflat econStature candidate still deserve to exist?
 *  17  does FO_WAGE_R50 still require a phase of its own?
 *  18  the tier cliff - slots 12-15 promoted 0 times in five seasons - which
 *      is recorded, not solved, and certainly not solved with money.
 *
 *   node tools/ops-aftermath.mjs
 */
import { seasonOf, makeSquadShop, tierOf, mean, $, SEASON_ROUNDS } from './economy-audit.mjs';
import { operationsPerRound } from '../server/financeconfig.mjs';
import { ARMS as STAT_ARMS } from './stature-laws.mjs';
import { econStature, stature } from '../server/economy.mjs';

const L = s => console.log(s);
const pcs = n => (n * 100).toFixed(0) + '%';
const posOf = slot => (slot < 8 ? slot + 1 : slot - 7);
const winsOf = pos => Math.round(SEASON_ROUNDS * (8 - pos) / 7 * 0.85 + 1);

const shop = makeSquadShop();
const bySlot = {};
for (const rid of shop.nations) {
  shop.sidesOf(rid).forEach((side, slot) => {
    const isBoss = !!side.boss, div = side.div || (slot < 8 ? 1 : 2);
    const players = shop.deal(`${rid}|${slot}`, rid, side.arch, side.str, tierOf(slot, isBoss, div));
    if (players.length) (bySlot[slot] = bySlot[slot] || []).push({ rid, isBoss, div, wageRound: shop.wageOf(players) });
  });
}

function armOf(statOf) {
  const out = [];
  for (let slot = 0; slot < 16; slot++) {
    const isBoss = slot === 0, div = slot < 8 ? 1 : 2, pos = posOf(slot);
    // BOTH COORDINATES, EXPLICITLY. seasonOf derives statRaw from statOverride
    // when no statRawOverride is given, and that is exactly the mistake Phase 3
    // corrected: the sponsor and the founding coordinates read the FLOORED
    // stature, but the crowd reads the RAW one, and a run that floors the crowd
    // invents support the game never grants - most of it in Division Two, which
    // is precisely where this comparison's conclusions would come from. A
    // stature candidate replaces the ECONOMIC coordinate; the crowd's is
    // untouched, so it is pinned to the shipped raw ladder in every arm.
    const runs = (bySlot[slot] || []).map((c, i) => seasonOf({
      slot, isBoss: c.isBoss, div, country: c.rid, pos, wins: winsOf(pos),
      wageRound: c.wageRound, seed: slot * 977 + i * 13,
      statOverride: statOf(slot, isBoss), statRawOverride: stature(slot, isBoss)
    }));
    const g = f => runs.map(f);
    out.push({ slot, div, revenue: mean(g(r => r.revenue)), ops: mean(g(r => r.ops)),
      wages: mean(g(r => r.wages)), net: mean(g(r => r.net)) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// SECTION 16. TIERFLAT, RE-ASKED. The stature audit found the candidate
// conceptually coherent (the floor's 23,000-24,300 premise is dead) but
// economically small. If operations was the binding constraint, correcting it
// should shrink what tierflat is worth still further - and a dead premise does
// not by itself require a replacement mechanic.
// ---------------------------------------------------------------------------
L('SECTION 16: WHAT TIERFLAT IS WORTH NOW THAT OPERATIONS SCALES');
L('');
const cur = armOf(STAT_ARMS.current), tf = armOf(STAT_ARMS.tierflat);
L('  slot  div   econStature      tierflat     net (shipped stature)   net (tierflat)      change');
L('  ' + '-'.repeat(88));
let biggest = 0;
for (let s = 0; s < 16; s++) {
  const d = tf[s].net - cur[s].net;
  if (Math.abs(d) > Math.abs(biggest)) biggest = d;
  L('  ' + String(s).padStart(4) + String(cur[s].div).padStart(5)
    + STAT_ARMS.current(s, s === 0).toFixed(3).padStart(14)
    + STAT_ARMS.tierflat(s, s === 0).toFixed(3).padStart(14)
    + $(cur[s].net).padStart(24) + $(tf[s].net).padStart(17)
    + ((d > 0 ? '+' : '') + Math.round(d / 1000) + 'k').padStart(12));
}
L('');
L('  largest single-seat movement: ' + $(biggest));
L('');

// ---------------------------------------------------------------------------
// SECTION 17. THE WAGE ANCHOR. FO_WAGE_R50 is stale relative to the current
// card distribution and stays frozen. The question is whether, with operations
// corrected, payroll is still the thing that sinks a club.
// ---------------------------------------------------------------------------
L('SECTION 17: PAYROLL AGAINST REVENUE AND AGAINST TOTAL COSTS, AFTER THE FIX');
L('');
L('  slot  div      revenue        wages   operations   wages/rev   ops/rev'
  + '   wages/costs   both/rev');
L('  ' + '-'.repeat(94));
for (const r of cur) {
  L('  ' + String(r.slot).padStart(4) + String(r.div).padStart(5)
    + $(r.revenue).padStart(13) + $(r.wages).padStart(13) + $(r.ops).padStart(13)
    + pcs(r.wages / r.revenue).padStart(12) + pcs(r.ops / r.revenue).padStart(10)
    + pcs(r.wages / (r.wages + r.ops)).padStart(14)
    + pcs((r.wages + r.ops) / r.revenue).padStart(11));
}
L('');
const d1 = cur.filter(r => r.div === 1), d2 = cur.filter(r => r.div === 2);
L('  Division One  mean wages/revenue ' + pcs(mean(d1.map(r => r.wages / r.revenue)))
  + '   wages as a share of the two big costs ' + pcs(mean(d1.map(r => r.wages / (r.wages + r.ops)))));
L('  Division Two  mean wages/revenue ' + pcs(mean(d2.map(r => r.wages / r.revenue)))
  + '   wages as a share of the two big costs ' + pcs(mean(d2.map(r => r.wages / (r.wages + r.ops)))));
L('');
L('  The seats still under water, and what is taking their money:');
for (const r of cur.filter(x => x.net < 0)) {
  L('    slot ' + String(r.slot).padStart(2) + '  net ' + $(r.net).padStart(12)
    + '   wages ' + pcs(r.wages / r.revenue).padStart(5) + ' of revenue'
    + '   operations ' + pcs(r.ops / r.revenue).padStart(5)
    + (r.wages / r.revenue > 0.6 ? '   <- the payroll, not the operations' : ''));
}
