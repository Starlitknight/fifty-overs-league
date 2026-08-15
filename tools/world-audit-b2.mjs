#!/usr/bin/env node
/* tools/world-audit-b2.mjs — WHAT IS THE WORLD ACTUALLY MADE OF?
 *
 * B2 redistributes 3,840 cricketers across 256 clubs and sixteen countries. The
 * only way to know whether the intended shape arrived is to deal the whole world
 * and count it, so this deals the whole world and counts it: the OVR histogram,
 * every club tier, roles by band, wages, stars, and the players whose cards do
 * not make sense.
 *
 *   node tools/world-audit-b2.mjs                 # the tables
 *   node tools/world-audit-b2.mjs --json          # machine-readable
 *   node tools/world-audit-b2.mjs --cards         # example cards across the scale
 *
 * IT CHANGES NOTHING. Everything is generated in a VM off the shipped build.
 */
import vm from 'node:vm';
import { makeHost } from '../server/enginehost.mjs';
import { countryConfigs, tierOfClub, squadFor } from '../server/init-world.mjs';
import { valueOf } from '../server/market.mjs';

const has = k => process.argv.includes('--' + k);
// THE UMPIRE'S OWN HOST, not a second copy of the engine. This audit has to
// deal exactly the world the world service deals, so it goes through the same
// door - squadFor, countryConfigs, the lot - and cannot drift from it.
const host = makeHost();
const cfgs = countryConfigs(host);
const ovrOf = p => host.pkOvr([p])[0];

// ---- deal the world exactly as init-world does ---------------------------
const clubs = [];
for (const cfg of cfgs) {
  for (const club of cfg.clubs) {
    const tier = tierOfClub(cfg, club);
    const men = squadFor(host, cfg, club, 1);
    const ovrs = host.pkOvr(men);
    men.forEach((p, i) => { p.__ovr2 = ovrs[i]; p.__tier = tier; p.__country = cfg.id; p.__club = club.slot; });
    clubs.push({ country: cfg.id, slot: club.slot, name: club.name, tier, men });
  }
}
const all = clubs.flatMap(c => c.men);
// the canonical helpers, read out of the same engine the host is running
const valOf = host.playerValue ? host.playerValue : (p => ({ fam: { bat: 0, bowl: 0, field: 0 }, role: 'bat' }));
const labelOf = host.ovrLabel || (v => String(v));
const starsOf = host.stars || (v => Math.round(v / 10 * 2) / 2);
const r1 = x => Math.round(x * 10) / 10;
const pc = (xs, f) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };
const say = s => { if (!has('json')) console.log(s); };

// ---- 1. the OVR histogram -------------------------------------------------
const BANDS = [[0, 9], [10, 19], [20, 29], [30, 39], [40, 49], [50, 59], [60, 69],
  [70, 79], [80, 84], [85, 89], [90, 94], [95, 97], [98, 99], [100, 100]];
const hist = BANDS.map(([lo, hi]) => ({ band: lo + '-' + hi, n: all.filter(p => p.__ovr2 >= lo && p.__ovr2 <= hi).length }));
say(`\n=== WORLD OVR HISTOGRAM (${all.length} cricketers, ${clubs.length} clubs) ===`);
for (const h of hist)
  say('  ' + h.band.padStart(7) + '  ' + String(h.n).padStart(5) +
    '  ' + (100 * h.n / all.length).toFixed(2).padStart(6) + '%  ' + '#'.repeat(Math.round(60 * h.n / all.length)));

