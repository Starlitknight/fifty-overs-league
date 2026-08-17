#!/usr/bin/env node
/* tools/coach-followup-probe.mjs — PHASE 2A.1: WHAT THE COACH MUST RELEARN.
 *
 * Phase 2A gave the engine spells and off-spell recovery. Four of the
 * Match-Day Coach's calibrated assumptions were priced against the OLD
 * cricket and have to be re-measured before the coach is touched:
 *
 *   §1 the sixth bowler as WORKLOAD INSURANCE — value by frontline fatigue
 *      state x option quality (the flat SIXTH_BOWLER=4.8 cannot survive)
 *   §2 the seventh option, same question
 *   §3 how much opening burst Auto should paint, now that the captain can
 *      hold a spell himself
 *   §4 whether an opener may return at the death — candidate pairs priced
 *      by PROJECTED condition (foFatProject) and then PLAYED
 *   §5 captaincy's run-equivalent slope over the selection range, across
 *      attack shapes — the number CAPT_RUNS must become
 *
 * Everything runs on the NEW engine (Phase 2A defaults). Paired seeds.
 *
 *   node tools/coach-followup-probe.mjs --insurance --n=250
 *   node tools/coach-followup-probe.mjs --seventh --burst --death --capt
 *   node tools/coach-followup-probe.mjs --all --n=250 --json > evidence.json
 *
 * A reader, like every probe in this family: nothing in the engine or the
 * coach is altered by running it.
 */
import vm from 'node:vm';
import { makeHarness, summary, per50, arg, has } from './realism-lib.mjs';

const N = parseInt(arg('n', '220'), 10);
const H = makeHarness();
const out = {};
const say = s => { if (!has('json')) console.log(s); };
const f = (x, n = 2) => (x == null || !isFinite(x) ? '   -  ' : (+x).toFixed(n).padStart(7));
const winOf = r => r.winner === 'A' ? 1 : (r.winner ? 0 : 0.5);

function teamStats(A, B, n, opts, seed0) {
  const con = [], win = [], sixOv = [], peak = [];
  for (let i = 0; i < n; i++) {
    const r = H.run(A, B, (seed0 || 900001) + i * 104729, opts || {});
    if (!r) continue;
    for (const inn of [r.i1, r.i2]) {
      if (!inn || inn.batTeam === 'A') continue;
      con.push(per50(inn.runs, inn.legal));
      const b6 = inn.bowlers['A-bat4'];
      sixOv.push(b6 ? b6.b / 6 : 0);
      peak.push(Math.max(...['A-bowl0', 'A-bowl1', 'A-bowl2', 'A-bowl3', 'A-bowl4']
        .map(nm => r.fatPeak[nm] || 0)));
    }
    win.push(winOf(r));
  }
  return { conceded: summary(con), win: summary(win), sixthOvers: summary(sixOv), frontPeak: summary(peak) };
}

// ---------------------------------------------------------------------------
// §1 THE WORKLOAD-INSURANCE CURVE. Frontline states A–F x sixth quality.
// The sixth option is the No.5 bat bowling part-time seam at the named level.
// ---------------------------------------------------------------------------
const STATES = [
  ['A all rested', []],
  ['B one mild (satisfactory)', [{ slot: 6, fatigue: 'satisfactory' }]],
  ['C one weary', [{ slot: 6, fatigue: 'weary' }]],
  ['D two mild', [{ slot: 6, fatigue: 'satisfactory' }, { slot: 7, fatigue: 'satisfactory' }]],
  ['E two weary', [{ slot: 6, fatigue: 'weary' }, { slot: 7, fatigue: 'weary' }]],
  ['F three weary', [{ slot: 6, fatigue: 'weary' }, { slot: 7, fatigue: 'weary' }, { slot: 8, fatigue: 'weary' }]]
];
const SIXTHS = [['none', null], ['weak 40', 40], ['avg 52', 52], ['strong 64', 64]];

