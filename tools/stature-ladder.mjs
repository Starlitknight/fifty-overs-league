#!/usr/bin/env node
/* tools/stature-ladder.mjs — THE PREMISE THE FLOOR WAS BUILT ON, RE-MEASURED
 *
 * ERA 2 ECONOMIC STATURE REALISM, sections 3, 5, 6 and 10.
 *
 * The floor's own justification is written into server/economy.mjs above
 * econStature, and it is an empirical claim:
 *
 *   "mean squad rating over four nations runs 36,064 at the flagship down to
 *    25,773 by slot four - and then STOPS, sitting between 23,000 and 24,300
 *    for every slot from six to fifteen. The generator has a floor on how bad
 *    a professional gets. The income ladder had none, so it kept descending
 *    past the point the squads did."
 *
 * That is a falsifiable statement about the generator, and the generator has
 * been rebuilt twice since (the canonical player model, then fast-bowler
 * generation and the value model). This measures it again, with the shipped
 * generator, over all sixteen nations rather than four - and then asks the
 * question the floor exists to answer: where, if anywhere, does the STRENGTH
 * ladder stop, and is the INCOME ladder still descending past it?
 *
 *   node tools/stature-ladder.mjs
 */
import { makeSquadShop, tierOf, mean, pct, $ } from './economy-audit.mjs';
import { stature, econStature, foundingSupport, supportTarget } from '../server/economy.mjs';
import { sponsorSeasonValue } from '../server/financeconfig.mjs';

const shop = makeSquadShop();
const bySlot = {};
for (const rid of shop.nations) {
  shop.sidesOf(rid).forEach((side, slot) => {
    const isBoss = !!side.boss, div = side.div || (slot < 8 ? 1 : 2);
    const players = shop.deal(`${rid}|${slot}`, rid, side.arch, side.str, tierOf(slot, isBoss, div));
    if (!players.length) return;
    const rat = players.map(p => +p.rating || 0).filter(x => x > 0);
    (bySlot[slot] = bySlot[slot] || []).push({
      rid, slot, isBoss, div, n: players.length,
      wage: shop.wageOf(players),
      rating: mean(rat),
      top11: mean(rat.slice().sort((a, b) => b - a).slice(0, 11))
    });
  });
}

const SLOTS = Object.keys(bySlot).map(Number).sort((a, b) => a - b);
console.log('=== 3. THE STRENGTH LADDER, RE-MEASURED (16 nations, the shipped generator) ===\n');
console.log('  slot  div     n   mean rating   best XI rating    payroll/round   step vs slot above');
let prev = null;
for (const s of SLOTS) {
  const g = bySlot[s];
  const r = mean(g.map(x => x.rating)), t = mean(g.map(x => x.top11)), w = mean(g.map(x => x.wage));
  const step = prev == null ? '' : ((r / prev - 1) * 100).toFixed(1) + '%';
  console.log('  ' + String(s).padStart(4) + String(s < 8 ? 1 : 2).padStart(5)
    + String(g.length).padStart(6) + Math.round(r).toLocaleString().padStart(14)
    + Math.round(t).toLocaleString().padStart(17) + $(w).padStart(17) + step.padStart(20));
  prev = r;
}

const rAt = s => mean(bySlot[s].map(x => x.rating));
console.log('\n  THE CLAIM: ratings flatten between 23,000 and 24,300 from slot 6 to slot 15.');
const flatSlots = SLOTS.filter(s => s >= 6);
const lo = Math.min(...flatSlots.map(rAt)), hi = Math.max(...flatSlots.map(rAt));
console.log('  MEASURED slots 6-15: ' + Math.round(lo).toLocaleString() + ' to '
  + Math.round(hi).toLocaleString() + '  (spread ' + ((hi / lo - 1) * 100).toFixed(1) + '%)');
console.log('  slot 6 = ' + Math.round(rAt(6)).toLocaleString()
  + ',  slot 15 = ' + Math.round(rAt(15)).toLocaleString()
  + '  ->  the ladder ' + (hi / lo > 1.15 ? 'DOES NOT FLATTEN. The premise is dead.'
    : 'still flattens; the premise survives.'));

// where does the ladder actually stop descending?
console.log('\n  WHERE THE STRENGTH LADDER REALLY STOPS (step from one seat to the next):');
for (let i = 1; i < SLOTS.length; i++) {
  const s = SLOTS[i], step = (rAt(s) / rAt(SLOTS[i - 1]) - 1) * 100;
  console.log('    slot ' + String(SLOTS[i - 1]).padStart(2) + ' -> ' + String(s).padStart(2)
    + '   ' + (step >= 0 ? '+' : '') + step.toFixed(1) + '%'
    + (Math.abs(step) < 1.5 ? '   <- flat' : ''));
}

