#!/usr/bin/env node
/* tools/stature-map.mjs — WHAT THE FLOOR ACTUALLY TOUCHES
 *
 * ERA 2 ECONOMIC STATURE REALISM, sections 1, 4 and 5. This is the pure
 * coordinate table: no season is walked, nothing is simulated. It reads the
 * shipped stature ladder and pushes both the RAW and the FLOORED value through
 * every consumer that exists, so the question "how much does the floor change"
 * is answered per consumer rather than in the aggregate.
 *
 * The consumers, found by tracing every call site of econStature() and
 * stature() in server/ (there are no others anywhere in the repo):
 *
 *   econStature (FLOORED)      foundingBank        era-1 starting capital
 *                              foundingBankEra2    era-2 starting capital
 *                              foundingSeats       the ground it opens with
 *                              foundingSupport     the following it opens with
 *                              sponsorSeasonValue  the deal's stature factor
 *                              ambitionOf          a bot board's risk appetite
 *   stature (RAW)              supportTarget       what the crowd drifts TO
 *
 * That split is the finding this whole phase turns on and it is not a bug
 * report: the recurring channel already ignores the floor. The floor reaches
 * a club's founding coordinates and its sponsor, and reaches its crowd only
 * through where the crowd STARTS.
 *
 *   node tools/stature-map.mjs
 */
import {
  stature, econStature, foundingBank, foundingSeats, foundingSupport,
  foundingBankFor, supportTarget, FOUNDING_SUPPORT
} from '../server/economy.mjs';
import { sponsorSeasonValue, SPONSOR_STAT_BASE, SPONSOR_STAT_SPAN } from '../server/financeconfig.mjs';
import { ambitionOf } from '../server/botfinance.mjs';

const $ = n => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString();
const pcOf = (a, b) => (b ? ((a / b - 1) * 100) : 0);
const d = x => (Math.abs(x) < 0.05 ? '   -  ' : (x >= 0 ? '+' : '') + x.toFixed(1) + '%');

const SLOTS = Array.from({ length: 16 }, (_, i) => i);
const isBoss = s => s === 0;

console.log('=== 1. THE LADDER ITSELF ===\n');
console.log('  stature(slot):   slot 0 or boss -> 1');
console.log('                   slots 1-7      -> 0.86 - 0.035*(s-1)      (division one)');
console.log('                   slots 8-15     -> 0.62 - 0.022*(s-8)      (division two)');
console.log('  econStature      -> Math.max(0.62, stature(slot, isBoss))\n');
console.log('  slot  div       raw   floored   floor bites?');
for (const s of SLOTS) {
  const raw = stature(s, isBoss(s)), fl = econStature(s, isBoss(s));
  console.log('  ' + String(s).padStart(4) + String(s < 8 ? 1 : 2).padStart(5)
    + raw.toFixed(3).padStart(10) + fl.toFixed(3).padStart(10)
    + (fl > raw ? ('   YES  +' + ((fl / raw - 1) * 100).toFixed(1) + '%') : '   no'));
}

// ---------------------------------------------------------------------------
console.log('\n=== 4. EVERY CONSUMER, RAW vs FLOORED ===');
console.log('\n  A. FOUNDING CAPITAL (era 2)          B. FOUNDING GROUND');
console.log('  slot     raw    floored   change      raw   floored   change');
for (const s of SLOTS) {
  const raw = stature(s, isBoss(s)), fl = econStature(s, isBoss(s));
  const bR = foundingBankFor(s, isBoss(s), true), bF = bR;   // takes econStature internally
  // re-derive both ends explicitly so the raw arm is visible
  const bankOf = st => Math.round(1750000 * (0.55 + 0.75 * st) / 1000) * 1000;
  const seatsOf = st => Math.round(15000 * (1 + 0.95 * st) / 1000) * 1000;
  console.log('  ' + String(s).padStart(4) + $(bankOf(raw)).padStart(10) + $(bankOf(fl)).padStart(11)
    + d(pcOf(bankOf(fl), bankOf(raw))).padStart(9)
    + String(seatsOf(raw)).padStart(9) + String(seatsOf(fl)).padStart(10)
    + d(pcOf(seatsOf(fl), seatsOf(raw))).padStart(9));
  void bR; void bF;
}

