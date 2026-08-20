#!/usr/bin/env node
/* tools/economy-arms.mjs — ONE BATTERY, RUN THE SAME WAY FOR EVERY ARM
 *
 * ERA 2 ECONOMY PHASE 2. The audit produced its findings from a dozen ad-hoc
 * probes; a recalibration needs the SAME battery run identically for every
 * candidate, or the comparison is between two scripts rather than two laws.
 * So this prints one fixed page, and the arm is chosen entirely by flags:
 *
 *   --ops=N        override OPS_TOPFLIGHT_ROUND for this run only
 *   --tag=NAME     what to call the arm in the output
 *
 * The PLAYOFF FUNDING law is not a flag: the model calls
 * financeconfig.centralInstallment, which is the same function the settle
 * calls, so whatever the shipped law says at the moment this runs is what the
 * page below measures. That is deliberate - a model with its own copy of the
 * law is a model that can disagree with the game.
 *
 *   node tools/economy-arms.mjs --tag=baseline
 */
import { seasonOf, makeSquadShop, tierOf, pct, mean, $, SEASON_ROUNDS } from './economy-audit.mjs';
import { econStature, foundingSeats, foundingBankFor } from '../server/economy.mjs';
import { isFullMember, operationsPerRound, OPS_TOPFLIGHT_ROUND, MEDIA_SEASON,
         sponsorSeasonValue, SPONSOR_PACKAGES } from '../server/financeconfig.mjs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const TAG = arg('tag', 'arm');
const OPS_TOP = arg('ops', null) == null ? OPS_TOPFLIGHT_ROUND : +arg('ops', null);
// the ops override is applied as a multiplier on the shipped operationsPerRound,
// because that keeps the base and the per-seat term exactly as shipped and moves
// only the top-flight premium - which is the one thing this phase may retune
const opsMultFor = (slot, isBoss, div) => div !== 1 ? 1
  : (operationsPerRound(foundingSeats(slot, isBoss), 2, 1) + OPS_TOP)
    / operationsPerRound(foundingSeats(slot, isBoss), 1, 1);

const shop = makeSquadShop();
const seats = [];
for (const rid of shop.nations) {
  shop.sidesOf(rid).forEach((side, slot) => {
    const isBoss = !!side.boss, div = side.div || (slot < 8 ? 1 : 2);
    const ps = shop.deal(`${rid}|${slot}`, rid, side.arch, side.str, tierOf(slot, isBoss, div));
    if (ps.length) seats.push({ rid, slot, isBoss, div, member: isFullMember(rid), wageRound: shop.wageOf(ps) });
  });
}
const members = seats.filter(s => s.member);
const wageAt = (slot, div) => pct(members.filter(s => s.slot === slot && s.div === div).map(s => s.wageRound), 0.5);
const run = o => seasonOf({ country: 'eng', seed: 7 + (o.slot || 0),
  opsMult: opsMultFor(o.slot, o.isBoss, o.div), ...o });

// THE SIXTEEN SEATS AS THE WORLD ACTUALLY PLAYS THEM. A seat's strength decides
// its finish and position is worth up to $4m a season, so a table that gives
// everybody fifth place measures half the seat.
const SEATS = [];
for (const [div, base] of [[1, 0], [2, 8]]) for (let s = 0; s < 8; s++) {
  const slot = base + s, pos = s + 1;
  SEATS.push({ key: `D${div}/${s}`, slot, div, isBoss: slot === 0, pos,
    wins: Math.round(2 + (8 - pos) * 9 / 7), po: pos <= 2 ? 2 : pos <= 4 ? 1 : 0,
    w: wageAt(slot, div) });
}

console.log(`=== ARM: ${TAG} ===`);
console.log(`OPS_TOPFLIGHT_ROUND = $${OPS_TOP.toLocaleString()} a round `
  + `($${(OPS_TOP * SEASON_ROUNDS).toLocaleString()} a season)`);
console.log(`playoff funding: the model calls the shipped centralInstallment`);

