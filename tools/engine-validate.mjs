#!/usr/bin/env node
/* tools/engine-validate.mjs — DOES THE MODEL SURVIVE A WHOLE INNINGS?
 *
 * ball-probe.mjs reads one delivery exactly; strength-response.mjs plays whole
 * XIs against whole XIs. Between the two there is a question neither answers:
 * what does ONE CRICKETER's career look like, and do two men of the same worth
 * but different shape actually play different cricket?
 *
 * That question cannot be asked of a single delivery, because an innings is a
 * sequence and the things that matter most - getting set, tiring, a spell
 * lengthening, a partnership building - only exist across balls. And it cannot
 * be asked of two XIs, because everything moves at once.
 *
 * So this plays real matches with SURGICALLY controlled squads: one man is
 * changed, everything else is held, and his own scorecard lines are collected
 * over hundreds of innings.
 *
 *   node tools/engine-validate.mjs --careers      # §23 long-run skill curves
 *   node tools/engine-validate.mjs --archetypes   # §24 player identity
 *   node tools/engine-validate.mjs --physical     # §25 form/fatigue/stamina/exp
 *   node tools/engine-validate.mjs --fielding     # §31 fielding and keeping
 *   node tools/engine-validate.mjs --dists        # §29/§30 tails and extremes
 *   node tools/engine-validate.mjs --perf         # §32 speed
 *   node tools/engine-validate.mjs --all --n=300
 *
 * IT CHANGES NOTHING: every number is read out of the built index.html in a VM.
 */
import vm from 'node:vm';
import { makeEngine } from '../test/engine-vm.mjs';

const has = k => process.argv.includes('--' + k) || process.argv.includes('--all');
const arg = (k, d) => {
  const hit = process.argv.find(a => a.startsWith('--' + k + '='));
  return hit ? hit.split('=')[1] : d;
};
const N = parseInt(arg('n', '200'), 10);
const eng = makeEngine();
eng.setTuning(true);
if (arg('cal', '')) {
  const p = {};
  for (const kv of arg('cal', '').split(',')) { const [k, v] = kv.split(':'); if (k && v != null) p[k.trim()] = Number(v); }
  eng.applyCal(p);
}

