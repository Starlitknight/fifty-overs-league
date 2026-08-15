#!/usr/bin/env node
/* tools/economy-audit-b2.mjs — WHAT DOES A CRICKETER COST, AND WHO CAN PAY IT?
 *
 * B2 redefined rating as the canonical card times a thousand, which moved the
 * world's median rating from about 25,700 to about 50,000. Every money curve in
 * the game hangs off that number, so every money curve had to be re-measured
 * rather than re-derived by arithmetic - a wage that "moves automatically
 * because rating moves" is exactly the thing that went stale the first time.
 *
 * So this deals the whole world and counts the money in it: wages and transfer
 * values by percentile and by OVR band, payroll and income by club tier, and
 * what each tier can actually afford out of a season. It changes nothing.
 *
 *   node tools/economy-audit-b2.mjs
 *   node tools/economy-audit-b2.mjs --json
 *
 * The income model is the STEADY STATE of the real one, not a second opinion
 * about it: supportTarget, gateSale, sponsorOf, BROADCAST_PER_HEAD and the
 * home cut are imported from server/economy.mjs and run at a mid-table
 * finish with a settled crowd. It is what a club earns in an ordinary season,
 * which is the only figure "can he afford him" can be asked against.
 */
import { makeHost } from '../server/enginehost.mjs';
import { countryConfigs, tierOfClub, squadFor } from '../server/init-world.mjs';
import { valueOf, quickSellOf } from '../server/market.mjs';
import {
  econStature, foundingBank, foundingSeats, supportTarget, sponsorOf,
  gateSale, TICKET, BROADCAST_PER_HEAD, HOME_CUT, MOOD_NEUTRAL, academyUpkeep
} from '../server/economy.mjs';
import { ROUNDS } from '../server/clock.mjs';

const wantJson = process.argv.includes('--json');
const host = makeHost();
const cfgs = countryConfigs(host);

// ---- deal the world exactly as the founding deals it ----------------------
const clubs = [];
for (const cfg of cfgs) {
  for (const club of cfg.clubs) {
    const tier = tierOfClub(cfg, club);
    const men = squadFor(host, cfg, club, 1);
    const ovrs = host.pkOvr(men);
    men.forEach((p, i) => { p.__ovr = ovrs[i]; p.__tier = tier; });
    clubs.push({ country: cfg.id, slot: club.slot, boss: !!club.boss, tier, men });
  }
}
const all = clubs.flatMap(c => c.men);

// ---- percentiles ----------------------------------------------------------
const pct = (arr, t) => {
  const a = arr.slice().sort((x, y) => x - y);
  return a[Math.max(0, Math.min(a.length - 1, Math.floor(t * (a.length - 1))))];
};
const money = n => '$' + Math.round(n).toLocaleString('en-US');
const dist = arr => ({
  min: pct(arr, 0), p10: pct(arr, 0.10), median: pct(arr, 0.50), p75: pct(arr, 0.75),
  p90: pct(arr, 0.90), p95: pct(arr, 0.95), p99: pct(arr, 0.99), max: pct(arr, 1)
});

const wages = all.map(p => +p.wage || 0);
const fees = all.map(p => valueOf(p));
const W = dist(wages), V = dist(fees);

// ---- by canonical OVR band ------------------------------------------------
const BANDS = [
  ['<30', o => o < 30], ['30-39', o => o >= 30 && o < 40], ['40-49', o => o >= 40 && o < 50],
  ['50-59', o => o >= 50 && o < 60], ['60-69', o => o >= 60 && o < 70],
  ['70-79', o => o >= 70 && o < 80], ['80-84', o => o >= 80 && o < 85],
  ['85-89', o => o >= 85 && o < 90], ['90+', o => o >= 90]
];
const byBand = BANDS.map(([name, f]) => {
  const men = all.filter(p => f(p.__ovr));
  return {
    band: name, n: men.length,
    wage: men.length ? Math.round(men.reduce((s, p) => s + (+p.wage || 0), 0) / men.length) : 0,
    fee: men.length ? Math.round(men.reduce((s, p) => s + valueOf(p), 0) / men.length) : 0,
    feeMax: men.length ? Math.max(...men.map(p => valueOf(p))) : 0
  };
});

