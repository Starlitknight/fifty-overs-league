#!/usr/bin/env node
/* tools/wage-decompose.mjs — WHOSE WAGES WENT UP, AND WHICH PART OF THE
 *                            RE-RATING PAID FOR IT
 *
 * FINAL ECONOMY ACCEPTANCE §1. The payroll rise is one number and a number is
 * not a diagnosis: the brief asks which MEN carry it and which of the three
 * changes - the attribute weights, the keeper's gloves, the experience layer -
 * actually moves the money.
 *
 * It reads a real settled world out of Postgres and re-prices every squad four
 * times, turning the three changes on one at a time in the order they were
 * decided. The wage curve is the engine's own and is never touched; only the
 * card underneath it moves, which is the whole point of the exercise.
 *
 *   node tools/wage-decompose.mjs --db=foworld_p3_test --country=eng
 */
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeEngine } from '../test/engine-vm.mjs';

const arg = (k, d) => (process.argv.find(a => a.startsWith(`--${k}=`)) || '').split('=')[1] || d;
// THE SQUADS COME FROM THE DUMP, NOT FROM THE DATABASE. world-p3 does not
// stop at the solvency assertion: later tests retire men and empty rosters on
// purpose, so by the time the run ends the clubs this is about have nobody in
// them - a first cut of this read the live database afterwards and priced a
// Division One payroll at zero. econ-dump writes the men as they stood at the
// moment the bank read what it read, and that file is the input here.
const HERE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const tag = arg('tag', 'final');
const src = arg('squads', path.join(HERE, 'docs', 'fast-bowler-generation', `econ-squads-${tag}.json`));
const clubs = JSON.parse(fs.readFileSync(src, 'utf8'));
const eng = makeEngine();
const g = k => vm.runInContext(k, eng.ctx);
g('try{ window.FO_VAL_C=FO_VAL_C; window.FO_VAL_W=FO_VAL_W; window.FO_VAL_MIX=FO_VAL_MIX; }catch(e){}');

const OLD_W = { bat:{vsPace:0.185,vsSpin:0.145,power:0.150,rotation:0.150,temperament:0.060},
  bowl:{wicket:0.415,economy:0.240,discipline:0.140,moveTurn:0.090,variation:0.060,stamina:0.030},
  field:{fielding:0.200,catching:0.110}, glove:{catching:0.226,keeping:0.045,stumping:0.030} };
const OLD_MIX = { bat:{bat:1,bowl:0,field:0.45,glove:0}, bowl:{bat:0,bowl:1,field:0.45,glove:0},
  ar:{bat:0.80,bowl:0.80,field:0.45,glove:0}, wk:{bat:1,bowl:0,field:0,glove:1.20} };
const NEW_W = JSON.parse(g('JSON.stringify(FO_VAL_W)'));
const NEW_MIX = JSON.parse(g('JSON.stringify(FO_VAL_MIX)'));
// the middle rungs: the new weights and the new field mix, but the old gloves
const MID_MIX = JSON.parse(JSON.stringify(NEW_MIX)); MID_MIX.wk.glove = 1.20;

const setLaw = (W, M) => g(`(function(W,M){for(var f in W)for(var k in W[f])FO_VAL_W[f][k]=W[f][k];
  for(var r in M)for(var k2 in M[r])FO_VAL_MIX[r][k2]=M[r][k2];
  var S={};for(var f2 in FO_VAL_W){var t=0;for(var k3 in FO_VAL_W[f2])t+=FO_VAL_W[f2][k3];S[f2]=t;}
  for(var r2 in FO_VAL_MIX){var m=FO_VAL_MIX[r2];
    FO_VAL_C[r2]=m.bat*S.bat+m.bowl*S.bowl+m.field*S.field+m.glove*S.glove;}})(${JSON.stringify(W)},${JSON.stringify(M)})`);
const expOff = v => g(`__foExpOvrOff=${v ? 1 : 0};1`);
const ovrOf = p => Math.max(0, Math.min(100, Math.round(
  JSON.parse(g(`JSON.stringify(window.foPlayerValue(${JSON.stringify(p)}))`)).ovr)));