// ---------------------------------------------------------------------------
// A SQUAD OF ELEVEN ORDINARY CRICKETERS, and one of them made to order.
//
// The eleven are IDENTICAL to each other on purpose. A baked reference squad
// has a shape - openers, a tail - and that shape moves the answer: a man batting
// at three in a good side faces different cricket from the same man at three in
// a bad one. Holding the other ten flat means the only thing that varies
// between two runs of this harness is the thing being varied.
// ---------------------------------------------------------------------------
vm.runInContext(`
globalThis.__evMan = function (nm, pos, role, bt, sk, extra) {
  var p = { name: nm, age: 28, nat: 'XXX', hand: 'R', role: role,
    bowlTypeFull: bt, exp: 55, formIx: 3, fatigue: 'rested', capt: 50,
    talents: [], trainFocus: 'none',
    skills: { vsPace: 55, vsSpin: 55, power: 50, rotation: 55, temperament: 52,
      wicket: 55, economy: 55, discipline: 55, moveTurn: 55, variation: 55,
      stamina: 55, fielding: 55, catching: 55, keeping: 55, stumping: 55 } };
  for (var k in (sk || {})) p.skills[k] = sk[k];
  for (var k2 in (extra || {})) p[k2] = extra[k2];
  jsDerive(p);
  p.mpos = pos;
  return p;
};
// ELEVEN MEN, AND A TAIL, because both of those matter and the first attempt at
// this harness had neither.
//
// TWELVE MEN IS A BUG, not a rounding error: pickXI() takes eleven, and with the
// other ten identical the one it drops is whichever is WORST - so the run that
// asked "what does a level-50 batsman do" measured a level-50 batsman who was
// left out, and reported nought innings. Eleven exactly, and nobody is dropped.
//
// AND A HOMOGENEOUS SIDE IS NOT A CRICKET TEAM. Eleven identical batsmen never
// run out of partners, so the side bats fifty overs, half of them finish not out
// and every average comes back near a hundred. The batting therefore declines
// down the order the way a real one does; the numbers below are then in the
// range a scorecard actually produces, and can be read as cricket rather than
// only as a ranking.
globalThis.__evSide = function (name, sk, extra) {
  var men = [], i;
  // five specialist batsmen and a keeper who bats
  var BATLVL = [58, 57, 58, 56, 54, 50];
  for (i = 0; i < 5; i++)
    men.push(__evMan(name + '-bat' + i, i + 1, i < 2 ? 'opener' : 'middleOrderBat', 'none',
      Object.assign({ vsPace: BATLVL[i], vsSpin: BATLVL[i], rotation: BATLVL[i] }, sk || {}), extra));
  men.push(__evMan(name + '-wk', 6, 'wicketkeeper', 'none',
    Object.assign({ vsPace: 54, vsSpin: 54, keeping: 74, stumping: 70, catching: 65 }, sk || {}), extra));
  // and five bowlers, who bat like bowlers
  var TY = ['seamFastMedium', 'seamFast', 'seamMedium', 'fingerSpin', 'wristSpin'];
  var TAIL = [42, 30, 24, 20, 15];
  for (i = 0; i < 5; i++)
    men.push(__evMan(name + '-bowl' + i, 7 + i, TY[i], TY[i],
      Object.assign({ vsPace: TAIL[i], vsSpin: TAIL[i], rotation: TAIL[i], power: TAIL[i] }, sk || {}), extra));
  return { name: name, ground: name + ' Park', players: men };
};
// REPLACE ONE MAN. The subject takes an existing slot so the side is still
// eleven men in the same order; only his card changes.
globalThis.__evSub = function (side, slot, sk, extra) {
  var t = JSON.parse(JSON.stringify(side));
  var p = t.players[slot];
  for (var k in (sk || {})) p.skills[k] = sk[k];
  for (var k2 in (extra || {})) p[k2] = extra[k2];
  jsDerive(p);
  return t;
};
// ONE MATCH, and every scorecard line in it.
globalThis.__evRun = function (ta, tb, seed, pitch, weather) {
  onMatchEnd = function () {};
  M = newMatch(ta, tb, pitch || 'balanced', (seed >>> 0) || 1);
  M.meta = { home: ta.name, away: tb.name, pitch: pitch || 'balanced',
             weather: weather || 'Sunny', comp: 'cal', isUser: false, neutral: true };
  M.isUserMatch = false; M.ordersMap = {};
  App.tossState = { stage: 'x' };
  applyToss(aiTossDecision());
  var g = 0;
  while (M && !M.done && g++ < 4000) { autoPick(); stepBall(); }
  if (!M || !M.done) return null;
  var out = { innings: [] };
  for (var i = 0; i < 2; i++) {
    var inn = M.innings[i]; if (!inn) continue;
    out.innings.push({
      team: inn.batTeam, runs: inn.runs, wkts: inn.wkts, legal: inn.legal,
      bat: (inn.bat || []).map(function (b) {
        return { n: b.p.name, r: b.r || 0, b: b.b || 0, out: !!b.out, how: b.how || '' }; }),
      bowl: Object.keys(inn.bowlers || {}).map(function (k) {
        var br = inn.bowlers[k];
        return { n: k, b: br.b || 0, r: br.r || 0, w: br.w || 0 }; })
    });
  }
  out.winner = M.result ? M.result.winner : null;
  // how each dismissal came about, over the whole match - the fielding side of it
  out.hows = [];
  out.innings.forEach(function (I) { I.bat.forEach(function (b) { if (b.out) out.hows.push(b.how); }); });
  return JSON.stringify(out);
};
`, eng.ctx);

const mkSide = vm.runInContext('__evSide', eng.ctx);
const sub = vm.runInContext('__evSub', eng.ctx);
const run = vm.runInContext('__evRun', eng.ctx);

const mean = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const r2 = x => Math.round(x * 100) / 100;
const pc = (xs, f) => { if (!xs.length) return 0; const s = xs.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };
const say = s => console.log(s);

