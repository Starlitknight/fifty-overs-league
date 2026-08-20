#!/usr/bin/env node
/* tools/rerating-impact.mjs — WHAT RE-RATING THE EXISTING WORLD ACTUALLY COSTS
 *
 * PART B §14-§15. The candidate weights do not change how good newly dealt
 * cricketers are - the generator targets an overall and absorbs a re-pricing
 * (measured in docs/player-value-realism/REPORT.md). What they change is the
 * CARD of the men who already exist, because those cards were computed with
 * the old weights.
 *
 * That is a product decision rather than a measurement, and it cannot be taken
 * on a mean. So this prints the whole movement distribution - how many men move
 * by one point, by two, by five, by more - who they are by role, and what it
 * does to each division's payroll, which is the half of the question that
 * decides whether anything needs normalising.
 *
 *   node tools/rerating-impact.mjs
 */
import vm from 'node:vm';
import fs from 'node:fs';
import { makeEngine } from '../test/engine-vm.mjs';
import { dealWorld } from './bowling-type-probe.mjs';

const eng = makeEngine();
const g = k => vm.runInContext(k, eng.ctx);
const P = JSON.parse(fs.readFileSync('docs/fast-bowler-generation/pair-tests.json', 'utf8'));
const { OLD, NEW } = P.weights, { MIX_OLD, MIX_NEW } = P.mix;

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

const clubs = dealWorld();
const men = [];
for (const c of clubs) for (const p of c.players) men.push({ c, p });
expOff(true); setLaw(OLD, MIX_OLD); const before = men.map(m => ovrOf(m.p));
expOff(false); setLaw(NEW, MIX_NEW); const after = men.map(m => ovrOf(m.p));

const d = men.map((m, i) => ({ name: m.p.name, role: m.p.role, club: m.c.name, div: m.c.div,
  tier: m.c.tier, old: before[i], neu: after[i], d: after[i] - before[i] }));

const band = (lo, hi) => d.filter(x => Math.abs(x.d) >= lo && (hi == null || Math.abs(x.d) <= hi)).length;
console.log(`\n=== §14 HOW FAR ${d.length} EXISTING CRICKETERS MOVE ===`);
console.log(`  no change        ${d.filter(x => x.d === 0).length}`);
console.log(`  +-1              ${band(1, 1)}`);
console.log(`  +-2              ${band(2, 2)}`);
console.log(`  +-3              ${band(3, 3)}`);
console.log(`  +-4              ${band(4, 4)}`);
console.log(`  +-5              ${band(5, 5)}`);
console.log(`  more than 5      ${band(6, null)}`);
const up = d.slice().sort((a, b) => b.d - a.d), dn = d.slice().sort((a, b) => a.d - b.d);
console.log(`\n  largest rise  ${up[0].d >= 0 ? '+' + up[0].d : up[0].d}  ${up[0].name} (${up[0].role}, ${up[0].old} -> ${up[0].neu})`);
console.log(`  largest fall  ${dn[0].d}  ${dn[0].name} (${dn[0].role}, ${dn[0].old} -> ${dn[0].neu})`);

const byRole = {};
for (const x of d) {
  const r = byRole[x.role] = byRole[x.role] || { n: 0, up: 0, down: 0, sum: 0 };
  r.n++; r.sum += x.d; if (x.d > 0) r.up++; if (x.d < 0) r.down++;
}
console.log('\n  role                    n     up   down   mean d');
for (const k of Object.keys(byRole).sort((a, b) => byRole[b].n - byRole[a].n))
  console.log('  ' + k.padEnd(20) + String(byRole[k].n).padStart(6)
    + String(byRole[k].up).padStart(7) + String(byRole[k].down).padStart(7)
    + (byRole[k].sum / byRole[k].n).toFixed(2).padStart(9));

// ---------------------------------------------------------------------------
// §15 THE MONEY.
// ---------------------------------------------------------------------------
const pct = (a, q) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(q * (s.length - 1))]; };
const wb = before.map(WAGE), wa = after.map(WAGE);
const sum = a => a.reduce((x, y) => x + y, 0);
console.log('\n=== §15 THE WAGE BILL ===');
console.log(`  total       $${sum(wb).toLocaleString()}  ->  $${sum(wa).toLocaleString()}`
  + `   (${((sum(wa) / sum(wb) - 1) * 100).toFixed(1)}%)`);
for (const [q, nm] of [[0.5, 'median'], [0.9, 'P90'], [0.99, 'P99']])
  console.log(`  ${nm.padEnd(10)}  $${pct(wb, q).toLocaleString()}  ->  $${pct(wa, q).toLocaleString()}`);
console.log(`  top wage    $${Math.max(...wb).toLocaleString()}  ->  $${Math.max(...wa).toLocaleString()}`);

const byClub = {};
men.forEach((m, i) => {
  const k = m.c.nat + '|' + m.c.slot;
  const b = byClub[k] = byClub[k] || { div: m.c.div, tier: m.c.tier, old: 0, neu: 0 };
  b.old += wb[i]; b.neu += wa[i];
});
const clubsArr = Object.values(byClub);
console.log('\n  club payroll by division (mean per club, per round)');
for (const dv of [1, 2]) {
  const sub = clubsArr.filter(c => c.div === dv);
  const o = sum(sub.map(c => c.old)) / sub.length, n = sum(sub.map(c => c.neu)) / sub.length;
  console.log(`    division ${dv}   $${Math.round(o).toLocaleString()}  ->  $${Math.round(n).toLocaleString()}`
    + `   (${((n / o - 1) * 100).toFixed(1)}%)`);
}
console.log('\n  club payroll by tier');
for (const t of ['flagship', 'd1a', 'd1b', 'd2a', 'd2b', 'newcomer']) {
  const sub = clubsArr.filter(c => c.tier === t);
  if (!sub.length) continue;
  const o = sum(sub.map(c => c.old)) / sub.length, n = sum(sub.map(c => c.neu)) / sub.length;
  console.log(`    ${t.padEnd(10)} $${Math.round(o).toLocaleString()}  ->  $${Math.round(n).toLocaleString()}`
    + `   (${((n / o - 1) * 100).toFixed(1)}%)`);
}
// the worst case a single club sees, which is what a manager actually feels
const worst = clubsArr.map(c => c.neu / c.old - 1).sort((a, b) => b - a);
console.log(`\n  worst single club   ${(100 * worst[0]).toFixed(1)}%   best ${(100 * worst[worst.length - 1]).toFixed(1)}%`);

fs.writeFileSync('docs/fast-bowler-generation/rerating-impact.json', JSON.stringify({
  bands: { zero: d.filter(x => x.d === 0).length, one: band(1, 1), two: band(2, 2),
    three: band(3, 3), four: band(4, 4), five: band(5, 5), more: band(6, null) },
  largestRise: up[0], largestFall: dn[0], byRole,
  wages: { oldTotal: sum(wb), newTotal: sum(wa) },
  movers: d.slice().sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 40)
}, null, 1));
