#!/usr/bin/env node
/* tools/bowler-shape-probe.mjs — IS A GENERATED QUICK A REAL CRICKETER?
 *
 * PART A §3. The cheap way to make fast bowlers exist is to relabel some
 * fast-medium bowlers, and it would pass a distribution check perfectly: the
 * counts would be right and every man in the game would be the same man with a
 * different word on his card. So the shape is measured, not assumed.
 *
 * The comparison is between the three seam styles as the generator actually
 * deals them, on the attributes a bowler is made of, plus the age, the card and
 * the wage that follow. What it is looking for is that the quicks are drawn
 * from the SAME archetype machinery as everyone else - so they should look like
 * bowlers of their own quality, not like a separate species - while carrying
 * whatever the archetype system naturally gives a club's lead quick.
 *
 * IT DELIBERATELY DOES NOT ASK FOR A SPEED BONUS. The engine prices pace in
 * ballDist and in the fatigue law, both of which are shipped and untouched; a
 * generator that handed quicks extra wicket-threat would be paying them twice.
 *
 *   node tools/bowler-shape-probe.mjs
 */
import vm from 'node:vm';
import fs from 'node:fs';
import { makeEngine } from '../test/engine-vm.mjs';
import { dealWorld } from './bowling-type-probe.mjs';

const eng = makeEngine();
const g = k => vm.runInContext(k, eng.ctx);

const clubs = dealWorld();
const men = [];
for (const c of clubs) for (const p of c.players) men.push({ club: c, p });

const SEAM = ['seamFast', 'seamFastMedium', 'seamMedium'];
const SPIN = ['fingerSpin', 'wristSpin'];
const KEYS = ['wicket', 'economy', 'moveTurn', 'variation', 'discipline', 'stamina'];

const med = a => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;

// LEAD QUICKS ONLY, FOR THE FAIR COMPARISON. Every seamFast the generator
// deals is a club's FIRST-CHOICE quick, and a first-choice quick sits on the
// top rung of his department's quality ladder. Comparing him against all
// fast-medium bowlers - including the third seamer and the fringe man - would
// measure the ladder and call it the style. So the table is drawn twice: once
// over everybody, and once over lead men only.
// The lead quick is the BEST quick, ranked the way the coach ranks bowlers.
// An earlier cut of this took the first pace man in squad ARRAY order, which
// is not the slot order the ladder was dealt in: it found 14 of the 81 genuine
// quicks and called 211 medium-pacers "lead", which is a fact about array
// order and nothing about cricket.
function leadOf(club, styles) {
  const lead = club.players.filter(p => SEAM.indexOf(p.bowlTypeFull) >= 0)
    .sort((a, b) => (b.skills.wicket + b.skills.economy) - (a.skills.wicket + a.skills.economy))[0];
  return (lead && styles.indexOf(lead.bowlTypeFull) >= 0) ? lead : null;
}

function row(label, list) {
  const ovr = list.map(p => Math.round(JSON.parse(g(`JSON.stringify(window.foPlayerValue(${JSON.stringify(p)}))`)).ovr));
  const wage = list.map(p => +p.wage || 0);
  return { label, n: list.length,
    sk: Object.fromEntries(KEYS.map(k => [k, med(list.map(p => p.skills[k] || 0))])),
    age: med(list.map(p => p.age || 0)), ovr: mean(ovr), ovrMed: med(ovr), wage: med(wage) };
}
function print(rows) {
  console.log('  style               n   ' + KEYS.map(k => k.slice(0, 7).padStart(8)).join('')
    + '     age     OVR   wage');
  for (const r of rows)
    console.log('  ' + r.label.padEnd(18) + String(r.n).padStart(4) + '   '
      + KEYS.map(k => String(r.sk[k]).padStart(8)).join('')
      + String(r.age).padStart(8) + r.ovr.toFixed(1).padStart(8)
      + ('$' + r.wage.toLocaleString()).padStart(10));
}

console.log('\n=== ALL BOWLERS OF EACH STYLE (median skill, median age, mean OVR) ===');
const all = SEAM.concat(SPIN).map(s => row(s, men.filter(m => m.p.bowlTypeFull === s).map(m => m.p)));
print(all);

console.log('\n=== LEAD QUICKS ONLY — like against like ===');
const leads = SEAM.map(s => {
  const list = clubs.map(c => leadOf(c, [s])).filter(Boolean);
  return row(s, list);
});
print(leads);

// AND WHERE THEY COME FROM. A quick who only ever appeared at flagship clubs
// would be a prestige item rather than a cricketer.
const byTier = {};
for (const c of clubs) {
  const lead = leadOf(c, SEAM);
  const t = (byTier[c.tier] = byTier[c.tier] || { n: 0, fast: 0 });
  t.n++; if (lead && lead.bowlTypeFull === 'seamFast') t.fast++;
}
console.log('\n  lead quick is genuinely fast, by tier: '
  + Object.entries(byTier).map(([k, v]) => `${k} ${v.fast}/${v.n}`).join('  '));

// AND THE ONE QUESTION THE AGGREGATE CANNOT ANSWER. A lead quick averages 74.8
// overall against a lead fast-medium's 62.8, which read on its own says the
// generator has made "fast" a badge for "good". Split by archetype it says the
// opposite: at a Pace Battery the quick IS the best man in the side (OVR 82,
// wicket 90), which is what that archetype is FOR and is advertised as; at
// every other club the quick the dice handed over is indistinguishable from
// the fast-medium lead he replaced. The gap is the express clubs, not the
// style.
const split = {};
for (const c of clubs) {
  const lead = leadOf(c, SEAM);
  if (!lead) continue;
  const key = (c.arch === 'express' ? 'express' : 'other') + ' lead=' + lead.bowlTypeFull;
  (split[key] = split[key] || []).push(lead);
}
console.log('\n=== LEAD QUICKS, SPLIT BY WHETHER THE CLUB IS A PACE BATTERY ===');
console.log('  group                          n   wicket     OVR');
const splitOut = {};
for (const k of Object.keys(split).sort()) {
  const r = row(k, split[k]);
  splitOut[k] = r;
  console.log('  ' + k.padEnd(30) + String(r.n).padStart(3)
    + String(r.sk.wicket).padStart(9) + r.ovrMed.toFixed(0).padStart(8));
}

fs.writeFileSync('docs/fast-bowler-generation/bowler-shape.json',
  JSON.stringify({ all, leads, byTier, split: splitOut }, null, 1));