// ---------------------------------------------------------------------------
// COLLECT ONE MAN'S CAREER. `slot` is which of the eleven he is; both sides are
// otherwise the ordinary side, and the two halves of the sample swap home and
// away so the ground cannot be mistaken for the man.
// ---------------------------------------------------------------------------
function career(sk, slot, n, seed0, opts) {
  opts = opts || {};
  const base = mkSide('A', opts.baseSkills || null, opts.baseExtra || null);
  const foe = mkSide('B', opts.foeSkills || null, opts.foeExtra || null);
  const A = sub(base, slot, sk, opts.extra || null);
  const nm = A.players[slot].name;
  const bat = [], bowl = [];
  for (let i = 0; i < n; i++) {
    const j = run(i % 2 ? foe : A, i % 2 ? A : foe, (seed0 + i * 7919) >>> 0,
      opts.pitch || 'balanced', opts.weather || 'Sunny');
    if (!j) continue;
    const r = JSON.parse(j);
    for (const I of r.innings) {
      for (const b of I.bat) if (b.n === nm && (b.b > 0 || b.out)) bat.push(b);
      for (const b of I.bowl) if (b.n === nm && b.b > 0) bowl.push(b);
    }
  }
  const runs = bat.reduce((a, b) => a + b.r, 0), balls = bat.reduce((a, b) => a + b.b, 0);
  const outs = bat.filter(b => b.out).length;
  const bb = bowl.reduce((a, b) => a + b.b, 0), br = bowl.reduce((a, b) => a + b.r, 0), bw = bowl.reduce((a, b) => a + b.w, 0);
  return {
    inns: bat.length,
    avg: outs ? r2(runs / outs) : null, sr: balls ? r2(100 * runs / balls) : null,
    hs: bat.reduce((a, b) => Math.max(a, b.r), 0),
    fifties: r2(100 * bat.filter(b => b.r >= 50 && b.r < 100).length / Math.max(1, bat.length)),
    hundreds: r2(100 * bat.filter(b => b.r >= 100).length / Math.max(1, bat.length)),
    ducks: r2(100 * bat.filter(b => b.r === 0 && b.out).length / Math.max(1, bat.length)),
    ovs: r2(bb / 6), bowlAvg: bw ? r2(br / bw) : null,
    econ: bb ? r2(br / (bb / 6)) : null, bowlSr: bw ? r2(bb / bw) : null,
    wpm: r2(bw / Math.max(1, bowl.length)),
    threeW: r2(100 * bowl.filter(b => b.w >= 3).length / Math.max(1, bowl.length)),
    fourW: r2(100 * bowl.filter(b => b.w >= 4).length / Math.max(1, bowl.length)),
    fiveW: r2(100 * bowl.filter(b => b.w >= 5).length / Math.max(1, bowl.length))
  };
}


// EVERY SKILL MOVED BY THE SAME NUMBER OF POINTS, so the XI keeps its shape -
// its tail stays a tail and its opening bowler stays its opening bowler - and
// only the standard of cricket changes. Clamped at 1 and 97 so a base of 75
// plus a gap of 20 still has room above it and nothing piles onto the ceiling.
const ALLSK = ['vsPace', 'vsSpin', 'power', 'rotation', 'temperament', 'wicket',
  'economy', 'discipline', 'moveTurn', 'variation', 'stamina',
  'fielding', 'catching', 'keeping', 'stumping'];
function shiftAll(level) {
  const d = level - 55, o = {};
  // the per-man defaults in __evMan are all 55 except power (50) and
  // temperament (52); the side builder overrides the batting ones per slot, so
  // this shift composes with those and the order survives
  for (const k of ALLSK) o[k] = Math.max(1, Math.min(97, 55 + d));
  o.power = Math.max(1, Math.min(97, 50 + d));
  o.temperament = Math.max(1, Math.min(97, 52 + d));
  return o;
}

const BATHEAD = ' inns   avg     sr    hs   50%   100%  duck%';
const batline = (l, c) => `${String(l).padEnd(22)}${String(c.inns).padStart(5)}${String(c.avg).padStart(6)}${String(c.sr).padStart(7)}${String(c.hs).padStart(6)}${String(c.fifties).padStart(6)}${String(c.hundreds).padStart(7)}${String(c.ducks).padStart(7)}`;
const BOWLHEAD = '  ovs   avg   econ     sr   w/inn   3w%   4w%   5w%';
const bowlline = (l, c) => `${String(l).padEnd(22)}${String(c.ovs).padStart(5)}${String(c.bowlAvg).padStart(6)}${String(c.econ).padStart(7)}${String(c.bowlSr).padStart(7)}${String(c.wpm).padStart(8)}${String(c.threeW).padStart(6)}${String(c.fourW).padStart(6)}${String(c.fiveW).padStart(6)}`;

const LEVELS = [50, 60, 70, 80, 85, 90, 95];

