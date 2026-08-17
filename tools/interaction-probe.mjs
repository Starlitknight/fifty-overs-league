#!/usr/bin/env node
/* tools/interaction-probe.mjs — ARE WE PAYING FOR THE SAME CRICKET TWICE?
 *
 * Parts VI and VII of the player-realism audit. Not a factorial: each
 * section is one focused question about whether two attributes overlap,
 * plus the player-value crossovers that say whether a secondary attribute
 * can outweigh primary skill at believable magnitudes.
 *
 *   §1 experience x fatigue / x age — cross-terms read exactly off ballDist
 *   §2 captaincy x sixth bowler, captaincy x tired attack — match-sampled
 *   §3 fielding x fatigue — the three fielding channels against the
 *      pre-match ladder and the in-match tank (part exact, part sampled)
 *   §4 player-value crossovers: batting v experience, bowling v experience,
 *      batting v fielding, batting v captaincy
 *
 *   node tools/interaction-probe.mjs --exact
 *   node tools/interaction-probe.mjs --capt --field --value --n=300
 *   node tools/interaction-probe.mjs --all --n=300 --json > evidence.json
 *
 * IT CHANGES NOTHING. Every number is read out of the built index.html in a VM.
 */
import { makeHarness, summary, per50, distStats, arg, has } from './realism-lib.mjs';

const N = parseInt(arg('n', '240'), 10);
const H = makeHarness();
const out = {};
const say = s => { if (!has('json')) console.log(s); };
const f = (x, n = 2) => (x == null || !isFinite(x) ? '   -  ' : (+x).toFixed(n).padStart(7));

const winOf = r => r.winner === 'A' ? 1 : (r.winner ? 0 : 0.5);
function teamStats(A, B, n, opts) {
  const sc = [], con = [], win = [];
  for (let i = 0; i < n; i++) {
    const r = H.run(A, B, 900001 + i * 104729, opts || {});
    if (!r) continue;
    for (const inn of [r.i1, r.i2]) {
      if (!inn) continue;
      if (inn.batTeam === 'A') sc.push(per50(inn.runs, inn.legal));
      else con.push(per50(inn.runs, inn.legal));
    }
    win.push(winOf(r));
  }
  return { scored: summary(sc), conceded: summary(con), win: summary(win) };
}

// ---------------------------------------------------------------------------
// §1 EXPERIENCE x FATIGUE, x AGE — exact. ballDist has no cross-terms, so
// the deltas should be additive; the table shows whether the ENGINE lets an
// old head compensate for tired legs (it should not, and does not — state it
// with numbers rather than by reading the code aloud).
// ---------------------------------------------------------------------------
if (has('exact') || has('all')) {
  say('\n=== §1 EXPERIENCE x FATIGUE AND x AGE, EXACT ===');
  const ctx = { over: 44, faced: 30, chase: true, reqRate: 8.5, rrDef: 0.97, wkts: 5, ballsLeft: 36 };
  say('  chase pressure state; batsman wkt% by exp x batFat:');
  say('  exp\\fat      0.0     0.5     0.9');
  out.expFat = [];
  for (const exp of [20, 85]) {
    const row = [];
    for (const bf of [0, 0.5, 0.9])
      row.push(distStats(H.dist({ exp }, {}, { ...ctx, batFat: bf })).wkt);
    say(`    ${String(exp).padStart(2)}    ${row.map(x => f(x)).join(' ')}   (fat cost: ${f(row[2] - row[0])})`);
    out.expFat.push({ exp, wkt: row, fatCost: row[2] - row[0] });
  }
  say('  -> the fatigue cost is the same at every experience: no cross-term,');
  say('     experience does not buy tired-legs immunity (correct), and fatigue');
  say('     does not erode composure either (arguable).');
  say('\n  same state; batsman wkt% by exp x age (faced 80, late-innings age term):');
  out.expAge = [];
  for (const exp of [20, 85]) {
    const row = [];
    for (const age of [24, 36])
      row.push(distStats(H.dist({ exp, age }, {}, { ...ctx, faced: 80 })).wkt);
    say(`    exp ${String(exp).padStart(2)}: age24 ${f(row[0])}  age36 ${f(row[1])}  (age cost ${f(row[1] - row[0])})`);
    out.expAge.push({ exp, wkt24: row[0], wkt36: row[1], ageCost: row[1] - row[0] });
  }
}

