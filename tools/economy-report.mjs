#!/usr/bin/env node
/* tools/economy-report.mjs — THE WHOLE AUDIT BATTERY
 *
 * Every experiment the era-2 economy audit asks for, run off the shipped laws
 * through tools/economy-audit.mjs. Measurement only. Nothing is written and no
 * constant is changed; the counterfactual switches (§9) are multipliers applied
 * INSIDE the model for one run and then dropped.
 *
 *   node tools/economy-report.mjs > docs/economy-realism-audit/battery.txt
 */
import { seasonOf, makeSquadShop, tierOf, pct, mean, $, SEASON_ROUNDS } from './economy-audit.mjs';
import { econStature, stature, foundingSeats, foundingSupport, foundingBankFor, DEBT_LIMIT } from '../server/economy.mjs';
import { isFullMember, MEDIA_SEASON, SPONSOR_SEASON, PRIZE_TABLE, PRIZE_PLAYOFF_CHAMP,
         operationsPerRound, sponsorSeasonValue, OPS_BASE_ROUND, OPS_PER_SEAT_ROUND,
         OPS_TOPFLIGHT_ROUND, FOUNDING_BANK_ERA2 } from '../server/financeconfig.mjs';

const shop = makeSquadShop();
const MID = { pos: 5, wins: 7 };

// every seat the world seats, with the payroll it is actually dealt
const seats = [];
for (const rid of shop.nations) {
  const sides = shop.sidesOf(rid);
  sides.forEach((side, slot) => {
    const isBoss = !!side.boss, div = side.div || (slot < 8 ? 1 : 2);
    const players = shop.deal(`${rid}|${slot}`, rid, side.arch, side.str, tierOf(slot, isBoss, div));
    if (players.length) seats.push({ rid, slot, isBoss, div, member: isFullMember(rid),
      wageRound: shop.wageOf(players), tier: tierOf(slot, isBoss, div) });
  });
}
const members = seats.filter(s => s.member);
const wageAt = (slot, div) => pct(members.filter(s => s.slot === slot && s.div === div).map(s => s.wageRound), 0.5);
const run = o => seasonOf({ country: 'eng', pos: MID.pos, wins: MID.wins, seed: 7 + (o.slot || 0), ...o });

console.log('ERA 2 ECONOMY AUDIT — every figure from the shipped laws');
console.log(`seats dealt: ${seats.length} clubs, ${members.length} at full members; season = ${SEASON_ROUNDS} league rounds, 7 home\n`);

// ---------------------------------------------------------------------------
console.log('=== §1/§2 THE SEAT, AND WHAT IT IS DEALT (full members, median of 10) ===');
console.log('  seat  tier       stat   seats  support   bank0    wage/rd   ops/rd  media/yr  sponsorV');
for (const div of [1, 2]) for (let s = 0; s < 8; s++) {
  const slot = div === 1 ? s : s + 8;
  const g = members.filter(x => x.slot === slot);
  if (!g.length) continue;
  const isBoss = slot === 0, stat = econStature(slot, isBoss);
  console.log(`  D${div}/${s}  ` + g[0].tier.padEnd(10) + stat.toFixed(2).padStart(6)
    + String(foundingSeats(slot, isBoss)).padStart(8) + String(foundingSupport(slot, isBoss)).padStart(9)
    + $(foundingBankFor(slot, isBoss, true)).padStart(11)
    + $(wageAt(slot, div)).padStart(10) + $(operationsPerRound(foundingSeats(slot, isBoss), div, 1)).padStart(9)
    + $(MEDIA_SEASON[div]).padStart(10)
    + $(sponsorSeasonValue(div, MID.pos, 8, 1, stat)).padStart(10));
}

// ---------------------------------------------------------------------------
console.log('\n=== §2 A MID-TABLE SEASON, BY SEAT (full members) ===');
console.log('  seat   revenue      cost       NET   wage/rev  end bank   minbank  P10 net   P90 net');
const seatSeasons = {};
for (const div of [1, 2]) for (let s = 0; s < 8; s++) {
  const slot = div === 1 ? s : s + 8;
  const g = members.filter(x => x.slot === slot);
  if (!g.length) continue;
  const ys = g.map(x => run({ slot, isBoss: slot === 0, div, wageRound: x.wageRound }));
  seatSeasons[`D${div}/${s}`] = ys;
  const md = f => pct(ys.map(y => y[f]), 0.5);
  console.log(`  D${div}/${s} ` + $(md('revenue')).padStart(10) + $(md('cost')).padStart(10)
    + $(md('net')).padStart(10)
    + (100 * pct(ys.map(y => y.wages / y.revenue), 0.5)).toFixed(0).padStart(9) + '%'
    + $(md('bank')).padStart(11) + $(md('minBank')).padStart(10)
    + $(pct(ys.map(y => y.net), 0.10)).padStart(10) + $(pct(ys.map(y => y.net), 0.90)).padStart(10));
}

