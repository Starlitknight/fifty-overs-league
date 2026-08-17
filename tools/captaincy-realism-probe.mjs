#!/usr/bin/env node
/* tools/captaincy-realism-probe.mjs — WHAT IS A CAPTAIN WORTH, AND WHY?
 *
 * The Captaincy Realism phase's instrument. Run BEFORE the redesign it
 * measures the Phase 2A engine's captaincy curve (the baseline the brief
 * demands, §2); run AFTER, the same sections measure the new one, and the
 * flag-gated sections decompose where the value comes from.
 *
 *   §1 the curve: captaincy 20..95 at nine points, paired seeds
 *   §2 the key gaps, PAIRED-DIFF powered: 70v80, 80v95, 88v95
 *   §3 the context matrix: attack shapes x captaincy
 *   §4 easy v difficult tactical environments
 *   §5 wicket attribution: where do a good captain's wickets come from?
 *   §6 channel decomposition (new engine only: per-channel off switches)
 *   §7 archetype behaviour from decision logs (new engine only)
 *
 *   node tools/captaincy-realism-probe.mjs --curve --n=600
 *   node tools/captaincy-realism-probe.mjs --gaps --n=2500
 *   node tools/captaincy-realism-probe.mjs --all --json > evidence.json
 *
 * A reader, as ever: nothing here changes the engine.
 */
import vm from 'node:vm';
import { makeHarness, summary, per50, arg, has } from './realism-lib.mjs';

const N = parseInt(arg('n', '400'), 10);
const H = makeHarness();
const out = {};
const say = s => { if (!has('json')) console.log(s); };
const f = (x, n = 2) => (x == null || !isFinite(x) ? '   -  ' : (+x).toFixed(n).padStart(7));
const winOf = r => r.winner === 'A' ? 1 : (r.winner ? 0 : 0.5);
const set = expr => vm.runInContext(expr, H.ctx);

// --het: a REALISTIC varied attack instead of five clones. Real squads carry
// a strike quick, a container, a death man, a frontline spinner and a filler
// — the score gaps between them are what give a captain something to misread,
// and the audit measured captaincy at ~0 on artificially uniform attacks.
const HET_SLOTS = [
  { slot: 6, skills: { wicket: 64, economy: 52, moveTurn: 66 } },
  { slot: 7, skills: { wicket: 58, economy: 62 } },
  { slot: 8, talents: ['deathSpecialist'], skills: { wicket: 50, economy: 66, discipline: 66 } },
  { slot: 9, skills: { wicket: 61, economy: 55, variation: 63 } },
  { slot: 10, skills: { wicket: 55, economy: 58 } }
];
const HET = has('het');

// one cell: side A with the armband at `capt`, everything else per opts
function cell(capt, n, sideOpts, runOpts, seed0) {
  const o = JSON.parse(JSON.stringify(sideOpts || {}));
  if (HET && !o.noHet) o.slots = (o.slots || []).concat(JSON.parse(JSON.stringify(HET_SLOTS)));
  o.slots = (o.slots || []).concat([{ slot: 0, capt }]);
  const A = H.side('A', o);
  const B = H.side('B', { slots: [{ slot: 0, capt: 50 }],
    bowlTypes: (sideOpts && sideOpts.oppTypes) || undefined });
  const con = [], win = [], wk = [];
  const perSeed = [];
  for (let i = 0; i < n; i++) {
    const r = H.run(A, B, (seed0 || 900001) + i * 104729, runOpts || {});
    if (!r) { perSeed.push(null); continue; }
    let c = null, w = null;
    for (const inn of [r.i1, r.i2]) {
      if (!inn || inn.batTeam === 'A') continue;
      c = per50(inn.runs, inn.legal); w = inn.wkts;
    }
    if (c != null) { con.push(c); wk.push(w); }
    win.push(winOf(r));
    perSeed.push({ c, w, v: winOf(r) });
  }
  return { conceded: summary(con), oppWkts: summary(wk), win: summary(win), perSeed };
}

// ---------------------------------------------------------------------------
// §1 THE CURVE, nine points.
// ---------------------------------------------------------------------------
if (has('curve') || has('all')) {
  say('\n=== §1 CAPTAINCY CURVE (N=' + N + '/cell, balanced side) ===');
  say('  capt   conceded/50      oppWkts    win%');
  out.curve = [];
  for (const c of [20, 40, 55, 70, 80, 85, 88, 92, 95]) {
    const r = cell(c, N, {}, {});
    say(`   ${String(c).padStart(2)}   ${f(r.conceded.mean, 1)}±${r.conceded.se.toFixed(1)}   ${f(r.oppWkts.mean, 2)}   ${f(r.win.mean * 100, 1)}±${(r.win.se * 100).toFixed(1)}`);
    out.curve.push({ capt: c, conceded: r.conceded, oppWkts: r.oppWkts, win: r.win });
  }
}

