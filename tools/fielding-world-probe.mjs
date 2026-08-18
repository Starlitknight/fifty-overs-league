#!/usr/bin/env node
/* tools/fielding-world-probe.mjs — THE ACCEPTANCE QUESTION: what do teams
 * that ACTUALLY EXIST differ by in the field?
 *
 * The 40->80 synthetic band is eleven clones against eleven clones, which no
 * league has ever fielded. This probe measures the real populations:
 *
 *   §1 --dist    the fielding/catching distribution of the world - 64
 *                generated club squads (XI chosen by the Match-Day Coach,
 *                not by sorting), individual players, and the calibration
 *                tiers (international / flagship / division two, via the
 *                same skill factors tools/calibration.mjs plays them at).
 *   §2 --spread  the real-spread translation: the P10/P25/P75/P90 teams'
 *                actual XI fielding PROFILES (eleven real (field,catch)
 *                pairs, spread preserved) painted onto the controlled probe
 *                side, batting and bowling held identical, played paired.
 *                Answers: what is the fielding gap between two teams that
 *                could meet in the same league?
 *   §3 --d2     division two OLD v NEW on identical seeds: the full event
 *                ledger behind the 16-run calibration drift - misfields,
 *                saves, catches, wickets, balls, boundaries - so the drop
 *                is explained in cricket, not in aggregate.
 *   §4 --cards  match-quality sanity: per-innings event counts for elite v
 *                elite, poor v poor, elite v poor, div-one v div-one,
 *                div-two v div-two - does it LOOK like cricket?
 *
 *   node tools/fielding-world-probe.mjs --dist --spread --n=400 --json
 */
import vm from 'node:vm';
import { makeHarness, summary, per50, arg, has } from './realism-lib.mjs';
import { makeEngine } from '../test/engine-vm.mjs';

const N = parseInt(arg('n', '300'), 10);
const H = makeHarness();
const E = makeEngine();
const set = e => vm.runInContext(e, H.ctx);
const out = {};
const say = s => { if (!has('json')) console.log(s); };
const f = (x, n = 2) => (x == null || !isFinite(x) ? '   -  ' : (+x).toFixed(n).padStart(7));
const winOf = r => r.winner === 'A' ? 1 : (r.winner ? 0 : 0.5);
const pct = (sorted, p) => sorted[Math.max(0, Math.min(sorted.length - 1, Math.round(p * (sorted.length - 1))))];

// the coach picks the XI exactly as a match would; profile = the XI's eleven
// (field, catch) pairs. Catching mean is outfielders-only, the way the
// contest reads it.
vm.runInContext(`globalThis.__wpXiProfile = function (teamJson) {
  var team = JSON.parse(teamJson);
  var plan = planMatchDay({ team: team, pitch: 'balanced', weather: 'sunny', doctrine: null });
  var xi = plan.battingOrder.map(function (nm) {
    return team.players.filter(function (p) { return p.name === nm; })[0];
  }).filter(Boolean);
  return JSON.stringify(xi.map(function (p) {
    return { field: p.field || (p.skills && p.skills.fielding) || 50,
             catch: (p.skills && p.skills.catching) || 50,
             keeper: p.role === 'wicketkeeper' };
  }));
};`, E.ctx);

