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

if (has('json')) console.log(JSON.stringify(out, null, 1));
