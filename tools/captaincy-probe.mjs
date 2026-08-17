#!/usr/bin/env node
/* tools/captaincy-probe.mjs — IS CAPTAINCY A DECISION SKILL OR AN AURA?
 *
 * Part III of the player-realism audit. Captaincy's whole life in this
 * engine is:
 *
 *   1. aiPickBowler's SLIP LAW — capt >= 92 always gets the top of the
 *      captain's own ranking; below 88 he reaches past it with probability
 *      0.85*(88-capt)/88, never past the fourth option
 *   2. a per-ball sliver — dot += (captBowl-50)*0.00020,
 *      W -= (captBat-50)*0.00012 — deliberately a quarter of what it was
 *   3. the Match-Day Coach prices it at 0.18 runs/pt capped at 88 when
 *      picking an XI
 *
 * Field settings (aiField), intent (aiIntent) and the toss read the match
 * state and the pitch, NEVER the captain's skill — that is a design fact
 * this probe simply states and then tests around.
 *
 *   §1 the slip law, exactly, with the 88/92 seams shown
 *   §2 captaincy 20..95 over whole matches, paired seeds
 *   §3 the controlled tactical table: eight posed situations, the ranking,
 *      the pick at each captaincy, and the regret in runs
 *   §4 captaincy x experience four-team square
 *
 *   node tools/captaincy-probe.mjs --law --tactics
 *   node tools/captaincy-probe.mjs --match --square --n=300
 *   node tools/captaincy-probe.mjs --all --n=300 --json > evidence.json
 *
 * IT CHANGES NOTHING. Every number is read out of the built index.html in a VM.
 */
import vm from 'node:vm';
import { makeHarness, summary, per50, distStats, arg, has } from './realism-lib.mjs';

const N = parseInt(arg('n', '240'), 10);
const H = makeHarness();
const out = {};
const say = s => { if (!has('json')) console.log(s); };
const f = (x, n = 2) => (x == null || !isFinite(x) ? '   -  ' : (+x).toFixed(n).padStart(7));

// ---------------------------------------------------------------------------
// §1 THE SLIP LAW. P(top choice) has a closed form; the sampled P from the
// engine's own hash should sit on it. The seams at 88 (slip hits zero) and
// 92 (the early-return) are the "arbitrary threshold" question, measured.
// ---------------------------------------------------------------------------
if (has('law') || has('all')) {
  say('\n=== §1 THE SLIP LAW (sampled from aiPickBowler, 4000 over-identities) ===');
  say('  capt   P(1st choice)   P(2nd)   P(3rd)   closed-form P(1st)');
  const S = H.side('S', {});
  out.slip = [];
  for (const capt of [5, 20, 40, 60, 70, 80, 85, 86, 87, 88, 89, 90, 91, 92, 95]) {
    const picks = {};
    let rank = null;
    for (let k = 0; k < 4000; k++) {
      const r = H.pickBowler({ side: S, over: 20, captBowl: capt, seedKey: k });
      rank = r.rank;
      picks[r.pick] = (picks[r.pick] || 0) + 1;
    }
    const p1 = (picks[rank[0]] || 0) / 4000, p2 = (picks[rank[1]] || 0) / 4000, p3 = (picks[rank[2]] || 0) / 4000;
    const closed = capt >= 92 ? 1 : Math.min(1, Math.max(0, 1 - 0.85 * (88 - capt) / 88));
    say(`   ${String(capt).padStart(3)}     ${f(p1, 3)}      ${f(p2, 3)}  ${f(p3, 3)}     ${f(closed, 3)}`);
    out.slip.push({ capt, p1, p2, p3, closed });
  }
  say('\n  NOTE what the captain is blind to, by construction: aiPickBowler\'s');
  say('  scoring reads phase, pitch, weather, stand, spell length, tank and');
  say('  overs left. It never reads RUNS CONCEDED TODAY (no reaction to a man');
  say('  being carted) and never reads the BATTING side\'s wickets (no hunting');
  say('  the tail with the strike bowler). aiField and the toss never read');
  say('  captaincy at all.');
}

