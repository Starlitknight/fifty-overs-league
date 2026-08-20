#!/usr/bin/env node
/* tools/stature-pyramid.mjs — THE LADDER THAT MOVES
 *
 * ERA 2 ECONOMIC STATURE REALISM, sections 17 and 19, and the correction that
 * makes both of them mean anything.
 *
 * THE FROZEN-DIVISION MISTAKE. tools/stature-arms.mjs holds every club in the
 * division it was dealt for the whole run, and the two most alarming figures
 * in this phase came straight out of that: a second-division champion piling
 * up $8.8m over five seasons, and the eighth seat in Division One losing
 * $2.18m a year for five years running. Neither club exists. tick.mjs
 * rollSeasons() sends Division One's bottom TWO down every year and brings
 * Division Two's shield winner and play-off champion up. A club that wins
 * Division Two five times running is a club the game promoted after the first
 * one; a club that finishes last in Division One five times running was
 * relegated after the first. Freezing the divisions measures a world with no
 * pyramid in it and then blames the economy for the result.
 *
 * So this runs the pyramid. Sixteen clubs, a real division map, a finish
 * decided by what the club can put on the field, and the swap applied every
 * year exactly as rollSeasons applies it. Each of the game's sixteen nations
 * is an independent draw of the same experiment.
 *
 *   node tools/stature-pyramid.mjs [--seasons=5] [--arms=current,nofloor,soft]
 *
 * WHAT DECIDES A FINISH. The wage bill: it is the shipped price of the squad
 * the shipped generator dealt, which makes it the best strength proxy that
 * exists without playing the matches. A little noise per season keeps the same
 * club from finishing first by decree, and the noise is seeded so the arms see
 * IDENTICAL cricket - every difference between two arms below is the
 * coordinate and nothing else.
 */
import { seasonOf, makeSquadShop, tierOf, mean, pct, $ } from './economy-audit.mjs';
import {
  stature, econStature, foundingSeats, foundingSupport, foundingBankFor,
  FOUNDING_SUPPORT, FOUNDING_SEATS, DEBT_LIMIT
} from '../server/economy.mjs';
import { FOUNDING_BANK_ERA2 } from '../server/financeconfig.mjs';
import { ROUNDS } from '../server/clock.mjs';
import { ARMS } from './stature-laws.mjs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const SEASONS = +arg('seasons', 5);
const bankOf = st => Math.round(FOUNDING_BANK_ERA2 * (0.55 + 0.75 * st) / 1000) * 1000;
const seatsOf = st => Math.round(FOUNDING_SEATS * (1 + 0.95 * st) / 1000) * 1000;
const supOf = st => Math.round(FOUNDING_SUPPORT * (0.40 + 1.62 * Math.pow(st, 1.45)));

const wanted = arg('arms', 'current,nofloor,soft,tierflat').split(',').filter(a => ARMS[a]);

// a seeded generator, so every arm sees the same season
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
console.log(`${Object.keys(nations).length} nations, ${Object.keys(nations).length * 16} clubs, `
  + `${SEASONS} seasons, arms: ${wanted.join(', ')}\n`);

function runNation(club, statOf, seed) {
  const R = rng(seed);
  const st = {};                       // per-club running state
  for (const c of club) {
    const s = statOf(c.slot, c.isBoss);
    st[c.slot] = { stat: s, bank: bankOf(s), support: supOf(s), seats: seatsOf(s),
      bank0: bankOf(s), div: c.div0, adminRounds: 0, seasons: [], upDown: [] };
  }
  let divs = { 1: club.filter(c => c.div0 === 1).map(c => c.slot),
    2: club.filter(c => c.div0 === 2).map(c => c.slot) };
  for (let yr = 0; yr < SEASONS; yr++) {
    // the table each division earns, on what it can put on the field
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
    // the national table pools both divisions on raw points, exactly as
    // economy.mjs posMap() does - which is what the crowd reads
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
        seed: 7 + c.slot + 100 * yr
      });
      S.bank = y.bank; S.support = y.support; S.adminRounds += y.adminRounds;
      S.div = dv; S.seasons.push({ dv, pos: pos[c.slot], net: y.net, rev: y.revenue });
    }
    // THE SWAP, as rollSeasons applies it: the bottom two of Division One go
    // down, the top two of Division Two come up.
    const down = order[1].slice(-2), up = order[2].slice(0, 2);
    for (const s of up) st[s].upDown.push('up');
    for (const s of down) st[s].upDown.push('down');
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
    const st = runNation(nations[rid], ARMS[a], 12345 + (i++) * 77);
    for (const slot of Object.keys(st)) out[a].push({ rid, slot: +slot, ...st[slot] });
  }
}

