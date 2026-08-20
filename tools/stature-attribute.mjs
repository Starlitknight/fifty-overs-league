#!/usr/bin/env node
/* tools/stature-attribute.mjs — WHO IS ACTUALLY RESPONSIBLE
 *
 * ERA 2 ECONOMIC STATURE REALISM, sections 7 and 8. The arms tool says what
 * moves when the floor comes off; this says what the money is MADE of, line by
 * line, for the seats that matter - the Division Two clubs that compound and
 * the Division One clubs that fail - and then attributes the surplus or the
 * deficit between the floor and everything else.
 *
 *   node tools/stature-attribute.mjs [--seasons=5]
 */
import { seasonOf, makeSquadShop, tierOf, mean, $ } from './economy-audit.mjs';
import {
  stature, econStature, foundingSeats, foundingSupport, foundingBankFor, DEBT_LIMIT
} from '../server/economy.mjs';
import { FOUNDING_BANK_ERA2 } from '../server/financeconfig.mjs';
import { FOUNDING_SUPPORT, FOUNDING_SEATS } from '../server/economy.mjs';
import { ROUNDS } from '../server/clock.mjs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const SEASONS = +arg('seasons', 5);
const bankOf = st => Math.round(FOUNDING_BANK_ERA2 * (0.55 + 0.75 * st) / 1000) * 1000;
const seatsOf = st => Math.round(FOUNDING_SEATS * (1 + 0.95 * st) / 1000) * 1000;
const supOf = st => Math.round(FOUNDING_SUPPORT * (0.40 + 1.62 * Math.pow(st, 1.45)));

const shop = makeSquadShop();
const seats = [];
for (const rid of shop.nations) {
  shop.sidesOf(rid).forEach((side, slot) => {
    const isBoss = !!side.boss, div = side.div || (slot < 8 ? 1 : 2);
    const players = shop.deal(`${rid}|${slot}`, rid, side.arch, side.str, tierOf(slot, isBoss, div));
    if (players.length) seats.push({ rid, slot, isBoss, div, wageRound: shop.wageOf(players) });
  });
}
const posOf = s => (s.div === 1 ? s.slot + 1 : s.slot - 7);
const winsOf = s => 2 * (8 - posOf(s));

function walk(s, statOf) {
  const st = statOf(s.slot, s.isBoss);
  let bank = bankOf(st), support = supOf(st);
  const seatsN = seatsOf(st), acc = {};
  let adminRounds = 0;
  for (let yr = 0; yr < SEASONS; yr++) {
    const y = seasonOf({
      slot: s.slot, isBoss: s.isBoss, div: s.div, country: s.rid,
      wageRound: s.wageRound, pos: posOf(s), posLast: posOf(s), wins: winsOf(s),
      posCountry: s.slot + 1, clubsInCountry: 16, rounds: ROUNDS, homeRounds: ROUNDS / 2,
      bank0: bank, seats: seatsN, support, statOverride: st, statRawOverride: st,
      seed: 7 + s.slot + 100 * yr
    });
    for (const f of ['gate', 'media', 'sponsor', 'sponsorBonus', 'prize',
      'wages', 'ops', 'upkeep', 'interest', 'writtenOff']) acc[f] = (acc[f] || 0) + y[f];
    adminRounds += y.adminRounds;
    bank = y.bank; support = y.support;
  }
  return { st, bank, support, adminRounds, acc, seatsN, bank0: bankOf(st) };
}

const CUR = (slot, boss) => econStature(slot, boss);
const RAW = (slot, boss) => stature(slot, boss);

