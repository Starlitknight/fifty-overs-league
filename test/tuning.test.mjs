import test from 'node:test';
import assert from 'node:assert/strict';
import { makeSandbox } from './sandbox.mjs';

const sb = makeSandbox();
const T = sb.FOC.engineTuning;

// a plausible engine distribution to reshape
function dist() {
  return {
    dot: 0.36, '1': 0.28, '2': 0.08, '3': 0.01, '4': 0.10, '6': 0.03,
    wide: 0.03, noball: 0.005, bye: 0.005, legbye: 0.01,
    wC: 0.055, wB: 0.017, wLBW: 0.010, wRO: 0.006, wST: 0.002
  };
}
const sum = e => Object.values(e).reduce((a, b) => a + b, 0);
const RHB = { hand: 'R' }, LHB = { hand: 'L' };
const OB = { bowlType: 'fingerSpin', hand: 'R' };   // off-spin
const SLA = { bowlType: 'fingerSpin', hand: 'L' };  // left-arm orthodox
const LEG = { bowlType: 'wristSpin', hand: 'R' };   // leg-spin
const RFM = { bowlType: 'fastMedium', hand: 'R' };

test('tuned distribution stays normalized', () => {
  const e = T.tune(dist(), RHB, OB, 'mid', 1, 'dry', 'bal', 42, 1);
  assert.ok(Math.abs(sum(e) - 1) < 1e-9);
  for (const k in e) assert.ok(e[k] >= 0);
});

test('turnsAway geometry matches cricket', () => {
  assert.equal(T.turnsAway(OB, RHB), false);   // off-spin into the right-hander
  assert.equal(T.turnsAway(OB, LHB), true);    // off-spin away from the lefty
  assert.equal(T.turnsAway(SLA, RHB), true);   // SLA away from the right-hander
  assert.equal(T.turnsAway(LEG, RHB), true);   // leg-spin away from the right-hander
  assert.equal(T.turnsAway(LEG, LHB), false);  // leg-spin into the lefty
  assert.equal(T.turnsAway(RFM, RHB), false);  // pace never "turns"
});

test('spin turning away hunts the edge; turning in hunts the pads', () => {
  const base = dist();
  const away = T.tune(dist(), RHB, SLA, 'mid', 1, 'balanced', 'bal', 20, 0);
  const into = T.tune(dist(), RHB, OB, 'mid', 1, 'balanced', 'bal', 20, 0);
  assert.ok(away.wC > base.wC, 'away: caught share rises');
  assert.ok(into.wLBW > base.wLBW, 'in: lbw share rises');
  assert.ok(into.wC < base.wC, 'in: caught share falls');
});

test('dry pitch turns more in the second innings', () => {
  const first = T.tune(dist(), RHB, OB, 'mid', 1, 'dry', 'bal', 20, 0);
  const second = T.tune(dist(), RHB, OB, 'mid', 1, 'dry', 'bal', 20, 1);
  const w = e => e.wC + e.wB + e.wLBW + e.wST;
  assert.ok(w(second) > w(first), 'spin dismissals rise in innings two');
  // pace on dry is untouched by wear
  const pace1 = T.tune(dist(), RHB, RFM, 'mid', 1, 'dry', 'bal', 20, 0);
  const pace2 = T.tune(dist(), RHB, RFM, 'mid', 1, 'dry', 'bal', 20, 1);
  assert.ok(Math.abs((pace2.wB + pace2.wLBW) - (pace1.wB + pace1.wLBW)) < 1e-9);
});

test('green seam fades after innings one', () => {
  const first = T.tune(dist(), RHB, RFM, 'pp', 0, 'green', 'bal', 4, 0);
  const second = T.tune(dist(), RHB, RFM, 'pp', 0, 'green', 'bal', 4, 1);
  assert.ok(second.wC < first.wC);
  assert.ok(second['4'] > first['4']);
});

test('field x intent: spread field smothers boundaries against a slogger', () => {
  const base = dist();
  const smothered = T.tune(dist(), RHB, RFM, 'death', 2, 'balanced', 'def', 44, 1);
  assert.ok(smothered['4'] < base['4']);
  assert.ok(smothered['2'] > base['2']);
  const edged = T.tune(dist(), RHB, RFM, 'pp', 1, 'balanced', 'att', 4, 0);
  assert.ok(edged.wC > base.wC, 'attacking field vs attacking bat: edges carry');
});

test('install is a no-op without an engine and idempotent with one', () => {
  // sandbox has no window.ballDist
  assert.equal(T.install(), false);
  sb.sandbox.window.ballDist = function () { return dist(); };
  assert.equal(T.install(), true);
  assert.equal(sb.sandbox.window.ballDist.__foTuned, true);
  const once = sb.sandbox.window.ballDist;
  assert.equal(T.install(), true);
  assert.equal(sb.sandbox.window.ballDist, once, 'second install does not re-wrap');
  // kill switch returns the stock distribution
  sb.sandbox.window.__foTuneOff = 1;
  const off = sb.sandbox.window.ballDist({ hand: 'R' }, OB, 'mid', 10, 1, 0, 'dry', 'bal', 20, {});
  assert.deepEqual(off, dist());
  sb.sandbox.window.__foTuneOff = 0;
  delete sb.sandbox.window.ballDist;
});