// ---------------------------------------------------------------------------
console.log('\n=== 5. DOES THE COORDINATE STILL TRACK THE CLUB? (rank correlation) ===\n');
// TIES TAKE THE AVERAGE RANK, and getting that wrong produced a genuinely
// misleading number here. The floored coordinate is CONSTANT across all 128
// Division Two clubs. Ranking ties by their position in the array made that
// constant come out as "slot order", which then correlated -0.771 with a
// payroll that descends - a strong inverse relationship reported for a vector
// that carries no information at all. A constant has no correlation with
// anything, and that is the finding; a spurious -0.771 hides it.
const fmtR = x => (Number.isNaN(x) ? 'constant - no information' : x.toFixed(3));
const spearman = (a, b) => {
  const isConst = v => v.every(x => x === v[0]);
  if (isConst(a) || isConst(b)) return NaN;
  const rk = v => {
    const idx = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]);
    const r = new Array(v.length);
    for (let i = 0; i < idx.length;) {
      let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k2 = i; k2 <= j; k2++) r[idx[k2][1]] = avg;
      i = j + 1;
    }
    return r;
  };
  const ra = rk(a), rb = rk(b), n = a.length;
  const ma = mean(ra), mb = mean(rb);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { num += (ra[i] - ma) * (rb[i] - mb); da += (ra[i] - ma) ** 2; db += (rb[i] - mb) ** 2; }
  return num / Math.sqrt(da * db);
};
const all = SLOTS.flatMap(s => bySlot[s]);
const raws = all.map(x => stature(x.slot, x.isBoss));
const flrs = all.map(x => econStature(x.slot, x.isBoss));
console.log('  across all 256 clubs:');
console.log('    raw stature     vs payroll        ' + fmtR(spearman(raws, all.map(x => x.wage))));
console.log('    floored stature vs payroll        ' + fmtR(spearman(flrs, all.map(x => x.wage))));
console.log('    raw stature     vs squad rating   ' + fmtR(spearman(raws, all.map(x => x.rating))));
console.log('    floored stature vs squad rating   ' + fmtR(spearman(flrs, all.map(x => x.rating))));
const d2 = all.filter(x => x.div === 2);
console.log('\n  inside division two only (the 128 clubs the floor touches):');
console.log('    raw stature     vs payroll        '
  + fmtR(spearman(d2.map(x => stature(x.slot, x.isBoss)), d2.map(x => x.wage))));
console.log('    floored stature vs payroll        '
  + fmtR(spearman(d2.map(x => econStature(x.slot, x.isBoss)), d2.map(x => x.wage)))
  + '   <- a constant correlates with nothing');
console.log('    raw stature     vs squad rating   '
  + fmtR(spearman(d2.map(x => stature(x.slot, x.isBoss)), d2.map(x => x.rating))));

// ---------------------------------------------------------------------------
console.log('\n=== 6. SAME-DIVISION STRUCTURAL FAIRNESS ===\n');
console.log('  Within one division, before any managerial choice: how much more');
console.log('  expensive is the dearest dealt squad than the cheapest, and how much');
console.log('  more commercial base does its seat get to pay for it?');
for (const dv of [1, 2]) {
  const seatsIn = SLOTS.filter(s => (s < 8 ? 1 : 2) === dv);
  const top = seatsIn[0], bot = seatsIn[seatsIn.length - 1];
  const wTop = mean(bySlot[top].map(x => x.wage)), wBot = mean(bySlot[bot].map(x => x.wage));
  const gTop = foundingSupport(top, top === 0), gBot = foundingSupport(bot, false);
  const sTop = sponsorSeasonValue(dv, 1, 8, 1, econStature(top, top === 0));
  const sBot = sponsorSeasonValue(dv, 8, 8, 1, econStature(bot, false));
  console.log(`  DIVISION ${dv}   (slot ${top} against slot ${bot})`);
  console.log('    payroll ladder            x' + (wTop / wBot).toFixed(2)
    + '   (' + $(wTop) + ' vs ' + $(wBot) + ' a round)');
  console.log('    founding support ladder   x' + (gTop / gBot).toFixed(2)
    + '   (' + gTop.toLocaleString() + ' vs ' + gBot.toLocaleString() + ')');
  console.log('    sponsor ladder            x' + (sTop / sBot).toFixed(2));
  console.log('    stature ladder, raw       x' + (stature(top, top === 0) / stature(bot, false)).toFixed(2)
    + '   floored x' + (econStature(top, top === 0) / econStature(bot, false)).toFixed(2));
}

// ---------------------------------------------------------------------------
console.log('\n=== 10. WHERE A KNEE WOULD BELONG, IF THE LADDER HAS ONE ===\n');
console.log('  A floor is only honest where the thing it mirrors genuinely stops.');
console.log('  Payroll by seat, and the ratio to the seat above:');
let pw = null;
for (const s of SLOTS) {
  const w = mean(bySlot[s].map(x => x.wage));
  console.log('    slot ' + String(s).padStart(2) + '   ' + $(w).padStart(11)
    + (pw == null ? '' : '   x' + (w / pw).toFixed(3))
    + (pw != null && Math.abs(w / pw - 1) < 0.02 ? '   <- flat' : ''));
  pw = w;
}
