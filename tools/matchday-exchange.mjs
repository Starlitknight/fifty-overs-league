/* tools/matchday-exchange.mjs — WHAT IS A BATTING POINT WORTH IN BOWLING POINTS?
 *
 * The all-rounder audit (tools/matchday-allrounder.mjs) left three residuals
 * the score could not explain. The largest, case C, swaps an elite specialist
 * bowler for a strong all-rounder: the coach scores that +12.5 and the cricket
 * plays it dead even. The trade is roughly "+40 batting points for -16 bowling
 * points", so if the coach's two channels were on the same scale the cricket
 * would have agreed. It did not, which says the scales differ - and the
 * suspicion is not a role bonus at all but an EXCHANGE RATE.
 *
 * The two channels of foMdcScoreXI genuinely are different quantities:
 *
 *   bat   = SUM over the batting order of rpd x SLOT_BALLS[slot]
 *           - runs-per-dismissal weighted by the share of an innings that slot
 *           faces. Its units are "rpd-weighted", not runs. The eleven weights
 *           sum to 6.26, so a side of 60-rpd men scores about 375.
 *   bowl  = -(what fifty overs cost), in actual runs, cheapest bowler first.
 *
 * Nobody ever checked that one point of the first buys the same amount of
 * cricket as one point of the second. This tool checks it, by the only method
 * that can: build ladders that move ONE channel at a time and play them.
 *
 *   BAT LADDER   one middle-order batsman's skill swept, bowling untouched
 *   BOWL LADDER  one bowler's skill swept, batting untouched
 *
 * Each rung is scored by the coach and then played against a COMMON opponent,
 * paired on seeds and played both home and away so that ground and squad
 * effects cancel. Regressing win rate on the coach's own score gives a slope
 * per channel, in win-points per score-point. If the two slopes differ, the
 * ratio is the correction the selection utility needs - a measured conversion
 * between two quantities, not a coefficient attached to anybody's role.
 *
 *   node tools/matchday-exchange.mjs             # 600 pairs a rung
 *   node tools/matchday-exchange.mjs --n 1500
 */
import vm from 'node:vm';
import { makeEngine } from '../test/engine-vm.mjs';

const argv = process.argv.slice(2);
const N = (() => { const i = argv.indexOf('--n'); return i >= 0 ? parseInt(argv[i + 1], 10) : 600; })();
const eng = makeEngine();
eng.setTuning(true);

vm.runInContext(`
var __XT = { fast: 'seamFast', fastMedium: 'seamFastMedium', medium: 'seamMedium',
             fingerSpin: 'fingerSpin', wristSpin: 'wristSpin', none: 'none' };
globalThis.__xMan = function (name, spec) {
  var t = JSON.parse(JSON.stringify(GD.teams[0].players[0]));
  t.name = name; t.age = 27; t.talents = [];
  t.role = spec.keeper ? 'wicketkeeper' : (spec.bowl ? 'bowler' : 'batsman');
  t.bowlTypeFull = __XT[spec.type || 'none'];
  var b = spec.bat == null ? 50 : spec.bat, w = spec.bowl || 0;
  t.skills = { vsPace: b, vsSpin: b, power: b, rotation: b, temperament: b,
               wicket: w, economy: w, discipline: w, moveTurn: w, variation: w,
               stamina: 60, fielding: 50, catching: 50,
               keeping: spec.keeper ? 70 : 10, stumping: spec.keeper ? 70 : 10 };
  t.capt = 50;
  jsDerive(t);
  return t;
};
// the coach's own decomposition, measured against a COMMON pool so every rung
// of a ladder is judged by one yardstick (foMdcRefs builds it from whatever it
// is handed, and a moving yardstick would fake a slope)
globalThis.__xScore = function (xiJson, poolJson, pitch, weather) {
  var xi = JSON.parse(xiJson);
  var refs = foMdcRefs(JSON.parse(poolJson));
  var ctx = foMdcCtx(weather, FO_KQ_PAR, 50, false);
  var cards = xi.map(function (p) { return foMdcCard(p, refs, ctx, pitch, 0.62); });
  var s = foMdcScoreXI(cards, null);
  return JSON.stringify({ total: s.total, bat: s.bat, bowl: s.bowl, keep: s.keep,
                          field: s.field, capt: s.capt, allround: s.allround,
                          doctrine: s.doctrine,
                          front: cards.filter(function (c) { return c.front; }).length });
};
globalThis.__xPlay = function (aJson, bJson, pitch, weather, seed) {
  var A = { name: 'AAA', players: JSON.parse(aJson) };
  var B = { name: 'BBB', players: JSON.parse(bJson) };
  var sheet = function (ps) {
    var o = ps.slice().sort(function (x, y) { return (y.bat || 0) - (x.bat || 0); });
    return { xi: ps.map(function (p) { return p.name; }),
             batOrder: o.map(function (p) { return p.name; }) };
  };
  var om = { AAA: sheet(A.players), BBB: sheet(B.players) };
  var r = window.__foGame.simWorld(A, B, pitch, weather, (seed >>> 0) || 1, om, true);
  if (!r || !r.result) return null;
  return r.result.winner === 'AAA' ? 1 : (r.result.winner === 'BBB' ? 0 : 0.5);
};
`, eng.ctx);

