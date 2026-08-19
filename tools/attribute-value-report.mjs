#!/usr/bin/env node
/* tools/attribute-value-report.mjs — RAW CONTEXT VALUE, AND WHAT THE WORLD PAYS
 *
 * PHASE 3 §7. Reads every cell the matrix probe wrote and produces the two
 * numbers the brief asks for on every attribute:
 *
 *   RAW CONTEXT VALUE      what a point is worth in each context, printed out
 *                          rather than averaged away, because the context
 *                          dependence IS the finding for half of these
 *                          attributes and hiding it inside one coefficient is
 *                          what produced the vsSpin error in the first place.
 *
 *   WORLD-WEIGHTED VALUE   the same numbers weighted by how often the world
 *                          actually serves that context up, taken from
 *                          world-distribution.json - which is enumerated off
 *                          the shipped engine, not guessed.
 *
 * THE WEIGHTING IS OVER PITCHES ONLY, and that is a deliberate limit worth
 * stating plainly. The star design measures one dimension at a time, so there
 * is no pitch x attack cell to weight jointly; the attack dimension is
 * reported beside it and used on its own for the two attributes it decides
 * (vsPace, vsSpin), where the exposure extremes give a clean line to
 * interpolate along. Weighting pitches and attacks as though they were
 * independent and multiplying the two would be inventing an interaction the
 * design never measured.
 *
 *   node tools/attribute-value-report.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'docs/player-value-realism/cells';
const cells = {};
for (const f of fs.readdirSync(DIR)) {
  const c = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
  (cells[c.attr] = cells[c.attr] || {})[c.ctx] = c;
}
const world = JSON.parse(fs.readFileSync('docs/player-value-realism/world-distribution.json', 'utf8'));

// the pitch a cell was played on -> the world's share of that pitch. `flat`
// never occurs as a groundsman's leaning and carries zero.
const PITCH_CTX = {
  ref: 'balanced', 'pitch-green': 'green', 'pitch-flat': 'flat',
  'pitch-slow': 'slow', 'pitch-dry': 'dry',
  'pitch-twopaced': 'twoPaced', 'pitch-cracked': 'cracked'
};
const share = world.pitch.share;

const best = a => cells[a].deep || cells[a].ref;   // deep is the same cell, more sample
const val = (a, c) => cells[a][c] ? cells[a][c].perPoint : null;

const rows = [];
for (const a of Object.keys(cells)) {
  const ref = best(a);
  let num = 0, den = 0;
  for (const [ctx, pitch] of Object.entries(PITCH_CTX)) {
    // the reference cell IS the balanced pitch, and its deep re-run is the
    // best estimate of it - so `ref` reads from `best`, not from the N=400 row
    const v = ctx === 'ref' ? ref.perPoint : val(a, ctx);
    const w = share[pitch] || 0;
    if (v == null || !w) continue;
    num += w * v; den += w;
  }
  rows.push({
    attr: a, fam: ref.fam, ref: ref.perPoint, se: ref.dMargin.se / ref.step,
    n: ref.n, worldPitch: den > 0 ? num / den : null, pitchCover: den
  });
}
rows.sort((x, y) => y.ref - x.ref);

console.log('\n=== RAW (balanced pitch, balanced attack, ordinary league) AND WORLD-WEIGHTED ===');
console.log('  attribute        fam        ref/pt      se     world/pt   cover');
for (const r of rows)
  console.log('  ' + r.attr.padEnd(16) + r.fam.padEnd(10)
    + r.ref.toFixed(4).padStart(9) + r.se.toFixed(4).padStart(8)
    + (r.worldPitch == null ? '     -   ' : r.worldPitch.toFixed(4).padStart(11))
    + (100 * r.pitchCover).toFixed(0).padStart(7) + '%');

// ---------------------------------------------------------------------------
// §6, SETTLED. vsPace and vsSpin along the exposure line, interpolated to the
// share of overs the world's front lines actually bowl.
// ---------------------------------------------------------------------------
const spin = world.exposure.spinShare;
console.log(`\n=== EXPOSURE (world bowls ${(100 * spin).toFixed(1)}% spin, ${(100 - 100 * spin).toFixed(1)}% pace) ===`);
console.log('  attr      all-pace   pace-hvy   balanced   spin-hvy   all-spin   ->world');
for (const a of ['vsPace', 'vsSpin']) {
  const ap = val(a, 'attack-allpace'), as = val(a, 'attack-allspin');
  const x = a === 'vsPace' ? (1 - spin) : spin;      // his own exposure share
  // two readings, both reported: a line through the two extremes, and the
  // same line forced through the origin (a point of vsSpin should be worth
  // nothing at all when no spin is bowled, and measuring that is a check on
  // the design rather than a parameter)
  const lin = a === 'vsPace' ? as + (ap - as) * x : ap + (as - ap) * x;
  const thru = (a === 'vsPace' ? ap : as) * x;
  console.log('  ' + a.padEnd(9)
    + [val(a, 'attack-allpace'), val(a, 'attack-pace'), best(a).perPoint,
       val(a, 'attack-spin'), val(a, 'attack-allspin')]
      .map(v => (v == null ? '    -  ' : v.toFixed(3)).padStart(11)).join('')
    + `   ${lin.toFixed(3)} / ${thru.toFixed(3)}`);
}

// ---------------------------------------------------------------------------
// MATCH STATE, off the reference cell's own seeds.
// ---------------------------------------------------------------------------
console.log('\n=== MATCH STATE (reference cell, split on the control run) ===');
console.log('  attribute         bat 1st      chase   hard chase   easy chase');
for (const r of rows) {
  const s = (cells[r.attr].deep || cells[r.attr].ref).state;
  if (!s) continue;
  console.log('  ' + r.attr.padEnd(16)
    + [s.battingFirst, s.chase, s.hardChase, s.easyChase]
      .map(x => x.perPoint.toFixed(3).padStart(12)).join(''));
}

// ---------------------------------------------------------------------------
// LEAGUE LEVEL.
// ---------------------------------------------------------------------------
console.log('\n=== LEAGUE LEVEL (x0.72 / ordinary / x1.22 on every skill of both sides) ===');
console.log('  attribute            weak    ordinary       elite');
for (const r of rows) {
  const w = val(r.attr, 'lvl-weak'), e = val(r.attr, 'lvl-elite');
  if (w == null && e == null) continue;
  console.log('  ' + r.attr.padEnd(16)
    + [w, r.ref, e].map(v => (v == null ? '   -  ' : v.toFixed(3)).padStart(12)).join(''));
}

fs.writeFileSync('docs/player-value-realism/attribute-values-v2.json',
  JSON.stringify({ world: { pitchShare: share, spinShare: spin }, rows }, null, 1));
