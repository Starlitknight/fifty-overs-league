#!/usr/bin/env node
/* tools/wage-pyramid.mjs — THE WAGE ANCHOR IN A LADDER THAT MOVES
 *
 * Sections 13, 14, 15 and 19 of the wage-anchor brief, and the correction to a
 * measurement of my own that was flattering the weak.
 *
 * WHY THIS EXISTS RATHER THAN THE ONE-SEASON TABLE. tools/wage-burden.mjs
 * prices every seat on its FOUNDING coordinates - the ground and the following
 * a club is dealt on day one - and on that snapshot only four of sixteen seats
 * are under water and payroll runs 33% to 71% of revenue. Phase 4 reported
 * 65-82% and a different set of failing seats, and the difference is not a
 * contradiction: a weak club's following DECAYS. Founding support hands slot 15
 * a crowd of 14,520 it will never have again, and the gate money that comes
 * with it. The steady state is where a club actually lives, and it is the only
 * place a wage anchor can honestly be judged.
 *
 * So this runs the same moving pyramid Phase 4 used - Division One's bottom two
 * go down and Division Two's top two come up every year, as tick.mjs applies it
 * - with the SHIPPED operations law held fixed and the WAGE SCALE as the arm.
 * The cricket noise is seeded per nation per season, so every arm sees
 * identical results and any difference below is the wage law.
 *
 *   node tools/wage-pyramid.mjs [--seasons=10] [--scales=1,0.9,0.8]
 */
import { seasonOf, makeSquadShop, tierOf, mean, pct, $ } from './economy-audit.mjs';
import {
  econStature, FOUNDING_SUPPORT, FOUNDING_SEATS
} from '../server/economy.mjs';
import { FOUNDING_BANK_ERA2, OPS_TOPFLIGHT_ROUND } from '../server/financeconfig.mjs';
import { ROUNDS } from '../server/clock.mjs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const SEASONS = +arg('seasons', 10);
const SCALES = arg('scales', '1,0.95,0.90,0.85,0.80,0.75').split(',').map(Number);
const SHED = +arg('shed', 0);
// SECTION 20: THE SHAPE QUESTION. Anchor-only cannot close the Division One
// tail without reopening the flagship printer, so K has to be measured too
// rather than assumed innocent. --k=N reprices every dealt squad man by man at
// that exponent: wage = MID x (card/50)^K x (1 + 0.06 x talents), floored at
// $400, exactly as foWageOf does it. Lowering K makes a man ABOVE the median
// cheaper and a man BELOW it dearer, so it is not a disguised cost cut - it
// tilts the ladder about OVR 50 and leaves the median man alone.
const KS = arg('k', '').split(',').filter(Boolean).map(Number);
const MID = 9290, R50 = 50000;
const billAtK = (players, K) => players.reduce((t, p) => {
  const r = Math.max(1, +p.rating || R50);
  const base = MID * Math.pow(r / R50, K);
  const tal = 1 + 0.06 * Math.max(0, (p.talents || []).length);
  return t + Math.max(400, Math.round(base * tal / 10) * 10);
}, 0);
// what each division's squad typically costs a round, measured off the dealt
// ladder in tools/wage-population.mjs.
const TYPICAL = { 1: 300440, 2: 100670 };
const bankOf = st => Math.round(FOUNDING_BANK_ERA2 * (0.55 + 0.75 * st) / 1000) * 1000;
const seatsOf = st => Math.round(FOUNDING_SEATS * (1 + 0.95 * st) / 1000) * 1000;
const supOf = st => Math.round(FOUNDING_SUPPORT * (0.40 + 1.62 * Math.pow(st, 1.45)));

const rng = seed => { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return ((x >>> 0) % 1e6) / 1e6; }; };

const shop = makeSquadShop();
const nations = {};
for (const rid of shop.nations) {
  const sides = shop.sidesOf(rid), club = [];
  sides.forEach((side, slot) => {
    const isBoss = !!side.boss, div = side.div || (slot < 8 ? 1 : 2);
    const players = shop.deal(`${rid}|${slot}`, rid, side.arch, side.str, tierOf(slot, isBoss, div));
    if (players.length) club.push({ rid, slot, isBoss, div0: div,
      wageRound: shop.wageOf(players), players });
  });
  if (club.length === 16) nations[rid] = club;
}
console.log(`${Object.keys(nations).length} nations, ${SEASONS} seasons, shipped operations, `
  + `division premium ${$(OPS_TOPFLIGHT_ROUND)}`
  + (SHED > 0 ? `, payroll drifts ${(100 * SHED).toFixed(0)}% a season toward the division dealt`
    : ', payroll held at the dealt bill for every season') + '\n');

