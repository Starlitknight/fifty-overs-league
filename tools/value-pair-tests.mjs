#!/usr/bin/env node
/* tools/value-pair-tests.mjs — DOES THE NEW CARD ORDER TWO REAL CRICKETERS RIGHT?
 *
 * PART B §7-§8. The candidate weights were fitted from marginal per-point
 * values, which is the right way to build them and the wrong way to check
 * them: a weight can be individually defensible and still put the wrong man
 * above the other once eleven of them are on a field together.
 *
 * So each pair below is two cricketers a manager would actually have to choose
 * between, and each is asked three questions that are allowed to disagree:
 *
 *   OLD OVR         what the shipped card says
 *   CANDIDATE OVR   what the re-fitted card says
 *   CRICKET VALUE   what the ENGINE says, measured - the same XI with each man
 *                   in the same seat, paired seeds, match margin per 50 overs
 *
 * The test is not "does the candidate agree with the engine to three decimal
 * places". It is "when the two cards disagree about which man is better, does
 * the engine side with the new one".
 *
 * §7 IS FOLDED IN because it changes one weight. The previous candidate priced
 * a bowler's stamina at the FAST-MEDIUM figure, on the grounds that the world
 * had no fast bowlers to price the top rung with. That was the wrong repair
 * for the right observation: FO_VAL_W.bowl.stamina sits on every bowler's card
 * and the card does not know his type, so the honest weight is the world's own
 * type mix - which is mostly spinners and medium-pacers, for whom stamina
 * measures at essentially nothing.
 *
 *   node tools/value-pair-tests.mjs --n=400
 */
import vm from 'node:vm';
import fs from 'node:fs';
import { makeHarness, summary, per50, arg, has } from './realism-lib.mjs';

const N = parseInt(arg('n', '400'), 10);
const H = makeHarness();
const g = k => vm.runInContext(k, H.ctx);

const V = JSON.parse(fs.readFileSync('docs/player-value-realism/attribute-values-v2.json', 'utf8'));
const byAttr = Object.fromEntries(V.rows.map(r => [r.attr, r]));
const world = JSON.parse(fs.readFileSync('docs/player-value-realism/world-distribution.json', 'utf8'));
const w = a => +byAttr[a].worldPitch.toFixed(3);

// ---------------------------------------------------------------------------
// §7 THE ONE WEIGHT THE FAST-BOWLER FIX ACTUALLY MOVES.
// ---------------------------------------------------------------------------
const FRONT = world.bowlType.frontShare;
const STAM = { seamFast: 'stamina_fast', seamFastMedium: 'stamina_fastmed',
  seamMedium: 'stamina_med', fingerSpin: 'stamina_spin', wristSpin: 'stamina_spin' };
let stamMix = 0, stamDen = 0;
for (const [type, share] of Object.entries(FRONT)) {
  const key = STAM[type];
  if (!key) continue;                       // part-timers bowl no real spell
  stamMix += share * byAttr[key].worldPitch; stamDen += share;
}
stamMix /= Math.max(1e-9, stamDen);
console.log('=== §7 BOWLER STAMINA, PRICED OVER THE TYPES THE WORLD BOWLS ===');
for (const [type, share] of Object.entries(FRONT))
  if (STAM[type]) console.log(`  ${type.padEnd(16)} ${(100 * share).toFixed(1).padStart(5)}% of overs`
    + `   x ${byAttr[STAM[type]].worldPitch.toFixed(4)} runs/pt`);
console.log(`  -> mix ${stamMix.toFixed(4)}   (the earlier candidate used the`
  + ` fast-medium figure alone, ${byAttr.stamina_fastmed.worldPitch.toFixed(4)})`);

// vsPace / vsSpin re-fitted at the corrected exposure
const cells = {};
for (const f of fs.readdirSync('docs/player-value-realism/cells')) {
  const c = JSON.parse(fs.readFileSync('docs/player-value-realism/cells/' + f, 'utf8'));
  (cells[c.attr] = cells[c.attr] || {})[c.ctx] = c;
}
const SPINSHARE = { 'attack-allpace': 0.000, 'attack-pace': 0.210, 'deep': 0.419,
  'attack-spin': 0.602, 'attack-allspin': 1.000 };
