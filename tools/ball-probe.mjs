#!/usr/bin/env node
/* tools/ball-probe.mjs — WHAT DOES ONE DELIVERY ACTUALLY LOOK LIKE?
 *
 * strength-response.mjs plays whole matches, which is the only honest way to
 * ask who wins. But a match is three hundred deliveries deep and every term in
 * the ball model is buried under the ones after it, so when a skill does
 * nothing a match sample says only "nothing moved" and never says why.
 *
 * This calls ballDist DIRECTLY, in the shipped build, with two synthetic
 * cricketers whose every skill the caller names. It returns the probability of
 * each outcome on that one delivery. No dice are rolled: ballDist is a pure
 * function of its arguments, so these numbers are exact rather than sampled,
 * and a sweep of one skill against a fixed opponent is the derivative of the
 * engine with respect to that skill. That is the instrument §20 of the brief
 * asks for, and it costs milliseconds instead of hours.
 *
 *   node tools/ball-probe.mjs --grid          # the batter-v-bowler grid (§21)
 *   node tools/ball-probe.mjs --sweep         # every attribute, 30..95 (§20)
 *   node tools/ball-probe.mjs --context       # chase and first-innings intent
 *   node tools/ball-probe.mjs --conditions    # skill x pitch x weather
 *   node tools/ball-probe.mjs --json          # machine-readable
 *
 * IT CHANGES NOTHING. Like strength-response.mjs this is a reader, not an
 * opinion: every number is read out of the built index.html in a VM.
 */
import vm from 'node:vm';
import { makeEngine } from '../test/engine-vm.mjs';

const has = k => process.argv.includes('--' + k);
const arg = (k, d) => {
  const hit = process.argv.find(a => a.startsWith('--' + k + '='));
  return hit ? hit.split('=')[1] : d;
};

const eng = makeEngine();
eng.setTuning(true);

