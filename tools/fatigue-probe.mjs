#!/usr/bin/env node
/* tools/fatigue-probe.mjs — DOES PHYSICAL WORKLOAD BEHAVE LIKE CRICKET?
 *
 * Part I of the player-realism audit (docs/player-realism-audit/). Fatigue
 * enters the shipped engine down FOUR distinct paths and this probe measures
 * each one separately, because "fatigue works" is four claims, not one:
 *
 *   A. PRE-MATCH   the fatigue word on the card -> foFatiguePenalty (skill
 *                  points off today's batting/bowling/fielding) and
 *                  foFatigueLoad (the tank he starts the match with)
 *   B. IN-MATCH    M.fat accrues per legal ball for the STRIKER and the
 *                  BOWLER only; ballDist reads it through batFat/bowlFat
 *                  above the 0.12 ramp
 *   C. SPELL       brec.spellB counts consecutive-over balls; ballDist's
 *                  longSpell term starts at 36 balls, ageBowlLate at 18
 *   D. BETWEEN     server/living.mjs charges each appearance a workload bill
 *                  (6 base + 2.4/over pace, 1.5/over spin + 0.05/ball faced
 *                  + 7 keeping + 4 captaincy) and repays 35% a night
 *
 * Where the term is exact (ballDist is a pure function, the laws are pure
 * functions) it is READ, not sampled. Where only a match can answer (does
 * stamina show up in a real innings? is a sixth bowler worth anything?) it
 * is sampled on paired seeds.
 *
 *   node tools/fatigue-probe.mjs --laws --ball          # exact terms
 *   node tools/fatigue-probe.mjs --match --n=300        # sampled terms
 *   node tools/fatigue-probe.mjs --all --n=300 --json > evidence.json
 *
 * IT CHANGES NOTHING. Every number is read out of the built index.html in a
 * VM; the between-match law is restated from server/living.mjs's own
 * constants and checked against nobody's memory.
 */
import { makeHarness, summary, per50, distStats, arg, has } from './realism-lib.mjs';

const N = parseInt(arg('n', '240'), 10);
const H = makeHarness();
const out = {};
const say = s => { if (!has('json')) console.log(s); };
const f = (x, n = 2) => (x == null || !isFinite(x) ? '   -  ' : (+x).toFixed(n).padStart(7));

// ---------------------------------------------------------------------------
// §1 THE LAWS, EXACTLY. Pre-match penalty/load per fatigue word, and the
// per-ball accrual per stamina/age/trade — the arithmetic every later number
// has to be explained by.
// ---------------------------------------------------------------------------
if (has('laws') || has('all')) {
  say('\n=== §1 THE FATIGUE LAWS, READ OFF THE ENGINE ===');
  say('\n  pre-match: fatigue word -> penalty (skill pts) / starting load (tank 0-1)');
  say('  word            ix   pen(st55)  load(st55)  pen(st85)  load(st85)');
  const words = ['rested', 'revived', 'energetic', 'passable', 'satisfactory',
    'moderate', 'weary', 'listless', 'exhausted', 'shattered', 'clinically dead', 'tired'];
  out.words = [];
  for (const w of words) {
    const a = H.fatLaws({ fatigue: w, skills: { stamina: 55 } });
    const b = H.fatLaws({ fatigue: w, skills: { stamina: 85 } });
    say(`  ${w.padEnd(15)} ${String(a.fatigueIndex).padStart(2)} ${f(a.penalty)}    ${f(a.load, 3)}   ${f(b.penalty)}    ${f(b.load, 3)}`);
    out.words.push({ word: w, ix: a.fatigueIndex, pen55: a.penalty, load55: a.load, pen85: b.penalty, load85: b.load });
  }
  say('\n  in-match accrual per legal ball (bowling / batting), by stamina x age x trade');
  say('  stamina age trade        perBallBowl  balls->0.65  perBallBat');
  out.accrual = [];
  for (const st of [30, 45, 60, 75, 90])
    for (const age of [24, 32])
      for (const bt of ['seamFast', 'fingerSpin']) {
        const a = H.fatLaws({ bowlTypeFull: bt, age, skills: { stamina: st } });
        say(`    ${String(st).padStart(2)}   ${age}  ${bt.padEnd(12)} ${f(a.perBallBowl, 4)}  ${f(0.65 / a.perBallBowl, 0)}      ${f(a.perBallBat, 4)}`);
        out.accrual.push({ st, age, bt, perBallBowl: a.perBallBowl, perBallBat: a.perBallBat });
      }
  say('\n  NOTE the recovery law inside a match: M.fat decays ONLY at drinks');
  say('  (x0.62 once, over 25) and the innings break (x0.5). Overs spent resting');
  say('  at fine leg repay NOTHING - verified in §4 by trace.');
}