// ---- 2. club tiers --------------------------------------------------------
const TIERORDER = ['flagship', 'd1a', 'd1b', 'd2a', 'd2b', 'newcomer'];
say('\n=== CLUB TIERS ===');
say('tier       teams  squadOVR  bestXI  median  p10  p90  best  5th  11th  80+  90+');
const tierRows = [];
for (const t of TIERORDER) {
  const cs = clubs.filter(c => c.tier === t);
  if (!cs.length) continue;
  const sq = [], xi = [], best = [], fifth = [], elev = [];
  let n80 = 0, n90 = 0;
  for (const c of cs) {
    const o = c.men.map(p => p.__ovr2).sort((a, b) => b - a);
    sq.push(o.reduce((a, b) => a + b, 0) / o.length);
    xi.push(o.slice(0, 11).reduce((a, b) => a + b, 0) / Math.min(11, o.length));
    best.push(o[0]); fifth.push(o[4] || 0); elev.push(o[10] || 0);
    n80 += o.filter(v => v >= 80).length; n90 += o.filter(v => v >= 90).length;
  }
  const allO = cs.flatMap(c => c.men.map(p => p.__ovr2));
  const row = { tier: t, teams: cs.length, squad: r1(sq.reduce((a, b) => a + b, 0) / sq.length),
    xi: r1(xi.reduce((a, b) => a + b, 0) / xi.length), median: pc(allO, 0.5),
    p10: pc(allO, 0.1), p90: pc(allO, 0.9),
    best: r1(best.reduce((a, b) => a + b, 0) / best.length),
    fifth: r1(fifth.reduce((a, b) => a + b, 0) / fifth.length),
    elev: r1(elev.reduce((a, b) => a + b, 0) / elev.length), n80, n90 };
  tierRows.push(row);
  say('  ' + t.padEnd(9) + String(row.teams).padStart(5) + String(row.squad).padStart(10) +
    String(row.xi).padStart(8) + String(row.median).padStart(8) + String(row.p10).padStart(5) +
    String(row.p90).padStart(5) + String(row.best).padStart(6) + String(row.fifth).padStart(5) +
    String(row.elev).padStart(6) + String(row.n80).padStart(5) + String(row.n90).padStart(5));
}

// ---- 3. roles by band -----------------------------------------------------
const roleOf = p => p.keeper || p.role === 'wicketkeeper' ? 'keeper'
  : p.role === 'allRounder' ? 'allrounder'
    : (p.bowlType && p.bowlType !== 'none') ? ('bowl:' + p.bowlType) : 'batsman';
say('\n=== ROLES BY OVR BAND ===');
const RB = [[0, 39], [40, 59], [60, 74], [75, 84], [85, 100]];
const roles = [...new Set(all.map(roleOf))].sort();
say('band'.padEnd(10) + roles.map(r => r.slice(0, 11).padStart(12)).join(''));
const roleRows = [];
for (const [lo, hi] of RB) {
  const pool = all.filter(p => p.__ovr2 >= lo && p.__ovr2 <= hi);
  const row = { band: lo + '-' + hi, n: pool.length };
  say((lo + '-' + hi).padEnd(10) + roles.map(r => {
    const k = pool.filter(p => roleOf(p) === r).length;
    row[r] = k;
    return (k + ' (' + (100 * k / Math.max(1, pool.length)).toFixed(0) + '%)').padStart(12);
  }).join(''));
  roleRows.push(row);
}

// ---- 4. wages and stars ---------------------------------------------------
const wages = all.map(p => p.wage || 0);
say('\n=== WAGES ===');
say('  min ' + Math.min(...wages) + '  p10 ' + pc(wages, .1) + '  median ' + pc(wages, .5) +
  '  p75 ' + pc(wages, .75) + '  p90 ' + pc(wages, .9) + '  p95 ' + pc(wages, .95) +
  '  p99 ' + pc(wages, .99) + '  max ' + Math.max(...wages));
say('  payroll by tier:');
const payroll = {};
for (const t of TIERORDER) {
  const cs = clubs.filter(c => c.tier === t); if (!cs.length) continue;
  const pr = cs.map(c => c.men.reduce((a, p) => a + (p.wage || 0), 0));
  payroll[t] = Math.round(pr.reduce((a, b) => a + b, 0) / pr.length);
  say('    ' + t.padEnd(10) + String(payroll[t]).padStart(10));
}
const starCount = {};
all.forEach(p => { const k = starsOf(p.__ovr2).toFixed(1); starCount[k] = (starCount[k] || 0) + 1; });
say('\n=== STARS (canonical ten, in halves) ===');
say('  ' + Object.keys(starCount).sort((a, b) => +a - +b).map(k => k + ':' + starCount[k]).join('  '));