// ---------------------------------------------------------------------------
console.log('\n=== §4 PROMOTION, BEFORE ANY STRENGTHENING (the same club, both divisions) ===');
console.log('  the promoted side is a D2 champion: slot 8 payroll, finishing 8th of 8 in D1');
const promoWage = wageAt(8, 2);
const d2Champ = run({ slot: 8, div: 2, wageRound: promoWage, pos: 1, posLast: 1, wins: 11 });
const d1New = run({ slot: 7, div: 1, wageRound: promoWage, pos: 8, posLast: 1, wins: 3,
  seats: foundingSeats(8, false), support: d2Champ.support, statOverride: econStature(8, false) });
const d1Stay = run({ slot: 8, div: 2, wageRound: promoWage, pos: 3, posLast: 1, wins: 8 });
const L = ['media', 'sponsor', 'sponsorBonus', 'prize', 'gate', 'wages', 'ops', 'upkeep'];
console.log('  line              in D2 (champion)   in D1 (8th)      change');
for (const f of L) console.log('  ' + f.padEnd(16) + $(d2Champ[f]).padStart(14) + $(d1New[f]).padStart(14)
  + ((d1New[f] - d2Champ[f] >= 0 ? '+' : '') + $(d1New[f] - d2Champ[f])).padStart(13));
console.log('  ' + 'REVENUE'.padEnd(16) + $(d2Champ.revenue).padStart(14) + $(d1New.revenue).padStart(14)
  + ('+' + $(d1New.revenue - d2Champ.revenue)).padStart(13));
console.log('  ' + 'COST'.padEnd(16) + $(d2Champ.cost).padStart(14) + $(d1New.cost).padStart(14)
  + ('+' + $(d1New.cost - d2Champ.cost)).padStart(13));
console.log('  ' + 'NET'.padEnd(16) + $(d2Champ.net).padStart(14) + $(d1New.net).padStart(14)
  + ((d1New.net - d2Champ.net >= 0 ? '+' : '') + $(d1New.net - d2Champ.net)).padStart(13));
console.log(`  attendance ${d2Champ.avgAtt} -> ${d1New.avgAtt}  (+${(100 * (d1New.avgAtt / d2Champ.avgAtt - 1)).toFixed(0)}%)`);
console.log('\n  and if the promoted club STRENGTHENS its squad:');
for (const [label, mult] of [['sensible +25%', 1.25], ['aggressive +60%', 1.60], ['to a D1 payroll', wageAt(7, 1) / promoWage]]) {
  const y = run({ slot: 7, div: 1, wageRound: Math.round(promoWage * mult), pos: 8, posLast: 1, wins: 3,
    seats: foundingSeats(8, false), support: d2Champ.support, statOverride: econStature(8, false) });
  console.log('    ' + label.padEnd(18) + 'payroll ' + $(Math.round(promoWage * mult)).padStart(9)
    + '   net ' + $(y.net).padStart(12) + '   vs staying down ' + $(y.net - d1Stay.net).padStart(12));
}

// ---------------------------------------------------------------------------
console.log('\n=== §5 RELEGATION (the same club, same squad, one division down) ===');
const relWage = wageAt(7, 1);
const stayUp = run({ slot: 7, div: 1, wageRound: relWage, pos: 7, posLast: 7, wins: 4 });
const goDown = run({ slot: 7, div: 2, wageRound: relWage, pos: 3, posLast: 8, wins: 8,
  statOverride: econStature(7, false), seats: foundingSeats(7, false) });
console.log('  line                   stayed up      relegated       change');
for (const f of L) console.log('  ' + f.padEnd(20) + $(stayUp[f]).padStart(13) + $(goDown[f]).padStart(14)
  + ((goDown[f] - stayUp[f] >= 0 ? '+' : '') + $(goDown[f] - stayUp[f])).padStart(13));
console.log('  ' + 'NET'.padEnd(20) + $(stayUp.net).padStart(13) + $(goDown.net).padStart(14)
  + ((goDown.net - stayUp.net >= 0 ? '+' : '') + $(goDown.net - stayUp.net)).padStart(13));

