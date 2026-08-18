#!/usr/bin/env node
/* tools/role-fatigue-probe.mjs — ROLE-SPECIFIC FATIGUE POLISH.
 *
 * Three narrow questions, each with its own section and off-switch flags:
 *
 *   §1 --ladder   the bowling-type workload hierarchy. One test bowler per
 *                 type (fast / fastMedium / medium / fingerSpin / wristSpin),
 *                 otherwise identical cards, FORCED through a continuous
 *                 10-over spell by a painted plan, at stamina 30/50/70/90.
 *                 Measures the tank trajectory (traceFat), end/peak fat,
 *                 early-v-late spell economy and wickets. __foFatSpin sweeps
 *                 the spin work factor; 1.0 is the shipped tie with medium.
 *   §2 --between  the server's between-match law, mirrored arithmetically
 *                 (constants read out of server/living.mjs so they cannot
 *                 drift): post-match fatN and consecutive-match steady
 *                 states per type, shipped v candidate scales.
 *   §3 --keeper   keeping first -> batting second. Side A forced to field
 *                 first (tossDecision on the painted orders); the keeper's
 *                 tank at the innings break, his batting output, and the
 *                 team total, keepDiv candidates x stamina, paired seeds.
 *   §4 --glove    late-innings glove work: byes / stumping misses / keeper
 *                 drops banded by over (early <10 v late >=40), keeping
 *                 40/60/80/95, gloveFat candidates.
 *   §5 --captfat  the tired mind: capt 50..95 x fatigue rested..exhausted
 *                 in the difficult fixture, captFat candidates. Decision
 *                 log miss rates + conceded, fresh-v-tired paired.
 *   §6 --combos   the double-duty men: keeper-captain, fast-bowler-captain,
 *                 spinner-captain - in-match tanks and between-match loads.
 *
 *   node tools/role-fatigue-probe.mjs --ladder --n=200
 */
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { makeHarness, summary, per50, arg, has } from './realism-lib.mjs';

const N = parseInt(arg('n', '200'), 10);
const H = makeHarness();
const set = e => vm.runInContext(e, H.ctx);
const out = {};
const say = s => { if (!has('json')) console.log(s); };
const f = (x, n = 2) => (x == null || !isFinite(x) ? '   -  ' : (+x).toFixed(n).padStart(7));
const winOf = r => r.winner === 'A' ? 1 : (r.winner ? 0 : 0.5);

const TYPES = [['fast', 'seamFast'], ['fastMedium', 'seamFastMedium'], ['medium', 'seamMedium'],
  ['fingerSpin', 'fingerSpin'], ['wristSpin', 'wristSpin']];

