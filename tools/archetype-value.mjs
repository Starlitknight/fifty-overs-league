#!/usr/bin/env node
/* tools/archetype-value.mjs — DO TWO BOWLERS OF THE SAME OVERALL COST THE
 * OPPOSITION THE SAME NUMBER OF RUNS?
 *
 * B2's promise is not that every cricketer of a given card plays alike. It is
 * the opposite: a strike quick should buy wickets and leak, a controller should
 * dry an end up and take fewer, a mystery spinner should be worth his place in
 * a different phase of the innings. What the card DOES promise is that the men
 * are worth about the SAME - that a 95 is a 95 whoever he is, so a manager
 * choosing between them is choosing a style and not being quietly robbed.
 *
 * top-end-proof reports each man's own figures, which is exactly the wrong
 * instrument for that question: it cannot tell a legitimate trade-off (worse
 * average, better economy) from a straight loss (worse average, same economy).
 * So this measures the only currency in which two different bowlers can be
 * compared at all, and the same one the value weights were fitted in - THE RUN
 * DIFFERENTIAL HIS SIDE ACHIEVES WITH HIM IN IT. One man is swapped into an
 * otherwise fixed XI, hundreds of matches are played against a fixed
 * opposition on fixed seeds, and what comes back is what he was worth.
 *
 *   node tools/archetype-value.mjs --n=600
 *   node tools/archetype-value.mjs --n=600 --ovrs=75,85,95 --json
 *
 * IT CHANGES NOTHING. Every number is read out of the built index.html in a VM.
 */
import vm from 'node:vm';
import { makeEngine } from '../test/engine-vm.mjs';

const arg = (k, d) => {
  const hit = process.argv.find(a => a.startsWith('--' + k + '='));
  return hit ? hit.split('=')[1] : d;
};
const has = k => process.argv.includes('--' + k);
const N = parseInt(arg('n', '400'), 10);
const OVRS = arg('ovrs', '75,85,95').split(',').map(x => parseInt(x, 10));
const PITCH = arg('pitch', 'balanced');
const eng = makeEngine();
eng.setTuning(true);
const say = s => { if (!has('json')) console.log(s); };

// THE FIXED WORLD, identical to the one attribute-value and top-end-proof use,
// so every number in docs/b2-evidence is on one footing.
vm.runInContext(`
globalThis.__acMan = function (nm, pos, role, bt, sk) {
  var p = { name: nm, age: 27, nat: 'XXX', hand: 'R', role: role,
    bowlTypeFull: bt, exp: 55, formIx: 3, fatigue: 'rested', capt: 50, talents: [],
    skills: { vsPace: 55, vsSpin: 55, power: 52, rotation: 55, temperament: 54,
      wicket: 55, economy: 55, discipline: 55, moveTurn: 55, variation: 55,
      stamina: 55, fielding: 55, catching: 55, keeping: 55, stumping: 55 } };
  for (var k in (sk || {})) p.skills[k] = sk[k];
  jsDerive(p); p.mpos = pos; return p;
};
globalThis.__acSide = function (name) {
  var men = [], i;
  var BAT = [60, 58, 61, 57, 55];
  for (i = 0; i < 5; i++)
    men.push(__acMan(name + '-bat' + i, i + 1, i < 2 ? 'opener' : 'middleOrderBat', 'none',
      { vsPace: BAT[i], vsSpin: BAT[i], rotation: BAT[i], power: BAT[i] - 6 }));
  men.push(__acMan(name + '-wk', 6, 'wicketkeeper', 'none',
    { vsPace: 54, vsSpin: 54, rotation: 54, keeping: 74, stumping: 72, catching: 70 }));
  var TY = ['seamFastMedium', 'seamFast', 'seamMedium', 'fingerSpin', 'wristSpin'];
  var TAIL = [44, 32, 26, 21, 16];
  for (i = 0; i < 5; i++)
    men.push(__acMan(name + '-bowl' + i, 7 + i, TY[i], TY[i],
      { vsPace: TAIL[i], vsSpin: TAIL[i], rotation: TAIL[i], power: TAIL[i] }));
  return { name: name, ground: name + ' Park', players: men };
};
globalThis.__acSwap = function (sideJson, slot, manJson) {
  var t = JSON.parse(sideJson), man = JSON.parse(manJson);
  man.mpos = t.players[slot].mpos;
  man.name = t.players[slot].name;
  jsDerive(man);
  t.players[slot] = man;
  return JSON.stringify(t);
};
// ONE MATCH, reporting BOTH the scoreboard and the man's own card, so the
// team's run differential and his personal figures come out of the same
// cricket rather than two separate runs that might not line up.
globalThis.__acRun = function (taJson, tbJson, seed, who) {
  var ta = JSON.parse(taJson), tb = JSON.parse(tbJson);
  onMatchEnd = function () {};
  M = newMatch(ta, tb, __acPitch, (seed >>> 0) || 1);
  M.meta = { home: ta.name, away: tb.name, pitch: __acPitch, weather: 'Sunny',
             comp: 'cal', isUser: false, neutral: true };
  M.isUserMatch = false; M.ordersMap = {};
  App.tossState = { stage: 'x' };
  applyToss(aiTossDecision());
  var g = 0;
  while (M && !M.done && g++ < 4000) { autoPick(); stepBall(); }
  if (!M || !M.done) return null;
  var i1 = M.innings[0], i2 = M.innings[1];
  var out = { batFirst: i1.batTeam, s1: i1.runs, b1: i1.legal,
              s2: i2 ? i2.runs : 0, b2: i2 ? i2.legal : 0,
              winner: M.result ? M.result.winner : null,
              ballsBowled: 0, runsConceded: 0, wkts: 0, spells: 0, three: 0, five: 0 };
  for (var ii = 0; ii < M.innings.length; ii++) {
    var inn = M.innings[ii]; if (!inn) continue;
    var br = (inn.bowlers || {})[who];
    if (br && br.b > 0) {
      out.spells++; out.ballsBowled += br.b;
      out.runsConceded += (+br.r || 0); out.wkts += (+br.w || 0);
      if (br.w >= 3) out.three++;
      if (br.w >= 5) out.five++;
    }
  }
  return JSON.stringify(out);
};
`, eng.ctx);