// ---------------------------------------------------------------------------
console.log('\n=== §13 WHAT SPORTING SUCCESS IS WORTH (a strong D1 club, payroll fixed) ===');
const strong = wageAt(1, 1);
console.log('  finish                      prize   sponsorBonus         net      vs 8th');
const base8 = run({ slot: 1, div: 1, wageRound: strong, pos: 8, posLast: 8, wins: 2 });
for (const [label, o] of [
  ['8th of 8', { pos: 8, posLast: 8, wins: 2 }],
  ['4th of 8', { pos: 4, posLast: 4, wins: 7 }],
  ['1st, no playoff run', { pos: 1, posLast: 1, wins: 11 }],
  ['1st + lose the semi', { pos: 1, posLast: 1, wins: 11, playoffRounds: 1 }],
  ['1st + lose the final', { pos: 1, posLast: 1, wins: 11, playoffRounds: 2 }],
  ['1st + CHAMPIONS', { pos: 1, posLast: 1, wins: 11, playoffRounds: 2, playoffWin: true }]
]) {
  const y = run({ slot: 1, div: 1, wageRound: strong, ...o });
  console.log('  ' + label.padEnd(22) + $(y.prize).padStart(11) + $(y.sponsorBonus).padStart(14)
    + $(y.net).padStart(12) + ((y.net - base8.net >= 0 ? '+' : '') + $(y.net - base8.net)).padStart(12));
}
console.log(`  one playoff round costs a club its whole cost base: `
  + $(strong + operationsPerRound(foundingSeats(1, false), 1, 1) + 14000)
  + ` and pays $0; the champions' cheque is ` + $(PRIZE_PLAYOFF_CHAMP[1]));

// ---------------------------------------------------------------------------
console.log('\n=== §7 ECON STATURE: what one step does (D1 seat, payroll held) ===');
console.log('  stat   seats  support   bank0   sponsorV   gate/yr   ops/yr   revenue      NET');
for (let st = 0.62; st <= 1.001; st += 0.06) {
  const y = seasonOf({ slot: 4, div: 1, country: 'eng', wageRound: wageAt(4, 1), pos: MID.pos, wins: MID.wins,
    seed: 11, statOverride: st,
    seats: Math.round(15000 * (1 + 0.95 * st) / 1000) * 1000,
    support: Math.round(12000 * (0.40 + 1.62 * Math.pow(st, 1.45))) });
  console.log('  ' + st.toFixed(2).padStart(5) + String(y.seats).padStart(8) + String(y.support0).padStart(9)
    + $(Math.round(FOUNDING_BANK_ERA2 * (0.55 + 0.75 * st) / 1000) * 1000).padStart(10)
    + $(y.spV).padStart(11) + $(y.gate).padStart(10) + $(y.ops).padStart(10)
    + $(y.revenue).padStart(10) + $(y.net).padStart(10));
}

// ---------------------------------------------------------------------------
console.log('\n=== §8 WAGE BURDEN (full members, mid-table season) ===');
console.log('  seat   wages/revenue   wages/cost    revenue/rd    wages/rd');
for (const key of Object.keys(seatSeasons)) {
  const ys = seatSeasons[key];
  console.log('  ' + key.padEnd(7)
    + (100 * pct(ys.map(y => y.wages / y.revenue), 0.5)).toFixed(1).padStart(12) + '%'
    + (100 * pct(ys.map(y => y.wages / y.cost), 0.5)).toFixed(1).padStart(12) + '%'
    + $(pct(ys.map(y => y.revenue / SEASON_ROUNDS), 0.5)).padStart(14)
    + $(pct(ys.map(y => y.wages / SEASON_ROUNDS), 0.5)).padStart(12));
}

// ---------------------------------------------------------------------------
console.log('\n=== §9 THE COUNTERFACTUAL SWITCHES (a D1/1 club and a D2/0 club) ===');
console.log('  arm                                        D1/1 net     D2/0 net');
const armD1 = o => run({ slot: 1, div: 1, wageRound: wageAt(1, 1), ...o });
const armD2 = o => run({ slot: 8, div: 2, wageRound: wageAt(8, 2), ...o });
const mediaD2overD1 = MEDIA_SEASON[2] / MEDIA_SEASON[1], sponD2overD1 = SPONSOR_SEASON[2] / SPONSOR_SEASON[1];
const opsD2 = operationsPerRound(foundingSeats(1, false), 2, 1) / operationsPerRound(foundingSeats(1, false), 1, 1);
const ARMS = [
  ['A current', {}, {}],
  ['B D1 wages on D2 commercial', { mediaMult: mediaD2overD1, sponsorMult: sponD2overD1, gateMult: 0.8 }, {}],
  ['C D2 wages on D1 commercial', { wageRound: wageAt(8, 2) }, { mediaMult: 1 / mediaD2overD1, sponsorMult: 1 / sponD2overD1, gateMult: 1 / 0.8 }],
  ['D equalised operating costs', { opsMult: opsD2 }, {}],
  ['E equalised media + sponsor', { mediaMult: mediaD2overD1, sponsorMult: sponD2overD1 }, { mediaMult: 1 / mediaD2overD1, sponsorMult: 1 / sponD2overD1 }]
];
for (const [label, a, b] of ARMS)
  console.log('  ' + label.padEnd(40) + $(armD1(a).net).padStart(12) + $(armD2(b).net).padStart(13));

