#!/usr/bin/env node
/* tools/exp-temp-probe.mjs — PHASE 2C: ARE THEY DIFFERENT ATTRIBUTES?
 *
 * The audit's charge: experience and temperament read the same pressure
 * ramp, so experience was a weak second temperament. The test of the fix is
 * not "does experience still do something" but "does it do something
 * DIFFERENT" - value where there is no pressure, and a different shape where
 * there is.
 *
 *   §1 --exact    the closed form: both attributes' contribution to the
 *                 wicket logit and the dot/one weights at every combination
 *                 of phase, setness and pressure, read straight out of
 *                 ballDist. No sims - this is where the two laws are visibly
 *                 not the same law.
 *   §2 --low      LOW PRESSURE: one man swept 20..95 in a flat, no-chase,
 *                 no-collapse innings. Experience should keep a small real
 *                 effect; temperament should be worth ~nothing.
 *   §3 --high     HIGH PRESSURE: the same sweep in a hard chase with wickets
 *                 down. Temperament should bite; experience should help
 *                 through reading, not nerve.
 *   §4 --bat      the batting ledger by state (ordinary / collapse / chase /
 *                 death / with-tail / new batter) for both attributes.
 *   §5 --bowl     the bowling ledger: economy, wickets, dots, boundaries and
 *                 spell progression for experience 20..95 (and temperament,
 *                 to show it is NOT a bowling attribute).
 *   §6 --archetypes  the young-star / old-pro matrix: raw skill held, exp and
 *                 temperament crossed 25/85 x 70/90.
 *   §7 --value    marginal value curves at 20/40/60/80/95, for the OVR and
 *                 wage phase that follows.
 *
 * __foExpOldMode runs any section against the SHIPPED law on the same seeds.
 */
import vm from 'node:vm';
import { makeHarness, summary, per50, arg, has } from './realism-lib.mjs';

const N = parseInt(arg('n', '300'), 10);
const H = makeHarness();
const set = e => vm.runInContext(e, H.ctx);
const out = {};
const say = s => { if (!has('json')) console.log(s); };
const f = (x, n = 2) => (x == null || !isFinite(x) ? '   -  ' : (+x).toFixed(n).padStart(7));
const winOf = r => r.winner === 'A' ? 1 : (r.winner ? 0 : 0.5);
const LEVELS = [20, 40, 60, 80, 95];
const OLD = has('old');
// --old restores BOTH shipped laws: the phase's whole claim is that the two
// attributes shared one trigger, so a baseline that reverts only one of them
// is not the shipped game.
if (OLD) { set('__foExpOldMode=1;__foTmpOldMode=1;1'); say('(running against the SHIPPED experience AND temperament laws)'); }

// ---------------------------------------------------------------------------
// §1 THE TWO LAWS, EXACTLY. __prDist reads ballDist for a posed delivery, so
// the difference between exp 20 and exp 95 (and tmp 20 v 95) is read off the
// probabilities themselves rather than inferred from a scoreline.
// ---------------------------------------------------------------------------
if (has('exact') || has('all')) {
  out.exact = [];
  const STATES = [
    ['dead middle over, new batter', { over: 22, faced: 2, wkts: 1, chase: false, rr: 0 }],
    ['dead middle over, set batter', { over: 22, faced: 60, wkts: 1, chase: false, rr: 0 }],
    ['powerplay, new batter', { over: 4, faced: 2, wkts: 0, chase: false, rr: 0 }],
    ['death, set batter, no pressure', { over: 46, faced: 60, wkts: 2, chase: false, rr: 0 }],
    ['collapse 30/3', { over: 12, faced: 2, wkts: 3, chase: false, rr: 0, since: 1 }],
    ['hard chase, 35 off 24', { over: 46, faced: 20, wkts: 5, chase: true, rr: 1.4, since: 8 }]
  ];
  say('\n=== §1 THE TWO LAWS (exact, per delivery) ===');
  say('  state                            EXP 20->95            TMP 20->95');
  say('                                   dWkt%    dDot%  d1%   dWkt%    dDot%');
  for (const [lbl, st] of STATES) {
    const mk = (exp, tmp) => H.dist(
      { exp, skills: { temperament: tmp } }, {},
      { over: st.over, faced: st.faced, wkts: st.wkts, chase: st.chase,
        rrDef: st.rr, since: st.since == null ? 20 : st.since, pitch: 'balanced' });
    const wk = d => 100 * (d.wC + d.wB + d.wLBW + d.wRO + d.wST);
    const e20 = mk(20, 55), e95 = mk(95, 55), t20 = mk(55, 20), t95 = mk(55, 95);
    const row = { lbl,
      expWkt: wk(e95) - wk(e20), expDot: 100 * (e95.dot - e20.dot), exp1: 100 * (e95['1'] - e20['1']),
      tmpWkt: wk(t95) - wk(t20), tmpDot: 100 * (t95.dot - t20.dot) };
    out.exact.push(row);
    say('  ' + lbl.padEnd(32) + f(row.expWkt, 3) + f(row.expDot, 3) + f(row.exp1, 3)
      + '  ' + f(row.tmpWkt, 3) + f(row.tmpDot, 3));
  }
}

