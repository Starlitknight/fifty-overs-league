/* Golden-master replays: the safety net that replaces the engine hash-lock.
 *
 * The SHIPPED game (built index.html, headless via engine-vm) must
 * reproduce the recorded ball-by-ball logs bit-for-bit. If this fails
 * after a refactor, the refactor changed gameplay — fix it. If it fails
 * after an INTENTIONAL model change, re-bless with
 * tools/record-masters.mjs and run the bench gate.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeEngine } from './engine-vm.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const goldPath = path.join(root, 'test/golden/masters.json');

test('golden-master replays reproduce shipped gameplay bit-for-bit', () => {
  assert.ok(existsSync(goldPath), 'test/golden/masters.json missing — run tools/record-masters.mjs');
  const masters = JSON.parse(readFileSync(goldPath, 'utf8'));
  assert.ok(masters.length >= 6, 'suspiciously few masters');
  const eng = makeEngine();
  for (const m of masters) {
    const r = eng.runMatch(m.aIx, m.bIx, m.pitch, m.weather, m.seed);
    assert.ok(r, 'match failed to complete: ' + m.pitch + ' seed ' + m.seed);
    assert.equal(r.batFirst, m.batFirst, m.pitch + '/' + m.seed + ': toss diverged');
    assert.deepEqual(r.innings, m.innings, m.pitch + '/' + m.seed + ': innings diverged');
    assert.deepEqual(r.balls, m.balls, m.pitch + '/' + m.seed + ': ball log diverged');
  }
});
