#!/usr/bin/env node
/* tools/fielding-probe.mjs — DOES THE FIELD ACTUALLY DECIDE ANYTHING?
 *
 * Parts IV and V of the player-realism audit. Fielding reaches the cricket
 * down FIVE paths and each is measured on its own:
 *
 *   1. ctx.fieldAvg      the XI's mean fielding, a small dot/boundary tilt
 *                        inside ballDist (exact, §1)
 *   2. the GROUND CONTEST groundFieldingAdjust: every in-play ball gets a
 *                        direction, the posted man nearest the line contests
 *                        a dealt difficulty — saves, cut-off twos,
 *                        misfields, fumbles (sampled, §2-§4)
 *   3. the CATCH CONTEST a wC outcome is a chance AT a man; his hands (or
 *                        the keeper's blend) against the difficulty decide
 *                        take / drop / beaten (sampled, §5)
 *   4. RUN-OUTS          wRO logit + rocketArms count; the fielder credited
 *                        is drawn weighted by fielding x1.5 Rocket Arm (§6)
 *   5. THE GLOVES        byes/wides via keeperQuality against par 74, wST
 *                        via stumping, wC via catching, the miss model (§7)
 *
 * Individual identity matters only through foFieldAssign (best catchers in
 * the cordon, best athletes deep, weakest hidden at mid-on/mid-off), so §3
 * puts one elite / one terrible fielder in an average XI and asks whether
 * the engine can tell.
 *
 *   node tools/fielding-probe.mjs --exact
 *   node tools/fielding-probe.mjs --team --individual --keeper --n=300
 *   node tools/fielding-probe.mjs --all --n=300 --json > evidence.json
 *
 * IT CHANGES NOTHING. Every number is read out of the built index.html in a VM.
 */
import { makeHarness, summary, per50, distStats, arg, has } from './realism-lib.mjs';

const N = parseInt(arg('n', '240'), 10);
const H = makeHarness();
const out = {};
const say = s => { if (!has('json')) console.log(s); };
const f = (x, n = 2) => (x == null || !isFinite(x) ? '   -  ' : (+x).toFixed(n).padStart(7));

const fldOf = (r, side) => {
  // the fielding work SIDE did = the fld tally of the innings side bowled in
  for (const inn of [r.i1, r.i2]) if (inn && inn.batTeam !== side) return inn.fld || {};
  return {};
};
const cnt = (fl, k) => fl[k] || 0;
const savedRuns = fl => (cnt(fl, 'save1') * 1 + cnt(fl, 'save2') * 2 + cnt(fl, 'save3') * 3 + cnt(fl, 'save4') * 4)
  - (cnt(fl, 'misfield') + cnt(fl, 'fumble'));

// ---------------------------------------------------------------------------
// §1 THE EXACT fieldAvg / keeper / rocket terms in ballDist.
// ---------------------------------------------------------------------------
if (has('exact') || has('all')) {
  say('\n=== §1 EXACT BALL-MODEL FIELD TERMS ===');
  say('  team fieldAvg    rpo     dot%    four%');
  out.fieldAvg = [];
  for (const fa of [20, 40, 55, 70, 85, 95]) {
    const s = distStats(H.dist({}, { bowlTypeFull: 'seamFastMedium' }, { over: 30, faced: 30, fieldAvg: fa }));
    say(`     ${String(fa).padStart(3)}       ${f(s.rpo)} ${f(s.dot)} ${f(s.four)}`);
    out.fieldAvg.push({ fa, ...s });
  }
  say('\n  keeperQuality (byes/extras) and the two named glove skills (exact):');
  say('  kq     bye%   extras%    | stump  wST%   | catch  wC%');
  out.keeperExact = [];
  for (const kq of [30, 50, 74, 90]) {
    const s = distStats(H.dist({}, { bowlTypeFull: 'fingerSpin' }, { over: 30, faced: 30, keeperQuality: kq }));
    const st = distStats(H.dist({}, { bowlTypeFull: 'fingerSpin' }, { over: 30, faced: 30, keeperQuality: 74, keeperStump: kq }));
    const ct = distStats(H.dist({}, { bowlTypeFull: 'seamFastMedium' }, { over: 30, faced: 30, keeperQuality: 74, keeperCatch: kq }));
    say(`  ${String(kq).padStart(2)}  ${f(s.bye, 3)} ${f(s.extras)}     |  ${String(kq).padStart(2)}  ${f(st.wST, 3)} |  ${String(kq).padStart(2)}  ${f(ct.wC, 3)}`);
    out.keeperExact.push({ kq, bye: s.bye, extras: s.extras, wST: st.wST, wC: ct.wC });
  }
  say('\n  rocketArms in the XI -> run-out probability (exact):');
  out.rocket = [];
  for (const n of [0, 1, 2, 3]) {
    const s = distStats(H.dist({}, { bowlTypeFull: 'seamFastMedium' }, { over: 30, faced: 30, rocketArms: n }));
    say(`    ${n} rocket arm(s): wRO ${f(s.wRO, 3)}%`);
    out.rocket.push({ n, wRO: s.wRO });
  }
}

