#!/usr/bin/env node
/* tools/ovr-accuracy.mjs — HOW WELL DOES THE CARD PREDICT THE CRICKET?
 *
 * FINAL CLOSURE §11. The card's job is to rank cricketers, so the test is
 * whether its ranking matches the engine's. Every archetype in
 * role-mix.json was played in the same seat of the same XI on the same 600
 * seeds, so the measured margin is a fixed yardstick and the two laws can be
 * scored against it without playing another ball.
 *
 * THREE NUMBERS, BY ROLE. Pearson correlation says whether the card tracks the
 * engine at all; pair-ordering accuracy says how often it gets two men the
 * right way round, which is what a manager actually experiences; and the mean
 * absolute mis-price in RUNS says by how much it is wrong when it is wrong.
 *
 *   node tools/ovr-accuracy.mjs
 */
import vm from 'node:vm';
import fs from 'node:fs';
import { makeEngine } from '../test/engine-vm.mjs';

const eng = makeEngine();
const g = k => vm.runInContext(k, eng.ctx);
const R = JSON.parse(fs.readFileSync('docs/fast-bowler-generation/role-mix.json', 'utf8'));
const RPO = 1.13;                        // runs of margin bought by one overall

const OLD_W = { bat:{vsPace:0.185,vsSpin:0.145,power:0.150,rotation:0.150,temperament:0.060},
  bowl:{wicket:0.415,economy:0.240,discipline:0.140,moveTurn:0.090,variation:0.060,stamina:0.030},
  field:{fielding:0.200,catching:0.110}, glove:{catching:0.226,keeping:0.045,stumping:0.030} };
const OLD_MIX = { bat:{bat:1,bowl:0,field:0.45,glove:0}, bowl:{bat:0,bowl:1,field:0.45,glove:0},
  ar:{bat:0.80,bowl:0.80,field:0.45,glove:0}, wk:{bat:1,bowl:0,field:0,glove:1.20} };

g('try{ window.FO_VAL_C=FO_VAL_C; window.FO_VAL_W=FO_VAL_W; window.FO_VAL_MIX=FO_VAL_MIX; }catch(e){}');
const setLaw=(W,M)=>g(`(function(W,M){for(var f in W)for(var k in W[f])FO_VAL_W[f][k]=W[f][k];
  for(var r in M)for(var k2 in M[r])FO_VAL_MIX[r][k2]=M[r][k2];
  var S={};for(var f2 in FO_VAL_W){var t=0;for(var k3 in FO_VAL_W[f2])t+=FO_VAL_W[f2][k3];S[f2]=t;}
  for(var r2 in FO_VAL_MIX){var m=FO_VAL_MIX[r2];
    FO_VAL_C[r2]=m.bat*S.bat+m.bowl*S.bowl+m.field*S.field+m.glove*S.glove;}})(${JSON.stringify(W)},${JSON.stringify(M)})`);
const expOff=v=>g(`__foExpOvrOff=${v?1:0};1`);
const ovr=p=>Math.max(0,Math.min(100,Math.round(JSON.parse(g(`JSON.stringify(window.foPlayerValue(${JSON.stringify(p)}))`)).ovr)));

function score(rows, cards) {
  const m = rows.map(r => r.margin.mean);
  const mean = a => a.reduce((x,y)=>x+y,0)/a.length;
  const mo = mean(cards), mm = mean(m);
  const cov = cards.reduce((a,x,i)=>a+(x-mo)*(m[i]-mm),0);
  const so = Math.sqrt(cards.reduce((a,x)=>a+(x-mo)**2,0));
  const sm = Math.sqrt(m.reduce((a,x)=>a+(x-mm)**2,0));
  let right=0, total=0, err=0;
  for (let i=0;i<rows.length;i++) for (let j=i+1;j<rows.length;j++) {
    // only pairs the ENGINE separates by more than its own noise get a verdict
    const gap = m[i]-m[j], se = Math.hypot(rows[i].margin.se, rows[j].margin.se);
    if (Math.abs(gap) < 2*se) continue;
    total++;
    if (Math.sign(cards[i]-cards[j]) === Math.sign(gap)) right++;
    err += Math.abs((cards[i]-cards[j])*RPO - gap);
  }
  return { r: cov/Math.max(1e-9,so*sm), acc: total?right/total:1, pairs: total,
           mae: total?err/total:0 };
}

console.log('\n=== §11 CARD vs ENGINE, BY ROLE ===');
console.log('  role            law        r     pair order    mis-price (runs)');
const out = {};
for (const [role, data] of [['keeper', R.wk], ['all-rounder', R.ar]]) {
  if (!data) continue;
  const men = data.rows.map((r, i) => ({ row: r, i }));
  // the probe stores only summaries, so the men are rebuilt from the same
  // specs the probe used - identical construction, identical cards
  const specs = data.specs || null;
  if (!specs) { console.log(`  ${role}: no specs banked, skipped`); continue; }
  expOff(true); setLaw(OLD_W, OLD_MIX);
  const oldCards = specs.map(ovr);
  expOff(false); setLaw(JSON.parse(fs.readFileSync('docs/fast-bowler-generation/final-weights.json','utf8')).FO_VAL_W,
                       JSON.parse(fs.readFileSync('docs/fast-bowler-generation/final-weights.json','utf8')).FO_VAL_MIX);
  const newCards = specs.map(ovr);
  const o = score(data.rows, oldCards), n = score(data.rows, newCards);
  out[role] = { old: o, final: n };
  console.log(`  ${role.padEnd(14)} OLD   ${o.r.toFixed(3)}   ${(100*o.acc).toFixed(0)}% of ${o.pairs}      ${o.mae.toFixed(1)}`);
  console.log(`  ${''.padEnd(14)} FINAL ${n.r.toFixed(3)}   ${(100*n.acc).toFixed(0)}% of ${n.pairs}      ${n.mae.toFixed(1)}`);
}
fs.writeFileSync('docs/fast-bowler-generation/ovr-accuracy.json', JSON.stringify(out, null, 1));
