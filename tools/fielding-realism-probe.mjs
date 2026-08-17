#!/usr/bin/env node
/* tools/fielding-realism-probe.mjs — PHASE 2B: HOW BIG SHOULD THE FIELD BE?
 *
 * The audit (fielding-probe.mjs) established that fielding WORKS - real
 * positions, real hands, real identity - and that it is worth far too much:
 * team 20->95 moved ~107 runs, the realistic 40->80 band ~65. This probe is
 * the instrument for shrinking the MAGNITUDE without touching the identity.
 *
 *   §1 --exact   the catch contest solved in closed form: conversion by
 *                skill x chance-difficulty band, for the shipped slope and
 *                for every candidate compression k. No sims - the contest
 *                is 100*u^skew + band + angle vs skill, so the answer is
 *                arithmetic. (The brief's §7 shape tables.)
 *   §2 --decomp  the decomposition battery: team levels 20..95 with GROUND
 *                ONLY moved, CATCHING ONLY moved, and BOTH, batting and
 *                bowling held identical throughout. Full event ledger per
 *                cell: conceded, wickets, chances offered/taken/dropped/
 *                beaten, saves by size, misfields, run-outs, outcome counts
 *                (dots/1s/2s/3s/4s), fielding runs, win%.
 *   §3 --indiv   1/2/3 elite and 1/2/3 poor fielders in an average XI
 *                (diminishing returns is the requirement).
 *   §4 --pos     positional identity: elite catcher v elite athlete v par,
 *                read off the per-position event labels.
 *   §5 --cond    pitches x batting styles - value spread across conditions.
 *   §6 --arm     run-outs and Rocket Arm, before/after guard.
 *   §7 --keeper  keeper catches / stumpings / byes, before/after guard.
 *
 * Candidate slopes are exercised through the A/B flag __foFldK (catching
 * compression around FO_FLD.cpar) so OLD and NEW run in one build on
 * identical seeds.
 *
 *   node tools/fielding-realism-probe.mjs --exact
 *   node tools/fielding-realism-probe.mjs --decomp --n=300 --json
 */
import vm from 'node:vm';
import { makeHarness, summary, per50, arg, has } from './realism-lib.mjs';

const N = parseInt(arg('n', '240'), 10);
const H = makeHarness();
const set = e => vm.runInContext(e, H.ctx);
const out = {};
const say = s => { if (!has('json')) console.log(s); };
const f = (x, n = 2) => (x == null || !isFinite(x) ? '   -  ' : (+x).toFixed(n).padStart(7));
const winOf = r => r.winner === 'A' ? 1 : (r.winner ? 0 : 0.5);

const LEVELS = [20, 30, 40, 50, 60, 70, 80, 90, 95];

// the contest constants, read out of the build so the closed form can never
// drift from the engine
const FLD = JSON.parse(set('JSON.stringify(FO_FLD)'));

// ---------------------------------------------------------------------------
// §1 THE CATCH CONTEST IN CLOSED FORM. A chance is dealt
//     d = 100*u^skew + band.catch + ang*min(1, ang/cgate)
// and taken iff skill >= d; dropped iff d - skill <= drop. So for a given
// total offset B = band.catch + angle-term:
//     P(take | skill s) = P(u <= ((s - B)/100)^(1/skew))
// The "difficulty" of a chance is the dealt d itself; band it by the u-draw:
// routine u<0.5, moderate 0.5-0.8, difficult 0.8-0.95, extreme >0.95.
// ---------------------------------------------------------------------------
function pTake(skill, B, uLo, uHi) {
  // conversion among chances whose raw draw fell in [uLo,uHi)
  const conv = u => (100 * Math.pow(u, FLD.skew) + B) <= skill;
  let take = 0, n = 0;
  for (let i = 0; i < 4000; i++) {
    const u = uLo + (uHi - uLo) * (i + 0.5) / 4000;
    n++; if (conv(u)) take++;
  }
  return take / n;
}
if (has('exact') || has('all')) {
  const ks = [1.00, 0.85, 0.75, 0.65, 0.55, 0.45];
  const bands = [['routine', 0, 0.5], ['moderate', 0.5, 0.8], ['difficult', 0.8, 0.95], ['extreme', 0.95, 1]];
  out.exact = [];
  for (const k of ks) {
    say(`\n=== §1 CATCH CONVERSION, k=${k} (effCatch = ${FLD.cpar} + ${k}x(raw-${FLD.cpar})), straight chance ===`);
    say('  skill   ' + bands.map(b => b[0].padStart(9)).join('') + '   overall');
    const rows = [];
    for (const s of LEVELS) {
      const eff = FLD.cpar + k * (s - FLD.cpar);
      const row = { k, skill: s, eff };
      for (const [lbl, lo, hi] of bands) row[lbl] = pTake(eff, FLD.band.catch, lo, hi);
      row.overall = pTake(eff, FLD.band.catch, 0, 1);
      rows.push(row);
      say('   ' + String(s).padEnd(5) + bands.map(b => (100 * row[b[0]]).toFixed(1).padStart(9)).join('')
        + (100 * row.overall).toFixed(1).padStart(10));
    }
    out.exact.push(rows);
  }
}