// ---------------------------------------------------------------------------
// §2 WHAT THE BALL MODEL PAYS FOR IT, EXACTLY. bowlFat/batFat sweeps at the
// ramp the engine actually uses, spell terms at the lengths spells actually
// reach, and the age-late terms.
// ---------------------------------------------------------------------------
if (has('ball') || has('all')) {
  say('\n=== §2 EXACT BALL-MODEL FATIGUE TERMS (everything else held) ===');
  const base = { over: 30, faced: 30 };
  say('\n  bowler fatigue (tank 0-1): economy and strike rate');
  say('  bowlFat     rpo    wkt%   dot%');
  out.bowlFat = [];
  for (const bf of [0, 0.12, 0.3, 0.5, 0.7, 0.9, 1.0]) {
    const s = distStats(H.dist({}, { bowlTypeFull: 'seamFastMedium' }, { ...base, bowlFat: bf }));
    say(`   ${f(bf, 2)} ${f(s.rpo)} ${f(s.wkt)} ${f(s.dot)}`);
    out.bowlFat.push({ bf, ...s });
  }
  say('\n  batsman fatigue (tank 0-1)');
  say('  batFat      rpo    wkt%   bnd%');
  out.batFat = [];
  for (const bf of [0, 0.12, 0.3, 0.5, 0.7, 0.9, 1.0]) {
    const s = distStats(H.dist({}, { bowlTypeFull: 'seamFastMedium' }, { ...base, batFat: bf }));
    say(`   ${f(bf, 2)} ${f(s.rpo)} ${f(s.wkt)} ${f(s.bnd)}`);
    out.batFat.push({ bf, ...s });
  }
  say('\n  continuous spell (ballsThisSpell), age 27 vs 34');
  say('  spellB   rpo(27) wkt%(27)  rpo(34) wkt%(34)');
  out.spell = [];
  for (const sb of [0, 12, 18, 24, 36, 48, 60]) {
    const a = distStats(H.dist({}, { bowlTypeFull: 'seamFastMedium', age: 27 }, { ...base, ballsThisSpell: sb }));
    const b = distStats(H.dist({}, { bowlTypeFull: 'seamFastMedium', age: 34 }, { ...base, ballsThisSpell: sb }));
    say(`    ${String(sb).padStart(3)} ${f(a.rpo)} ${f(a.wkt)}  ${f(b.rpo)} ${f(b.wkt)}`);
    out.spell.push({ sb, rpo27: a.rpo, wkt27: a.wkt, rpo34: b.rpo, wkt34: b.wkt });
  }
  say('\n  long batting innings (balls faced), age 27 vs 34 - setness held by');
  say('  comparing 70+ where the setness curve is flat');
  say('  faced    rpo(27) wkt%(27)  rpo(34) wkt%(34)');
  out.longInn = [];
  for (const fc of [40, 70, 90, 110, 130]) {
    const a = distStats(H.dist({ age: 27 }, { bowlTypeFull: 'seamFastMedium' }, { ...base, faced: fc }));
    const b = distStats(H.dist({ age: 34 }, { bowlTypeFull: 'seamFastMedium' }, { ...base, faced: fc }));
    say(`    ${String(fc).padStart(3)} ${f(a.rpo)} ${f(a.wkt)}  ${f(b.rpo)} ${f(b.wkt)}`);
    out.longInn.push({ faced: fc, rpo27: a.rpo, wkt27: a.wkt, rpo34: b.rpo, wkt34: b.wkt });
  }
}