console.log('\n  C. FOUNDING SUPPORT                  D. SPONSOR STATURE FACTOR');
console.log('  slot     raw    floored   change      raw   floored   change');
for (const s of SLOTS) {
  const raw = stature(s, isBoss(s)), fl = econStature(s, isBoss(s));
  const supOf = st => Math.round(FOUNDING_SUPPORT * (0.40 + 1.62 * Math.pow(st, 1.45)));
  const spOf = st => SPONSOR_STAT_BASE + SPONSOR_STAT_SPAN * st;
  console.log('  ' + String(s).padStart(4) + String(supOf(raw)).padStart(10) + String(supOf(fl)).padStart(11)
    + d(pcOf(supOf(fl), supOf(raw))).padStart(9)
    + spOf(raw).toFixed(4).padStart(9) + spOf(fl).toFixed(4).padStart(10)
    + d(pcOf(spOf(fl), spOf(raw))).padStart(9));
}

console.log('\n  E. WHAT THE CROWD DRIFTS TO (supportTarget) - THE FLOOR NEVER REACHES THIS');
console.log('     shown at neutral mood, at the club\'s own national rank');
console.log('  slot   natrank      raw   floored   change   (floored is NOT what the game uses)');
for (const s of SLOTS) {
  const raw = stature(s, isBoss(s)), fl = econStature(s, isBoss(s));
  const natrank = s + 1;
  const tR = supportTarget(4, natrank, 16, raw), tF = supportTarget(4, natrank, 16, fl);
  console.log('  ' + String(s).padStart(4) + String(natrank).padStart(10)
    + String(tR).padStart(9) + String(tF).padStart(10) + d(pcOf(tF, tR)).padStart(9));
}

console.log('\n  F. A BOT BOARD\'S AMBITION (the deficit it will carry)');
console.log('  slot   floored-arm   raw-arm   note');
for (const s of SLOTS) {
  const a = ambitionOf(s, isBoss(s));
  const raw = stature(s, isBoss(s));
  const aRaw = -(0.02 + 0.16 * Math.max(0, (raw - 0.62) / 0.38));
  console.log('  ' + String(s).padStart(4) + (a * 100).toFixed(1).padStart(12) + '%'
    + (aRaw * 100).toFixed(1).padStart(9) + '%'
    + (Math.abs(a - aRaw) < 1e-9 ? '   identical - Math.max(0,..) already clamps below the floor' : '   MOVES'));
}

// ---------------------------------------------------------------------------
console.log('\n=== 5. HOW MUCH INFORMATION THE FLOOR DESTROYS ===\n');
const rawAll = SLOTS.map(s => stature(s, isBoss(s)));
const flAll = SLOTS.map(s => econStature(s, isBoss(s)));
const d2raw = rawAll.slice(8), d2fl = flAll.slice(8);
const ratio = a => Math.max(...a) / Math.min(...a);
console.log('  top:bottom stature ratio, all sixteen seats   raw '
  + ratio(rawAll).toFixed(3) + '   floored ' + ratio(flAll).toFixed(3));
console.log('  top:bottom stature ratio, division two only   raw '
  + ratio(d2raw).toFixed(3) + '   floored ' + ratio(d2fl).toFixed(3)
  + '   <- the entire second-division spread is erased');
const spread = a => (Math.max(...a) - Math.min(...a));
console.log('\n  the floor removes ' + (100 * (1 - spread(d2fl) / spread(d2raw))).toFixed(0)
  + '% of the coordinate spread inside division two,');
console.log('  and ' + (100 * (1 - spread(flAll) / spread(rawAll))).toFixed(0)
  + '% across the world (the top half is untouched).');

// where the floor's money actually goes, per club, per season
console.log('\n  WHAT THAT IS WORTH, per club, on the era-2 economy:');
console.log('  slot   founding bank   founding supp   sponsor/season(mid-table D2)   TOTAL one-off + recurring');
let capTot = 0, spTot = 0;
for (const s of SLOTS.slice(8)) {
  const raw = stature(s, isBoss(s)), fl = econStature(s, isBoss(s));
  const bankOf = st => Math.round(1750000 * (0.55 + 0.75 * st) / 1000) * 1000;
  const supOf = st => Math.round(FOUNDING_SUPPORT * (0.40 + 1.62 * Math.pow(st, 1.45)));
  const spR = sponsorSeasonValue(2, 4, 8, 1, raw), spF = sponsorSeasonValue(2, 4, 8, 1, fl);
  capTot += bankOf(fl) - bankOf(raw); spTot += spF - spR;
  console.log('  ' + String(s).padStart(4) + $(bankOf(fl) - bankOf(raw)).padStart(16)
    + (supOf(fl) - supOf(raw) >= 0 ? '+' : '') + String(supOf(fl) - supOf(raw)).padStart(15)
    + $(spF - spR).padStart(31));
}
console.log('  ' + 'D2 total'.padStart(4) + $(capTot).padStart(16) + ''.padStart(16)
  + $(spTot).padStart(31) + '  per season');
