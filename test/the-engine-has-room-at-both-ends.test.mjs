// test/the-engine-has-room-at-both-ends.test.mjs — B1: THE TALENT DOMAIN.
//
// The engine used to be usable only in the middle of its own scale. Measured
// (docs/b1-evidence): a side of mean skill 25 facing one of 70 scored 65.6 and
// lost 9.95 wickets EVERY match, while 85 against 95 came out at 52.3% - a
// coin toss between an international and an all-time great. One end was a
// cliff and the other was dead.
//
// These hold the two bounded terms that fixed it. They are deliberately
// ARITHMETIC tests of the transforms plus a small number of coarse behavioural
// ones: a Monte Carlo win rate needs thousands of matches to resolve five
// points, and a test that asserts one from a few hundred is a test that fails
// on a Tuesday for no reason. So the behavioural assertions are the ones a
// small sample CAN carry - that a weak side is not annihilated, and that the
// ordering never inverts.
import { test } from 'node:test';
import assert from 'node:assert';
import vm from 'node:vm';
import { makeEngine } from './engine-vm.mjs';

const eng = makeEngine();
eng.setTuning(true);
const cal = JSON.parse(vm.runInContext('JSON.stringify(GD.cal)', eng.ctx));

// the two transforms, restated exactly as ballDist computes them
const MMCAP = cal.mismatch_cap > 0 ? cal.mismatch_cap : 2.0;
const STDCAP = cal.standard_cap > 0 ? cal.standard_cap : 1.5;
const mmOf = gap => {
  const over = Math.max(0, Math.abs(gap) - cal.mismatch_free);
  return MMCAP * Math.tanh((over * over / cal.mismatch_scale) / MMCAP);
};
const stdOf = raw => STDCAP * Math.tanh(raw / STDCAP);

// ---- THE MISMATCH IS BOUNDED, AND STILL MONOTONE --------------------------

test('a mismatch grows with the gap, always', () => {
  let last = -1;
  for (let gap = 0; gap <= 80; gap += 2) {
    const v = mmOf(gap);
    assert.ok(v >= last - 1e-12, 'mm fell as the gap grew, at ' + gap);
    assert.ok(Number.isFinite(v), 'mm is not finite at ' + gap);
    last = v;
  }
});

test('but it cannot run away, which is what made the low end a cliff', () => {
  // the shipped term at the gap an international attack reaches against an
  // amateur: 43 points over, squared, over 300
  const unbounded = 43 * 43 / cal.mismatch_scale;
  assert.ok(unbounded > 6, 'the old term really did reach ' + unbounded.toFixed(2));
  assert.ok(mmOf(43 + cal.mismatch_free) < MMCAP * 1.001, 'the new one is capped');
  // and CAL.mismatch_wkt * mm must not be able to swamp a wicket logit whose
  // base sits near -2.7. That was +2.9 - a coin-toss wicket every ball.
  assert.ok(cal.mismatch_wkt * MMCAP < 1.2,
    'a maximal mismatch still moves the wicket logit by ' + (cal.mismatch_wkt * MMCAP).toFixed(2));
});

test('and an ordinary contest passes through it untouched', () => {
  // inside mismatch_free the term is exactly zero, which is what keeps a
  // calibrated league calibrated
  assert.equal(mmOf(cal.mismatch_free - 1), 0);
  assert.equal(mmOf(0), 0);
  // and just beyond it the cap has barely engaged
  const justOver = mmOf(cal.mismatch_free + 15);
  const raw = 15 * 15 / cal.mismatch_scale;
  assert.ok(Math.abs(justOver - raw) / raw < 0.06,
    'a modest mismatch moved more than 6%: ' + justOver.toFixed(3) + ' vs ' + raw.toFixed(3));
});

// ---- THE STANDARD IS BOUNDED, WHICH IS WHERE THE TOP GOT ITS ROOM BACK ----

test('the standard of cricket rises with the standard of cricket', () => {
  let last = -99;
  for (let raw = -3; raw <= 4; raw += 0.1) {
    const v = stdOf(raw);
    assert.ok(v > last, 'std fell as the standard rose, at ' + raw.toFixed(1));
    assert.ok(Number.isFinite(v));
    last = v;
  }
});

test('but elite cricket stops eating the whole outcome budget', () => {
  // at 85 against 85 the raw term reached 3.07 and took 0.77 off the wicket
  // logit on its own, leaving an innings of about three wickets - and a
  // three-wicket innings has no room left for anybody to be better in
  assert.ok(stdOf(3.07) < STDCAP * 1.001);
  assert.ok(cal.standard_wkt * stdOf(3.07) < 0.45,
    'the standard alone still moves the wicket logit by ' +
    (cal.standard_wkt * stdOf(3.07)).toFixed(2));
});

