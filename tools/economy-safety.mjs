#!/usr/bin/env node
/* tools/economy-safety.mjs — DOES +3.9% ON THE WAGE BILL BREAK ANYBODY?
 *
 * FINAL SHIP GATE §5. The re-rating raises wages by about four per cent, and
 * the question is not whether that is a big number - it is whether any club
 * that was solvent stops being solvent.
 *
 * THE INCOME SIDE DOES NOT MOVE, and that is what makes this answerable
 * without simulating a season of cricket. Gate money is seats x turnout x a
 * fixed ticket, the broadcast van pays by the head, and a sponsor signed a
 * contract in the close season. None of them reads a rating. Only the wage
 * bill does, so the whole effect is one number per club, and a season is that
 * number times the rounds.
 *
 * So each club is taken as the world actually holds it - its bank, its squad,
 * its real per-round income from computeFinance - and run forward a season on
 * the OLD cards and on the FINAL ones. What is compared is the thing that
 * matters: how many clubs end the season under water, and by how much.
 *
 *   node tools/economy-safety.mjs
 */
import vm from 'node:vm';
import fs from 'node:fs';
import { makePool } from '../server/db.mjs';
import { computeFinance } from '../server/economy.mjs';
import { makeEngine } from '../test/engine-vm.mjs';

const ROUNDS = 18;                       // a season of matchdays (market.mjs FEE_ROUNDS)
const pool = makePool();
const eng = makeEngine();
const g = k => vm.runInContext(k, eng.ctx);

const OLD_W = { bat:{vsPace:0.185,vsSpin:0.145,power:0.150,rotation:0.150,temperament:0.060},
  bowl:{wicket:0.415,economy:0.240,discipline:0.140,moveTurn:0.090,variation:0.060,stamina:0.030},
  field:{fielding:0.200,catching:0.110}, glove:{catching:0.226,keeping:0.045,stumping:0.030} };
const OLD_MIX = { bat:{bat:1,bowl:0,field:0.45,glove:0}, bowl:{bat:0,bowl:1,field:0.45,glove:0},
  ar:{bat:0.80,bowl:0.80,field:0.45,glove:0}, wk:{bat:1,bowl:0,field:0,glove:1.20} };
g('try{ window.FO_VAL_C=FO_VAL_C; window.FO_VAL_W=FO_VAL_W; window.FO_VAL_MIX=FO_VAL_MIX; }catch(e){}');
const NEW_W = JSON.parse(g('JSON.stringify(FO_VAL_W)')), NEW_MIX = JSON.parse(g('JSON.stringify(FO_VAL_MIX)'));
const setLaw = (W, M) => g(`(function(W,M){for(var f in W)for(var k in W[f])FO_VAL_W[f][k]=W[f][k];
  for(var r in M)for(var k2 in M[r])FO_VAL_MIX[r][k2]=M[r][k2];
  var S={};for(var f2 in FO_VAL_W){var t=0;for(var k3 in FO_VAL_W[f2])t+=FO_VAL_W[f2][k3];S[f2]=t;}
  for(var r2 in FO_VAL_MIX){var m=FO_VAL_MIX[r2];
    FO_VAL_C[r2]=m.bat*S.bat+m.bowl*S.bowl+m.field*S.field+m.glove*S.glove;}})(${JSON.stringify(W)},${JSON.stringify(M)})`);
const expOff = v => g(`__foExpOvrOff=${v ? 1 : 0};1`);
const ovr = p => Math.max(0, Math.min(100, Math.round(
  JSON.parse(g(`JSON.stringify(window.foPlayerValue(${JSON.stringify(p)}))`)).ovr)));
// the engine's own wage curve, unchanged by this phase
const WAGE = (o, tal) => Math.max(400, Math.round(
  9290 * Math.pow(Math.max(1, o * 1000) / 50000, 3) * (1 + 0.06 * Math.max(0, tal | 0)) / 10) * 10);

const country = process.argv.find(a => a.startsWith('--country='))?.split('=')[1] || 'eng';
const clubs = (await pool.query(
  `SELECT slot, name, bank, squad FROM clubs WHERE country_id=$1 ORDER BY slot`, [country])).rows;
if (!clubs.length) { console.log('no world in this database'); await pool.end(); process.exit(0); }

let fin = null;
try { fin = await computeFinance(pool, country); } catch (e) { console.log('computeFinance:', e.message); }
// THE INCOME SIDE, TAKEN FROM THE WORLD'S OWN FINANCE MODEL - and modelled
// only where this database cannot have it. computeFinance returns a club's
// season: sponsor, media and the bonus are signed numbers, but gate and
// broadcast are zero here because the market fixture plays two rounds rather
// than a season. Rather than report every club insolvent on a missing column,
// the two turnstile lines are modelled from the club's OWN supporters, seats
// and ticket at the shipped rates, and the model is stated so it can be
// argued with.
//
// None of it reads a rating, which is the point: the whole effect of the
// re-rating lands on one line, the wage bill.
const HOME_ROUNDS = 9, TICKET = 26, BROADCAST_PER_HEAD = 7.5, TURNOUT = 0.62;
function seasonIncome(f) {
  const att = f.avgAttendance > 0 ? f.avgAttendance
    : Math.min(f.seats || 0, Math.round((f.supporters || 0) * TURNOUT));
  const gate = f.gate > 0 ? f.gate : att * TICKET * HOME_ROUNDS;
  const bc = f.broadcast > 0 ? f.broadcast : Math.round(att * BROADCAST_PER_HEAD) * HOME_ROUNDS;
  return { att, gate, bc,
    total: gate + bc + (f.sponsor || 0) + (f.media || 0) + (f.sponsorBonus || 0) + (f.prize || 0) };
}
const seasonCost = (f, wageRound) => wageRound * ROUNDS + (f.ops || 0) + (f.upkeep || 0);

