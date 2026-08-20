#!/usr/bin/env node
/* tools/stature-arms.mjs — THE FLOOR, ON AND OFF, OVER FIVE SEASONS
 *
 * ERA 2 ECONOMIC STATURE REALISM, sections 4, 7, 8, 9 and 19. Every seat in
 * every nation is dealt its real squad by the shipped generator and walked
 * through the shipped economy for five seasons, under each ARM in turn. An arm
 * is nothing but a choice of stature coordinate; everything else - the wage
 * curve, the media pool, the sponsor law, operations, the gate, the prize
 * table - is the shipped law, untouched and identical across arms.
 *
 *   node tools/stature-arms.mjs [--seasons=5] [--members] [--arms=a,b]
 *
 * THE ARMS
 *   current    Math.max(0.62, stature(slot))          the shipped law
 *   nofloor    stature(slot)                          the floor deleted
 *   soft       a soft landing (see softFloor below)
 *
 * WHY A MIRROR OF THE FOUNDING FORMULAS. foundingBank/Seats/Support take a
 * SLOT and look the stature up themselves, so an arm cannot reach them. They
 * are mirrored here as functions of a stature value - and the mirror is
 * asserted against the shipped function at every one of the sixteen slots
 * before anything is measured, so a drifted copy fails loudly instead of
 * quietly producing a different world.
 */
import { seasonOf, makeSquadShop, tierOf, pct, mean, $ } from './economy-audit.mjs';
import {
  stature, econStature, foundingSeats, foundingSupport, foundingBankFor,
  supportTarget, FOUNDING_SUPPORT, FOUNDING_SEATS, DEBT_LIMIT
} from '../server/economy.mjs';
import { isFullMember, FOUNDING_BANK_ERA2 } from '../server/financeconfig.mjs';
import { ROUNDS } from '../server/clock.mjs';

