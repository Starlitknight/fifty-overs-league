#!/usr/bin/env node
/* tools/ops-sweep.mjs — FITTING THE CLUB-SCALE HALF OF OPERATIONS
 *
 * ERA 2 CLUB-SCALE OPERATIONS, sections 5, 6 and 20. Measurement only.
 *
 * WHAT IS BEING FITTED, and what is not. The division premium stays at the
 * $30,000 Phase 2 fitted against what the top flight guarantees; this sweep
 * only moves the CLUB-SCALE half - the base, the ground term and a new term
 * on the following. Every candidate is charged through the same door in the
 * seat model, so the arms differ in the law and in nothing else.
 *
 * THE ANCHOR. A candidate is not allowed to be a disguised across-the-board
 * cost cut: a law that simply charges everybody less would "fix" both tails
 * by handing the whole world money, and would be indistinguishable here from
 * a law that actually redistributes. So every candidate is fitted to hold the
 * MEDIAN club's operations within a tolerance of what it pays today, and the
 * sweep prints what the median actually lands on so the reader can check.
 *
 *   node tools/ops-sweep.mjs [--seasons=5]
 */
import { seasonOf, makeSquadShop, tierOf, mean, pct, $, SEASON_ROUNDS }
  from './economy-audit.mjs';
import { shipped, scaled, steeperGround } from './ops-laws.mjs';
import { foundingSeats, foundingSupport } from '../server/economy.mjs';
import { operationsPerRound, OPS_TOPFLIGHT_ROUND } from '../server/financeconfig.mjs';

const L = s => console.log(s);
const pcs = n => (n * 100).toFixed(0) + '%';
const posOf = slot => (slot < 8 ? slot + 1 : slot - 7);
const winsOf = pos => Math.round(SEASON_ROUNDS * (8 - pos) / 7 * 0.85 + 1);

// ---------------------------------------------------------------------------
// THE CONTROL THAT KEEPS THE SWEEP HONEST. `shipped` in ops-laws.mjs is a
// re-expression of the shipped law so it can run through the candidate door.
// If it has drifted from financeconfig by so much as a dollar every number
// below is measuring the wrong baseline, so it is checked before anything
// else runs.
// ---------------------------------------------------------------------------
// (the baseline arm is now frozen as literals in ops-laws.mjs - see the note
// there. It can no longer be checked against financeconfig, because
// financeconfig is what this phase changed.)
{
  const a = shipped({ seats: 24000, div: 2, natOps: 1 });
  if (a !== 132400) {
    console.error('the frozen baseline has drifted: 24,000 seats in division two '
      + 'was $132,400 before this phase, and this says ' + a);
    process.exit(1);
  }
}

// the world's own squads, one deal per nation per seat
const shop = makeSquadShop();
const bySlot = {};
for (const rid of shop.nations) {
  shop.sidesOf(rid).forEach((side, slot) => {
    const isBoss = !!side.boss, div = side.div || (slot < 8 ? 1 : 2);
    const players = shop.deal(`${rid}|${slot}`, rid, side.arch, side.str,
      tierOf(slot, isBoss, div));
    if (players.length) {
      (bySlot[slot] = bySlot[slot] || []).push({ rid, isBoss, div, wageRound: shop.wageOf(players) });
    }
  });
}

const medianOf = a => { const s = a.slice().sort((x, y) => x - y); return (s[7] + s[8]) / 2; };

function armOf(law) {
  const seats = [];
  for (let slot = 0; slot < 16; slot++) {
    const isBoss = slot === 0, div = slot < 8 ? 1 : 2, pos = posOf(slot);
    const runs = (bySlot[slot] || []).map((c, i) => seasonOf({
      slot, isBoss: c.isBoss, div, country: c.rid, pos, wins: winsOf(pos),
      wageRound: c.wageRound, seed: slot * 977 + i * 13, opsLaw: law
    }));
    const g = f => runs.map(f);
    seats.push({
      slot, div, pos,
      revenue: mean(g(r => r.revenue)), ops: mean(g(r => r.ops)),
      wages: mean(g(r => r.wages)), net: mean(g(r => r.net)),
      opsRound: mean(g(r => r.ops)) / SEASON_ROUNDS,
      support: mean(g(r => r.support))
    });
  }
  const d1 = seats.filter(s => s.div === 1), d2 = seats.filter(s => s.div === 2);
  return {
    seats,
    d1Mean: mean(d1.map(s => s.net)), d2Mean: mean(d2.map(s => s.net)),
    underwater: seats.filter(s => s.net < 0).length,
    d1Under: d1.filter(s => s.net < 0).length, d2Under: d2.filter(s => s.net < 0).length,
    // THE D1 MEAN IS A TRAP and the first cut of this sweep fell in it. It
    // mixes two movements that point opposite ways and mean opposite things:
    // a rich club being charged more (the POINT of the phase) and a fragile
    // club being rescued (also the point). Averaged together they cancel, and
    // a law doing exactly what was asked reads as a law making Division One
    // worse. The tails are what matter, so the tails are what is reported.
    worst: Math.min(...seats.map(s => s.net)),
    d1Rich: mean(d1.filter(s => s.net > 0).map(s => s.net)),
    d1Frail: mean(d1.filter(s => s.slot >= 4).map(s => s.net)),
    d2Bottom: mean(seats.filter(s => s.slot >= 13).map(s => s.net)),
    flagship: seats[0], bottomD1: seats[7], topD2: seats[8], bottom: seats[15],
    // THE MEDIAN OF THE SIXTEEN, sorted - not "the two middle slots". Those are
    // not the same club: operations fall with the slot number, so the two
    // middle SLOTS sit at one end of the sorted order, and anchoring on them
    // while the solver anchored on the true median left every arm charging a
    // different middle. The two definitions must be the same one.
    median: medianOf(seats.map(s => s.opsRound))
  };
}

