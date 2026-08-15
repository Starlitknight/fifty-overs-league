#!/usr/bin/env node
/* tools/top-end-proof.mjs — IS A 97 ACTUALLY BETTER THAN A 92, AND STILL A
 * DIFFERENT CRICKETER FROM ONE?
 *
 * The world audit counts cards. A card is a claim about cricket, and the only
 * thing that can check it is cricket. This puts ONE cricketer at a stated
 * overall into an otherwise fixed XI, plays hundreds of matches, and reports
 * what he actually did with the bat or the ball.
 *
 * It answers three questions the latent/effective change has to be held to:
 *
 *   SEPARATION   does 85 -> 90 -> 92 -> 95 -> 97 -> 99 keep buying real cricket?
 *                Diminishing returns near the top are wanted. A DEAD top is the
 *                failure - that is what the 99 ceiling produced, and a card that
 *                rises while the cricket does not is a card that lies.
 *
 *   SHAPE        do two men of the SAME overall and different archetypes play
 *                differently? A 95 power hitter and a 95 accumulator should be
 *                worth about the same and should not look remotely alike.
 *
 *   NO ORDINARY-WORLD REGRESSION   do 30, 50, 70 and 80 still do what they did
 *                before any of this existed? Below the knee the transform is the
 *                identity, so this cannot move - and a measurement is worth more
 *                than a proof somebody has to trust.
 *
 *   node tools/top-end-proof.mjs --n=400            # all three
 *   node tools/top-end-proof.mjs --n=400 --json
 *
 * IT CHANGES NOTHING. The XI, the opposition and the seeds are fixed; the only
 * thing that varies between two rows is the one man being asked about.
 */
import vm from 'node:vm';
import { makeEngine } from '../test/engine-vm.mjs';

const arg = (k, d) => {
  const hit = process.argv.find(a => a.startsWith('--' + k + '='));
  return hit ? hit.split('=')[1] : d;
};
const has = k => process.argv.includes('--' + k);
const N = parseInt(arg('n', '300'), 10);
const eng = makeEngine();
eng.setTuning(true);
const say = s => { if (!has('json')) console.log(s); };