// ---------------------------------------------------------------------------
// §2 TEAM FIELDING 20..95 over matches. All eleven men's fielding+catching
// moved together; batting/bowling identical. The full event ledger comes
// back from the runner.
// ---------------------------------------------------------------------------
if (has('team') || has('all')) {
  say('\n=== §2 TEAM FIELDING 20..95 (paired seeds, N=' + N + ') ===');
  const B0 = H.side('B', {});
  say('  level  conceded/50  catches  drops  beats  saves  misf+fumb  netSavedRuns  runouts  win%');
  out.team = [];
  for (const lvl of [20, 40, 60, 80, 95]) {
    const A = H.side('A', { all: { fielding: lvl, catching: lvl } });
    const con = [], ct = [], dr = [], bt = [], sv = [], mf = [], net = [], ro = [], win = [];
    for (let i = 0; i < N; i++) {
      const r = H.run(A, B0, 900001 + i * 104729, {});
      if (!r) continue;
      for (const inn of [r.i1, r.i2]) if (inn && inn.batTeam !== 'A') con.push(per50(inn.runs, inn.legal));
      const fl = fldOf(r, 'A');
      ct.push(cnt(fl, 'catch')); dr.push(cnt(fl, 'drop')); bt.push(cnt(fl, 'beat'));
      sv.push(cnt(fl, 'save1') + cnt(fl, 'save2') + cnt(fl, 'save3') + cnt(fl, 'save4'));
      mf.push(cnt(fl, 'misfield') + cnt(fl, 'fumble'));
      net.push(savedRuns(fl)); ro.push(cnt(fl, 'runout'));
      win.push(r.winner === 'A' ? 1 : (r.winner ? 0 : 0.5));
    }
    const C = summary(con), V = summary(win), NT = summary(net);
    say(`   ${String(lvl).padStart(2)}   ${f(C.mean)}±${C.se.toFixed(1)} ${f(summary(ct).mean)} ${f(summary(dr).mean)} ${f(summary(bt).mean)} ${f(summary(sv).mean)} ${f(summary(mf).mean)}   ${f(NT.mean)}     ${f(summary(ro).mean)} ${f(V.mean * 100, 1)}±${(V.se * 100).toFixed(1)}`);
    out.team.push({ lvl, conceded: C, catches: summary(ct), drops: summary(dr), beats: summary(bt),
      saves: summary(sv), misf: summary(mf), netSaved: NT, runouts: summary(ro), win: V });
  }
}

// ---------------------------------------------------------------------------
// §3 ONE MAN IN AN AVERAGE FIELD. Elite (90/90) or terrible (15/15) hands at
// slot 3 (a middle-order bat the assigner will post close/ring) against the
// same all-55 control, and HIS OWN ledger read from inn.fielding + events.
// ---------------------------------------------------------------------------
if (has('individual') || has('all')) {
  say('\n=== §3 ONE FIELDER MOVED, TEN HELD (N=' + N + ') ===');
  const B0 = H.side('B', {});
  out.individual = [];
  for (const [lbl, o] of [['11 average', {}],
    ['1 elite (bat2 90/90)', { slots: [{ slot: 2, skills: { fielding: 90, catching: 90 } }] }],
    ['1 terrible (bat2 15/15)', { slots: [{ slot: 2, skills: { fielding: 15, catching: 15 } }] }]]) {
    const A = H.side('A', o);
    const con = [], win = [], hisCt = [], net = [], dr = [];
    for (let i = 0; i < N; i++) {
      const r = H.run(A, B0, 900001 + i * 104729, {});
      if (!r) continue;
      for (const inn of [r.i1, r.i2]) {
        if (!inn || inn.batTeam === 'A') continue;
        con.push(per50(inn.runs, inn.legal));
        const mine = (inn.fielding || {})['A-bat2'];
        hisCt.push(mine ? (mine.ct + mine.ro + mine.st) : 0);
      }
      const fl = fldOf(r, 'A');
      net.push(savedRuns(fl)); dr.push(cnt(fl, 'drop'));
      win.push(r.winner === 'A' ? 1 : (r.winner ? 0 : 0.5));
    }
    const C = summary(con), V = summary(win), HC = summary(hisCt);
    say(`  ${lbl.padEnd(24)} conceded ${f(C.mean)}±${C.se.toFixed(1)}  his dismissals ${f(HC.mean, 3)}  team drops ${f(summary(dr).mean, 2)}  net saved ${f(summary(net).mean)}  win ${f(V.mean * 100, 1)}%`);
    out.individual.push({ lbl, conceded: C, win: V, hisDismissals: HC, drops: summary(dr), netSaved: summary(net) });
  }
}