// ---------------------------------------------------------------------------
// §2 CAPTAINCY OVER WHOLE MATCHES. Slot 0 (the opener) carries the armband on
// both sides of the innings; only his captaincy moves. Everything else —
// including his batting — is identical.
// ---------------------------------------------------------------------------
if (has('match') || has('all')) {
  say('\n=== §2 CAPTAINCY 20..95 OVER MATCHES (paired seeds, N=' + N + ') ===');
  const B0 = H.side('B', { slots: [{ slot: 0, capt: 50 }] });
  say('  capt  conceded/50   scored/50    top-2 bowler overs   win%');
  out.captMatch = [];
  for (const capt of [20, 40, 60, 80, 95]) {
    const A = H.side('A', { slots: [{ slot: 0, capt }] });
    const con = [], sc = [], win = [], topOv = [];
    for (let i = 0; i < N; i++) {
      const r = H.run(A, B0, 900001 + i * 104729, {});
      if (!r) continue;
      for (const inn of [r.i1, r.i2]) {
        if (!inn) continue;
        if (inn.batTeam === 'A') sc.push(per50(inn.runs, inn.legal));
        else {
          con.push(per50(inn.runs, inn.legal));
          // overs actually given to the two highest-threat men (bowl0, bowl1
          // by construction: threat 55 each but bowl0/1 are the new-ball men;
          // use the two most expensive-to-lose: fingerSpin bowl3 has best mid
          // score; simplest robust readout: overs of the ranking's usual top
          // two, bowl3 + bowl0)
          const o1 = (inn.bowlers['A-bowl3'] || {}).b || 0, o2 = (inn.bowlers['A-bowl0'] || {}).b || 0;
          topOv.push((o1 + o2) / 6);
        }
      }
      win.push(r.winner === 'A' ? 1 : (r.winner ? 0 : 0.5));
    }
    const C = summary(con), Sc = summary(sc), V = summary(win), T = summary(topOv);
    say(`   ${String(capt).padStart(2)}  ${f(C.mean)}±${C.se.toFixed(1)}  ${f(Sc.mean)}±${Sc.se.toFixed(1)}  ${f(T.mean)}   ${f(V.mean * 100, 1)}±${(V.se * 100).toFixed(1)}`);
    out.captMatch.push({ capt, conceded: C, scored: Sc, win: V, topTwoOvers: T });
  }
}

// ---------------------------------------------------------------------------
// §3 THE TACTICAL TABLE. Eight situations with an objectively sensible
// option. For each: the engine's own ranking, the pick at capt 20..95, and
// the expected cost of the pick against the best choice, in runs an over
// (a wicket priced at 20 runs of resource — stated, not hidden).
// ---------------------------------------------------------------------------
const WICKET_RUNS = 20;
function overCost(batSpec, bowlerP, ctx) {
  // expected runs an over MINUS wicket value taken, from the exact dist for
  // THIS bowler in THIS situation; lower = better for the fielding side
  const s = distStats(H.dist(batSpec, bowlerP, ctx));
  return s.rpo - WICKET_RUNS * 6 * (s.wkt / 100);
}

