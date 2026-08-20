#!/usr/bin/env node
/* tools/ops-pyramid.mjs — THE OPERATIONS LAW IN A LADDER THAT MOVES
 *
 * ERA 2 CLUB-SCALE OPERATIONS, sections 11, 12, 13 and 19.
 *
 * Same machinery as tools/stature-pyramid.mjs, and for the same reason: a run
 * that freezes every club in the division it was dealt measures a world with
 * no pyramid in it. Division One's bottom two go down every year and Division
 * Two's top two come up, exactly as tick.mjs rollSeasons applies it, so a club
 * that would pile up money by winning Division Two five times running is a
 * club the game promoted after the first one.
 *
 * WHAT VARIES HERE is the operations law and nothing else. The stature law is
 * held at the shipped one - Phase 3's candidate stays frozen - and the noise
 * that decides a finish is seeded per nation per season, so every arm sees
 * IDENTICAL cricket. Any difference below is the operations law.
 *
 * THIS IS THE RUN THAT CAN SEE THE FLAGSHIP QUESTION. A one-season table
 * cannot: a following GROWS, and a law that charges for the following charges
 * a growing club more every year. That compounding is the whole of section 11
 * and it is invisible in a snapshot.
 *
 *   node tools/ops-pyramid.mjs [--seasons=10] [--sup=3]
 */
import { seasonOf, makeSquadShop, tierOf, mean, pct, $ } from './economy-audit.mjs';
import {
  econStature, foundingSeats, FOUNDING_SUPPORT, FOUNDING_SEATS
} from '../server/economy.mjs';
import {
  FOUNDING_BANK_ERA2, OPS_TOPFLIGHT_ROUND, OPS_BASE_ROUND, OPS_PER_SEAT_ROUND,
  OPS_PER_SUPPORTER_ROUND, operationsPerRound
} from '../server/financeconfig.mjs';
import { ROUNDS } from '../server/clock.mjs';
import { shipped, scaled } from './ops-laws.mjs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const SEASONS = +arg('seasons', 10);
const bankOf = st => Math.round(FOUNDING_BANK_ERA2 * (0.55 + 0.75 * st) / 1000) * 1000;
const seatsOf = st => Math.round(FOUNDING_SEATS * (1 + 0.95 * st) / 1000) * 1000;
const supOf = st => Math.round(FOUNDING_SUPPORT * (0.40 + 1.62 * Math.pow(st, 1.45)));

// THE ARMS. The candidate constants are the ones tools/ops-sweep.mjs solved
// against the median-holding anchor; they are repeated rather than imported so
// that this run states plainly what it charged.
const ARMS = {
  // the law as it stood BEFORE this phase, frozen as literals in ops-laws.mjs
  prior: { law: shipped, note: 'PRIOR LAW: $58,000 + seats x $3.10' },
  // the law as it now stands, read from financeconfig rather than restated
  shipped: { law: ({ seats, div, natOps, support }) =>
    operationsPerRound(seats, div, natOps, support),
  note: 'SHIPPED NOW: $' + OPS_BASE_ROUND.toLocaleString() + ' + seats x $'
    + OPS_PER_SEAT_ROUND + ' + support x $' + OPS_PER_SUPPORTER_ROUND },
  sup2: { law: scaled({ base: 48900, perSeat: 1.55, perSupporter: 2 }),
    note: '$48,900 + seats x $1.55 + support x $2.00' },
  sup3: { law: scaled({ base: 29000, perSeat: 1.55, perSupporter: 3 }),
    note: '$29,000 + seats x $1.55 + support x $3.00' },
  // THE VARIANT THAT LEAVES THE GROUND ALONE. The candidate halves the
  // per-seat term, and halving it is a real change to what a stand costs to
  // run, so the alternative that keeps $3.10 and pays for the supporter term
  // out of the base alone has to be measured rather than dismissed. Its base
  // solves to $11,700, which is the objection to it: a club that exists would
  // cost almost nothing fixed, and the travelling party alone is worth more.
  sup2seat31: { law: scaled({ base: 11700, perSeat: 3.1, perSupporter: 2 }),
    note: '$11,700 + seats x $3.10 + support x $2.00' }
};
const wanted = arg('arms', 'prior,shipped').split(',').filter(a => ARMS[a]);

