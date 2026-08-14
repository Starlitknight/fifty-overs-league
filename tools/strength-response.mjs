#!/usr/bin/env node
/* tools/strength-response.mjs — DOES BEING BETTER AT CRICKET MAKE YOU WIN?
 *
 * The engine is calibrated in the middle of its range and frozen there by
 * engine/calibration-golden.json. That gate asks only "does the engine still do
 * what it did", and it asks it at three points. This asks a different question
 * across the whole range a world might one day use: as a side gets better, does
 * it keep getting better at cricket - and does the cricket still look like
 * cricket at both ends?
 *
 *   node tools/strength-response.mjs --sweep            # one XI at each level
 *   node tools/strength-response.mjs --matrix           # the pairings matrix
 *   node tools/strength-response.mjs --players          # individual archetypes
 *   node tools/strength-response.mjs --shapes           # asymmetric XIs
 *   node tools/strength-response.mjs --all --n=400 --json > out.json
 *
 * IT CHANGES NOTHING. Every number here is read out of the SHIPPED build in a
 * VM; this file has no opinion about what the engine should do, only a record
 * of what it does.
 *
 * ---------------------------------------------------------------------------
 * THE LEVEL SCALE, AND WHY IT IS NOT OVR
 *
 * The engine consumes RAW CRICKET SKILLS on 1-99 - vsPace, temperament, wicket,
 * economy and the rest. It has never seen a display OVR and must not: OVR is a
 * label for humans and is being redesigned separately.
 *
 * So the axis here is LEVEL L, defined for calibration only:
 *
 *     a squad at level L has the skills of the baked reference squad, shifted
 *     so that its OWN MEAN SKILL is L, with every man's and every skill's
 *     offset from that mean preserved.
 *
 * That is a deliberate choice and the reason for it is the thing being tested.
 * Production's `calibrate()` reaches a target by MULTIPLYING every skill and
 * clamping at 2, which at low targets pins whole squads onto the floor and
 * destroys the shape that makes one cricketer different from another. Shifting
 * additively keeps a fast bowler a fast bowler and an opener an opener at every
 * level, which is what §17 of the brief requires and what the eventual world
 * model needs.
 *
 * BOTH ARE MEASURED. `--mode=shape` is the additive scale above; `--mode=cal`
 * drives the same targets through production's own multiplicative calibrate().
 * Running the two and diffing them is how the calibration layer is told apart
 * from the engine underneath it - which is the whole diagnostic question, and
 * cannot be settled by reading either one of them.
 *
 * L is NOT claimed to equal display OVR. It is a skill-space coordinate, and
 * the mapping from playing ability to a shown 0-100 is a later, separate job.
 * ---------------------------------------------------------------------------
 */
import vm from 'node:vm';
import { makeEngine } from '../test/engine-vm.mjs';

const arg = (k, d) => {
  const hit = process.argv.find(a => a.startsWith('--' + k + '='));
  return hit ? hit.split('=')[1] : d;
};
const has = k => process.argv.includes('--' + k);
const N = parseInt(arg('n', '200'), 10);          // matches per pairing
const MODE = arg('mode', 'shape');                // shape | cal
const JSONOUT = has('json');
const ALL = has('all');

const eng = makeEngine();
eng.setTuning(true);

