/* tools/calibration-check.mjs — the CI gate on the engine freeze.
 *
 * Re-runs a fixed, seed-pinned subsample of the calibration matrix (300
 * matches per cell by default) against the CURRENT build and fails if any
 * band drifts beyond tolerance from engine/calibration-golden.json. Run
 * after ./build.sh; wire into CI. This test never tunes anything — it only
 * refuses to let the engine's behaviour change silently.
 *
 *   ./build.sh && node tools/calibration-check.mjs
 *
 * Tolerances are wider than the golden's sampling noise (subsample of 300
 * vs golden's 3334) but tight enough to catch real model drift:
 *   first-innings mean   ±5%      stddev            ±25%
 *   boundary % per ball  ±1.5pp   extras/innings    ±1.5
 *   phase run-rates      ±0.5     all-out share     ±10pp
 *   determinism          exact (fingerprint must match the golden)
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const N = parseInt(process.env.CAL_CHECK_N || '300', 10);
const goldenPath = new URL('../engine/calibration-golden.json', import.meta.url);
const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));

// run the harness in smoke mode on the SAME seed bases (CAL_N subsample)
const out = execFileSync(process.execPath, [new URL('./calibration.mjs', import.meta.url).pathname],
  { env: { ...process.env, CAL_N: String(N) }, maxBuffer: 64 * 1024 * 1024 }).toString();
const fresh = JSON.parse(out);

const fail = [];
const near = (a, b, tol, label) => { if (Math.abs(a - b) > tol) fail.push(label + ': ' + a + ' vs golden ' + b + ' (tol ' + tol + ')'); };

for (const cell of Object.keys(golden.cells)) {
  const g = golden.cells[cell], f = fresh.cells[cell];
  if (!f) { fail.push(cell + ': missing from fresh run'); continue; }
  near(f.firstInnings.mean, g.firstInnings.mean, g.firstInnings.mean * 0.05, cell + ' firstInnings.mean');
  near(f.firstInnings.stddev, g.firstInnings.stddev, g.firstInnings.stddev * 0.25, cell + ' firstInnings.stddev');
  near(f.boundaryPctPerBall, g.boundaryPctPerBall, 1.5, cell + ' boundaryPct');
  near(f.extrasPerInnings, g.extrasPerInnings, 1.5, cell + ' extras');
  near(f.runRateByPhase.powerplay_1_10, g.runRateByPhase.powerplay_1_10, 0.5, cell + ' rr.powerplay');
  near(f.runRateByPhase.middle_11_40, g.runRateByPhase.middle_11_40, 0.5, cell + ' rr.middle');
  near(f.runRateByPhase.death_41_50, g.runRateByPhase.death_41_50, 0.5, cell + ' rr.death');
  near(f.wicketsHistogram[10], g.wicketsHistogram[10], 0.10, cell + ' allOutShare');
}
// ---- AND THE ONE CONTRACT THAT IS NOT MERELY "DON'T DRIFT" ----------------
//
// Everything above asks only that the engine still does what it did. This
// asks something harder and it asks it of ONE cell: that our INTERNATIONAL
// cricket resembles the real men's ODI cricket the model was fitted to.
//
// It is deliberately not asked of the domestic cells. The engine was
// calibrated on international data, so international matches are the only
// ones that data describes - a second division club has no business posting
// a World Cup total, and for a long time this gate quietly insisted that it
// did: the golden it produced had weak-versus-weak scoring 265.8 and
// elite-versus-elite 251.1, the worst cricket in the world outscoring the
// best, and nothing here objected because nothing here was looking.
//
// Bands, not points. These are what men's ODI cricket actually does, and the
// engine is allowed to sit anywhere sensible inside them.
const ODI_PAR = {
  'firstInnings.mean': [225, 285],      // a par first-innings total
  'boundaryPctPerBall': [6.5, 12.0],    // fours and sixes as a share of deliveries
  'extrasPerInnings': [8, 26],
  'allOutShare': [0.20, 0.55],          // how often a side batting first is bowled out
};
const intl = fresh.cells.international;
if (!intl) fail.push('no international cell: the ODI contract cannot be checked');
else {
  const band = (v, key) => {
    const [lo, hi] = ODI_PAR[key];
    if (!(v >= lo && v <= hi))
      fail.push('international ' + key + ' = ' + v + ' is outside real-ODI ' + lo + '..' + hi);
  };
  band(intl.firstInnings.mean, 'firstInnings.mean');
  band(intl.boundaryPctPerBall, 'boundaryPctPerBall');
  band(intl.extrasPerInnings, 'extrasPerInnings');
  band(intl.wicketsHistogram[10], 'allOutShare');
  // AND THE PYRAMID POINTS THE RIGHT WAY UP. The reason this file exists in
  // its present form: international cricket must outscore club cricket, not
  // trail it. A tolerance, not a hair - the point is the SIGN.
  const d2 = fresh.cells.division_two;
  if (d2 && !(intl.firstInnings.mean > d2.firstInnings.mean + 15))
    fail.push('the pyramid is upside down: internationals average ' + intl.firstInnings.mean +
      ' and division two ' + d2.firstInnings.mean);
  if (d2 && !(d2.wicketsHistogram[10] > intl.wicketsHistogram[10]))
    fail.push('weaker sides are bowled out LESS often than internationals: ' +
      d2.wicketsHistogram[10] + ' vs ' + intl.wicketsHistogram[10]);
}

if (!fresh.determinism.identical) fail.push('engine is not seed-deterministic');
if (golden.determinism.fingerprint !== fresh.determinism.fingerprint)
  fail.push('pinned-match fingerprint changed: ' + fresh.determinism.fingerprint + ' vs golden ' + golden.determinism.fingerprint);

if (fail.length) {
  console.error('CALIBRATION DRIFT — the engine no longer matches its frozen contract:\n  ' + fail.join('\n  '));
  process.exit(1);
}
console.log('calibration-check PASS — engine matches calibration-golden.json (engineVersion ' + golden.engineVersion + ', ' + N + ' matches/cell).');