// ---------------------------------------------------------------------------
// THE FIXED WORLD. Two ordinary sides at the middle of the engine's range, with
// a real batting order and a real tail, so the only thing separating two rows
// below is the one man who changed.
// ---------------------------------------------------------------------------
vm.runInContext(`
globalThis.__teMan = function (nm, pos, role, bt, sk) {
  var p = { name: nm, age: 27, nat: 'XXX', hand: 'R', role: role,
    bowlTypeFull: bt, exp: 55, formIx: 3, fatigue: 'rested', capt: 50, talents: [],
    skills: { vsPace: 55, vsSpin: 55, power: 52, rotation: 55, temperament: 54,
      wicket: 55, economy: 55, discipline: 55, moveTurn: 55, variation: 55,
      stamina: 55, fielding: 55, catching: 55, keeping: 55, stumping: 55 } };
  for (var k in (sk || {})) p.skills[k] = sk[k];
  jsDerive(p); p.mpos = pos; return p;
};
globalThis.__teSide = function (name) {
  var men = [], i;
  var BAT = [60, 58, 61, 57, 55];
  for (i = 0; i < 5; i++)
    men.push(__teMan(name + '-bat' + i, i + 1, i < 2 ? 'opener' : 'middleOrderBat', 'none',
      { vsPace: BAT[i], vsSpin: BAT[i], rotation: BAT[i], power: BAT[i] - 6 }));
  men.push(__teMan(name + '-wk', 6, 'wicketkeeper', 'none',
    { vsPace: 54, vsSpin: 54, rotation: 54, keeping: 74, stumping: 72, catching: 70 }));
  var TY = ['seamFastMedium', 'seamFast', 'seamMedium', 'fingerSpin', 'wristSpin'];
  var TAIL = [44, 32, 26, 21, 16];
  for (i = 0; i < 5; i++)
    men.push(__teMan(name + '-bowl' + i, 7 + i, TY[i], TY[i],
      { vsPace: TAIL[i], vsSpin: TAIL[i], rotation: TAIL[i], power: TAIL[i] }));
  return { name: name, ground: name + ' Park', players: men };
};
// THE MAN UNDER TEST, dropped into a slot of the fixed side. He is built by the
// world's OWN generator - archetype offsets and all - and then moved onto his
// mark by the engine's own similarity transform, so he is a cricketer the world
// could actually deal rather than a hand-written skill row.
globalThis.__teSwap = function (sideJson, slot, manJson) {
  var t = JSON.parse(sideJson), man = JSON.parse(manJson);
  man.mpos = t.players[slot].mpos;
  man.name = t.players[slot].name;      // the stats are keyed by name
  jsDerive(man);
  t.players[slot] = man;
  return JSON.stringify(t);
};
globalThis.__teRun = function (taJson, tbJson, seed, who) {
  var ta = JSON.parse(taJson), tb = JSON.parse(tbJson);
  onMatchEnd = function () {};
  M = newMatch(ta, tb, 'balanced', (seed >>> 0) || 1);
  M.meta = { home: ta.name, away: tb.name, pitch: 'balanced', weather: 'Sunny',
             comp: 'cal', isUser: false, neutral: true };
  M.isUserMatch = false; M.ordersMap = {};
  App.tossState = { stage: 'x' };
  applyToss(aiTossDecision());
  var g = 0;
  while (M && !M.done && g++ < 4000) { autoPick(); stepBall(); }
  if (!M || !M.done) return null;
  // HIS CARD, out of whichever innings he appeared in
  var out = { r: 0, b: 0, out: 0, inns: 0, f4: 0, f6: 0,
              ballsBowled: 0, runsConceded: 0, wkts: 0, spells: 0 };
  for (var ii = 0; ii < M.innings.length; ii++) {
    var inn = M.innings[ii]; if (!inn) continue;
    for (var j = 0; j < (inn.bat || []).length; j++) {
      var b = inn.bat[j];
      if (!b || !b.p || b.p.name !== who) continue;
      if (b.b > 0 || b.out) { out.inns++; out.r += (+b.r || 0); out.b += (+b.b || 0);
        out.f4 += (+b.f4 || 0); out.f6 += (+b.f6 || 0); if (b.out) out.out++; }
    }
    var br = (inn.bowlers || {})[who];
    if (br && br.b > 0) { out.spells++; out.ballsBowled += br.b;
      out.runsConceded += (+br.r || 0); out.wkts += (+br.w || 0); }
  }
  return JSON.stringify(out);
};
`, eng.ctx);

const mkSide = vm.runInContext('__teSide', eng.ctx);
const swap = vm.runInContext('__teSwap', eng.ctx);
const runM = vm.runInContext('__teRun', eng.ctx);
// the world's own generator, by the name the umpire calls it under
const genSquad = vm.runInContext('__foGenArchetypeSquad', eng.ctx);
const fitToLevel = vm.runInContext('foFitToLevel', eng.ctx);
const levelForOvr = vm.runInContext('foLevelForOvr', eng.ctx);
const pkOvr = vm.runInContext('foOvr', eng.ctx);
const A0 = JSON.stringify(mkSide('A')), B0 = JSON.stringify(mkSide('B'));

// ---------------------------------------------------------------------------
// A CRICKETER OF A NAMED ARCHETYPE AT A NAMED OVERALL. The generator deals many
// men; the first of the wanted kind is taken and fitted to the mark, which keeps
// his shape (the fit is a similarity transform) and makes his card exact.
// ---------------------------------------------------------------------------
const findMan = (archetype, wantOvr, role) => {
  for (let seed = 1; seed < 400; seed++) {
    let sq;
    try { sq = genSquad(7000 + seed, 'England', 'balanced', null, 1, 'd1a'); }
    catch (e) { continue; }
    const men = Array.isArray(sq) ? sq : (sq && sq.players) || [];
    for (const p of men) {
      if (p.arche !== archetype) continue;
      if (role === 'bowl' && !(p.bowlType && p.bowlType !== 'none')) continue;
      if (role === 'bat' && (p.bowlType && p.bowlType !== 'none')) continue;
      const c = JSON.parse(JSON.stringify(p));
      c.age = 27;
      fitToLevel(c, levelForOvr(wantOvr));
      return c;
    }
  }
  return null;
};