// ---------------------------------------------------------------------------
console.log('\n=== §10 ATTENDANCE: what it answers to (a D1/4 club) ===');
const attOf = o => run({ slot: 4, div: 1, wageRound: wageAt(4, 1), ...o }).avgAtt;
console.log('  finishing 1st vs 8th        ' + attOf({ pos: 1, wins: 11 }) + ' vs ' + attOf({ pos: 8, wins: 2 }));
console.log('  D1 vs the same club in D2   ' + attOf({}) + ' vs '
  + run({ slot: 4, div: 2, wageRound: wageAt(4, 1), statOverride: econStature(4, false),
    seats: foundingSeats(4, false) }).avgAtt);
console.log('  a boss visiting every home  ' + attOf({ bossOpponents: 7 }) + ' vs none ' + attOf({ bossOpponents: 0, topOpponents: 0 }));
console.log('  seats 26,000 vs 45,000      ' + attOf({}) + ' vs ' + attOf({ seats: 45000 }));
console.log('  (opponent STRENGTH is not read at all - only whether he is the flagship or top three)');

// ---------------------------------------------------------------------------
console.log('\n=== §11/§12 THE DIVISION PREMIUM, AND WHAT IT BUYS ===');
const opsPrem = OPS_TOPFLIGHT_ROUND * SEASON_ROUNDS;
console.log('  media          D1 ' + $(MEDIA_SEASON[1]) + '   D2 ' + $(MEDIA_SEASON[2])
  + '   premium ' + $(MEDIA_SEASON[1] - MEDIA_SEASON[2]));
console.log('  sponsor (mid)  D1 ' + $(sponsorSeasonValue(1, 5, 8, 1, 0.65)) + '   D2 ' + $(sponsorSeasonValue(2, 5, 8, 1, 0.62))
  + '   premium ' + $(sponsorSeasonValue(1, 5, 8, 1, 0.65) - sponsorSeasonValue(2, 5, 8, 1, 0.62)));
console.log('  prize (5th)    D1 ' + $(PRIZE_TABLE[1][4]) + '   D2 ' + $(PRIZE_TABLE[2][4])
  + '   premium ' + $(PRIZE_TABLE[1][4] - PRIZE_TABLE[2][4]));
console.log('  crowd          D1 x1.00  D2 x0.80  -> gate premium about +25%');
console.log('  TOP-FLIGHT OPS PREMIUM  ' + $(OPS_TOPFLIGHT_ROUND) + ' a round = ' + $(opsPrem) + ' a season');

// ---------------------------------------------------------------------------
console.log('\n=== §14 MANAGEMENT ARCHETYPES (mid-table finish, payroll is the choice) ===');
console.log('  division  style         payroll/rd        net    end bank   admin rds');
for (const [div, slot] of [[1, 4], [2, 8]]) {
  const par = wageAt(slot, div);
  for (const [label, m] of [['frugal x0.75', 0.75], ['normal x1.00', 1.00], ['aggressive x1.45', 1.45]]) {
    const y = run({ slot, div, wageRound: Math.round(par * m) });
    console.log(`  D${div}       ` + label.padEnd(16) + $(Math.round(par * m)).padStart(10)
      + $(y.net).padStart(12) + $(y.bank).padStart(12) + String(y.adminRounds).padStart(8));
  }
}

// ---------------------------------------------------------------------------
console.log('\n=== §15 A BAD SEASON (bottom of the division, no cup run) ===');
console.log('  seat        good year (2nd)     bad year (8th)      swing');
for (const [div, slot] of [[1, 1], [1, 7], [2, 8], [2, 15]]) {
  const w = wageAt(slot, div);
  const good = run({ slot, div, wageRound: w, pos: 2, posLast: 2, wins: 10 });
  const bad = run({ slot, div, wageRound: w, pos: 8, posLast: 8, wins: 2 });
  console.log(`  D${div}/${div === 1 ? slot : slot - 8}      ` + $(good.net).padStart(14) + $(bad.net).padStart(18)
    + $(bad.net - good.net).padStart(13) + '   end bank ' + $(bad.bank));
}

// ---------------------------------------------------------------------------
console.log('\n=== §16/§19 FIVE SEASONS: capital against cashflow ===');
console.log('  seat    bank0   after1   after2   after3   after4   after5   admin by');
for (const [div, slot] of [[1, 0], [1, 1], [1, 4], [1, 7], [2, 8], [2, 12]]) {
  const w = wageAt(slot, div);
  let bank = foundingBankFor(slot, slot === 0, true), adminAt = '-';
  const line = [];
  for (let s = 1; s <= 5; s++) {
    const y = run({ slot, isBoss: slot === 0, div, wageRound: w, bank0: bank });
    bank = y.bank; line.push(bank);
    if (adminAt === '-' && y.adminRounds > 0) adminAt = 'season ' + s;
  }
  console.log(`  D${div}/${div === 1 ? slot : slot - 8}  ` + $(foundingBankFor(slot, slot === 0, true)).padStart(10)
    + line.map(v => $(v).padStart(9)).join('') + '   ' + adminAt);
}