// AND IT IS NOT QUITE "UNTOUCHED", WHICH IS WORTH STATING RATHER THAN HIDING
// BEHIND A LOOSE BOUND. A cap that bites at 3 also bends the curve slightly
// below it: measured, an ordinary standard of 0.5 comes through at 0.49 (-2%)
// and 0.8 at 0.73 (-8.5%). That is a real if small change to ordinary cricket
// and the calibration check is where it shows up - the international and
// flagship first-innings means both stayed inside their frozen tolerance, and
// division two moved on purpose. The bar here is what was MEASURED, so this
// catches the cap being loosened or tightened without anybody noticing.
test('ordinary cricket is bent only slightly by the cap', () => {
  const drift = raw => Math.abs(stdOf(raw) - raw) / raw;
  assert.ok(drift(0.2) < 0.02, 'an ordinary standard moved ' + (drift(0.2) * 100).toFixed(1) + '%');
  assert.ok(drift(0.5) < 0.04, 'a good standard moved ' + (drift(0.5) * 100).toFixed(1) + '%');
  assert.ok(drift(0.8) < 0.10, 'a high standard moved ' + (drift(0.8) * 100).toFixed(1) + '%');
  // and the direction is always downward - the cap can only ever soften
  for (const raw of [0.2, 0.5, 0.8, 2, 3]) assert.ok(stdOf(raw) <= raw);
});

// ---- AND THE CRICKET ITSELF ----------------------------------------------
//
// One coarse behavioural check, at the size a test can afford. The claim is
// not a win rate - it is that a badly outclassed side still plays cricket.
// Before the fix it made 65.6 with all ten down, every time.

function squadAt(baseIx, L, name) {
  return vm.runInContext(`(${function (ix, lvl, nm) {
    var SK = ['vsPace','vsSpin','power','rotation','temperament','wicket','economy',
      'discipline','moveTurn','variation','stamina','fielding','catching','keeping','stumping'];
    var t = JSON.parse(JSON.stringify(GD.teams[ix])); t.name = nm;
    var s = 0, n = 0;
    t.players.forEach(function (p) { SK.forEach(function (k) {
      if (typeof (p.skills || {})[k] === 'number') { s += p.skills[k]; n++; } }); });
    var d = lvl - (n ? s / n : 50);
    t.players.forEach(function (p) { if (!p.skills) return;
      SK.forEach(function (k) { if (typeof p.skills[k] === 'number')
        p.skills[k] = Math.max(1, Math.min(99, Math.round(p.skills[k] + d))); });
      jsDerive(p); });
    return t;
  }.toString()})(${baseIx}, ${L}, ${JSON.stringify(name)})`, eng.ctx);
}
const runMatch = vm.runInContext(`(${function (ta, tb, seed) {
  onMatchEnd = function () {};
  M = newMatch(ta, tb, 'balanced', (seed >>> 0) || 1);
  M.meta = { home: ta.name, away: tb.name, pitch: 'balanced', weather: 'Sunny',
             comp: 'cal', isUser: false, neutral: true };
  M.isUserMatch = false; M.ordersMap = {};
  App.tossState = { stage: 'x' }; applyToss(aiTossDecision());
  var g = 0; while (M && !M.done && g++ < 4000) { autoPick(); stepBall(); }
  if (!M || !M.done) return null;
  var i1 = M.innings[0], i2 = M.innings[1];
  return JSON.stringify({ batFirst: i1.batTeam, s1: i1.runs, wk1: i1.wkts,
    s2: i2 ? i2.runs : null, wk2: i2 ? i2.wkts : null });
}.toString()})`, eng.ctx);

test('an outclassed side is beaten, not annihilated', () => {
  const runs = [], wkts = [];
  for (let i = 0; i < 60; i++) {
    const weak = squadAt(0, 25, 'W'), strong = squadAt(1, 70, 'S');
    const j = runMatch(weak, strong, 4242 + i * 7);
    if (!j) continue;
    const r = JSON.parse(j);
    const first = r.batFirst === 'W';
    runs.push(first ? r.s1 : r.s2); wkts.push(first ? r.wk1 : r.wk2);
    assert.ok(Number.isFinite(r.s1) && r.s1 >= 0, 'a total that is not a number');
    assert.ok(r.wk1 >= 0 && r.wk1 <= 10, 'an impossible wicket count: ' + r.wk1);
  }
  const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
  // it used to be 65.6. The bar is deliberately far below what was measured
  // after the fix (117) so this catches a REGRESSION rather than noise.
  assert.ok(mean(runs) > 90,
    'a level-25 side facing level-70 averaged ' + mean(runs).toFixed(1) + ' - the cliff is back');
  assert.ok(mean(wkts) < 9.99,
    'and lost ' + mean(wkts).toFixed(2) + ' wickets a match - it is all out every time');
});

test('the ball model never produces an impossible number', () => {
  for (const [la, lb] of [[10, 10], [25, 95], [95, 10], [95, 95], [1, 99]]) {
    const j = runMatch(squadAt(0, la, 'A'), squadAt(1, lb, 'B'), 99991);
    assert.ok(j, 'no result at ' + la + ' v ' + lb);
    const r = JSON.parse(j);
    for (const k of ['s1', 'wk1', 's2', 'wk2']) {
      if (r[k] == null) continue;
      assert.ok(Number.isFinite(r[k]), k + ' is not finite at ' + la + ' v ' + lb);
      assert.ok(r[k] >= 0, k + ' is negative at ' + la + ' v ' + lb);
    }
    assert.ok(r.wk1 <= 10 && (r.wk2 == null || r.wk2 <= 10), 'more than ten wickets');
  }
});