// a generated world: 64 club squads over the generator's archetypes
const ARCHS = ['balanced', 'oldGuard', 'youthProject', 'starAndScrubs', 'bowlingFactory', 'battingParadise', 'allRounders', 'graftAndGrit'];
function genProfiles(factor) {
  const profs = [];
  for (let i = 0; i < 64; i++) {
    const sq = E.genSquad(9100 + i * 37, 'England', ARCHS[i % ARCHS.length] || 'balanced', 'general');
    if (!sq) continue;
    let team = { name: 'T' + i, players: sq.players };
    if (factor && factor !== 1) {
      team = JSON.parse(JSON.stringify(team));
      for (const p of team.players) {
        for (const k in p.skills || {}) p.skills[k] = p.skills[k] * factor;
        p.field = (p.field || 50) * factor;
      }
    }
    try {
      const xi = JSON.parse(vm.runInContext(`__wpXiProfile(${JSON.stringify(JSON.stringify(team))})`, E.ctx));
      if (xi.length === 11) profs.push(xi);
    } catch (e) { /* a broken squad is not evidence */ }
  }
  return profs;
}
const teamStats = profs => {
  const fm = profs.map(x => x.reduce((a, p) => a + p.field, 0) / 11).sort((a, b) => a - b);
  const cm = profs.map(x => {
    const o = x.filter(p => !p.keeper);
    return o.reduce((a, p) => a + p.catch, 0) / Math.max(1, o.length);
  }).sort((a, b) => a - b);
  const st = v => ({ mean: v.reduce((a, b) => a + b, 0) / v.length, med: pct(v, 0.5),
    p10: pct(v, 0.10), p25: pct(v, 0.25), p75: pct(v, 0.75), p90: pct(v, 0.90),
    min: v[0], max: v[v.length - 1] });
  return { field: st(fm), catch: st(cm) };
};

let WORLD = null;   // the unscaled generated world, shared by §1/§2/§4
if (has('dist') || has('spread') || has('all')) WORLD = genProfiles(1);

if (has('dist') || has('all')) {
  out.dist = {};
  const tiers = [['generated club world', 1], ['international (x0.850)', 0.850],
    ['flagship (x0.755)', 0.755], ['division two (x0.529)', 0.529]];
  for (const [lbl, fac] of tiers) {
    const profs = fac === 1 ? WORLD : genProfiles(fac);
    const s = teamStats(profs);
    out.dist[lbl] = s;
    say(`\n=== §1 ${lbl}: ${profs.length} team XIs ===`);
    for (const k of ['field', 'catch'])
      say(`  ${k.padEnd(6)} mean ${f(s[k].mean, 1)} med ${f(s[k].med, 1)} P10 ${f(s[k].p10, 1)} P25 ${f(s[k].p25, 1)} P75 ${f(s[k].p75, 1)} P90 ${f(s[k].p90, 1)} min ${f(s[k].min, 1)} max ${f(s[k].max, 1)}`);
  }
  // individuals, unscaled world
  const ind = [];
  for (const xi of WORLD) for (const p of xi) ind.push(p);
  const fv = ind.map(p => p.field).sort((a, b) => a - b), cv = ind.map(p => p.catch).sort((a, b) => a - b);
  out.dist.individuals = {
    field: { p10: pct(fv, 0.1), p50: pct(fv, 0.5), p90: pct(fv, 0.9), min: fv[0], max: fv[fv.length - 1] },
    catch: { p10: pct(cv, 0.1), p50: pct(cv, 0.5), p90: pct(cv, 0.9), min: cv[0], max: cv[cv.length - 1] } };
  say(`  individuals: field P10/${f(pct(fv, 0.1), 0)} P50/${f(pct(fv, 0.5), 0)} P90/${f(pct(fv, 0.9), 0)} range ${f(fv[0], 0)}-${f(fv[fv.length - 1], 0)}; catch P10/${f(pct(cv, 0.1), 0)} P50/${f(pct(cv, 0.5), 0)} P90/${f(pct(cv, 0.9), 0)}`);
}

