import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { makeEngine } from './engine-vm.mjs';

/* P3b rain + DLS: drizzle can cut the chase short with a Duckworth-Lewis
 * revised target. The plan draw only consumes rand under drizzle, so all
 * non-drizzle golden masters are untouched (the replay suite proves it). */
const eng = makeEngine();
const probe = vm.runInContext(`
(function (seed) {
  onMatchEnd = function () {};
  M = newMatch(GD.teams[0], GD.teams[1], 'balanced', seed);
  M.meta = { home: GD.teams[0].name, away: GD.teams[1].name, pitch: 'balanced', weather: 'Drizzle', comp: 'vm', isUser: false };
  M.isUserMatch = false; M.ordersMap = {};
  App.tossState = { stage: 'x' };
  applyToss(aiTossDecision());
  var g = 0;
  while (M && !M.done && g++ < 3000) { autoPick(); stepBall(); }
  if (!M || !M.done) return JSON.stringify({ done: false });
  var rain = M.log.slice().reverse().find(function (L) { return L && L.mile && /RAIN/.test(L.txt); });
  var i1 = M.innings[0], i2 = M.innings[1];
  return JSON.stringify({ done: true, rained: !!rain, cap: M.rainCap || 300,
    s1: i1 ? i1.runs : 0, i2legal: i2 ? i2.legal : null, i2wkts: i2 ? i2.wkts : null,
    i2runs: i2 ? i2.runs : null, target: M.target, result: !!M.result });
})`, eng.ctx);

test('drizzle matches complete; rain-cut chases respect the cap and revise the target', () => {
  let rained = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const r = JSON.parse(probe(seed));
    assert.ok(r.done, 'seed ' + seed + ' did not finish');
    assert.ok(r.result, 'seed ' + seed + ' has no result');
    if (r.rained) {
      rained++;
      assert.ok(r.cap < 300, 'rain fired but no cap');
      assert.ok(r.i2legal <= r.cap, 'chase exceeded the rain cap');
      assert.ok(r.target >= 1 && r.target <= r.s1 + 1, 'revised target ' + r.target + ' vs S1 ' + r.s1);
      // the chase ended: at the cap, all out, or target reached
      assert.ok(r.i2legal === r.cap || r.i2wkts >= 10 || r.i2runs >= r.target,
        'chase ended for no reason');
    }
  }
  assert.ok(rained >= 2, 'rain never struck across 12 drizzle matches (' + rained + ')');
});
