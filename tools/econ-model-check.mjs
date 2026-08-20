#!/usr/bin/env node
/* tools/econ-model-check.mjs — THE MODEL AGAINST THE SETTLED WORLD.
 *
 * Reads the oracle written by tools/econ-oracle.mjs and runs seasonOf at the
 * same seat, the same finish and the SAME WAGE BILL - the bill is taken off
 * the settled books rather than re-derived, so a disagreement here can never
 * be a disagreement about which squad the generator dealt.
 *
 *   node tools/econ-oracle.mjs && node tools/econ-model-check.mjs
 *
 * Every line is a per-season total. The percentage is the model against the
 * game; the game is right by definition.
 */
import fs from 'node:fs';
import { seasonOf } from './economy-audit.mjs';

const tag = process.argv.find(a => a.startsWith('--tag='));
const file = `/tmp/econ-oracle-${tag ? tag.slice(6) : 'era2'}.json`;
const reals = JSON.parse(fs.readFileSync(file, 'utf8'));
const $ = n => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString();
const pc = (m, r) => (r ? ((m / r - 1) * 100) : (m ? Infinity : 0));
const fmt = d => (Math.abs(d) < 0.05 ? '  =  ' : (d >= 0 ? '+' : '') + d.toFixed(1) + '%');

const LINES = [
  ["supporters", y => y.support, R => R.supporters],
  ['avg attendance', y => y.avgAtt, R => R.att],
  ['gate', y => y.gate, R => R.gate],
  ['media', y => y.media, R => R.media],
  ['sponsor', y => y.sponsor, R => R.sponsor],
  ['sponsor bonus', y => y.sponsorBonus, R => R.sponsorBonus],
  ['prize', y => y.prize, R => R.prize],
  ['ops', y => y.ops, R => R.ops],
  ['wages', y => y.wages, R => R.wages],
  ['REVENUE', y => y.gate + y.media + y.sponsor + y.sponsorBonus + y.prize,
    R => R.gate + R.media + R.sponsor + R.sponsorBonus + R.prize],
  ['NET', y => (y.gate + y.media + y.sponsor + y.sponsorBonus + y.prize)
    - (y.wages + y.ops + y.upkeep + y.interest),
  R => (R.gate + R.media + R.sponsor + R.sponsorBonus + R.prize)
    - (R.wages + R.ops + R.upkeep + R.interest)]
];

console.log(`=== MODEL vs SETTLED WORLD (${file}) ===\n`);
const worst = {};
for (const R of reals) {
  const y = seasonOf({
    slot: R.slot, isBoss: R.slot === 0, div: R.div, country: 'eng',
    wageRound: R.wageRound, pos: R.pos, posLast: R.pos, wins: R.wins,
    posCountry: R.posCountry, clubsInCountry: 16,
    rounds: R.rounds, homeRounds: R.home, seed: 7 + R.slot
  });
  console.log(`  slot ${R.slot} (D${R.div}, ${R.pos}${R.pos === 1 ? 'st' : R.pos === 2 ? 'nd' : R.pos === 3 ? 'rd' : 'th'}`
    + ` of 8, ${R.posCountry} of 16)   wage/rd ${$(R.wageRound)}`);
  for (const [name, mf, rf] of LINES) {
    const m = mf(y), r = rf(R), d = pc(m, r);
    if (Math.abs(d) > Math.abs(worst[name] || 0)) worst[name] = d;
    console.log('    ' + name.padEnd(16) + String(Math.round(m)).padStart(12)
      + String(Math.round(r)).padStart(12) + fmt(d).padStart(10));
  }
  console.log('');
}
console.log('=== WORST DISAGREEMENT ON EACH LINE, across all sixteen seats ===');
for (const [name] of LINES) console.log('  ' + name.padEnd(16) + fmt(worst[name] || 0).padStart(10));

// A PERCENTAGE ON NET IS A LIE WHEN NET IS NEAR ZERO. Slot 4 settles at
// -$14,619 on $6.9m of revenue; a $264k disagreement there prints as 1807%
// and reads as a broken model, when it is the same 4% miss the gate carries
// everywhere. Costs agree to the dollar, so every NET disagreement IS the
// revenue disagreement - and stating it against revenue is the only honest
// scale. This is also the model's usable resolution: it can tell a seat that
// runs +$1.8m from one that runs -$1.6m, and it CANNOT tell break-even from
// a quarter-million either way. Arm-vs-arm differences are far tighter than
// this, because the gate residual is a property of the seat and cancels.
console.log('\n=== NET DISAGREEMENT AS A SHARE OF REVENUE (the honest scale) ===');
let worstShare = 0, worstSlot = null;
for (const R of reals) {
  const y = seasonOf({
    slot: R.slot, isBoss: R.slot === 0, div: R.div, country: 'eng',
    wageRound: R.wageRound, pos: R.pos, posLast: R.pos, wins: R.wins,
    posCountry: R.posCountry, clubsInCountry: 16,
    rounds: R.rounds, homeRounds: R.home, seed: 7 + R.slot
  });
  const mNet = (y.gate + y.media + y.sponsor + y.sponsorBonus + y.prize)
    - (y.wages + y.ops + y.upkeep + y.interest);
  const rRev = R.gate + R.media + R.sponsor + R.sponsorBonus + R.prize;
  const rNet = rRev - (R.wages + R.ops + R.upkeep + R.interest);
  const share = rRev ? (mNet - rNet) / rRev * 100 : 0;
  if (Math.abs(share) > Math.abs(worstShare)) { worstShare = share; worstSlot = R.slot; }
  console.log('  slot ' + String(R.slot).padStart(2) + '  model NET ' + $(mNet).padStart(12)
    + '   real NET ' + $(rNet).padStart(12) + '   miss ' + $(mNet - rNet).padStart(11)
    + '  = ' + (share >= 0 ? '+' : '') + share.toFixed(1) + '% of revenue');
}
console.log(`\n  WORST: slot ${worstSlot}, ${worstShare.toFixed(1)}% of revenue.`);