// ---------------------------------------------------------------------------
// §1 THE LADDER. The test man is slot 6 (bowl0); a painted plan hands him a
// continuous ten-over spell from over 0 at one end (0,2,4,...,18) and
// splits the rest. Same seeds for every type, so the columns difference out.
// ---------------------------------------------------------------------------
function ladderCell(btFull, stamina, overs, n, spin) {
  if (spin != null) set(`__foFatSpin=${spin};1`); else set('__foFatSpin=undefined;1');
  const A = H.side('A', { slots: [{ slot: 6, bowlTypeFull: btFull,
    skills: { wicket: 60, economy: 58, stamina: stamina, moveTurn: 58, variation: 55, discipline: 58 } }] });
  const B = H.side('B', {});
  const name = A.players[6].name;
  // his overs: 0,2,...,2*(overs-1); the rest painted over the other four
  // his overs are the first `overs` evens; the other forty split strictly
  // ten apiece over the remaining four bowlers (the engine's own cap)
  const compiled = []; let idx = 0;
  for (let o = 0; o < 50; o++) {
    if (o % 2 === 0 && o / 2 < overs) compiled[o] = name;
    else { compiled[o] = A.players[7 + Math.floor(idx / 10)].name; idx++; }
  }
  const econEarly = [], econLate = [], endFat = [], pkFat = [], wk = [];
  for (let i = 0; i < n; i++) {
    const r = H.run(A, B, 620001 + i * 104729, { ordersA: { compiled, tossDecision: 'bowl' }, traceFat: name });
    if (!r) continue;
    for (const inn of [r.i1, r.i2]) {
      if (!inn || inn.batTeam === 'A') continue;
      const ob = inn.overBowl || [], cr = inn.cumRuns || [];
      let e1 = 0, b1 = 0, e2 = 0, b2 = 0, k = 0;
      for (let o = 0; o < ob.length; o++) {
        if (ob[o] !== name) continue;
        const runs = (cr[o] || 0) - (o ? (cr[o - 1] || 0) : 0);
        k++;
        if (k <= 3) { e1 += runs; b1++; }
        if (k > overs - 3) { e2 += runs; b2++; }
      }
      if (b1) econEarly.push(e1 / b1);
      if (b2) econLate.push(e2 / b2);
      wk.push((inn.bowlers[name] || {}).w || 0);
    }
    if (r.fatEnd && r.fatEnd[name] != null) endFat.push(r.fatEnd[name]);
    if (r.fatPeak && r.fatPeak[name] != null) pkFat.push(r.fatPeak[name]);
  }
  return { bt: btFull, stamina, overs, spin,
    econEarly: summary(econEarly), econLate: summary(econLate),
    endFat: summary(endFat), pkFat: summary(pkFat), wkts: summary(wk) };
}
if (has('ladder') || has('all')) {
  out.ladder = [];
  const spins = (arg('spins', '')).split(',').filter(Boolean).map(Number);
  for (const spin of (spins.length ? spins : [null])) {
    say(`\n=== §1 THE LADDER${spin != null ? ' (spinWork=' + spin + ')' : ' (shipped)'} — 10-over forced spell (N=${N}) ===`);
    say('  type        stam  peakFat  endFat  econ o1-3  econ o8-10  drift   wkts');
    // a spin-factor sweep only re-runs the cells that read the factor
    const TSET = spin != null ? TYPES.filter(t => t[0].includes('Spin')) : TYPES;
    const SSET = spin != null ? [30, 50, 90] : [30, 50, 70, 90];
    for (const st of SSET) {
      for (const [bt, btFull] of TSET) {
        const L = ladderCell(btFull, st, 10, N, spin);
        out.ladder.push(L);
        say('  ' + btFull.padEnd(14) + String(st).padEnd(4)
          + f(L.pkFat.mean, 3) + f(L.endFat.mean, 3)
          + f(L.econEarly.mean, 2) + '   ' + f(L.econLate.mean, 2)
          + f(L.econLate.mean - L.econEarly.mean, 2) + f(L.wkts.mean, 2));
      }
      say('');
    }
  }
  set('__foFatSpin=undefined;1');
}

// ---------------------------------------------------------------------------
// §2 THE SERVER LAW, MIRRORED. Constants read from living.mjs source.
// ---------------------------------------------------------------------------
if (has('between') || has('all')) {
  const src = readFileSync(new URL('../server/living.mjs', import.meta.url), 'utf8');
  const grab = k => +(src.match(new RegExp(k + '\\s*=\\s*([0-9.]+)')) || [])[1];
  const REST = grab('REST_FRACTION'), BASE = grab('LOAD_BASE');
  const CUR = { fast: grab('LOAD_FAST_PER_OVER') || grab('LOAD_PACE_PER_OVER'),
    fastMedium: grab('LOAD_FASTMED_PER_OVER') || grab('LOAD_PACE_PER_OVER'),
    medium: grab('LOAD_MED_PER_OVER') || grab('LOAD_PACE_PER_OVER'),
    spin: grab('LOAD_SPIN_PER_OVER') };
  const CAND = { fast: 2.6, fastMedium: 2.5, medium: 2.4, spin: 1.5 };
  out.between = [];
  say(`\n=== §2 BETWEEN MATCHES (base ${BASE}, nightly rest ${REST}) ===`);
  say('  scheme    type        load/10ov  post-match  steady(daily)  steady(1-in-3 rest)');
  for (const [lbl, S] of [['shipped', CUR], ['candidate', CAND]]) {
    for (const t of ['fast', 'fastMedium', 'medium', 'spin']) {
      const L = BASE + 10 * S[t];
      // nightly: f' = (f + L) * (1 - REST); steady state f* = L(1-R)/R
      const steady = L * (1 - REST) / REST;
      // one rest day in three: two loaded nights then one empty night
      let g = 0; for (let i = 0; i < 60; i++) { g = (g + L) * (1 - REST); g = (g + L) * (1 - REST); g = g * (1 - REST); }
      out.between.push({ scheme: lbl, type: t, load10: L, steady, steady13: g });
      say('  ' + lbl.padEnd(10) + t.padEnd(12) + f(L, 1) + f(L * (1 - REST), 1) + '      ' + f(steady, 1) + '        ' + f(g, 1));
    }
  }
}

