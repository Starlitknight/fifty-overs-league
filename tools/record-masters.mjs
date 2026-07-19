/* tools/record-masters.mjs — (re)bless the golden-master replays.
 *
 * Runs the SHIPPED game headless (test/engine-vm.mjs) over a fixed matrix
 * of seeds × conditions and records every ball. test/replay.test.mjs then
 * asserts future builds reproduce these logs bit-for-bit.
 *
 * Run ONLY when a gameplay-affecting change is intentional:
 *     ./build.sh && node tools/record-masters.mjs && node tools/engine-bench.mjs
 * then commit the updated test/golden/masters.json alongside the change.
 * A refactor that alters masters is a regression, not a re-bless.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeEngine } from '../test/engine-vm.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MATRIX = [];
for (const [pitch, weather] of [['balanced', 'Sunny'], ['dry', 'Sunny'], ['green', 'Overcast']])
  for (const seed of [42, 11, 7]) MATRIX.push({ aIx: 0, bIx: 1, pitch, weather, seed });

const eng = makeEngine();
const masters = MATRIX.map(c => {
  const r = eng.runMatch(c.aIx, c.bIx, c.pitch, c.weather, c.seed);
  if (!r) throw new Error('match failed: ' + JSON.stringify(c));
  return { ...c, ...r };
});
const outPath = path.join(root, 'test/golden/masters.json');
writeFileSync(outPath, JSON.stringify(masters));
const balls = masters.reduce((a, m) => a + m.balls.length, 0);
console.log('blessed ' + masters.length + ' masters (' + balls + ' balls) -> test/golden/masters.json');
