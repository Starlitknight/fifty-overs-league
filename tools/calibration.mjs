/* tools/calibration.mjs — STEP 0 of the World Service: the engine freeze.
 *
 * Runs the CURRENT shipped engine (test/engine-vm.mjs, proven bit-identical
 * to the browser) over a skill matrix and records what it ACTUALLY does —
 * no tuning, no judgement — into engine/calibration-golden.json. That file
 * is the frozen behavioural contract the server must forever honour for
 * engine version v1: any drift beyond tolerance fails CI (calibration-check).
 *
 *   node tools/calibration.mjs              # full run (~10,000 matches)
 *   CAL_N=200 node tools/calibration.mjs    # quick smoke (not for the golden)
 *
 * Matrix: weak-vs-weak, weak-vs-elite, elite-vs-elite on a balanced pitch,
 * sunny, tuned model ON (the shipped configuration). The engine has no T20
 * mode (newMatch is 50-over only); this is recorded, not worked around.
 * Skill tiers scale a baseline squad's skills by 0.70 (weak) / 1.30 (elite,
 * clamped 1..98) — deterministic, no generation randomness.
 */
import vm from 'node:vm';
import fs from 'node:fs';
import { makeEngine } from '../test/engine-vm.mjs';

const PER_CELL = Math.max(10, parseInt(process.env.CAL_N || '3334', 10));
const eng = makeEngine();
eng.setTuning(true);

// deep-copy a baked squad and scale every numeric skill — pure, deterministic
vm.runInContext(`
globalThis.__calTeam = function (baseIx, factor, name) {
  var t = JSON.parse(JSON.stringify(GD.teams[baseIx]));
  t.name = name;
  t.players.forEach(function (p) {
    if (p.skills) for (var k in p.skills) {
      if (typeof p.skills[k] === 'number') p.skills[k] = Math.max(1, Math.min(98, Math.round(p.skills[k] * factor)));
    }
  });
  return t;
};
globalThis.__calRun = function (ta, tb, seed) {
  onMatchEnd = function () {};
  M = newMatch(ta, tb, 'balanced', (seed >>> 0) || 1);
  M.meta = { home: ta.name, away: tb.name, pitch: 'balanced', weather: 'Sunny', comp: 'cal', isUser: false };
  M.isUserMatch = false; M.ordersMap = {};
  App.tossState = { stage: 'x' };
  applyToss(aiTossDecision());
  var g = 0;
  while (M && !M.done && g++ < 4000) { autoPick(); stepBall(); }
  if (!M || !M.done) return null;
  var i1 = M.innings[0], i2 = M.innings[1];
  var batR = function (inn) { var s = 0; (inn.bat || []).forEach(function (b) { s += (+b.r || 0); }); return s; };
  // boundaries + extras counted from the ball-by-ball log of innings 1
  var log = (M.log || []).map(function (l) { return typeof l === 'string' ? l : (l && l.txt) || ''; }).join('\\n');
  var fours = (log.match(/FOUR/g) || []).length, sixes = (log.match(/SIX/g) || []).length;
  var legalAll = (i1.legal || 0) + ((i2 && i2.legal) || 0);
  // phase run-rates from the first-innings worm (over, cumulativeRuns, wkts)
  var w0 = (M.worm && M.worm[0]) || [];
  var at = function (ov) { var best = 0; for (var i = 0; i < w0.length; i++) if (w0[i][0] <= ov + 1e-9) best = w0[i][1]; return best; };
  var r10 = at(10), r40 = at(40), rEnd = i1.runs;
  var margin = null;
  if (M.result && M.result.winner === (i1.batTeam || null)) margin = i1.runs - (i2 ? i2.runs : 0);
  return JSON.stringify({
    s1: i1.runs, wk1: i1.wkts, ex1: Math.max(0, i1.runs - batR(i1)),
    s2: i2 ? i2.runs : null, wk2: i2 ? i2.wkts : null,
    legal1: i1.legal || 0, legalAll: legalAll, fours: fours, sixes: sixes,
    r10: r10, rMid: r40 - r10, rDeath: rEnd - r40,
    tie: !!(M.result && M.result.winner === null), runMargin: margin
  });
};`, eng.ctx);
const mk = vm.runInContext('__calTeam', eng.ctx);
const run = vm.runInContext('__calRun', eng.ctx);