function exposureFit(attr, ownShare) {
  let S = { w: 0, x: 0, y: 0, xx: 0, xy: 0 };
  for (const [ctx, spin] of Object.entries(SPINSHARE)) {
    const c = cells[attr][ctx]; if (!c) continue;
    const x = attr === 'vsSpin' ? spin : 1 - spin;
    const wt = 1 / Math.pow(c.dMargin.se / c.step, 2), y = c.perPoint;
    S = { w: S.w + wt, x: S.x + wt * x, y: S.y + wt * y, xx: S.xx + wt * x * x, xy: S.xy + wt * x * y };
  }
  const b = (S.w * S.xy - S.x * S.y) / (S.w * S.xx - S.x * S.x);
  const a = (S.y - b * S.x) / S.w;
  return a + b * ownShare;
}
const SPIN_W = world.exposure.spinShare;
const NEW = {
  bat: { vsPace: +exposureFit('vsPace', 1 - SPIN_W).toFixed(3),
         vsSpin: +exposureFit('vsSpin', SPIN_W).toFixed(3),
         power: w('power'), rotation: w('rotation'), temperament: w('temperament') },
  bowl: { wicket: w('wicket'), economy: w('economy'), discipline: w('discipline'),
          moveTurn: w('moveTurn'), variation: w('variation'), stamina: +stamMix.toFixed(3) },
  field: { fielding: w('fielding'), catching: w('catching') },
  glove: { catching: w('catching_wk'), keeping: w('keeping'), stumping: w('stumping') }
};
const OLD = {
  bat: { vsPace: 0.185, vsSpin: 0.145, power: 0.150, rotation: 0.150, temperament: 0.060 },
  bowl: { wicket: 0.415, economy: 0.240, discipline: 0.140, moveTurn: 0.090, variation: 0.060, stamina: 0.030 },
  field: { fielding: 0.200, catching: 0.110 },
  glove: { catching: 0.226, keeping: 0.045, stumping: 0.030 }
};
// THE MIX IS THE OTHER HALF OF THE FIELD CHANGE and has to be tested WITH it.
// FO_VAL_MIX held an outfielder's fielding to 0.45 because the family sum
// overstated it; correcting the sum and keeping the cap would under-pay it
// twice. Old sum x old mix = 0.310 x 0.45 = 0.1395 of effective field weight;
// new sum x new mix = 0.106 x 1.00 = 0.106.
const MIX_OLD = { bat: { bat: 1, bowl: 0, field: 0.45, glove: 0 }, bowl: { bat: 0, bowl: 1, field: 0.45, glove: 0 },
  ar: { bat: 0.80, bowl: 0.80, field: 0.45, glove: 0 }, wk: { bat: 1, bowl: 0, field: 0, glove: 1.20 } };
const MIX_NEW = { bat: { bat: 1, bowl: 0, field: 1.00, glove: 0 }, bowl: { bat: 0, bowl: 1, field: 1.00, glove: 0 },
  ar: { bat: 0.80, bowl: 0.80, field: 1.00, glove: 0 }, wk: { bat: 1, bowl: 0, field: 0, glove: 1.80 } };

g('try{ window.FO_VAL_C = FO_VAL_C; window.FO_VAL_W = FO_VAL_W; window.FO_VAL_MIX = FO_VAL_MIX; }catch(e){}');
// the OLD arm has to be the OLD law all the way down, and the experience layer
// lives in the engine rather than in a weight - so it is switched off with the
// old weights and back on with the new ones
const expOff = v => g(`__foExpOvrOff=${v ? 1 : 0};1`);
function setLaw(weights, mix) {
  g(`(function(W,M){ for (var f in W) for (var k in W[f]) FO_VAL_W[f][k] = W[f][k];
       for (var r in M) for (var k2 in M[r]) FO_VAL_MIX[r][k2] = M[r][k2];
       var S={}; for (var f2 in FO_VAL_W){ var t=0; for(var k3 in FO_VAL_W[f2]) t+=FO_VAL_W[f2][k3]; S[f2]=t; }
       for (var r2 in FO_VAL_MIX){ var m=FO_VAL_MIX[r2];
         FO_VAL_C[r2] = m.bat*S.bat + m.bowl*S.bowl + m.field*S.field + m.glove*S.glove; }
     })(${JSON.stringify(weights)},${JSON.stringify(mix)})`);
}
const ovrOf = p => Math.max(0, Math.min(100, Math.round(
  JSON.parse(g(`JSON.stringify(window.foPlayerValue(${JSON.stringify(p)}))`)).ovr)));
const WAGE = o => Math.max(400, Math.round(9290 * Math.pow(Math.max(1, o * 1000) / 50000, 3) / 10) * 10);