// ---------------------------------------------------------------------------
// §3 STAMINA IN A REAL MATCH. One opening bowler's stamina swept with paired
// seeds; then the whole attack's. The claim on the card is that stamina is
// physical resilience — so the readout is his own economy/wickets, the fat
// tank he actually reaches, and his side's runs conceded.
// ---------------------------------------------------------------------------
function bowlerLine(r, side, name) {
  for (const inn of [r.i1, r.i2]) {
    if (!inn || inn.batTeam === side) continue;
    const b = inn.bowlers[name];
    if (b) return { b: b.b, r: b.r, w: b.w };
  }
  return null;
}
function concededBy(r, side) {
  for (const inn of [r.i1, r.i2]) if (inn && inn.batTeam !== side) return { runs: inn.runs, legal: inn.legal, wkts: inn.wkts };
  return null;
}
function scoredBy(r, side) {
  for (const inn of [r.i1, r.i2]) if (inn && inn.batTeam === side) return { runs: inn.runs, legal: inn.legal, wkts: inn.wkts };
  return null;
}

if (has('match') || has('all')) {
  say('\n=== §3 STAMINA IN A REAL MATCH (paired seeds, N=' + N + ' a cell) ===');
  const B0 = H.side('B', {});
  say('\n  ONE opening bowler (A-bowl0, fast-medium) at stamina 30..90');
  say('  stamina   econ    wkts/inn   peakFat   conceded/50ov   win%');
  out.oneBowler = [];
  for (const st of [30, 45, 60, 75, 90]) {
    const A = H.side('A', { slots: [{ slot: 6, skills: { stamina: st } }] });
    const econ = [], wk = [], pk = [], con = [], win = [];
    for (let i = 0; i < N; i++) {
      const r = H.run(A, B0, 900001 + i * 104729, {});
      if (!r) continue;
      const bl = bowlerLine(r, 'A', 'A-bowl0');
      if (bl && bl.b > 0) { econ.push(bl.r * 6 / bl.b); wk.push(bl.w); }
      pk.push(r.fatPeak['A-bowl0'] || 0);
      const c = concededBy(r, 'A'); if (c) con.push(per50(c.runs, c.legal));
      win.push(r.winner === 'A' ? 1 : (r.winner ? 0 : 0.5));
    }
    const e = summary(econ), w = summary(wk), p = summary(pk), c = summary(con), v = summary(win);
    say(`    ${String(st).padStart(2)}   ${f(e.mean)}±${e.se.toFixed(2)} ${f(w.mean)}   ${f(p.mean, 3)}  ${f(c.mean)}±${c.se.toFixed(1)}  ${f(v.mean * 100, 1)}`);
    out.oneBowler.push({ st, econ: e, wkts: w, peak: p, conceded: c, win: v });
  }
  say('\n  the WHOLE attack at stamina 30..90 (batting held)');
  say('  stamina  conceded/50ov    oppWkts   win%');
  out.attack = [];
  for (const st of [30, 60, 90]) {
    const A = H.side('A', { slots: [6, 7, 8, 9, 10].map(s => ({ slot: s, skills: { stamina: st } })) });
    const con = [], ow = [], win = [];
    for (let i = 0; i < N; i++) {
      const r = H.run(A, B0, 900001 + i * 104729, {});
      if (!r) continue;
      const c = concededBy(r, 'A'); if (c) { con.push(per50(c.runs, c.legal)); ow.push(c.wkts); }
      win.push(r.winner === 'A' ? 1 : (r.winner ? 0 : 0.5));
    }
    const c = summary(con), w = summary(ow), v = summary(win);
    say(`    ${String(st).padStart(2)}   ${f(c.mean)}±${c.se.toFixed(1)}   ${f(w.mean)}  ${f(v.mean * 100, 1)}`);
    out.attack.push({ st, conceded: c, oppWkts: w, win: v });
  }
}