// ---------------------------------------------------------------------------
// THE CANDIDATES. Derived from the measured ladder, not from a list.
//
// The support term's slope is set first, from the separation it has to buy.
// Today the club-scale half spans 1.11x while the following spans 5.14x. To
// move club-scale operations onto a real ladder, the support term has to be
// large enough to matter against a base of tens of thousands: at $2/supporter
// a flagship on 36,635 pays $73,270 a round against a minnow's $14,252 on
// 7,126, which is a $59,018 separation - about the size of today's whole
// base. That is the order of magnitude worth sweeping around.
//
// The base and the ground term then come DOWN to pay for it, because the
// median club must not simply be charged more.
// ---------------------------------------------------------------------------
const BASE = armOf(shipped);

// THE BASE IS SOLVED, NOT GUESSED. A first cut swept the base as a third free
// parameter and measured nothing useful: almost every combination happened to
// charge the median club far less than today, so the arms differed mostly in
// how big an across-the-board cost cut they were, and the tails "improved"
// because everybody had been handed money. The anchor has to bind.
//
// It binds exactly. The base is added to every club alike, so
//   median(x_i + base) = median(x_i) + base
// and the base that holds the median at today's is one subtraction. That
// leaves the two SHAPE parameters - what a seat costs and what a supporter
// costs - as the only things the sweep varies, which is what it is for.
const supOf = BASE.seats.map(s => s.support);
const seatOf = BASE.seats.map(s => foundingSeats(s.slot, s.slot === 0));
function baseFor(perSeat, perSupporter) {
  const without = BASE.seats.map((s, i) =>
    seatOf[i] * perSeat + supOf[i] * perSupporter + (s.div === 1 ? OPS_TOPFLIGHT_ROUND : 0));
  return Math.round(BASE.median - medianOf(without));
}

const CANDS = [];
for (const perSupporter of [0, 1.0, 1.5, 2.0, 2.25, 2.5, 2.75, 3.0, 3.5, 4.0]) {
  for (const perSeat of [1.55]) {
    const base = baseFor(perSeat, perSupporter);
    // a negative base is not a club cost, it is a subsidy dressed as one
    if (base < 0) continue;
    CANDS.push({
      tag: `seat$${perSeat}/sup$${perSupporter}/base$${Math.round(base / 100) / 10}k`,
      perSupporter, base, perSeat,
      law: scaled({ base, perSeat, perSupporter })
    });
  }
}
L('OPERATIONS CANDIDATE SWEEP   (' + (bySlot[0] || []).length + ' nations, era 2, '
  + 'division premium held at ' + $(OPS_TOPFLIGHT_ROUND) + ')');
L('='.repeat(112));
L('');
L('SHIPPED LAW, for comparison');
L('  median club ops/round ' + $(BASE.median)
  + '   flagship ' + $(BASE.flagship.opsRound) + '   bottom ' + $(BASE.bottom.opsRound));
L('  D1 mean net ' + $(BASE.d1Mean) + '   D2 mean net ' + $(BASE.d2Mean)
  + '   seats under water ' + BASE.underwater + '/16 (D1 ' + BASE.d1Under
  + ', D2 ' + BASE.d2Under + ')');
L('  bottom club ops/revenue ' + pcs(BASE.bottom.ops / BASE.bottom.revenue)
  + '   flagship ops/revenue ' + pcs(BASE.flagship.ops / BASE.flagship.revenue));
L('');

