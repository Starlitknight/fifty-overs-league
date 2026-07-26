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
if (!fresh.determinism.identical) fail.push('engine is not seed-deterministic');
if (golden.determinism.fingerprint !== fresh.determinism.fingerprint)
  fail.push('pinned-match fingerprint changed: ' + fresh.determinism.fingerprint + ' vs golden ' + golden.determinism.fingerprint);

if (fail.length) {
  console.error('CALIBRATION DRIFT — the engine no longer matches its frozen contract:\n  ' + fail.join('\n  '));
  process.exit(1);
}
console.log('calibration-check PASS — engine matches calibration-golden.json (engineVersion ' + golden.engineVersion + ', ' + N + ' matches/cell).');
