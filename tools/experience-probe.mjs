#!/usr/bin/env node
/* tools/experience-probe.mjs — WHAT DOES EXPERIENCE ACTUALLY BUY, AND WHEN?
 *
 * Part II of the player-realism audit. The engine's design intent is written
 * at engine/src/00-core.js ~1778: experience is "steadiness when it matters,
 * and almost nothing when it does not" — a factor (exp-55)/45 clamped to ±1,
 * scaled by expUse = exp_base(0.2) + pressureBase, where pressureBase is
 * built from phase, chase, wickets down, required rate and collapse. This
 * probe measures whether that intent survives contact with the arithmetic:
 *
 *   §1 identical players, exp 10..90, in LOW and HIGH pressure states —
 *      batting and bowling separately, every state posed exactly (ballDist
 *      is pure, so these are probabilities, not samples)
 *   §2 the experience x temperament matrix — are they two attributes or one
 *      attribute twice?
 *   §3 what a season pays for it: match-sampled runs/wickets/wins for one
 *      man's experience moved with everything else held
 *
 *   node tools/experience-probe.mjs --ball
 *   node tools/experience-probe.mjs --match --n=300
 *   node tools/experience-probe.mjs --all --n=300 --json > evidence.json
 *
 * IT CHANGES NOTHING. Every number is read out of the built index.html in a VM.
 */
import { makeHarness, summary, per50, distStats, arg, has } from './realism-lib.mjs';

const N = parseInt(arg('n', '240'), 10);
const H = makeHarness();
const out = {};
const say = s => { if (!has('json')) console.log(s); };
const f = (x, n = 2) => (x == null || !isFinite(x) ? '   -  ' : (+x).toFixed(n).padStart(7));

// The pressure states of the brief, posed as exact ball contexts. Intent is
// the engine's own aiIntent for the state, so experience is measured inside
// the risk the situation actually demands.
const STATES = [
  // label, kind, context-builder
  ['1st inn, 20/1 after 10', { over: 10, wkts: 1, faced: 20, runs: 20, iv: { over: 10, wkts: 1, runs: 20, setFaced: 20 } }],
  ['1st inn, 100/2 after 20', { over: 20, wkts: 2, faced: 40, runs: 100, iv: { over: 20, wkts: 2, runs: 100, setFaced: 40 } }],
  ['ordinary middle over', { over: 28, wkts: 3, faced: 30, iv: { over: 28, wkts: 3, runs: 130, setFaced: 30 } }],
  ['150/7, 15 overs left', { over: 35, wkts: 7, faced: 10, since: 4, iv: { over: 35, wkts: 7, runs: 150, setFaced: 10, since: 4 } }],
  ['230/8 at the death', { over: 46, wkts: 8, faced: 12, iv: { over: 46, wkts: 8, runs: 230, setFaced: 12 } }],
  ['chase 60 off 60, 8 wkts left', { over: 40, wkts: 2, faced: 35, chase: 1, need: 60, balls: 60 }],
  ['chase 60 off 60, 3 wkts left', { over: 40, wkts: 7, faced: 12, chase: 1, need: 60, balls: 60 }],
  ['chase 40 off 24', { over: 46, wkts: 5, faced: 20, chase: 1, need: 40, balls: 24 }],
  ['chase 20 off 12', { over: 48, wkts: 5, faced: 15, chase: 1, need: 20, balls: 12 }],
  ['chase 8 off 6', { over: 49, wkts: 6, faced: 10, chase: 1, need: 8, balls: 6 }],
  ['collapse: 3 quick wkts', { over: 30, wkts: 5, faced: 2, since: 1, iv: { over: 30, wkts: 5, runs: 120, setFaced: 2, since: 1 } }],
  ['bowling after 100 stand', { over: 34, wkts: 1, faced: 60, pship: 100, iv: { over: 34, wkts: 1, runs: 170, setFaced: 60 } }]
];