// ---------------------------------------------------------------------------
// §2 THE DECOMPOSITION BATTERY. Side A's eleven all field+catch at par 50
// except the swept component; B is fixed par. Batting/bowling identical in
// every cell. A bowls-first orientation is NOT forced: both innings count,
// we read the innings A FIELDED (B batting).
// ---------------------------------------------------------------------------
function cellSide(mode, lvl) {
  const all = {};
  if (mode === 'ground' || mode === 'both') all.fielding = lvl; else all.fielding = 50;
  if (mode === 'catch' || mode === 'both') all.catching = lvl; else all.catching = 50;
  return H.side('A', { all });
}
function ledger(mode, lvl, n, opts) {
  const A = cellSide(mode, lvl);
  const B = H.side('B', { all: { fielding: 50, catching: 50 } });
  const acc = { con: [], wk: [], win: [], inns: 0,
    catch: 0, drop: 0, beat: 0, save1: 0, save2: 0, save3: 0, save4: 0,
    misf: 0, fumb: 0, runout: 0, dots: 0, ones: 0, twos: 0, threes: 0, fours: 0, sixes: 0 };
  for (let i = 0; i < n; i++) {
    const r = H.run(A, B, 300001 + i * 104729, opts || {});
    if (!r) continue;
    acc.win.push(winOf(r));
    for (const inn of [r.i1, r.i2]) {
      if (!inn || inn.batTeam === 'A') continue;    // the innings A fielded
      acc.inns++;
      acc.con.push(per50(inn.runs, inn.legal)); acc.wk.push(inn.wkts);
      const fl = inn.fld || {}, oc = inn.outs || {};
      acc.catch += fl.catch || 0; acc.drop += fl.drop || 0; acc.beat += fl.beat || 0;
      acc.save1 += fl.save1 || 0; acc.save2 += fl.save2 || 0;
      acc.save3 += fl.save3 || 0; acc.save4 += fl.save4 || 0;
      acc.misf += fl.misfield || 0; acc.fumb += fl.fumble || 0; acc.runout += fl.runout || 0;
      acc.dots += oc.dot || 0; acc.ones += oc['1'] || 0; acc.twos += oc['2'] || 0;
      acc.threes += oc['3'] || 0; acc.fours += oc['4'] || 0; acc.sixes += oc['6'] || 0;
    }
  }
  const per = k => acc[k] / Math.max(1, acc.inns);
  return { mode, lvl, conceded: summary(acc.con), wkts: summary(acc.wk), win: summary(acc.win),
    inns: acc.inns,
    offered: per('catch') + per('drop') + per('beat'),
    taken: per('catch'), dropped: per('drop'), beaten: per('beat'),
    saves: { s1: per('save1'), s2: per('save2'), s3: per('save3'), s4: per('save4') },
    fieldRuns: per('save1') * 1 + per('save2') * 2 + per('save3') * 3 + per('save4') * 4
      - per('misf') - per('fumb'),
    misfields: per('misf') + per('fumb'), runouts: per('runout'),
    outs: { dot: per('dots'), one: per('ones'), two: per('twos'),
      three: per('threes'), four: per('fours'), six: per('sixes') } };
}
if (has('decomp') || has('all')) {
  out.decomp = [];
  for (const mode of ['ground', 'catch', 'both']) {
    say(`\n=== §2 DECOMPOSITION: ${mode.toUpperCase()} swept, everything else par (N=${N}/cell) ===`);
    say('  lvl  conceded     wkts  win%   off   take  drop  beat | s1   s2   s3   s4   misf  ro  | 1s    2s    4s');
    for (const lvl of LEVELS) {
      const L = ledger(mode, lvl, N);
      out.decomp.push(L);
      say('  ' + String(lvl).padEnd(4) + f(L.conceded.mean, 1) + '±' + L.conceded.se.toFixed(1).padEnd(4)
        + f(L.wkts.mean, 2) + f(100 * L.win.mean, 1) + ' '
        + f(L.offered, 2) + f(L.taken, 2) + f(L.dropped, 2) + f(L.beaten, 2) + ' |'
        + f(L.saves.s1, 1) + f(L.saves.s2, 1) + f(L.saves.s3, 1) + f(L.saves.s4, 1)
        + f(L.misfields, 1) + f(L.runouts, 1) + ' |' + f(L.outs.one, 1) + f(L.outs.two, 1) + f(L.outs.four, 1));
    }
  }
}