console.log('\n-- the sixteen seats, five seasons --');
console.log('  seat  finish   revenue      cost       NET   after1   after3   after5   admin');
const first = {}, ends = {};
for (const S of SEATS) {
  let bank = foundingBankFor(S.slot, S.isBoss, true), ruin = '-';
  const line = [];
  for (let n = 1; n <= 5; n++) {
    const y = run({ slot: S.slot, isBoss: S.isBoss, div: S.div, wageRound: S.w, pos: S.pos,
      posLast: S.pos, wins: S.wins, playoffRounds: S.po, playoffWin: S.pos === 1, bank0: bank });
    if (n === 1) first[S.key] = y;
    bank = y.bank; line.push(bank);
    if (ruin === '-' && y.adminRounds > 0) ruin = 's' + n;
  }
  ends[S.key] = bank;
  const y = first[S.key];
  console.log('  ' + S.key.padEnd(6) + String(S.pos).padStart(6) + $(y.revenue).padStart(11)
    + $(y.cost).padStart(10) + $(y.net).padStart(10)
    + [line[0], line[2], line[4]].map(v => $(v).padStart(9)).join('') + ruin.padStart(7));
}
const d1 = SEATS.filter(S => S.div === 1).map(S => first[S.key].net);
const d2 = SEATS.filter(S => S.div === 2).map(S => first[S.key].net);
const ruined = SEATS.filter(S => {
  let b = foundingBankFor(S.slot, S.isBoss, true);
  for (let n = 1; n <= 5; n++) {
    const y = run({ slot: S.slot, isBoss: S.isBoss, div: S.div, wageRound: S.w, pos: S.pos,
      posLast: S.pos, wins: S.wins, playoffRounds: S.po, playoffWin: S.pos === 1, bank0: b });
    b = y.bank; if (y.adminRounds > 0) return true;
  } return false;
}).length;
console.log(`  D1 mean net ${$(mean(d1))}   median ${$(pct(d1, 0.5))}   losing ${d1.filter(v => v < 0).length}/8`);
console.log(`  D2 mean net ${$(mean(d2))}   median ${$(pct(d2, 0.5))}   losing ${d2.filter(v => v < 0).length}/8`);
console.log(`  administration within five seasons: ${ruined}/16`);
console.log(`  richest treasury after five: ${$(Math.max(...Object.values(ends)))}`
  + `   poorest: ${$(Math.min(...Object.values(ends)))}`);

// -- THE PLAYOFF LADDER, which is the defect this phase exists for -----------
console.log('\n-- the playoff ladder: the same club, the same league season --');
const pw = wageAt(1, 1);
const po = o => run({ slot: 1, div: 1, wageRound: pw, pos: 1, posLast: 1, wins: 11, ...o });
const rows = [['tops the table, no playoff', { playoffRounds: 0 }],
  ['loses the semi-final', { playoffRounds: 1 }],
  ['loses the final', { playoffRounds: 2 }],
  ['WINS THE FINAL', { playoffRounds: 2, playoffWin: true }]];
console.log('  outcome                        media   sponsor      gate     prize      cost       NET   step');
let prev = null;
for (const [label, o] of rows) {
  const y = po(o);
  console.log('  ' + label.padEnd(28) + $(y.media).padStart(10) + $(y.sponsor).padStart(10)
    + $(y.gate).padStart(10) + $(y.prize).padStart(10) + $(y.cost).padStart(10)
    + $(y.net).padStart(11) + (prev == null ? '' : ((y.net - prev >= 0 ? '+' : '') + $(y.net - prev))).padStart(12));
  prev = y.net;
}
const champ = po({ playoffRounds: 2, playoffWin: true }), skip = po({ playoffRounds: 0 });
console.log(`  CHAMPION vs TOPPING THE TABLE AND GOING HOME: ${(champ.net - skip.net >= 0 ? '+' : '')}${$(champ.net - skip.net)}`);
// AND THE CLUB THAT TRAVELS. The semi-finals are 1v4 and 2v3 with the higher
// seed hosting, so the third and fourth seeds play their extra week entirely
// away from home: a full round of wages, operations and academy, and not one
// dollar of gate to set against it. This is the seat the defect actually bites.
const aw = wageAt(4, 1);
const away0 = run({ slot: 4, div: 1, wageRound: aw, pos: 4, posLast: 4, wins: 7, playoffRounds: 0 });
const away1 = run({ slot: 4, div: 1, wageRound: aw, pos: 4, posLast: 4, wins: 7, playoffRounds: 1, playoffHome: 0 });
console.log(`  a FOURTH-PLACED club, semi-final away: qualifying is worth `
  + `${(away1.net - away0.net >= 0 ? '+' : '')}${$(away1.net - away0.net)}`
  + `   (missed out ${$(away0.net)} -> qualified ${$(away1.net)})`);
const rup0 = run({ slot: 1, div: 1, wageRound: pw, pos: 2, posLast: 2, wins: 10, playoffRounds: 0 });
const rup2 = run({ slot: 1, div: 1, wageRound: pw, pos: 2, posLast: 2, wins: 10, playoffRounds: 2, playoffHome: 1 });
console.log(`  a RUNNER-UP reaching the final (home semi, away final): `
  + `${(rup2.net - rup0.net >= 0 ? '+' : '')}${$(rup2.net - rup0.net)}`);