// ---------------------------------------------------------------------------
// A CRICKETER MADE TO ORDER. Every skill defaults to 50 so that a sweep of one
// of them is a sweep of one of them - anything left unnamed is the same on both
// sides of the comparison and cannot contribute to the difference.
//
// jsDerive is the build's OWN mapping from the fifteen card skills to the seven
// numbers the ball model reads, so a probe player is derived exactly the way a
// real one is. Nothing here duplicates that arithmetic.
// ---------------------------------------------------------------------------
vm.runInContext(`
globalThis.__bpMake = function (over, spec) {
  var p = {
    name: spec.name || 'probe', age: spec.age == null ? 28 : spec.age,
    hand: spec.hand || 'R', nat: 'XXX', role: spec.role || 'middleOrderBat',
    bowlTypeFull: spec.bowlTypeFull || 'none',
    exp: spec.exp == null ? 55 : spec.exp,
    formIx: spec.formIx, formWord: spec.formWord,
    fatigue: spec.fatigue || 'rested',
    capt: spec.capt == null ? 50 : spec.capt,
    talents: spec.talents || [],
    skills: {
      vsPace: 50, vsSpin: 50, power: 50, rotation: 50, temperament: 50,
      wicket: 50, economy: 50, discipline: 50, moveTurn: 50, variation: 50,
      stamina: 50, fielding: 50, catching: 50, keeping: 50, stumping: 50
    }
  };
  for (var k in (spec.skills || {})) p.skills[k] = spec.skills[k];
  jsDerive(p);
  return p;
};

// ONE DELIVERY, AS THE ENGINE SEES IT. The context is the same object shape
// the innings loop builds at engine/src/00-core.js's stepBall; anything the
// caller does not name takes the value an ordinary middle-over delivery has.
// AND WHAT THE CAPTAIN WOULD ACTUALLY DO. §27 is a question about aiIntent, not
// about ballDist: the whole point is that the SITUATION picks the risk. Handing
// the probe a fixed intent would test nothing at all, so a synthetic innings is
// built with exactly the fields aiIntent reads and the engine's own function is
// asked what it wants.
globalThis.__bpIntent = function (o) {
  var faced = o.setFaced == null ? 30 : o.setFaced;
  var inn = {
    legal: (o.over || 0) * 6, wkts: o.wkts || 0, runs: o.runs || 0,
    since: o.since == null ? 20 : o.since, batTeam: 'BAT',
    striker: 0, bat: [{ p: { name: 'S' } }], faced: { S: faced }
  };
  M = { target: o.target || null, inns: o.target ? 1 : 0,
        pitch: o.pitch || 'balanced', rand: function () { return 0.5; } };
  var v = aiIntent(inn);
  M = null;
  return v;
};

globalThis.__bpDist = function (bat, bowl, o) {
  o = o || {};
  var over = o.over == null ? 25 : o.over;
  var ph = o.ph || (over < 10 ? 'pp' : (over >= 40 ? 'death' : 'mid'));
  var ctx = {
    weather: o.weather || 'sunny', pship: o.pship || 0, chase: !!o.chase,
    bballs: o.bballs == null ? 12 : o.bballs,
    ballsThisSpell: o.ballsThisSpell || 0,
    wkts: o.wkts || 0,
    ballsLeft: o.ballsLeft == null ? Math.max(0, 300 - over * 6) : o.ballsLeft,
    reqRate: o.reqRate || 0,
    fieldAvg: o.fieldAvg || 0, keeperQuality: o.keeperQuality || 0,
    keeperStump: o.keeperStump == null ? null : o.keeperStump,
    keeperCatch: o.keeperCatch == null ? null : o.keeperCatch,
    rocketArms: 0, lightningKeeper: false, mixed: !!o.mixed,
    batFat: o.batFat || 0, bowlFat: o.bowlFat || 0,
    captBowl: o.captBowl == null ? 50 : o.captBowl,
    captBat: o.captBat == null ? 50 : o.captBat,
    freeHit: !!o.freeHit, homeSide: o.homeSide || null
  };
  // M is read by foTuneDist (for the innings number) and nothing else in the
  // ball model; a stub is enough and keeps the probe free of match state.
  M = { inns: o.inns || 0, pitch: o.pitch || 'balanced', rand: function () { return 0.5; } };
  var d = ballDist(bat, bowl, ph, o.faced || 0, o.intent || 0, o.rrDef || 0,
                   o.pitch || 'balanced', o.field || 'bal', over, ctx);
  M = null;
  return JSON.stringify(d);
};
`, eng.ctx);

const mk = vm.runInContext('__bpMake', eng.ctx);
const dist = vm.runInContext('__bpDist', eng.ctx);
const wantIntent = vm.runInContext('__bpIntent', eng.ctx);
export { wantIntent };

const WKTS = ['wC', 'wB', 'wLBW', 'wRO', 'wST'];
export function probe(batSpec, bowlSpec, opts) {
  const bat = mk(0, batSpec || {}), bowl = mk(0, bowlSpec || {});
  const d = JSON.parse(dist(bat, bowl, opts || {}));
  const g = k => d[k] || 0;
  const wkt = WKTS.reduce((a, k) => a + g(k), 0);
  const wide = g('wide'), nb = g('noball'), bye = g('bye'), lb = g('legbye');
  // RUNS PER OVER, counting a delivery the way the laws do: a wide or a no-ball
  // concedes a run AND is re-bowled, so six LEGAL balls take more than six
  // deliveries to complete. Dividing by the legal share is what turns a
  // per-delivery expectation into an over rate.
  const offBat = g('1') + 2 * g('2') + 3 * g('3') + 4 * g('4') + 6 * g('6');
  const runs = offBat + wide * 1 + nb * 1 + bye * 1.6 + lb * 1.35;
  const legal = Math.max(1e-9, 1 - wide - nb);
  return {
    dot: g('dot') * 100, one: g('1') * 100, two: g('2') * 100, three: g('3') * 100,
    four: g('4') * 100, six: g('6') * 100, wkt: wkt * 100,
    wC: g('wC') * 100, wB: g('wB') * 100, wLBW: g('wLBW') * 100,
    wRO: g('wRO') * 100, wST: g('wST') * 100,
    wide: wide * 100, noball: nb * 100, bye: bye * 100, legbye: lb * 100,
    extras: (wide + nb + bye + lb) * 100,
    rpo: 6 * runs / legal,
    bpw: wkt > 0 ? legal / wkt : Infinity      // legal balls per wicket
  };
}

