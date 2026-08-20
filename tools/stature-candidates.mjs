#!/usr/bin/env node
/* tools/stature-candidates.mjs — WHAT EACH CANDIDATE DOES TO THE WORLD
 *
 * ERA 2 ECONOMIC STATURE REALISM, sections 11, 12, 13, 14, 18 and 22.
 * The arms and pyramid tools say what each coordinate does to the MONEY. This
 * says what it does to everything a player can see - the size of a following,
 * how full a ground gets, whether clubs still feel different from one another -
 * and whether an ambitious manager can still ruin himself.
 *
 *   node tools/stature-candidates.mjs [--seasons=5]
 */
import { seasonOf, makeSquadShop, tierOf, mean, pct, $ } from './economy-audit.mjs';
import {
  econStature, foundingSeats, foundingSupport, foundingBankFor, DEBT_LIMIT, MAX_SEATS,
  FOUNDING_SUPPORT, FOUNDING_SEATS
} from '../server/economy.mjs';
import { FOUNDING_BANK_ERA2 } from '../server/financeconfig.mjs';
import { ROUNDS } from '../server/clock.mjs';
import { ARMS, TIER_OF } from './stature-laws.mjs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const SEASONS = +arg('seasons', 5);
const ARMNAMES = arg('arms', 'current,nofloor,soft,tierflat').split(',').filter(a => ARMS[a]);
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

function walk(s, st, wageMult) {
  let bank = bankOf(st), support = supOf(st);
  const seatsN = seatsOf(st);
  const years = [];
  for (let yr = 0; yr < SEASONS; yr++) {
    const y = seasonOf({
      slot: s.slot, isBoss: s.isBoss, div: s.div, country: s.rid,
      wageRound: Math.round(s.wageRound * wageMult), pos: posOf(s), posLast: posOf(s),
      wins: winsOf(s), posCountry: s.slot + 1, clubsInCountry: 16,
      rounds: ROUNDS, homeRounds: ROUNDS / 2,
      bank0: bank, seats: seatsN, support, statOverride: st, statRawOverride: st,
      seed: 7 + s.slot + 100 * yr
    });
    bank = y.bank; support = y.support; years.push(y);
  }
  return { bank, support, seatsN, years,
    annual: mean(years.map(y => y.net)), rev: mean(years.map(y => y.revenue)),
    wages: mean(years.map(y => y.wages)), cost: mean(years.map(y => y.cost)),
    att: mean(years.map(y => y.avgAtt)), adminRounds: years.reduce((t, y) => t + y.adminRounds, 0) };
}

const runs = {};
for (const a of ARMNAMES) runs[a] = seats.map(s => ({ s, st: ARMS[a](s.slot, s.isBoss), ...walk(s, ARMS[a](s.slot, s.isBoss), 1) }));

// ---------------------------------------------------------------------------
console.log('=== 11. ADJACENT-SEAT SMOOTHNESS ===\n');
console.log('  The rule is that a step in the coordinate needs a structural reason.');
console.log('  Payroll is the structure: it is what the seat is obliged to pay.\n');
console.log('  step        payroll     ' + ARMNAMES.map(a => a.padStart(11)).join(''));
const wAt = slot => mean(seats.filter(x => x.slot === slot).map(x => x.wageRound));
for (let s = 1; s < 16; s++) {
  const pw = (wAt(s) / wAt(s - 1) - 1) * 100;
  const cells = ARMNAMES.map(a => {
    const f = ARMS[a];
    const st0 = f(s - 1, s - 1 === 0), st1 = f(s, false);
    return ((st1 / st0 - 1) * 100).toFixed(1) + '%';
  });
  console.log('  ' + (String(s - 1) + '->' + s).padEnd(10) + (pw.toFixed(1) + '%').padStart(11)
    + cells.map(c => c.padStart(11)).join('')
    + (Math.abs(pw) > 10 ? '   <- a real cost cliff' : ''));
}

// ---------------------------------------------------------------------------
console.log('\n=== 12. DO CLUBS STILL FEEL DIFFERENT? (commercial variance) ===\n');
console.log('  arm         revenue P10     P50      P90    P90/P10   spread of');
console.log('                                                        annual net');
for (const a of ARMNAMES) {
  const rev = runs[a].map(r => r.rev).sort((x, y) => x - y);
  const net = runs[a].map(r => r.annual).sort((x, y) => x - y);
  console.log('  ' + a.padEnd(11) + $(pct(rev, 0.10)).padStart(11) + $(pct(rev, 0.50)).padStart(10)
    + $(pct(rev, 0.90)).padStart(10)
    + ('x' + (pct(rev, 0.90) / pct(rev, 0.10)).toFixed(2)).padStart(10)
    + $(pct(net, 0.90) - pct(net, 0.10)).padStart(13));
}
console.log('\n  and the count of distinct commercial scales the world contains:');
for (const a of ARMNAMES) {
  const distinct = new Set(seats.map(s => ARMS[a](s.slot, s.isBoss).toFixed(4))).size;
  console.log('  ' + a.padEnd(11) + distinct + ' distinct stature values across the sixteen seats');
}