// ---------------------------------------------------------------------------
// BUILDING AN XI AT A LEVEL
//
// The reference squads are the two baked into the build (GD.teams[0] and [1]).
// They are real squads with real roles, real bowling types and a real spread,
// so a level-L copy of one is a plausible cricket side rather than eleven
// identical men - which matters, because a homogeneous test XI cannot detect
// the very flattening this is looking for.
// ---------------------------------------------------------------------------
vm.runInContext(`
// SKILLS THE LEVEL MOVES. The four hand skills are deliberately included:
// fielding is real cricket and a weak side should field worse. What is NOT
// included is anything that is not a skill - age, experience, form - because
// those are separate axes and mixing them in would make the curve unreadable.
globalThis.__srSKILLS = ['vsPace','vsSpin','power','rotation','temperament',
  'wicket','economy','discipline','moveTurn','variation','stamina',
  'fielding','catching','keeping','stumping'];

// the reference squad's own mean skill, over the men and the skills that exist
globalThis.__srMeanOf = function (t) {
  var s = 0, n = 0;
  t.players.forEach(function (p) {
    __srSKILLS.forEach(function (k) {
      var v = p.skills && p.skills[k];
      if (typeof v === 'number') { s += v; n++; }
    });
  });
  return n ? s / n : 50;
};

// ADDITIVE: every skill keeps its distance from the squad mean, and the whole
// squad slides to sit on L. A fast bowler's wicket skill stays as far above his
// own batting as it ever was, at every level, so role identity survives the
// scale - which multiplication cannot promise once the clamp bites.
globalThis.__srTeamShape = function (baseIx, L, name) {
  var t = JSON.parse(JSON.stringify(GD.teams[baseIx]));
  t.name = name;
  var mu = __srMeanOf(t), d = L - mu;
  t.players.forEach(function (p) {
    if (!p.skills) return;
    __srSKILLS.forEach(function (k) {
      if (typeof p.skills[k] !== 'number') return;
      p.skills[k] = Math.max(1, Math.min(99, Math.round(p.skills[k] + d)));
    });
    jsDerive(p);
  });
  return t;
};

// MULTIPLICATIVE: production's own shape, floor and all. Reproduced here rather
// than imported so the comparison runs inside one VM against one build; the
// floor of 2 and the ceiling of 99 are server/init-world.mjs calibrate()'s.
globalThis.__srTeamCal = function (baseIx, L, name) {
  var t = JSON.parse(JSON.stringify(GD.teams[baseIx]));
  t.name = name;
  var mu = __srMeanOf(t), f = L / Math.max(1, mu);
  t.players.forEach(function (p) {
    if (!p.skills) return;
    __srSKILLS.forEach(function (k) {
      if (typeof p.skills[k] !== 'number') return;
      p.skills[k] = Math.max(2, Math.min(99, Math.round(p.skills[k] * f)));
    });
    jsDerive(p);
  });
  return t;
};

// WHAT A SQUAD IS MADE OF, for the diagnosis rather than the curve: how many of
// its skills have piled onto the floor, and how much spread is left. A squad
// whose skills are 40% floored has stopped being a squad.
globalThis.__srShapeOf = function (t) {
  var vals = [], floored = 0, ceiled = 0;
  t.players.forEach(function (p) {
    __srSKILLS.forEach(function (k) {
      var v = p.skills && p.skills[k];
      if (typeof v !== 'number') return;
      vals.push(v);
      if (v <= 2) floored++;
      if (v >= 99) ceiled++;
    });
  });
  var mu = vals.reduce(function (a, b) { return a + b; }, 0) / Math.max(1, vals.length);
  var sd = Math.sqrt(vals.reduce(function (a, v) { return a + (v - mu) * (v - mu); }, 0) / Math.max(1, vals.length));
  var xi = t.players.slice().sort(function (a, b) { return (b.rating || 0) - (a.rating || 0); }).slice(0, 11);
  return {
    meanSkill: +mu.toFixed(2), sdSkill: +sd.toFixed(2),
    flooredPct: +(floored / Math.max(1, vals.length) * 100).toFixed(1),
    ceiledPct: +(ceiled / Math.max(1, vals.length) * 100).toFixed(1),
    xiRating: Math.round(xi.reduce(function (a, p) { return a + (p.rating || 0); }, 0) / Math.max(1, xi.length)),
    meanBat: +(t.players.reduce(function (a, p) { return a + (p.bat || 0); }, 0) / t.players.length).toFixed(1),
    meanThreat: +(t.players.filter(function (p) { return p.bowlType; })
      .reduce(function (a, p) { return a + (p.threat || 0); }, 0) /
      Math.max(1, t.players.filter(function (p) { return p.bowlType; }).length)).toFixed(1)
  };
};

// ONE MATCH, and everything about it worth counting. Neutral ground on purpose:
// the home edge is real cricket but it is a constant here, and leaving it in
// would put a few points of noise on every cell of the matrix.
globalThis.__srRun = function (ta, tb, seed) {
  onMatchEnd = function () {};
  M = newMatch(ta, tb, 'balanced', (seed >>> 0) || 1);
  M.meta = { home: ta.name, away: tb.name, pitch: 'balanced', weather: 'Sunny',
             comp: 'cal', isUser: false, neutral: true };
  M.isUserMatch = false; M.ordersMap = {};
  App.tossState = { stage: 'x' };
  applyToss(aiTossDecision());
  var g = 0;
  while (M && !M.done && g++ < 4000) { autoPick(); stepBall(); }
  if (!M || !M.done) return null;
  var i1 = M.innings[0], i2 = M.innings[1];
  var log = (M.log || []).map(function (l) { return typeof l === 'string' ? l : (l && l.txt) || ''; }).join('\\n');
  var winner = M.result ? M.result.winner : null;
  return JSON.stringify({
    // which SIDE won, by name, so the caller need not track the toss
    winner: winner, tie: !!(M.result && winner === null),
    batFirst: i1.batTeam || null,
    s1: i1.runs, wk1: i1.wkts, legal1: i1.legal || 0,
    s2: i2 ? i2.runs : null, wk2: i2 ? i2.wkts : null, legal2: i2 ? (i2.legal || 0) : 0,
    ex1: Math.max(0, i1.runs - (i1.bat || []).reduce(function (a, b) { return a + (+b.r || 0); }, 0)),
    fours: (log.match(/FOUR/g) || []).length, sixes: (log.match(/SIX/g) || []).length,
    chased: !!(i2 && winner && winner !== (i1.batTeam || null) && !M.result.tie)
  });
};
`, eng.ctx);

