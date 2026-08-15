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
// THE AGEING HANDLE, in the same spirit as calibration.mjs's CAL_SET and for
// the same reason CLAUDE.md gives: the only way to prove a term responsible for
// a drift is to turn it up and down and re-measure. AGE_SCALE=0.5 halves every
// decline rate inside this VM before a season is played; nothing is written and
// no build changes. FO_AGE_DECAY is a const object, but its rates are ordinary
// properties and window.foAgeDecay is the same object the engine reads.
if (process.env.AGE_SCALE) {
  const f = Number(process.env.AGE_SCALE);
  host.tuneAgeing(f);
  console.log('AGE_SCALE ' + f + ' applied to every decline rate\n');
}
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

// WHAT HE WOULD BE AT HIS PEAK, which is the only way to tell the two failures
// apart. A world whose overalls have fallen has either LOST VALUE - the
// mechanisms are lossy and the population is draining - or merely GOT OLDER,
// which is not a failure at all and needs no fixing. Today's overall cannot
// distinguish them; today's overall minus the career phase can, because that is
// invariant along a career that is tracking the phase table.
const peakEq = (o, p) => o - host.agePhase(p.age || 27);

function snapshot(season, churn) {
  const all = clubs.flatMap(c => c.men);
  const ovr = host.pkOvr(all);
  const peak = ovr.map((o, i) => peakEq(o, all[i]));
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
    peakMean: +(peak.reduce((s, v) => s + v, 0) / peak.length).toFixed(2),
    peak80: peak.filter(v => v >= 80).length, peak90: peak.filter(v => v >= 90).length,
    // THE LATENT TAIL, SEASON BY SEASON. The overalls above cannot see the one
    // failure the removal of the 99 ceiling could uniquely cause: attributes
    // climbing for ever behind a card that is held in place by its own curve.
    // A world whose OVR distribution is perfectly stationary while its stored
    // skills drift from 126 to 300 is a world about to hand the ball model
    // inputs nobody measured.
    tail: (() => {
      const t = { n99: 0, n105: 0, n110: 0, n120: 0, max: 0 };
      for (const p of all) for (const k in (p.skills || {})) {
        const v = p.skills[k];
        if (typeof v !== 'number') continue;
        if (v > t.max) t.max = v;
        if (v > 99) t.n99++; if (v > 105) t.n105++;
        if (v > 110) t.n110++; if (v > 120) t.n120++;
      }
      return t;
    })(),
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
    // AND THE YEAR COSTS THEM, by the engine's own per-attribute curve and
    // through the same host method the umpire's rollover calls (youth.ageYouth).
    // This audit exists to catch a world that inflates, collapses or flattens,
    // and until decline existed it was measuring a world in which the only
    // downward force was retirement.
    c.men = stay.length ? host.ageDecline(stay) : stay;
    // REPLACEMENT, at the rate the market's own generator produces men. This is
    // the optimistic reading - it assumes every retirement is made good - and it
    // is deliberately so: if the world still drifts when replacement is perfect,
    // the drift is not the market's fault.
    const short = 15 - c.men.length;
    for (let i = 0; i < short; i++) {
      // AT THE CLUB'S OWN LEVEL, which the first version of this audit did not
      // do and which quietly decided the answer. makeFreeAgent's default draws
      // a tier from the mix the world's 256 clubs hold, because that is what a
      // national free-agent board looks like; using it HERE meant a flagship
      // club that lost a ninety replaced him with a d2a squad player, and the
      // top of the world drained by arithmetic that had nothing to do with
      // ageing. Measured, it took 80+ from 303 men to 152 over twenty seasons
      // and the cause was invisible because every individual career arc
      // balanced perfectly.
      //
      // A club replaces a man at its own standard because that is what the
      // market does: the free-agent board is national, the bidding is by
      // valueOf, and a flagship club outbids a newcomer for the best man on it
      // every time. This is still the OPTIMISTIC reading - it assumes the club
      // always finds someone - and it is deliberately so, for the same reason
      // as before: if the world drifts when replacement is perfect, the drift
      // is not the market's fault.
      const man = makeFreeAgent(host, c.cfg, 'fa|' + c.cfg.id + '|s' + s + '|' + c.slot + '|' + (faSeed++), c.tier);
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
  console.log('\n  AT PEAK (today\'s overall with the career phase taken out): the world\'s');
  console.log('  stock of cricketers, as against the age it happens to be standing at.');
  console.log('  season   peakMean   peak80+   peak90+');
  for (const s of snaps)
    console.log('  ' + String(s.season).padStart(6) + s.peakMean.toFixed(1).padStart(11) +
      String(s.peak80).padStart(10) + String(s.peak90).padStart(10));
  console.log('\n  THE LATENT TAIL: stored attributes past each threshold, and the tallest');
  console.log('  in the world. This is where runaway inflation would show first.');
  console.log('  season      >99    >105    >110    >120     max');
  for (const s of snaps)
    console.log('  ' + String(s.season).padStart(6) + String(s.tail.n99).padStart(9) +
      String(s.tail.n105).padStart(8) + String(s.tail.n110).padStart(8) +
      String(s.tail.n120).padStart(8) + String(s.tail.max).padStart(8));

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