const weakA = mk(0, 0.70, 'Weak A'), weakB = mk(1, 0.70, 'Weak B');
const eliteA = mk(0, 1.30, 'Elite A'), eliteB = mk(1, 1.30, 'Elite B');
const CELLS = [
  ['weak_vs_weak', weakA, weakB, 11000],
  ['weak_vs_elite', weakA, eliteB, 22000],
  ['elite_vs_elite', eliteA, eliteB, 33000]
];

function aggregate(rows) {
  const n = rows.length;
  const mean = k => rows.reduce((a, r) => a + (+r[k] || 0), 0) / n;
  const m1 = mean('s1');
  const sd = Math.sqrt(rows.reduce((a, r) => a + Math.pow(r.s1 - m1, 2), 0) / n);
  const hist = Array(11).fill(0);
  rows.forEach(r => { hist[Math.max(0, Math.min(10, r.wk1 | 0))]++; });
  const balls = rows.reduce((a, r) => a + r.legalAll, 0);
  const bnd = rows.reduce((a, r) => a + r.fours + r.sixes, 0);
  const runMarginWins = rows.filter(r => r.runMargin != null);
  return {
    n,
    firstInnings: { mean: +m1.toFixed(1), stddev: +sd.toFixed(1) },
    wicketsHistogram: hist.map(c => +(c / n).toFixed(4)),
    boundaryPctPerBall: +(bnd / balls * 100).toFixed(2),
    extrasPerInnings: +mean('ex1').toFixed(2),
    runRateByPhase: {
      powerplay_1_10: +(mean('r10') / 10).toFixed(2),
      middle_11_40: +(mean('rMid') / 30).toFixed(2),
      death_41_50: +(mean('rDeath') / 10).toFixed(2)
    },
    tiePct: +(rows.filter(r => r.tie).length / n * 100).toFixed(2),
    pctRunWinsUnder20: +(runMarginWins.filter(r => r.runMargin < 20).length / n * 100).toFixed(2)
  };
}

const golden = {
  engineVersion: 'v1',
  note: 'Frozen behavioural record of the shipped engine. Descriptive, not aspirational. The engine has NO T20 mode (newMatch is 50-over only); T20 calibration is intentionally absent, not omitted by error.',
  config: { pitch: 'balanced', weather: 'Sunny', tuned: true, weakFactor: 0.70, eliteFactor: 1.30, perCell: PER_CELL, seedBase: { weak_vs_weak: 11000, weak_vs_elite: 22000, elite_vs_elite: 33000 }, seedStep: 7 },
  formats: { fiftyOver: true, t20: 'unsupported-by-engine-v1' },
  cells: {}
};
const t0 = Date.now();
for (const [name, ta, tb, base] of CELLS) {
  const rows = [];
  for (let i = 0; i < PER_CELL; i++) {
    const j = run(ta, tb, base + i * 7);
    if (j) rows.push(JSON.parse(j));
  }
  golden.cells[name] = aggregate(rows);
  console.error(name + ': ' + rows.length + '/' + PER_CELL + ' matches complete (' + ((Date.now() - t0) / 1000 | 0) + 's)');
}
// determinism proof stored in the golden itself: one pinned match, twice
const d1 = run(weakA, eliteB, 424242), d2 = run(weakA, eliteB, 424242);
golden.determinism = { seed: 424242, identical: d1 === d2, fingerprint: d1 ? JSON.parse(d1).s1 + '/' + JSON.parse(d1).wk1 : null };

if (process.env.CAL_N) {
  console.log(JSON.stringify(golden, null, 2));
  console.error('\nSMOKE RUN (CAL_N set) — not written to the golden file.');
} else {
  fs.writeFileSync(new URL('../engine/calibration-golden.json', import.meta.url), JSON.stringify(golden, null, 2) + '\n');
  console.error('\nWrote engine/calibration-golden.json');
}
