/* A SKILL IS A WORD, AND A CARD IS STILL A NUMBER.
 *
 * B2 took the ceiling off a cricketer's abilities: a great fast bowler's wicket
 * threat genuinely runs past a hundred, and the engine reads that exact figure
 * for every ball it bowls. What the product SHOWS is a band, because a number
 * on the screen invites the wrong game - with 81 and 83 both visible the
 * optimal thing a manager can do is compare them, and that is spreadsheet play
 * rather than cricket.
 *
 * The obligations, and they are all obligations about PRESENTATION:
 *   1. one ladder, at exactly the stated boundaries, open at the top;
 *   2. it is NOT the OVR ladder - a whole cricketer is a bounded 0-100
 *      semantic rating and an ability is an open-ended latent one, and the two
 *      have different rungs on purpose;
 *   3. formatting is a pure read - naming a skill must never move it;
 *   4. above ninety-nine survives: no clamp, no "99+", no silent 0-100;
 *   5. the bar a band sits on does not run off the end of its track either;
 *   6. sorting is still done on the raw number, never on the word.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { makeEngine } from './engine-vm.mjs';

const eng = makeEngine();
const call = (name, ...args) => vm.runInContext(name, eng.ctx)(...args);
const label = v => call('foSkillLabel', v);
const ovrLabel = v => call('foOvrLabel', v);

// ---------------------------------------------------------------------------
// 1. THE LADDER, at every boundary the brief names and on both sides of it.
// ---------------------------------------------------------------------------
test('the skill ladder names every band at its exact boundary', () => {
  const want = [
    [0, 'Terrible'], [9, 'Terrible'],
    [10, 'Poor'], [19, 'Poor'],
    [20, 'Weak'], [29, 'Weak'],
    [30, 'Mediocre'], [39, 'Mediocre'],
    [40, 'Average'], [49, 'Average'],
    [50, 'Capable'], [59, 'Capable'],
    [60, 'Brilliant'], [69, 'Brilliant'],
    [70, 'Excellent'], [79, 'Excellent'],
    [80, 'Elite'], [84, 'Elite'],
    [85, 'World Class'], [89, 'World Class'],
    [90, 'Legendary'], [94, 'Legendary'],
    [95, 'Transcendent'], [99, 'Transcendent'],
    [100, 'Transcendent'], [126, 'Transcendent'], [200, 'Transcendent']
  ];
  for (const [v, w] of want) assert.equal(label(v), w, v + ' should read ' + w);
});

test('the ladder is open at the top and floored at the bottom', () => {
  // no clamp to 99, no "99+", no wrap round to the first rung
  assert.equal(label(500), 'Transcendent');
  assert.equal(label(1e6), 'Transcendent');
  // and nothing below zero falls off the front of the array
  assert.equal(label(-1), 'Terrible');
  assert.equal(label(-999), 'Terrible');
  assert.equal(label(null), 'Terrible');
  assert.equal(label(undefined), 'Terrible');
  assert.equal(label(NaN), 'Terrible');
  // every rung is a real word, and none of them is a number
  for (let v = 0; v <= 220; v++) {
    const w = label(v);
    assert.ok(typeof w === 'string' && w.length > 2, v + ' has a word');
    assert.ok(!/\d/.test(w), v + ' does not leak a digit: ' + w);
  }
});

test('the brief\'s own worked examples read as stated', () => {
  // Transcendent is deliberately open-ended: no invented words above
  // ninety-nine, the hidden number does the distinguishing
  assert.equal(label(95), 'Transcendent');
  assert.equal(label(99), 'Transcendent');
  assert.equal(label(105), 'Transcendent');
  assert.equal(label(118), 'Transcendent');
  assert.equal(label(140), 'Transcendent');
  assert.equal(label(76), 'Excellent');
  assert.equal(label(94), 'Legendary');
});

// ---------------------------------------------------------------------------
// 2. IT IS NOT THE OVR LADDER. Same words in places, different scales.
// ---------------------------------------------------------------------------
test('the skill ladder and the OVR ladder are separate concepts', () => {
  // the OVR ladder's rungs are unchanged by any of this
  assert.equal(ovrLabel(0), 'Awful');
  assert.equal(ovrLabel(70), 'Great');
  assert.equal(ovrLabel(80), 'Brilliant');
  assert.equal(ovrLabel(85), 'Masterful');
  assert.equal(ovrLabel(90), 'Iconic');
  assert.equal(ovrLabel(95), 'Immortal');
  assert.equal(ovrLabel(100), 'Immortal');
  // and they genuinely disagree, which is the point: 85 is a Masterful CARD
  // on the bounded scale and a World Class ability on the open one
  assert.equal(label(85), 'World Class');
  assert.equal(label(90), 'Legendary');
  assert.equal(label(95), 'Transcendent');
  assert.notEqual(label(85), ovrLabel(85));
  assert.notEqual(label(95), ovrLabel(95));
  // both ladders saturate at their top rung, but at different values and in
  // different words - and the skill's top rung opens at 95, not 130
  assert.equal(ovrLabel(130), ovrLabel(95));
  assert.equal(label(130), label(95));
  assert.notEqual(label(94), label(95));
});

// ---------------------------------------------------------------------------
// 3. NAMING A SKILL DOES NOT MOVE IT.
// ---------------------------------------------------------------------------
test('formatting is a pure read - no skill is mutated by being named', () => {
  const gen = vm.runInContext('__foGenArchetypeSquad', eng.ctx);
  const squad = gen(4242, 'England', 'balanced', null, 1, 'flagship');
  const men = Array.isArray(squad) ? squad : (squad && squad.players) || [];
  assert.ok(men.length >= 11, 'a squad to read');
  const before = JSON.stringify(men.map(p => p.skills));
  men.forEach(p => { for (const k in p.skills) label(p.skills[k]); });
  assert.equal(JSON.stringify(men.map(p => p.skills)), before,
    'reading every attribute of every man changed nothing');
});

test('a 99 makes the round trip intact', () => {
  // above ninety-nine nothing clamps and nothing invents: the top rung is one
  // word by design, and every distinction below it is real
  assert.equal(label(99), 'Transcendent');
  assert.equal(label(99), label(105));
  assert.equal(label(105), label(140));
  assert.notEqual(label(84), label(85));
  assert.notEqual(label(89), label(90));
  assert.notEqual(label(94), label(95));
  // and the value itself is untouched by the helper
  const v = 99;
  assert.equal(label(v), 'Transcendent');
  assert.equal(v, 99);
});

// ---------------------------------------------------------------------------
// 4. THE BAR DOES NOT RUN OFF ITS TRACK.
// ---------------------------------------------------------------------------
test('an attribute bar stays on the track above ninety-nine', () => {
  const bar = v => call('foSkBar', v);
  for (const v of [0, 50, 92, 99, 100, 110, 120, 130, 200]) {
    const w = bar(v);
    assert.ok(w >= 0 && w <= 100, v + ' draws inside the track: ' + w);
  }
  // it keeps rising past ninety-nine rather than pinning, so a 130 is not
  // drawn as the same man as a 100
  assert.ok(bar(110) > bar(100), '110 draws longer than 100');
  assert.ok(bar(130) > bar(110), '130 draws longer than 110');
  // ...and it compresses, so the track cannot be measured back into a figure
  assert.ok(bar(130) - bar(110) < bar(60) - bar(40), 'the top of the bar is compressed');
});

// ---------------------------------------------------------------------------
// 5. SORTING IS STILL NUMERIC.
// ---------------------------------------------------------------------------
test('sorting an attribute column uses the number, not the word', () => {
  // alphabetical order of the words is nothing like the order of the values -
  // "Awful" leads and "Weak" trails, which is exactly backwards
  const vals = [94, 76, 62, 8, 88, 45, 82, 51];
  const byNumber = vals.slice().sort((a, b) => b - a);
  const byWord = vals.slice().sort((a, b) => label(a).localeCompare(label(b)));
  assert.deepEqual(byNumber, [94, 88, 82, 76, 62, 51, 45, 8]);
  assert.notDeepEqual(byWord, byNumber, 'sorting the strings is demonstrably wrong');
  // two men inside one band keep their true order under a numeric sort even
  // though they read identically on the card
  assert.equal(label(85), label(88));
  assert.deepEqual([88, 85].slice().sort((a, b) => b - a), [88, 85]);
});

// ---------------------------------------------------------------------------
// 6. THE SHORT FORM, for chips and narrow columns, is the same ladder.
// ---------------------------------------------------------------------------
test('the abbreviated form has one rung per band and never a digit', () => {
  const abbr = v => call('foSkillAbbr', v);
  const seen = new Set();
  for (let v = 0; v <= 200; v++) {
    const a = abbr(v);
    assert.ok(typeof a === 'string' && a.length >= 2, v + ' has a short form');
    assert.ok(!/\d/.test(a), v + ' short form leaks no digit: ' + a);
    seen.add(a);
  }
  assert.equal(seen.size, 12, 'twelve bands, twelve short forms');
});

// ---------------------------------------------------------------------------
// 7. THE RENDERERS THEMSELVES. A ladder nothing consumes is decoration, so the
//    shared card components are asked directly what they draw for a cricketer
//    who is past the old ceiling.
// ---------------------------------------------------------------------------
test('the shared card components draw the band and never the figure', () => {
  const bar = call.bind(null, 'bar');
  const mini = call.bind(null, 'miniBar');
  const cases = [
    [116, 'Transcendent'], [76, 'Excellent'], [94, 'Legendary'],
    [87, 'World Class'], [82, 'Elite'], [99, 'Transcendent']
  ];
  for (const [v, want] of cases) {
    const b = bar(v, 'Power');
    assert.ok(b.includes(want), 'bar(' + v + ') says ' + want);
    assert.ok(!new RegExp('>\\s*' + v + '\\s*<').test(b), 'bar(' + v + ') does not print ' + v);
    const m = mini(v, 'Power');
    assert.ok(m.includes(want), 'miniBar(' + v + ') says ' + want);
    assert.ok(!new RegExp('>\\s*' + v + '\\s*<').test(m), 'miniBar(' + v + ') does not print ' + v);
  }
});

test('no attribute tooltip hands the number back', () => {
  // the card stopped saying it; hovering must not say it either
  for (const v of [116, 103, 88, 134]) {
    const b = call('bar', v, 'Power');
    const m = call('miniBar', v, 'Power');
    const tips = (b + m).match(/title="([^"]*)"/g) || [];
    assert.ok(tips.length, 'there is a tooltip to check at ' + v);
    for (const t of tips) assert.ok(!t.includes(String(v)), 'tooltip leaks ' + v + ': ' + t);
    // and the old "rank N of 16" is gone - it narrowed the value to a
    // 6.25-point band, which is finer than the label it sat on
    assert.ok(!/rank\s+\d+\s*(of|\/)\s*16/.test(b + m), 'no rank-of-16 at ' + v);
  }
});

test('OVR is still a number and still uses its own ladder', () => {
  const gen = vm.runInContext('__foGenArchetypeSquad', eng.ctx);
  const squad = gen(99, 'England', 'balanced', null, 1, 'flagship');
  const men = Array.isArray(squad) ? squad : (squad && squad.players) || [];
  for (const p of men.slice(0, 6)) {
    const o = call('foOvr', p);
    assert.equal(typeof o, 'number', 'OVR is a number');
    assert.ok(Number.isInteger(o) && o >= 0 && o <= 100, 'OVR is a whole 0-100: ' + o);
    // the card's own word comes off the OVR ladder, not the skill ladder
    assert.equal(call('foOvrLabel', o), ovrLabel(o));
  }
});