// ---- 5. the outlier audit -------------------------------------------------
const bad = [];
const push = (kind, p, why) => bad.push({ kind, name: p.name, country: p.__country, club: p.__club, ovr: p.__ovr2, why });
for (const p of all) {
  const s = p.skills || {}, o = p.__ovr2, v = valOf(p);
  // A KEEPER IS JUDGED AGAINST HIMSELF, not against a fixed bar. A newcomer
  // club's gloveman genuinely cannot keep by international standards - that is
  // what a newcomer club is - and flagging him says nothing. What is a real
  // data fault is a keeper whose gloves are poor relative to the rest of HIM,
  // because then the club is fielding a batsman in the gloves by accident.
  if ((p.keeper || p.role === 'wicketkeeper') && s.keeping < 0.55 * Math.max(1, o))
    push('keeper cannot keep', p, 'keeping ' + s.keeping + ' at OVR ' + o);
  if (o >= 80 && (p.bowlType && p.bowlType !== 'none') && v.role === 'bowl' && s.wicket < 55)
    push('elite bowler, mediocre bowling', p, 'wicket ' + s.wicket);
  if (o >= 70 && v.fam.field / Math.max(1e-9, v.fam.bat + v.fam.bowl + v.fam.field) > 0.34)
    push('high card built on fielding', p, 'field share ' +
      (100 * v.fam.field / (v.fam.bat + v.fam.bowl + v.fam.field)).toFixed(0) + '%');
  if (o >= 90 && (p.wage || 0) < 3000) push('elite paid like a squad man', p, 'wage ' + p.wage);
}
for (const c of clubs) {
  if (!c.men.some(p => p.keeper || p.role === 'wicketkeeper')) bad.push({ kind: 'club with no keeper', name: c.name, country: c.country, club: c.slot });
  const bw = c.men.filter(p => p.bowlType && p.bowlType !== 'none').length;
  if (bw < 5) bad.push({ kind: 'club with too few bowlers', name: c.name, country: c.country, club: c.slot, why: bw + ' bowlers' });
}
say('\n=== OUTLIERS ===');
if (!bad.length) say('  none');
else {
  const byKind = {};
  bad.forEach(b => (byKind[b.kind] = byKind[b.kind] || []).push(b));
  for (const k in byKind) {
    say('  ' + k + ': ' + byKind[k].length);
    byKind[k].slice(0, 4).forEach(b => say('      ' + (b.name || '') + ' ' + (b.country || '') + '/' + b.club + ' OVR ' + (b.ovr != null ? b.ovr : '-') + (b.why ? '  ' + b.why : '')));
  }
}

// ---- 6. example cards -----------------------------------------------------
if (has('cards')) {
  say('\n=== EXAMPLE CARDS ACROSS THE SCALE ===');
  const SK = ['vsPace', 'vsSpin', 'power', 'rotation', 'temperament', 'wicket', 'economy',
    'discipline', 'moveTurn', 'variation', 'stamina', 'fielding', 'catching', 'keeping', 'stumping'];
  // AND WHAT HE COSTS, because a card that reads right and prices wrong is half
  // an answer. The money is the umpire's own arithmetic (server/market.mjs),
  // not a second opinion restated here.
  const money = n => '$' + Math.round(n).toLocaleString('en-US');
  const seen = new Set();
  for (const want of [15, 25, 35, 50, 65, 75, 82, 88, 92, 96]) {
    const p = all.slice()
      .filter(x => !seen.has(x.name))
      .sort((a, b) => Math.abs(a.__ovr2 - want) - Math.abs(b.__ovr2 - want))[0];
    if (!p) continue;
    seen.add(p.name);
    const v = valOf(p);
    say(`\n  OVR ${p.__ovr2} (${labelOf(p.__ovr2)}, ${starsOf(p.__ovr2)}*)  ${p.name}  ${p.__country}  age ${p.age}  ${p.role}${p.archetype ? ' / ' + p.archetype : ''}  best-role=${v.role}  ${p.__tier}`);
    say(`    wage ${money(p.wage || 0)} a round   transfer value ${money(valueOf(p))}`);
    say('    ' + SK.map(k => k.slice(0, 4) + ' ' + String((p.skills || {})[k]).padStart(2)).join('  '));
  }
}

if (has('json')) console.log(JSON.stringify({ hist, tierRows, roleRows, payroll, starCount, outliers: bad.length, n: all.length }, null, 1));