for (const a of wanted) {
  const rows = out[a];
  console.log(`=== ARM: ${a} ===`);
  console.log('  slot   stat   seasons in D1   annual net    ' + SEASONS + 'yr bank      P10          P90   admin rounds');
  for (let s = 0; s < 16; s++) {
    const g = rows.filter(r => r.slot === s);
    const banks = g.map(r => r.bank).sort((x, y) => x - y);
    const d1yrs = mean(g.map(r => r.seasons.filter(x => x.dv === 1).length));
    console.log('  ' + String(s).padStart(4) + g[0].stat.toFixed(3).padStart(7)
      + d1yrs.toFixed(1).padStart(16)
      + $(mean(g.map(r => mean(r.seasons.map(x => x.net))))).padStart(13)
      + $(mean(banks)).padStart(13) + $(pct(banks, 0.10)).padStart(13)
      + $(pct(banks, 0.90)).padStart(13)
      + mean(g.map(r => r.adminRounds)).toFixed(1).padStart(12));
  }
  const med = a2 => { const s2 = a2.slice().sort((x, y) => x - y); return s2[Math.floor(s2.length / 2)]; };
  console.log('  world median bank ' + $(med(rows.map(r => r.bank)))
    + '   richest ' + $(Math.max(...rows.map(r => r.bank)))
    + '   poorest ' + $(Math.min(...rows.map(r => r.bank)))
    + '   ever-in-admin ' + rows.filter(r => r.adminRounds > 0).length + '/' + rows.length);
  console.log('  clubs above $10m: ' + rows.filter(r => r.bank > 10e6).length
    + '   above $5m: ' + rows.filter(r => r.bank > 5e6).length
    + '   below zero: ' + rows.filter(r => r.bank < 0).length + '\n');
}

// ---------------------------------------------------------------------------
// PROMOTION AND RELEGATION, PRICED. The same club, the season it goes up
// against the season before; and the season it comes down against the season
// before that. Averaged over every club that actually moved.
// TWO DIFFERENT QUESTIONS, AND THEY HAVE DIFFERENT ANSWERS.
//
// A. THE STRUCTURAL PREMIUM - the guard. The SAME club, the SAME squad, the
//    SAME finishing position, playing a season in Division One instead of
//    Division Two. This is what "promotion must remain commercially positive
//    before discretionary strengthening" means, and it is the figure Phase 2
//    fitted against (+$1.96m).
//
// B. WHAT ACTUALLY HAPPENS TO A PROMOTED CLUB - the season after against the
//    season before, in a live pyramid. This is a different quantity and it is
//    not a contradiction of A: a club is promoted by WINNING Division Two, on
//    a champion's sponsor, a champion's prize and a champion's crowd, and it
//    arrives in Division One as the weakest side in it. The division premium
//    is still positive; the club has simply stopped being a champion. Both are
//    reported because quoting either alone misleads.
console.log('=== 17A. THE STRUCTURAL DIVISION PREMIUM (same club, same finish) ===');
console.log('  arm          D2 season net    D1 season net     promotion    relegation');
for (const a of wanted) {
  const ups = [];
  for (const rid of Object.keys(nations)) {
    for (const c of nations[rid]) {
      const st = ARMS[a](c.slot, c.isBoss);
      const base = { slot: c.slot, isBoss: c.isBoss, country: c.rid, wageRound: c.wageRound,
        pos: 4, posLast: 4, wins: 8, posCountry: 8, clubsInCountry: 16,
        rounds: ROUNDS, homeRounds: ROUNDS / 2, bank0: bankOf(st), seats: seatsOf(st),
        support: supOf(st), statOverride: st, statRawOverride: st, seed: 7 + c.slot };
      ups.push({ d2: seasonOf({ ...base, div: 2 }).net, d1: seasonOf({ ...base, div: 1 }).net });
    }
  }
  const d2 = mean(ups.map(u => u.d2)), d1 = mean(ups.map(u => u.d1));
  console.log('  ' + a.padEnd(12) + $(d2).padStart(13) + $(d1).padStart(17)
    + $(d1 - d2).padStart(14) + $(d2 - d1).padStart(14));
}

console.log('\n=== 17B. WHAT A PROMOTED CLUB ACTUALLY BANKS (live pyramid) ===');
console.log('  arm            promotion (net, yr after vs yr before)   relegation');
for (const a of wanted) {
  const ups = [], downs = [];
  for (const r of out[a]) {
    for (let i = 1; i < r.seasons.length; i++) {
      const was = r.seasons[i - 1], now = r.seasons[i];
      if (was.dv === 2 && now.dv === 1) ups.push(now.net - was.net);
      if (was.dv === 1 && now.dv === 2) downs.push(now.net - was.net);
    }
  }
  console.log('  ' + a.padEnd(12) + $(mean(ups)).padStart(28) + ` (n=${ups.length})`
    + $(mean(downs)).padStart(14) + ` (n=${downs.length})`);
}

// WHO CAN EVER GO UP. The generator deals slots 8-11 the 'd2a' tier and slots
// 12-15 the 'd2b' tier, and the wage bill follows. If the bottom four seats
// never out-rank the top four, the bottom half of Division Two is not a
// division at all - it is a holding pen.
console.log('\n=== THE TIER CLIFF: how many seasons each seat spends in Division One ===');
for (const a of wanted.slice(0, 1)) {
  for (let s = 8; s < 16; s++) {
    const g = out[a].filter(r => r.slot === s);
    const ups = mean(g.map(r => r.upDown.filter(x => x === 'up').length));
    console.log('  slot ' + String(s).padStart(2) + '   promotions in ' + SEASONS
      + ' seasons: ' + ups.toFixed(2)
      + '   seasons in D1: ' + mean(g.map(r => r.seasons.filter(x => x.dv === 1).length)).toFixed(1));
  }
}