const rng = seed => { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 1e6) / 1e6; }; };

const shop = makeSquadShop();
const nations = {};
for (const rid of shop.nations) {
  const sides = shop.sidesOf(rid), club = [];
  sides.forEach((side, slot) => {
    const isBoss = !!side.boss, div = side.div || (slot < 8 ? 1 : 2);
    const players = shop.deal(`${rid}|${slot}`, rid, side.arch, side.str, tierOf(slot, isBoss, div));
    if (players.length) club.push({ rid, slot, isBoss, div0: div, wageRound: shop.wageOf(players) });
  });
  if (club.length === 16) nations[rid] = club;
}
console.log(`${Object.keys(nations).length} nations, ${SEASONS} seasons, `
  + `division premium held at ${$(OPS_TOPFLIGHT_ROUND)}\n`);

function runNation(club, law, seed) {
  const R = rng(seed);
  const st = {};
  for (const c of club) {
    const s = econStature(c.slot, c.isBoss);
    st[c.slot] = { stat: s, bank: bankOf(s), support: supOf(s), seats: seatsOf(s),
      div: c.div0, adminRounds: 0, seasons: [], ups: 0, downs: 0 };
  }
  let divs = { 1: club.filter(c => c.div0 === 1).map(c => c.slot),
    2: club.filter(c => c.div0 === 2).map(c => c.slot) };
  for (let yr = 0; yr < SEASONS; yr++) {
    const order = {};
    for (const dv of [1, 2]) {
      order[dv] = divs[dv].slice().sort((a, b) => {
        const wa = club.find(c => c.slot === a).wageRound * (0.85 + 0.3 * R());
        const wb = club.find(c => c.slot === b).wageRound * (0.85 + 0.3 * R());
        return wb - wa;
      });
    }
    const pos = {}, wins = {};
    for (const dv of [1, 2]) order[dv].forEach((s, i) => { pos[s] = i + 1; wins[s] = 2 * (8 - (i + 1)); });
    const nat = club.map(c => c.slot).sort((a, b) => wins[b] - wins[a] || a - b);
    const posCountry = {}; nat.forEach((s, i) => { posCountry[s] = i + 1; });
    for (const c of club) {
      const S = st[c.slot], dv = divs[1].includes(c.slot) ? 1 : 2;
      const y = seasonOf({
        slot: c.slot, isBoss: c.isBoss, div: dv, country: c.rid,
        wageRound: c.wageRound, pos: pos[c.slot], posLast: pos[c.slot], wins: wins[c.slot],
        posCountry: posCountry[c.slot], clubsInCountry: 16,
        rounds: ROUNDS, homeRounds: ROUNDS / 2,
        bank0: S.bank, seats: S.seats, support: S.support,
        statOverride: S.stat, statRawOverride: S.stat,
        seed: 7 + c.slot + 100 * yr, opsLaw: law
      });
      S.bank = y.bank; S.support = y.support; S.adminRounds += y.adminRounds;
      S.div = dv;
      S.seasons.push({ dv, pos: pos[c.slot], net: y.net, rev: y.revenue,
        ops: y.ops, support: y.support });
    }
    const down = order[1].slice(-2), up = order[2].slice(0, 2);
    for (const s of up) st[s].ups++;
    for (const s of down) st[s].downs++;
    divs = { 1: divs[1].filter(s => !down.includes(s)).concat(up),
      2: divs[2].filter(s => !up.includes(s)).concat(down) };
  }
  return st;
}

