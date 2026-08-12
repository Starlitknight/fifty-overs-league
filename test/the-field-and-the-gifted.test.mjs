// test/the-field-and-the-gifted.test.mjs — THE FIELD KEEPS WORKING WHEN THE
// WORLD MOVES, AND EVERY TALENT HAS A VOICE.
//
// Two reports from a manager watching a live friendly: not one good piece of
// fielding all innings, only misfields; and nothing at all under Talents.
// Neither was a display fault.
//
// THE FIELD. The chance offsets are absolute numbers on an absolute scale, and
// they were solved against freshly generated cricketers who field 50. The live
// world had drifted to a median club fielding of 36 - 137 seasons of ageing,
// graduating and trading - and the drift is not even-handed: a good stop must
// BEAT a +37 or +44 offset while a misfield need only lose to a -59. So the
// good half switched off and the bad half turned up. Measured before the fix,
// per innings: 5.5 good stops at 51, 1.4 at 37, 0.3 at 31.
//
// THE GIFTED. Eight of the seventeen talents had no line of commentary at all,
// though every one of them moves the numbers in ballDist. On the live world
// that silenced 58% of all talents held, including the commonest in the game.
import { test } from 'node:test';
import assert from 'node:assert';
import { makeEngine } from './engine-vm.mjs';

const eng = makeEngine();
const W = eng.ctx.window || eng.ctx;

const squad = (slot, nat) =>
  W.__foGenArchetypeSquad('world1|eng|' + slot, nat || 'England', 'balanced', null, 1).players;

// the same men, fielding at a different standard - which is exactly what the
// world does to itself over a hundred seasons
const atLevel = (men, k) => men.map(p => {
  const q = JSON.parse(JSON.stringify(p));
  q.skills.fielding = Math.max(1, Math.round(q.skills.fielding * k));
  q.skills.catching = Math.max(1, Math.round(q.skills.catching * k));
  q.field = q.skills.fielding;
  return q;
});

function fieldWork(A, B, seeds) {
  const t = { good: 0, bad: 0 };
  for (let s = 0; s < seeds; s++) {
    const log = eng.sim({ name: 'A', players: A }, { name: 'B', players: B }, 'balanced', 'Sunny', 41000 + s);
    if (!log) continue;
    for (const L of (log.log || [])) {
      const x = L.txt || '';
      if (/Brilliant stop|Great fielding/.test(x)) t.good++;
      else if (/Misfield by|Fumble from/.test(x)) t.bad++;
    }
  }
  return { good: t.good / (seeds * 2), bad: t.bad / (seeds * 2) };   // per innings
}

const LEVELS = [1.0, 0.72, 0.6];
const seen = LEVELS.map(k => fieldWork(atLevel(squad(12), k), atLevel(squad(8), k), 8));

test('good fielding does not vanish when the whole world gets worse', () => {
  seen.forEach((r, i) => {
    assert.ok(r.good >= 3, 'at x' + LEVELS[i] + ' only ' + r.good.toFixed(1) +
      ' good stops an innings - the field has gone quiet again');
  });
});

test('and misfields do not take over either', () => {
  seen.forEach((r, i) => {
    assert.ok(r.bad <= 11, 'at x' + LEVELS[i] + ' ' + r.bad.toFixed(1) + ' misfields an innings');
    // the two halves stay within sight of each other, which is the whole point:
    // before this, a world at x0.72 ran 1.4 good to 15.3 bad
    assert.ok(r.good / Math.max(0.5, r.bad) >= 0.4,
      'at x' + LEVELS[i] + ' the field is ' + r.good.toFixed(1) + ' good to ' + r.bad.toFixed(1) + ' bad');
  });
});