// ---------------------------------------------------------------------------
// §6 THE SEAT AS THE WORLD ACTUALLY PLAYS IT. Everything above gives every
// club a mid-table finish, which isolates the seat but is not the world: the
// strength ladder means a seat's LIKELY FINISH is part of what the seat is.
// The flagship wins; slot 7 comes last. Position is worth up to $4m a season
// (§13), so a table that ignores it is measuring half the seat.
// ---------------------------------------------------------------------------
console.log('\n=== §6 THE SEAT AS PLAYED: each seat finishes where its strength puts it ===');
console.log('  seat  finish   payroll/rd    revenue      cost       NET   after 1   after 3   after 5   admin by');
const played = {};
for (const [div, base] of [[1, 0], [2, 8]]) for (let s = 0; s < 8; s++) {
  const slot = base + s, isBoss = slot === 0;
  const w = wageAt(slot, div);
  const pos = s + 1;                                  // strongest seat wins its division
  const wins = Math.round(2 + (8 - pos) * 9 / 7);     // last: 2 wins, first: 11
  // the top four of each division play the semi-final; the top two the final
  const po = pos <= 2 ? 2 : pos <= 4 ? 1 : 0;
  let bank = foundingBankFor(slot, isBoss, true), adminAt = '-';
  const line = [];
  let first = null;
  for (let n = 1; n <= 5; n++) {
    const y = run({ slot, isBoss, div, wageRound: w, pos, posLast: pos, wins,
      playoffRounds: po, playoffWin: pos === 1, bank0: bank });
    if (!first) first = y;
    bank = y.bank; line.push(bank);
    if (adminAt === '-' && y.adminRounds > 0) adminAt = 'season ' + n;
  }
  played[`D${div}/${s}`] = first;
  console.log(`  D${div}/${s} ` + String(pos).padStart(6) + $(w).padStart(13)
    + $(first.revenue).padStart(11) + $(first.cost).padStart(10) + $(first.net).padStart(10)
    + [line[0], line[2], line[4]].map(v => $(v).padStart(10)).join('') + '   ' + adminAt);
}

// ---------------------------------------------------------------------------
console.log('\n=== §17 THE PROMOTION LOOP: a club that goes up, then comes back down ===');
const upWage = wageAt(8, 2);
let bank = foundingBankFor(8, false, true);
const loop = [
  ['D2, 3rd', { slot: 8, div: 2, pos: 3, wins: 8 }],
  ['D2, 1st - promoted', { slot: 8, div: 2, pos: 1, posLast: 3, wins: 11, playoffRounds: 2, playoffWin: true }],
  ['D1, 8th - relegated', { slot: 7, div: 1, pos: 8, posLast: 1, wins: 2, statOverride: econStature(8, false), seats: foundingSeats(8, false) }],
  ['D2, 2nd', { slot: 8, div: 2, pos: 2, posLast: 8, wins: 10, playoffRounds: 1 }],
  ['D2, 1st - promoted', { slot: 8, div: 2, pos: 1, posLast: 2, wins: 11, playoffRounds: 2, playoffWin: true }],
  ['D1, 7th', { slot: 7, div: 1, pos: 7, posLast: 1, wins: 3, statOverride: econStature(8, false), seats: foundingSeats(8, false) }]
];
console.log('  season                    revenue      cost       NET   end bank');
for (const [label, o] of loop) {
  const y = run({ wageRound: upWage, bank0: bank, ...o });
  bank = y.bank;
  console.log('  ' + label.padEnd(22) + $(y.revenue).padStart(11) + $(y.cost).padStart(10)
    + $(y.net).padStart(10) + $(y.bank).padStart(11));
}

// ---------------------------------------------------------------------------
console.log('\n=== §18 TRANSFERS: how much trading would baseline operations need? ===');
for (const key of Object.keys(played)) {
  const y = played[key];
  if (y.net >= 0) continue;
  console.log('  ' + key.padEnd(7) + 'needs ' + $(-y.net).padStart(12)
    + ' of net player trading a season merely to break even');
}
console.log('  (a mid-table D1 squad is ' + $(wageAt(4, 1) * 14) + ' of wages a season, so that is the scale)');

// ---------------------------------------------------------------------------
console.log('\n=== §21 ROOT CAUSE: the income ladder against the payroll ladder ===');
console.log('  the world deals five strength rungs; the economy pays two-and-a-bit');
console.log('  rung        seats   payroll/rd   x weakest   revenue/yr   x weakest');
const rungs = [['flagship', 0, 1], ['d1a', 1, 1], ['d1b', 5, 1], ['d2a', 8, 2], ['d2b', 12, 2]];
const weakW = wageAt(12, 2), weakR = played['D2/4'].revenue;
for (const [name, slot, div] of rungs) {
  const w = wageAt(slot, div), rev = played[`D${div}/${div === 1 ? slot : slot - 8}`].revenue;
  console.log('  ' + name.padEnd(11) + String(foundingSeats(slot, slot === 0)).padStart(7)
    + $(w).padStart(13) + ('x' + (w / weakW).toFixed(2)).padStart(12)
    + $(rev).padStart(13) + ('x' + (rev / weakR).toFixed(2)).padStart(12));
}