const mkShape = vm.runInContext('__srTeamShape', eng.ctx);
const mkCal = vm.runInContext('__srTeamCal', eng.ctx);
const shapeOf = vm.runInContext('__srShapeOf', eng.ctx);
const runOne = vm.runInContext('__srRun', eng.ctx);
const mk = (ix, L, name) => (MODE === 'cal' ? mkCal : mkShape)(ix, L, name);

const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
const med = xs => { if (!xs.length) return 0; const s = xs.slice().sort((a, b) => a - b); return s[s.length >> 1]; };
const sd = xs => { const m = mean(xs); return Math.sqrt(mean(xs.map(x => (x - m) * (x - m)))); };
const r2 = x => Math.round(x * 100) / 100;

// ---------------------------------------------------------------------------
// A PAIRING. Both sides host half the matches so nothing about batting first
// or the ground can be mistaken for strength.
// ---------------------------------------------------------------------------
function pairing(la, lb, n, seed0) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    // alternate which side is named first, and give each a squad from a
    // DIFFERENT baked reference on half the runs, so neither the reference
    // squad's own quirks nor the toss can masquerade as a level effect
    const flip = i % 2 === 1;
    const A = mk(flip ? 1 : 0, la, 'A'), B = mk(flip ? 0 : 1, lb, 'B');
    const j = runOne(flip ? B : A, flip ? A : B, (seed0 + i * 7) >>> 0);
    if (!j) continue;
    const r = JSON.parse(j);
    // normalise: everything below is stated from A's point of view
    const aFirst = r.batFirst === 'A';
    rows.push({
      aWon: r.winner === 'A', tie: r.tie,
      aRuns: aFirst ? r.s1 : r.s2, aWk: aFirst ? r.wk1 : r.wk2,
      aBalls: aFirst ? r.legal1 : r.legal2,
      bRuns: aFirst ? r.s2 : r.s1, bWk: aFirst ? r.wk2 : r.wk1,
      bBalls: aFirst ? r.legal2 : r.legal1,
      s1: r.s1, wk1: r.wk1, legal1: r.legal1, ex1: r.ex1,
      fours: r.fours, sixes: r.sixes, chased: r.chased
    });
  }
  const n0 = rows.length || 1;
  const aRuns = rows.map(r => r.aRuns || 0), bRuns = rows.map(r => r.bRuns || 0);
  const margin = rows.filter(r => !r.tie).map(r => Math.abs((r.aRuns || 0) - (r.bRuns || 0)));
  const balls = rows.reduce((a, r) => a + (r.aBalls || 0) + (r.bBalls || 0), 0);
  const wkts = rows.reduce((a, r) => a + (r.aWk || 0) + (r.bWk || 0), 0);
  return {
    a: la, b: lb, n: rows.length,
    aWinPct: r2(rows.filter(r => r.aWon).length / n0 * 100),
    tiePct: r2(rows.filter(r => r.tie).length / n0 * 100),
    aRunsMean: r2(mean(aRuns)), bRunsMean: r2(mean(bRuns)),
    aRunsMed: med(aRuns), aRunsSd: r2(sd(aRuns)),
    aWktsMean: r2(mean(rows.map(r => r.aWk || 0))), bWktsMean: r2(mean(rows.map(r => r.bWk || 0))),
    firstInnMean: r2(mean(rows.map(r => r.s1))), firstInnSd: r2(sd(rows.map(r => r.s1))),
    allOutPct: r2(rows.filter(r => r.wk1 >= 10).length / n0 * 100),
    runRate: r2(mean(rows.map(r => r.legal1 ? r.s1 / (r.legal1 / 6) : 0))),
    marginMean: r2(mean(margin)),
    chasePct: r2(rows.filter(r => r.chased).length / n0 * 100),
    extras: r2(mean(rows.map(r => r.ex1))),
    boundaryPct: r2(balls ? (rows.reduce((a, r) => a + r.fours + r.sixes, 0)) / balls * 100 : 0),
    ballsPerWkt: r2(wkts ? balls / wkts : 0)
  };
}