function playCareer(man, slot) {
  const side = swap(A0, slot, JSON.stringify(man));
  const who = JSON.parse(side).players[slot].name;
  const t = { r: 0, b: 0, out: 0, inns: 0, f4: 0, f6: 0, fifties: 0, hundreds: 0,
              ballsBowled: 0, runsConceded: 0, wkts: 0, three: 0, five: 0, spells: 0 };
  for (let i = 0; i < N; i++) {
    const flip = i % 2 === 1;
    const j = runM(flip ? B0 : side, flip ? side : B0, (900001 + i * 104729) >>> 0, who);
    if (!j) continue;
    const r = JSON.parse(j);
    t.r += r.r; t.b += r.b; t.out += r.out; t.inns += r.inns;
    t.f4 += r.f4; t.f6 += r.f6;
    if (r.inns && r.r >= 50) t.fifties++;
    if (r.inns && r.r >= 100) t.hundreds++;
    t.ballsBowled += r.ballsBowled; t.runsConceded += r.runsConceded;
    t.wkts += r.wkts; t.spells += r.spells;
    if (r.wkts >= 3) t.three++;
    if (r.wkts >= 5) t.five++;
  }
  return t;
}

const batLine = t => ({
  inns: t.inns,
  avg: t.out ? t.r / t.out : (t.r || 0),
  sr: t.b ? 100 * t.r / t.b : 0,
  bdry: t.b ? 100 * (t.f4 + t.f6) / t.b : 0,
  dis: t.inns ? 100 * t.out / t.inns : 0,
  fifties: t.inns ? 100 * t.fifties / t.inns : 0,
  hundreds: t.inns ? 100 * t.hundreds / t.inns : 0
});
const bowlLine = t => ({
  spells: t.spells,
  avg: t.wkts ? t.runsConceded / t.wkts : null,
  econ: t.ballsBowled ? 6 * t.runsConceded / t.ballsBowled : 0,
  sr: t.wkts ? t.ballsBowled / t.wkts : null,
  wpm: t.spells ? t.wkts / t.spells : 0,
  three: t.spells ? 100 * t.three / t.spells : 0,
  five: t.spells ? 100 * t.five / t.spells : 0
});
const f = (x, n = 2, w = 8) => (x == null || !isFinite(x) ? '-'.padStart(w) : x.toFixed(n).padStart(w));

const out = { n: N, separation: {}, shape: {}, ordinary: {} };

// ---------------------------------------------------------------------------
// 1. SEPARATION. The same archetype, walked up the card.
// ---------------------------------------------------------------------------
const LADDER = [85, 90, 92, 95, 97, 99];
say(`\n=== SEPARATION: THE SAME CRICKETER, WALKED UP THE CARD (${N} matches a row) ===`);
say('The archetype is held; only the mark moves. Diminishing returns near the top');
say('are wanted; a dead top is the failure this whole change was made against.\n');

say('  BATSMAN (technician), batting four');
say('  ovr  actual  latent>99      avg      SR   bdry%    dis%    50s%   100s%');
for (const want of LADDER) {
  const man = findMan('technician', want, 'bat');
  if (!man) { say('  ' + want + '  (no man found)'); continue; }
  const tall = Object.values(man.skills).filter(v => v > 99).length;
  const t = playCareer(man, 3);
  const L = batLine(t);
  out.separation['bat' + want] = { ovr: pkOvr(man), tall, ...L };
  say('  ' + String(want).padEnd(4) + String(pkOvr(man)).padStart(6) + String(tall).padStart(11) +
      f(L.avg) + f(L.sr, 1) + f(L.bdry) + f(L.dis, 1) + f(L.fifties, 1) + f(L.hundreds, 1));
}