// ---------------------------------------------------------------------------
// §2b THE SWEEP. Candidate ck values over the cells that define the brief's
// sanity checks - catching swept (and both swept) at 20/40/50/70/80/95 -
// each cell on the same seeds as every other, so any two cells difference
// out. The 40->80 gap (currently ~65 with both) is the number under
// indictment; 20->95 must stay dramatic; 50 must not move at all.
// ---------------------------------------------------------------------------
// The baseline decomposition measured the channels ADDITIVE (ground 50.0 +
// catch 15.6 = both 65.6 on the 40->80 gap), so each knob is swept in its
// own channel - ground-swept cells over gk, catch-swept cells over ck - and
// the chosen pair is then verified in both-mode with --verify.
if (has('sweep')) {
  const ks = (arg('ks', '')).split(',').filter(Boolean).map(Number);
  const gks = (arg('gks', '')).split(',').filter(Boolean).map(Number);
  const SL = [20, 40, 50, 70, 80, 95];
  out.sweep = [];
  const sweepOne = (mode, flag, val) => {
    set(`__foFldK=1;__foFldKG=1;${flag}=${val};1`);
    say(`\n=== §2b SWEEP ${mode} ${flag.replace('__foFld', '')}=${val} (N=${N}/cell) ===`);
    say('  lvl  conceded     wkts   win%   take  misf  fieldRuns');
    const rows = [];
    for (const lvl of SL) {
      const L = ledger(mode, lvl, N);
      rows.push(L);
      say('  ' + String(lvl).padEnd(4) + f(L.conceded.mean, 1) + '±' + L.conceded.se.toFixed(1).padEnd(4)
        + f(L.wkts.mean, 2) + f(100 * L.win.mean, 1) + f(L.taken, 2) + f(L.misfields, 1) + f(L.fieldRuns, 1));
    }
    const at = l => rows.find(r => r.lvl === l);
    const gap = (a, b) => (at(a).conceded.mean - at(b).conceded.mean);
    say(`  gaps: 40->80 ${gap(40, 80).toFixed(1)}  50->70 ${gap(50, 70).toFixed(1)}  20->95 ${gap(20, 95).toFixed(1)}  misf@20 ${at(20).misfields.toFixed(1)}  misf@40 ${at(40).misfields.toFixed(1)}`);
    out.sweep.push({ mode, k: val, rows,
      gaps: { g4080: gap(40, 80), g5070: gap(50, 70), g2095: gap(20, 95) } });
  };
  for (const gk of gks) sweepOne('ground', '__foFldKG', gk);
  for (const k of ks) sweepOne('catch', '__foFldK', k);
  set('__foFldK=1;__foFldKG=1;1');
}
// --verify --ck=X --gk=Y : the chosen pair, both-mode, full ledger
if (has('verify')) {
  const k = Number(arg('ck', '1')), gk = Number(arg('gk', '1'));
  set(`__foFldK=${k};__foFldKG=${gk};1`);
  say(`\n=== §2c VERIFY ck=${k} gk=${gk} (N=${N}/cell, both-swept) ===`);
  say('  lvl  conceded     wkts  win%   off   take  drop  beat | s1   s2   s3   s4   misf  ro  | fieldRuns');
  out.verify = [];
  for (const lvl of LEVELS) {
    const L = ledger('both', lvl, N);
    out.verify.push(L);
    say('  ' + String(lvl).padEnd(4) + f(L.conceded.mean, 1) + '±' + L.conceded.se.toFixed(1).padEnd(4)
      + f(L.wkts.mean, 2) + f(100 * L.win.mean, 1) + ' '
      + f(L.offered, 2) + f(L.taken, 2) + f(L.dropped, 2) + f(L.beaten, 2) + ' |'
      + f(L.saves.s1, 1) + f(L.saves.s2, 1) + f(L.saves.s3, 1) + f(L.saves.s4, 1)
      + f(L.misfields, 1) + f(L.runouts, 1) + ' |' + f(L.fieldRuns, 1));
  }
  const at = l => out.verify.find(r => r.lvl === l);
  const gap = (a, b) => (at(a).conceded.mean - at(b).conceded.mean);
  say(`  gaps: 40->80 ${gap(40, 80).toFixed(1)}  50->70 ${gap(50, 70).toFixed(1)}  20->95 ${gap(20, 95).toFixed(1)}`);
  set('__foFldK=1;__foFldKG=1;1');
}