if (has('tactics') || has('all')) {
  say('\n=== §3 CONTROLLED TACTICAL TESTS ===');
  // a bespoke attack whose men have names that say what they are
  const mkAtk = slots => H.side('T', { slots });
  const strongSeam = { slot: 6, skills: { wicket: 68, economy: 60, moveTurn: 78 } };
  const spinner = { slot: 9, skills: { wicket: 60, economy: 62, moveTurn: 70 } };
  const strike = { slot: 7, skills: { wicket: 72, economy: 48, variation: 66 } };
  const miser = { slot: 8, skills: { wicket: 46, economy: 72, discipline: 70 } };
  const deathMan = { slot: 8, talents: ['deathSpecialist'], skills: { economy: 66, discipline: 66 } };
  const CASES = [
    ['green pitch, over 4: big seamer v spinner', mkAtk([strongSeam, spinner]),
      { over: 4, pitch: 'green', weather: 'Overcast' }, 'T-bowl0'],
    ['dry pitch, over 30: spinner v seamers', mkAtk([strongSeam, spinner]),
      { over: 30, pitch: 'dry' }, 'T-bowl3'],
    ['stand of 60, over 26: strike man v miser', mkAtk([strike, miser]),
      { over: 26, pship: 60 }, 'T-bowl1'],
    ['death, over 45: death specialist available', mkAtk([deathMan]),
      { over: 45 }, 'T-bowl2'],
    ['death, over 45: death man has bowled 8 already', mkAtk([deathMan]),
      { over: 45, used: { 'T-bowl2': 48 } }, null],
    ['over 32: frontline quick at 0.75 tank, rest fresh', mkAtk([]),
      { over: 32, fat: { 'T-bowl1': 0.75 } }, null],
    ['over 18: same, spelled man mid-spell (spellB 30)', mkAtk([]),
      { over: 18, spellB: { 'T-bowl1': 30 }, fat: { 'T-bowl1': 0.45 } }, null]
  ];
  out.tactics = [];
  for (const [lbl, side, o, sensible] of CASES) {
    const base = { over: o.over, pitch: o.pitch || 'balanced', weather: o.weather || 'Sunny',
      pship: o.pship || 0, used: o.used || {}, spellB: o.spellB || {}, fat: o.fat || {} };
    const r0 = H.pickBowler({ side, ...base, captBowl: 99, seedKey: 1 });
    // cost every available man in this situation, exactly
    const ctx = { over: o.over, pitch: o.pitch || 'balanced',
      weather: (o.weather || 'sunny').toLowerCase(), pship: o.pship || 0, faced: 30,
      ballsThisSpell: 0 };
    const men = {};
    for (const p of side.players) if (p.bowlType) men[p.name] = p;
    const costs = {};
    for (const nm of r0.available) {
      const p = men[nm];
      costs[nm] = overCost({}, { bowlTypeFull: p.bowlTypeFull, age: p.age,
        skills: Object.assign({}, p.skills), talents: p.talents },
        Object.assign({}, ctx, { ballsThisSpell: (o.spellB || {})[nm] || 0,
          bowlFat: (o.fat || {})[nm] || 0 }));
    }
    const bestByCost = Object.keys(costs).sort((a, b) => costs[a] - costs[b])[0];
    say(`\n  ${lbl}`);
    say(`    engine ranking: ${r0.rank.join(' > ')}`);
    say(`    exact best (runs-cost): ${bestByCost}  [${Object.keys(costs).map(n => n.replace('T-', '') + ' ' + costs[n].toFixed(2)).join(', ')}]`);
    const rows = [];
    for (const capt of [20, 40, 60, 80, 95]) {
      const picks = {};
      for (let k = 0; k < 1500; k++) {
        const r = H.pickBowler({ side, ...base, captBowl: capt, seedKey: k });
        picks[r.pick] = (picks[r.pick] || 0) + 1;
      }
      let eCost = 0;
      for (const nm in picks) eCost += (costs[nm] ?? 0) * picks[nm] / 1500;
      const regret = eCost - costs[bestByCost];
      const pTop = (picks[r0.rank[0]] || 0) / 1500;
      const pSensible = sensible ? (picks[sensible] || 0) / 1500 : null;
      say(`    capt ${String(capt).padStart(2)}: P(rank-1) ${f(pTop, 2)}${sensible ? '  P(' + sensible.replace('T-', '') + ') ' + f(pSensible, 2) : ''}  regret ${f(regret, 3)} runs/over`);
      rows.push({ capt, pTop, pSensible, eCost, regret });
    }
    out.tactics.push({ lbl, rank: r0.rank, costs, bestByCost, rows });
  }
}

// ---------------------------------------------------------------------------
// §4 CAPTAINCY x EXPERIENCE. Four squares: does each contribute on its own
// axis, or is one a copy of the other?
// ---------------------------------------------------------------------------
if (has('square') || has('all')) {
  say('\n=== §4 CAPTAINCY x EXPERIENCE FOUR-TEAM SQUARE (N=' + N + ') ===');
  const B0 = H.side('B', {});
  say('  team              scored/50  conceded/50   win%');
  out.square = [];
  for (const [lbl, exp, capt] of [['loExp/loCapt', 30, 25], ['hiExp/loCapt', 85, 25],
    ['loExp/hiCapt', 30, 92], ['hiExp/hiCapt', 85, 92]]) {
    const A = H.side('A', { all: { exp }, slots: [{ slot: 0, capt }] });
    const sc = [], con = [], win = [];
    for (let i = 0; i < N; i++) {
      const r = H.run(A, B0, 900001 + i * 104729, {});
      if (!r) continue;
      for (const inn of [r.i1, r.i2]) {
        if (!inn) continue;
        if (inn.batTeam === 'A') sc.push(per50(inn.runs, inn.legal));
        else con.push(per50(inn.runs, inn.legal));
      }
      win.push(r.winner === 'A' ? 1 : (r.winner ? 0 : 0.5));
    }
    const S = summary(sc), C = summary(con), V = summary(win);
    say(`  ${lbl.padEnd(16)} ${f(S.mean)}±${S.se.toFixed(1)} ${f(C.mean)}±${C.se.toFixed(1)}  ${f(V.mean * 100, 1)}±${(V.se * 100).toFixed(1)}`);
    out.square.push({ lbl, exp, capt, scored: S, conceded: C, win: V });
  }
}