// ---------------------------------------------------------------------------
// §2 CAPTAINCY x SIXTH BOWLER / x TIRED ATTACK. A good captain's whole value
// is choosing: does he choose BETTER when there is genuinely more to choose
// (a sixth option, a tiring frontline)?
// ---------------------------------------------------------------------------
if (has('capt') || has('all')) {
  say('\n=== §2 CAPTAINCY x THE THINGS A CAPTAIN MANAGES (N=' + N + ') ===');
  const B0 = H.side('B', {});
  out.captSixth = [];
  say('  attack           capt   conceded/50    6th overs   win%');
  for (const sixth of [false, true]) for (const capt of [20, 95]) {
    const A = H.side('A', { sixth, sixthLevel: 52, slots: [{ slot: 0, capt }] });
    const sc = [], con = [], win = [], sx = [];
    for (let i = 0; i < N; i++) {
      const r = H.run(A, B0, 900001 + i * 104729, {});
      if (!r) continue;
      for (const inn of [r.i1, r.i2]) {
        if (!inn) continue;
        if (inn.batTeam !== 'A') {
          con.push(per50(inn.runs, inn.legal));
          const b6 = inn.bowlers['A-bat4'];
          sx.push(b6 ? b6.b / 6 : 0);
        }
      }
      win.push(winOf(r));
    }
    const C = summary(con), V = summary(win), S = summary(sx);
    say(`  ${(sixth ? 'six options ' : 'five options').padEnd(15)}  ${String(capt).padStart(2)}   ${f(C.mean)}±${C.se.toFixed(1)}   ${f(S.mean)}    ${f(V.mean * 100, 1)}±${(V.se * 100).toFixed(1)}`);
    out.captSixth.push({ sixth, capt, conceded: C, win: V, sixthOvers: S });
  }
  say('\n  low-stamina (35) attack — does a good captain protect tired men?');
  out.captTired = [];
  for (const capt of [20, 95]) {
    const A = H.side('A', { slots: [0, 6, 7, 8, 9, 10].map(s => s === 0 ? { slot: 0, capt } : { slot: s, skills: { stamina: 35 } }) });
    const st = teamStats(A, B0, N);
    say(`  capt ${String(capt).padStart(2)}: conceded ${f(st.conceded.mean)}±${st.conceded.se.toFixed(1)}  win ${f(st.win.mean * 100, 1)}±${(st.win.se * 100).toFixed(1)}`);
    out.captTired.push({ capt, ...st });
  }
}

// ---------------------------------------------------------------------------
// §3 FIELDING x FATIGUE. Three channels, three different answers, measured:
//   pre-match ladder -> ground fielding (via withForm's field -0.34/pen pt)
//   pre-match ladder -> catching: NOT read (contest uses raw skills)
//   in-match tank    -> no fielding channel at all
// The sampled table shows the ground-save ledger move while the drop ledger
// stands still for the same tired side.
// ---------------------------------------------------------------------------
if (has('field') || has('all')) {
  say('\n=== §3 FIELDING x FATIGUE (N=' + N + ') ===');
  const B0 = H.side('B', {});
  say('  side state    saves/inn  misf+fumb   catches   drops   dropRate   conceded/50');
  out.fieldFat = [];
  for (const w of ['rested', 'weary']) {
    const A = H.side('A', { all: { fatigue: w } });
    const sv = [], mf = [], ct = [], dp = [], con = [];
    for (let i = 0; i < N; i++) {
      const r = H.run(A, B0, 900001 + i * 104729, {});
      if (!r) continue;
      for (const inn of [r.i1, r.i2]) {
        if (!inn || inn.batTeam === 'A') continue;
        const fl = inn.fld || {};
        sv.push((fl.save1 || 0) + (fl.save2 || 0) + (fl.save3 || 0) + (fl.save4 || 0));
        mf.push((fl.misfield || 0) + (fl.fumble || 0));
        ct.push(fl.catch || 0); dp.push(fl.drop || 0);
        con.push(per50(inn.runs, inn.legal));
      }
    }
    const S = summary(sv), M2 = summary(mf), C = summary(ct), D = summary(dp);
    const rate = D.mean / Math.max(0.001, C.mean + D.mean);
    say(`  ${w.padEnd(12)} ${f(S.mean)} ${f(M2.mean)}  ${f(C.mean)} ${f(D.mean)}   ${f(rate * 100, 1)}%   ${f(summary(con).mean)}`);
    out.fieldFat.push({ word: w, saves: S, misf: M2, catches: C, drops: D, dropRate: rate, conceded: summary(con) });
  }
  say('  -> ground saves fall and misfields rise for a tired side; the DROP');
  say('     RATE does not move, because the catch contest reads raw skills.');
  say('     The in-match tank touches no fielding channel at all.');
}