// ---------------------------------------------------------------------------
// §3 INDIVIDUALS. n elite (90/90) or n liability (25/25) fielders in an
// otherwise all-par XI, against the all-par control on the same seeds.
// The requirement is diminishing returns: three elites valuable, not
// transformative.
// ---------------------------------------------------------------------------
function pairVs(mkA, n, seed0) {
  const ctrl = H.side('A', { all: { fielding: 50, catching: 50 } });
  const B = H.side('B', { all: { fielding: 50, catching: 50 } });
  const dc = [], dv = [], ev = { catch: 0, save: 0, misf: 0, inns: 0 };
  for (let i = 0; i < n; i++) {
    const s = (seed0 || 410001) + i * 104729;
    const r1 = H.run(ctrl, B, s, {}), r2 = H.run(mkA, B, s, {});
    if (!r1 || !r2) continue;
    dv.push(winOf(r2) - winOf(r1));
    let c1 = null, c2 = null;
    for (const inn of [r1.i1, r1.i2]) if (inn && inn.batTeam !== 'A') c1 = per50(inn.runs, inn.legal);
    for (const inn of [r2.i1, r2.i2]) if (inn && inn.batTeam !== 'A') {
      c2 = per50(inn.runs, inn.legal);
      const fl = inn.fld || {}; ev.inns++;
      ev.catch += fl.catch || 0;
      ev.save += (fl.save1 || 0) + (fl.save2 || 0) + (fl.save3 || 0) + (fl.save4 || 0);
      ev.misf += (fl.misfield || 0) + (fl.fumble || 0);
    }
    if (c1 != null && c2 != null) dc.push(c1 - c2);
  }
  return { dSaved: summary(dc), dWin: summary(dv),
    catches: ev.catch / Math.max(1, ev.inns), saves: ev.save / Math.max(1, ev.inns),
    misf: ev.misf / Math.max(1, ev.inns) };
}
if (has('indiv') || has('all')) {
  say(`\n=== §3 INDIVIDUALS in an all-par XI (N=${N} paired) ===`);
  out.indiv = [];
  // slots 1..3 are top-order bats in the factory XI - the assignment engine
  // decides where their hands actually stand
  const mk = (cnt, fld, cat) => {
    const slots = [];
    for (let i = 0; i < cnt; i++) slots.push({ slot: 1 + i, skills: { fielding: fld, catching: cat } });
    return H.side('A', { all: { fielding: 50, catching: 50 }, slots });
  };
  for (const [lbl, cnt, fld, cat] of [
    ['1 elite', 1, 90, 90], ['2 elite', 2, 90, 90], ['3 elite', 3, 90, 90],
    ['1 poor', 1, 25, 25], ['2 poor', 2, 25, 25], ['3 poor', 3, 25, 25]]) {
    const R = pairVs(mk(cnt, fld, cat), N);
    out.indiv.push({ lbl, ...R });
    say(`  ${lbl.padEnd(9)} saves ${f(R.dSaved.mean, 2)}±${R.dSaved.se.toFixed(2)} runs, ${f(R.dWin.mean * 100, 1)} win pts  (catches/inn ${R.catches.toFixed(2)}, gsaves ${R.saves.toFixed(1)}, misf ${R.misf.toFixed(1)})`);
  }
}