const show = (title, pick) => {
  const g = seats.filter(pick);
  if (!g.length) return;
  const cur = g.map(s => walk(s, CUR)), raw = g.map(s => walk(s, RAW));
  const A = f => mean(cur.map(r => r.acc[f])) / SEASONS;
  const B = f => mean(raw.map(r => r.acc[f])) / SEASONS;
  const rev = ['gate', 'media', 'sponsor', 'sponsorBonus', 'prize'];
  const cost = ['wages', 'ops', 'upkeep', 'interest'];
  console.log(`\n=== ${title}  (n=${g.length}) ===`);
  console.log('  line                 current/yr      no-floor/yr        the floor');
  for (const f of rev) console.log('  + ' + f.padEnd(18) + $(A(f)).padStart(13) + $(B(f)).padStart(16) + $(A(f) - B(f)).padStart(16));
  const revA = rev.reduce((t, f) => t + A(f), 0), revB = rev.reduce((t, f) => t + B(f), 0);
  console.log('  = ' + 'REVENUE'.padEnd(18) + $(revA).padStart(13) + $(revB).padStart(16) + $(revA - revB).padStart(16));
  for (const f of cost) console.log('  - ' + f.padEnd(18) + $(A(f)).padStart(13) + $(B(f)).padStart(16) + $(A(f) - B(f)).padStart(16));
  const cosA = cost.reduce((t, f) => t + A(f), 0), cosB = cost.reduce((t, f) => t + B(f), 0);
  console.log('  = ' + 'COST'.padEnd(18) + $(cosA).padStart(13) + $(cosB).padStart(16) + $(cosA - cosB).padStart(16));
  console.log('  ' + 'ANNUAL NET'.padEnd(20) + $(revA - cosA).padStart(13) + $(revB - cosB).padStart(16)
    + $((revA - cosA) - (revB - cosB)).padStart(16));
  const bA = mean(cur.map(r => r.bank)), bB = mean(raw.map(r => r.bank));
  console.log('  ' + `${SEASONS}-SEASON BANK`.padEnd(20) + $(bA).padStart(13) + $(bB).padStart(16) + $(bA - bB).padStart(16));
  console.log('  ' + 'rounds in admin'.padEnd(20) + String(mean(cur.map(r => r.adminRounds)).toFixed(1)).padStart(13)
    + String(mean(raw.map(r => r.adminRounds)).toFixed(1)).padStart(16));
  // STARTING RICHER IS NOT EARNING MORE, and one ratio must never mix them.
  // The floor moves money in two quite different ways: it hands the club more
  // capital on day one (a transfer, paid once) and it lifts the club's annual
  // operating result (a rate, paid every year). A single "share of treasury"
  // percentage adds a one-off transfer to five years of earnings and reads as
  // though the club is out-earning what it really is. So they are separated,
  // and the operating share is measured against the operating surplus alone.
  const capA = mean(cur.map(r => r.bank0)), capB = mean(raw.map(r => r.bank0));
  const opA = bA - capA, opB = bB - capB;         // what each arm EARNED, over founding capital
  console.log('\n  ' + 'founding capital'.padEnd(28) + $(capA).padStart(13) + $(capB).padStart(16)
    + $(capA - capB).padStart(16) + '   <- a one-off transfer');
  console.log('  ' + `earned over ${SEASONS} seasons`.padEnd(28) + $(opA).padStart(13) + $(opB).padStart(16)
    + $(opA - opB).padStart(16) + '   <- the operating effect');
  if (Math.abs(opA) > 1000) {
    console.log('  THE FLOOR\'S SHARE of what this seat EARNED: '
      + (100 * (opA - opB) / opA).toFixed(1) + '%');
  }
};

console.log(`WHAT THE FLOOR IS WORTH, seat by seat, over ${SEASONS} seasons.`);
console.log('The "the floor" column is current minus no-floor: money that exists');
console.log('only because econStature refuses to go below 0.62.\n');

show('D2 SEAT 8 - the division-two champion, the biggest accumulator in the game', s => s.slot === 8);
show('D2 SEAT 12 - the cheap squad above the tier cliff', s => s.slot === 12);
show('D2 SEAT 15 - the bottom of the world, where the floor lifts most', s => s.slot === 15);
show('D2 as a whole', s => s.div === 2);
show('D1 SEAT 7 - the most fragile top-flight seat', s => s.slot === 7);
show('D1 SEAT 6 - the second most fragile', s => s.slot === 6);
show('D1 as a whole', s => s.div === 1);