// ---------------------------------------------------------------------------
// §4 PLAYER-VALUE CROSSOVERS. Two versions of the same man in the same XI;
// which one wins more cricket? Paired seeds, team win% and the man's own
// output. Skill trades are sized to the brief's examples.
// ---------------------------------------------------------------------------
if (has('value') || has('all')) {
  say('\n=== §4 PLAYER-VALUE CROSSOVERS (N=' + N + ') ===');
  const B0 = H.side('B', {});
  const CASES = [
    ['bat 70 / exp 30', { slot: 2, exp: 30, skills: { vsPace: 70, vsSpin: 70, rotation: 70 } }],
    ['bat 66 / exp 80', { slot: 2, exp: 80, skills: { vsPace: 66, vsSpin: 66, rotation: 66 } }],
    ['bowl 72 / exp 30', { slot: 6, exp: 30, skills: { wicket: 72, economy: 72 } }],
    ['bowl 68 / exp 80', { slot: 6, exp: 80, skills: { wicket: 68, economy: 68 } }],
    ['bat 70 / field 35', { slot: 2, skills: { vsPace: 70, vsSpin: 70, rotation: 70, fielding: 35, catching: 35 } }],
    ['bat 66 / field 85', { slot: 2, skills: { vsPace: 66, vsSpin: 66, rotation: 66, fielding: 85, catching: 85 } }],
    ['captain: bat 62 / capt 30', { slot: 0, capt: 30, skills: { vsPace: 62, vsSpin: 62, rotation: 62 } }],
    ['captain: bat 58 / capt 90', { slot: 0, capt: 90, skills: { vsPace: 58, vsSpin: 58, rotation: 58 } }]
  ];
  out.value = [];
  for (const [lbl, ov] of CASES) {
    const A = H.side('A', { slots: [ov] });
    const st = teamStats(A, B0, N);
    const own = [];
    for (let i = 0; i < Math.min(N, 200); i++) {
      const r = H.run(A, B0, 900001 + i * 104729, {});
      if (!r) continue;
      for (const inn of [r.i1, r.i2]) {
        if (!inn) continue;
        if (ov.slot <= 5 && inn.batTeam === 'A') {
          const b = inn.bat.find(x => x.nm === 'A-bat' + ov.slot || x.nm === 'A-wk');
          if (b && b.b > 0) own.push(b.r);
        } else if (ov.slot >= 6 && inn.batTeam !== 'A') {
          const b = inn.bowlers['A-bowl' + (ov.slot - 6)];
          if (b && b.b > 0) own.push(b.w);
        }
      }
    }
    const O = summary(own);
    say(`  ${lbl.padEnd(26)} win ${f(st.win.mean * 100, 1)}±${(st.win.se * 100).toFixed(1)}%  scored ${f(st.scored.mean, 1)}  conceded ${f(st.conceded.mean, 1)}  own ${f(O.mean)}`);
    out.value.push({ lbl, ...st, own: O });
  }
}

if (has('json')) console.log(JSON.stringify(out, null, 1));