const LEVELS = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95];
const MATRIX = [
  [25, 25], [25, 35], [25, 50], [25, 70], [25, 90],
  [35, 35], [35, 45], [35, 60],
  [40, 50], [40, 60],
  [50, 50], [50, 60], [50, 70], [50, 80],
  [60, 60], [60, 70], [60, 80], [60, 90],
  [70, 70], [70, 80], [70, 90],
  [80, 90], [80, 95], [90, 95], [95, 95]
];

const out = { mode: MODE, n: N, generatedFrom: 'shipped index.html', levels: {}, matrix: [], players: [], shapes: [] };

// ---- 1. THE SWEEP: what one level of cricket looks like against itself -----
if (ALL || has('sweep') || (!has('matrix') && !has('players') && !has('shapes'))) {
  for (const L of LEVELS) {
    const t = mk(0, L, 'probe');
    out.levels[L] = { squad: shapeOf(t), self: pairing(L, L, N, 90000 + L * 131) };
  }
}
// ---- 2. THE MATRIX --------------------------------------------------------
if (ALL || has('matrix')) {
  for (const [a, b] of MATRIX) out.matrix.push(pairing(a, b, N, 500000 + a * 1009 + b * 17));
}
// ---- 3. ASYMMETRIC SIDES --------------------------------------------------
// A uniformly-scaled XI is the easy case. Real squads are lopsided, and a fix
// that only works on homogeneous teams is not a fix - so batting and bowling
// are moved independently here, which is also how §15 tells batting-side
// saturation apart from bowling-side saturation.
if (ALL || has('shapes')) {
  vm.runInContext(`
globalThis.__srSplit = function (baseIx, batL, bowlL, name) {
  var t = __srTeamShape(baseIx, batL, name);
  // then move ONLY the bowling skills to their own level, leaving the batting
  // where the shape pass put it
  var BOWL = ['wicket','economy','discipline','moveTurn','variation'];
  var s = 0, n = 0;
  t.players.forEach(function (p) { if (!p.bowlType || !p.skills) return;
    BOWL.forEach(function (k) { if (typeof p.skills[k] === 'number') { s += p.skills[k]; n++; } }); });
  var d = bowlL - (n ? s / n : 50);
  t.players.forEach(function (p) { if (!p.skills) return;
    BOWL.forEach(function (k) { if (typeof p.skills[k] === 'number')
      p.skills[k] = Math.max(1, Math.min(99, Math.round(p.skills[k] + d))); });
    jsDerive(p); });
  return t;
};`, eng.ctx);
  const split = vm.runInContext('__srSplit', eng.ctx);
  const SHAPES = [
    ['bat 75 / bowl 45 v bat 45 / bowl 75', [75, 45], [45, 75]],
    ['bat 60 / bowl 60 v bat 75 / bowl 45', [60, 60], [75, 45]],
    ['bat 60 / bowl 60 v bat 45 / bowl 75', [60, 60], [45, 75]],
    ['bat 30 / bowl 30 v bat 30 / bowl 55', [30, 30], [30, 55]],
    ['bat 85 / bowl 85 v bat 85 / bowl 60', [85, 85], [85, 60]]
  ];
  for (const [label, A, B] of SHAPES) {
    const rows = [];
    for (let i = 0; i < N; i++) {
      const flip = i % 2 === 1;
      const ta = split(flip ? 1 : 0, A[0], A[1], 'A'), tb = split(flip ? 0 : 1, B[0], B[1], 'B');
      const j = runOne(flip ? tb : ta, flip ? ta : tb, (700000 + i * 7) >>> 0);
      if (j) rows.push(JSON.parse(j));
    }
    const n0 = rows.length || 1;
    out.shapes.push({ label, aWinPct: r2(rows.filter(r => r.winner === 'A').length / n0 * 100),
      firstInnMean: r2(mean(rows.map(r => r.s1))), n: rows.length });
  }
}
// ---- 4. INDIVIDUAL ARCHETYPES ---------------------------------------------
// §14: XI-vs-XI can hide a broken individual curve, because both sides move at
// once. This holds ONE side at a fixed ordinary level and moves the other's
// batting - then its bowling - so a single skill's effect is visible on its own.
if (ALL || has('players')) {
  vm.runInContext(`
globalThis.__srOneSided = function (batL, bowlL) {
  return [__srTeamShape(0, batL, 'BAT'), __srTeamShape(1, bowlL, 'BOWL')];
};`, eng.ctx);
  const oneSided = vm.runInContext('__srOneSided', eng.ctx);
  const FIXED = 55;
  for (const L of LEVELS) {
    // batting rises against a fixed 55 attack
    let runs = [], wk = [], balls = 0, rr = [];
    for (let i = 0; i < N; i++) {
      const [ta, tb] = oneSided(L, FIXED);
      const j = runOne(ta, tb, (800000 + L * 313 + i * 7) >>> 0);
      if (!j) continue;
      const r = JSON.parse(j);
      const first = r.batFirst === 'BAT';
      runs.push(first ? r.s1 : r.s2); wk.push(first ? r.wk1 : r.wk2);
      balls += (first ? r.legal1 : r.legal2) || 0;
    }
    // bowling rises against a fixed 55 batting side
    let conc = [], took = [], bBalls = 0;
    for (let i = 0; i < N; i++) {
      const [ta, tb] = oneSided(FIXED, L);
      const j = runOne(ta, tb, (900000 + L * 313 + i * 7) >>> 0);
      if (!j) continue;
      const r = JSON.parse(j);
      const first = r.batFirst === 'BAT';
      conc.push(first ? r.s1 : r.s2); took.push(first ? r.wk1 : r.wk2);
      bBalls += (first ? r.legal1 : r.legal2) || 0;
    }
    out.players.push({
      level: L,
      batRuns: r2(mean(runs)), batWkts: r2(mean(wk)),
      batAvg: r2(mean(runs) / Math.max(0.01, mean(wk))),
      batSR: r2(balls ? mean(runs) / (balls / N) * 100 : 0),
      bowlConceded: r2(mean(conc)), bowlWkts: r2(mean(took)),
      bowlEcon: r2(bBalls ? mean(conc) / ((bBalls / N) / 6) : 0)
    });
  }
}