// paint a real XI profile onto the controlled side: slot i gets team's i-th
// (field, catch) pair (profiles sorted so the best hands land on the same
// probe slots either side of the comparison)
function paintSide(profile) {
  const sorted = profile.slice().sort((a, b) => (b.field + b.catch) - (a.field + a.catch));
  return H.side('A', { slots: sorted.map((p, i) => ({ slot: i, skills: { fielding: p.field, catching: p.catch } })) });
}
function pairGap(profLo, profHi, n, seed0) {
  const lo = paintSide(profLo), hi = paintSide(profHi);
  const B = H.side('B', { all: { fielding: 50, catching: 50 } });
  const dc = [], dv = [], dw = [];
  for (let i = 0; i < n; i++) {
    const s = (seed0 || 710001) + i * 104729;
    const r1 = H.run(lo, B, s, {}), r2 = H.run(hi, B, s, {});
    if (!r1 || !r2) continue;
    dv.push(winOf(r2) - winOf(r1));
    let c1 = null, c2 = null, w1 = null, w2 = null;
    for (const inn of [r1.i1, r1.i2]) if (inn && inn.batTeam !== 'A') { c1 = per50(inn.runs, inn.legal); w1 = inn.wkts; }
    for (const inn of [r2.i1, r2.i2]) if (inn && inn.batTeam !== 'A') { c2 = per50(inn.runs, inn.legal); w2 = inn.wkts; }
    if (c1 != null && c2 != null) { dc.push(c1 - c2); dw.push(w2 - w1); }
  }
  return { dRuns: summary(dc), dWkts: summary(dw), dWin: summary(dv) };
}
if (has('spread') || has('all')) {
  say(`\n=== §2 REAL-SPREAD FIELDING GAPS (N=${N} paired; batting/bowling identical) ===`);
  out.spread = [];
  // rank the world's XIs by combined effective mean and take the percentile TEAMS
  const ranked = WORLD.slice().sort((a, b) => {
    const eff = x => x.reduce((s2, p) => s2 + p.field + p.catch, 0);
    return eff(a) - eff(b);
  });
  const team = p => ranked[Math.round(p * (ranked.length - 1))];
  for (const [lbl, lo, hi] of [
    ['P10 v P90 (same league)', team(0.10), team(0.90)],
    ['P25 v P75 (typical weak v strong)', team(0.25), team(0.75)],
    ['min v max (worst v best realistic)', ranked[0], ranked[ranked.length - 1]]]) {
    const g = pairGap(lo, hi, N);
    const mn = x => (x.reduce((s2, p) => s2 + p.field, 0) / 11).toFixed(1);
    out.spread.push({ lbl, loField: +mn(lo), hiField: +mn(hi), ...g });
    say(`  ${lbl.padEnd(36)} (field ${mn(lo)} v ${mn(hi)}): ${f(g.dRuns.mean, 1)}±${g.dRuns.se.toFixed(1)} runs, ${f(g.dWkts.mean, 2)} wkts, ${f(g.dWin.mean * 100, 1)}±${(g.dWin.se * 100).toFixed(1)} win pts`);
  }
}