function runNation(club, scale, seed, K) {
  // a K arm reprices the dealt squads before a ball is bowled; the table below
  // is still ordered off the SHIPPED bill, so the cricket is identical
  if (K != null) for (const c of club) c.wageRound = billAtK(c.players, K);
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
    // THE TABLE IS DECIDED BY THE SQUAD, NOT BY THE WAGE SCALE. The order is
    // drawn off the DEALT bill with the same noise in every arm, so scaling
    // wages cannot quietly rearrange the cricket and take credit for it.
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
      // DOES A RELEGATED CLUB KEEP PAYING A DIVISION ONE SQUAD? The default
      // here says yes, and that is a MODELLING CHOICE rather than a law: the
      // seat model has no transfer market, so a club's bill is whatever it was
      // dealt for ten seasons running. A real relegated club sheds wages -
      // botfinance posts a posture off its projection and the umpire sells the
      // surplus man - so holding the bill fixed charges a yo-yo club Division
      // One wages on Division Two income for every year it is down, and any
      // "structural" deficit measured that way is partly the model's doing.
      //
      // --shed=F lets a club drift toward what its CURRENT division is dealt,
      // by fraction F a season. It is not a proposed law; it is the sensitivity
      // test that says how much of the Division One tail is the wage anchor and
      // how much is a squad the model would not let it sell.
      if (SHED > 0) {
        // RELATIVE TO THE DIVISION IT WAS DEALT IN, not an absolute fraction.
        // The first cut of this test multiplied every club in Division Two by
        // the D2/D1 ratio - including the eight clubs that were DEALT a
        // Division Two squad, whose bill is already at that level. They were
        // discounted twice, their payroll fell to a third of what any club
        // pays, and Division Two duly printed $1.4m a season. The target is a
        // club's OWN dealt bill moved by the ratio between the division it is
        // in now and the division it came from.
        const target = c.wageRound * (TYPICAL[dv] / TYPICAL[c.div0]);
        S.bill = S.bill == null ? c.wageRound : S.bill + (target - S.bill) * SHED;
      }
      const billNow = SHED > 0 ? (S.bill == null ? c.wageRound : S.bill) : c.wageRound;
      const y = seasonOf({
        slot: c.slot, isBoss: c.isBoss, div: dv, country: c.rid,
        wageRound: Math.round(billNow * scale),
        pos: pos[c.slot], posLast: pos[c.slot], wins: wins[c.slot],
        posCountry: posCountry[c.slot], clubsInCountry: 16,
        rounds: ROUNDS, homeRounds: ROUNDS / 2,
        bank0: S.bank, seats: S.seats, support: S.support,
        statOverride: S.stat, statRawOverride: S.stat,
        seed: 7 + c.slot + 100 * yr
      });
      S.bank = y.bank; S.support = y.support; S.adminRounds += y.adminRounds;
      S.div = dv;
      S.seasons.push({ dv, pos: pos[c.slot], net: y.net, rev: y.revenue,
        wages: y.wages, ops: y.ops, support: y.support });
    }
    const down = order[1].slice(-2), up = order[2].slice(0, 2);
    for (const s of up) st[s].ups++;
    for (const s of down) st[s].downs++;
    divs = { 1: divs[1].filter(s => !down.includes(s)).concat(up),
      2: divs[2].filter(s => !up.includes(s)).concat(down) };
  }
  return st;
}

const ARMS = KS.length
  ? KS.map(K => ({ key: 'K=' + K, scale: 1, K }))
  : SCALES.map(sc => ({ key: 'x' + sc.toFixed(2), scale: sc, K: null }));
const out = {};
for (const a of ARMS) {
  out[a.key] = [];
  let i = 0;
  for (const rid of Object.keys(nations)) {
    // the dealt bill is restored for each arm so a K arm cannot inherit the
    // previous arm's repricing
    const club = nations[rid].map(c => ({ ...c, wageRound: shop.wageOf(c.players) }));
    const st = runNation(club, a.scale, 12345 + (i++) * 77, a.K);
    for (const slot of Object.keys(st)) out[a.key].push({ rid, slot: +slot, ...st[slot] });
  }
}

const med = a2 => { const s2 = a2.slice().sort((x, y) => x - y); return s2[Math.floor(s2.length / 2)]; };

for (const a of ARMS) {
  const sc = a.scale, rows = out[a.key];
  console.log(a.K != null
    ? `=== CURVE SHAPE K=${a.K}   FO_WAGE_MID held at 9290 ===`
    : `=== WAGE SCALE x${sc.toFixed(2)}   FO_WAGE_MID ${Math.round(9290 * sc)} ===`);
  console.log('  slot   yrs in D1   annual net    ' + SEASONS + 'yr bank'
    + '          P90   wage/rev  support yr' + SEASONS + '  admin');
  for (let s = 0; s < 16; s++) {
    const g = rows.filter(r => r.slot === s);
    const banks = g.map(r => r.bank).sort((x, y) => x - y);
    const d1yrs = mean(g.map(r => r.seasons.filter(x => x.dv === 1).length));
    const wrev = 100 * mean(g.map(r => mean(r.seasons.map(x => x.wages))))
      / mean(g.map(r => mean(r.seasons.map(x => x.rev))));
    console.log('  ' + String(s).padStart(4) + d1yrs.toFixed(1).padStart(12)
      + $(mean(g.map(r => mean(r.seasons.map(x => x.net))))).padStart(13)
      + $(mean(banks)).padStart(13) + $(pct(banks, 0.90)).padStart(13)
      + (wrev.toFixed(1) + '%').padStart(11)
      + Math.round(mean(g.map(r => r.support))).toLocaleString().padStart(14)
      + mean(g.map(r => r.adminRounds)).toFixed(1).padStart(7));
  }
  const banksAll = rows.map(r => r.bank);
  const wrevAll = 100 * mean(rows.map(r => mean(r.seasons.map(x => x.wages))))
    / mean(rows.map(r => mean(r.seasons.map(x => x.rev))));
  console.log('  world median bank ' + $(med(banksAll))
    + '   P90 ' + $(pct(banksAll.slice().sort((x, y) => x - y), 0.90))
    + '   richest ' + $(Math.max(...banksAll))
    + '   poorest ' + $(Math.min(...banksAll)));
  console.log('  wage/revenue ' + wrevAll.toFixed(1) + '%'
    + '   above $20m: ' + rows.filter(r => r.bank > 20e6).length
    + '   above $10m: ' + rows.filter(r => r.bank > 10e6).length
    + '   below zero: ' + rows.filter(r => r.bank < 0).length
    + '   ever in admin: ' + rows.filter(r => r.adminRounds > 0).length + '/' + rows.length
    + '\n');
}