// ---------------------------------------------------------------------------
// §3 KEEPING FIRST -> BATTING SECOND. A fields first; the keeper (slot 5,
// mpos 6) then bats. keepDiv candidates via __foFatKeep.
// ---------------------------------------------------------------------------
function keeperCell(kd, stamina, n) {
  if (kd) set(`__foFatKeep=${kd};1`); else set('__foFatKeep=undefined;1');
  const A = H.side('A', { slots: [{ slot: 5, skills: { stamina } }] });
  const B = H.side('B', {});
  const name = A.players[5].name;
  const compiled = [];
  for (let o = 0; o < 50; o++) compiled[o] = A.players[6 + (o % 5)].name;
  const batR = [], batOut = [], team = [], fldFat = [];
  for (let i = 0; i < n; i++) {
    const r = H.run(A, B, 630001 + i * 104729, { ordersA: { compiled, tossDecision: 'bowl' }, traceFat: name });
    if (!r) continue;
    if (r.i1 && r.i1.batTeam === 'A') continue;   // A must FIELD first for the test
    // his tank when the fielding innings ended = the last trace row of inns 0
    if (r.trace) { const t0 = r.trace.filter(t => t.inns === 0); if (t0.length) fldFat.push(t0[t0.length - 1].fat); }
    for (const inn of [r.i1, r.i2]) {
      if (!inn) continue;
      if (inn.batTeam === 'A') {
        team.push(inn.runs);
        const b = (inn.bat || []).find(x => x.nm === name);
        if (b && b.b > 0) { batR.push(b.r); batOut.push(b.out ? 1 : 0); }
      }
    }
  }
  return { kd: kd || 0, stamina, fldFat: summary(fldFat), batRuns: summary(batR),
    outRate: summary(batOut), team: summary(team) };
}
if (has('keeper') || has('all')) {
  out.keeper = [];
  const kds = (arg('kds', '0')).split(',').map(Number);
  say(`\n=== §3 KEEPING FIRST -> BATTING SECOND (N=${N}) ===`);
  say('  keepDiv  stam  tank@break  bat runs   out%    team total');
  for (const kd of kds) {
    for (const st of [30, 50, 70, 90]) {
      const K = keeperCell(kd, st, N);
      out.keeper.push(K);
      say('  ' + String(kd).padEnd(8) + String(st).padEnd(5)
        + f(K.fldFat.mean, 3) + f(K.batRuns.mean, 1) + '±' + K.batRuns.se.toFixed(1).padEnd(4)
        + f(100 * K.outRate.mean, 1) + f(K.team.mean, 1));
    }
    say('');
  }
  set('__foFatKeep=undefined;1');
}

// ---------------------------------------------------------------------------
// §4 THE GLOVES, EARLY v LATE. Keeper skill x gloveFat; byes, stump misses,
// keeper drops banded by over. keepDiv must be live for fat to exist.
// ---------------------------------------------------------------------------
if (has('glove') || has('all')) {
  out.glove = [];
  const kd = Number(arg('kd', '0')), gfs = (arg('gfs', '0')).split(',').map(Number);
  say(`\n=== §4 GLOVES EARLY v LATE (keepDiv=${kd}, N=${N}) ===`);
  say('  gf   keep  byes early/late   stumpMiss e/l   kdrop e/l');
  for (const gf of gfs) {
    set(`__foFatKeep=${kd || 'undefined'};__foGloveFat=${gf};1`);
    for (const kq of [40, 60, 80, 95]) {
      const A = H.side('A', { slots: [{ slot: 5, skills: { keeping: kq, stumping: kq, catching: kq, stamina: 50 } }] });
      const B = H.side('B', {});
      const acc = { be: 0, bl: 0, se: 0, sl: 0, de: 0, dl: 0, inns: 0 };
      for (let i = 0; i < N; i++) {
        const r = H.run(A, B, 640001 + i * 104729, {});
        if (!r) continue;
        for (const inn of [r.i1, r.i2]) {
          if (!inn || inn.batTeam === 'A') continue;
          acc.inns++;
          const fl = inn.fld || {};
          acc.be += fl['bye#early'] || 0; acc.bl += fl['bye#late'] || 0;
          acc.se += fl['stumpMiss#early'] || 0; acc.sl += fl['stumpMiss#late'] || 0;
          acc.de += fl['drop#early'] || 0; acc.dl += fl['drop#late'] || 0;
        }
      }
      const per = k => acc[k] / Math.max(1, acc.inns);
      out.glove.push({ gf, kq, byesEarly: per('be'), byesLate: per('bl'),
        smEarly: per('se'), smLate: per('sl'), dEarly: per('de'), dLate: per('dl') });
      say('  ' + String(gf).padEnd(5) + String(kq).padEnd(5)
        + f(per('be'), 2) + ' /' + f(per('bl'), 2) + '   '
        + f(per('se'), 3) + ' /' + f(per('sl'), 3) + '  '
        + f(per('de'), 2) + ' /' + f(per('dl'), 2));
    }
    say('');
  }
  set('__foFatKeep=undefined;__foGloveFat=undefined;1');
}

