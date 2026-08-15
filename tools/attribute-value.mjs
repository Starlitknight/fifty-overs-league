#!/usr/bin/env node
/* tools/attribute-value.mjs — WHAT IS ONE POINT OF THIS SKILL ACTUALLY WORTH?
 *
 * B2 has to turn fifteen raw cricket attributes into one number that means
 * "how good is this cricketer". Every previous attempt in this repository did
 * that by choosing weights that looked reasonable - .25 vsPace, .25 vsSpin, .2
 * rotation and so on - and the weights were never checked against the engine
 * that actually plays the cricket. That is how a card came to promise
 * "Variation 92" while the ball model read the number not at all, and how an
 * all-rounder came to carry the highest rating in the world and the lowest card.
 *
 * This measures instead. For each attribute it takes ONE cricketer in an
 * otherwise fixed side, moves that attribute by a stated number of points, and
 * plays hundreds of matches. What comes back is the RUN DIFFERENTIAL the change
 * is worth - runs his side scores minus runs it concedes, against the same
 * opposition on the same seeds - which is the only currency in which a batting
 * skill and a bowling skill can be compared at all.
 *
 *   node tools/attribute-value.mjs --n=300
 *   node tools/attribute-value.mjs --n=300 --json > docs/b2-evidence/attr-value.json
 *
 * IT CHANGES NOTHING. Every number is read out of the built index.html in a VM.
 * The engine is frozen for B2; this only asks what it does.
 */
import vm from 'node:vm';
import { makeEngine } from '../test/engine-vm.mjs';

const arg = (k, d) => {
  const hit = process.argv.find(a => a.startsWith('--' + k + '='));
  return hit ? hit.split('=')[1] : d;
};
const has = k => process.argv.includes('--' + k);
const N = parseInt(arg('n', '240'), 10);
const STEP = parseInt(arg('step', '20'), 10);     // points moved, up and down
const eng = makeEngine();
eng.setTuning(true);

// ---------------------------------------------------------------------------
// THE ORDINARY SIDE. Eleven men with a real batting order and a real tail,
// every skill at the middle of the engine's useful domain, so a sweep of one
// attribute of one man is a sweep of one attribute of one man.
// ---------------------------------------------------------------------------
vm.runInContext(`
globalThis.__avMan = function (nm, pos, role, bt, sk) {
  var p = { name: nm, age: 27, nat: 'XXX', hand: 'R', role: role,
    bowlTypeFull: bt, exp: 55, formIx: 3, fatigue: 'rested', capt: 50, talents: [],
    skills: { vsPace: 55, vsSpin: 55, power: 52, rotation: 55, temperament: 54,
      wicket: 55, economy: 55, discipline: 55, moveTurn: 55, variation: 55,
      stamina: 55, fielding: 55, catching: 55, keeping: 55, stumping: 55 } };
  for (var k in (sk || {})) p.skills[k] = sk[k];
  jsDerive(p); p.mpos = pos; return p;
};
globalThis.__avSide = function (name) {
  var men = [], i;
  var BAT = [60, 58, 61, 57, 55];
  for (i = 0; i < 5; i++)
    men.push(__avMan(name + '-bat' + i, i + 1, i < 2 ? 'opener' : 'middleOrderBat', 'none',
      { vsPace: BAT[i], vsSpin: BAT[i], rotation: BAT[i], power: BAT[i] - 6 }));
  men.push(__avMan(name + '-wk', 6, 'wicketkeeper', 'none',
    { vsPace: 54, vsSpin: 54, rotation: 54, keeping: 74, stumping: 72, catching: 70 }));
  var TY = ['seamFastMedium', 'seamFast', 'seamMedium', 'fingerSpin', 'wristSpin'];
  var TAIL = [44, 32, 26, 21, 16];
  for (i = 0; i < 5; i++)
    men.push(__avMan(name + '-bowl' + i, 7 + i, TY[i], TY[i],
      { vsPace: TAIL[i], vsSpin: TAIL[i], rotation: TAIL[i], power: TAIL[i] }));
  return { name: name, ground: name + ' Park', players: men };
};
// MOVE ONE MAN'S ONE SKILL. Clamped to the engine's demonstrated domain so the
// measurement never asks a question outside the range B2 will generate in.
globalThis.__avShift = function (side, slot, key, dv) {
  var t = JSON.parse(JSON.stringify(side));
  var p = t.players[slot];
  p.skills[key] = Math.max(1, Math.min(99, p.skills[key] + dv));
  jsDerive(p);
  return t;
};
globalThis.__avRun = function (ta, tb, seed) {
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
  return JSON.stringify({ batFirst: i1.batTeam, s1: i1.runs, b1: i1.legal,
    s2: i2 ? i2.runs : 0, b2: i2 ? i2.legal : 0,
    winner: M.result ? M.result.winner : null });
};
`, eng.ctx);