say('\n  BOWLER (strike quick), opening the attack');
say('  ovr  actual  latent>99      avg    econ      SR    w/inn     3fer%    5fer%');
for (const want of LADDER) {
  const man = findMan('strikeQuick', want, 'bowl');
  if (!man) { say('  ' + want + '  (no man found)'); continue; }
  const tall = Object.values(man.skills).filter(v => v > 99).length;
  const t = playCareer(man, 6);
  const L = bowlLine(t);
  out.separation['bowl' + want] = { ovr: pkOvr(man), tall, ...L };
  say('  ' + String(want).padEnd(4) + String(pkOvr(man)).padStart(6) + String(tall).padStart(11) +
      f(L.avg) + f(L.econ) + f(L.sr, 1) + f(L.wpm) + f(L.three, 1) + f(L.five, 1));
}

// ---------------------------------------------------------------------------
// 2. SHAPE. Same overall, different cricketers.
// ---------------------------------------------------------------------------
say('\n=== SHAPE: THE SAME OVERALL, DIFFERENT CRICKETERS ===');
say('Similar value, and they must not look alike.\n');
say('  BATTING ARCHETYPES AT 95');
say('  archetype            avg      SR   bdry%    dis%    50s%   100s%');
for (const a of ['powerHitter', 'accumulator', 'technician', 'paceSpecialist']) {
  const man = findMan(a, 95, 'bat');
  if (!man) continue;
  const L = batLine(playCareer(man, 3));
  out.shape['bat:' + a] = L;
  say('  ' + a.padEnd(18) + f(L.avg) + f(L.sr, 1) + f(L.bdry) + f(L.dis, 1) + f(L.fifties, 1) + f(L.hundreds, 1));
}
say('\n  BOWLING ARCHETYPES AT 95');
say('  archetype            avg    econ      SR    w/inn     3fer%    5fer%');
for (const a of ['strikeQuick', 'controller', 'wildQuick', 'mystery', 'bigTurner']) {
  const man = findMan(a, 95, 'bowl');
  if (!man) continue;
  const L = bowlLine(playCareer(man, 6));
  out.shape['bowl:' + a] = L;
  say('  ' + a.padEnd(18) + f(L.avg) + f(L.econ) + f(L.sr, 1) + f(L.wpm) + f(L.three, 1) + f(L.five, 1));
}

// ---------------------------------------------------------------------------
// 3. NO ORDINARY-WORLD REGRESSION.
// ---------------------------------------------------------------------------
say('\n=== ORDINARY WORLD: 30, 50, 70, 80 ===');
say('Below the knee the latent transform is the identity, so these cannot have');
say('moved. Measured anyway, because a proof is worth less than a number.\n');
say('  BATSMAN (technician)');
say('  ovr  latent>99      avg      SR   bdry%    dis%');
for (const want of [30, 50, 70, 80]) {
  const man = findMan('technician', want, 'bat');
  if (!man) continue;
  const tall = Object.values(man.skills).filter(v => v > 99).length;
  const L = batLine(playCareer(man, 3));
  out.ordinary['bat' + want] = { tall, ...L };
  say('  ' + String(want).padEnd(4) + String(tall).padStart(10) +
      f(L.avg) + f(L.sr, 1) + f(L.bdry) + f(L.dis, 1));
}
say('\n  BOWLER (strike quick)');
say('  ovr  latent>99      avg    econ      SR    w/inn');
for (const want of [30, 50, 70, 80]) {
  const man = findMan('strikeQuick', want, 'bowl');
  if (!man) continue;
  const tall = Object.values(man.skills).filter(v => v > 99).length;
  const L = bowlLine(playCareer(man, 6));
  out.ordinary['bowl' + want] = { tall, ...L };
  say('  ' + String(want).padEnd(4) + String(tall).padStart(10) +
      f(L.avg) + f(L.econ) + f(L.sr, 1) + f(L.wpm));
}

if (has('json')) console.log(JSON.stringify(out, null, 1));