const man = vm.runInContext('__xMan', eng.ctx);
const score = vm.runInContext('__xScore', eng.ctx);
const play = vm.runInContext('__xPlay', eng.ctx);

const PITCH = 'balanced', WX = 'Sunny';
const TYPES = ['fast', 'fastMedium', 'medium', 'fingerSpin', 'wristSpin'];

// the fixed cast. The side under test always fields the same shape: a keeper,
// five specialist bowlers and five specialist batsmen.
const keeper = man('Keeper', { bat: 55, keeper: true });
const BOWLERS = q => [0, 1, 2, 3, 4].map(i => man('B' + i, { bat: 22, bowl: q[i], type: TYPES[i] }));
const BATS = q => q.map((b, i) => man('T' + i, { bat: b }));

const BASE_BOWL = [66, 64, 62, 60, 58];
const BASE_BAT = [70, 66, 62, 58, 54];
// SWEEP INSIDE THE LINEAR REGION, which the first cut did not. Sweeping a
// batsman from 30 upward crosses the depth charge - a side pays DEPTH_RUNS for
// every top-seven seat a recognised batsman is not filling - so the bat channel
// jumped 3.5 points from skill 30 to 42 and then 34.7 from 42 to 54. A slope
// fitted across a cliff is not a slope. Both sweeps now stay in the band where
// the man is unambiguously a recognised batsman and the fifth bowler is
// unambiguously a bowler, so each channel moves smoothly.
const BAT_SWEEP = [50, 58, 66, 74, 82];
const BOWL_SWEEP = [46, 54, 62, 70, 78];

// the opponent every rung plays, and it never changes
const OPPO = [man('OK', { bat: 55, keeper: true })]
  .concat([0, 1, 2, 3, 4].map(i => man('OB' + i, { bat: 22, bowl: 62, type: TYPES[i] })))
  .concat([68, 64, 60, 56, 52].map((b, i) => man('OT' + i, { bat: b })));

function xiWith(bowlQ, batQ) {
  return [keeper].concat(BOWLERS(bowlQ), BATS(batQ));
}

// every man who appears anywhere in this file, so one yardstick serves all
const POOL = (() => {
  const seen = {}, out = [];
  const add = p => { if (!seen[p.name]) { seen[p.name] = 1; out.push(p); } };
  BAT_SWEEP.forEach(v => {
    xiWith(BASE_BOWL, [70, 66, 62, 58, v]).forEach(add);
  });
  BOWL_SWEEP.forEach(v => {
    xiWith([66, 64, 62, 60, v], BASE_BAT).forEach(add);
  });
  OPPO.forEach(add);
  return JSON.stringify(out);
})();

function rung(xi) {
  const s = JSON.parse(score(JSON.stringify(xi), POOL, PITCH, WX));
  let wins = 0; const per = [];
  for (let i = 0; i < N; i++) {
    const seed = 130000 + i * 23;
    const h = play(JSON.stringify(xi), JSON.stringify(OPPO), PITCH, WX, seed);
    const a = play(JSON.stringify(OPPO), JSON.stringify(xi), PITCH, WX, seed);
    if (h == null || a == null) continue;
    const x = (h + (1 - a)) / 2;
    per.push(x); wins += x;
  }
  const n = per.length, p = wins / n;
  const sd = Math.sqrt(per.reduce((t, v) => t + (v - p) * (v - p), 0) / n);
  return { s, win: p, se: sd / Math.sqrt(n), n };
}

// least squares slope of win% on a score channel
function slope(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) * (xs[i] - mx); }
  return num / den;
}

console.log('=== THE EXCHANGE RATE BETWEEN THE COACH\'S TWO CHANNELS ===');
console.log(N + ' pairs a rung, each played home and away against one fixed opponent.\n');