// ---------------------------------------------------------------------------
// §2 THE KEY GAPS, PAIRED. Same seeds both sides of each gap; the statistic
// is the per-seed DIFFERENCE, whose SE credits the pairing.
// ---------------------------------------------------------------------------
if (has('gaps') || has('all')) {
  const M0 = Math.min(N * 4, 2500);
  say('\n=== §2 KEY GAPS, PAIRED-DIFF (N=' + M0 + ' seeds/gap) ===');
  out.gaps = [];
  for (const [a, b] of [[70, 80], [80, 95], [88, 95], [20, 95]]) {
    const ra = cell(a, M0, {}, {}), rb = cell(b, M0, {}, {});
    const dc = [], dw = [], dv = [];
    for (let i = 0; i < M0; i++) {
      const x = ra.perSeed[i], y = rb.perSeed[i];
      if (!x || !y) continue;
      if (x.c != null && y.c != null) { dc.push(x.c - y.c); dw.push((y.w || 0) - (x.w || 0)); }
      dv.push(y.v - x.v);
    }
    const DC = summary(dc), DW = summary(dw), DV = summary(dv);
    say(`  ${a} -> ${b}: conceded ${f(DC.mean, 2)}±${DC.se.toFixed(2)} runs (z=${(DC.mean / Math.max(1e-9, DC.se)).toFixed(1)})  wkts +${f(DW.mean, 3)}±${DW.se.toFixed(3)}  win +${f(DV.mean * 100, 2)}±${(DV.se * 100).toFixed(2)} pts`);
    out.gaps.push({ a, b, dConceded: DC, dWkts: DW, dWin: DV });
  }
}

// ---------------------------------------------------------------------------
// §3 CONTEXT MATRIX. Attack shapes x captaincy 20/55/95.
// ---------------------------------------------------------------------------
if (has('contexts') || has('all')) {
  const M0 = Math.min(N, 350);
  say('\n=== §3 CONTEXTS x CAPTAINCY (N=' + M0 + ') ===');
  const CTX = [
    ['balanced five', {}, {}],
    ['pace-heavy', { bowlTypes: ['seamFast', 'seamFastMedium', 'seamMedium', 'seamFastMedium', 'fingerSpin'] }, {}],
    ['spin-heavy', { bowlTypes: ['seamFastMedium', 'seamFast', 'fingerSpin', 'wristSpin', 'fingerSpin'] }, {}],
    ['six bowlers', { sixth: true, sixthLevel: 52 }, {}],
    ['one weary quick', { slots: [{ slot: 6, fatigue: 'weary' }] }, {}],
    ['green (obvious)', {}, { pitch: 'green', weather: 'Overcast' }],
    ['dry turner', {}, { pitch: 'dry' }],
    ['flat road', {}, { pitch: 'flat' }]
  ];
  out.contexts = [];
  for (const [lbl, so, ro] of CTX) {
    const row = {};
    for (const c of [20, 55, 95]) row[c] = cell(c, M0, so, ro);
    const span = row[20].conceded.mean - row[95].conceded.mean;
    const wspan = (row[95].win.mean - row[20].win.mean) * 100;
    say(`  ${lbl.padEnd(16)} conceded 20/55/95: ${f(row[20].conceded.mean, 1)} ${f(row[55].conceded.mean, 1)} ${f(row[95].conceded.mean, 1)}  span ${f(span, 1)} runs, ${f(wspan, 1)} win pts`);
    out.contexts.push({ lbl, c20: { conceded: row[20].conceded, win: row[20].win },
      c55: { conceded: row[55].conceded, win: row[55].win },
      c95: { conceded: row[95].conceded, win: row[95].win }, span, wspan });
  }
}