const wageOf = (o, tal) => Math.max(400, Math.round(
  9290 * Math.pow(Math.max(1, o * 1000) / 50000, 3) * (1 + 0.06 * Math.max(0, tal | 0)) / 10) * 10);

// the four rungs, in the order the phase decided them
const ARMS = [
  ['OLD          ', OLD_W, OLD_MIX, true],
  ['+ weights    ', NEW_W, OLD_MIX, true],   // new attribute weights, old mixtures
  ['+ field/mix  ', NEW_W, MID_MIX, true],   // ...and field 0.45 -> 1.00
  ['+ gloves 1.80', NEW_W, NEW_MIX, true],   // ...and the keeper's gloves
  ['+ experience ', NEW_W, NEW_MIX, false]   // = FINAL
];

const price = (squad, W, M, off) => {
  expOff(off); setLaw(W, M);
  let t = 0; const per = [];
  for (const p of squad || []) {
    const o = ovrOf(p), w = wageOf(o, (p.talents || []).length);
    per.push({ name: p.name, role: p.role, ovr: o, wage: w }); t += w;
  }
  return { total: t, per };
};

console.log(`\n=== ${tag}: THE PAYROLL AT THE SOLVENCY ASSERTION, RUNG BY RUNG (per round) ===`);
console.log('  club                ' + ARMS.map(a => a[0].trim().padStart(13)).join('') + '     total d');
const arms = {};
for (const a of ARMS) arms[a[0]] = 0;
for (const c of clubs) {
  const row = ARMS.map(a => price(c.squad, a[1], a[2], a[3]).total);
  for (let i = 0; i < ARMS.length; i++) arms[ARMS[i][0]] += row[i];
  console.log('  ' + String(c.name).slice(0, 18).padEnd(20)
    + row.map(v => ('$' + v.toLocaleString()).padStart(13)).join('')
    + ((100 * (row[row.length - 1] / Math.max(1, row[0]) - 1)).toFixed(1) + '%').padStart(12));
}
const base = arms[ARMS[0][0]];
console.log('\n  world total         ' + ARMS.map(a => ('$' + arms[a[0]].toLocaleString()).padStart(13)).join(''));
console.log('  cumulative rise     ' + ARMS.map(a =>
  ((100 * (arms[a[0]] / base - 1)).toFixed(2) + '%').padStart(13)).join(''));
let prev = base;
console.log('  step alone          ' + ARMS.map(a => {
  const d = 100 * (arms[a[0]] / prev - 1); prev = arms[a[0]];
  return (d.toFixed(2) + '%').padStart(13); }).join(''));

// AND THE MEN. Who actually carries the rise at the club that misses the floor.
const worst = clubs.slice().sort((a, b) => Number(a.bank) - Number(b.bank))[0];
const a0 = price(worst.squad, OLD_W, OLD_MIX, true), a1 = price(worst.squad, NEW_W, NEW_MIX, false);
console.log(`\n=== ${worst.name}: WHO CARRIES IT (bank $${Number(worst.bank).toLocaleString()}) ===`);
console.log('  man                    role              ovr old -> new     wage old -> new        d');
const rows = a0.per.map((p, i) => ({ ...p, ovr2: a1.per[i].ovr, wage2: a1.per[i].wage,
  d: a1.per[i].wage - p.wage })).sort((x, y) => y.d - x.d);
for (const r of rows) console.log('  ' + String(r.name).slice(0, 20).padEnd(22)
  + String(r.role || '?').padEnd(18) + (r.ovr + ' -> ' + r.ovr2).padStart(11)
  + ('$' + r.wage.toLocaleString() + ' -> $' + r.wage2.toLocaleString()).padStart(24)
  + (('+$' + r.d.toLocaleString()).replace('+$-', '-$')).padStart(11));
console.log(`  payroll $${a0.total.toLocaleString()} -> $${a1.total.toLocaleString()}`
  + `  (+$${(a1.total - a0.total).toLocaleString()} a round, `
  + `${(100 * (a1.total / a0.total - 1)).toFixed(1)}%)`);