// -- promotion, relegation, archetypes, slot 7 ------------------------------
console.log('\n-- promotion, held fixed (same squad, same finish, one division apart) --');
const pWage = wageAt(8, 2);
const inD1 = run({ slot: 7, div: 1, wageRound: pWage, pos: 5, posLast: 5, wins: 7 });
const inD2 = run({ slot: 8, div: 2, wageRound: pWage, pos: 5, posLast: 5, wins: 7 });
console.log(`  D1 net ${$(inD1.net)}   D2 net ${$(inD2.net)}   PROMOTION WORTH ${(inD1.net - inD2.net >= 0 ? '+' : '')}${$(inD1.net - inD2.net)}`);
const d2Champ = run({ slot: 8, div: 2, wageRound: pWage, pos: 1, posLast: 1, wins: 11, playoffRounds: 2, playoffWin: true });
for (const [label, m] of [['no strengthening', 1], ['normal +25%', 1.25], ['aggressive +60%', 1.60]]) {
  const y = run({ slot: 7, div: 1, wageRound: Math.round(pWage * m), pos: 8, posLast: 1, wins: 3,
    seats: foundingSeats(8, false), statOverride: econStature(8, false), support: d2Champ.support });
  console.log('    promoted, ' + label.padEnd(20) + 'net ' + $(y.net).padStart(12));
}
console.log('\n-- relegation (same squad, one division down) --');
const rWage = wageAt(7, 1);
const up = run({ slot: 7, div: 1, wageRound: rWage, pos: 7, posLast: 7, wins: 4 });
const down = run({ slot: 7, div: 2, wageRound: rWage, pos: 3, posLast: 8, wins: 8,
  statOverride: econStature(7, false), seats: foundingSeats(7, false) });
console.log(`  stayed up ${$(up.net)}   relegated ${$(down.net)}   RELEGATION WORTH ${(down.net - up.net >= 0 ? '+' : '')}${$(down.net - up.net)}`);
console.log(`  guaranteed money lost: media ${$(down.media - up.media)}  sponsor ${$(down.sponsor - up.sponsor)}`);

console.log('\n-- management archetypes (mid-table finish; payroll is the choice) --');
console.log('  div  style              payroll/rd        net     bank after 5');
for (const [div, slot] of [[1, 4], [2, 8]]) {
  const par = wageAt(slot, div);
  for (const [label, m] of [['frugal x0.75', 0.75], ['normal x1.00', 1.00], ['aggressive x1.45', 1.45]]) {
    let bank = foundingBankFor(slot, false, true), y = null;
    for (let n = 1; n <= 5; n++) {
      y = run({ slot, div, wageRound: Math.round(par * m), pos: 5, posLast: 5, wins: 7, bank0: bank });
      bank = y.bank;
    }
    const one = run({ slot, div, wageRound: Math.round(par * m), pos: 5, posLast: 5, wins: 7 });
    console.log(`  D${div}   ` + label.padEnd(20) + $(Math.round(par * m)).padStart(10)
      + $(one.net).padStart(12) + $(bank).padStart(16));
  }
}

console.log('\n-- slot 7, the hardest seat: can normal management survive it? --');
const s7 = wageAt(7, 1);
console.log('  finish  payroll        net     bank after 5   admin');
for (const [label, o] of [['8th, normal payroll', { pos: 8, wins: 2, m: 1 }],
  ['8th, frugal x0.80', { pos: 8, wins: 2, m: 0.80 }],
  ['5th, normal payroll', { pos: 5, wins: 7, m: 1 }],
  ['5th, aggressive x1.35', { pos: 5, wins: 7, m: 1.35 }]]) {
  let bank = foundingBankFor(7, false, true), ruin = '-', one = null;
  for (let n = 1; n <= 5; n++) {
    const y = run({ slot: 7, div: 1, wageRound: Math.round(s7 * o.m), pos: o.pos, posLast: o.pos,
      wins: o.wins, bank0: bank });
    if (n === 1) one = y;
    bank = y.bank; if (ruin === '-' && y.adminRounds > 0) ruin = 's' + n;
  }
  console.log('  ' + label.padEnd(24) + $(Math.round(s7 * o.m)).padStart(9)
    + $(one.net).padStart(12) + $(bank).padStart(16) + ruin.padStart(8));
}