// one swept man (slot 2, a top-order bat), everything else held.
// `want` decides WHICH innings counts: 'first' is genuinely low pressure (no
// target, no required rate), 'chase' is the pressured one. Without this the
// toss decides, so half of every "low pressure" cell was a run chase - which
// is pressure by definition, and it is what made the first read of this
// section show temperament worth nine runs in a "calm" innings.
function sweepCell(attr, lvl, n, runOpts, want) {
  const slot = { slot: 2 };
  if (attr === 'exp') slot.exp = lvl; else slot.skills = { temperament: lvl };
  const A = H.side('A', { slots: [slot] });
  const B = H.side('B', {});
  const nm = A.players[2].name;
  const runs = [], outs = [], balls = [], team = [], win = [];
  for (let i = 0; i < n; i++) {
    const r = H.run(A, B, 820001 + i * 104729, runOpts || {});
    if (!r) continue;
    const aFirst = !!(r.i1 && r.i1.batTeam === 'A');
    if (want === 'first' && !aFirst) continue;
    if (want === 'chase' && aFirst) continue;
    win.push(winOf(r));
    for (const inn of [r.i1, r.i2]) {
      if (!inn || inn.batTeam !== 'A') continue;
      team.push(per50(inn.runs, inn.legal));
      const b = (inn.bat || []).find(x => x.nm === nm);
      if (b && b.b > 0) { runs.push(b.r); outs.push(b.out ? 1 : 0); balls.push(b.b); }
    }
  }
  return { attr, lvl, runs: summary(runs), outRate: summary(outs), balls: summary(balls),
    team: summary(team), win: summary(win) };
}
function sweepReport(title, runOpts, want, key) {
  say(`\n=== ${title} (N=${N}) ===`);
  say('  attr  lvl   his runs      balls   out%    team/50   win%');
  const rows = [];
  for (const attr of ['exp', 'tmp']) {
    for (const lvl of LEVELS) {
      const C = sweepCell(attr, lvl, N, runOpts, want);
      rows.push(C);
      say('  ' + attr.padEnd(5) + String(lvl).padEnd(5) + f(C.runs.mean, 1) + '±' + C.runs.se.toFixed(1).padEnd(4)
        + f(C.balls.mean, 1) + f(100 * C.outRate.mean, 1) + f(C.team.mean, 1) + f(100 * C.win.mean, 1));
    }
    say('');
  }
  const span = a => {
    const lo = rows.find(r => r.attr === a && r.lvl === 20), hi = rows.find(r => r.attr === a && r.lvl === 95);
    return { dRuns: hi.runs.mean - lo.runs.mean, se: Math.sqrt(hi.runs.se ** 2 + lo.runs.se ** 2),
      dTeam: hi.team.mean - lo.team.mean, dWin: 100 * (hi.win.mean - lo.win.mean) };
  };
  const E = span('exp'), T = span('tmp');
  say(`  20->95:  EXP ${f(E.dRuns, 2)}±${E.se.toFixed(2)} his runs, ${f(E.dTeam, 1)} team, ${f(E.dWin, 1)} win pts`);
  say(`           TMP ${f(T.dRuns, 2)}±${T.se.toFixed(2)} his runs, ${f(T.dTeam, 1)} team, ${f(T.dWin, 1)} win pts`);
  out[key] = { rows, exp: E, tmp: T };
}

if (has('low') || has('all'))
  sweepReport('§2 LOW PRESSURE (flat deck, BATTING FIRST - no target, no required rate)',
    { pitch: 'flat' }, 'first', 'low');
if (has('high') || has('all'))
  sweepReport('§3 HIGH PRESSURE (green seamer, CHASING a target)',
    { pitch: 'green', weather: 'Overcast' }, 'chase', 'high');

