#!/usr/bin/env node
/* tools/economy-seats.mjs — §2 THE SEAT TABLE, AND §3 THE WATERFALL
 *
 * Deals every seat in every nation the shipped generator seats, prices its
 * squad through the shipped wage curve, and walks it through a season of the
 * shipped economy. The point is to separate the SEAT from the DEAL: 16
 * nations give 16 independent draws of each seat, so a column below is a
 * distribution and not an anecdote.
 *
 *   node tools/economy-seats.mjs [--members]      full members only
 */
import { seasonOf, makeSquadShop, tierOf, pct, mean, $, k, SEASON_ROUNDS } from './economy-audit.mjs';
import { econStature, stature, foundingSeats, foundingSupport, foundingBankFor } from '../server/economy.mjs';
import { isFullMember, MEDIA_SEASON, operationsPerRound } from '../server/financeconfig.mjs';

const membersOnly = process.argv.includes('--members');
const shop = makeSquadShop();

// EVERY SEAT THE WORLD DEALS, with the squad it is actually dealt.
const seats = [];
for (const rid of shop.nations) {
  if (membersOnly && !isFullMember(rid)) continue;
  const sides = shop.sidesOf(rid);
  sides.forEach((side, slot) => {
    const isBoss = !!side.boss;
    const div = side.div || (slot < 8 ? 1 : 2);
    const players = shop.deal(`${rid}|${slot}`, rid, side.arch, side.str, tierOf(slot, isBoss, div));
    if (!players.length) return;
    seats.push({ rid, slot, isBoss, div, str: +side.str || 1,
      wageRound: shop.wageOf(players), squad: players.length });
  });
}
console.log(`dealt ${seats.length} clubs in ${new Set(seats.map(s => s.rid)).size} nations`);

// A MID-TABLE SEASON is the baseline: finishing fifth of eight with the wins
// that go with it. Position is swept separately in §13.
const MID_POS = 5, MID_WINS = 7;
const rows = seats.map(s => ({
  ...s,
  y: seasonOf({ slot: s.slot, isBoss: s.isBoss, div: s.div, country: s.rid,
    wageRound: s.wageRound, pos: MID_POS, wins: MID_WINS, seed: 7 + s.slot })
}));

const bySlot = {};
for (const r of rows) { const key = (r.div === 1 ? 'D1/' : 'D2/') + (r.div === 1 ? r.slot : r.slot - 8);
  (bySlot[key] = bySlot[key] || []).push(r); }

const F = ['bank0', 'wageRound', 'ops', 'upkeep', 'gate', 'media', 'sponsorAll', 'revenue', 'cost', 'net', 'bank', 'minBank'];
const valOf = (r, f) => f === 'bank0' ? r.y.bank0
  : f === 'wageRound' ? r.wageRound
  : f === 'sponsorAll' ? r.y.sponsor + r.y.sponsorBonus + r.y.prize
  : f === 'ops' ? r.y.ops : f === 'upkeep' ? r.y.upkeep
  : f === 'gate' ? r.y.gate : f === 'media' ? r.y.media
  : f === 'revenue' ? r.y.revenue : f === 'cost' ? r.y.cost
  : f === 'net' ? r.y.net : f === 'bank' ? r.y.bank : r.y.minBank;

console.log(`\n=== §2 THE SEAT TABLE — a mid-table season (${MID_POS}th of 8, ${MID_WINS} wins), ${SEASON_ROUNDS} rounds ===`);
console.log('  seat   n  stat  seats   supp  wage/rd    ops/yr   gate/yr  media/yr  spon+prize   revenue      cost       NET   end bank   admin');
const order = Object.keys(bySlot).sort((a, b) => (a[1] === b[1] ? +a.slice(3) - +b.slice(3) : a < b ? -1 : 1));
for (const key of order) {
  const g = bySlot[key], r0 = g[0];
  const md = f => pct(g.map(x => valOf(x, f)), 0.5);
  console.log('  ' + key.padEnd(6) + String(g.length).padStart(3)
    + r0.y.stat.toFixed(2).padStart(6) + String(r0.y.seats).padStart(7)
    + String(r0.y.support0).padStart(7)
    + $(md('wageRound')).padStart(9) + $(md('ops')).padStart(10) + $(md('gate')).padStart(10)
    + $(md('media')).padStart(10) + $(md('sponsorAll')).padStart(12)
    + $(md('revenue')).padStart(10) + $(md('cost')).padStart(10)
    + $(md('net')).padStart(10) + $(md('bank')).padStart(11)
    + String(g.filter(x => x.y.adminRounds > 0).length).padStart(8));
}

console.log('\n  --- the same seats, distribution of SEASON NET ---');
console.log('  seat     P10       P25    median       P75       P90      mean   under water');
for (const key of order) {
  const g = bySlot[key], nets = g.map(x => x.y.net);
  console.log('  ' + key.padEnd(6)
    + [0.10, 0.25, 0.50, 0.75, 0.90].map(q => $(pct(nets, q)).padStart(10)).join('')
    + $(mean(nets)).padStart(10)
    + `   ${g.filter(x => x.y.bank < 0).length}/${g.length}`);
}

// §3 THE WATERFALL. What promotion changes, line by line, holding the club
// itself fixed - same squad, same ground, same following, same finish.
console.log('\n=== §3 D1 MINUS D2, THE SAME CLUB IN BOTH — a mid-table season ===');
const probe = rows.filter(r => isFullMember(r.rid) && r.div === 1 && r.slot === 7);
console.log(`  taking the ${probe.length} slot-7 clubs of the full members as the promoted side`);
const lines = ['media', 'sponsor', 'sponsorBonus', 'prize', 'gate', 'wages', 'ops', 'upkeep', 'interest'];
const agg = {}; for (const L of lines) agg[L] = [];
const netD = [];
for (const r of probe) {
  const inD1 = seasonOf({ slot: r.slot, isBoss: false, div: 1, country: r.rid,
    wageRound: r.wageRound, pos: MID_POS, wins: MID_WINS, seed: 7 + r.slot });
  const inD2 = seasonOf({ slot: r.slot, isBoss: false, div: 2, country: r.rid,
    wageRound: r.wageRound, pos: MID_POS, wins: MID_WINS, seed: 7 + r.slot });
  for (const L of lines) agg[L].push((inD1[L] || 0) - (inD2[L] || 0));
  netD.push(inD1.net - inD2.net);
}
let running = 0;
for (const L of lines) {
  const d = pct(agg[L], 0.5);
  const signed = ['wages', 'ops', 'upkeep', 'interest'].includes(L) ? -d : d;
  running += signed;
  console.log('  ' + L.padEnd(14) + (signed >= 0 ? '+' : '') + $(signed).padStart(12)
    + '   running ' + ((running >= 0 ? '+' : '') + $(running)).padStart(12));
}
console.log('  ' + 'NET OF PROMOTION'.padEnd(14) + ((pct(netD, 0.5) >= 0 ? '+' : '') + $(pct(netD, 0.5))).padStart(12)
  + `   (P10 ${$(pct(netD, 0.10))}, P90 ${$(pct(netD, 0.90))})`);