function pose(o) {
  const ctx = { over: o.over, wkts: o.wkts, faced: o.faced, pship: o.pship || 0, since: o.since };
  if (o.chase) {
    ctx.chase = true; ctx.ballsLeft = o.balls;
    const req = o.need * 6 / o.balls;
    ctx.reqRate = req; ctx.rrDef = Math.max(0, (req - 5.6) / 3);
    ctx.intent = H.intent({ over: o.over, wkts: o.wkts, runs: 300 - o.need, setFaced: o.faced, target: 300, since: o.since });
  } else {
    ctx.intent = H.intent(o.iv || { over: o.over, wkts: o.wkts, runs: 100, setFaced: o.faced });
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// §1 THE IDENTICAL-PLAYER EXPERIMENT, EXACTLY.
// ---------------------------------------------------------------------------
if (has('ball') || has('all')) {
  say('\n=== §1 EXPERIENCE 10..90, IDENTICAL PLAYERS, EXACT PROBABILITIES ===');
  say('\n  BATSMAN experience (bowler held at 55):');
  out.batStates = [];
  for (const [lbl, o] of STATES) {
    const ctx = pose(o);
    say(`\n  ${lbl}  [intent ${ctx.intent >= 0 ? '+' : ''}${ctx.intent}]`);
    say('    exp     rpo    wkt%   dot%   bnd%   rot%');
    const rows = [];
    for (const exp of [10, 30, 50, 70, 90]) {
      const s = distStats(H.dist({ exp }, { bowlTypeFull: 'seamFastMedium' }, ctx));
      say(`    ${String(exp).padStart(2)}  ${f(s.rpo)} ${f(s.wkt)} ${f(s.dot)} ${f(s.bnd)} ${f(s.rot)}`);
      rows.push({ exp, ...s });
    }
    out.batStates.push({ lbl, intent: ctx.intent, rows });
  }
  say('\n  BOWLER experience (batsman held at 55):');
  out.bowlStates = [];
  for (const [lbl, o] of STATES) {
    const ctx = pose(o);
    say(`\n  ${lbl}`);
    say('    exp     rpo    wkt%   dot%');
    const rows = [];
    for (const exp of [10, 30, 50, 70, 90]) {
      const s = distStats(H.dist({}, { bowlTypeFull: 'seamFastMedium', exp }, ctx));
      say(`    ${String(exp).padStart(2)}  ${f(s.rpo)} ${f(s.wkt)} ${f(s.dot)}`);
      rows.push({ exp, ...s });
    }
    out.bowlStates.push({ lbl, rows });
  }
}

// ---------------------------------------------------------------------------
// §2 EXPERIENCE x TEMPERAMENT. Same states, the four corners of the matrix,
// batting (temperament is a batting-only pressure term in this engine).
// The question is which situations each one moves, and by how much.
// ---------------------------------------------------------------------------
if (has('matrix') || has('all')) {
  say('\n=== §2 EXPERIENCE x TEMPERAMENT (batting), EXACT ===');
  const corners = [
    ['loE/loT', { exp: 20, skills: { temperament: 30 } }],
    ['loE/hiT', { exp: 20, skills: { temperament: 85 } }],
    ['hiE/loT', { exp: 85, skills: { temperament: 30 } }],
    ['hiE/hiT', { exp: 85, skills: { temperament: 85 } }]
  ];
  out.matrix = [];
  for (const [lbl, o] of [['ordinary middle over', STATES[2][1]], ['chase 40 off 24', STATES[7][1]], ['chase 8 off 6', STATES[9][1]], ['collapse: 3 quick wkts', STATES[10][1]]]) {
    const ctx = pose(o);
    say(`\n  ${lbl}`);
    say('    corner    rpo    wkt%   dot%   bnd%');
    const rows = [];
    for (const [c, spec] of corners) {
      const s = distStats(H.dist(spec, { bowlTypeFull: 'seamFastMedium' }, ctx));
      say(`    ${c.padEnd(8)} ${f(s.rpo)} ${f(s.wkt)} ${f(s.dot)} ${f(s.bnd)}`);
      rows.push({ corner: c, ...s });
    }
    out.matrix.push({ lbl, rows });
  }
  say('\n  and the per-point slopes, one state each, everything else at 55:');
  say('  (survival value of +30 pts of each attribute, wkt% change)');
  out.slopes = [];
  for (const [lbl, o] of [['ordinary middle over', STATES[2][1]], ['chase 8 off 6', STATES[9][1]]]) {
    const ctx = pose(o);
    const b = distStats(H.dist({}, {}, ctx));
    const e = distStats(H.dist({ exp: 85 }, {}, ctx));
    const t = distStats(H.dist({ skills: { temperament: 84 } }, {}, ctx));
    say(`  ${lbl}: exp 55->85 wkt ${f(b.wkt)}->${f(e.wkt)}; temperament 54->84 wkt ${f(b.wkt)}->${f(t.wkt)}`);
    out.slopes.push({ lbl, base: b, exp30: e, tmp30: t });
  }
}

// ---------------------------------------------------------------------------
// §3 WHAT A SEASON PAYS. One top-order bat's experience moved 30->80 with
// paired seeds; one opening bowler's the same. Runs are HIS, not the team's
// (CLAUDE.md: compare the quantity the claim is about).
// ---------------------------------------------------------------------------
function batLine(r, side, name) {
  for (const inn of [r.i1, r.i2]) {
    if (!inn || inn.batTeam !== side) continue;
    const b = inn.bat.find(x => x.nm === name);
    if (b) return b;
  }
  return null;
}
function bowlerLine(r, side, name) {
  for (const inn of [r.i1, r.i2]) {
    if (!inn || inn.batTeam === side) continue;
    const b = inn.bowlers[name];
    if (b) return b;
  }
  return null;
}

if (has('match') || has('all')) {
  say('\n=== §3 A SEASON OF IT (paired seeds, N=' + N + ') ===');
  const B0 = H.side('B', {});
  say('\n  top-order bat (A-bat2, No.3), experience swept, age 27:');
  say('  exp   his runs/inn   his SR    dismissed%   team/50ov    win%');
  out.batSeason = [];
  for (const exp of [10, 30, 55, 80, 95]) {
    const A = H.side('A', { slots: [{ slot: 2, exp }] });
    const runs = [], sr = [], outs = [], team = [], win = [];
    for (let i = 0; i < N; i++) {
      const r = H.run(A, B0, 900001 + i * 104729, {});
      if (!r) continue;
      const b = batLine(r, 'A', 'A-bat2');
      if (b && b.b > 0) { runs.push(b.r); sr.push(100 * b.r / b.b); outs.push(b.out ? 1 : 0); }
      for (const inn of [r.i1, r.i2]) if (inn && inn.batTeam === 'A') team.push(per50(inn.runs, inn.legal));
      win.push(r.winner === 'A' ? 1 : (r.winner ? 0 : 0.5));
    }
    const R = summary(runs), S = summary(sr), O = summary(outs), T = summary(team), V = summary(win);
    say(`  ${String(exp).padStart(2)}  ${f(R.mean)}±${R.se.toFixed(2)}  ${f(S.mean, 1)}   ${f(O.mean * 100, 1)}     ${f(T.mean)}±${T.se.toFixed(1)}  ${f(V.mean * 100, 1)}`);
    out.batSeason.push({ exp, runs: R, sr: S, out: O, team: T, win: V });
  }
  say('\n  opening bowler (A-bowl0), experience swept:');
  say('  exp   econ       wkts/inn   team conceded/50   win%');
  out.bowlSeason = [];
  for (const exp of [10, 55, 95]) {
    const A = H.side('A', { slots: [{ slot: 6, exp }] });
    const econ = [], wk = [], con = [], win = [];
    for (let i = 0; i < N; i++) {
      const r = H.run(A, B0, 900001 + i * 104729, {});
      if (!r) continue;
      const b = bowlerLine(r, 'A', 'A-bowl0');
      if (b && b.b > 0) { econ.push(b.r * 6 / b.b); wk.push(b.w); }
      for (const inn of [r.i1, r.i2]) if (inn && inn.batTeam !== 'A') con.push(per50(inn.runs, inn.legal));
      win.push(r.winner === 'A' ? 1 : (r.winner ? 0 : 0.5));
    }
    const E = summary(econ), W = summary(wk), C = summary(con), V = summary(win);
    say(`  ${String(exp).padStart(2)}  ${f(E.mean)}±${E.se.toFixed(2)} ${f(W.mean)}   ${f(C.mean)}±${C.se.toFixed(1)}   ${f(V.mean * 100, 1)}`);
    out.bowlSeason.push({ exp, econ: E, wkts: W, conceded: C, win: V });
  }
  say('\n  and the same bat sweep at age 21 v 36 (does age change what exp buys?):');
  out.batSeasonAge = [];
  for (const age of [21, 36]) for (const exp of [30, 80]) {
    const A = H.side('A', { slots: [{ slot: 2, exp, age }] });
    const runs = [], win = [];
    for (let i = 0; i < N; i++) {
      const r = H.run(A, B0, 900001 + i * 104729, {});
      if (!r) continue;
      const b = batLine(r, 'A', 'A-bat2');
      if (b && b.b > 0) runs.push(b.r);
      win.push(r.winner === 'A' ? 1 : (r.winner ? 0 : 0.5));
    }
    const R = summary(runs), V = summary(win);
    say(`  age ${age} exp ${exp}: his runs ${f(R.mean)}±${R.se.toFixed(2)}  win ${f(V.mean * 100, 1)}%`);
    out.batSeasonAge.push({ age, exp, runs: R, win: V });
  }
}

if (has('json')) console.log(JSON.stringify(out, null, 1));
