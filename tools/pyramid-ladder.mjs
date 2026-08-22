#!/usr/bin/env node
/* tools/pyramid-ladder.mjs — THE LADDER, THE OVERLAP, AND WHAT A GAP COSTS
 *
 * Sections 2, 5, 6 and 17 of the competitive-pyramid brief.
 *
 * Three questions, in the order that makes each one mean something:
 *
 *   2/17  WHAT IS THE LADDER, and do adjacent rungs overlap at all? The tier
 *         table in init-world.mjs already states measured best-XI bands, so
 *         this re-measures them on the shipped generator rather than trusting a
 *         comment, and then asks the question the comment does not: given two
 *         clubs drawn at random from adjacent tiers, how often is the LOWER one
 *         stronger? A pyramid whose distributions never cross is a caste
 *         system by construction, whatever else is true of it.
 *
 *   6     WHAT DOES A GAP COST ON THE FIELD? A card difference is not a result.
 *         This plays REAL MATCHES through the shipped engine between squads at
 *         controlled quality separations and reports win rate and expected
 *         league points, so "a 10-card gap" stops being an abstraction.
 *
 *   5     AND HOW MUCH DOES STRENGTH DECIDE? The same matches answer it: if a
 *         side 10 cards better wins 95% of the time the table is deterministic,
 *         and if it wins 55% the league is noise.
 *
 *   node tools/pyramid-ladder.mjs [--nations=8] [--matches=200]
 *
 * Reads the shipped generator and the shipped engine. Changes nothing.
 */
import { makeHost } from '../server/enginehost.mjs';
import { tierOfClub, countryConfigs, TIER_XI_BAND, TIER_SQUAD_BAND } from '../server/init-world.mjs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const NAT = +arg('nations', 8);
const MATCHES = +arg('matches', 200);
const L = s => console.log(s);
const pct = (xs, p) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo);
};
const mean = xs => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

const host = makeHost();
const nations = countryConfigs(host).slice(0, NAT);
const TIERS = ['newcomer', 'd2b', 'd2a', 'd1b', 'd1a', 'flagship'];

// THE BEST XI IS THE ELEVEN BEST CARDS. The umpire's own selector weighs role
// and balance; for a STRENGTH measurement the top eleven is the same population
// to within a man, and it needs no match to exist.
const bestXI = sq => [...sq].sort((a, b) => b.rating - a.rating).slice(0, 11);
const xiOvr = sq => mean(bestXI(sq).map(p => p.rating / 1000));
const sqOvr = sq => mean(sq.map(p => p.rating / 1000));

// ---------------------------------------------------------------------------
// 2. THE LADDER AS DEALT
// ---------------------------------------------------------------------------
const bySeat = {}, byTier = {};
for (const cfg of nations) {
  for (const club of cfg.clubs) {
    const tier = tierOfClub(cfg, club);
    const sq = host.derive(host.genSquad('world1|' + cfg.id + '|' + club.slot, cfg.nat,
      club.arch || cfg.arch, club.boss ? cfg.capt : 'general', 1, tier) || []);
    if (!sq.length) continue;
    const rec = {
      nat: cfg.id, slot: club.slot, tier,
      xi: xiOvr(sq), squad: sqOvr(sq),
      bat: mean(bestXI(sq).map(p => p.bat || 0)),
      bowl: mean(bestXI(sq).filter(p => p.bowl > 0).map(p => p.bowl || 0)),
      depth: sqOvr(sq) - mean([...sq].sort((a, b) => b.rating - a.rating).slice(11).map(p => p.rating / 1000)),
      age: mean(sq.map(p => p.age || 0)),
      exp: mean(sq.map(p => p.exp || 0)),
      players: sq
    };
    (bySeat[club.slot] = bySeat[club.slot] || []).push(rec);
    (byTier[tier] = byTier[tier] || []).push(rec);
  }
}

L('');
L('2. THE TIER LADDER AS DEALT');
L('='.repeat(92));
L('   ' + nations.length + ' nations, shipped generator');
L('');
L('   slot  tier         best XI                          squad mean     bat  bowl   age   exp');
L('              ' + '     P10   P25   med   P75   P90'.padStart(38));
L('   ' + '-'.repeat(89));
let prevMed = null;
for (let s = 0; s < 16; s++) {
  const g = bySeat[s] || [];
  if (!g.length) continue;
  const xis = g.map(r => r.xi), med = pct(xis, 0.5);
  const step = prevMed == null ? '' : '  (' + (med - prevMed >= 0 ? '+' : '') + (med - prevMed).toFixed(1) + ')';
  prevMed = med;
  L('   ' + String(s).padStart(4) + '  ' + g[0].tier.padEnd(10)
    + pct(xis, 0.10).toFixed(1).padStart(8) + pct(xis, 0.25).toFixed(1).padStart(6)
    + med.toFixed(1).padStart(6) + pct(xis, 0.75).toFixed(1).padStart(6)
    + pct(xis, 0.90).toFixed(1).padStart(6)
    + pct(g.map(r => r.squad), 0.5).toFixed(1).padStart(13)
    + mean(g.map(r => r.bat)).toFixed(0).padStart(8)
    + mean(g.map(r => r.bowl)).toFixed(0).padStart(6)
    + mean(g.map(r => r.age)).toFixed(1).padStart(6)
    + mean(g.map(r => r.exp)).toFixed(1).padStart(6) + step);
}
L('');
L('   the step between adjacent SEATS is in brackets. The ladder is a staircase');
L('   with flat treads: seats inside one tier differ by noise, and the whole');
L('   drop happens at a tier boundary.');
L('');

