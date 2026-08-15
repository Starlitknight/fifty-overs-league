#!/usr/bin/env node
/* tools/engine-domain.mjs — HOW FAR UP DOES THE FROZEN BALL MODEL STILL WORK?
 *
 * B1 established a useful individual range of roughly 20-95 and B2 built a 99
 * ceiling on top of it. The latent/effective split needs to know something B1
 * never asked: what does ballDist ACTUALLY do when it is handed a batsman at an
 * effective 105, or a bowler at 110? The 95 figure was the top of the range B1
 * happened to sweep, not a measured failure point, and the two are very
 * different facts to build a transform on.
 *
 * This sweeps the SHIPPED ballDist - the same pure function tools/ball-probe.mjs
 * calls, at the same exactness, no sampling - from 60 up to 140 for
 * representative contests, and reports for each the response of the quantity
 * that skill is supposed to move. It then judges four properties per family:
 *
 *   MONOTONE     the response never goes the wrong way as the skill rises
 *   NON-INVERTED being better is never worse than being worse, at any pair
 *   NON-FLAT     a ten-point step still buys a measurable difference
 *   STABLE       nothing runs away, goes negative, or leaves [0,1] as a
 *                probability; run rates stay inside cricket
 *
 * The point is to find the highest value at which all four still hold, because
 * that - and not 95, and not 99 - is the real top of the engine's input domain
 * and therefore the target the latent->effective transform must land inside.
 *
 *   node tools/engine-domain.mjs            # the tables
 *   node tools/engine-domain.mjs --json     # machine-readable
 *
 * IT CHANGES NOTHING. Like every other tool in here it reads the built
 * index.html in a VM and forms an opinion about it on the way out.
 */
import { probe } from './ball-probe.mjs';

const has = k => process.argv.includes('--' + k);
const say = s => { if (!has('json')) console.log(s); };

const LEVELS = (process.env.DOM_LEVELS ? process.env.DOM_LEVELS.split(',').map(Number) : [60, 70, 80, 85, 90, 95, 98, 100, 102, 105, 108, 110, 115, 120, 130, 140]);

// A uniform cricketer at a level, which is the only way to ask "what is a 105
// batsman" without also asking which kind of 105 batsman he is.
const uniformBat = v => ({ skills: { vsPace: v, vsSpin: v, power: v, rotation: v, temperament: v } });
const uniformBowl = (v, type) => ({
  bowlTypeFull: type || 'seamFastMedium',
  skills: { wicket: v, economy: v, discipline: v, moveTurn: v, variation: v, stamina: v }
});

// ---------------------------------------------------------------------------
// THE CONTESTS. Each one names the quantity it is about and which direction
// better is, because "monotone" is meaningless without that: a better batsman
// should raise the run rate, a better bowler should lower it.
// ---------------------------------------------------------------------------
const CONTESTS = [
  { key: 'bat_vs_85', fam: 'bat', label: 'batsman X v bowler 85',
    metric: 'rpo', want: +1,
    run: v => probe(uniformBat(v), uniformBowl(85), { over: 25 }) },
  { key: 'bat_bpw_85', fam: 'bat', label: 'batsman X v bowler 85 (balls/wkt)',
    metric: 'bpw', want: +1,
    run: v => probe(uniformBat(v), uniformBowl(85), { over: 25 }) },
  { key: 'bat_vs_100', fam: 'bat', label: 'batsman X v bowler 100',
    metric: 'rpo', want: +1,
    run: v => probe(uniformBat(v), uniformBowl(100), { over: 25 }) },
  { key: 'bowl_vs_85', fam: 'bowl', label: 'bowler X v batsman 85',
    metric: 'rpo', want: -1,
    run: v => probe(uniformBat(85), uniformBowl(v), { over: 25 }) },
  { key: 'bowl_wkt_85', fam: 'bowl', label: 'bowler X v batsman 85 (wkt%)',
    metric: 'wkt', want: +1,
    run: v => probe(uniformBat(85), uniformBowl(v), { over: 25 }) },
  { key: 'bowl_vs_100', fam: 'bowl', label: 'bowler X v batsman 100',
    metric: 'rpo', want: -1,
    run: v => probe(uniformBat(100), uniformBowl(v), { over: 25 }) },
  { key: 'bowl_spin', fam: 'bowl', label: 'spinner X v batsman 85',
    metric: 'rpo', want: -1,
    run: v => probe(uniformBat(85), uniformBowl(v, 'fingerSpin'), { over: 25 }) },
  { key: 'bat_death', fam: 'bat', label: 'batsman X v bowler 85, death',
    metric: 'rpo', want: +1,
    run: v => probe(uniformBat(v), uniformBowl(85), { over: 46, ph: 'death' }) },
  { key: 'bat_pp', fam: 'bat', label: 'batsman X v bowler 85, powerplay',
    metric: 'rpo', want: +1,
    run: v => probe(uniformBat(v), uniformBowl(85), { over: 4, ph: 'pp' }) },
  // FIELDING IS A DIFFERENT ANIMAL and B1 said so: the spatial contest compares
  // an absolute skill against an absolute difficulty roll rather than one man
  // against another, so it is the family most likely to saturate first.
  { key: 'field', fam: 'field', label: 'fieldAvg X, bat 85 v bowl 85',
    metric: 'rpo', want: -1,
    run: v => probe(uniformBat(85), uniformBowl(85), { over: 25, fieldAvg: v }) },
  { key: 'keeper_catch', fam: 'glove', label: 'keeperCatch X, bat 85 v bowl 85',
    metric: 'wkt', want: +1,
    run: v => probe(uniformBat(85), uniformBowl(85), { over: 25, keeperCatch: v, keeperQuality: v }) },
  { key: 'keeper_stump', fam: 'glove', label: 'keeperStump X, bat 85 v spin 85',
    metric: 'wST', want: +1,
    run: v => probe(uniformBat(85), uniformBowl(85, 'fingerSpin'),
                    { over: 25, keeperStump: v, keeperQuality: v }) }
];