// ---------------------------------------------------------------------------
// §4 SPELLS, REST AND RECOVERY. What spell lengths does the AI actually bowl,
// where does the tank stand over a day, and what does an over off repay?
// (The engine's answer to the last is structural: nothing, except drinks and
// the innings break. The trace states it in numbers.)
// ---------------------------------------------------------------------------
if (has('spells') || has('all')) {
  say('\n=== §4 SPELLS AND IN-MATCH RECOVERY ===');
  const A = H.side('A', {}), B = H.side('B', {});
  const spellLens = {}, gaps = [];
  let drinksDrop = null, breakDrop = null;
  const M0 = Math.min(N, 120);
  const traces = [];
  for (let i = 0; i < M0; i++) {
    const r = H.run(A, B, 700001 + i * 104729, { traceFat: 'A-bowl0' });
    if (!r) continue;
    for (const inn of [r.i1, r.i2]) {
      if (!inn || inn.batTeam === 'A') continue;
      // A SPELL IS BOWLED FROM ONE END: the same man can never bowl overs n
      // and n+1, so a spell is a run of appearances exactly two overs apart —
      // the same definition brec.spellB uses (lastSpellOver === over-2).
      const runs = {};
      for (let o = 0; o < inn.overBowl.length; o++) {
        const nm = inn.overBowl[o]; if (!nm) continue;
        const r2 = runs[nm];
        if (r2 && r2.last === o - 2) { r2.len++; r2.last = o; }
        else { if (r2) spellLens[r2.len] = (spellLens[r2.len] || 0) + 1;
               runs[nm] = { len: 1, last: o }; }
      }
      for (const nm in runs) spellLens[runs[nm].len] = (spellLens[runs[nm].len] || 0) + 1;
      // and the engine's own counter: the longest spellB each bowler reached
      for (const nm in inn.bowlers) {
        const ms = inn.bowlers[nm].maxSpell || 0;
        gaps.push(ms);
      }
    }
    if (r.trace && r.trace.length) traces.push(r.trace);
  }
  say('\n  spell lengths the AI actually bowls (same end = 2 overs apart):');
  const tot = Object.values(spellLens).reduce((a, b) => a + b, 0) || 1;
  for (const k of Object.keys(spellLens).sort((a, b) => a - b))
    say(`    ${k} over(s): ${(100 * spellLens[k] / tot).toFixed(1)}%`);
  out.spellLens = spellLens;
  const g = summary(gaps);
  const over36 = gaps.filter(x => x >= 36).length / Math.max(1, gaps.length);
  say(`\n  engine spellB, longest per bowler-innings: mean ${g.mean.toFixed(1)} balls, ` +
      `share reaching the 36-ball longSpell ramp: ${(100 * over36).toFixed(2)}%`);
  out.spellB = { mean: g.mean, se: g.se, shareOver36: over36, n: gaps.length };
  say('  NOTE ballDist\'s longSpell term starts at 36 consecutive balls (6 overs).');

  // one bowler's tank across a fielding innings, averaged over traces
  const avg = {};
  for (const tr of traces) for (const t of tr) {
    if (t.inns !== undefined) {
      const key = t.inns + ':' + t.over;
      (avg[key] = avg[key] || []).push(t.fat);
    }
  }
  say('\n  A-bowl0 mean tank by over (innings where A fields first):');
  const rows = Object.keys(avg).map(k => {
    const [inns, over] = k.split(':').map(Number);
    const s = summary(avg[k]);
    return { inns, over, fat: s.mean, n: s.n };
  }).filter(r => r.n >= M0 / 4).sort((a, b) => a.inns - b.inns || a.over - b.over);
  for (const r of rows.filter(r => r.over % 5 === 0)) say(`    inns ${r.inns} over ${String(r.over).padStart(2)}: ${r.fat.toFixed(3)}`);
  out.fatByOver = rows;
}