// ---------------------------------------------------------------------------
// §4 EASY v DIFFICULT DECISION ENVIRONMENTS. Easy: one dominant bowler on an
// obvious surface. Hard: five comparable men, one tired, a death specialist,
// a sixth option — every over a real choice.
// ---------------------------------------------------------------------------
if (has('difficulty') || has('all')) {
  // These three environments are their own controlled compositions — the
  // --het overlay must NOT leak into them (noHet below), or "five clones"
  // stops being clones and the slot lists collide. The first run of the het
  // battery did exactly that, which is why its §4 numbers disagree with the
  // uniform battery's; only noHet runs of this section are evidence.
  const M0 = Math.min(N, 1600);
  say('\n=== §4 DECISION ENVIRONMENTS (N=' + M0 + ') ===');
  // Three environments, because "difficult" is not "close": when every
  // candidate is interchangeable a wrong pick is FREE, and when one man is
  // overwhelmingly right even a poor captain rarely misses him. The
  // environment where captaincy should pay most is CONSEQUENTIAL-BUT-NOT-
  // OBVIOUS: moderate real gaps whose right answer shifts with the moment -
  // a weary strike man, a death specialist to hold back, a sixth option.
  const EASY = [{ slot: 6, skills: { wicket: 74, economy: 70, moveTurn: 76 } }];
  const HARD = [
    { slot: 6, skills: { wicket: 66, economy: 50, moveTurn: 64 }, fatigue: 'weary' },
    { slot: 7, skills: { wicket: 58, economy: 63 } },
    { slot: 8, talents: ['deathSpecialist'], skills: { wicket: 48, economy: 68, discipline: 68 } },
    { slot: 9, skills: { wicket: 63, economy: 52, variation: 66 } },
    { slot: 10, skills: { wicket: 52, economy: 60 } }
  ];
  out.difficulty = [];
  for (const [lbl, so, ro] of [
    ['simple: five clones', { noHet: 1 }, {}],
    ['obvious: dominant seamer, green', { noHet: 1, slots: EASY }, { pitch: 'green', weather: 'Overcast' }],
    ['difficult: real spreads + moments', { noHet: 1, slots: HARD, sixth: true, sixthLevel: 54 }, {}]]) {
    const lo = cell(20, M0, so, ro), hi = cell(95, M0, so, ro);
    const dc = [], dv = [];
    for (let i = 0; i < M0; i++) {
      const x = lo.perSeed[i], y = hi.perSeed[i];
      if (!x || !y) continue;
      if (x.c != null && y.c != null) dc.push(x.c - y.c);
      dv.push(y.v - x.v);
    }
    const DC = summary(dc), DV = summary(dv);
    say(`  ${lbl.padEnd(32)} capt 20->95 worth ${f(DC.mean, 2)}±${DC.se.toFixed(2)} runs, ${f(DV.mean * 100, 1)}±${(DV.se * 100).toFixed(1)} win pts`);
    out.difficulty.push({ lbl, dConceded: DC, dWin: DV });
  }
}

// ---------------------------------------------------------------------------
// §5 WICKET ATTRIBUTION. Where do a better captain's wickets fall? Read off
// the ledgers: overall, middle overs, first over of a new spell, new batter
// (within 12 balls of a wicket), tail (7 down+), stand-breaking (50+).
// ---------------------------------------------------------------------------
function wicketShapes(A, B, n, seed0) {
  const acc = { total: 0, mid: 0, changeOver: 0, tail: 0, stand50: 0, inns: 0 };
  for (let i = 0; i < n; i++) {
    const r = H.run(A, B, (seed0 || 900001) + i * 104729, {});
    if (!r) continue;
    for (const inn of [r.i1, r.i2]) {
      if (!inn || inn.batTeam === 'A') continue;
      acc.inns++;
      acc.total += inn.wkts;
      for (const fw of inn.fow || []) {
        const ov = Math.floor(fw.ov);
        if (ov >= 10 && ov < 40) acc.mid++;
        if (fw.w >= 8) acc.tail++;
        // first over of a spell: the bowler of this over did not bowl ov-2
        const nm = inn.overBowl[ov];
        if (nm && inn.overBowl[ov - 2] !== nm) acc.changeOver++;
      }
      for (const ps of inn.pships || []) if (ps.runs >= 50) acc.stand50++;
    }
  }
  return acc;
}
if (has('wickets') || has('all')) {
  const M0 = Math.min(N * 2, 900);
  say('\n=== §5 WICKET SHAPES BY CAPTAINCY (N=' + M0 + ') ===');
  const B0 = H.side('B', { slots: [{ slot: 0, capt: 50 }] });
  out.wickets = [];
  for (const c of [20, 95]) {
    const A = H.side('A', { slots: [{ slot: 0, capt: c }] });
    const w = wicketShapes(A, B0, M0);
    const per = k => (w[k] / Math.max(1, w.inns)).toFixed(3);
    say(`  capt ${c}: wkts/inn ${per('total')}  mid ${per('mid')}  1st-over-of-spell ${per('changeOver')}  tail(8+) ${per('tail')}  50-stands-conceded ${per('stand50')}`);
    out.wickets.push({ capt: c, ...w });
  }
}