// ---------------------------------------------------------------------------
// §4 FIELDING x GAME TEXTURE. The same fielding gap on different surfaces:
// value should ride on how many balls stay in play.
// ---------------------------------------------------------------------------
if (has('texture') || has('all')) {
  say('\n=== §4 FIELDING VALUE BY PITCH (elite-v-poor gap, N=' + N + ') ===');
  const B0 = H.side('B', {});
  out.texture = [];
  for (const pitch of ['flat', 'balanced', 'slow', 'green']) {
    const diffs = [], winD = [];
    const A20 = H.side('A', { all: { fielding: 20, catching: 20 } });
    const A90 = H.side('A', { all: { fielding: 90, catching: 90 } });
    for (let i = 0; i < N; i++) {
      const seed = 900001 + i * 104729;
      const rLo = H.run(A20, B0, seed, { pitch });
      const rHi = H.run(A90, B0, seed, { pitch });
      if (!rLo || !rHi) continue;
      const cLo = [], cHi = [];
      for (const inn of [rLo.i1, rLo.i2]) if (inn && inn.batTeam !== 'A') cLo.push(per50(inn.runs, inn.legal));
      for (const inn of [rHi.i1, rHi.i2]) if (inn && inn.batTeam !== 'A') cHi.push(per50(inn.runs, inn.legal));
      if (cLo.length && cHi.length) diffs.push(cLo[0] - cHi[0]);
      const w = r => r.winner === 'A' ? 1 : (r.winner ? 0 : 0.5);
      winD.push(w(rHi) - w(rLo));
    }
    const D = summary(diffs), W = summary(winD);
    say(`  ${pitch.padEnd(9)} elite field saves ${f(D.mean)}±${D.se.toFixed(1)} runs/50ov   win% swing ${f(W.mean * 100, 1)}`);
    out.texture.push({ pitch, savedPer50: D, winSwing: W });
  }
}

// ---------------------------------------------------------------------------
// §5 CATCHING ALONE. Only catching moves (ground fielding held at 55): the
// drop ledger across 20..95, plus weather.
// ---------------------------------------------------------------------------
if (has('catching') || has('all')) {
  say('\n=== §5 CATCHING 20..95, GROUND FIELDING HELD (N=' + N + ') ===');
  const B0 = H.side('B', {});
  say('  catching  chances   taken   dropped   beat   drop rate   conceded/50   win%');
  out.catching = [];
  for (const [lbl, o] of [
    ['20', { all: { catching: 20 } }], ['40', { all: { catching: 40 } }],
    ['60', { all: { catching: 60 } }], ['80', { all: { catching: 80 } }],
    ['95', { all: { catching: 95 } }],
    ['55+chilly', { weather: 'Chilly' }]]) {
    const A = H.side('A', o.all ? { all: o.all } : {});
    const ch = [], tk = [], dp = [], bt = [], con = [], win = [];
    for (let i = 0; i < N; i++) {
      const r = H.run(A, B0, 900001 + i * 104729, { weather: o.weather });
      if (!r) continue;
      const fl = fldOf(r, 'A');
      const c = cnt(fl, 'catch'), d = cnt(fl, 'drop'), b = cnt(fl, 'beat');
      ch.push(c + d + b); tk.push(c); dp.push(d); bt.push(b);
      for (const inn of [r.i1, r.i2]) if (inn && inn.batTeam !== 'A') con.push(per50(inn.runs, inn.legal));
      win.push(r.winner === 'A' ? 1 : (r.winner ? 0 : 0.5));
    }
    const T = summary(tk), D = summary(dp), C = summary(con), V = summary(win), B2 = summary(bt);
    const rate = D.mean / Math.max(0.001, T.mean + D.mean);
    say(`   ${lbl.padEnd(9)} ${f(summary(ch).mean)} ${f(T.mean)} ${f(D.mean)} ${f(B2.mean)}   ${f(rate * 100, 1)}%   ${f(C.mean)}±${C.se.toFixed(1)}  ${f(V.mean * 100, 1)}`);
    out.catching.push({ lbl, chances: summary(ch), taken: T, dropped: D, beat: B2, dropRate: rate, conceded: C, win: V });
  }
}

