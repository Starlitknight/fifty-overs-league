import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { makeEngine } from './engine-vm.mjs';

/* The tuning model now lives IN the engine (foTuneDist / foTurnsAway /
 * FO_TUNE) — these tests exercise it through the shipped build. */
const eng = makeEngine();
const call = (expr) => JSON.parse(vm.runInContext(`JSON.stringify(${expr})`, eng.ctx));

const DIST = JSON.stringify({
  dot: 0.36, 1: 0.28, 2: 0.08, 3: 0.01, 4: 0.10, 6: 0.03,
  wide: 0.03, noball: 0.005, bye: 0.005, legbye: 0.01,
  wC: 0.055, wB: 0.017, wLBW: 0.010, wRO: 0.006, wST: 0.002
});
const base = JSON.parse(DIST);
const sum = e => Object.values(e).reduce((a, b) => a + b, 0);
const tune = (bat, bowl, ph, intent, pitch, field, over) =>
  call(`foTuneDist(${DIST}, ${JSON.stringify(bat)}, ${JSON.stringify(bowl)}, '${ph}', ${intent}, '${pitch}', '${field}', ${over})`);
const RHB = { hand: 'R' }, LHB = { hand: 'L' };
const OB = { bowlType: 'fingerSpin', hand: 'R' };
const SLA = { bowlType: 'fingerSpin', hand: 'L' };
const LEG = { bowlType: 'wristSpin', hand: 'R' };
const RFM = { bowlType: 'fastMedium', hand: 'R' };

test('tuned distribution stays normalized', () => {
  const e = tune(RHB, OB, 'mid', 1, 'dry', 'bal', 42);
  assert.ok(Math.abs(sum(e) - 1) < 1e-9);
  for (const k in e) assert.ok(e[k] >= 0);
});

test('turnsAway geometry matches cricket', () => {
  const ta = (bowl, bat) => call(`foTurnsAway(${JSON.stringify(bowl)}, ${JSON.stringify(bat)})`);
  assert.equal(ta(OB, RHB), false);
  assert.equal(ta(OB, LHB), true);
  assert.equal(ta(SLA, RHB), true);
  assert.equal(ta(LEG, RHB), true);
  assert.equal(ta(LEG, LHB), false);
  assert.equal(ta(RFM, RHB), false);
});

test('spin turning away hunts the edge; turning in hunts the pads', () => {
  const away = tune(RHB, SLA, 'mid', 1, 'balanced', 'bal', 20);
  const into = tune(RHB, OB, 'mid', 1, 'balanced', 'bal', 20);
  assert.ok(away.wC > base.wC);
  assert.ok(into.wLBW > base.wLBW);
  assert.ok(into.wC < base.wC);
});

test('field x intent: spread field smothers boundaries against a slogger', () => {
  const smothered = tune(RHB, RFM, 'death', 2, 'balanced', 'def', 44);
  assert.ok(smothered['4'] < base['4']);
  assert.ok(smothered['2'] > base['2']);
  const edged = tune(RHB, RFM, 'pp', 1, 'balanced', 'att', 4);
  assert.ok(edged.wC > base.wC);
});

test('kill switch restores the stock distribution', () => {
  eng.setTuning(false);
  const off = tune(RHB, OB, 'mid', 1, 'dry', 'bal', 20);
  assert.deepEqual(off, base);
  eng.setTuning(true);
});