// ---------------------------------------------------------------------------
// §4 POSITIONS. Identity through the assignment engine: an elite CATCHER
// (hands 90, legs 50) should earn his keep in the cordon; an elite ATHLETE
// (legs 90, hands 50) on the ground; a LIABILITY (25/25) should be hidden
// but still found. Read off the per-position event labels.
// ---------------------------------------------------------------------------
if (has('pos') || has('all')) {
  say(`\n=== §4 POSITIONAL IDENTITY (N=${N}) ===`);
  out.pos = [];
  const CORDON = ['slip', 'gully', 'keeper'];
  const runOne = (lbl, skills) => {
    const A = H.side('A', { all: { fielding: 50, catching: 50 }, slots: [{ slot: 2, skills }] });
    const B = H.side('B', { all: { fielding: 50, catching: 50 } });
    const name = A.players[2].name;
    const at = {};
    let inns = 0;
    for (let i = 0; i < N; i++) {
      const r = H.run(A, B, 430001 + i * 104729, {});
      if (!r) continue;
      for (const inn of [r.i1, r.i2]) {
        if (!inn || inn.batTeam === 'A') continue;
        inns++;
        for (const k in inn.fld || {}) {
          const m = k.match(/^(catch|save|drop|misfield|fumble)@(.+)$/);
          if (m) { at[m[1] + '@' + m[2]] = (at[m[1] + '@' + m[2]] || 0) + inn.fld[k]; }
        }
      }
    }
    const catchesCordon = Object.keys(at).filter(k => k.startsWith('catch@') && CORDON.some(c => k.toLowerCase().includes(c)))
      .reduce((a, k) => a + at[k], 0);
    const catchesAll = Object.keys(at).filter(k => k.startsWith('catch@')).reduce((a, k) => a + at[k], 0);
    out.pos.push({ lbl, man: name, inns, at, catchesCordon, catchesAll });
    say(`  ${lbl.padEnd(22)} cordon catches/inn ${(catchesCordon / Math.max(1, inns)).toFixed(2)}  all catches ${(catchesAll / Math.max(1, inns)).toFixed(2)}`);
  };
  runOne('elite catcher (90 hands)', { fielding: 50, catching: 90 });
  runOne('elite athlete (90 legs)', { fielding: 90, catching: 50 });
  runOne('par control', { fielding: 50, catching: 50 });
  runOne('liability (25/25)', { fielding: 25, catching: 25 });
}