// ---------------------------------------------------------------------------
// §5 THE TIRED MIND. The captaincy difficult fixture; same captain fresh v
// tired, captFat candidates via __foCaptFatAmp. Decision log on.
// ---------------------------------------------------------------------------
const HARD = [
  { slot: 6, skills: { wicket: 66, economy: 50, moveTurn: 64 }, fatigue: 'weary' },
  { slot: 7, skills: { wicket: 58, economy: 63 } },
  { slot: 8, talents: ['deathSpecialist'], skills: { wicket: 48, economy: 68, discipline: 68 } },
  { slot: 9, skills: { wicket: 63, economy: 52, variation: 66 } },
  { slot: 10, skills: { wicket: 52, economy: 60 } }
];
function captCell(capt, fatWord, cf, n) {
  set(`__foCaptFatAmp=${cf};__foCaptLog=1;1`);
  const A = H.side('A', { slots: JSON.parse(JSON.stringify(HARD)).concat(
    [{ slot: 0, capt, fatigue: fatWord }]), sixth: true, sixthLevel: 54 });
  const B = H.side('B', { slots: [{ slot: 0, capt: 50 }] });
  const con = [], win = [];
  let missPick = 0, picks = 0, missField = 0, fields = 0;
  for (let i = 0; i < n; i++) {
    const r = H.run(A, B, 650001 + i * 104729, {});
    const log = JSON.parse(set('JSON.stringify((typeof M!=="undefined"&&M&&M._captLog)||[])'));
    if (!r) continue;
    win.push(winOf(r));
    for (const inn of [r.i1, r.i2]) if (inn && inn.batTeam !== 'A') con.push(per50(inn.runs, inn.legal));
    for (const d of log) {
      if (d.k === 'pick' && d.team === 'A') { picks++; if (d.chosen !== d.best) missPick++; }
      if (d.k === 'field' && d.team === 'A') { fields++; if (d.chosen !== d.want) missField++; }
    }
  }
  return { capt, fatWord, cf, conceded: summary(con), win: summary(win),
    missPick: missPick / Math.max(1, picks), missField: missField / Math.max(1, fields) };
}
if (has('captfat') || has('all')) {
  out.captfat = [];
  const cfs = (arg('cfs', '0')).split(',').map(Number);
  const capts = (arg('capts', '50,70,80,90,95')).split(',').map(Number);
  const fws = (arg('fws', 'rested,moderate,weary,exhausted')).split(',');
  say(`\n=== §5 THE TIRED MIND (difficult fixture, N=${N}) ===`);
  say('  cf    capt  fatigue     conceded    win%   missPick%  missField%');
  for (const cf of cfs) {
    for (const capt of capts) {
      for (const fw of fws) {
        const C = captCell(capt, fw, cf, N);
        out.captfat.push(C);
        say('  ' + String(cf).padEnd(5) + String(capt).padEnd(5) + fw.padEnd(11)
          + f(C.conceded.mean, 1) + '±' + C.conceded.se.toFixed(1).padEnd(4)
          + f(100 * C.win.mean, 1) + f(100 * C.missPick, 1) + f(100 * C.missField, 1));
      }
      say('');
    }
  }
  set('__foCaptFatAmp=undefined;__foCaptLog=undefined;1');
}

