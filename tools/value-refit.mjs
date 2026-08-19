#!/usr/bin/env node
/* tools/value-refit.mjs — THE NEW WEIGHTS, AND WHAT THEY DO TO THE WORLD
 *
 * PHASE 3 §10 onward. Takes the measured dataset, derives a candidate
 * FO_VAL_W, and then - before a single line of the engine is edited - applies
 * it inside the VM to a population dealt by the engine's own generator and
 * reports what actually moves: the OVR distribution, the biggest movers by
 * name, and the wages and fees that follow.
 *
 * WHY IT IS EVALUATED BEFORE IT IS COMMITTED. foPlayerValue().level is the
 * generator's target function (see DEPENDENCY-AUDIT.md §4), so new weights do
 * not merely re-label the existing world - they change who gets dealt. This
 * tool answers the cheaper question first: holding the SAME cricketers fixed,
 * what does the card say about them now? That isolates the re-pricing from the
 * re-dealing, which are two different changes that would otherwise arrive
 * together and be impossible to argue about separately.
 *
 *   node tools/value-refit.mjs
 */
import vm from 'node:vm';
import fs from 'node:fs';
import { makeEngine } from '../test/engine-vm.mjs';

const V = JSON.parse(fs.readFileSync('docs/player-value-realism/attribute-values-v2.json', 'utf8'));
const byAttr = Object.fromEntries(V.rows.map(r => [r.attr, r]));
const cells = {};
for (const f of fs.readdirSync('docs/player-value-realism/cells')) {
  const c = JSON.parse(fs.readFileSync('docs/player-value-realism/cells/' + f, 'utf8'));
  (cells[c.attr] = cells[c.attr] || {})[c.ctx] = c;
}

// ---------------------------------------------------------------------------
// §6 FINISHED: vsPace and vsSpin as a function of EXPOSURE, fitted rather than
// read off one fixture. The spin share of each fixture is measured, not
// assumed - the coach hands the five bowlers about a fifth of the overs each,
// so the sheet's composition is what a batsman meets.
// ---------------------------------------------------------------------------
const SPINSHARE = { 'attack-allpace': 0.000, 'attack-pace': 0.210, 'deep': 0.419,
  'ref': 0.419, 'attack-spin': 0.602, 'attack-allspin': 1.000 };
function exposureFit(attr, ownShare) {
  const pts = [];
  for (const [ctx, spin] of Object.entries(SPINSHARE)) {
    if (ctx === 'ref' && cells[attr].deep) continue;   // prefer the deep re-run
    const c = cells[attr][ctx];
    if (!c) continue;
    const x = attr === 'vsSpin' ? spin : 1 - spin;
    pts.push({ x, y: c.perPoint, w: 1 / Math.pow(c.dMargin.se / c.step, 2) });
  }
  // weighted least squares, weights 1/se^2 - which is what demotes the one
  // N=200 pace-heavy cell that sits two standard errors off the line and
  // would otherwise be allowed to bend it
  const S = pts.reduce((a, p) => ({ w: a.w + p.w, x: a.x + p.w * p.x, y: a.y + p.w * p.y,
    xx: a.xx + p.w * p.x * p.x, xy: a.xy + p.w * p.x * p.y }), { w: 0, x: 0, y: 0, xx: 0, xy: 0 });
  const b = (S.w * S.xy - S.x * S.y) / (S.w * S.xx - S.x * S.x);
  const a = (S.y - b * S.x) / S.w;
  return { a, b, at: a + b * ownShare, pts };
}
const SPIN_W = V.world.spinShare;
const fitP = exposureFit('vsPace', 1 - SPIN_W);
const fitS = exposureFit('vsSpin', SPIN_W);
console.log('=== §6 EXPOSURE FIT (world bowls %s%% spin) ===', (100 * SPIN_W).toFixed(1));
console.log(`  vsPace  value = ${fitP.a.toFixed(3)} + ${fitP.b.toFixed(3)} x paceShare  ->  ${fitP.at.toFixed(4)}`);
console.log(`  vsSpin  value = ${fitS.a.toFixed(3)} + ${fitS.b.toFixed(3)} x spinShare  ->  ${fitS.at.toFixed(4)}`);