// ---------------------------------------------------------------------------
// §5 CONDITIONS. Team 40 v 80 (the strategic band) across pitches and
// batting styles - the spread should arise NATURALLY, no per-pitch terms.
// ---------------------------------------------------------------------------
if (has('cond') || has('all')) {
  say(`\n=== §5 CONDITIONS, team 40 v 80 paired (N=${N}/cell) ===`);
  out.cond = [];
  const lo = H.side('A', { all: { fielding: 40, catching: 40 } });
  const hi = H.side('A', { all: { fielding: 80, catching: 80 } });
  // batting styles are per-man skill edits on B's five bats (slots 0-4);
  // o.all has no batting knob and the tail should stay a tail
  const batSlots = sk => [0, 1, 2, 3, 4].map(i => ({ slot: i, skills: sk }));
  const styles = {
    'par batting': null,
    'boundary-heavy': { power: 75, rotation: 40 },
    'rotation-heavy': { power: 40, rotation: 75 },
    'weak batting': { vsPace: 40, vsSpin: 40 },
    'elite batting': { vsPace: 80, vsSpin: 80 }
  };
  for (const pitch of ['green', 'balanced', 'flat', 'slow', 'dry']) {
    for (const [sl, sk] of Object.entries(styles)) {
      const B = H.side('B', { all: { fielding: 50, catching: 50 },
        slots: sk ? batSlots(sk) : [] });
      const dc = [];
      for (let i = 0; i < N; i++) {
        const s = 450001 + i * 104729;
        const r1 = H.run(lo, B, s, { pitch }), r2 = H.run(hi, B, s, { pitch });
        if (!r1 || !r2) continue;
        let c1 = null, c2 = null;
        for (const inn of [r1.i1, r1.i2]) if (inn && inn.batTeam !== 'A') c1 = per50(inn.runs, inn.legal);
        for (const inn of [r2.i1, r2.i2]) if (inn && inn.batTeam !== 'A') c2 = per50(inn.runs, inn.legal);
        if (c1 != null && c2 != null) dc.push(c1 - c2);
      }
      const D = summary(dc);
      out.cond.push({ pitch, style: sl, d4080: D });
      say(`  ${pitch.padEnd(9)} ${sl.padEnd(15)} 40->80 worth ${f(D.mean, 1)}±${D.se.toFixed(1)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// §6 RUN-OUTS AND THE ARM - the guard. Baseline rate, one Rocket Arm, three.
// The recalibration must not have moved these; if it has, report, don't fix.
// ---------------------------------------------------------------------------
if (has('arm') || has('all')) {
  say(`\n=== §6 RUN-OUTS / ROCKET ARM guard (N=${N}) ===`);
  out.arm = [];
  const mk = arms => {
    const slots = [];
    for (let i = 0; i < arms; i++) slots.push({ slot: 1 + i, talents: ['rocketArm'] });
    return H.side('A', { all: { fielding: 50, catching: 50 }, slots });
  };
  const B = H.side('B', { all: { fielding: 50, catching: 50 } });
  for (const arms of [0, 1, 3]) {
    const A = mk(arms);
    const ro = [], con = [];
    for (let i = 0; i < N; i++) {
      const r = H.run(A, B, 470001 + i * 104729, {});
      if (!r) continue;
      for (const inn of [r.i1, r.i2]) {
        if (!inn || inn.batTeam === 'A') continue;
        ro.push((inn.fld || {}).runout || 0); con.push(per50(inn.runs, inn.legal));
      }
    }
    out.arm.push({ arms, runouts: summary(ro), conceded: summary(con) });
    say(`  ${arms} rocket arms: run-outs/inn ${f(summary(ro).mean, 3)}  conceded ${f(summary(con).mean, 1)}`);
  }
}

// ---------------------------------------------------------------------------
// §7 THE KEEPER - the guard. Keeper 74 (world median) v 95 v 50: catches,
// stumpings, byes. The compression must not have touched him.
// ---------------------------------------------------------------------------
if (has('keeper') || has('all')) {
  say(`\n=== §7 KEEPER guard (N=${N}) ===`);
  out.keeper = [];
  for (const kq of [50, 74, 95]) {
    // the keeper is slot 5 in the factory XI; a keeper catch is the one
    // catch with no post label, so it is counted as total minus posted
    const A = H.side('A', { all: { fielding: 50, catching: 50 },
      slots: [{ slot: 5, skills: { keeping: kq, stumping: kq, catching: kq } }] });
    const B = H.side('B', { all: { fielding: 50, catching: 50 } });
    const st = [], by = [], kc = [];
    for (let i = 0; i < N; i++) {
      const r = H.run(A, B, 490001 + i * 104729, {});
      if (!r) continue;
      for (const inn of [r.i1, r.i2]) {
        if (!inn || inn.batTeam === 'A') continue;
        st.push((inn.fld || {}).stumping || 0);
        by.push((inn.extras || {}).b || 0);
        const fl = inn.fld || {};
        let posted = 0;
        for (const k in fl) if (k.startsWith('catch@')) posted += fl[k];
        kc.push((fl.catch || 0) - posted);
      }
    }
    out.keeper.push({ kq, stumpings: summary(st), byes: summary(by), keeperCatches: summary(kc) });
    say(`  keeper ${String(kq).padEnd(3)}: stumpings/inn ${f(summary(st).mean, 3)}  byes ${f(summary(by).mean, 2)}  keeper catches ${f(summary(kc).mean, 2)}`);
  }
}

if (has('json')) console.log(JSON.stringify(out, null, 1));