// ---- §23 CAREER CURVES ----------------------------------------------------
if (has('careers')) {
  say('\n=== §23 BATTING: one man at slot 3, the other 21 held at 55 ===');
  say('skill'.padEnd(22) + BATHEAD);
  for (const L of LEVELS)
    say(batline('vsPace/vsSpin ' + L, career({ vsPace: L, vsSpin: L }, 2, N, 11000 + L * 13)));
  say('\n=== §23 BOWLING: one man at slot 7 (the opening bowler), the rest held at 55 ===');
  say('skill'.padEnd(22) + BOWLHEAD);
  for (const L of LEVELS)
    say(bowlline('wicket ' + L, career({ wicket: L }, 6, N, 22000 + L * 13)));
  say('');
  for (const L of LEVELS)
    say(bowlline('economy ' + L, career({ economy: L }, 6, N, 23000 + L * 13)));
  say('');
  for (const L of LEVELS)
    say(bowlline('wicket+economy ' + L, career({ wicket: L, economy: L }, 6, N, 24000 + L * 13)));
}

// ---- §24 ARCHETYPES -------------------------------------------------------
if (has('archetypes')) {
  say('\n=== §24 BATTING IDENTITY: same total, different shape ===');
  say('player'.padEnd(22) + BATHEAD);
  const P = [
    ['power 90 / rot 55', { power: 90, rotation: 55 }],
    ['power 55 / rot 90', { power: 55, rotation: 90 }],
    ['temperament 90/tec55', { temperament: 90, vsPace: 55, vsSpin: 55 }],
    ['temperament 30/tec55', { temperament: 30, vsPace: 55, vsSpin: 55 }],
    ['tec 80 / temper 30', { vsPace: 80, vsSpin: 80, temperament: 30 }],
    ['tec 60 / temper 85', { vsPace: 60, vsSpin: 60, temperament: 85 }]
  ];
  for (const [l, sk] of P) say(batline(l, career(sk, 2, N, 31000 + l.length * 977)));
  say('\n=== §24 BOWLING IDENTITY ===');
  say('player'.padEnd(22) + BOWLHEAD);
  const B = [
    ['wkt 90 / econ 60', { wicket: 90, economy: 60 }],
    ['wkt 60 / econ 90', { wicket: 60, economy: 90 }],
    ['move 90 / vary 50', { moveTurn: 90, variation: 50 }],
    ['move 50 / vary 90', { moveTurn: 50, variation: 90 }],
    ['wild: w85 m85 d20', { wicket: 85, moveTurn: 85, discipline: 20 }],
    ['pro:  w65 m65 d90', { wicket: 65, moveTurn: 65, discipline: 90 }]
  ];
  for (const [l, sk] of B) say(bowlline(l, career(sk, 6, N, 41000 + l.length * 977)));
}

// ---- §25 PHYSICAL STATE ---------------------------------------------------
if (has('physical')) {
  say('\n=== §25 STAMINA: the same bowler, different tank (slot 8, fast) ===');
  say('stamina'.padEnd(22) + BOWLHEAD);
  for (const v of [30, 50, 70, 90])
    say(bowlline('stamina ' + v, career({ stamina: v }, 6, N, 51000 + v * 13)));
  say('\n=== §25 FATIGUE CARRIED IN (the word off his card) ===');
  say('state'.padEnd(22) + BOWLHEAD);
  for (const f of ['rested', 'moderate', 'weary', 'exhausted'])
    say(bowlline(f, career({}, 6, N, 52000 + f.length * 131, { extra: { fatigue: f } })));
  say('\n=== §25 FORM, off the WORD (the serialisation that was dead) ===');
  say('form'.padEnd(22) + BATHEAD);
  for (const f of ['abysmal', 'shaky', 'steady', 'good', 'excellent'])
    say(batline(f, career({}, 2, N, 53000 + f.length * 131, { extra: { formWord: f, formIx: undefined } })));
  say('\n=== §25 EXPERIENCE ===');
  say('exp'.padEnd(22) + BATHEAD);
  for (const e of [10, 40, 70, 99])
    say(batline('exp ' + e, career({}, 2, N, 54000 + e * 13, { extra: { exp: e } })));
}