const mkSide = vm.runInContext('__avSide', eng.ctx);
const shift = vm.runInContext('__avShift', eng.ctx);
const run = vm.runInContext('__avRun', eng.ctx);
const A0 = mkSide('A'), B0 = mkSide('B');

// ---------------------------------------------------------------------------
// A's NET RUNS. An innings that ends early because the target was chased is not
// a shorter innings for this purpose - it is a won one - so both sides' scores
// are put on a per-50-over footing before the difference is taken. Without that
// the measurement rewards a strong side with a LOWER differential, because it
// wins with overs to spare.
// ---------------------------------------------------------------------------
function netRuns(side, n, seed0) {
  let net = 0, wins = 0, k = 0;
  for (let i = 0; i < n; i++) {
    const flip = i % 2 === 1;
    const j = run(flip ? B0 : side, flip ? side : B0, (seed0 + i * 104729) >>> 0);
    if (!j) continue;
    const r = JSON.parse(j);
    k++;
    const aFirst = r.batFirst === 'A';
    const per50 = (s, b) => (b > 0 ? s * 300 / b : 0);
    const aR = aFirst ? per50(r.s1, r.b1) : per50(r.s2, r.b2);
    const bR = aFirst ? per50(r.s2, r.b2) : per50(r.s1, r.b1);
    net += aR - bR;
    if (r.winner === 'A') wins++; else if (!r.winner) wins += 0.5;
  }
  return { net: net / Math.max(1, k), win: 100 * wins / Math.max(1, k), n: k };
}

// ---------------------------------------------------------------------------
// EVERY ATTRIBUTE, ON THE MAN WHOSE JOB IT IS. A keeper's stumping measured on
// an opener would read nought and mean nothing; the slot is part of the
// question. Slot 2 is a top-order batsman, 5 the keeper, 6 the opening bowler.
// ---------------------------------------------------------------------------
const CASES = [
  ['vsPace', 2, 'top-order bat'], ['vsSpin', 2, 'top-order bat'],
  ['power', 2, 'top-order bat'], ['rotation', 2, 'top-order bat'],
  ['temperament', 2, 'top-order bat'], ['fielding', 2, 'top-order bat'],
  ['catching', 2, 'top-order bat'],
  ['wicket', 6, 'opening bowler'], ['economy', 6, 'opening bowler'],
  ['discipline', 6, 'opening bowler'], ['moveTurn', 6, 'opening bowler'],
  ['variation', 6, 'opening bowler'], ['stamina', 6, 'opening bowler'],
  ['fielding', 6, 'opening bowler'],
  ['keeping', 5, 'keeper'], ['stumping', 5, 'keeper'], ['catching', 5, 'keeper'],
  ['vsPace', 5, 'keeper']
];

const rows = [];
const base = netRuns(A0, N, 900001);
if (!has('json')) {
  console.log(`\n=== WHAT ONE POINT OF EACH SKILL IS WORTH ===`);
  console.log(`   one man moved +/-${STEP} points in an otherwise fixed XI, ${N} matches a cell`);
  console.log(`   baseline: net ${base.net.toFixed(2)} runs, ${base.win.toFixed(1)}% wins\n`);
  console.log('attribute        on              -' + STEP + '      +' + STEP + '    runs/pt   index');
}
for (const [key, slot, who] of CASES) {
  const lo = netRuns(shift(A0, slot, key, -STEP), N, 900001);
  const hi = netRuns(shift(A0, slot, key, +STEP), N, 900001);
  // the SLOPE across the whole 2*STEP span, which is less noisy than either
  // half and is what a weight actually wants
  const perPt = (hi.net - lo.net) / (2 * STEP);
  rows.push({ key, slot, who, lo: lo.net, hi: hi.net, perPt, winLo: lo.win, winHi: hi.win, n: lo.n });
}
const top = Math.max(...rows.map(r => Math.abs(r.perPt))) || 1;
for (const r of rows) {
  r.index = 100 * r.perPt / top;
  if (!has('json'))
    console.log(`${r.key.padEnd(14)} ${r.who.padEnd(15)} ${r.lo.toFixed(1).padStart(7)} ${r.hi.toFixed(1).padStart(7)} ${r.perPt.toFixed(3).padStart(8)} ${r.index.toFixed(1).padStart(7)}`);
}
if (has('json')) console.log(JSON.stringify({ step: STEP, n: N, base, rows }, null, 1));