// ---------------------------------------------------------------------------
// §6 THE ARM. Ground fielding drives both the save ledger and who is
// credited with run-outs; Rocket Arm is the named talent. There is no
// separate throwing attribute — state it, then measure the talent.
// ---------------------------------------------------------------------------
if (has('arm') || has('all')) {
  say('\n=== §6 RUN-OUTS AND ROCKET ARM (N=' + N + ') ===');
  say('  (no separate throwing/arm skill exists: run-out CHANCE is the wRO');
  say('   logit + rocketArms count; the CREDIT draw is weighted by fielding');
  say('   x1.5 for Rocket Arm. Ground saves already measured in §2.)');
  const B0 = H.side('B', {});
  out.arm = [];
  for (const [lbl, o] of [['no talents', {}],
    ['1 Rocket Arm (bat2)', { slots: [{ slot: 2, talents: ['rocketArm'] }] }],
    ['3 Rocket Arms', { slots: [2, 3, 4].map(s => ({ slot: s, talents: ['rocketArm'] })) }]]) {
    const A = H.side('A', o);
    const ro = [], con = [], win = [];
    for (let i = 0; i < N; i++) {
      const r = H.run(A, B0, 900001 + i * 104729, {});
      if (!r) continue;
      const fl = fldOf(r, 'A');
      ro.push(cnt(fl, 'runout'));
      for (const inn of [r.i1, r.i2]) if (inn && inn.batTeam !== 'A') con.push(per50(inn.runs, inn.legal));
      win.push(r.winner === 'A' ? 1 : (r.winner ? 0 : 0.5));
    }
    const R = summary(ro), C = summary(con), V = summary(win);
    say(`  ${lbl.padEnd(22)} runouts/inn ${f(R.mean, 3)}±${R.se.toFixed(3)}  conceded ${f(C.mean)}  win ${f(V.mean * 100, 1)}%`);
    out.arm.push({ lbl, runouts: R, conceded: C, win: V });
  }
}

// ---------------------------------------------------------------------------
// §7 THE GLOVES, WHOLE-MATCH. Keeper quality 30..90 across surfaces and
// attack mixes; byes, stumpings, keeper catches, and what it is worth.
// ---------------------------------------------------------------------------
if (has('keeper') || has('all')) {
  say('\n=== §7 KEEPER 30..90 BY SURFACE AND ATTACK (N=' + N + ') ===');
  const mkKeeper = q => ({ slot: 5, skills: { keeping: q, stumping: q, catching: q } });
  out.keeperMatch = [];
  for (const [cond, pitch, types] of [
    ['green/pace', 'green', ['seamFast', 'seamFastMedium', 'seamMedium', 'seamFastMedium', 'seamFast']],
    ['balanced/mixed', 'balanced', null],
    ['dry/spin', 'dry', ['fingerSpin', 'wristSpin', 'fingerSpin', 'wristSpin', 'fingerSpin']]]) {
    say(`\n  ${cond}:`);
    say('  kq   conceded/50   byes/inn   st/inn   keeper ct/inn   win%');
    for (const q of [30, 50, 70, 90]) {
      const A = H.side('A', { slots: [mkKeeper(q)], bowlTypes: types || undefined });
      const B0 = H.side('B', { bowlTypes: types || undefined });
      const con = [], bye = [], st = [], kct = [], win = [];
      for (let i = 0; i < N; i++) {
        const r = H.run(A, B0, 900001 + i * 104729, { pitch });
        if (!r) continue;
        for (const inn of [r.i1, r.i2]) {
          if (!inn || inn.batTeam === 'A') continue;
          con.push(per50(inn.runs, inn.legal));
          bye.push(inn.extras.b + inn.extras.lb);
          const wk = (inn.fielding || {})['A-wk'] || { ct: 0, st: 0 };
          st.push(wk.st); kct.push(wk.ct);
        }
        win.push(r.winner === 'A' ? 1 : (r.winner ? 0 : 0.5));
      }
      const C = summary(con), V = summary(win);
      say(`  ${String(q).padStart(2)}  ${f(C.mean)}±${C.se.toFixed(1)}  ${f(summary(bye).mean)} ${f(summary(st).mean, 3)}  ${f(summary(kct).mean)}   ${f(V.mean * 100, 1)}±${(V.se * 100).toFixed(1)}`);
      out.keeperMatch.push({ cond, q, conceded: C, byes: summary(bye), st: summary(st), kct: summary(kct), win: V });
    }
  }
}

if (has('json')) console.log(JSON.stringify(out, null, 1));