// ---- §31 FIELDING AND KEEPING --------------------------------------------
// The subject is the whole FIELDING SIDE this time: a catch is taken by whoever
// is under it, so moving one man in eleven is mostly invisible. Both sides get
// the same fielding standard and the count is of how the batting side got out.
if (has('fielding')) {
  say('\n=== §31 FIELDING: how the wickets fell, by the standard of the field ===');
  say('level'.padEnd(22) + '  caught%  runout%   stump%   bowled%  lbw%   wkts/inn  runs/inn');
  const tally = (sk, seed) => {
    const A = mkSide('A', sk), B = mkSide('B', sk);
    const H = {}; let n = 0, wk = 0, runs = 0, inn = 0;
    for (let i = 0; i < N; i++) {
      const j = run(i % 2 ? B : A, i % 2 ? A : B, (seed + i * 7919) >>> 0);
      if (!j) continue;
      const r = JSON.parse(j);
      for (const h of r.hows) { H[h] = (H[h] || 0) + 1; n++; }
      for (const I of r.innings) { wk += I.wkts; runs += I.runs; inn++; }
    }
    const sh = k => r2(100 * (H[k] || 0) / Math.max(1, n));
    return { c: sh('c'), ro: sh('run out'), st: sh('st'), b: sh('b'), lbw: sh('lbw'),
      wpi: r2(wk / Math.max(1, inn)), rpi: r2(runs / Math.max(1, inn)) };
  };
  for (const v of [30, 50, 70, 85, 95]) {
    const t = tally({ fielding: v, catching: v, keeping: v, stumping: v }, 61000 + v * 13);
    say(`all glove+field ${String(v).padEnd(7)}${String(t.c).padStart(8)}${String(t.ro).padStart(9)}${String(t.st).padStart(9)}${String(t.b).padStart(10)}${String(t.lbw).padStart(6)}${String(t.wpi).padStart(11)}${String(t.rpi).padStart(10)}`);
  }
  say('');
  for (const v of [30, 95]) {
    const t = tally({ catching: v }, 62000 + v * 13);
    say(`catching only ${String(v).padEnd(9)}${String(t.c).padStart(8)}${String(t.ro).padStart(9)}${String(t.st).padStart(9)}${String(t.b).padStart(10)}${String(t.lbw).padStart(6)}${String(t.wpi).padStart(11)}${String(t.rpi).padStart(10)}`);
  }
  for (const v of [30, 95]) {
    const t = tally({ fielding: v }, 63000 + v * 13);
    say(`ground only ${String(v).padEnd(11)}${String(t.c).padStart(8)}${String(t.ro).padStart(9)}${String(t.st).padStart(9)}${String(t.b).padStart(10)}${String(t.lbw).padStart(6)}${String(t.wpi).padStart(11)}${String(t.rpi).padStart(10)}`);
  }
  for (const v of [30, 95]) {
    const t = tally({ stumping: v }, 64000 + v * 13);
    say(`stumping only ${String(v).padEnd(9)}${String(t.c).padStart(8)}${String(t.ro).padStart(9)}${String(t.st).padStart(9)}${String(t.b).padStart(10)}${String(t.lbw).padStart(6)}${String(t.wpi).padStart(11)}${String(t.rpi).padStart(10)}`);
  }
}

// ---- §29/§30 THE SHAPE OF AN INNINGS, NOT ITS MIDDLE ----------------------
if (has('dists')) {
  say('\n=== §29 SCORE DISTRIBUTIONS (first innings, both sides equal) ===');
  say('level'.padEnd(14) + '  min   p01   p05   p25   p50   p75   p95   p99   max  <50%  <100% >300% >350% >400%');
  for (const [lbl, sk, pitch] of [
    ['weak 35', { vsPace: 35, vsSpin: 35, power: 35, rotation: 35, temperament: 35, wicket: 35, economy: 35, discipline: 35, moveTurn: 35, variation: 35, stamina: 35, fielding: 35, catching: 35, keeping: 35, stumping: 35 }, 'balanced'],
    ['ordinary 55', {}, 'balanced'],
    ['strong 75', { vsPace: 75, vsSpin: 75, power: 75, rotation: 75, temperament: 75, wicket: 75, economy: 75, discipline: 75, moveTurn: 75, variation: 75, stamina: 75, fielding: 75, catching: 75, keeping: 75, stumping: 75 }, 'balanced'],
    ['strong 75 flat', { vsPace: 75, vsSpin: 75, power: 75, rotation: 75, temperament: 75, wicket: 75, economy: 75, discipline: 75, moveTurn: 75, variation: 75, stamina: 75, fielding: 75, catching: 75, keeping: 75, stumping: 75 }, 'flat'],
    ['ordinary 55 green', {}, 'green'],
    ['bat 80 v bowl 40', { vsPace: 80, vsSpin: 80, power: 80, rotation: 80, temperament: 80 }, 'flat']
  ]) {
    const A = mkSide('A', sk), B = mkSide('B', lbl.startsWith('bat 80') ? { wicket: 40, economy: 40, discipline: 40, moveTurn: 40, variation: 40 } : sk);
    const s1 = [];
    for (let i = 0; i < N * 3; i++) {
      const j = run(i % 2 ? B : A, i % 2 ? A : B, (71000 + lbl.length * 977 + i * 7919) >>> 0, pitch);
      if (!j) continue;
      const r = JSON.parse(j);
      if (r.innings[0]) s1.push(r.innings[0].runs);
    }
    const sh = f => r2(100 * s1.filter(f).length / Math.max(1, s1.length));
    say(String(lbl).padEnd(14) +
      [Math.min(...s1), pc(s1, .01), pc(s1, .05), pc(s1, .25), pc(s1, .50), pc(s1, .75), pc(s1, .95), pc(s1, .99), Math.max(...s1)]
        .map(v => String(v).padStart(6)).join('') +
      [sh(v => v < 50), sh(v => v < 100), sh(v => v > 300), sh(v => v > 350), sh(v => v > 400)]
        .map(v => String(v).padStart(6)).join(''));
  }
}