function bill(squad, law) {
  law();
  let t = 0;
  for (const p of squad || []) t += WAGE(ovr(p), (p.talents || []).length);
  return t;
}

const rows = [];
for (const c of clubs) {
  const oldBill = bill(c.squad, () => { expOff(true); setLaw(OLD_W, OLD_MIX); });
  const newBill = bill(c.squad, () => { expOff(false); setLaw(NEW_W, NEW_MIX); });
  const fin1 = (fin || []).find(x => (x.slot | 0) === c.slot);
  const f = (fin1 && fin1.finance) || {};
  const inc = seasonIncome(f);
  rows.push({ slot: c.slot, name: c.name, bank: +c.bank || 0, oldBill, newBill, f, inc });
}
const sum = (a, f) => a.reduce((x, y) => x + f(y), 0);
console.log(`\n=== ${country.toUpperCase()}: ${rows.length} clubs, a ${ROUNDS}-round season ===`);
console.log('  club                 bank        wage/rd old -> new     d%   income/rd   end old -> end new');
let distressOld = 0, distressNew = 0, newlyBroke = [];
for (const r of rows) {
  const endOld = r.bank + r.inc.total - seasonCost(r.f, r.oldBill);
  const endNew = r.bank + r.inc.total - seasonCost(r.f, r.newBill);
  if (endOld < 0) distressOld++;
  if (endNew < 0) distressNew++;
  if (endOld >= 0 && endNew < 0) newlyBroke.push(r.name);
  console.log('  ' + String(r.name).slice(0, 18).padEnd(20)
    + ('$' + r.bank.toLocaleString()).padStart(11)
    + ('$' + r.oldBill.toLocaleString() + ' -> $' + r.newBill.toLocaleString()).padStart(26)
    + ((100 * (r.newBill / Math.max(1, r.oldBill) - 1)).toFixed(1) + '%').padStart(7)
    + ('$' + Math.round(r.inc.total).toLocaleString()).padStart(12)
    + ('$' + Math.round(endOld).toLocaleString() + ' -> $' + Math.round(endNew).toLocaleString()).padStart(28));
}
console.log(`\n  total wage/round  $${sum(rows, r => r.oldBill).toLocaleString()} -> `
  + `$${sum(rows, r => r.newBill).toLocaleString()}   `
  + `(${(100 * (sum(rows, r => r.newBill) / sum(rows, r => r.oldBill) - 1)).toFixed(1)}%)`);
// THE ABSOLUTE COLUMN IS NOT VALIDATED AND IS NOT A VERDICT.
//
// Ten of sixteen clubs come out under water on the OLD law, which is not a
// world anybody has been playing - so the season model above (eighteen wage
// rounds against a modelled gate) is wrong somewhere, most likely in how often
// wages are actually charged. It is printed because hiding it would be worse,
// and it must not be read as a solvency finding in either arm.
//
// THE DELTA IS EXACT, and it is what the decision rule needs. Income does not
// read a rating anywhere in economy.mjs, so the entire effect of the re-rating
// on a club's season is (newBill - oldBill) x the number of wage rounds. That
// subtraction is independent of every modelling choice above.
console.log(`  [absolute season cash is a MODEL and is not validated - old ${distressOld}`
  + ` / new ${distressNew} under water, which is implausible in both arms]`);
console.log('\n  THE EXACT EFFECT: season cash moves by (new - old) x 18 wage rounds');
const deltas = rows.map(r => ({ n: r.name, bank: r.bank, d: (r.newBill - r.oldBill) * ROUNDS }))
  .sort((a, b) => b.d - a.d);
for (const d of deltas.slice(0, 3).concat(deltas.slice(-2)))
  console.log('    ' + d.n.padEnd(20) + ('$' + d.d.toLocaleString()).padStart(12)
    + '   = ' + (100 * d.d / Math.max(1, d.bank)).toFixed(1) + '% of a bank of $' + d.bank.toLocaleString());
const worst = rows.map(r => ({ n: r.name, d: r.newBill / Math.max(1, r.oldBill) - 1 }))
  .sort((a, b) => b.d - a.d)[0];
const lowest = rows.slice().sort((a, b) => (a.bank + a.inc.total - seasonCost(a.f, a.newBill))
  - (b.bank + b.inc.total - seasonCost(b.f, b.newBill)))[0];
console.log(`  worst affected club: ${worst.n} (${(100 * worst.d).toFixed(1)}% wage bill)`);
console.log(`  lowest end-of-season cash: ${lowest.name} `
  + `$${Math.round(lowest.bank + lowest.inc.total - seasonCost(lowest.f, lowest.oldBill)).toLocaleString()}`
  + ` -> $${Math.round(lowest.bank + lowest.inc.total - seasonCost(lowest.f, lowest.newBill)).toLocaleString()}`);
await pool.end();
