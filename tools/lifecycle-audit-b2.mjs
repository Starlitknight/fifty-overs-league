#!/usr/bin/env node
/* tools/lifecycle-audit-b2.mjs — DOES THE WORLD STILL EXIST IN TEN SEASONS?
 *
 * B2 settled what the world looks like on day one. This asks the other half of
 * the question, which day one cannot answer: whether the world SUSTAINS itself.
 * A population that ages, retires and is replenished can drift three ways, and
 * all three are silent until somebody counts:
 *
 *   INFLATION   development outruns decline and everybody ends up a star
 *   COLLAPSE    retirement outruns replacement and the world empties
 *   FLATTENING  the tails erode and every cricketer converges on the median
 *
 * WHAT THIS MEASURES, AND WHAT IT DOES NOT. It runs the world's own three
 * lifecycle mechanisms off the shipped build, without a database and without
 * playing the cricket:
 *
 *   AGEING      youth.mjs ageYouth: every man a year older each rollover, and
 *               anybody who reaches RETIRE_AT leaves the game.
 *   DEVELOPMENT enginehost trainRound, the shipped nets, run a season of rounds
 *               a season on every squad with no plan filed - which is what an
 *               unmanaged (bot) club does, and 256 of the world's 256 clubs are
 *               bot clubs in a fresh world.
 *   REPLACEMENT market.mjs makeFreeAgent, IMPORTED rather than reimplemented -
 *               the umpire's own generator, taken up to the number retirement
 *               removed. A tool that measures a world with its own copy of the
 *               world's generator measures its own copy.
 *
 * It does NOT play matches, so form, fatigue and the talents earned from a
 * scorecard are absent, and it does not run the bidding - it assumes a retired
 * man is replaced, which is the OPTIMISTIC end of what the market does. Read it
 * as the demography rather than as a simulation of the game.
 *
 *   node tools/lifecycle-audit-b2.mjs                # seasons 0, 5, 10
 *   node tools/lifecycle-audit-b2.mjs --seasons 20
 *   node tools/lifecycle-audit-b2.mjs --json
 */
import { makeHost } from '../server/enginehost.mjs';
import { countryConfigs, tierOfClub, squadFor } from '../server/init-world.mjs';
import { RETIRE_AT } from '../server/youth.mjs';
import { makeFreeAgent } from '../server/market.mjs';
import { ROUNDS } from '../server/clock.mjs';

const argOf = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i > 0 && process.argv[i + 1] ? +process.argv[i + 1] : d;
};
const SEASONS = argOf('seasons', 10);
const REPORT_AT = new Set([0, 5, 10, SEASONS]);
const wantJson = process.argv.includes('--json');

const host = makeHost();
const cfgs = countryConfigs(host);

// ---- the world as dealt ----------------------------------------------------
const clubs = [];
for (const cfg of cfgs) {
  for (const club of cfg.clubs) {
    clubs.push({ cfg, slot: club.slot, tier: tierOfClub(cfg, club), men: squadFor(host, cfg, club, 1) });
  }
}

// ---- the report ------------------------------------------------------------
const BANDS = [['0-20', 0, 21], ['21-40', 21, 41], ['41-60', 41, 61], ['61-79', 61, 80],
  ['80-84', 80, 85], ['85-89', 85, 90], ['90-94', 90, 95], ['95-97', 95, 98],
  ['98-99', 98, 100], ['100', 100, 101]];
const roleOf = p => (p.keeper || p.role === 'wicketkeeper') ? 'wk'
  : p.role === 'allRounder' ? 'ar'
  : (p.bowlType && p.bowlType !== 'none') ? 'bowl' : 'bat';

