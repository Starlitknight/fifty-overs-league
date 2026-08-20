#!/usr/bin/env node
/* tools/stature-era-boundary.mjs — THE ERA-1 TRAP
 *
 * ERA 2 ECONOMIC STATURE REALISM, sections 20 and 21. The brief's hard rule is
 * that a club whose season opened before ERA2_DAY must settle to the same cent
 * after this phase as before it. This checks whether a change to econStature
 * can honour that by itself.
 *
 * IT CANNOT, and that is the single most important implementation finding of
 * the phase. econStature is NOT an era-2 coordinate. Three of its consumers
 * are era-blind:
 *
 *   foundingBank(slot, isBoss)      = FOUNDING_BANK * (0.80 + 0.95 * econStature(...))
 *                                     - the ERA-1 founding capital
 *   foundingSeats(slot, isBoss)     - the ground, in both eras
 *   foundingSupport(slot, isBoss)   - the opening following, in both eras
 *
 * and the books are a pure derivation replayed from genesis on every settle,
 * so a club's founding capital is not a number written down once - it is
 * recomputed every time the walk runs. Move econStature and every era-1
 * ledger in production restates itself.
 *
 * Production is on season 1, start_day 14, and ERA2_DAY is 42. Every one of
 * the 256 clubs in the live world is era 1 today. So an ungated change would
 * land on all of them.
 *
 *   node tools/stature-era-boundary.mjs
 */
import {
  stature, econStature, foundingBank, foundingSeats, foundingSupport, foundingBankFor,
  FOUNDING_BANK, FOUNDING_SEATS, FOUNDING_SUPPORT
} from '../server/economy.mjs';
import { ERA2_DAY, era2Season, FOUNDING_BANK_ERA2 } from '../server/financeconfig.mjs';
import { ARMS } from './stature-laws.mjs';

const $ = n => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString();
const era1BankOf = st => Math.round(FOUNDING_BANK * (0.80 + 0.95 * st) / 1000) * 1000;
const era2BankOf = st => Math.round(FOUNDING_BANK_ERA2 * (0.55 + 0.75 * st) / 1000) * 1000;
const seatsOf = st => Math.round(FOUNDING_SEATS * (1 + 0.95 * st) / 1000) * 1000;
const supOf = st => Math.round(FOUNDING_SUPPORT * (0.40 + 1.62 * Math.pow(st, 1.45)));

// the mirror must be the shipped law before it can prove anything about it
for (let s = 0; s < 16; s++) {
  const boss = s === 0, st = econStature(s, boss);
  if (era1BankOf(st) !== foundingBank(s, boss)
    || seatsOf(st) !== foundingSeats(s, boss)
    || supOf(st) !== foundingSupport(s, boss)) {
    console.error('MIRROR DRIFTED at slot ' + s); process.exit(1);
  }
}

console.log('=== 20. WOULD AN UNGATED CHANGE REACH ERA 1? ===\n');
console.log(`  ERA2_DAY = ${ERA2_DAY}. Production is season 1, start_day 14 -> era 2? `
  + era2Season(14) + '   (so every live club is era 1)\n');

for (const arm of ['nofloor', 'soft', 'tierflat']) {
  const f = ARMS[arm];
  let movedBank = 0, movedSeats = 0, movedSup = 0, worstBank = 0;
  console.log(`  ARM ${arm}:`);
  console.log('    slot   era-1 bank now    era-1 bank then      change     seats      support');
  for (let s = 0; s < 16; s++) {
    const boss = s === 0;
    const now = econStature(s, boss), then = f(s, boss);
    const b0 = era1BankOf(now), b1 = era1BankOf(then);
    const s0 = seatsOf(now), s1 = seatsOf(then);
    const u0 = supOf(now), u1 = supOf(then);
    if (b0 !== b1) movedBank++;
    if (s0 !== s1) movedSeats++;
    if (u0 !== u1) movedSup++;
    if (Math.abs(b1 - b0) > Math.abs(worstBank)) worstBank = b1 - b0;
    if (b0 !== b1 || s0 !== s1 || u0 !== u1) {
      console.log('    ' + String(s).padStart(4) + $(b0).padStart(17) + $(b1).padStart(19)
        + $(b1 - b0).padStart(12)
        + (s1 - s0 ? (s1 - s0 > 0 ? '+' : '') + (s1 - s0) : '   -').padStart(10)
        + (u1 - u0 ? (u1 - u0 > 0 ? '+' : '') + (u1 - u0) : '   -').padStart(12));
    }
  }
  console.log(`    -> ${movedBank}/16 seats change their ERA-1 founding capital`
    + ` (worst ${$(worstBank)}), ${movedSeats}/16 their ground, ${movedSup}/16 their following.`);
  console.log(`    -> ${movedBank || movedSeats || movedSup
    ? 'AN UNGATED CHANGE IS FORBIDDEN. It must be era-gated.'
    : 'era 1 is untouched.'}\n`);
}

console.log('=== THE GATE THAT WOULD BE NEEDED ===\n');
console.log('  econStature(slot, isBoss) is called from six places. Only ONE of them');
console.log('  is era-2-only, and it is the one that already takes the era:');
console.log('');
console.log('    foundingBankFor(slot, isBoss, era2)   <- already branches on the era');
console.log('    foundingBank(slot, isBoss)            era 1  -- MUST NOT MOVE');
console.log('    foundingSeats(slot, isBoss)           both   -- MUST NOT MOVE for era-1 clubs');
console.log('    foundingSupport(slot, isBoss)         both   -- MUST NOT MOVE for era-1 clubs');
console.log('    sponsorSeasonValue(...)               both   -- era-1 sponsor is priced');
console.log('                                                    WITHOUT stature (the era-1');
console.log('                                                    branch calls sponsorOf, not');
console.log('                                                    sponsorSeasonValue)');
console.log('    ambitionOf(slot, isBoss)              bots; botMoney short-circuits in era 1');
console.log('');
console.log('  So a correct implementation adds the era to the coordinate itself -');
console.log('  econStature(slot, isBoss, era2) - and returns the CURRENT law whenever');
console.log('  era2 is false. Every era-1 call site keeps the number it has today, by');
console.log('  construction rather than by inspection.');
console.log('');
console.log('  A club founded in era 1 that plays on into era 2 is the case to think');
console.log('  hardest about: its founding capital is an era-1 fact and must stay put,');
console.log('  while the sponsor it signs for an era-2 season is an era-2 fact. The');
console.log('  seam is the SEASON, not the club, and economy.mjs already carries');
console.log('  exactly that distinction (foundedEra2 for the founding line, curEra2 for');
console.log('  the season being walked).');

console.log('\n=== 21. THE TRANSITION, PRICED ===\n');
console.log('  A club crossing into its first era-2 season under each arm: what its');
console.log('  sponsor and founding coordinates would read on either side of the line.');
console.log('  (founding capital is NOT re-read at the crossing - it is history.)\n');
console.log('  slot   era-1 stature   era-2 stature (tierflat)   sponsor factor change');
for (let s = 0; s < 16; s++) {
  const boss = s === 0;
  const now = econStature(s, boss), then = ARMS.tierflat(s, boss);
  const spNow = 0.85 + 0.25 * now, spThen = 0.85 + 0.25 * then;
  console.log('  ' + String(s).padStart(4) + now.toFixed(3).padStart(14) + then.toFixed(3).padStart(24)
    + ((spThen / spNow - 1) * 100).toFixed(2).padStart(20) + '%');
}
