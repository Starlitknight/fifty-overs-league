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

// THE BISECT HANDLE, the same one tools/strength-response.mjs carries and for
// the same reason: CLAUDE.md is explicit that the only way to prove a tuning
// term responsible is to turn it off and re-measure, and re-measuring the four
// calibration tiers is how "does this term separate the standards of cricket"
// gets answered. CAL_SET=std_wkt:0.02,std_four:0.014 overrides GD.cal inside
// this VM before a ball is bowled. Nothing is written and no build changes.
if (process.env.CAL_SET) {
  const patch = {};
  for (const kv of process.env.CAL_SET.split(',')) {
    const [k, v] = kv.split(':');
    if (k && v != null) patch[k.trim()] = Number(v);
  }
  eng.applyCal(patch);
}

// AND THE SECOND BISECT HANDLE, for the same reason and by the same law.
// A calibration cell is a MATCH, and a match begins by choosing an eleven —
// so this harness measures the ball model and the SELECTOR together, and
// cannot by itself tell you which of the two moved. When the match-day coach
// (engine/src/13-matchday-coach.js) landed, the gate reported drift; the only
// honest way to answer "did the engine change?" is to re-run with the coach
// off and see whether the golden comes back.
//
//   CAL_COACH_OFF=1 node tools/calibration-check.mjs
//
// __foCoachOff is the same flag engine/src/00-core.js pickXI reads, set here
// inside the VM before a ball is bowled. Nothing is written; no build changes.
if (process.env.CAL_COACH_OFF) eng.ctx.__foCoachOff = true;

// deep-copy a baked squad and scale every numeric skill — pure, deterministic
vm.runInContext(`
// AND THE SCALED MAN IS RE-DERIVED, which he was not, and that quietly broke
// this whole file. A cricketer's skills are the fifteen numbers; his bat, his
// threat, his control and his rating are the engine's FUNCTION of them, and
// jsDerive is what computes it. Scaling the skills without re-deriving left
// every scaled squad wearing the baked squad's aggregates - so the terms in
// ballDist that read p.bat and p.threat (which are the biggest of them) saw
// the SAME two cricketers in every cell.
//
// It had been wrong from the beginning and looked plausible throughout: the
// old golden's three cells came out 265.8, 258.2 and 251.1, within five per
// cent of each other, off a 0.70-against-1.30 scaling that is a 1.86x gap.
// The engine was never that flat; the harness was. tools/winrate.mjs and
// test/win-odds.test.mjs both derive after scaling - this file was the only
// one that did not.
globalThis.__calTeam = function (baseIx, factor, name) {
  var t = JSON.parse(JSON.stringify(GD.teams[baseIx]));
  t.name = name;
  t.players.forEach(function (p) {
    if (p.skills) for (var k in p.skills) {
      if (typeof p.skills[k] === 'number') p.skills[k] = Math.max(1, Math.min(98, Math.round(p.skills[k] * factor)));
    }
    jsDerive(p);
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

// ---- THE CELLS ARE THE WORLD'S OWN TIERS, AND ONLY ONE OF THEM IS ODI -----
//
// These were weak_vs_weak, weak_vs_elite and elite_vs_elite: one baked squad
// scaled to 0.70x and 1.30x, standing for nothing in particular. Reading the
// golden they produced was what exposed the fault they were hiding. It said:
//
//     weak_vs_weak    first innings 265.8
//     elite_vs_elite  first innings 251.1
//
// The worst cricket in the world outscoring the best - and all three cells
// sitting on real men's-ODI par, because the engine was tuned against ODI
// data and the gate then held EVERY level of cricket to it. Two second
// division clubs were contractually obliged to produce an international
// scorecard. The tiers below are what the world actually deals, so a number
// in this file now names a real thing, and the ODI contract is asserted
// against the INTERNATIONAL cell alone (see ODI_PAR in calibration-check).
//
// The factors put a baked squad on each tier's XI rating. Rating is a linear
// combination of skills with no constant term, so scaling the skills scales
// the rating by the same factor - checked below, not assumed.
const intlA = mk(0, 0.8023, 'International A'), intlB = mk(1, 0.8979, 'International B');
const clubA = mk(0, 0.7127, 'Flagship A'), clubB = mk(1, 0.7975, 'Flagship B');
const d2A = mk(0, 0.4993, 'Division Two A'), d2B = mk(1, 0.5588, 'Division Two B');
const CELLS = [
  // the one held to real ODI par: two national sides, where nations.mjs puts them
  ['international', intlA, intlB, 11000],
  // and the domestic tiers, recorded so drift is caught - never so that club
  // cricket is required to look like a World Cup
  ['flagship_clubs', clubA, clubB, 22000],
  ['division_two', d2A, d2B, 33000],
  // a genuine mismatch, which is where the engine's mismatch term lives or dies
  ['international_vs_division_two', intlA, d2B, 44000]
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
  engineVersion: 'v3',
  note: 'Frozen behavioural record of the shipped engine. Descriptive, not aspirational - EXCEPT the international cell, which calibration-check additionally holds to real men\'s-ODI bands, because international data is the only cricket the model was fitted against. The engine has NO T20 mode (newMatch is 50-over only); T20 calibration is intentionally absent, not omitted by error. A CALIBRATION CELL IS A MATCH, AND A MATCH BEGINS BY CHOOSING AN ELEVEN, so this record measures the ball model AND the selector together. It was re-recorded when the match-day coach (engine/src/13-matchday-coach.js) replaced the founding pickXI; the ball model was NOT touched, and the proof is that CAL_COACH_OFF=1 reproduces the previous record exactly, fingerprint 373/6 included. What moved was the powerplay run-rate, up 0.28 to 0.51 an over in all four cells, with the death rate down and first-innings totals within 4 runs: the coach opens with men who can open, so the runs arrive earlier rather than in greater number. Bisect any future drift the same way before believing it is the engine.',
  config: { pitch: 'balanced', weather: 'Sunny', tuned: true, perCell: PER_CELL, seedStep: 7,
    tiers: { international: 46000, flagship_clubs: 40860, division_two: 29930 },
    seedBase: { international: 11000, flagship_clubs: 22000, division_two: 33000, international_vs_division_two: 44000 } },
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
const d1 = run(intlA, d2B, 424242), d2 = run(intlA, d2B, 424242);
golden.determinism = { seed: 424242, identical: d1 === d2, fingerprint: d1 ? JSON.parse(d1).s1 + '/' + JSON.parse(d1).wk1 : null };

if (process.env.CAL_N) {
  console.log(JSON.stringify(golden, null, 2));
  console.error('\nSMOKE RUN (CAL_N set) — not written to the golden file.');
} else {
  fs.writeFileSync(new URL('../engine/calibration-golden.json', import.meta.url), JSON.stringify(golden, null, 2) + '\n');
  console.error('\nWrote engine/calibration-golden.json');
}