// ---------------------------------------------------------------------------
// §3 DIVISION TWO, OLD v NEW, same seeds. Both sides carry the d2 fielding
// profile (real spread at the tier's level); batting/bowling untouched by
// the flags, so every difference in the ledger is the fielding model.
// ---------------------------------------------------------------------------
if (has('d2') || has('all')) {
  say(`\n=== §3 DIVISION TWO: OLD v NEW on identical seeds (N=${N}) ===`);
  const profs = genProfiles(0.529);
  const prof = profs[Math.round(profs.length / 2)];  // the median d2 team
  const A = paintSide(prof), B2 = paintSide(profs[Math.round(profs.length / 2) + 1] || prof);
  const runCell = flags => {
    set(flags);
    const acc = { con: [], wk: [], legal: [], catch: 0, drop: 0, save: 0, misf: 0, fours: 0, inns: 0 };
    for (let i = 0; i < N; i++) {
      const r = H.run(A, B2, 810001 + i * 104729, {});
      if (!r) continue;
      for (const inn of [r.i1, r.i2]) {
        if (!inn) continue;
        acc.inns++; acc.con.push(per50(inn.runs, inn.legal)); acc.wk.push(inn.wkts);
        acc.legal.push(inn.legal);
        const fl = inn.fld || {}, oc = inn.outs || {};
        acc.catch += fl.catch || 0; acc.drop += fl.drop || 0;
        acc.save += (fl.save1 || 0) + (fl.save2 || 0) + (fl.save3 || 0) + (fl.save4 || 0);
        acc.misf += (fl.misfield || 0) + (fl.fumble || 0);
        acc.fours += oc['4'] || 0;
      }
    }
    const per = k => acc[k] / Math.max(1, acc.inns);
    return { conceded: summary(acc.con), wkts: summary(acc.wk), balls: summary(acc.legal),
      catch: per('catch'), drop: per('drop'), save: per('save'), misf: per('misf'), fours: per('fours') };
  };
  const OLD = runCell('__foFldK=1;__foFldKG=1;1');
  const NEW = runCell('__foFldK=undefined;__foFldKG=undefined;1');
  out.d2 = { OLD, NEW };
  const row = (k, fn) => say(`  ${k.padEnd(12)} ${f(fn(OLD), 2)} -> ${f(fn(NEW), 2)}`);
  row('score/50', x => x.conceded.mean); row('wkts', x => x.wkts.mean);
  row('balls/inn', x => x.balls.mean);
  row('catches', x => x.catch); row('drops', x => x.drop);
  row('gsaves', x => x.save); row('misfields', x => x.misf); row('fours', x => x.fours);
}

// ---------------------------------------------------------------------------
// §4 MATCH-QUALITY SANITY: event counts per innings for the five pairings.
// ---------------------------------------------------------------------------
if (has('cards') || has('all')) {
  say(`\n=== §4 WHAT A MATCH LOOKS LIKE (N=${Math.min(N, 120)}/pairing) ===`);
  out.cards = [];
  const M0 = Math.min(N, 120);
  const mk2 = lvl => H.side('A', { all: { fielding: lvl, catching: lvl } });
  const ranked = (WORLD || genProfiles(1)).slice().sort((a, b) => {
    const eff = x => x.reduce((s2, p) => s2 + p.field + p.catch, 0);
    return eff(a) - eff(b);
  });
  const d2profs = genProfiles(0.529);
  const CASES = [
    ['elite v elite', mk2(85), mk2(85)],
    ['poor v poor', mk2(28), mk2(28)],
    ['elite v poor', mk2(85), mk2(28)],
    ['ordinary div one', paintSide(ranked[Math.round(ranked.length / 2)]), paintSide(ranked[Math.round(ranked.length / 2) + 1])],
    ['ordinary div two', paintSide(d2profs[Math.round(d2profs.length / 2)]), paintSide(d2profs[Math.round(d2profs.length / 2) + 1])]];
  for (const [lbl, A, B2] of CASES) {
    const acc = { catch: 0, drop: 0, save: 0, misf: 0, inns: 0 };
    for (let i = 0; i < M0; i++) {
      const r = H.run(A, B2, 910001 + i * 104729, {});
      if (!r) continue;
      for (const inn of [r.i1, r.i2]) {
        if (!inn) continue;
        acc.inns++;
        const fl = inn.fld || {};
        acc.catch += fl.catch || 0; acc.drop += fl.drop || 0;
        acc.save += (fl.save1 || 0) + (fl.save2 || 0) + (fl.save3 || 0) + (fl.save4 || 0);
        acc.misf += (fl.misfield || 0) + (fl.fumble || 0);
      }
    }
    const per = k => (acc[k] / Math.max(1, acc.inns));
    out.cards.push({ lbl, catches: per('catch'), drops: per('drop'), saves: per('save'), misfields: per('misf') });
    say(`  ${lbl.padEnd(18)} per innings: catches ${f(per('catch'), 2)}  drops ${f(per('drop'), 2)}  saves ${f(per('save'), 1)}  misfields ${f(per('misf'), 1)}`);
  }
}

if (has('json')) console.log(JSON.stringify(out, null, 1));