// ---------------------------------------------------------------------------
// §7 THE ISOLATED COST OF FATIGUE. The early-v-late drift of §1 cannot answer
// "what does fatigue cost this trade?", because a bowler's late overs differ
// from his early ones in ball age, phase, field restrictions and how set the
// batsmen are - and those differ BY TYPE. So: the same forced ten-over
// workload, the same seeds, run twice - once normally, once with ONLY the
// performance consequence of accumulated bowling fatigue neutralised
// (__foBowlFatPerfOff; the tank still fills, the type keeps every
// characteristic). ON minus OFF is the cost of fatigue itself.
// ---------------------------------------------------------------------------
function isoCell(btFull, stamina, n) {
  const A = H.side('A', { slots: [{ slot: 6, bowlTypeFull: btFull,
    skills: { wicket: 60, economy: 58, stamina: stamina, moveTurn: 58, variation: 55, discipline: 58 } }] });
  const B = H.side('B', {});
  const name = A.players[6].name;
  const compiled = []; let idx = 0;
  for (let o = 0; o < 50; o++) {
    if (o % 2 === 0 && o / 2 < 10) compiled[o] = name;
    else { compiled[o] = A.players[7 + Math.floor(idx / 10)].name; idx++; }
  }
  // his own figures, per innings he bowled in
  const grab = flagOn => {
    set(flagOn ? '__foBowlFatPerfOff=1;1' : '__foBowlFatPerfOff=0;1');
    const runs = [], wkts = [], dots = [], fours = [], balls = [];
    for (let i = 0; i < n; i++) {
      const r = H.run(A, B, 670001 + i * 104729, { ordersA: { compiled, tossDecision: 'bowl' } });
      if (!r) continue;
      for (const inn of [r.i1, r.i2]) {
        if (!inn || inn.batTeam === 'A') continue;
        const rec = inn.bowlers[name];
        if (!rec || !rec.b) continue;
        runs.push(rec.r); wkts.push(rec.w || 0); balls.push(rec.b);
        // dot/boundary rate over HIS overs, off the over ledger
        const ob = inn.overBowl || [], cr = inn.cumRuns || [];
        let f4 = 0, hisOv = 0;
        for (let o = 0; o < ob.length; o++) if (ob[o] === name) { hisOv++; }
        fours.push(hisOv ? (rec.r / Math.max(1, hisOv)) : 0);
      }
    }
    return { runs: summary(runs), wkts: summary(wkts), balls: summary(balls) };
  };
  const ON = grab(false), OFF = grab(true);
  const econ = x => x.runs.mean / (x.balls.mean / 6);
  return { bt: btFull, stamina,
    dRuns: ON.runs.mean - OFF.runs.mean,
    dRunsSe: Math.sqrt(ON.runs.se ** 2 + OFF.runs.se ** 2),
    dEcon: econ(ON) - econ(OFF),
    dWkts: ON.wkts.mean - OFF.wkts.mean,
    dWktsSe: Math.sqrt(ON.wkts.se ** 2 + OFF.wkts.se ** 2),
    on: ON, off: OFF };
}
if (has('iso')) {
  out.iso = [];
  const sts = (arg('sts', '30,50,70,90')).split(',').map(Number);
  say(`\n=== §7 ISOLATED FATIGUE COST — fatigue ON minus OFF, same seeds (N=${N}) ===`);
  say('  type            stam   dRuns(10ov)      dEcon    dWkts');
  const pool = {};
  for (const st of sts) {
    for (const [bt, btFull] of [['fast', 'seamFast'], ['fastMedium', 'seamFastMedium'],
      ['medium', 'seamMedium'], ['spin', 'fingerSpin']]) {
      const I = isoCell(btFull, st, N);
      out.iso.push(I);
      (pool[btFull] = pool[btFull] || []).push(I);
      say('  ' + btFull.padEnd(16) + String(st).padEnd(5)
        + f(I.dRuns, 2) + '±' + I.dRunsSe.toFixed(2) + '   '
        + f(I.dEcon, 3) + f(I.dWkts, 3) + '±' + I.dWktsSe.toFixed(3));
    }
    say('');
  }
  say('  POOLED across stamina (the hierarchy test):');
  out.isoPooled = [];
  for (const k in pool) {
    const rows = pool[k];
    const m = rows.reduce((a, r) => a + r.dRuns, 0) / rows.length;
    const se = Math.sqrt(rows.reduce((a, r) => a + r.dRunsSe ** 2, 0)) / rows.length;
    const e = rows.reduce((a, r) => a + r.dEcon, 0) / rows.length;
    const w = rows.reduce((a, r) => a + r.dWkts, 0) / rows.length;
    out.isoPooled.push({ bt: k, dRuns: m, se, dEcon: e, dWkts: w });
    say('    ' + k.padEnd(16) + f(m, 2) + '±' + se.toFixed(2) + ' runs/10ov   econ ' + f(e, 3) + '   wkts ' + f(w, 3));
  }
  set('__foBowlFatPerfOff=0;1');
}

if (has('json')) console.log(JSON.stringify(out, null, 1));