const f = (x, n = 2) => (x == null || !isFinite(x) ? '   -  ' : x.toFixed(n).padStart(6));
const rows = [];
const say = s => { if (!has('json')) console.log(s); };
const HEAD = 'dot     1     2     4     6   wkt extras   RPO   b/w';
const line = (label, p) =>
  `${String(label).padEnd(26)} ${f(p.dot)}${f(p.one)}${f(p.two)}${f(p.four)}${f(p.six)}${f(p.wkt)}${f(p.extras)}${f(p.rpo)}${f(p.bpw, 1)}`;

// ---------------------------------------------------------------------------
// §21 THE BATTER-v-BOWLER GRID. Both men uniform at their level, so the only
// thing separating two cells is which of them is better and by how much.
// ---------------------------------------------------------------------------
const uniformBat = v => ({ skills: { vsPace: v, vsSpin: v, power: v, rotation: v, temperament: v } });
const uniformBowl = v => ({
  bowlTypeFull: 'seamFastMedium',
  skills: { wicket: v, economy: v, discipline: v, moveTurn: v, variation: v, stamina: v }
});

const GRID = [[25, 25], [35, 25], [25, 35], [50, 50], [60, 50], [50, 60],
  [70, 70], [80, 70], [70, 80], [85, 85], [90, 85], [85, 90],
  [95, 85], [85, 95], [95, 90], [90, 95], [95, 95]];

if (has('grid') || has('all')) {
  say('\n=== §21 BATTER v BOWLER, mid overs, balanced pitch, set batter ===');
  say('bat/bowl                   ' + HEAD);
  const out = [];
  for (const [b, w] of GRID) {
    const p = probe(uniformBat(b), uniformBowl(w), { faced: 30, over: 25 });
    say(line(`${b} bat v ${w} bowl`, p));
    out.push({ bat: b, bowl: w, ...p });
  }
  rows.push({ grid: out });
}

// ---------------------------------------------------------------------------
// §20 ATTRIBUTE SENSITIVITY. One skill at a time, everything else at 50, in the
// context where that skill is supposed to speak. A skill that moves nothing in
// its OWN context is a dead skill; a skill that moves everything in EVERY
// context is a second copy of raw strength.
// ---------------------------------------------------------------------------
const STEPS = [30, 50, 70, 85, 95];
const SWEEPS = [
  ['bat vsPace (v pace)', v => [uniformBat(50), null, { faced: 30 }, { vsPace: v }, 'bat'],],
  ['bat power (death, agg)', v => [null, null, { faced: 30, over: 46, intent: 2 }, { power: v }, 'bat']],
  ['bat rotation (mid)', v => [null, null, { faced: 30 }, { rotation: v }, 'bat']],
  ['bat temperament (calm)', v => [null, null, { faced: 30 }, { temperament: v }, 'bat']],
  ['bat temperament (chase)', v => [null, null, { faced: 6, over: 42, chase: true, reqRate: 10.5, rrDef: 1.0, wkts: 6, ballsLeft: 48 }, { temperament: v }, 'bat']],
  ['bowl wicket', v => [null, null, { faced: 30 }, { wicket: v }, 'bowl']],
  ['bowl economy', v => [null, null, { faced: 30 }, { economy: v }, 'bowl']],
  ['bowl discipline', v => [null, null, { faced: 30 }, { discipline: v }, 'bowl']],
  ['bowl discipline (tired)', v => [null, null, { faced: 30, bowlFat: 0.8 }, { discipline: v }, 'bowl']],
  ['bowl moveTurn (green,new)', v => [null, null, { faced: 30, over: 4, pitch: 'green', weather: 'overcast' }, { moveTurn: v }, 'bowl']],
  ['bowl moveTurn (flat,sun)', v => [null, null, { faced: 30, over: 25, pitch: 'flat' }, { moveTurn: v }, 'bowl']],
  ['bowl variation (set bat)', v => [null, null, { faced: 60, pship: 70 }, { variation: v }, 'bowl']],
  ['bowl variation (new bat)', v => [null, null, { faced: 2 }, { variation: v }, 'bowl']],
  ['bowl stamina (long spell)', v => [null, null, { faced: 30, ballsThisSpell: 54, bowlFat: 0.7 }, { stamina: v }, 'bowl']]
];

