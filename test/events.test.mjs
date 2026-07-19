import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { makeEngine } from './engine-vm.mjs';

/* P2 structured ball events: the engine names where each ball went against
 * the posted field; commentary consumes the same event. These tests lock
 * the invariants on a full shipped-build match. */
const eng = makeEngine();

const scan = vm.runInContext(`
(function (pitch, seed) {
  onMatchEnd = function () {};
  M = newMatch(GD.teams[0], GD.teams[1], pitch, seed);
  M.meta = { home: GD.teams[0].name, away: GD.teams[1].name, pitch: pitch, weather: 'Sunny', comp: 'vm', isUser: false };
  M.isUserMatch = false; M.ordersMap = {};
  App.tossState = { stage: 'x' };
  applyToss(aiTossDecision());
  var g = 0;
  while (M && !M.done && g++ < 3000) { autoPick(); stepBall(); }
  var LBLS = {};
  Object.keys(FO_FIELDS).forEach(function (k) { FO_FIELDS[k].forEach(function (t) { if (t[2]) LBLS[t[2]] = 1; }); });
  var labels = Object.keys(LBLS).sort(function (a, b) { return b.length - a.length; });
  var rows = [];
  for (var i = M.log.length - 1; i >= 0; i--) {
    var L = M.log[i];
    if (!L || !L.no) continue;
    var mentioned = [];
    var t = (L.txt || '').toLowerCase();
    labels.forEach(function (lb) { if (t.indexOf(lb) >= 0 && mentioned.indexOf(lb) < 0) {
      // avoid double-counting substrings of an already-found longer label
      if (!mentioned.some(function (m2) { return m2.indexOf(lb) >= 0; })) mentioned.push(lb);
    } });
    rows.push({ out: L.out, pos: L.ev ? L.ev.pos : undefined,
      posted: L.ev ? L.ev.ring.concat(L.ev.deep, L.ev.hasSlip ? ['slip'] : [], L.ev.hasShortLeg ? ['short leg'] : [], ['silly point']) : [],
      mentioned: mentioned });
  }
  return JSON.stringify(rows);
})`, eng.ctx);

const rows = JSON.parse(scan('balanced', 424242));

test('every ball entry carries a structured event', () => {
  assert.ok(rows.length > 400, 'match too short');
  const withEv = rows.filter(r => r.pos !== undefined);
  assert.ok(withEv.length === rows.length, 'some balls missing ev');
});

test('event positions are always genuinely posted fielders', () => {
  for (const r of rows) {
    if (r.pos) assert.ok(r.posted.indexOf(r.pos) >= 0, r.out + ': ' + r.pos + ' not posted (' + r.posted.join('|') + ')');
  }
});

test('commentary never names a fielder who is not posted', () => {
  for (const r of rows) {
    for (const m of r.mentioned) {
      assert.ok(r.posted.indexOf(m) >= 0, r.out + ': commentary says "' + m + '" but posted are ' + r.posted.join('|'));
    }
  }
});

test('most in-play balls carry a position', () => {
  const inPlay = rows.filter(r => ['dot', '1', '2', '3', '4', '6', 'wC', 'wRO'].indexOf(r.out) >= 0);
  const withPos = inPlay.filter(r => r.pos);
  assert.ok(withPos.length / inPlay.length > 0.9, 'only ' + withPos.length + '/' + inPlay.length + ' have positions');
});