if (has('insurance') || has('all')) {
  say('\n=== §1 SIXTH-BOWLER INSURANCE BY FRONTLINE STATE (N=' + N + ') ===');
  const B0 = H.side('B', {});
  out.insurance = [];
  for (const [state, slots] of STATES) {
    say(`  ${state}:`);
    const rows = {};
    for (const [q, lvl] of SIXTHS) {
      const A = H.side('A', lvl == null ? { slots } : { sixth: true, sixthLevel: lvl, slots });
      const st = teamStats(A, B0, N, {});
      rows[q] = st;
      const d = rows.none ? rows.none.conceded.mean - st.conceded.mean : 0;
      const dw = rows.none ? (st.win.mean - rows.none.win.mean) * 100 : 0;
      say(`    ${q.padEnd(10)} conceded ${f(st.conceded.mean, 1)}±${st.conceded.se.toFixed(1)}  win ${f(st.win.mean * 100, 1)}  6th ov ${f(st.sixthOvers.mean, 1)}  peak ${f(st.frontPeak.mean, 3)}` +
        (q === 'none' ? '' : `  -> saves ${f(d, 1)} runs, ${f(dw, 1)} pts`));
      out.insurance.push({ state, sixth: q, ...st,
        savesRuns: q === 'none' ? 0 : d, savesWin: q === 'none' ? 0 : dw });
    }
  }
}

// ---------------------------------------------------------------------------
// §2 THE SEVENTH OPTION. A six-front-bowler side gains a seventh part-timer
// (the No.4 bat): worth anything, fresh or stressed?
// ---------------------------------------------------------------------------
if (has('seventh') || has('all')) {
  say('\n=== §2 SEVENTH OPTION (N=' + N + ') ===');
  const B0 = H.side('B', {});
  out.seventh = [];
  for (const [state, slots] of [['fresh', []], ['two weary quicks', [{ slot: 6, fatigue: 'weary' }, { slot: 7, fatigue: 'weary' }]]]) {
    const rows = {};
    for (const [lbl, seventh] of [['six options', false], ['plus seventh (50)', true]]) {
      const o = { sixth: true, sixthLevel: 55, slots: slots.slice() };
      if (seventh) o.slots = o.slots.concat([{ slot: 3, bowlTypeFull: 'partTimeSpin', skills: { wicket: 50, economy: 50, discipline: 50, moveTurn: 50, variation: 50 } }]);
      const A = H.side('A', o);
      const st = teamStats(A, B0, N, {});
      rows[lbl] = st;
      const d = rows['six options'] ? rows['six options'].conceded.mean - st.conceded.mean : 0;
      say(`  ${state.padEnd(18)} ${lbl.padEnd(18)} conceded ${f(st.conceded.mean, 1)}  win ${f(st.win.mean * 100, 1)}` + (seventh ? `  -> saves ${f(d, 1)} runs` : ''));
      out.seventh.push({ state, lbl, ...st, savesRuns: seventh ? d : 0 });
    }
  }
}