// ---------------------------------------------------------------------------
// THE PAIRS. Each is {seat, A, B} - two men for one seat in the same XI.
// ---------------------------------------------------------------------------
const S = (o) => o;   // readability
const PAIRS = [
  { name: 'elite bat / poor field  vs  good bat / elite field', seat: 2,
    A: { skills: S({ vsPace: 84, vsSpin: 82, power: 78, rotation: 82, temperament: 76, fielding: 28, catching: 26 }) },
    B: { skills: S({ vsPace: 70, vsSpin: 68, power: 66, rotation: 68, temperament: 64, fielding: 92, catching: 90 }) } },
  { name: 'wicket threat  vs  economy', seat: 6, pin: 'seamFastMedium',
    A: { skills: S({ wicket: 86, economy: 46, discipline: 58, moveTurn: 70, variation: 62, stamina: 60 }) },
    B: { skills: S({ wicket: 50, economy: 84, discipline: 76, moveTurn: 58, variation: 56, stamina: 62 }) } },
  { name: 'genuine quick  vs  fast-medium of the same class', seat: 6,
    A: { bowlTypeFull: 'seamFast', skills: S({ wicket: 74, economy: 66, discipline: 64, moveTurn: 70, variation: 66, stamina: 70 }) },
    B: { bowlTypeFull: 'seamFastMedium', skills: S({ wicket: 74, economy: 66, discipline: 64, moveTurn: 70, variation: 66, stamina: 70 }) } },
  { name: 'keeper-batsman  vs  elite gloves / poor bat', seat: 5,
    A: { skills: S({ vsPace: 78, vsSpin: 76, rotation: 76, power: 70, catching: 66, keeping: 60, stumping: 58 }) },
    B: { skills: S({ vsPace: 34, vsSpin: 32, rotation: 34, power: 30, catching: 94, keeping: 92, stumping: 90 }) } },
  { name: 'keeper: elite bat / mediocre gloves  vs  balanced keeper', seat: 5,
    A: { skills: S({ vsPace: 86, vsSpin: 84, rotation: 84, power: 76, catching: 52, keeping: 48, stumping: 46 }) },
    B: { skills: S({ vsPace: 62, vsSpin: 60, rotation: 60, power: 56, catching: 80, keeping: 76, stumping: 74 }) } },
  { name: 'young high-skill (21)  vs  veteran (34), same skills', seat: 2,
    A: { age: 21, exp: 25, skills: S({ vsPace: 76, vsSpin: 74, power: 70, rotation: 74, temperament: 70 }) },
    B: { age: 34, exp: 88, skills: S({ vsPace: 76, vsSpin: 74, power: 70, rotation: 74, temperament: 70 }) } },
  { name: 'high experience  vs  low experience, same skills', seat: 2,
    A: { exp: 92, skills: S({ vsPace: 74, vsSpin: 72, power: 68, rotation: 72, temperament: 68 }) },
    B: { exp: 28, skills: S({ vsPace: 74, vsSpin: 72, power: 68, rotation: 72, temperament: 68 }) } },
  { name: 'elite captain  vs  ordinary captain', seat: 0,
    A: { capt: 92, skills: S({ vsPace: 70, vsSpin: 68, power: 64, rotation: 68, temperament: 66 }) },
    B: { capt: 42, skills: S({ vsPace: 70, vsSpin: 68, power: 64, rotation: 68, temperament: 66 }) } },
  { name: 'balanced all-rounder  vs  batting specialist', seat: 4,
    A: { bowlTypeFull: 'seamMedium', role: 'allRounder',
         skills: S({ vsPace: 66, vsSpin: 64, power: 62, rotation: 64, temperament: 62, wicket: 64, economy: 62, discipline: 60, moveTurn: 60, variation: 58, stamina: 64 }) },
    B: { skills: S({ vsPace: 80, vsSpin: 78, power: 74, rotation: 78, temperament: 72 }) } },
  { name: 'elite keeper-bat  vs  balanced keeper', seat: 5,
    A: { skills: S({ vsPace: 84, vsSpin: 82, rotation: 82, power: 74, temperament: 76, catching: 90, keeping: 88, stumping: 86 }) },
    B: { skills: S({ vsPace: 62, vsSpin: 60, rotation: 60, power: 56, temperament: 58, catching: 80, keeping: 76, stumping: 74 }) } },
  { name: 'bowling all-rounder (20/70) at No.8  vs  tail-ender', seat: 6,
    A: { role: 'allRounder', bowlTypeFull: 'seamMedium', skills: S({ vsPace: 20, vsSpin: 18, rotation: 18, power: 14, wicket: 70, economy: 68, discipline: 66, moveTurn: 66, variation: 64, stamina: 70 }) },
    B: { bowlTypeFull: 'seamMedium', skills: S({ vsPace: 20, vsSpin: 18, rotation: 18, power: 14, wicket: 55, economy: 53, discipline: 51, moveTurn: 51, variation: 49, stamina: 55 }) } },
  { name: 'batting all-rounder (70/20) at No.5  vs  bat specialist', seat: 4,
    A: { role: 'allRounder', bowlTypeFull: 'seamMedium', skills: S({ vsPace: 70, vsSpin: 68, rotation: 68, power: 64, temperament: 66, wicket: 20, economy: 18, discipline: 16, moveTurn: 16, variation: 14, stamina: 20 }) },
    B: { skills: S({ vsPace: 70, vsSpin: 68, rotation: 68, power: 64, temperament: 66 }) } },
  { name: 'captaincy 30 -> 95 on the CAPTAIN', seat: 0,
    A: { capt: 95, skills: S({ vsPace: 70, vsSpin: 68, power: 64, rotation: 68, temperament: 66 }) },
    B: { capt: 30, skills: S({ vsPace: 70, vsSpin: 68, power: 64, rotation: 68, temperament: 66 }) } },
  { name: 'captaincy 30 -> 95 on a NON-captain (seat 0 pinned 99)', seat: 3,
    pinCapt: true,
    A: { capt: 95, skills: S({ vsPace: 70, vsSpin: 68, power: 64, rotation: 68, temperament: 66 }) },
    B: { capt: 30, skills: S({ vsPace: 70, vsSpin: 68, power: 64, rotation: 68, temperament: 66 }) } }
];

