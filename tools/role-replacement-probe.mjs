#!/usr/bin/env node
/* tools/role-replacement-probe.mjs — WHAT IS +5 OVR WORTH, BY ROLE?
 *
 * PHASE 3 §8-§9. A marginal per-point value is not enough to price a
 * cricketer, because roles do not get the same number of points to spend or
 * the same number of deliveries to spend them on. A bowler touches every ball
 * of his ten overs; a number seven may not face one.
 *
 * So the question is asked the way a manager asks it: take a full XI, replace
 * ONE man with a better man of the SAME role - better by five points of card,
 * built by scaling his own skills through the engine's own foFitToLevel so the
 * upgrade is a genuine five overall rather than five points on some attributes
 * - and play the season out on paired seeds.
 *
 * WHAT IT DECIDES. If +5 OVR at one role is worth three times what it is worth
 * at another, then OVR is not a common currency and the wage curve - which is
 * a pure function of OVR - is paying two different prices for the same number.
 * That is the cross-role parity §9 asks for, and it is measured rather than
 * asserted.
 *
 *   node tools/role-replacement-probe.mjs --n=300
 */
import vm from 'node:vm';
import { makeHarness, summary, per50, arg, has } from './realism-lib.mjs';
import fs from 'node:fs';

const N = parseInt(arg('n', '300'), 10);
const H = makeHarness();
const g = k => vm.runInContext(k, H.ctx);

// the man in each seat, and what a replacement of his kind looks like
const SEATS = [
  { role: 'batsman', slot: 2 },
  { role: 'bowler', slot: 6 },
  { role: 'allRounder', slot: 4 },
  { role: 'keeper', slot: 5 }
];

const ovrOf = p => JSON.parse(g(`JSON.stringify(window.foPlayerValue(${JSON.stringify(p)}))`)).ovr;

// fit a copy of a man to (his own overall + d), by the engine's own bisection
function upgraded(p, d) {
  const c = JSON.parse(JSON.stringify(p));
  const lvl = JSON.parse(g(`JSON.stringify(window.foPlayerValue(${JSON.stringify(c)}))`)).level;
  const want = g(`window.foLevelForOvr(${(JSON.parse(g(`JSON.stringify(window.foPlayerValue(${JSON.stringify(c)}))`)).ovr + d)})`);
  const out = g(`(function(j,t){var p=JSON.parse(j);window.foFitToLevel(p,t);return JSON.stringify(p)})`
    + `(${JSON.stringify(JSON.stringify(c))},${want})`);
  return JSON.parse(out);
}

function marginOf(r) {
  let scored = null, conceded = null;
  for (const inn of [r.i1, r.i2]) {
    if (!inn) continue;
    if (inn.batTeam === 'A') scored = per50(inn.runs, inn.legal);
    else conceded = per50(inn.runs, inn.legal);
  }
  return (scored != null && conceded != null) ? scored - conceded : null;
}
const winOf = r => r.winner === 'A' ? 1 : (r.winner ? 0 : 0.5);

const B = H.side('B', {});
const out = { n: N, rows: [] };
console.log(`\n=== +5 OVR AT ONE SEAT, INSIDE A FULL XI (N=${N} paired) ===`);
console.log('  seat          ovr before -> after    d margin/50     per OVR   win pts');
for (const seat of SEATS) {
  const base = H.side('A', {});
  const man = base.players[seat.slot];
  const o0 = ovrOf(man);
  const up = upgraded(man, 5);
  const o1 = ovrOf(up);
  const hi = H.side('A', {});
  hi.players[seat.slot] = up;
  const dm = [], dv = [];
  for (let i = 0; i < N; i++) {
    const s = 940001 + i * 104729;
    const r1 = H.run(base, B, s, {}), r2 = H.run(hi, B, s, {});
    if (!r1 || !r2) continue;
    const m1 = marginOf(r1), m2 = marginOf(r2);
    if (m1 != null && m2 != null) dm.push(m2 - m1);
    dv.push(winOf(r2) - winOf(r1));
  }
  const D = summary(dm), W = summary(dv);
  // the ACTUAL overall gained, not the five that was asked for - foFitToLevel
  // lands on a level, and the curve turns that into a card that may round to
  // 4.7 or 5.3. Dividing by what was actually bought is the difference between
  // a value and an approximation of one.
  const gained = o1 - o0;
  out.rows.push({ seat: seat.role, ovrBefore: o0, ovrAfter: o1, gained,
    dMargin: D, perOvr: D.mean / Math.max(1e-9, gained), dWin: W });
  console.log('  ' + seat.role.padEnd(13)
    + (o0.toFixed(1) + ' -> ' + o1.toFixed(1)).padStart(18)
    + (D.mean.toFixed(2) + '±' + D.se.toFixed(2)).padStart(15)
    + (D.mean / Math.max(1e-9, gained)).toFixed(3).padStart(12)
    + (100 * W.mean).toFixed(1).padStart(10));
}
fs.writeFileSync('docs/player-value-realism/role-replacement.json', JSON.stringify(out, null, 1));
