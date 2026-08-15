// test/the-engine-has-room-at-both-ends.test.mjs — THE BALL MODEL'S CONTRACT.
//
// The engine used to be usable only in the middle of its own scale. One end was
// a cliff - a side of mean skill 25 facing one of 70 scored 65.6 and lost 9.95
// wickets EVERY match - and the other was dead: 85 against 95 came out a coin
// toss, and a card promising "Power 92" bought nothing at all over one reading
// "Power 70", because every per-man skill term saturated about twenty-five
// points from its mean.
//
// The patches that produced that are gone. There is now ONE softening in the
// ball model and TWO coordinates through it, and these hold that shape:
//
//   RESP(v, span) = span * tanh(v / span)   - bounded, monotone, odd, and the
//                                             identity near the origin
//   rel = RESP( batQ - bowlQ )              - WHO IS BETTER on this delivery
//   std = RESP( (batQ + bowlQ) / 2 )        - WHAT STANDARD this cricket is
//
// WHY MOST OF THESE ARE ARITHMETIC. A Monte Carlo win rate needs thousands of
// matches to resolve five points; a test asserting one from a few hundred fails
// on a Tuesday for no reason. So the transforms are checked exactly, and the
// behavioural assertions are only the coarse ones a small sample can carry -
// that a weak side is not annihilated, that the ordering never inverts, and
// that no delivery ever produces a number that is not a number.
import { test } from 'node:test';
import assert from 'node:assert';
import vm from 'node:vm';
import { makeEngine } from './engine-vm.mjs';

const eng = makeEngine();
eng.setTuning(true);
const cal = JSON.parse(vm.runInContext('JSON.stringify(GD.cal)', eng.ctx));

// the one transform, restated exactly as ballDist computes it
const RESP = (v, span) => (span > 0 ? span * Math.tanh(v / span) : v);

// ---- THE SOFTENING IS THE ONLY ONE, AND IT HAS THE RIGHT SHAPE ------------

test('the relative response is monotone in the gap, everywhere', () => {
  let last = -1e9;
  for (let gap = -90; gap <= 90; gap += 1) {
    const v = RESP(gap, cal.rel_span);
    assert.ok(v >= last - 1e-12, 'the response fell as the gap grew, at ' + gap);
    last = v;
  }
});

test('it is the identity near the origin, so ten points are worth ten points', () => {
  // the old skill_soft was 10, which meant a ten-point difference between two
  // ordinary cricketers arrived as about seven and a twenty-point one as about
  // ten. Near zero this must not shrink anything appreciably, or the middle of
  // the scale goes deaf the way it did before.
  for (const g of [1, 2, 5]) {
    const v = RESP(g, cal.rel_span);
    assert.ok(v > g * 0.9, g + ' points of advantage arrived as only ' + v.toFixed(2));
  }
});

test('but it is bounded, which is what stops the low end being a cliff', () => {
  const huge = RESP(400, cal.rel_span);
  assert.ok(huge <= cal.rel_span + 1e-9,
    'the response ran past its own span: ' + huge);
  assert.ok(RESP(1e6, cal.rel_span) < cal.rel_span + 1e-9, 'and it never runs away');
  assert.ok(Number.isFinite(RESP(1e12, cal.rel_span)), 'nor reaches infinity');
});

test('and it is odd, so it cuts both ways', () => {
  for (const g of [3, 11, 29, 77])
    assert.ok(Math.abs(RESP(g, cal.rel_span) + RESP(-g, cal.rel_span)) < 1e-9,
      'a great batsman against a weak bowler must be worth what the reverse is, at ' + g);
});

test('THERE IS NO DEAD BAND. every extra point buys something, at every level', () => {
  // this is the defect the whole redesign exists to kill: the old mismatch term
  // computed max(0, |gap| - 15), so two cricketers inside fifteen points of each
  // other produced NO relative signal whatsoever.
  for (const base of [-60, -20, 0, 20, 60]) {
    const a = RESP(base, cal.rel_span), b = RESP(base + 1, cal.rel_span);
    assert.ok(b > a, 'one more point bought nothing at gap ' + base);
  }
});

test('the standard term is bounded too, so it cannot eat the outcome budget', () => {
  // its unbounded ancestor reached 3.07 at 85 against 85, which took 0.77 off
  // the wicket logit and pinned an elite innings at under four wickets - so a
  // better batsman had nowhere left to put his extra quality, and THAT was the
  // high-end dead zone, not any coefficient.
  assert.ok(RESP(1e6, cal.std_span) <= cal.std_span + 1e-9, 'the standard ran away');
  let last = -1e9;
  for (let raw = -80; raw <= 80; raw += 1) {
    const v = RESP(raw, cal.std_span);
    assert.ok(v >= last - 1e-12, 'the standard fell as the cricket got better');
    last = v;
  }
});

