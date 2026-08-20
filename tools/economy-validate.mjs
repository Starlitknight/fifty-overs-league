#!/usr/bin/env node
/* tools/economy-validate.mjs — IS THE MODEL THE GAME?
 *
 * The seat model in economy-audit.mjs walks the shipped laws, but walking the
 * right laws in the wrong order still gives the wrong answer. This checks it
 * against a REAL SETTLED WORLD - the three clubs whose whole books were dumped
 * out of the world-p3 fixture on main (docs/fast-bowler-generation/
 * econ-dump-main.txt) - line by line, per round, so any disagreement is
 * visible rather than averaged away.
 *
 * Nothing here is evidence about the economy. It is evidence about the tool.
 */
import { seasonOf } from './economy-audit.mjs';
import { operationsPerRound, MEDIA_SEASON, sponsorSeasonValue, SPONSOR_PACKAGES } from '../server/financeconfig.mjs';
import { econStature, foundingSeats, foundingSupport, foundingBankFor, academyUpkeep } from '../server/economy.mjs';

const $ = n => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString();
const row = (name, model, real) => {
  const d = real ? (100 * (model / real - 1)) : 0;
  console.log('  ' + name.padEnd(22) + $(model).padStart(13) + $(real).padStart(14)
    + (real ? (d >= 0 ? '+' : '') + d.toFixed(1) + '%' : '').padStart(9));
};

// THE REAL BOOKS, transcribed from the main-arm dump. Every figure is a
// CUMULATIVE total over the rounds stated, which is why each is put back on a
// per-round or per-home-match footing before it is compared.
const REAL = [
  { name: 'Kent', slot: 7, div: 1, rounds: 21, home: 11, wageRound: 307090,
    gate: 2042107, sponsor: 1368243, sponsorBonus: 362154, media: 3575000, prize: 320000,
    wages: 6299320, ops: 3620400, upkeep: 294000, supporters: 21587, seats: 24000, att: 9917 },
  { name: 'Surrey', slot: 3, div: 1, rounds: 23, home: 9, wageRound: 359420,
    gate: 2894749, sponsor: 2243013, sponsorBonus: 1087893, media: 4125000, prize: 600000,
    wages: 8267160, ops: 4567800, upkeep: 322000, supporters: 22939, seats: 26000, att: 17182 },
  { name: 'Nottinghamshire', slot: 6, div: 1, rounds: 21, home: 9, wageRound: 295840,
    gate: 2462728, sponsor: 1491280, sponsorBonus: 647423, media: 3575000, prize: 360000,
    wages: 6173730, ops: 3685500, upkeep: 294000, supporters: 25559, seats: 25000, att: 14617 }
];

console.log('=== THE FIXED LINES: laws with no trajectory in them ===');
for (const R of REAL) {
  console.log(`\n  ${R.name} (slot ${R.slot}, ${R.rounds} rounds, ${R.home} home)`);
  const stat = econStature(R.slot, false);
  row('ops / round', operationsPerRound(foundingSeats(R.slot, false), 1, 1), R.ops / R.rounds);
  row('academy upkeep / round', academyUpkeep(2), R.upkeep / R.rounds);
  row('seats', foundingSeats(R.slot, false), R.seats);
  row('media / round', MEDIA_SEASON[1] / 14, R.media / R.rounds);
  console.log('  ' + 'econStature'.padEnd(22) + stat.toFixed(3).padStart(13));
}

// THE TRAJECTORY LINES: support, mood, the crowd and the gate. These the model
// has to GROW rather than read, so they are the ones that can be wrong.
console.log('\n=== THE TRAJECTORY: what the model grows ===');
console.log('  club                    model att   real att      model $/home    real $/home');
for (const R of REAL) {
  // run the model at the finish the real club's sponsor bonus implies
  const y = seasonOf({ slot: R.slot, isBoss: false, div: 1, country: 'eng',
    wageRound: R.wageRound, pos: 5, wins: 7, seed: 7 + R.slot });
  console.log('  ' + R.name.padEnd(22) + String(y.avgAtt).padStart(11)
    + String(R.att).padStart(11)
    + $(y.gate / y.att.length).padStart(18) + $(R.gate / R.home).padStart(15));
  console.log('    support: model start ' + y.support0 + ' -> end ' + y.support
    + '   real (after ' + R.rounds + ' rounds) ' + R.supporters);
}

// AND THE WHOLE SEASON, on a per-round footing so a 14-round model can be
// compared with a 21-round record at all.
console.log('\n=== PER ROUND, EVERYTHING ===');
console.log('  club                     line        model/rd      real/rd');
for (const R of REAL) {
  const y = seasonOf({ slot: R.slot, isBoss: false, div: 1, country: 'eng',
    wageRound: R.wageRound, pos: 5, wins: 7, seed: 7 + R.slot });
  const pr = (label, m, r) => console.log('  ' + R.name.slice(0, 16).padEnd(22) + label.padEnd(12)
    + $(m / 14).padStart(12) + $(r / R.rounds).padStart(13)
    + ((r ? ((100 * ((m / 14) / (r / R.rounds) - 1)).toFixed(0) + '%') : '')).padStart(8));
  pr('gate', y.gate, R.gate);
  pr('media', y.media, R.media);
  pr('sponsor', y.sponsor, R.sponsor);
  pr('sponsorBonus', y.sponsorBonus, R.sponsorBonus);
  pr('wages', y.wages, R.wages);
  pr('ops', y.ops, R.ops);
  const mRev = y.revenue, rRev = R.gate + R.sponsor + R.sponsorBonus + R.media + R.prize;
  const mCost = y.cost, rCost = R.wages + R.ops + R.upkeep;
  pr('REVENUE', mRev, rRev);
  pr('COST', mCost, rCost);
  pr('NET', mRev - mCost, rRev - rCost);
}