// ---------------------------------------------------------------------------
// THE CANDIDATE WEIGHTS. Every number is the world-weighted measured value in
// runs of match margin per point, which is what the existing comment above
// FO_VAL_W already CLAIMS its numbers are. The two batting-technique entries
// come off the exposure fit instead of their single fixture.
// ---------------------------------------------------------------------------
const w = a => +byAttr[a].worldPitch.toFixed(3);
const NEW = {
  bat: { vsPace: +fitP.at.toFixed(3), vsSpin: +fitS.at.toFixed(3), power: w('power'),
         rotation: w('rotation'), temperament: w('temperament') },
  // stamina is priced at the type the world actually deals most of. It has no
  // seamFast at all (see world-distribution.json), so pricing a bowler's
  // stamina at the fast-bowler figure would be pricing a job nobody holds.
  bowl: { wicket: w('wicket'), economy: w('economy'), discipline: w('discipline'),
          moveTurn: w('moveTurn'), variation: w('variation'), stamina: w('stamina_fastmed') },
  field: { fielding: w('fielding'), catching: w('catching') },
  glove: { catching: w('catching_wk'), keeping: w('keeping'), stumping: w('stumping') }
};
const OLD = {
  bat: { vsPace: 0.185, vsSpin: 0.145, power: 0.150, rotation: 0.150, temperament: 0.060 },
  bowl: { wicket: 0.415, economy: 0.240, discipline: 0.140, moveTurn: 0.090, variation: 0.060, stamina: 0.030 },
  field: { fielding: 0.200, catching: 0.110 },
  glove: { catching: 0.226, keeping: 0.045, stumping: 0.030 }
};
const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
console.log('\n=== CANDIDATE FO_VAL_W (runs of match margin per point) ===');
for (const fam of ['bat', 'bowl', 'field', 'glove']) {
  console.log(`  ${fam}`);
  for (const k in NEW[fam])
    console.log(`    ${k.padEnd(13)} ${OLD[fam][k].toFixed(3)} -> ${NEW[fam][k].toFixed(3)}`
      + `   (x${(NEW[fam][k] / OLD[fam][k]).toFixed(2)})`);
  console.log(`    ${'SUM'.padEnd(13)} ${sum(OLD[fam]).toFixed(3)} -> ${sum(NEW[fam]).toFixed(3)}`);
}

// ---------------------------------------------------------------------------
// WHAT IT DOES TO THE SAME CRICKETERS. The population is dealt once, by the
// engine's own generator over every side the planet has, and then priced
// twice. Nobody is re-dealt, so every difference below is re-pricing.
// ---------------------------------------------------------------------------
const eng = makeEngine();
const g = k => vm.runInContext(k, eng.ctx);
const pop = [];
const DEALS = [];
const NATS = JSON.parse(g('JSON.stringify(window.__foPlanet.nations()||[])'));
for (const n of NATS) {
  const rid = n.id != null ? n.id : n;
  const sides = JSON.parse(g(`JSON.stringify(window.__foPlanet.sidesOf(${JSON.stringify(rid)})||[])`));
  sides.forEach((side, slot) => {
    let players, seed, tier;
    try {
      // THE SEED CARRIES THE NATION. An earlier cut of this used 7000+slot,
      // which handed every nation's slot-3 club the same fifteen men and made
      // a "3,840 cricketer" population out of 240 repeated sixteen times.
      seed = `${rid}|${slot}`;
      // THE TIER IS THE SERVER'S OWN RULE (init-world.mjs tierOfClub), and it
      // is passed INTO the generator rather than applied after it: genSquad
      // lays the squad on the tier's curve itself. An earlier cut read
      // side.tier, which sidesOf does not carry, so every club was dealt an
      // untiered squad and the world's best cricketer came out at 76.
      const div = side.div || (slot < 8 ? 1 : 2);
      const ix = side.boss ? 5 : (div === 1 ? (slot <= 3 ? 4 : 3) : (slot <= 11 ? 2 : 1));
      tier = ['newcomer', 'd2b', 'd2a', 'd1b', 'd1a', 'flagship'][Math.max(0, Math.min(5, ix))];
      players = JSON.parse(g(`JSON.stringify((__foGenArchetypeSquad(${JSON.stringify(seed)},${JSON.stringify(String(rid).toUpperCase())},`
        + `${JSON.stringify(side.arch || 'engine')},null,${+side.str || 1},${JSON.stringify(tier)})||{}).players||[])`));
    } catch (e) { return; }
    DEALS.push({ seed, nat: String(rid).toUpperCase(), arch: side.arch || 'engine', str: +side.str || 1, tier });
    for (const p of players || []) pop.push({ nat: rid, club: side.name || ('slot' + slot), p });
  });
}
console.log(`\npopulation: ${pop.length} cricketers, dealt once`);

