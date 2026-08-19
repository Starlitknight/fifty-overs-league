#!/usr/bin/env node
/* tools/attribute-value-probe.mjs — WHAT IS A POINT WORTH?
 *
 * The evidence base for the coming OVR / wage / transfer recalibration.
 * Every attribute the card displays, swept +10 points around ordinary level
 * on ONE man, paired against the identical control on identical seeds, and
 * priced in the currency that matters: runs of match margin.
 *
 * ROLE MATTERS AND IS REPORTED SEPARATELY. A point of wicket-threat is worth
 * nothing to a man who never bowls; a point of keeping is worth nothing to
 * anyone but the keeper. Each attribute is measured on the man whose job it
 * is:
 *   bat family   slot 2 (a top-order batsman)
 *   bowl family  slot 6 (the strike bowler)
 *   gloves       slot 5 (the keeper)
 *   fielding     slot 2 (an outfielder; the assignment engine places him)
 *   captaincy    slot 0 (the armband)
 *
 * MARGIN, NOT RUNS SCORED. A batting point shows up as runs scored and a
 * bowling point as runs prevented, so the only comparable currency is the
 * side's own margin: (A's runs per 50) - (what A conceded per 50). One
 * number, every attribute, directly comparable - which is exactly what a
 * rating weight needs.
 *
 *   node tools/attribute-value-probe.mjs --n=300 --json
 */
import { makeHarness, summary, per50, arg, has } from './realism-lib.mjs';

const N = parseInt(arg('n', '250'), 10);
// A +10 STEP IS BELOW THE ENGINE'S RESOLUTION for the small attributes: a
// match is quantised (each ball's outcome flips only if the shifted
// probability crosses that ball's draw), and a ten-point move on, say,
// moveTurn changes the distribution by ~0.005pp - which flips no ball at all
// in most matches, and duly measured 0.00+-0.00 at every seed. So the sweep
// runs at +30 and the per-point figure is that divided by 30: three times
// the signal for the same sample, from a span that is still ordinary
// cricketers (45 -> 75).
const STEP = parseInt(arg('step', '30'), 10);
const BASE = parseInt(arg('base', '45'), 10);
const H = makeHarness();
const say = s => { if (!has('json')) console.log(s); };
const f = (x, n = 3) => (x == null || !isFinite(x) ? '   -  ' : (+x).toFixed(n).padStart(8));

// every attribute, the man whose job it is, and how to raise it
const ATTRS = [
  ['vsPace', 2, 'skills', 'batting'],
  ['vsSpin', 2, 'skills', 'batting'],
  ['power', 2, 'skills', 'batting'],
  ['rotation', 2, 'skills', 'batting'],
  ['temperament', 2, 'skills', 'batting'],
  ['exp', 2, 'field', 'batting'],
  ['wicket', 6, 'skills', 'bowling'],
  ['economy', 6, 'skills', 'bowling'],
  ['discipline', 6, 'skills', 'bowling'],
  ['moveTurn', 6, 'skills', 'bowling'],
  ['variation', 6, 'skills', 'bowling'],
  ['stamina', 6, 'skills', 'bowling'],
  ['exp_bowl', 6, 'field', 'bowling'],
  ['fielding', 2, 'skills', 'fielding'],
  ['catching', 2, 'skills', 'fielding'],
  ['keeping', 5, 'skills', 'gloves'],
  ['stumping', 5, 'skills', 'gloves'],
  ['catching_wk', 5, 'skills', 'gloves'],
  ['capt', 0, 'field', 'captaincy']
];

function sideWith(attr, slotIx, kind, lvl) {
  const slot = { slot: slotIx };
  if (kind === 'field') {
    if (attr === 'capt') slot.capt = lvl;
    else slot.exp = lvl;                    // exp and exp_bowl both set p.exp
  } else {
    const key = attr === 'catching_wk' ? 'catching' : attr;
    slot.skills = { [key]: lvl };
  }
  return H.side('A', { slots: [slot] });
}

// margin = what A scored per 50 minus what A conceded per 50
function marginOf(r) {
  let scored = null, conceded = null;
  for (const inn of [r.i1, r.i2]) {
    if (!inn) continue;
    if (inn.batTeam === 'A') scored = per50(inn.runs, inn.legal);
    else conceded = per50(inn.runs, inn.legal);
  }
  return (scored != null && conceded != null) ? scored - conceded : null;
}

const B = H.side('B', {});
const out = { step: STEP, base: BASE, n: N, rows: [] };
say(`\n=== MARGINAL VALUE OF +${STEP} POINTS (from ${BASE}), paired, N=${N} ===`);
say('  attribute        role        d margin/50     per point   win pts');
for (const [attr, slotIx, kind, role] of ATTRS) {
  const lo = sideWith(attr, slotIx, kind, BASE);
  const hi = sideWith(attr, slotIx, kind, BASE + STEP);
  const dm = [], dv = [];
  for (let i = 0; i < N; i++) {
    const s = 940001 + i * 104729;
    const r1 = H.run(lo, B, s, {}), r2 = H.run(hi, B, s, {});
    if (!r1 || !r2) continue;
    const m1 = marginOf(r1), m2 = marginOf(r2);
    if (m1 != null && m2 != null) dm.push(m2 - m1);
    const w = r => r.winner === 'A' ? 1 : (r.winner ? 0 : 0.5);
    dv.push(w(r2) - w(r1));
  }
  const D = summary(dm), W = summary(dv);
  out.rows.push({ attr, role, dMargin: D, perPoint: D.mean / STEP, dWin: W });
  say('  ' + attr.padEnd(16) + role.padEnd(11) + f(D.mean, 2) + '±' + D.se.toFixed(2)
    + f(D.mean / STEP, 3) + f(100 * W.mean, 1));
}
if (has('json')) console.log(JSON.stringify(out, null, 1));