if (JSONOUT) { console.log(JSON.stringify(out, null, 1)); process.exit(0); }

const pad = (s, n) => String(s).padEnd(n), num = (s, n) => String(s).padStart(n);
console.log('\n# strength-response  mode=' + MODE + '  n=' + N + ' matches per cell\n');
if (Object.keys(out.levels).length) {
  console.log('== LEVEL AGAINST ITSELF (is the cricket still cricket at every level?) ==');
  console.log('  ' + pad('L', 4) + num('meanSk', 7) + num('sdSk', 6) + num('floor%', 7) + num('ceil%', 6) +
    num('xiRat', 7) + num('bat', 6) + num('thr', 6) + ' |' + num('1stInn', 8) + num('sd', 6) +
    num('wkts', 6) + num('allOut%', 8) + num('rr', 6) + num('bnd%', 6) + num('bpw', 6) + num('extras', 7));
  for (const L of LEVELS) {
    const v = out.levels[L]; if (!v) continue;
    const s = v.squad, p = v.self;
    console.log('  ' + pad(L, 4) + num(s.meanSkill, 7) + num(s.sdSkill, 6) + num(s.flooredPct, 7) +
      num(s.ceiledPct, 6) + num(s.xiRating, 7) + num(s.meanBat, 6) + num(s.meanThreat, 6) + ' |' +
      num(p.firstInnMean, 8) + num(p.firstInnSd, 6) + num(p.aWktsMean, 6) + num(p.allOutPct, 8) +
      num(p.runRate, 6) + num(p.boundaryPct, 6) + num(p.ballsPerWkt, 6) + num(p.extras, 7));
  }
}
if (out.matrix.length) {
  console.log('\n== THE MATRIX (A is the WEAKER side; B should win more as the gap grows) ==');
  console.log('  ' + pad('matchup', 12) + num('B win%', 8) + num('tie%', 6) + num('A runs', 8) +
    num('B runs', 8) + num('A wkts', 8) + num('margin', 8) + num('chase%', 8) + num('allOut%', 8));
  for (const m of out.matrix) {
    const bWin = r2(100 - m.aWinPct - m.tiePct);
    console.log('  ' + pad(m.a + ' v ' + m.b, 12) + num(bWin, 8) + num(m.tiePct, 6) +
      num(m.aRunsMean, 8) + num(m.bRunsMean, 8) + num(m.aWktsMean, 8) + num(m.marginMean, 8) +
      num(m.chasePct, 8) + num(m.allOutPct, 8));
  }
}
if (out.shapes.length) {
  console.log('\n== ASYMMETRIC SIDES ==');
  out.shapes.forEach(s => console.log('  ' + pad(s.label, 42) + 'A win% ' + num(s.aWinPct, 6) +
    '   1st inn ' + num(s.firstInnMean, 6)));
}
if (out.players.length) {
  console.log('\n== ONE SIDE MOVES, THE OTHER HELD AT 55 ==');
  console.log('  ' + pad('L', 4) + num('batRuns', 9) + num('batWkts', 9) + num('batAvg', 8) +
    num('batSR', 7) + ' |' + num('conceded', 10) + num('bowlWkts', 10) + num('econ', 7));
  out.players.forEach(p => console.log('  ' + pad(p.level, 4) + num(p.batRuns, 9) + num(p.batWkts, 9) +
    num(p.batAvg, 8) + num(p.batSR, 7) + ' |' + num(p.bowlConceded, 10) + num(p.bowlWkts, 10) +
    num(p.bowlEcon, 7)));
}
console.log('');