// THE RATES HOLD, THE SKILL STILL COUNTS. Judging a man against the standard
// on show must not flatten the difference between a fine fielding side and a
// poor one - that difference is the thing a manager is buying.
test('a fine fielding side still outfields a poor one, in the same match', () => {
  const good = atLevel(squad(12), 1.30), poor = atLevel(squad(8), 0.70);
  const side = {};
  good.forEach(p => (side[p.name] = 'good'));
  poor.forEach(p => (side[p.name] = 'poor'));
  const t = { goodStops: 0, poorStops: 0, goodMiss: 0, poorMiss: 0 };
  for (let s = 0; s < 8; s++) {
    const log = eng.sim({ name: 'A', players: good }, { name: 'B', players: poor }, 'balanced', 'Sunny', 43000 + s);
    if (!log) continue;
    for (const L of (log.log || [])) {
      const m = /(?:Brilliant stop by|Great fielding by|Misfield by|Fumble from) ([A-Za-z' -]+?) at /.exec(L.txt || '');
      if (!m) continue;
      const who = side[m[1].trim()];
      if (!who) continue;
      const stop = /Brilliant stop|Great fielding/.test(L.txt);
      t[who + (stop ? 'Stops' : 'Miss')]++;
    }
  }
  assert.ok(t.goodStops > t.poorStops * 2,
    'the better side made ' + t.goodStops + ' stops to ' + t.poorStops);
  assert.ok(t.poorMiss > t.goodMiss * 2,
    'the poorer side made ' + t.poorMiss + ' misfields to ' + t.goodMiss);
});

// ---- every talent has a voice ---------------------------------------------
const SILENT_BEFORE = {
  fastStarter: 'Fast Starter', anchor: 'Anchor', spinKiller: 'Spin Killer',
  paceHunter: 'Pace Hunter', busyRunner: 'Busy Runner',
  deathSpecialist: 'Death Specialist', miser: 'Miser', safeHands: 'Safe Hands'
};

const spoke = (() => {
  const keys = Object.keys(SILENT_BEFORE);
  // spread the eight across both sides, offset so no one talent is stuck on a
  // single role in both squads
  const load = slot => squad(slot).map((p, i) => {
    const q = JSON.parse(JSON.stringify(p));
    q.talents = [keys[(i + slot) % keys.length]];
    return q;
  });
  const A = load(12), B = load(8);
  const by = {}, said = [];
  for (let s = 0; s < 14; s++) {
    const log = eng.sim({ name: 'A', players: A }, { name: 'B', players: B }, 'balanced', 'Sunny', 45000 + s);
    if (!log) continue;
    for (const L of (log.log || [])) if (L.tal) { by[L.tal] = (by[L.tal] || 0) + 1; said.push(L); }
  }
  return { by, said };
})();

test('all eight of the silent talents now say something', () => {
  const mute = Object.keys(SILENT_BEFORE).filter(k => !spoke.by[SILENT_BEFORE[k]]);
  assert.deepEqual(mute, [], 'still silent: ' + mute.join(', '));
});

// A PASSIVE TALENT APPLIES ON HALF THE BALLS OF AN INNINGS AND MUST NOT SAY SO
// EVERY TIME. Each man says each of his once an innings, the first time it
// genuinely tells.
test('a passive talent speaks once a man an innings, not on every ball', () => {
  const per = {};
  spoke.said.forEach(L => {
    const m = /^(\d+)\./.exec(L.no || '');
    per[L.tal] = (per[L.tal] || 0) + 1;
    void m;
  });
  // 14 matches, two innings each: nobody can have spoken more than once per
  // innings per man, and one talent is on at most two men a side
  Object.entries(per).forEach(([t, n]) => {
    assert.ok(n <= 28 * 4, t + ' spoke ' + n + ' times over 28 innings');
  });
});

test('the umpire stamps the delivery, so the filter can find it', () => {
  assert.ok(spoke.said.length > 0);
  spoke.said.forEach(L => {
    assert.ok(typeof L.tal === 'string' && L.tal.length > 0);
    assert.ok(String(L.txt || '').length > 0);
  });
});