function priceAll(weights) {
  g(`(function(W){ for (var f in W) for (var k in W[f]) FO_VAL_W[f][k] = W[f][k]; })(${JSON.stringify(weights)})`);
  // FO_VAL_C is computed once from FO_VAL_W at load, so it has to be rebuilt
  // or the level would be normalised by the OLD row sums and every role would
  // drift by the ratio between them - which would look exactly like a re-fit
  // and would be an arithmetic slip.
  g(`(function(){ var S={}; for (var f in FO_VAL_W){ var t=0; for(var k in FO_VAL_W[f]) t+=FO_VAL_W[f][k]; S[f]=t; }
       for (var r in FO_VAL_MIX){ var m=FO_VAL_MIX[r];
         FO_VAL_C[r] = m.bat*S.bat + m.bowl*S.bowl + m.field*S.field + m.glove*S.glove; } })()`);
  return pop.map(x => {
    const v = JSON.parse(g(`JSON.stringify(window.foPlayerValue(${JSON.stringify(x.p)}))`));
    return { ovr: Math.max(0, Math.min(100, Math.round(v.ovr))), level: v.level, role: v.role };
  });
}
// FO_VAL_C is a const bound by an IIFE; make it writable for the experiment
g('try{ window.FO_VAL_C = FO_VAL_C; }catch(e){}');
const before = priceAll(OLD);
const after = priceAll(NEW);

const pct = (arr, q) => { const s = arr.slice().sort((a, b) => a - b); return s[Math.floor(q * (s.length - 1))]; };
const bo = before.map(x => x.ovr), ao = after.map(x => x.ovr);
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
console.log('\n=== OVR DISTRIBUTION, OLD vs NEW (same cricketers) ===');
console.log('              mean     p5    p25    p50    p75    p95    max   >=80   >=90');
for (const [nm, a] of [['old', bo], ['new', ao]])
  console.log(`  ${nm.padEnd(10)}${mean(a).toFixed(1).padStart(6)}`
    + [0.05, 0.25, 0.5, 0.75, 0.95].map(q => String(pct(a, q)).padStart(7)).join('')
    + String(Math.max(...a)).padStart(7)
    + String(a.filter(v => v >= 80).length).padStart(7)
    + String(a.filter(v => v >= 90).length).padStart(7));

const moved = pop.map((x, i) => ({
  name: x.p.name, club: x.club, nat: x.nat, role: x.p.role,
  bt: x.p.bowlTypeFull, old: before[i].ovr, neu: after[i].ovr,
  d: after[i].ovr - before[i].ovr, sk: x.p.skills
})).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
console.log('\n=== 30 BIGGEST MOVERS ===');
console.log('  name                     role             old  new    d   why');
for (const m of moved.slice(0, 30)) {
  const s = m.sk;
  const why = m.d < 0
    ? `field ${s.fielding}/${s.catching}`
    : `tmp ${s.temperament} econ ${s.economy}`;
  console.log('  ' + String(m.name).slice(0, 24).padEnd(25) + String(m.role).padEnd(17)
    + String(m.old).padStart(4) + String(m.neu).padStart(5) + String(m.d >= 0 ? '+' + m.d : m.d).padStart(5)
    + '   ' + why);
}