// ---------------------------------------------------------------------------
// THE CONTROL ARM. If the trouble were only that the base is too large, then
// lowering the base and steepening the EXISTING per-seat term would do the
// same work. Nine clubs share one capacity, so it should not - but that is a
// measurement, and here it is.
// ---------------------------------------------------------------------------
const ctrlSeat = 5.1;
const CTRL = armOf(steeperGround({ base: baseFor(ctrlSeat, 0), perSeat: ctrlSeat }));
L('CONTROL - no supporter term, steeper GROUND term ($' + ctrlSeat + '/seat, base '
  + $(baseFor(ctrlSeat, 0)) + ' solved to the same anchor)');
L('  median ' + $(CTRL.median) + '   flagship ' + $(CTRL.flagship.opsRound)
  + '   bottom ' + $(CTRL.bottom.opsRound)
  + '   separation flagship-vs-bottom ' + (CTRL.flagship.opsRound / CTRL.bottom.opsRound).toFixed(2) + 'x');
L('  D1 mean ' + $(CTRL.d1Mean) + '   D2 mean ' + $(CTRL.d2Mean)
  + '   under water ' + CTRL.underwater + '/16');
L('');

L('CANDIDATES');
L('');
L('law                          median ops   flagship    bottom   spread'
  + '   D1 frail 4-7   D2 bottom 13-15    flagship net   under');
L('-'.repeat(112));
const rows = [];
for (const c of CANDS) {
  const a = armOf(c.law);
  const clubHalf = a.flagship.opsRound - OPS_TOPFLIGHT_ROUND;
  rows.push({ ...c, a, spread: clubHalf / a.bottom.opsRound });
  L(c.tag.padEnd(28) + $(a.median).padStart(12) + $(a.flagship.opsRound).padStart(11)
    + $(a.bottom.opsRound).padStart(10)
    + ((clubHalf / a.bottom.opsRound).toFixed(2) + 'x').padStart(9)
    + $(a.d1Frail).padStart(15) + $(a.d2Bottom).padStart(18)
    + $(a.flagship.net).padStart(16)
    + (a.underwater + '/16').padStart(8));
}
L('');
L('  "spread" is the CLUB-SCALE half only: the flagship\'s operations less the');
L('  division premium, over the bottom club\'s. The shipped law scores '
  + ((BASE.flagship.opsRound - OPS_TOPFLIGHT_ROUND) / BASE.bottom.opsRound).toFixed(2) + 'x.');
L('');

// candidates that hold the median within 5% of today's
const near = rows.filter(r => Math.abs(r.a.median - BASE.median) / BASE.median <= 0.05);
L('HOLDING THE MEDIAN WITHIN 5% OF TODAY (' + $(BASE.median) + ' a round)');
L('');
if (!near.length) L('  none');
for (const r of near.sort((x, y) => y.spread - x.spread)) {
  L('  ' + r.tag.padEnd(28) + 'median ' + $(r.a.median).padStart(10)
    + '   spread ' + (r.spread.toFixed(2) + 'x').padStart(7)
    + '   D1 ' + $(r.a.d1Mean).padStart(13) + '   D2 ' + $(r.a.d2Mean).padStart(13)
    + '   under ' + r.a.underwater + '/16');
}

// ---------------------------------------------------------------------------
// AND WHAT IS ACTUALLY MOVING. The means above hide the thing that matters:
// which SEATS change. A law that scales on the following does not treat "big"
// and "doing well" as the same thing, and Division One's failing seats are not
// small clubs - they are large-following clubs with large payrolls finishing
// low. This prints the seat-by-seat net so that can be read rather than
// guessed at.
// ---------------------------------------------------------------------------
const SHOW = ['seat$1.55/sup$2/base$48.9k', 'seat$1.55/sup$3/base$29k',
  'seat$1.55/sup$0/base$88.6k'];
const shown = rows.filter(r => SHOW.includes(r.tag));
L('');
L('SEAT BY SEAT - annual net, and the operations behind it');
L('');
L('slot div      support   SHIPPED ops        net' + shown.map(r =>
  ('   ' + r.tag.split('/').slice(1).join('/')).padStart(34)).join(''));
L('-'.repeat(52 + 34 * shown.length));
for (let i = 0; i < 16; i++) {
  const b = BASE.seats[i];
  L(String(b.slot).padStart(4) + String(b.div).padStart(4)
    + Math.round(b.support).toLocaleString().padStart(13)
    + $(b.opsRound).padStart(13) + $(b.net).padStart(12)
    + shown.map(r => {
      const s = r.a.seats[i];
      return ($(s.opsRound).padStart(14) + $(s.net).padStart(14)
        + ((s.net > b.net ? '+' : '') + Math.round((s.net - b.net) / 1000) + 'k').padStart(6));
    }).join(''));
}