// ---------------------------------------------------------------------------
// §7 THE SWEEP. Only reached with --sweep, and only meaningful once the playoff
// law is fixed, because the two changes interact: funding the extra weeks
// already moves the four best clubs in each division.
//
// The premium is NOT removed in any arm. Division One is meant to cost more to
// run - dearer staff, heavier travel, a higher standard of match operations -
// and the question is only the magnitude. What is fitted is BEHAVIOUR: normal
// management sustainable, minnows under real pressure, contenders able to burn
// cash, Division Two not printing money, administration exceptional.
// ---------------------------------------------------------------------------
if (process.argv.includes('--sweep')) {
  console.log('\n=== §7 SWEEPING THE TOP-FLIGHT OPERATIONS PREMIUM ===');
  console.log('  $/rd   $/season   D1 mean    D1 med   D1 los   D2 mean   D2 los  ruin  worst seat   best D2 end   normal D1');
  const parD1 = wageAt(4, 1), parD2 = wageAt(8, 2);
  for (const cand of [60000, 50000, 40000, 35000, 30000, 25000, 20000, 15000, 10000, 0]) {
    const mult = (slot, isBoss, div) => div !== 1 ? 1
      : (operationsPerRound(foundingSeats(slot, isBoss), 2, 1) + cand)
        / operationsPerRound(foundingSeats(slot, isBoss), 1, 1);
    const go = o => seasonOf({ country: 'eng', seed: 7 + (o.slot || 0),
      opsMult: mult(o.slot, o.isBoss, o.div), ...o });
    const nets = {}, endBank = {};
    let ruin = 0;
    for (const S of SEATS) {
      let bank = foundingBankFor(S.slot, S.isBoss, true), r = false;
      for (let n = 1; n <= 5; n++) {
        const y = go({ slot: S.slot, isBoss: S.isBoss, div: S.div, wageRound: S.w, pos: S.pos,
          posLast: S.pos, wins: S.wins, playoffRounds: S.po, playoffWin: S.pos === 1, bank0: bank });
        if (n === 1) nets[S.key] = y.net;
        bank = y.bank; if (y.adminRounds > 0) r = true;
      }
      endBank[S.key] = bank; if (r) ruin++;
    }
    const a = SEATS.filter(S => S.div === 1).map(S => nets[S.key]);
    const b = SEATS.filter(S => S.div === 2).map(S => nets[S.key]);
    // a NORMAL top-flight club: mid-table seat, mid-table finish, par payroll
    const normal = go({ slot: 4, div: 1, wageRound: parD1, pos: 5, posLast: 5, wins: 7 });
    console.log('  ' + ('$' + (cand / 1000) + 'k').padStart(6)
      + ('$' + (cand * SEASON_ROUNDS / 1000) + 'k').padStart(10)
      + $(mean(a)).padStart(11) + $(pct(a, 0.5)).padStart(10)
      + String(a.filter(v => v < 0).length + '/8').padStart(8)
      + $(mean(b)).padStart(11) + String(b.filter(v => v < 0).length + '/8').padStart(8)
      + String(ruin + '/16').padStart(7)
      + $(Math.min(...a)).padStart(12) + $(Math.max(...Object.values(endBank))).padStart(14)
      + $(normal.net).padStart(12));
  }
  // and what each candidate does to the three things that must NOT move
  console.log('\n  the invariants, per candidate:');
  console.log('  $/rd   promotion worth   relegation worth   frugal D1   normal D1   aggressive D1   slot7 8th');
  for (const cand of [60000, 40000, 30000, 25000, 20000, 10000]) {
    const mult = (slot, isBoss, div) => div !== 1 ? 1
      : (operationsPerRound(foundingSeats(slot, isBoss), 2, 1) + cand)
        / operationsPerRound(foundingSeats(slot, isBoss), 1, 1);
    const go = o => seasonOf({ country: 'eng', seed: 7 + (o.slot || 0),
      opsMult: mult(o.slot, o.isBoss, o.div), ...o });
    const pW = wageAt(8, 2), up1 = go({ slot: 7, div: 1, wageRound: pW, pos: 5, posLast: 5, wins: 7 });
    const dn1 = go({ slot: 8, div: 2, wageRound: pW, pos: 5, posLast: 5, wins: 7 });
    const rW = wageAt(7, 1);
    const stay = go({ slot: 7, div: 1, wageRound: rW, pos: 7, posLast: 7, wins: 4 });
    const rel = go({ slot: 7, div: 2, wageRound: rW, pos: 3, posLast: 8, wins: 8,
      statOverride: econStature(7, false), seats: foundingSeats(7, false) });
    const par = wageAt(4, 1);
    const fr = go({ slot: 4, div: 1, wageRound: Math.round(par * 0.75), pos: 5, posLast: 5, wins: 7 });
    const nm = go({ slot: 4, div: 1, wageRound: par, pos: 5, posLast: 5, wins: 7 });
    const ag = go({ slot: 4, div: 1, wageRound: Math.round(par * 1.45), pos: 5, posLast: 5, wins: 7 });
    const s7 = go({ slot: 7, div: 1, wageRound: wageAt(7, 1), pos: 8, posLast: 8, wins: 2 });
    console.log('  ' + ('$' + (cand / 1000) + 'k').padStart(6)
      + ((up1.net - dn1.net >= 0 ? '+' : '') + $(up1.net - dn1.net)).padStart(18)
      + ((rel.net - stay.net >= 0 ? '+' : '') + $(rel.net - stay.net)).padStart(19)
      + $(fr.net).padStart(12) + $(nm.net).padStart(12) + $(ag.net).padStart(16)
      + $(s7.net).padStart(12));
  }
}