// ---------------------------------------------------------------------------
// §5 PRE-MATCH FATIGUE ON THE DAY. The whole side arrives at each word on the
// ladder; paired seeds against a rested opponent.
// ---------------------------------------------------------------------------
if (has('prematch') || has('all')) {
  say('\n=== §5 A SIDE THAT ARRIVED TIRED (N=' + N + ') ===');
  const B0 = H.side('B', {});
  say('  word           scored/50ov  conceded/50ov   win%');
  out.prematch = [];
  for (const w of ['rested', 'satisfactory', 'moderate', 'weary', 'exhausted']) {
    const A = H.side('A', { all: { fatigue: w } });
    const sc = [], con = [], win = [];
    for (let i = 0; i < N; i++) {
      const r = H.run(A, B0, 900001 + i * 104729, {});
      if (!r) continue;
      const s = scoredBy(r, 'A'), c = concededBy(r, 'A');
      if (s) sc.push(per50(s.runs, s.legal));
      if (c) con.push(per50(c.runs, c.legal));
      win.push(r.winner === 'A' ? 1 : (r.winner ? 0 : 0.5));
    }
    const S = summary(sc), C = summary(con), V = summary(win);
    say(`  ${w.padEnd(13)} ${f(S.mean)}±${S.se.toFixed(1)}   ${f(C.mean)}±${C.se.toFixed(1)}  ${f(V.mean * 100, 1)}`);
    out.prematch.push({ word: w, scored: S, conceded: C, win: V });
  }
}

// ---------------------------------------------------------------------------
// §6 THE SIXTH BOWLER. Same batting, same frontline attack; the No.5 bat
// either bowls part-time seam or does not. Does the option get used, does it
// spare the frontline's legs, does it cost or save runs?
// ---------------------------------------------------------------------------
if (has('sixth') || has('all')) {
  say('\n=== §6 FIVE-MAN v SIX-MAN ATTACK (N=' + N + ') ===');
  const B0 = H.side('B', {});
  out.sixth = [];
  for (const [lbl, o] of [['five bowlers', {}], ['plus 6th (46)', { sixth: true }], ['plus 6th (55)', { sixth: true, sixthLevel: 55 }]]) {
    const A = H.side('A', o);
    const con = [], win = [], sixthOv = [], peakFront = [];
    for (let i = 0; i < N; i++) {
      const r = H.run(A, B0, 900001 + i * 104729, {});
      if (!r) continue;
      const c = concededBy(r, 'A'); if (c) con.push(per50(c.runs, c.legal));
      win.push(r.winner === 'A' ? 1 : (r.winner ? 0 : 0.5));
      for (const inn of [r.i1, r.i2]) {
        if (!inn || inn.batTeam === 'A') continue;
        const b6 = inn.bowlers['A-bat4'];
        sixthOv.push(b6 ? b6.b / 6 : 0);
        const pk = Math.max(...['A-bowl0', 'A-bowl1', 'A-bowl2', 'A-bowl3', 'A-bowl4'].map(n => r.fatPeak[n] || 0));
        peakFront.push(pk);
      }
    }
    const C = summary(con), V = summary(win), O = summary(sixthOv), P = summary(peakFront);
    say(`  ${lbl.padEnd(14)} conceded ${f(C.mean)}±${C.se.toFixed(1)}  win ${f(V.mean * 100, 1)}%  6th overs ${f(O.mean)}  frontline peakFat ${f(P.mean, 3)}`);
    out.sixth.push({ lbl, conceded: C, win: V, sixthOvers: O, frontPeak: P });
  }
}