// ---------------------------------------------------------------------------
// 17. OVERLAP
// ---------------------------------------------------------------------------
L('17. DISTRIBUTION OVERLAP BETWEEN ADJACENT TIERS');
L('='.repeat(92));
L('');
L('   tier          n     P10    P25    med    P75    P90       vs tier above:');
L('                                                          P(lower > upper)  best low vs worst high');
L('   ' + '-'.repeat(89));
for (let i = TIERS.length - 1; i >= 0; i--) {
  const t = TIERS[i], g = byTier[t] || [];
  if (!g.length) continue;
  const xs = g.map(r => r.xi);
  let tail = '';
  const up = byTier[TIERS[i + 1]];
  if (up && up.length) {
    const ys = up.map(r => r.xi);
    let wins = 0;
    for (const a of xs) for (const b of ys) if (a > b) wins++;
    const p = 100 * wins / (xs.length * ys.length);
    const bestLow = Math.max(...xs), worstHigh = Math.min(...ys);
    tail = (p.toFixed(1) + '%').padStart(17)
      + ('  ' + bestLow.toFixed(1) + ' vs ' + worstHigh.toFixed(1)
        + (bestLow > worstHigh ? '  OVERLAP' : '  NO OVERLAP')).padStart(24);
  }
  L('   ' + t.padEnd(11) + String(g.length).padStart(4)
    + pct(xs, 0.10).toFixed(1).padStart(8) + pct(xs, 0.25).toFixed(1).padStart(7)
    + pct(xs, 0.50).toFixed(1).padStart(7) + pct(xs, 0.75).toFixed(1).padStart(7)
    + pct(xs, 0.90).toFixed(1).padStart(7) + tail);
}
L('');
L('   the shipped table in init-world.mjs states these bands as MEASURED, and');
L('   they are restated here off the generator rather than trusted:');
for (const t of [...TIERS].reverse()) {
  if (!TIER_XI_BAND[t]) continue;
  L('      ' + t.padEnd(11) + 'declared XI band ' + JSON.stringify(TIER_XI_BAND[t])
    + '   squad band ' + JSON.stringify(TIER_SQUAD_BAND[t]));
}
L('');

// ---------------------------------------------------------------------------
// 6 + 5. WHAT A GAP COSTS ON THE FIELD - REAL MATCHES
// ---------------------------------------------------------------------------
L('6 + 5. WHAT A CARD GAP COSTS ON THE FIELD');
L('='.repeat(92));
L('');
L('   Real matches through the shipped engine. Both sides are the SAME dealt');
L('   squad put on a chosen overall by the engine\'s own fitToOvr - a similarity');
L('   transform, so shape and roles survive and only the level differs. That');
L('   isolates quality from squad shape, which a tier-vs-tier match cannot.');
L('');
const baseSq = host.genSquad('ladder|probe', 'England', 'balanced', 'general', 1, 'd1b') || [];
const teamAt = (ovr, name) => ({ name, players: host.derive(host.fitToOvr(baseSq, ovr)) });
const LEVELS = [33, 36, 40, 44, 48, 52];
const REF = 48;   // the d2a rung a promotion candidate must beat

L('   a side at each level against a side at ' + REF + ' (the d2a rung), '
  + MATCHES + ' matches each:');
L('');
L('      level   gap    win%   pts/14 rounds   what that is');
L('   ' + '-'.repeat(89));
for (const lv of LEVELS) {
  const A = teamAt(lv, 'Challenger'), B = teamAt(REF, 'Rung');
  let w = 0, t = 0;
  for (let i = 0; i < MATCHES; i++) {
    // alternate home and away so the home edge cancels exactly
    const homeIsA = i % 2 === 0;
    const res = JSON.parse(host.runMatch(homeIsA ? A : B, homeIsA ? B : A,
      'fair', 1000 + i, {}, 'Sunny', false));
    if (!res || !res.winner) { t++; continue; }
    if (res.winner === 'Challenger') w++;
    else if (res.winner !== 'Rung') t++;
  }
  const winPct = 100 * w / MATCHES, tiePct = 100 * t / MATCHES;
  const pts = 14 * (2 * w + t) / MATCHES;
  const verdict = winPct >= 45 ? 'a real contest'
    : winPct >= 30 ? 'underdog, but live'
      : winPct >= 15 ? 'heavy underdog' : 'effectively out of it';
  L('      ' + String(lv).padStart(5) + String(lv - REF).padStart(6)
    + winPct.toFixed(1).padStart(8) + pts.toFixed(1).padStart(14)
    + '   ' + verdict + (tiePct > 0 ? '  (' + tiePct.toFixed(1) + '% tied)' : ''));
}
L('');
L('   Fourteen rounds is a league season, so pts/14 is what a whole summer of');
L('   that matchup is worth. Eight clubs, top two promoted: a promotion needs');
L('   roughly 17-19 points on the measured tables.');
L('');