if (has('sweep') || has('all')) {
  say('\n=== §20 ATTRIBUTE SENSITIVITY (everything else 50) ===');
  const out = {};
  for (const [label, fn] of SWEEPS) {
    say('\n  ' + label);
    say('  value                      ' + HEAD);
    out[label] = [];
    for (const v of STEPS) {
      const [bs, ws, o, sk, side] = fn(v);
      const B = side === 'bat' ? { skills: sk } : (bs || {});
      const W = side === 'bowl'
        ? { bowlTypeFull: (sk.moveTurn != null || sk.wicket != null || sk.economy != null || sk.discipline != null || sk.variation != null || sk.stamina != null) && o.pitch === 'dry' ? 'fingerSpin' : 'seamFastMedium', skills: sk }
        : (ws || { bowlTypeFull: 'seamFastMedium' });
      const p = probe(B, W, o);
      say(line('  ' + v, p));
      out[label].push({ v, ...p });
    }
  }
  rows.push({ sweeps: out });
}

// ---------------------------------------------------------------------------
// §26/§27 MATCH CONTEXT. Identical cricketers; only the scoreboard changes.
// Rising required rate must buy RISK, not runs: the boundary and the wicket
// must move together, or the engine is handing a chasing side free runs.
// ---------------------------------------------------------------------------
if (has('context') || has('all')) {
  say('\n=== §26 CHASE: identical players, only the scoreboard moves ===');
  say('req rate / wkts down       ' + HEAD);
  const out = [];
  for (const wk of [1, 4, 7]) {
    for (const rr of [4, 6, 8, 10, 13]) {
      const rrDef = Math.max(0, (rr - 5.6) / 3);
      const iv = wantIntent({ over: 35, wkts: wk, runs: 0, setFaced: 20,
        target: Math.round(rr * 15) });
      const p = probe(uniformBat(60), uniformBowl(60),
        { faced: 20, over: 35, chase: true, reqRate: rr, rrDef, wkts: wk, ballsLeft: 90, intent: iv });
      say(line(`  ${rr} RPO, ${wk} down [intent ${iv > 0 ? '+' : ''}${iv}]`, p));
      out.push({ rr, wk, intent: iv, ...p });
    }
  }
  rows.push({ chase: out });

  say('\n=== §27 FIRST INNINGS: resources, not the over number ===');
  say('state                      ' + HEAD);
  const F = [];
  for (const [lbl, o] of [
    ['120/1 after 25', { over: 25, wkts: 1, faced: 40, setFaced: 40, runs: 120 }],
    ['120/7 after 25', { over: 25, wkts: 7, faced: 6, setFaced: 6, runs: 120, since: 1 }],
    ['250/2 after 40', { over: 40, wkts: 2, faced: 60, setFaced: 60, runs: 250 }],
    ['200/7 after 40', { over: 40, wkts: 7, faced: 8, setFaced: 8, runs: 200 }],
    ['30/4 after 12', { over: 12, wkts: 4, faced: 8, setFaced: 8, runs: 30, since: 1 }],
    ['90/0 after 12', { over: 12, wkts: 0, faced: 40, setFaced: 40, runs: 90 }]
  ]) {
    const iv = wantIntent(o);
    const p = probe(uniformBat(60), uniformBowl(60), { ...o, intent: iv });
    say(line('  ' + lbl + ' [intent ' + (iv > 0 ? '+' : '') + iv + ']', p));
    F.push({ lbl, intent: iv, ...p });
  }
  rows.push({ firstInnings: F });
}

