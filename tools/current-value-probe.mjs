#!/usr/bin/env node
/* tools/current-value-probe.mjs — HOW BIG IS EXPERIENCE, AND WHERE DOES IT GO?
 *
 * FINAL CLOSURE §5-§7. Two attributes are worth real runs and are on nobody's
 * card, and they are worth them in completely different ways:
 *
 *   EXPERIENCE  every man carries his own, all the time. It is a property of
 *               the cricketer.
 *   CAPTAINCY   is worth nothing at all to ten of the eleven men on the field.
 *               It is a property of the ARMBAND, and only one man wears it.
 *
 * That difference decides the architecture before any number is measured, and
 * the numbers below only decide the size.
 *
 * WHY THIS CANNOT BE PRICED FROM THE ONE PAIR TEST. +4.16 +- 1.60 runs for a
 * 64-point experience gap is one seat, one role, one span. A weight has to hold
 * for a bowler and an all-rounder too, and it has to be linear enough across
 * the range that pricing the middle does not misprice the ends. So experience
 * is swept at four levels in three seats.
 *
 *   node tools/current-value-probe.mjs --n=600
 */
import vm from 'node:vm';
import fs from 'node:fs';
import { makeHarness, summary, per50, arg, has } from './realism-lib.mjs';

const N = parseInt(arg('n', '600'), 10);
const H = makeHarness();
const g = k => vm.runInContext(k, H.ctx);

function marginOf(r) {
  let sc = null, co = null;
  for (const inn of [r.i1, r.i2]) {
    if (!inn) continue;
    if (inn.batTeam === 'A') sc = per50(inn.runs, inn.legal); else co = per50(inn.runs, inn.legal);
  }
  return (sc != null && co != null) ? sc - co : null;
}
const winOf = r => r.winner === 'A' ? 1 : (r.winner ? 0 : 0.5);
const B = H.side('B', {});

// PAIRED AGAINST THE SAME SEAT AT A REFERENCE LEVEL, not against each other in
// sequence: the difference of two runs on one seed is what carries the pairing,
// and an unpaired sweep would throw the variance reduction away.
function sweepSeat(seat, label, levels, ref, mkSpec) {
  const rows = [];
  const base = H.side('A', { slots: [Object.assign({ slot: seat }, mkSpec(ref))] });
  for (const lv of levels) {
    const side = H.side('A', { slots: [Object.assign({ slot: seat }, mkSpec(lv))] });
    const d = [], w = [];
    for (let i = 0; i < N; i++) {
      const s = 940001 + i * 104729;
      const r0 = H.run(base, B, s, {}), r1 = H.run(side, B, s, {});
      if (!r0 || !r1) continue;
      const m0 = marginOf(r0), m1 = marginOf(r1);
      if (m0 != null && m1 != null) d.push(m1 - m0);
      w.push(winOf(r1) - winOf(r0));
    }
    const D = summary(d), W = summary(w);
    rows.push({ seat: label, lv, dMargin: D, dWin: W });
    console.log('  ' + label.padEnd(14) + String(lv).padStart(4)
      + (D.mean.toFixed(2) + '±' + D.se.toFixed(2)).padStart(15)
      + (100 * W.mean).toFixed(1).padStart(8));
  }
  return rows;
}

const out = { n: N };
const EXPL = [20, 45, 70, 95], REF = 45;

console.log(`\n=== §6 EXPERIENCE, SWEPT IN THREE SEATS (N=${N} paired, vs exp ${REF}) ===`);
console.log('  seat            exp     d margin/50    win pts');
const batRows = sweepSeat(2, 'batsman', EXPL, REF, lv => ({ exp: lv }));
const bowlRows = sweepSeat(6, 'bowler', EXPL, REF, lv => ({ exp: lv, bowlTypeFull: 'seamFastMedium' }));
const arRows = sweepSeat(4, 'all-rounder', EXPL, REF, lv => ({ exp: lv, role: 'allRounder',
  bowlTypeFull: 'seamMedium',
  skills: { vsPace: 62, vsSpin: 60, rotation: 60, power: 56, temperament: 58,
    wicket: 58, economy: 56, discipline: 54, moveTurn: 54, variation: 52, stamina: 60 } }));
out.experience = { ref: REF, bat: batRows, bowl: bowlRows, ar: arRows };

// A SLOPE PER POINT, fitted through the origin at the reference, weighted by
// 1/se^2. The three seats are fitted separately AND together, because a single
// weight has to serve all of them and the spread between them is the honest
// error bar on that weight.
function slope(rows) {
  let num = 0, den = 0;
  for (const r of rows) {
    const x = r.lv - REF; if (!x) continue;
    const wt = 1 / Math.pow(r.dMargin.se, 2);
    num += wt * x * r.dMargin.mean; den += wt * x * x;
  }
  return { slope: num / Math.max(1e-9, den), se: 1 / Math.sqrt(Math.max(1e-9, den)) };
}
const sB = slope(batRows), sW = slope(bowlRows), sA = slope(arRows);
const sAll = slope(batRows.concat(bowlRows, arRows));
console.log('\n  runs per point of experience');
console.log(`    batsman      ${sB.slope.toFixed(4)} ± ${sB.se.toFixed(4)}`);
console.log(`    bowler       ${sW.slope.toFixed(4)} ± ${sW.se.toFixed(4)}`);
console.log(`    all-rounder  ${sA.slope.toFixed(4)} ± ${sA.se.toFixed(4)}`);
console.log(`    all seats    ${sAll.slope.toFixed(4)} ± ${sAll.se.toFixed(4)}`);
out.experienceSlope = { bat: sB, bowl: sW, ar: sA, all: sAll };

// ---------------------------------------------------------------------------
// §7 CAPTAINCY. The value is real and it belongs to ONE man in fifteen.
// ---------------------------------------------------------------------------
console.log(`\n=== §7 CAPTAINCY, AS CAPTAIN AND AS A TEAMMATE (N=${N} paired) ===`);
console.log('  case                       d margin/50    win pts');
function captCase(label, asCaptain) {
  // seat 0 wears the armband in the harness's XI; seat 3 never does, so the
  // same attribute on the same kind of cricketer is measured both ways
  const seat = asCaptain ? 0 : 3;
  const lo = H.side('A', { slots: [{ slot: seat, capt: 30 }] });
  const hi = H.side('A', { slots: [{ slot: seat, capt: 95 }] });
  const d = [], w = [];
  for (let i = 0; i < N; i++) {
    const s = 940001 + i * 104729;
    const r0 = H.run(lo, B, s, {}), r1 = H.run(hi, B, s, {});
    if (!r0 || !r1) continue;
    const m0 = marginOf(r0), m1 = marginOf(r1);
    if (m0 != null && m1 != null) d.push(m1 - m0);
    w.push(winOf(r1) - winOf(r0));
  }
  const D = summary(d), W = summary(w);
  console.log('  ' + label.padEnd(26) + (D.mean.toFixed(2) + '±' + D.se.toFixed(2)).padStart(14)
    + (100 * W.mean).toFixed(1).padStart(9));
  return { label, dMargin: D, dWin: W };
}
out.captaincy = [
  captCase('capt 30->95, IS captain', true),
  captCase('capt 30->95, NOT captain', false)
];

fs.writeFileSync('docs/fast-bowler-generation/current-value.json', JSON.stringify(out, null, 1));