console.log('BAT LADDER — one middle-order batsman swept, bowling untouched');
console.log('  skill   bat score   bowl score      win%      SE');
const batX = [], batY = [];
for (const v of BAT_SWEEP) {
  const r = rung(xiWith(BASE_BOWL, [70, 66, 62, 58, v]));
  batX.push(r.s.bat); batY.push(100 * r.win);
  console.log('  ' + String(v).padStart(5) + r.s.bat.toFixed(1).padStart(12) +
    r.s.bowl.toFixed(1).padStart(13) + (100 * r.win).toFixed(2).padStart(10) +
    (100 * r.se).toFixed(2).padStart(8));
}

console.log('\nBOWL LADDER — one bowler swept, batting untouched');
console.log('  skill   bat score   bowl score      win%      SE');
const bowlX = [], bowlY = [];
for (const v of BOWL_SWEEP) {
  const r = rung(xiWith([66, 64, 62, 60, v], BASE_BAT));
  bowlX.push(r.s.bowl); bowlY.push(100 * r.win);
  console.log('  ' + String(v).padStart(5) + r.s.bat.toFixed(1).padStart(12) +
    r.s.bowl.toFixed(1).padStart(13) + (100 * r.win).toFixed(2).padStart(10) +
    (100 * r.se).toFixed(2).padStart(8));
}

const sBat = slope(batX, batY), sBowl = slope(bowlX, bowlY);
console.log('\n--- THE ANSWER ---');
console.log('  win-points per BAT  score-point : ' + sBat.toFixed(4));
console.log('  win-points per BOWL score-point : ' + sBowl.toFixed(4));
console.log('  ratio (bowl / bat)              : ' + (sBowl / sBat).toFixed(3));
console.log('');
console.log('  A ratio of 1.0 means the two channels are already on one scale and the');
console.log('  residuals are something else. A ratio above 1 means a bowling point buys');
console.log('  MORE cricket than a batting point, so the coach is over-paying batting -');
console.log('  which is what would make an all-rounder\'s batting look too good.');
console.log('  The correction is to multiply the BAT channel by (bat slope / bowl slope),');
console.log('  i.e. ' + (sBat / sBowl).toFixed(3) + ', or equivalently scale bowling up by ' +
  (sBowl / sBat).toFixed(3) + '.');

// ---------------------------------------------------------------------------
// AND THE ONE THAT ACTUALLY MATTERS: IS A LOWER-ORDER RUN WORTH WHAT THE MODEL
// SAYS IT IS?
//
// The two ladders above sweep a TOP-ORDER batsman and a frontline bowler, and
// they came out within a tenth of each other - so the bat and bowl channels are
// on one scale and the C/G/H residuals are not an exchange-rate fault.
//
// But both ladders moved a man near the TOP of the order, and that is not where
// an all-rounder bats. The bat channel prices a man as rpd x SLOT_BALLS[slot],
// and SLOT_BALLS was written down rather than measured: 1.00 at the top falling
// to 0.05 at eleven. If those weights are too generous down the order, then
// every extra all-rounder - who always arrives at six, seven or eight - is
// bought at a price the cricket never pays, which is exactly the shape of the
// G and H residuals.
//
// This sweeps the BATTING of a man whose BOWLING is untouched, so the bowl
// channel is frozen and only his slot value moves. Compare the win-points per
// bat-score-point against the top-order ladder above: if a lower-order point
// buys less, SLOT_BALLS is the fault.
console.log('\nLOWER-ORDER LADDER — a bowler\'s BATTING swept, his bowling untouched');
console.log('  skill   bat score   bowl score      win%      SE');
const loX = [], loY = [];
for (const v of [20, 32, 44, 56]) {
  const xi = [keeper]
    .concat([man('B0', { bat: v, bowl: BASE_BOWL[0], type: TYPES[0] })])
    .concat([1, 2, 3, 4].map(i => man('B' + i, { bat: 22, bowl: BASE_BOWL[i], type: TYPES[i] })))
    .concat(BATS(BASE_BAT));
  const r = rung(xi);
  loX.push(r.s.bat); loY.push(100 * r.win);
  console.log('  ' + String(v).padStart(5) + r.s.bat.toFixed(1).padStart(12) +
    r.s.bowl.toFixed(1).padStart(13) + (100 * r.win).toFixed(2).padStart(10) +
    (100 * r.se).toFixed(2).padStart(8));
}
const sLo = slope(loX, loY);
console.log('\n  win-points per LOWER-ORDER bat score-point : ' + sLo.toFixed(4));
console.log('  win-points per TOP-ORDER   bat score-point : ' + sBat.toFixed(4));
console.log('  ratio (lower / top)                       : ' + (sLo / sBat).toFixed(3));
console.log('');
console.log('  Below 1.0 means the model pays for lower-order batting at a rate the');
console.log('  cricket does not, and SLOT_BALLS is too fat down the order - which would');
console.log('  over-value every all-rounder, because an all-rounder always bats there.');