// ---------------------------------------------------------------------------
// §22 CANDIDATE LAWS, MEASURED. Nothing here is applied: each arm is a
// multiplier handed to the model for one run and dropped. The test is whether
// ONE law, propagating on its own, brings every seat inside a sane band while
// leaving the manager's decisions (payroll, position, risk) doing the work.
// ---------------------------------------------------------------------------
console.log('\n=== §22 CANDIDATE FIXES, MEASURED (as-played positions, five seasons) ===');
const SEATS = [];
for (const [div, base] of [[1, 0], [2, 8]]) for (let s = 0; s < 8; s++) {
  const slot = base + s, pos = s + 1;
  SEATS.push({ key: `D${div}/${s}`, slot, div, isBoss: slot === 0, pos,
    wins: Math.round(2 + (8 - pos) * 9 / 7), po: pos <= 2 ? 2 : pos <= 4 ? 1 : 0,
    w: wageAt(slot, div) });
}
// how far a candidate lifts the income ladder, measured as the ratio of the
// richest seat's revenue to the poorest - the payroll ladder is x4.57
function arm(label, extra) {
  const rows = SEATS.map(S => {
    let bank = foundingBankFor(S.slot, S.isBoss, true);
    let first = null, worst = 0;
    for (let n = 1; n <= 5; n++) {
      const y = run({ slot: S.slot, isBoss: S.isBoss, div: S.div, wageRound: S.w, pos: S.pos,
        posLast: S.pos, wins: S.wins, playoffRounds: S.po, playoffWin: S.pos === 1,
        bank0: bank, ...extra(S) });
      if (!first) first = y;
      bank = y.bank; if (y.adminRounds) worst = worst || n;
    }
    return { key: S.key, net: first.net, rev: first.revenue, end: bank, adminAt: worst };
  });
  const rev = rows.map(r => r.rev);
  console.log('  ' + label.padEnd(38)
    + 'ladder x' + (Math.max(...rev) / Math.min(...rev)).toFixed(2)
    + '   ruined ' + String(rows.filter(r => r.adminAt).length).padStart(2) + '/16'
    + '   D1 net ' + $(mean(rows.slice(0, 8).map(r => r.net))).padStart(11)
    + '   D2 net ' + $(mean(rows.slice(8).map(r => r.net))).padStart(11)
    + '   richest end ' + $(Math.max(...rows.map(r => r.end))).padStart(11));
  return rows;
}
const STAT_FLOOR = 0.62;
arm('current law', () => ({}));
arm('A media reads stature (span x2.0)', S => ({
  mediaMult: (econStature(S.slot, S.isBoss) / STAT_FLOOR) ** (Math.log(2.0) / Math.log(1 / STAT_FLOOR)) }));
arm('A2 media reads stature (span x3.0)', S => ({
  mediaMult: (econStature(S.slot, S.isBoss) / STAT_FLOOR) ** (Math.log(3.0) / Math.log(1 / STAT_FLOOR)) }));
arm('B no top-flight ops premium', S => ({
  opsMult: S.div === 1 ? operationsPerRound(foundingSeats(S.slot, S.isBoss), 2, 1)
    / operationsPerRound(foundingSeats(S.slot, S.isBoss), 1, 1) : 1 }));
arm('C playoff rounds are funded', S => ({ playoffRounds: 0 }));
arm('A2 + C together', S => ({
  mediaMult: (econStature(S.slot, S.isBoss) / STAT_FLOOR) ** (Math.log(3.0) / Math.log(1 / STAT_FLOOR)),
  playoffRounds: 0 }));
console.log('  (for reference the PAYROLL ladder across the same sixteen seats is x'
  + (Math.max(...SEATS.map(S => S.w)) / Math.min(...SEATS.map(S => S.w))).toFixed(2) + ')');

// ---------------------------------------------------------------------------
// §22b THE COORDINATE ITSELF. The arms above move a PRICE. These move the
// economy's only wealth COORDINATE, because that is where the mismatch is:
// econStature is floored at 0.62 for all eight Division Two seats while the
// generator deals them a x1.88 payroll spread, so no price that reads stature
// can tell a d2a club from a d2b one. A stature is re-derived here from the
// dealt payroll ladder and handed to every law that already reads stature -
// the seats, the following, the founding bank and the sponsor - all at once.
// ---------------------------------------------------------------------------
console.log('\n=== §22b MOVING THE COORDINATE, NOT THE PRICE ===');
const payAt = {}; for (const S of SEATS) payAt[S.slot] = S.w;
const payTop = payAt[0], payBot = payAt[15];
const statFrom = (slot, isBoss, p) =>
  Math.max(0.30, Math.min(1, Math.pow(payAt[slot] / payTop, p)));