// ---------------------------------------------------------------------------
// §6 CHANNEL DECOMPOSITION (new engine only). Each captaincy channel has an
// off-switch; the 20->95 paired gap is re-measured with one channel frozen
// at a time. Skipped silently when the flags do not exist in the build.
// ---------------------------------------------------------------------------
if (has('channels') || has('all')) {
  const flags = set('typeof FO_CAPT!=="undefined"');
  if (!flags) say('\n=== §6 CHANNELS: FO_CAPT not in this build (baseline engine) — skipped ===');
  else {
    const M0 = Math.min(N * 3, 1500);
    say('\n=== §6 CHANNEL DECOMPOSITION, capt 20->95 paired (N=' + M0 + ') ===');
    out.channels = [];
    const CH = [
      ['all channels on', ''],
      ['judgement noise off (everyone reads true)', '__foCaptSharp=1'],
      ['situation terms off (tail/new-bat/stand/death)', '__foCaptTermsOff=1'],
      ['field judgement off (everyone right field)', '__foCaptFieldSharp=1'],
      ['field policy off (old aiField)', '__foCaptFieldOff=1'],
      ['organisation term off', '__foCaptOrgOff=1'],
      ['continuation anchor off (no confirmation bias)', '__foCaptAnchorOff=1']
    ];
    for (const [lbl, expr] of CH) {
      set('__foCaptSharp=0;__foCaptTermsOff=0;__foCaptFieldSharp=0;__foCaptFieldOff=0;__foCaptOrgOff=0;__foCaptAnchorOff=0;1');
      if (expr) set(expr + ';1');
      const lo = cell(20, M0, {}, {}), hi = cell(95, M0, {}, {});
      const dc = [], dv = [];
      for (let i = 0; i < M0; i++) {
        const x = lo.perSeed[i], y = hi.perSeed[i];
        if (!x || !y) continue;
        if (x.c != null && y.c != null) dc.push(x.c - y.c);
        dv.push(y.v - x.v);
      }
      const DC = summary(dc), DV = summary(dv);
      say(`  ${lbl.padEnd(46)} gap ${f(DC.mean, 2)}±${DC.se.toFixed(2)} runs, ${f(DV.mean * 100, 1)} win pts`);
      out.channels.push({ lbl, dConceded: DC, dWin: DV });
    }
    set('__foCaptSharp=0;__foCaptTermsOff=0;__foCaptFieldSharp=0;__foCaptFieldOff=0;__foCaptOrgOff=0;__foCaptAnchorOff=0;1');
  }
}

// ---------------------------------------------------------------------------
// §7 ARCHETYPES FROM THE DECISION LOG (new engine only). __foCaptLog makes
// the captain record every over: what he chose, what the clean score said,
// and the field he set against the field the context wanted.
// ---------------------------------------------------------------------------
if (has('archetypes') || has('all')) {
  const okFlag = set('typeof FO_CAPT!=="undefined"');
  if (!okFlag) say('\n=== §7 ARCHETYPES: baseline engine — skipped ===');
  else {
    const M0 = 120;
    say('\n=== §7 ARCHETYPE BEHAVIOUR (decision logs, N=' + M0 + ') ===');
    set('__foCaptLog=1;1');
    const B0 = H.side('B', { slots: [{ slot: 0, capt: 50 }] });
    out.archetypes = [];
    for (const c of [20, 40, 55, 70, 80, 90, 95]) {
      const A = H.side('A', { slots: [{ slot: 0, capt: c }] });
      let picks = 0, missPick = 0, moments = 0, missMoment = 0, fields = 0, missField = 0;
      for (let i = 0; i < M0; i++) {
        H.run(A, B0, 700001 + i * 104729, {});
        const log = JSON.parse(set('JSON.stringify((typeof M!=="undefined"&&M&&M._captLog)||[])') || '[]');
        for (const e of log) {
          if (e.team !== 'A') continue;
          if (e.k === 'pick') { picks++; if (e.chosen !== e.best) missPick++;
            if (e.moment) { moments++; if (e.chosen !== e.best) missMoment++; } }
          if (e.k === 'field') { fields++; if (e.chosen !== e.want) missField++; }
        }
      }
      say(`  capt ${String(c).padStart(2)}: picked off-true ${f(100 * missPick / Math.max(1, picks), 1)}% of overs` +
        `  missed tactical moments ${f(100 * missMoment / Math.max(1, moments), 1)}%` +
        `  wrong field ${f(100 * missField / Math.max(1, fields), 1)}%`);
      out.archetypes.push({ capt: c, picks, missPick, moments, missMoment, fields, missField });
    }
    set('__foCaptLog=0;1');
  }
}

if (has('json')) console.log(JSON.stringify(out, null, 1));