// ---- §32 PERFORMANCE ------------------------------------------------------
if (has('perf')) {
  const A = mkSide('A'), B = mkSide('B');
  const t0 = process.hrtime.bigint();
  let k = 0;
  for (let i = 0; i < 200; i++) if (run(A, B, (81000 + i * 7919) >>> 0)) k++;
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  say(`\n=== §32 PERFORMANCE ===\n  ${k} full 50-over matches in ${ms.toFixed(0)} ms = ${(ms / k).toFixed(1)} ms/match, ${(1000 * k / ms).toFixed(0)} matches/sec`);
}

// ---- §21/§22 THE RESPONSE TO A REAL SKILL GAP -----------------------------
//
// THIS IS THE MEASUREMENT THAT SETTLES THE HIGH END, and it exists because the
// obvious one lies. strength-response.mjs's LEVEL coordinate shifts every skill
// additively and then clamps at 1-99, so at L=85 about 36% of a squad's skills
// are already pinned on the ceiling and at L=95 about half are. A "ten point"
// step from L=85 to L=95 is therefore NOT ten points of cricket: measured off
// the squads themselves it is 4.5 points of batting and 3.3 of bowling. Any
// flatness seen up there is the coordinate running out of room, and reading it
// as engine saturation is how the last three sessions came to believe in a
// high-end dead zone.
//
// So this varies the skills DIRECTLY, by a stated number of points, at several
// base levels, and never goes near the ceiling. If a ten-point gap is worth
// about the same at base 40 as at base 80, the engine's relative response is
// scale-free and the earlier reading was the harness.
if (has('gaps')) {
  say('\n=== §22 WIN RATE FOR A REAL SKILL GAP, at several standards ===');
  say('  (both sides identical except the stated points; ground alternates)');
  say('base'.padEnd(8) + (arg('gaps2','0,5,10,15,20')).split(',').map(x => ('gap ' + x).padStart(9)).join(''));
  const ALL = ['vsPace', 'vsSpin', 'power', 'rotation', 'temperament', 'wicket',
    'economy', 'discipline', 'moveTurn', 'variation', 'stamina',
    'fielding', 'catching', 'keeping', 'stumping'];
  const at = d => { const o = {}; for (const k of ALL) o[k] = d; return o; };
  const BASES = (arg('bases','35,50,65,75')).split(',').map(Number);
  const GAPS = (arg('gaps2','0,5,10,15,20')).split(',').map(Number);
  for (const base of BASES) {
    const row = [];
    for (const gap of GAPS) {
      // the sides are built by SHIFTING the harness's own ordinary man, so the
      // XI keeps its batting order and its tail at every base
      const A = mkSide('A', shiftAll(base)), B = mkSide('B', shiftAll(base + gap));
      let bw = 0, n = 0;
      for (let i = 0; i < N; i++) {
        const j = run(i % 2 ? B : A, i % 2 ? A : B, (91000 + base * 101 + gap * 7919 + i * 104729) >>> 0);
        if (!j) continue;
        const r = JSON.parse(j); n++;
        if (r.winner === 'B') bw++; else if (!r.winner) bw += 0.5;
      }
      row.push(r2(100 * bw / Math.max(1, n)));
    }
    say(String(base).padEnd(8) + row.map(v => String(v).padStart(9)).join(''));
  }
}