// ---------------------------------------------------------------------------
// AND NOW THE HALF THAT IS EASY TO MISS. Everything above holds the cricketers
// fixed and changes the price list, which is what a SAVED world would show at
// its next settle. It is not what a NEW world would look like.
//
// foFitToLevel aims at a target LEVEL and foLayOnTier deals marks as target
// OVRs, so the generator compensates: re-weighting does not move the OVR
// distribution of a freshly dealt world at all, it moves the SKILLS behind it.
// A world dealt under the new weights has the same number of 90s; they are
// different men, made of different attributes.
//
// Reporting only the fixed-population table would say "the re-fit doubles the
// number of 90-overall cricketers in the game", which is true of the existing
// save for one settle and false of the game.
// ---------------------------------------------------------------------------
function dealWorld(weights) {
  g(`(function(W){ for (var f in W) for (var k in W[f]) FO_VAL_W[f][k] = W[f][k]; })(${JSON.stringify(weights)})`);
  g(`(function(){ var S={}; for (var f in FO_VAL_W){ var t=0; for(var k in FO_VAL_W[f]) t+=FO_VAL_W[f][k]; S[f]=t; }
       for (var r in FO_VAL_MIX){ var m=FO_VAL_MIX[r];
         FO_VAL_C[r] = m.bat*S.bat + m.bowl*S.bowl + m.field*S.field + m.glove*S.glove; } })()`);
  const men = [];
  for (const spec of DEALS) {
    let players, seed, tier;
    try {
      players = JSON.parse(g(`JSON.stringify((__foGenArchetypeSquad(${JSON.stringify(spec.seed)},${JSON.stringify(spec.nat)},`
        + `${JSON.stringify(spec.arch)},null,${spec.str},${JSON.stringify(spec.tier)})||{}).players||[])`));
    } catch (e) { continue; }
    for (const p of players || []) {
      const v = JSON.parse(g(`JSON.stringify(window.foPlayerValue(${JSON.stringify(p)}))`));
      men.push({ ovr: Math.max(0, Math.min(100, Math.round(v.ovr))), sk: p.skills });
    }
  }
  return men;
}
const dOld = dealWorld(OLD), dNew = dealWorld(NEW);
const oo = dOld.map(x => x.ovr), nn = dNew.map(x => x.ovr);
console.log('\n=== A WORLD DEALT UNDER EACH PRICE LIST (re-DEALT, not re-priced) ===');
console.log('              mean     p5    p25    p50    p75    p95    max   >=80   >=90');
for (const [nm, a] of [['old', oo], ['new', nn]])
  console.log(`  ${nm.padEnd(10)}${mean(a).toFixed(1).padStart(6)}`
    + [0.05, 0.25, 0.5, 0.75, 0.95].map(q => String(pct(a, q)).padStart(7)).join('')
    + String(Math.max(...a)).padStart(7)
    + String(a.filter(v => v >= 80).length).padStart(7)
    + String(a.filter(v => v >= 90).length).padStart(7));
const SK = ['vsPace','vsSpin','power','rotation','temperament','wicket','economy',
  'discipline','moveTurn','variation','stamina','fielding','catching','keeping','stumping'];
console.log('\n=== WHAT THE GENERATOR HANDS OUT INSTEAD (median skill of the dealt world) ===');
console.log('  skill            old    new      d');
for (const k of SK) {
  const a = pct(dOld.map(x => x.sk[k] || 0), 0.5), b = pct(dNew.map(x => x.sk[k] || 0), 0.5);
  console.log('  ' + k.padEnd(15) + String(a).padStart(5) + String(b).padStart(7)
    + String(b - a >= 0 ? '+' + (b - a) : (b - a)).padStart(7));
}

// wages and fees follow the card, cubically
const FO_WAGE_MID = 9290, FO_WAGE_R50 = 50000, FO_WAGE_K = 3.0;
const wageOf = o => Math.max(400, Math.round(FO_WAGE_MID * Math.pow(Math.max(1, o * 1000) / FO_WAGE_R50, FO_WAGE_K) / 10) * 10);
const wb = bo.map(wageOf), wa = ao.map(wageOf);
console.log('\n=== WAGE BILL (whole population, before talents/scarcity) ===');
console.log(`  old  $${Math.round(wb.reduce((a, b) => a + b, 0)).toLocaleString()} a round`);
console.log(`  new  $${Math.round(wa.reduce((a, b) => a + b, 0)).toLocaleString()} a round`
  + `   (${((wa.reduce((a, b) => a + b, 0) / wb.reduce((a, b) => a + b, 0) - 1) * 100).toFixed(1)}%)`);
console.log(`  median man  $${pct(wb, 0.5).toLocaleString()} -> $${pct(wa, 0.5).toLocaleString()}`);
console.log(`  a fee is wage x 18 x 2.4 x age x form, so it moves with the wage by construction`);

fs.writeFileSync('docs/player-value-realism/refit.json', JSON.stringify({
  exposure: { spinShare: SPIN_W, vsPace: fitP, vsSpin: fitS },
  weights: { old: OLD, new: NEW },
  distribution: { old: { mean: mean(bo), p50: pct(bo, 0.5), p95: pct(bo, 0.95), ge80: bo.filter(v => v >= 80).length },
                  new: { mean: mean(ao), p50: pct(ao, 0.5), p95: pct(ao, 0.95), ge80: ao.filter(v => v >= 80).length } },
  movers: moved.slice(0, 60).map(m => ({ name: m.name, club: m.club, role: m.role, old: m.old, new: m.neu, d: m.d })),
  wages: { oldTotal: wb.reduce((a, b) => a + b, 0), newTotal: wa.reduce((a, b) => a + b, 0) }
}, null, 1));