// ---------------------------------------------------------------------------
// §5 DOES A CAPTAIN BOWL SPELLS? Real one-day captains bowl men in 3-7 over
// spells; the slip law re-rolls the choice EVERY over. Measure the spell
// distribution (same-end = appearances two overs apart, the definition
// brec.spellB itself uses) at both ends of the captaincy scale.
// ---------------------------------------------------------------------------
if (has('spellchurn') || has('all')) {
  say('\n=== §5 SPELL LENGTHS BY CAPTAINCY (N=' + Math.min(N, 150) + ') ===');
  const B0 = H.side('B', {});
  out.spellchurn = [];
  for (const capt of [20, 60, 95]) {
    const A = H.side('A', { slots: [{ slot: 0, capt }] });
    const lens = {}, maxes = [];
    for (let i = 0; i < Math.min(N, 150); i++) {
      const r = H.run(A, B0, 700001 + i * 104729, {});
      if (!r) continue;
      for (const inn of [r.i1, r.i2]) {
        if (!inn || inn.batTeam === 'A') continue;
        const runs = {};
        for (let o = 0; o < inn.overBowl.length; o++) {
          const nm = inn.overBowl[o]; if (!nm) continue;
          const cur = runs[nm];
          if (cur && cur.last === o - 2) { cur.len++; cur.last = o; }
          else { if (cur) lens[cur.len] = (lens[cur.len] || 0) + 1;
                 runs[nm] = { len: 1, last: o }; }
        }
        for (const nm in runs) lens[runs[nm].len] = (lens[runs[nm].len] || 0) + 1;
        for (const nm in inn.bowlers) maxes.push(inn.bowlers[nm].maxSpell || 0);
      }
    }
    const tot = Object.values(lens).reduce((a, b) => a + b, 0) || 1;
    const share1 = (lens[1] || 0) / tot, share3p = Object.keys(lens).filter(k => +k >= 3)
      .reduce((a, k) => a + lens[k], 0) / tot;
    const mx = summary(maxes), over36 = maxes.filter(x => x >= 36).length / Math.max(1, maxes.length);
    say(`  capt ${String(capt).padStart(2)}: 1-over spells ${f(share1 * 100, 1)}%  3+ over spells ${f(share3p * 100, 1)}%  mean longest spellB ${f(mx.mean, 1)} balls  >=36: ${f(over36 * 100, 2)}%`);
    out.spellchurn.push({ capt, share1, share3p, maxSpell: mx, shareOver36: over36, lens });
  }
  say('  -> spells are a CAPTAINCY OUTPUT: weak captains churn one-over');
  say('     bowlers (80% single-over spells), elite captains settle on their');
  say('     best men long enough that the 36-ball longSpell fatigue term');
  say('     finally fires against them. Ordinary captains (the world median)');
  say('     bowl almost no real spells.');
}

// ---------------------------------------------------------------------------
// §6 CAPTAINCY MUST NOT BUY A SHIRT — re-verified against the shipped coach.
// A 12th man with captaincy 99 and progressively worse batting is offered to
// planMatchDay beside an ordinary 11: where does the coach swap him in?
// (The coach prices captaincy at CAPT_RUNS=0.18/pt capped at 88 — about 6.8
// runs across 50->88 — so the crossover should sit at a small batting gap.)
// ---------------------------------------------------------------------------
if (has('shirt') || has('all')) {
  say('\n=== §6 THE SHIRT TEST (Match-Day Coach, shipped) ===');
  out.shirt = [];
  for (const drop of [0, 4, 8, 12, 16, 20, 26, 32]) {
    const lvl = 61 - drop;   // the incumbent No.3 bats 61
    const side = H.side('S', {});
    const extra = H.mk({ name: 'S-armband', mpos: 12, role: 'middleOrderBat',
      capt: 99, skills: { vsPace: lvl, vsSpin: lvl, rotation: lvl, power: Math.max(5, lvl - 6) } });
    H.ctx.__shirtTeam = { name: 'S', players: side.players.concat([extra]) };
    const res = JSON.parse(vm.runInContext(
      `(function(){var plan=planMatchDay({team:__shirtTeam,pitch:'balanced',weather:'sunny',doctrine:null});` +
      `return JSON.stringify({xi:plan.battingOrder,captain:plan.captain})})()`, H.ctx));
    const inXI = res.xi.includes('S-armband');
    const dropped = side.players.map(p => p.name).filter(n => !res.xi.includes(n));
    say(`  armband bats ${lvl} (-${drop}): picked=${inXI}${inXI ? ' displacing ' + (dropped[0] || '?') : ''}  captain=${res.captain}`);
    out.shirt.push({ batLevel: lvl, drop, picked: inXI, displaced: dropped[0] || null, captain: res.captain });
  }
}

if (has('json')) console.log(JSON.stringify(out, null, 1));