// ---------------------------------------------------------------------------
// §3 THE OPENING BURST. Partial plans: the two best new-ball men painted for
// 0/2/3/4/5/6 overs each, everything else left to the captain (holes fall to
// aiPickBowler). Death usage of the openers is recorded to see whether the
// captain brings them back by himself.
// ---------------------------------------------------------------------------
function burstPlan(n) {
  if (!n) return null;
  const compiled = new Array(50).fill(null);
  for (let k = 0; k < n; k++) { compiled[2 * k] = 'A-bowl0'; compiled[1 + 2 * k] = 'A-bowl1'; }
  return { compiled };
}
if (has('burst') || has('all')) {
  say('\n=== §3 PAINTED OPENING BURST 0..6 x PITCH (N=' + Math.min(N, 200) + ') ===');
  const B0 = H.side('B', {});
  const A = H.side('A', {});
  out.burst = [];
  for (const [cond, pitch, weather] of [['balanced', 'balanced', 'Sunny'], ['green', 'green', 'Sunny'],
    ['green/overcast', 'green', 'Overcast'], ['flat', 'flat', 'Sunny']]) {
    say(`  ${cond}:`);
    for (const n of [0, 2, 3, 4, 5, 6]) {
      const con = [], win = [], opDeath = [];
      for (let i = 0; i < Math.min(N, 200); i++) {
        const r = H.run(A, B0, 900001 + i * 104729, { pitch, weather, ordersA: burstPlan(n) });
        if (!r) continue;
        for (const inn of [r.i1, r.i2]) {
          if (!inn || inn.batTeam === 'A') continue;
          con.push(per50(inn.runs, inn.legal));
          let d = 0;
          for (let o = 40; o < inn.overBowl.length; o++)
            if (inn.overBowl[o] === 'A-bowl0' || inn.overBowl[o] === 'A-bowl1') d++;
          opDeath.push(d);
        }
        win.push(winOf(r));
      }
      const C = summary(con), V = summary(win), D = summary(opDeath);
      say(`    burst ${n}: conceded ${f(C.mean, 1)}±${C.se.toFixed(1)}  win ${f(V.mean * 100, 1)}  openers' death overs ${f(D.mean, 2)}`);
      out.burst.push({ cond, n, conceded: C, win: V, openersDeath: D });
    }
  }
}

// ---------------------------------------------------------------------------
// §4 THE DEATH RETURN. Six candidate profiles for a dual-phase quick; for
// each, two plans differing ONLY in who holds 47-50: the old rule's rested
// pair, or the profiled opener returning. His projected tank at 47 is
// printed from foFatProject — the number the coach would plan with.
// ---------------------------------------------------------------------------
if (has('death') || has('all')) {
  say('\n=== §4 OPENER AT THE DEATH, BY PROFILE (N=' + Math.min(N, 200) + ') ===');
  const B0 = H.side('B', {});
  const prof = {
    'opening specialist': { skills: { wicket: 66, moveTurn: 72, economy: 50, discipline: 50 } },
    'elite dual-phase': { skills: { wicket: 64, moveTurn: 62, economy: 66, discipline: 66 } },
    'low-stamina dual': { skills: { wicket: 64, moveTurn: 62, economy: 66, discipline: 66, stamina: 30 } },
    'high-stamina dual': { skills: { wicket: 64, moveTurn: 62, economy: 66, discipline: 66, stamina: 85 } },
    'tired dual (weary)': { fatigue: 'weary', skills: { wicket: 64, moveTurn: 62, economy: 66, discipline: 66 } }
  };
  out.death = [];
  for (const nm in prof) {
    const ov = Object.assign({ slot: 6, bowlTypeFull: 'seamFast' }, prof[nm]);
    const A = H.side('A', { sixth: true, sixthLevel: 52, slots: [ov] });
    // his projected tank at 47 after a 4-over burst, straight off the engine
    const spec = { bowlTypeFull: 'seamFast', age: 27,
      skills: Object.assign({ stamina: 55 }, prof[nm].skills || {}), fatigue: prof[nm].fatigue || 'rested' };
    H.ctx.__cfSpec = spec;
    const proj = vm.runInContext('foFatProject(__prMake(__cfSpec),[0,2,4,6],46)', H.ctx);
    // two complete legal plans that differ in EXACTLY two overs (46 and 48,
    // 0-based): the rested wrist-spinner keeps them, or the profiled opener
    // returns for them. Everything else identical, all fifty covered, nobody
    // over ten, nobody bowling consecutive overs.
    const mk = blocks => { const c = new Array(50).fill(null);
      for (const [b, s, n2] of blocks) for (let k = 0; k < n2; k++) c[s + 2 * k] = b;
      return { compiled: c }; };
    const base = [
      ['A-bowl0', 0, 4],                  // the studied man's opening burst
      ['A-bowl2', 8, 10], ['A-bat4', 28, 9],          // even end
      ['A-bowl3', 1, 10], ['A-bowl4', 21, 7], ['A-bowl1', 35, 8]   // odd end
    ];
    const planRested = mk(base.concat([['A-bowl4', 46, 2]]));
    const planReturn = mk(base.concat([['A-bowl0', 46, 2]]));
    const res = {};
    for (const [lbl, plan] of [['rested pair', planRested], ['opener returns', planReturn]]) {
      const con = [], win = [], dcon = [];
      for (let i = 0; i < Math.min(N, 200); i++) {
        const r = H.run(A, B0, 900001 + i * 104729, { ordersA: plan });
        if (!r) continue;
        for (const inn of [r.i1, r.i2]) {
          if (!inn || inn.batTeam === 'A') continue;
          con.push(per50(inn.runs, inn.legal));
          let dr = 0, db = 0;
          for (let o = 40; o < inn.overBowl.length; o++) {
            const prev = o > 0 ? (inn.cumRuns[o - 1] ?? 0) : 0;
            if (inn.cumRuns[o] != null) { dr += inn.cumRuns[o] - prev; db += 6; }
          }
          if (db) dcon.push(dr * 6 / db);
        }
        win.push(winOf(r));
      }
      res[lbl] = { conceded: summary(con), win: summary(win), deathRpo: summary(dcon) };
    }
    const dd = res['rested pair'].deathRpo.mean - res['opener returns'].deathRpo.mean;
    say(`  ${nm.padEnd(20)} proj tank@47 ${f(proj, 3)}  death RPO rested ${f(res['rested pair'].deathRpo.mean)} v return ${f(res['opener returns'].deathRpo.mean)}  (return better by ${f(dd)})  win ${f(res['rested pair'].win.mean * 100, 1)} v ${f(res['opener returns'].win.mean * 100, 1)}`);
    out.death.push({ profile: nm, proj, rested: res['rested pair'], returns: res['opener returns'] });
  }
}