const out = {};
for (const a of wanted) {
  out[a] = [];
  let i = 0;
  for (const rid of Object.keys(nations)) {
    const st = runNation(nations[rid], ARMS[a].law, 12345 + (i++) * 77);
    for (const slot of Object.keys(st)) out[a].push({ rid, slot: +slot, ...st[slot] });
  }
}

const med = a2 => { const s2 = a2.slice().sort((x, y) => x - y); return s2[Math.floor(s2.length / 2)]; };
for (const a of wanted) {
  const rows = out[a];
  console.log(`=== ARM: ${a}   ${ARMS[a].note} ===`);
  console.log('  slot   yrs in D1   annual net    ' + SEASONS + 'yr bank'
    + '          P90   ops yr1    ops yr' + SEASONS + '   support yr' + SEASONS + '  admin');
  for (let s = 0; s < 16; s++) {
    const g = rows.filter(r => r.slot === s);
    const banks = g.map(r => r.bank).sort((x, y) => x - y);
    const d1yrs = mean(g.map(r => r.seasons.filter(x => x.dv === 1).length));
    console.log('  ' + String(s).padStart(4) + d1yrs.toFixed(1).padStart(12)
      + $(mean(g.map(r => mean(r.seasons.map(x => x.net))))).padStart(13)
      + $(mean(banks)).padStart(13) + $(pct(banks, 0.90)).padStart(13)
      + $(mean(g.map(r => r.seasons[0].ops / ROUNDS))).padStart(10)
      + $(mean(g.map(r => r.seasons[r.seasons.length - 1].ops / ROUNDS))).padStart(11)
      + Math.round(mean(g.map(r => r.support))).toLocaleString().padStart(14)
      + mean(g.map(r => r.adminRounds)).toFixed(1).padStart(7));
  }
  const banksAll = rows.map(r => r.bank);
  console.log('  world median bank ' + $(med(banksAll))
    + '   P90 ' + $(pct(banksAll.slice().sort((x, y) => x - y), 0.90))
    + '   richest ' + $(Math.max(...banksAll))
    + '   poorest ' + $(Math.min(...banksAll)));
  console.log('  above $20m: ' + rows.filter(r => r.bank > 20e6).length
    + '   above $10m: ' + rows.filter(r => r.bank > 10e6).length
    + '   below zero: ' + rows.filter(r => r.bank < 0).length
    + '   ever in admin: ' + rows.filter(r => r.adminRounds > 0).length + '/' + rows.length
    + '\n');
}

// ---------------------------------------------------------------------------
// SECTION 13. THE STRUCTURAL DIVISION PREMIUM - the guard Phase 2 fitted
// against. The SAME club, the SAME squad, the SAME finishing position, the
// SAME following, playing a season in Division One instead of Division Two.
// This is what "promotion must remain commercially positive before
// discretionary strengthening" means.
// ---------------------------------------------------------------------------
console.log('=== SECTION 13. THE STRUCTURAL DIVISION PREMIUM (same club, same finish) ===');
console.log('');
console.log('  arm            promotion (D1 net less D2 net)      relegation');
for (const a of wanted) {
  const ups = [];
  for (const rid of Object.keys(nations)) {
    for (const c of nations[rid]) {
      const st = econStature(c.slot, c.isBoss);
      const base = {
        slot: c.slot, isBoss: c.isBoss, country: c.rid, wageRound: c.wageRound,
        pos: 4, posLast: 4, wins: 8, posCountry: 8, clubsInCountry: 16,
        rounds: ROUNDS, homeRounds: ROUNDS / 2, bank0: bankOf(st),
        seats: seatsOf(st), support: supOf(st),
        statOverride: st, statRawOverride: st, seed: 31 + c.slot, opsLaw: ARMS[a].law
      };
      const inD2 = seasonOf({ ...base, div: 2 }), inD1 = seasonOf({ ...base, div: 1 });
      ups.push(inD1.net - inD2.net);
    }
  }
  console.log('  ' + a.padEnd(12) + $(mean(ups)).padStart(28) + $(-mean(ups)).padStart(17));
}