// ---------------------------------------------------------------------------
// SANITY, WHICH IS NOT THE SAME QUESTION AS MONOTONICITY. A response can climb
// perfectly smoothly into a run rate of forty an over, or into a negative
// probability, and be monotone the whole way. These are the bounds outside
// which the engine is no longer describing cricket whatever its derivative is
// doing.
// ---------------------------------------------------------------------------
function sane(p) {
  const bad = [];
  const keys = ['dot', 'one', 'two', 'three', 'four', 'six', 'wkt', 'wide', 'noball', 'bye', 'legbye'];
  for (const k of keys) {
    const v = p[k];
    if (!isFinite(v)) { bad.push(k + ' not finite'); continue; }
    if (v < -1e-9) bad.push(k + ' negative (' + v.toFixed(3) + '%)');
    if (v > 100 + 1e-9) bad.push(k + ' over 100% (' + v.toFixed(3) + '%)');
  }
  const tot = keys.reduce((a, k) => a + (isFinite(p[k]) ? p[k] : 0), 0);
  if (Math.abs(tot - 100) > 0.5) bad.push('outcomes sum to ' + tot.toFixed(2) + '%');
  if (!isFinite(p.rpo) || p.rpo < 0 || p.rpo > 30) bad.push('rpo ' + p.rpo.toFixed(2) + ' outside 0..30');
  return bad;
}

const out = { levels: LEVELS, contests: {} };

const f = (x, n = 3) => (x == null || !isFinite(x) ? '     -' : x.toFixed(n).padStart(7));

say('THE FROZEN BALL MODEL, SWEPT PAST ITS DOCUMENTED DOMAIN');
say('ballDist is a pure function; every number below is exact, not sampled.');
say('');
say('level'.padEnd(6) + LEVELS.map(l => String(l).padStart(7)).join(''));

for (const c of CONTESTS) {
  const vals = [], sanity = [];
  for (const v of LEVELS) {
    const p = c.run(v);
    vals.push(p[c.metric]);
    sanity.push(sane(p));
  }
  out.contests[c.key] = { label: c.label, metric: c.metric, want: c.want, values: vals };

  // WHERE DOES IT STOP BEHAVING? Walk up the levels and record the last one at
  // which every property still holds against its predecessor.
  let lastGood = LEVELS[0], firstBreak = null, reason = '';
  for (let i = 1; i < LEVELS.length; i++) {
    const d = (vals[i] - vals[i - 1]) * c.want;
    const problems = sanity[i].slice();
    if (!isFinite(vals[i])) problems.push('metric not finite');
    // MONOTONE, with a tolerance: these are exact numbers, so the only slack
    // needed is against floating point, not against sampling.
    else if (d < -1e-9) problems.push('inverted (' + vals[i - 1].toFixed(3) + ' -> ' + vals[i].toFixed(3) + ')');
    // NON-FLAT is asked as a RELATIVE question. An absolute threshold would
    // call a small quantity dead just for being small.
    else if (Math.abs(vals[i] - vals[i - 1]) < Math.abs(vals[i - 1]) * 1e-4)
      problems.push('flat (' + vals[i - 1].toFixed(4) + ' -> ' + vals[i].toFixed(4) + ')');
    if (problems.length) { if (!firstBreak) { firstBreak = LEVELS[i]; reason = problems[0]; } }
    else if (!firstBreak) lastGood = LEVELS[i];
  }
  out.contests[c.key].lastGood = lastGood;
  out.contests[c.key].firstBreak = firstBreak;
  out.contests[c.key].reason = reason;

  say('');
  say(c.label + '  [' + c.metric + ', better = ' + (c.want > 0 ? 'higher' : 'lower') + ']');
  say('      ' + vals.map(v => f(v)).join(''));
  say('  healthy to ' + lastGood + (firstBreak ? ('; breaks at ' + firstBreak + ' — ' + reason) : '; no break found'));
}

// ---------------------------------------------------------------------------
// THE ANSWER, BY FAMILY. The transform has to land inside the WORST contest of
// a family, not the best, because a cricketer is handed to all of them at once.
// ---------------------------------------------------------------------------
const fams = {};
for (const c of CONTESTS) {
  const r = out.contests[c.key];
  if (!fams[c.fam] || r.lastGood < fams[c.fam].lastGood)
    fams[c.fam] = { lastGood: r.lastGood, by: c.key, reason: r.reason, firstBreak: r.firstBreak };
}
out.families = fams;
say('');
say('THE ENGINE\'S HEALTHY INPUT DOMAIN, BY ATTRIBUTE FAMILY');
say('(the worst contest in the family, because a man is handed to all of them)');
for (const k of Object.keys(fams))
  say('  ' + k.padEnd(7) + ' healthy to ' + String(fams[k].lastGood).padStart(4) +
      '   (limited by ' + fams[k].by + (fams[k].firstBreak ? ': ' + fams[k].reason : '') + ')');

if (has('json')) console.log(JSON.stringify(out, null, 2));