// ---------------------------------------------------------------------------
// §7 THE KEEPER'S DAY, AND WHOSE LEGS PAY FOR IT. In-match: the tank accrues
// for the STRIKER and the BOWLER only — a keeper standing 50 overs accrues
// exactly nothing for keeping (his 1.04 multiplier applies to his BATTING).
// Read a match and print the tank of keeper v equivalent bat.
// ---------------------------------------------------------------------------
if (has('keeper') || has('all')) {
  say('\n=== §7 KEEPER WORKLOAD IN-MATCH ===');
  const A = H.side('A', {}), B = H.side('B', {});
  const kFat = [], batFat = [];
  for (let i = 0; i < Math.min(N, 150); i++) {
    const r = H.run(A, B, 500001 + i * 104729, {});
    if (!r) continue;
    kFat.push(r.fatEnd['A-wk'] || 0); batFat.push(r.fatEnd['A-bat3'] || 0);
  }
  const K = summary(kFat), Bt = summary(batFat);
  say(`  end-of-match tank, keeper (A-wk):      ${f(K.mean, 3)} ± ${K.se.toFixed(3)}`);
  say(`  end-of-match tank, No.4 bat (A-bat3):  ${f(Bt.mean, 3)} ± ${Bt.se.toFixed(3)}`);
  say('  (both accrue only while BATTING; fifty overs of keeping adds 0.000 in-match.');
  say('   between matches the server bills keeping LOAD_KEEPING=7 a day - §8.)');
  out.keeper = { keeperEnd: K, batEnd: Bt };
}

// ---------------------------------------------------------------------------
// §8 BETWEEN MATCHES — the server's own law, restated from its constants and
// played over a congested month. No engine involved: the law is
//     load = 6 + overs*2.4(pace)|1.5(spin) + balls*0.05 [+7 keep][+4 capt]
//     each night: fat *= 0.65; cap 80
// then the ladder word -> foFatigueIndex -> the pre-match penalty of §1.
// ---------------------------------------------------------------------------
if (has('congestion') || has('all')) {
  say('\n=== §8 FIXTURE CONGESTION (server law, exact) ===');
  const word = n => n >= 96 ? 'clinically dead' : n >= 88 ? 'shattered' : n >= 78 ? 'exhausted'
    : n >= 68 ? 'listless' : n >= 56 ? 'weary' : n >= 44 ? 'moderate'
    : n >= 34 ? 'satisfactory' : n >= 24 ? 'passable' : n >= 14 ? 'energetic'
    : n >= 5 ? 'revived' : 'rested';
  const play = (loads, gapDays) => {
    let fat = 0; const seq = [];
    for (let i = 0; i < loads.length; i++) {
      if (i) fat *= Math.pow(0.65, gapDays);
      fat = Math.min(80, fat + loads[i]);
      seq.push(Math.round(fat));
    }
    return seq;
  };
  const cases = [
    ['seamer, 10 ov every day', 6 + 10 * 2.4, 1],
    ['seamer, 10 ov, 1 day off between', 6 + 10 * 2.4, 2],
    ['seamer, 10 ov, 2 days off between', 6 + 10 * 2.4, 3],
    ['spinner, 10 ov every day', 6 + 10 * 1.5, 1],
    ['keeper, 30 balls faced, daily', 6 + 30 * 0.05 + 7, 1],
    ['specialist bat, 60 balls, daily', 6 + 60 * 0.05, 1],
    ['captain-seamer, 10 ov daily', 6 + 10 * 2.4 + 4, 1]
  ];
  out.congestion = [];
  say('  scenario                          match: 1    3    6    9   steady word -> penalty(st55)');
  for (const [lbl, load, gap] of cases) {
    const seq = play(Array(9).fill(load), gap);
    const w = word(seq[8]);
    const pen = H.fatLaws({ fatigue: w, skills: { stamina: 55 } }).penalty;
    say(`  ${lbl.padEnd(34)} ${[0, 2, 5, 8].map(i => String(seq[i]).padStart(4)).join(' ')}   ${w} -> ${pen.toFixed(1)} pts`);
    out.congestion.push({ lbl, seq, steadyWord: w, penalty: pen });
  }
  say('\n  NOTE: recovery is 35%/night for EVERYBODY - stamina and age never enter');
  say('  the between-match law; they act only inside the match and on the day\'s');
  say('  penalty. Rotation therefore matters, but no man recovers faster than another.');
}

if (has('json')) console.log(JSON.stringify(out, null, 1));