// ---------------------------------------------------------------------------
// §28 CONDITIONS x SKILL. The question is never "is a green top seamer-friendly"
// - it is whether the seamer's OWN movement is what cashes it in.
// ---------------------------------------------------------------------------
if (has('conditions') || has('all')) {
  say('\n=== §28 CONDITIONS x ACTUAL SKILL ===');
  say('case                       ' + HEAD);
  const C = [];
  const cases = [
    ['seam mv95 green/overcast', uniformBat(60), { bowlTypeFull: 'seamFastMedium', skills: { wicket: 60, economy: 60, moveTurn: 95, discipline: 50, variation: 50 } }, { over: 4, pitch: 'green', weather: 'overcast', faced: 10 }],
    ['seam mv30 green/overcast', uniformBat(60), { bowlTypeFull: 'seamFastMedium', skills: { wicket: 60, economy: 60, moveTurn: 30, discipline: 50, variation: 50 } }, { over: 4, pitch: 'green', weather: 'overcast', faced: 10 }],
    ['seam mv95 flat/sunny', uniformBat(60), { bowlTypeFull: 'seamFastMedium', skills: { wicket: 60, economy: 60, moveTurn: 95, discipline: 50, variation: 50 } }, { over: 25, pitch: 'flat', weather: 'sunny', faced: 10 }],
    ['seam mv30 flat/sunny', uniformBat(60), { bowlTypeFull: 'seamFastMedium', skills: { wicket: 60, economy: 60, moveTurn: 30, discipline: 50, variation: 50 } }, { over: 25, pitch: 'flat', weather: 'sunny', faced: 10 }],
    ['spin mv95 dry late', uniformBat(60), { bowlTypeFull: 'fingerSpin', skills: { wicket: 60, economy: 60, moveTurn: 95, discipline: 50, variation: 50 } }, { over: 35, pitch: 'dry', faced: 10 }],
    ['spin mv30 dry late', uniformBat(60), { bowlTypeFull: 'fingerSpin', skills: { wicket: 60, economy: 60, moveTurn: 30, discipline: 50, variation: 50 } }, { over: 35, pitch: 'dry', faced: 10 }],
    ['spin mv95 green early', uniformBat(60), { bowlTypeFull: 'fingerSpin', skills: { wicket: 60, economy: 60, moveTurn: 95, discipline: 50, variation: 50 } }, { over: 12, pitch: 'green', faced: 10 }],
    ['power95 flat death', { skills: { vsPace: 60, vsSpin: 60, power: 95, rotation: 60, temperament: 60 } }, uniformBowl(60), { over: 46, pitch: 'flat', intent: 2, faced: 20 }],
    ['power30 flat death', { skills: { vsPace: 60, vsSpin: 60, power: 30, rotation: 60, temperament: 60 } }, uniformBowl(60), { over: 46, pitch: 'flat', intent: 2, faced: 20 }],
    ['power95 slow death', { skills: { vsPace: 60, vsSpin: 60, power: 95, rotation: 60, temperament: 60 } }, uniformBowl(60), { over: 46, pitch: 'slow', intent: 2, faced: 20 }]
  ];
  for (const [lbl, B, W, o] of cases) {
    const p = probe(B, W, o);
    say(line('  ' + lbl, p));
    C.push({ lbl, ...p });
  }
  rows.push({ conditions: C });
}

if (has('json')) console.log(JSON.stringify(rows, null, 1));