const arg = (k, dflt) => {
  const a = process.argv.find(x => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : dflt;
};
const SEASONS = +arg('seasons', 5);
const membersOnly = process.argv.includes('--members');

// ---------------------------------------------------------------------------
// THE MIRROR, and its proof. Each of these is the shipped body with the
// stature lookup lifted out into an argument.
// ---------------------------------------------------------------------------
const bankOf = st => Math.round(FOUNDING_BANK_ERA2 * (0.55 + 0.75 * st) / 1000) * 1000;
const seatsOf = st => Math.round(FOUNDING_SEATS * (1 + 0.95 * st) / 1000) * 1000;
const supOf = st => Math.round(FOUNDING_SUPPORT * (0.40 + 1.62 * Math.pow(st, 1.45)));

for (let s = 0; s < 16; s++) {
  const boss = s === 0, st = econStature(s, boss);
  const bad = (name, mine, theirs) => {
    if (mine !== theirs) {
      console.error(`MIRROR DRIFTED: ${name}(slot ${s}) mirror ${mine} vs shipped ${theirs}`);
      process.exit(1);
    }
  };
  bad('foundingBank', bankOf(st), foundingBankFor(s, boss, true));
  bad('foundingSeats', seatsOf(st), foundingSeats(s, boss));
  bad('foundingSupport', supOf(st), foundingSupport(s, boss));
}
console.log('mirror verified against the shipped founding formulas at all sixteen slots\n');

// ---------------------------------------------------------------------------
// THE ARMS.
// ---------------------------------------------------------------------------
// A SOFT LANDING RATHER THAN A CLIFF. The shipped floor is a hard max(): seven
// of the sixteen seats are pinned to one number and the ladder simply stops.
// This instead keeps descending but at a shallower gradient below the knee, so
// no two adjacent seats ever jump and the bottom seat still sits meaningfully
// under the top of its division. The knee is the shipped floor value and the
// gradient is half the division-two gradient, which are the two numbers the
// current law already contains - nothing new is invented here.
const KNEE = 0.62, SOFT_K = 0.5;
const softFloor = raw => (raw >= KNEE ? raw : KNEE - (KNEE - raw) * SOFT_K);

const ARMS = {
  current: (slot, boss) => econStature(slot, boss),
  nofloor: (slot, boss) => stature(slot, boss),
  soft: (slot, boss) => softFloor(stature(slot, boss))
};
const wanted = arg('arms', 'current,nofloor,soft').split(',');

// ---------------------------------------------------------------------------
// EVERY SEAT THE WORLD DEALS.
// ---------------------------------------------------------------------------
const shop = makeSquadShop();
const seats = [];
for (const rid of shop.nations) {
  if (membersOnly && !isFullMember(rid)) continue;
  const sides = shop.sidesOf(rid);
  sides.forEach((side, slot) => {
    const isBoss = !!side.boss;
    const div = side.div || (slot < 8 ? 1 : 2);
    const players = shop.deal(`${rid}|${slot}`, rid, side.arch, side.str, tierOf(slot, isBoss, div));
    if (!players.length) return;
    seats.push({ rid, slot, isBoss, div, wageRound: shop.wageOf(players) });
  });
}
console.log(`dealt ${seats.length} clubs in ${new Set(seats.map(s => s.rid)).size} nations`);

// A club's finish is held FIXED across arms and seasons at the seat's own
// expectation - the point is to isolate the coordinate, not to re-run a
// league. Slot order is the expectation the generator builds toward.
const posOf = s => (s.div === 1 ? s.slot + 1 : s.slot - 7);
const natOf = s => s.slot + 1;
const winsOf = s => 2 * (8 - posOf(s));

function runArm(name) {
  const statOf = ARMS[name];
  const out = [];
  for (const s of seats) {
    const st = statOf(s.slot, s.isBoss);
    let bank = bankOf(st), support = supOf(st);
    const seatsN = seatsOf(st);
    const years = [];
    for (let yr = 0; yr < SEASONS; yr++) {
      const y = seasonOf({
        slot: s.slot, isBoss: s.isBoss, div: s.div, country: s.rid,
        wageRound: s.wageRound, pos: posOf(s), posLast: posOf(s), wins: winsOf(s),
        posCountry: natOf(s), clubsInCountry: 16,
        rounds: ROUNDS, homeRounds: ROUNDS / 2,
        bank0: bank, seats: seatsN, support,
        statOverride: st, statRawOverride: st,
        seed: 7 + s.slot + 100 * yr
      });
      bank = y.bank; support = y.support;
      years.push(y);
    }
    out.push({ ...s, stat: st, seatsN, years, endBank: bank, endSup: support,
      annual: mean(years.map(y => y.net)), rev: mean(years.map(y => y.revenue)) });
  }
  return out;
}

const results = {};
for (const a of wanted) { if (ARMS[a]) results[a] = runArm(a); }

// ---------------------------------------------------------------------------
const bySeat = rows => {
  const m = {};
  for (const r of rows) { const k = 'D' + r.div + '/' + (r.div === 1 ? r.slot : r.slot - 8);
    (m[k] = m[k] || []).push(r); }
  return m;
};
const keys = rows => Object.keys(bySeat(rows)).sort((a, b) =>
  a[1] === b[1] ? +a.slice(3) - +b.slice(3) : a < b ? -1 : 1);

for (const a of wanted) {
  if (!results[a]) continue;
  const rows = results[a], m = bySeat(rows), ks = keys(rows);
  console.log(`\n=== ARM: ${a} — ${SEASONS} seasons, ${rows.length} clubs ===`);
  console.log('  seat   n   stat   seats    supp0     supp5   annual net    5yr bank'
    + '     P10 bank     P90 bank   admin');
  for (const k of ks) {
    const g = m[k];
    const banks = g.map(r => r.endBank).sort((x, y) => x - y);
    const admin = g.filter(r => r.endBank <= -DEBT_LIMIT).length;
    console.log('  ' + k.padEnd(6) + String(g.length).padStart(3)
      + g[0].stat.toFixed(3).padStart(7) + String(g[0].seatsN).padStart(8)
      + String(supOf(g[0].stat)).padStart(9) + String(Math.round(mean(g.map(r => r.endSup)))).padStart(10)
      + $(mean(g.map(r => r.annual))).padStart(13) + $(mean(banks)).padStart(12)
      + $(pct(banks, 0.10)).padStart(13) + $(pct(banks, 0.90)).padStart(13)
      + String(admin).padStart(8));
  }
  const d1 = rows.filter(r => r.div === 1), d2 = rows.filter(r => r.div === 2);
  const med = a2 => { const s = a2.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  console.log('  ' + '-'.repeat(100));
  console.log('  D1  median 5yr bank ' + $(med(d1.map(r => r.endBank))).padStart(12)
    + '   mean annual ' + $(mean(d1.map(r => r.annual))).padStart(11)
    + '   admin ' + d1.filter(r => r.endBank <= -DEBT_LIMIT).length + '/' + d1.length
    + '   overdrawn ' + d1.filter(r => r.endBank < 0).length);
  console.log('  D2  median 5yr bank ' + $(med(d2.map(r => r.endBank))).padStart(12)
    + '   mean annual ' + $(mean(d2.map(r => r.annual))).padStart(11)
    + '   admin ' + d2.filter(r => r.endBank <= -DEBT_LIMIT).length + '/' + d2.length
    + '   overdrawn ' + d2.filter(r => r.endBank < 0).length);
  console.log('  richest club in the world after ' + SEASONS + ' seasons: '
    + $(Math.max(...rows.map(r => r.endBank))));
}

// ---------------------------------------------------------------------------
if (wanted.length > 1 && results[wanted[0]]) {
  const base = wanted[0];
  console.log(`\n=== ARM AGAINST ARM, per seat (vs ${base}) ===`);
  console.log('  seat        ' + wanted.slice(1).map(a =>
    (a + ' Dannual').padStart(15) + (a + ' D5yr').padStart(15)).join(''));
  const ks = keys(results[base]);
  const idx = a => Object.fromEntries(results[a].map(r => [r.rid + '|' + r.slot, r]));
  const maps = Object.fromEntries(wanted.map(a => [a, idx(a)]));
  for (const k of ks) {
    let line = '  ' + k.padEnd(12);
    for (const a of wanted.slice(1)) {
      const g = bySeat(results[base])[k];
      const dA = mean(g.map(r => maps[a][r.rid + '|' + r.slot].annual - r.annual));
      const dB = mean(g.map(r => maps[a][r.rid + '|' + r.slot].endBank - r.endBank));
      line += $(dA).padStart(15) + $(dB).padStart(15);
    }
    console.log(line);
  }
}