vm.runInContext('globalThis.__acPitch = ' + JSON.stringify(PITCH) + ';', eng.ctx);
const mkSide = vm.runInContext('__acSide', eng.ctx);
const swap = vm.runInContext('__acSwap', eng.ctx);
const runM = vm.runInContext('__acRun', eng.ctx);
const genSquad = vm.runInContext('__foGenArchetypeSquad', eng.ctx);
const fitToLevel = vm.runInContext('foFitToLevel', eng.ctx);
const levelForOvr = vm.runInContext('foLevelForOvr', eng.ctx);
const pkOvr = vm.runInContext('foOvr', eng.ctx);
const A0 = JSON.stringify(mkSide('A')), B0 = JSON.stringify(mkSide('B'));
const BOWL_SLOT = 6;                                   // the fixed side's opening bowler

const SPIN = { wristSpin: 1, fingerSpin: 1, partTimeSpin: 1 };
// a cricketer of a named archetype, optionally of a named bowling family, moved
// onto the wanted mark by the engine's own similarity transform
const findMan = (archetype, wantOvr, family) => {
  for (let seed = 1; seed < 900; seed++) {
    let sq;
    try { sq = genSquad(7000 + seed, 'England', 'balanced', null, 1, 'd1a'); }
    catch (e) { continue; }
    const men = Array.isArray(sq) ? sq : (sq && sq.players) || [];
    for (const p of men) {
      if (p.arche !== archetype) continue;
      if (!(p.bowlType && p.bowlType !== 'none')) continue;
      if (family === 'spin' && !SPIN[p.bowlTypeFull]) continue;
      if (family === 'seam' && SPIN[p.bowlTypeFull]) continue;
      if (family && family !== 'spin' && family !== 'seam' && p.bowlTypeFull !== family) continue;
      const c = JSON.parse(JSON.stringify(p));
      c.age = 27;
      fitToLevel(c, levelForOvr(wantOvr));
      return c;
    }
  }
  return null;
};