function coordArm(label, statOf) {
  const rows = SEATS.map(S => {
    const st = statOf(S);
    const seats = Math.round(15000 * (1 + 0.95 * st) / 1000) * 1000;
    const sup = Math.round(12000 * (0.40 + 1.62 * Math.pow(st, 1.45)));
    let bank = Math.round(FOUNDING_BANK_ERA2 * (0.55 + 0.75 * st) / 1000) * 1000;
    let first = null, ruinAt = 0;
    for (let n = 1; n <= 5; n++) {
      const y = run({ slot: S.slot, isBoss: S.isBoss, div: S.div, wageRound: S.w, pos: S.pos,
        posLast: S.pos, wins: S.wins, playoffRounds: S.po, playoffWin: S.pos === 1,
        bank0: bank, statOverride: st, seats, support: sup });
      if (!first) first = y;
      bank = y.bank; if (y.adminRounds && !ruinAt) ruinAt = n;
    }
    return { key: S.key, st, net: first.net, rev: first.revenue, end: bank, ruinAt };
  });
  const rev = rows.map(r => r.rev);
  console.log('  ' + label.padEnd(34)
    + 'income ladder x' + (Math.max(...rev) / Math.min(...rev)).toFixed(2)
    + '   ruined ' + String(rows.filter(r => r.ruinAt).length).padStart(2) + '/16'
    + '   worst net ' + $(Math.min(...rows.map(r => r.net))).padStart(11)
    + '   best end ' + $(Math.max(...rows.map(r => r.end))).padStart(11));
  return rows;
}
coordArm('current (floor 0.62)', S => econStature(S.slot, S.isBoss));
coordArm('no floor (stature as written)', S => Math.max(0.30, stature(S.slot, S.isBoss)));
for (const p of [0.35, 0.50, 0.65, 0.80]) coordArm(`stature from payroll ^${p.toFixed(2)}`, S => statFrom(S.slot, S.isBoss, p));
console.log('\n  the same arms with the playoff rounds funded as well:');
const savePO = SEATS.map(S => S.po);
SEATS.forEach(S => { S.po = 0; });
coordArm('current (floor 0.62) + funded PO', S => econStature(S.slot, S.isBoss));
for (const p of [0.50, 0.65]) coordArm(`payroll ^${p.toFixed(2)} + funded PO`, S => statFrom(S.slot, S.isBoss, p));
SEATS.forEach((S, i) => { S.po = savePO[i]; });
console.log('\n  the seat-by-seat detail of the best arm (payroll^0.65, funded playoffs):');
SEATS.forEach(S => { S.po = 0; });
const best = coordArm('payroll^0.65 + funded PO', S => statFrom(S.slot, S.isBoss, 0.65));
SEATS.forEach((S, i) => { S.po = savePO[i]; });
console.log('  seat   stature   revenue/yr     net/yr    bank after 5');
for (const r of best) console.log('  ' + r.key.padEnd(7) + r.st.toFixed(3).padStart(8)
  + $(r.rev).padStart(13) + $(r.net).padStart(12) + $(r.end).padStart(14));