function sideWith(seat, spec, pinCapt) {
  const slots = [Object.assign({ slot: seat }, spec)];
  // THE ENGINE CHOOSES THE CAPTAIN ITSELF, as the highest-captaincy man in the
  // XI (00-core.js:5577). So a "non-captain" case has to pin somebody ABOVE
  // the swept man or raising his captaincy simply hands him the armband and
  // measures the captain twice.
  if (pinCapt) slots.unshift({ slot: 0, capt: 99 });
  return H.side('A', { slots });
}
function marginOf(r) {
  let sc = null, co = null;
  for (const inn of [r.i1, r.i2]) {
    if (!inn) continue;
    if (inn.batTeam === 'A') sc = per50(inn.runs, inn.legal); else co = per50(inn.runs, inn.legal);
  }
  return (sc != null && co != null) ? sc - co : null;
}
const winOf = r => r.winner === 'A' ? 1 : (r.winner ? 0 : 0.5);

const B = H.side('B', {});
const out = [];
console.log(`\n=== §8 PLAYER PAIRS (N=${N} paired) ===`);
console.log('  pair                                                  OLD      CAND     wage(cand)     A-B margin  win');
for (const P of PAIRS) {
  const sideA = sideWith(P.seat, P.A, P.pinCapt), sideB = sideWith(P.seat, P.B, P.pinCapt);
  const manA = sideA.players[P.seat], manB = sideB.players[P.seat];
  expOff(true); setLaw(OLD, MIX_OLD); const oA = ovrOf(manA), oB = ovrOf(manB);
  expOff(false); setLaw(NEW, MIX_NEW); const nA = ovrOf(manA), nB = ovrOf(manB);
  const dm = [], dv = [];
  for (let i = 0; i < N; i++) {
    const s = 940001 + i * 104729;
    const r1 = H.run(sideB, B, s, {}), r2 = H.run(sideA, B, s, {});
    if (!r1 || !r2) continue;
    const m1 = marginOf(r1), m2 = marginOf(r2);
    if (m1 != null && m2 != null) dm.push(m2 - m1);
    dv.push(winOf(r2) - winOf(r1));
  }
  const D = summary(dm), W = summary(dv);
  const rec = { pair: P.name, oldA: oA, oldB: oB, newA: nA, newB: nB,
    wageA: WAGE(nA), wageB: WAGE(nB), dMargin: D, dWin: W };
  out.push(rec);
  console.log('  ' + P.name.padEnd(52)
    + `${oA}v${oB}`.padStart(8) + `${nA}v${nB}`.padStart(9)
    + `$${WAGE(nA).toLocaleString()}/$${WAGE(nB).toLocaleString()}`.padStart(17)
    + (D.mean.toFixed(2) + '±' + D.se.toFixed(2)).padStart(15)
    + (100 * W.mean).toFixed(1).padStart(6));
}
fs.writeFileSync('docs/fast-bowler-generation/pair-tests.json',
  JSON.stringify({ n: N, weights: { OLD, NEW }, mix: { MIX_OLD, MIX_NEW }, stamMix, pairs: out }, null, 1));
console.log('\n=== CANDIDATE WEIGHTS AFTER §7 ===');
console.log(JSON.stringify(NEW, null, 1));