// ---------------------------------------------------------------------------
console.log('\n=== 13. SUPPORTERS, AND 14. GROUNDS ===\n');
console.log('  arm         supp P10    P50     P90    att P50   % of ground filled   biggest ground');
for (const a of ARMNAMES) {
  const sup = runs[a].map(r => r.support).sort((x, y) => x - y);
  const att = runs[a].map(r => r.att).sort((x, y) => x - y);
  const fill = runs[a].map(r => r.att / r.seatsN).sort((x, y) => x - y);
  console.log('  ' + a.padEnd(11) + String(Math.round(pct(sup, 0.10))).padStart(9)
    + String(Math.round(pct(sup, 0.50))).padStart(8) + String(Math.round(pct(sup, 0.90))).padStart(8)
    + String(Math.round(pct(att, 0.50))).padStart(11)
    + (100 * pct(fill, 0.50)).toFixed(1).padStart(15) + '%'
    + String(Math.max(...runs[a].map(r => r.seatsN))).padStart(17));
}
console.log('\n  the check that matters: nobody should be selling out every week, and');
console.log('  nobody should be playing to an empty field.');
for (const a of ARMNAMES) {
  const fill = runs[a].map(r => r.att / r.seatsN);
  console.log('  ' + a.padEnd(11) + 'clubs over 90% full: ' + fill.filter(f => f > 0.9).length
    + '/' + fill.length + '   under 15% full: ' + fill.filter(f => f < 0.15).length
    + '   fullest ' + (100 * Math.max(...fill)).toFixed(0) + '%   emptiest '
    + (100 * Math.min(...fill)).toFixed(0) + '%');
}

// ---------------------------------------------------------------------------
console.log('\n=== 18. MANAGEMENT ARCHETYPES ===\n');
console.log('  FRUGAL spends 80% of the dealt payroll, NORMAL 100%, AGGRESSIVE 135%.');
console.log('  The question is not who wins - it is whether ambition can still ruin you.\n');
const ARCH = [['FRUGAL', 0.8], ['NORMAL', 1.0], ['AGGRESSIVE', 1.35]];
console.log('  arm         archetype     D1 annual     D2 annual   D1 ever-admin   world below zero');
for (const a of ARMNAMES) {
  for (const [nm, mult] of ARCH) {
    const rows = seats.map(s => ({ s, ...walk(s, ARMS[a](s.slot, s.isBoss), mult) }));
    const d1 = rows.filter(r => r.s.div === 1), d2 = rows.filter(r => r.s.div === 2);
    console.log('  ' + a.padEnd(11) + nm.padEnd(13)
      + $(mean(d1.map(r => r.annual))).padStart(13) + $(mean(d2.map(r => r.annual))).padStart(14)
      + (d1.filter(r => r.adminRounds > 0).length + '/' + d1.length).padStart(15)
      + (rows.filter(r => r.bank < 0).length + '/' + rows.length).padStart(19));
  }
}

// ---------------------------------------------------------------------------
console.log('\n=== 22. WAGES AGAINST REVENUE, AFTER THE COORDINATE IS CORRECTED ===\n');
console.log('  FO_WAGE_R50 is frozen this phase. The question it leaves is whether');
console.log('  correcting stature makes the wage anchor stop being a problem.\n');
console.log('  arm         div   wages/revenue   wages/cost   seats over 70% of revenue on wages');
for (const a of ARMNAMES) {
  for (const dv of [1, 2]) {
    const g = runs[a].filter(r => r.s.div === dv);
    const wr = g.map(r => r.wages / r.rev);
    console.log('  ' + a.padEnd(11) + ('D' + dv).padEnd(6)
      + (100 * mean(wr)).toFixed(1).padStart(12) + '%'
      + (100 * mean(g.map(r => r.wages / r.cost))).toFixed(1).padStart(12) + '%'
      + (wr.filter(x => x > 0.7).length + '/' + g.length).padStart(30));
  }
}