// ---- what a club earns and what it pays -----------------------------------
//
// THE STEADY STATE, not a simulation. A club that finishes mid-table with a
// settled crowd: eight clubs a division, seven home matches a season out of
// fourteen rounds. Everything below is the real economy's own function run at
// that point, so if the economy moves this moves with it.
const MID_POS = 4, CLUBS_IN_DIV = 8;
function income(slot, boss) {
  const stat = econStature(slot, boss);
  const support = supportTarget(MOOD_NEUTRAL, MID_POS, CLUBS_IN_DIV, stat);
  const seats = foundingSeats(slot, boss);
  // one home matchday at the league's own price, through the real turnstile
  const sale = gateSale(support, seats, 0, () => TICKET, null, 0);
  const homeGate = Math.round(sale.take * HOME_CUT);
  const awayShare = sale.take - homeGate;                 // what a visit is worth
  const bcast = Math.round(sale.sold * BROADCAST_PER_HEAD);
  const sponsor = sponsorOf(MID_POS, MOOD_NEUTRAL, CLUBS_IN_DIV);
  const home = Math.round(ROUNDS / 2), away = ROUNDS - home;
  return {
    attendance: sale.sold,
    season: home * (homeGate + bcast) + away * awayShare + ROUNDS * sponsor,
    perRound: Math.round((home * (homeGate + bcast) + away * awayShare) / ROUNDS) + sponsor
  };
}

const TIERS = ['flagship', 'd1a', 'd1b', 'd2a', 'd2b', 'newcomer'];
const tierRows = TIERS.map(t => {
  const cs = clubs.filter(c => c.tier === t);
  if (!cs.length) return null;
  const rows = cs.map(c => {
    const payroll = c.men.reduce((s, p) => s + (+p.wage || 0), 0);
    const inc = income(c.slot, c.boss);
    return {
      payrollRound: payroll, payrollSeason: payroll * ROUNDS,
      income: inc.season, bank: foundingBank(c.slot, c.boss),
      ratio: payroll * ROUNDS / Math.max(1, inc.season),
      best: Math.max(...c.men.map(p => valueOf(p)))
    };
  });
  const mean = k => rows.reduce((s, r) => s + r[k], 0) / rows.length;
  return {
    tier: t, teams: cs.length,
    payrollRound: Math.round(mean('payrollRound')),
    payrollSeason: Math.round(mean('payrollSeason')),
    income: Math.round(mean('income')),
    ratio: mean('ratio'), bank: Math.round(mean('bank')),
    surplus: Math.round(mean('income') - mean('payrollSeason')),
    bestFee: Math.round(mean('best'))
  };
}).filter(Boolean);

// what the world's very best men cost, against what a club has
const top = all.slice().sort((a, b) => b.__ovr - a.__ovr).slice(0, 12)
  .map(p => ({ name: p.name, ovr: p.__ovr, wage: +p.wage || 0, fee: valueOf(p), quick: quickSellOf(p) }));

if (wantJson) {
  console.log(JSON.stringify({ wages: W, fees: V, byBand, tiers: tierRows, top }, null, 2));
} else {
  console.log('THE ECONOMY, over ' + all.length + ' cricketers in ' + clubs.length + ' clubs\n');
  console.log('WAGES (per round)');
  console.log('  min ' + money(W.min) + '  p10 ' + money(W.p10) + '  median ' + money(W.median) +
    '  p75 ' + money(W.p75) + '  p90 ' + money(W.p90) + '  p95 ' + money(W.p95) +
    '  p99 ' + money(W.p99) + '  max ' + money(W.max));
  console.log('\nTRANSFER VALUES');
  console.log('  min ' + money(V.min) + '  p10 ' + money(V.p10) + '  median ' + money(V.median) +
    '  p75 ' + money(V.p75) + '  p90 ' + money(V.p90) + '  p95 ' + money(V.p95) +
    '  p99 ' + money(V.p99) + '  max ' + money(V.max));
  console.log('\nBY CANONICAL OVR');
  console.log('  band      n     mean wage      mean fee       dearest');
  for (const b of byBand)
    console.log('  ' + b.band.padEnd(8) + String(b.n).padStart(5) + '  ' +
      money(b.wage).padStart(12) + '  ' + money(b.fee).padStart(12) + '  ' + money(b.feeMax).padStart(12));
  console.log('\nBY CLUB TIER (a mid-table season, settled crowd)');
  console.log('  tier      teams   payroll/rd   payroll/szn      income     wage/rev   surplus       bank   dearest man');
  for (const r of tierRows)
    console.log('  ' + r.tier.padEnd(10) + String(r.teams).padStart(4) + '  ' +
      money(r.payrollRound).padStart(11) + '  ' + money(r.payrollSeason).padStart(12) + '  ' +
      money(r.income).padStart(11) + '  ' + (100 * r.ratio).toFixed(1).padStart(8) + '%  ' +
      money(r.surplus).padStart(10) + '  ' + money(r.bank).padStart(10) + '  ' + money(r.bestFee).padStart(12));
  console.log('\nTHE DEAREST MEN ALIVE');
  for (const t of top)
    console.log('  ' + String(t.ovr).padStart(3) + '  ' + t.name.padEnd(22) +
      ' wage ' + money(t.wage).padStart(9) + '   fee ' + money(t.fee).padStart(12));
}