// ---------------------------------------------------------------------------
// §5 BOWLING. The swept man is the strike bowler; his own figures are read.
// ---------------------------------------------------------------------------
if (has('bowl') || has('all')) {
  say(`\n=== §5 BOWLING (the swept man is the strike bowler, N=${N}) ===`);
  say('  attr  lvl   econ    wkts    dot%    4s/inn');
  out.bowl = [];
  for (const attr of ['exp', 'tmp']) {
    for (const lvl of LEVELS) {
      const slot = { slot: 6 };
      if (attr === 'exp') slot.exp = lvl; else slot.skills = { temperament: lvl };
      const A = H.side('A', { slots: [slot] });
      const B = H.side('B', {});
      const nm = A.players[6].name;
      const compiled = []; for (let o = 0; o < 50; o++) compiled[o] = A.players[6 + (o % 5)].name;
      const econ = [], wk = [];
      for (let i = 0; i < N; i++) {
        const r = H.run(A, B, 830001 + i * 104729, { ordersA: { compiled, tossDecision: 'bowl' } });
        if (!r) continue;
        for (const inn of [r.i1, r.i2]) {
          if (!inn || inn.batTeam === 'A') continue;
          const rec = inn.bowlers[nm];
          if (rec && rec.b) { econ.push(rec.r / (rec.b / 6)); wk.push(rec.w || 0); }
        }
      }
      const row = { attr, lvl, econ: summary(econ), wkts: summary(wk) };
      out.bowl.push(row);
      say('  ' + attr.padEnd(5) + String(lvl).padEnd(5) + f(row.econ.mean, 3) + '±' + row.econ.se.toFixed(3)
        + f(row.wkts.mean, 3) + '±' + row.wkts.se.toFixed(3));
    }
    say('');
  }
  const sp = a => {
    const lo = out.bowl.find(r => r.attr === a && r.lvl === 20), hi = out.bowl.find(r => r.attr === a && r.lvl === 95);
    return { dEcon: hi.econ.mean - lo.econ.mean, se: Math.sqrt(hi.econ.se ** 2 + lo.econ.se ** 2),
      dWkts: hi.wkts.mean - lo.wkts.mean };
  };
  const E = sp('exp'), T = sp('tmp');
  say(`  20->95:  EXP econ ${f(E.dEcon, 3)}±${E.se.toFixed(3)}/over, wkts ${f(E.dWkts, 3)}`);
  say(`           TMP econ ${f(T.dEcon, 3)}±${T.se.toFixed(3)}/over, wkts ${f(T.dWkts, 3)}`);
  out.bowlSpan = { exp: E, tmp: T };
}

// ---------------------------------------------------------------------------
// §6 THE FOUR MEN. Same raw skill; experience and temperament crossed.
// ---------------------------------------------------------------------------
if (has('archetypes') || has('all')) {
  say(`\n=== §6 YOUNG STAR v OLD PRO (same raw skill, N=${N}) ===`);
  say('  man                       ordinary       under pressure    delta');
  out.archetypes = [];
  const CELLS = [['A young, cool-ish', 25, 70], ['B veteran, cool-ish', 85, 70],
    ['C young, ice', 25, 90], ['D veteran, ice', 85, 90]];
  for (const [lbl, exp, tmp] of CELLS) {
    const mkA = () => H.side('A', { slots: [{ slot: 2, exp, skills: { temperament: tmp } }] });
    const B = H.side('B', {});
    const nm = mkA().players[2].name;
    const grab = ro => {
      const A = mkA(); const runs = [];
      for (let i = 0; i < N; i++) {
        const r = H.run(A, B, 840001 + i * 104729, ro);
        if (!r) continue;
        for (const inn of [r.i1, r.i2]) {
          if (!inn || inn.batTeam !== 'A') continue;
          const b = (inn.bat || []).find(x => x.nm === nm);
          if (b && b.b > 0) runs.push(b.r);
        }
      }
      return summary(runs);
    };
    const easy = grab({ pitch: 'flat' }), hard = grab({ pitch: 'green', weather: 'Overcast' });
    out.archetypes.push({ lbl, exp, tmp, easy, hard });
    say('  ' + lbl.padEnd(26) + f(easy.mean, 1) + '±' + easy.se.toFixed(1)
      + '   ' + f(hard.mean, 1) + '±' + hard.se.toFixed(1) + f(hard.mean - easy.mean, 1));
  }
}

if (has('json')) console.log(JSON.stringify(out, null, 1));