// ---------------------------------------------------------------------------
// §5 CAPTAINCY'S SLOPE, WHERE SELECTION LIVES. capt 40/64/88 across attack
// shapes; the fitted runs-per-point is what CAPT_RUNS should say.
// ---------------------------------------------------------------------------
if (has('capt') || has('all')) {
  const M0 = Math.min(N, 350);
  say('\n=== §5 CAPTAINCY SLOPE BY ATTACK (N=' + M0 + ') ===');
  const B0 = H.side('B', { slots: [{ slot: 0, capt: 50 }] });
  const ATT = [
    ['balanced', {}],
    ['pace-heavy', { bowlTypes: ['seamFast', 'seamFastMedium', 'seamMedium', 'seamFastMedium', 'fingerSpin'] }],
    ['spin-heavy', { bowlTypes: ['seamFastMedium', 'seamFast', 'fingerSpin', 'wristSpin', 'fingerSpin'] }],
    ['one weary quick', { slots: [{ slot: 6, fatigue: 'weary' }] }],
    ['six options', { sixth: true, sixthLevel: 52 }]
  ];
  out.captSlope = [];
  for (const [atk, o] of ATT) {
    const row = {};
    for (const capt of [40, 64, 88]) {
      const oo = JSON.parse(JSON.stringify(o));
      oo.slots = (oo.slots || []).concat([{ slot: 0, capt }]);
      const A = H.side('A', oo);
      const st = teamStats(A, B0, M0, {});
      row[capt] = st;
    }
    const slope = (row[40].conceded.mean - row[88].conceded.mean) / 48;
    const wslope = (row[88].win.mean - row[40].win.mean) * 100 / 48;
    say(`  ${atk.padEnd(16)} conceded 40/64/88: ${f(row[40].conceded.mean, 1)} ${f(row[64].conceded.mean, 1)} ${f(row[88].conceded.mean, 1)}  -> ${f(slope, 3)} runs/pt, ${f(wslope * 10, 2)} win pts/10`);
    out.captSlope.push({ atk, c40: row[40], c64: row[64], c88: row[88], runsPerPt: slope, winPer10: wslope * 10 });
  }
}

if (has('json')) console.log(JSON.stringify(out, null, 1));