function snapshot(season, churn) {
  const all = clubs.flatMap(c => c.men);
  const ovr = host.pkOvr(all);
  const sorted = ovr.slice().sort((a, b) => a - b);
  const at = t => sorted[Math.floor(t * (sorted.length - 1))];
  const bands = {}; for (const [n, lo, hi] of BANDS) bands[n] = ovr.filter(v => v >= lo && v < hi).length;
  const roles = {}; all.forEach(p => { const r = roleOf(p); roles[r] = (roles[r] || 0) + 1; });
  const ages = all.map(p => p.age || 27).sort((a, b) => a - b);
  return {
    season, n: all.length,
    mean: +(ovr.reduce((s, v) => s + v, 0) / ovr.length).toFixed(2),
    median: at(0.5), p10: at(0.10), p90: at(0.90),
    meanAge: +(ages.reduce((s, v) => s + v, 0) / ages.length).toFixed(1),
    bands, roles,
    n80: ovr.filter(v => v >= 80).length, n85: ovr.filter(v => v >= 85).length,
    n90: ovr.filter(v => v >= 90).length, n95: ovr.filter(v => v >= 95).length,
    retired: churn.retired, joined: churn.joined
  };
}

// ---- a season ---------------------------------------------------------------
//
// THE NETS FIRST, THEN THE ROLLOVER, which is the order the umpire runs them in:
// a season's rounds are trained through, and the year is added at the rollover
// that ends it.
let faSeed = 0;
function playSeason(s) {
  let retired = 0, joined = 0;
  for (const c of clubs) {
    // a season of nets at an unmanaged club: no plan filed, so every man works
    // the programme his trade implies, at a level-two academy's rate
    for (let r = 0; r < ROUNDS; r++) {
      const res = host.trainRound(c.men, {}, 1, null);
      if (res && res.players) c.men = res.players;
    }
    // the rollover: a year on everybody, and the oldest hang them up
    c.men.forEach(p => { p.age = (p.age || 27) + 1; });
    const stay = c.men.filter(p => (p.age || 0) < RETIRE_AT);
    retired += c.men.length - stay.length;
    c.men = stay;
    // REPLACEMENT, at the rate the market's own generator produces men. This is
    // the optimistic reading - it assumes every retirement is made good - and it
    // is deliberately so: if the world still drifts when replacement is perfect,
    // the drift is not the market's fault.
    const short = 15 - c.men.length;
    for (let i = 0; i < short; i++) {
      const man = makeFreeAgent(host, c.cfg, 'fa|' + c.cfg.id + '|s' + s + '|' + c.slot + '|' + (faSeed++));
      // a free agent walks in at the age the market deals him, which the
      // generator sets; nothing here makes him younger than the world does
      if (man) { c.men.push(man); joined++; }
    }
  }
  return { retired, joined };
}

const snaps = [snapshot(0, { retired: 0, joined: 0 })];
for (let s = 1; s <= SEASONS; s++) {
  const churn = playSeason(s);
  if (REPORT_AT.has(s)) snaps.push(snapshot(s, churn));
}

if (wantJson) { console.log(JSON.stringify(snaps, null, 1)); }
else {
  console.log('THE WORLD OVER ' + SEASONS + ' SEASONS (ageing + the nets + replacement, no cricket)\n');
  console.log('  season   pop   mean  median   p10   p90  meanAge   80+  85+  90+  95+  retired  joined');
  for (const s of snaps)
    console.log('  ' + String(s.season).padStart(6) + String(s.n).padStart(6) +
      s.mean.toFixed(1).padStart(7) + String(s.median).padStart(8) + String(s.p10).padStart(6) +
      String(s.p90).padStart(6) + s.meanAge.toFixed(1).padStart(9) +
      String(s.n80).padStart(6) + String(s.n85).padStart(5) + String(s.n90).padStart(5) +
      String(s.n95).padStart(5) + String(s.retired).padStart(9) + String(s.joined).padStart(8));
  console.log('\n  BANDS');
  console.log('  season  ' + BANDS.map(b => b[0].padStart(7)).join(''));
  for (const s of snaps)
    console.log('  ' + String(s.season).padStart(6) + '  ' +
      BANDS.map(b => String(s.bands[b[0]]).padStart(7)).join(''));
  console.log('\n  ROLES');
  console.log('  season  ' + ['bat', 'bowl', 'ar', 'wk'].map(r => r.padStart(8)).join(''));
  for (const s of snaps)
    console.log('  ' + String(s.season).padStart(6) + '  ' +
      ['bat', 'bowl', 'ar', 'wk'].map(r => String(s.roles[r] || 0).padStart(8)).join(''));
}