// HIS SIDE'S RUN DIFFERENTIAL, per 50 overs, plus his own card out of the same
// matches. An innings that ends early because the target was chased is a WON
// innings, not a short one, so both scores go onto a per-50 footing first.
function measure(man) {
  const side = man ? swap(A0, BOWL_SLOT, JSON.stringify(man)) : A0;
  const who = JSON.parse(side).players[BOWL_SLOT].name;
  let net = 0, wins = 0, k = 0;
  const t = { ballsBowled: 0, runsConceded: 0, wkts: 0, spells: 0, three: 0, five: 0 };
  for (let i = 0; i < N; i++) {
    const flip = i % 2 === 1;
    const j = runM(flip ? B0 : side, flip ? side : B0, (900001 + i * 104729) >>> 0, who);
    if (!j) continue;
    const r = JSON.parse(j);
    k++;
    const aFirst = r.batFirst === 'A';
    const per50 = (s, b) => (b > 0 ? s * 300 / b : 0);
    const aR = aFirst ? per50(r.s1, r.b1) : per50(r.s2, r.b2);
    const bR = aFirst ? per50(r.s2, r.b2) : per50(r.s1, r.b1);
    net += aR - bR;
    if (r.winner === 'A') wins++; else if (!r.winner) wins += 0.5;
    t.ballsBowled += r.ballsBowled; t.runsConceded += r.runsConceded;
    t.wkts += r.wkts; t.spells += r.spells; t.three += r.three; t.five += r.five;
  }
  return {
    net: net / Math.max(1, k), win: 100 * wins / Math.max(1, k), n: k,
    avg: t.wkts ? t.runsConceded / t.wkts : null,
    econ: t.ballsBowled ? 6 * t.runsConceded / t.ballsBowled : 0,
    sr: t.wkts ? t.ballsBowled / t.wkts : null,
    wpm: t.spells ? t.wkts / t.spells : 0,
    haul: t.spells ? 100 * t.three / t.spells : 0
  };
}

// THE FIVE THE QUESTION NAMES. The archetype is how the world deals identity;
// the family is what he bowls, because "finger spinner" and "wrist spinner" are
// trades rather than temperaments and both have to be asked about.
const CASES = [
  ['strikeQuick', 'seam', 'strike quick'],
  ['controller', 'seam', 'controller (seam)'],
  ['bigTurner', 'seam', 'swing/seam specialist'],
  ['controller', 'fingerSpin', 'finger spinner'],
  ['mystery', 'spin', 'wrist/mystery spinner'],
  ['bigTurner', 'spin', 'big-turning spinner'],
  ['wildQuick', 'seam', 'wild quick'],
  ['workhorse', 'seam', 'workhorse']
];

const f = (x, n = 2, w = 8) => (x == null || !isFinite(x) ? '-'.padStart(w) : x.toFixed(n).padStart(w));
const out = { n: N, ovrs: OVRS, pitch: PITCH, baseline: null, rows: [] };

const base = measure(null);
out.baseline = base;
say(`\n=== EQUAL OVR, EQUAL VALUE? BOWLING ARCHETYPES (${N} matches a row, ${PITCH} pitch) ===`);
say('One man swapped into the opening-bowler slot of an otherwise fixed XI. NET');
say('is his side\'s run differential per 50 overs - the same currency the value');
say('weights were fitted in, and the only one in which two different kinds of');
say('bowler can be compared at all. The personal figures are there to show the');
say('STYLE; the net is there to show the WORTH.');
say(`\n   baseline (the ordinary bowler this slot already had): net ${base.net.toFixed(2)}, ${base.win.toFixed(1)}% wins`);

for (const ovr of OVRS) {
  say(`\n  AT OVR ${ovr}`);
  say('  archetype                 card      NET    win%      avg    econ      SR   w/inn   3fer%');
  for (const [arche, family, label] of CASES) {
    const man = findMan(arche, ovr, family);
    if (!man) { say('  ' + label.padEnd(24) + '  (the generator deals none)'); continue; }
    const m = measure(man);
    out.rows.push({ ovr, arche, family, label, card: pkOvr(man), ...m });
    say('  ' + label.padEnd(24) + String(pkOvr(man)).padStart(6) + f(m.net) + f(m.win, 1) +
        f(m.avg) + f(m.econ) + f(m.sr, 1) + f(m.wpm) + f(m.haul, 1));
  }
  const here = out.rows.filter(r => r.ovr === ovr);
  if (here.length > 1) {
    const nets = here.map(r => r.net);
    const spread = Math.max(...nets) - Math.min(...nets);
    const best = here.find(r => r.net === Math.max(...nets));
    const worst = here.find(r => r.net === Math.min(...nets));
    say(`  spread ${spread.toFixed(1)} runs: ${best.label} (${best.net.toFixed(1)}) over ` +
        `${worst.label} (${worst.net.toFixed(1)})`);
  }
}
say('');
if (has('json')) console.log(JSON.stringify(out, null, 1));