// ---------------------------------------------------------------------------
// §22c THE LINE THAT IS ACTUALLY FLAT. The coordinate arms move the gate, the
// sponsor and the founding bank and barely shift the ladder, because the
// single biggest line in a club's year is the MEDIA DISTRIBUTION and it is
// paid "to every club in the division equally" by design. A merit ladder is
// what every real pyramid distributes on. Here the same division pool is
// re-divided by the club's own standing in the world, pool-neutral, and swept.
// ---------------------------------------------------------------------------
console.log('\n=== §22c RE-DIVIDING THE SAME MEDIA POOL BY MERIT (pool-neutral) ===');
const divMeanPay = {};
for (const d of [1, 2]) divMeanPay[d] = mean(SEATS.filter(S => S.div === d).map(S => S.w));
function mediaArm(label, q, fundPO) {
  const savedPO = SEATS.map(S => S.po);
  if (fundPO) SEATS.forEach(S => { S.po = 0; });
  const share = S => Math.pow(S.w / divMeanPay[S.div], q);
  const norm = {};
  for (const d of [1, 2]) {
    const g = SEATS.filter(S => S.div === d);
    norm[d] = g.length / g.reduce((t, S) => t + share(S), 0);   // keeps the pool exactly
  }
  const rows = SEATS.map(S => {
    let bank = foundingBankFor(S.slot, S.isBoss, true);
    let first = null, ruinAt = 0;
    for (let n = 1; n <= 5; n++) {
      const y = run({ slot: S.slot, isBoss: S.isBoss, div: S.div, wageRound: S.w, pos: S.pos,
        posLast: S.pos, wins: S.wins, playoffRounds: S.po, playoffWin: S.pos === 1,
        bank0: bank, mediaMult: share(S) * norm[S.div] });
      if (!first) first = y;
      bank = y.bank; if (y.adminRounds && !ruinAt) ruinAt = n;
    }
    return { key: S.key, net: first.net, rev: first.revenue, end: bank, ruinAt,
      media: first.media };
  });
  const rev = rows.map(r => r.rev), nets = rows.map(r => r.net);
  console.log('  ' + label.padEnd(30)
    + 'income x' + (Math.max(...rev) / Math.min(...rev)).toFixed(2)
    + '  ruined ' + String(rows.filter(r => r.ruinAt).length).padStart(2) + '/16'
    + '  worst ' + $(Math.min(...nets)).padStart(11)
    + '  best ' + $(Math.max(...nets)).padStart(10)
    + '  spread ' + $(Math.max(...nets) - Math.min(...nets)).padStart(11)
    + '  best end ' + $(Math.max(...rows.map(r => r.end))).padStart(11));
  SEATS.forEach((S, i) => { S.po = savedPO[i]; });
  return rows;
}
mediaArm('flat (today)', 0, false);
for (const q of [0.4, 0.7, 1.0]) mediaArm(`media ^${q.toFixed(1)} of payroll`, q, false);
console.log('  and with the playoff rounds funded too:');
mediaArm('flat + funded playoffs', 0, true);
for (const q of [0.4, 0.7, 1.0]) mediaArm(`media ^${q.toFixed(1)} + funded PO`, q, true);
const detail = mediaArm('media ^0.7 + funded PO', 0.7, true);
console.log('\n  seat-by-seat, media^0.7 with funded playoffs:');
console.log('  seat    media/yr   revenue/yr      net/yr   bank after 5');
for (const r of detail) console.log('  ' + r.key.padEnd(7) + $(r.media).padStart(11)
  + $(r.rev).padStart(13) + $(r.net).padStart(12) + $(r.end).padStart(15));

// ---------------------------------------------------------------------------
console.log('\n=== §22d THE TWO ARMS THAT ACTUALLY MOVE IT, SEAT BY SEAT ===');
function detailArm(label, extra, fundPO) {
  const savedPO = SEATS.map(S => S.po);
  if (fundPO) SEATS.forEach(S => { S.po = 0; });
  console.log('\n  ' + label);
  console.log('  seat   revenue/yr      net/yr   bank after 5   ruined');
  const nets = [];
  for (const S of SEATS) {
    let bank = foundingBankFor(S.slot, S.isBoss, true); let first = null, ruinAt = 0;
    for (let n = 1; n <= 5; n++) {
      const y = run({ slot: S.slot, isBoss: S.isBoss, div: S.div, wageRound: S.w, pos: S.pos,
        posLast: S.pos, wins: S.wins, playoffRounds: S.po, playoffWin: S.pos === 1,
        bank0: bank, ...extra(S) });
      if (!first) first = y; bank = y.bank; if (y.adminRounds && !ruinAt) ruinAt = n;
    }
    nets.push(first.net);
    console.log('  ' + S.key.padEnd(7) + $(first.revenue).padStart(12) + $(first.net).padStart(12)
      + $(bank).padStart(15) + (ruinAt ? '  season ' + ruinAt : '  -').padStart(11));
  }
  console.log('  mean D1 net ' + $(mean(nets.slice(0, 8))) + '   mean D2 net ' + $(mean(nets.slice(8))));
  SEATS.forEach((S, i) => { S.po = savedPO[i]; });
}
const noTop = S => ({ opsMult: S.div === 1
  ? operationsPerRound(foundingSeats(S.slot, S.isBoss), 2, 1) / operationsPerRound(foundingSeats(S.slot, S.isBoss), 1, 1)
  : 1 });
detailArm('B: the top-flight operations premium removed', noTop, false);
detailArm('B + C: ...and the playoff rounds funded', noTop, true);

console.log('\n=== §20 HOW POSITION-CONTINGENT A CLUB\'S INCOME IS ===');
console.log('  the same club, payroll fixed, finishing 1st through 8th');
console.log('  finish   revenue      net    share of revenue that moved');
const fixW = wageAt(4, 1);
const rev1 = run({ slot: 4, div: 1, wageRound: fixW, pos: 1, posLast: 1, wins: 11 }).revenue;
for (const p of [1, 2, 4, 6, 8]) {
  const y = run({ slot: 4, div: 1, wageRound: fixW, pos: p, posLast: p, wins: Math.round(2 + (8 - p) * 9 / 7) });
  console.log('  ' + String(p).padStart(4) + $(y.revenue).padStart(12) + $(y.net).padStart(12)
    + ((100 * (1 - y.revenue / rev1)).toFixed(0) + '% below 1st').padStart(22));
}