test('the two coordinates are orthogonal, which is the whole architecture', () => {
  // raise both men equally and REL must not move at all while STD does; raise
  // one and both move. That is the brief in one line - equal rises largely
  // cancel, relative differences keep their signal - and it has to be
  // arithmetic rather than a correction bolted on afterwards.
  const rel = (b, w) => b - w, std = (b, w) => (b + w) / 2;
  for (const lift of [5, 15, 40]) {
    assert.strictEqual(rel(10 + lift, 4 + lift), rel(10, 4),
      'lifting both men moved the contest between them');
    assert.ok(std(10 + lift, 4 + lift) > std(10, 4),
      'lifting both men did not raise the standard');
  }
});

// ---- AND THE SUPERSEDED PATCHES ARE ACTUALLY GONE -------------------------

test('no superseded tuning term survives in the calibration', () => {
  // §18: every major term must have ONE cricket explanation. These are the
  // constants of the layers that were removed - the per-man softening, the
  // mismatch that existed to undo it, and the unbounded standard. If one comes
  // back it is because something was stacked on top of something else again.
  for (const k of ['skill_soft', 'skill_bat', 'skill_threat_wkt', 'skill_rot',
    'skill_control_dot', 'skill_power_six', 'mismatch_free', 'mismatch_pivot',
    'mismatch_scale', 'mismatch_wkt', 'standard_pivot', 'standard_wkt'])
    assert.ok(!(k in cal), 'the superseded constant ' + k + ' is back in GD.cal');
});

test('every skill the card shows has a constant that reads it', () => {
  // §19: no dead displayed skills. Each of these is the coefficient that gives
  // one card attribute its voice; a zero here is a skill that does nothing.
  for (const k of ['rel_wkt', 'rot_dot', 'pow_six', 'tmp_wkt', 'std_wkt',
    'exp_wkt', 'form_step'])
    assert.ok(typeof cal[k] === 'number' && cal[k] !== 0,
      k + ' is missing or zero - a displayed skill has gone silent');
});

// ---- WHAT IT ACTUALLY DOES OVER A MATCH ----------------------------------

const squadAt = (baseIx, L, name) =>
  vm.runInContext(`(${function (ix, lvl, nm) {
    var SK = ['vsPace', 'vsSpin', 'power', 'rotation', 'temperament', 'wicket',
      'economy', 'discipline', 'moveTurn', 'variation', 'stamina',
      'fielding', 'catching', 'keeping', 'stumping'];
    var t = JSON.parse(JSON.stringify(GD.teams[ix]));
    t.name = nm;
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
    s2: i2 ? i2.runs : null, wk2: i2 ? i2.wkts : null,
    winner: M.result ? M.result.winner : null });
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
  // it was 65.6 all out every match before any of this. The bar is deliberately
  // well below what is measured now, so this catches a REGRESSION rather than
  // sampling noise at sixty matches.
  assert.ok(mean(runs) > 85,
    'a level-25 side facing level-70 averaged ' + mean(runs).toFixed(1) + ' - the cliff is back');
  assert.ok(mean(wkts) < 9.99,
    'and lost ' + mean(wkts).toFixed(2) + ' wickets a match - it is all out every time');
});

test('equal sides are level, at the bottom of the scale and at the top', () => {
  // §22 equal-team neutrality. Sixty matches resolves this to about six points,
  // so the band is wide on purpose; what it catches is a systematic tilt, which
  // is what an asymmetric skill term produces and what a fair one cannot.
  for (const L of [30, 55, 80]) {
    let w = 0, n = 0;
    for (let i = 0; i < 60; i++) {
      const flip = i % 2 === 1;
      const A = squadAt(flip ? 1 : 0, L, 'A'), B = squadAt(flip ? 0 : 1, L, 'B');
      const j = runMatch(flip ? B : A, flip ? A : B, 71717 + i * 7919);
      if (!j) continue;
      const r = JSON.parse(j); n++;
      if (r.winner === 'A') w++; else if (!r.winner) w += 0.5;
    }
    const pc = 100 * w / Math.max(1, n);
    assert.ok(pc > 30 && pc < 70,
      'two identical level-' + L + ' sides split ' + pc.toFixed(1) + '% - something favours one of them');
  }
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

test('and it is still deterministic: the same seed is the same match', () => {
  const a = runMatch(squadAt(0, 55, 'A'), squadAt(1, 55, 'B'), 20260814);
  const b = runMatch(squadAt(0, 55, 'A'), squadAt(1, 55, 'B'), 20260814);
  assert.strictEqual(a, b, 'the same fixture on the same seed played out differently');
});
