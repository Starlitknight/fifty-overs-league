/* A SKILL HAS A COLOUR, AND IT IS THE SAME READING AS THE WORD.
 *
 * The bands made a squad honest; they did not make it scannable. Fifteen
 * abilities in one ink at one weight is a paragraph, and a manager looking for
 * the one thing a man is good at had to read all fifteen. So the ladder now
 * carries a ramp: faint at the bottom, strong at the top, and a tint behind the
 * cells so a grid reads as a heat map rather than a wall of words.
 *
 * These are the properties that make it a ramp rather than a set of pretty
 * colours somebody picked, and every one of them was solved for rather than
 * eyeballed. The obligations:
 *
 *   1. ONE LADDER. The rung comes from foSkillIx, the same index the word comes
 *      from, so the colour and the word can never disagree about a cricketer.
 *   2. IT IS LEGIBLE. Every rung is body text somewhere, so every rung clears
 *      WCAG AA on all four grounds the app puts it on - and on its own heat
 *      wash, because the word sits on top of the tint.
 *   3. IT IS SEQUENTIAL. Monotonic in luminance, one hue family. Magnitude has
 *      one direction and the ramp must too; a rainbow, or a red-for-bad
 *      diverging scale, would be saying something the data does not.
 *   4. IT IS NEVER THE ONLY CUE. Colour is redundant with the word, always, and
 *      the weight rises with the rung so the ramp survives greyscale.
 *   5. IT IS OPEN AT THE TOP. B2 took the ceiling off; 130 and 250 have rungs
 *      and colours, and nothing clamps to 99 on the way.
 *   6. ONE DEFINITION. The stylesheet is generated from the same arrays the
 *      inline colours come from, so CSS and JS cannot drift apart.
 *   7. SORTING IS STILL NUMERIC. Painting a column must never turn it into an
 *      alphabetical sort of its labels.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { makeEngine } from './engine-vm.mjs';

const eng = makeEngine();
const get = name => vm.runInContext(name, eng.ctx);
const call = (name, ...args) => get(name)(...args);

const INK = get('FO_SKILL_INK');
const WASH = get('FO_SKILL_WASH');
const FILL = get('FO_SKILL_FILL');
const WEIGHT = get('FO_SKILL_WEIGHT');
const LADDER = get('FO_SKILL_LADDER');

// the four grounds a skill word is actually printed on, taken from the shipped
// sheets: the panel, the cream page, a table header and the row-hover tint
const GROUNDS = { paper: '#FFFEFC', cream: '#F1EEE6', head: '#EFE9D9', hover: '#F4F7F5' };

const lin = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const relLum = hx => {
  const [r, g, b] = [1, 3, 5].map(i => lin(parseInt(hx.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [x, y] = [relLum(a), relLum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// ---------------------------------------------------------------------------
// 1. one ladder
// ---------------------------------------------------------------------------

test('there is exactly one colour per rung of the one ladder', () => {
  for (const [name, ramp] of [['ink', INK], ['wash', WASH], ['fill', FILL], ['weight', WEIGHT]])
    assert.equal(ramp.length, LADDER.length,
      name + ' has a step for every rung and no more');
});

test('the colour is read off the same index as the word', () => {
  // walk the whole open range, not just the boundaries, and demand that the
  // colour changes exactly where the word does and never anywhere else
  let lastWord = null, lastInk = null;
  for (let v = 0; v <= 220; v++) {
    const w = call('foSkillLabel', v), ink = call('foSkillInk', v);
    if (lastWord !== null) assert.equal(ink !== lastInk, w !== lastWord,
      'at ' + v + ' the word and the colour must step together');
    lastWord = w; lastInk = ink;
  }
});

test('the class names the rung, and only the rung', () => {
  for (let i = 0; i < LADDER.length; i++) {
    const floor = LADDER[i][0];
    assert.equal(call('foSkillCls', floor), 'sg' + i);
    assert.equal(call('foSkillCls', floor + 9), 'sg' + i, 'still inside the band');
  }
  // a class is a rung, never a value: 70 and 79 are the same token
  assert.equal(call('foSkillCls', 70), call('foSkillCls', 79));
  assert.notEqual(call('foSkillCls', 79), call('foSkillCls', 80));
});

// ---------------------------------------------------------------------------
// 2. it is legible - the check the ramp was actually solved against
// ---------------------------------------------------------------------------

test('every rung clears WCAG AA on every ground the app prints it on', () => {
  for (let i = 0; i < INK.length; i++)
    for (const [where, bg] of Object.entries(GROUNDS)) {
      const c = contrast(INK[i], bg);
      assert.ok(c >= 4.5, 'rung ' + i + ' (' + LADDER[i][1] + ') on ' + where +
        ' is ' + c.toFixed(2) + ':1, below AA - "faint" is not a licence to be unreadable');
    }
});

test('the word stays legible on top of its own heat wash', () => {
  // the failure this stops: a heat map whose tint darkens as fast as its ink,
  // so the hottest - most interesting - cells are the ones you cannot read
  for (let i = 0; i < INK.length; i++) {
    const c = contrast(INK[i], WASH[i]);
    assert.ok(c >= 4.5, 'rung ' + i + ' on its own wash is ' + c.toFixed(2) + ':1');
  }
});

test('faint really is faint and strong really is strong', () => {
  const lo = contrast(INK[0], GROUNDS.paper), hi = contrast(INK[INK.length - 1], GROUNDS.paper);
  assert.ok(hi > lo * 2.5, 'the top of the ramp must be emphatically louder than the bottom, ' +
    'got ' + lo.toFixed(2) + ' -> ' + hi.toFixed(2));
});

// ---------------------------------------------------------------------------
// 3. it is sequential
// ---------------------------------------------------------------------------

test('all three ramps are monotonic, so the colour never lies about the order', () => {
  for (const [name, ramp] of [['ink', INK], ['wash', WASH], ['fill', FILL]])
    for (let i = 1; i < ramp.length; i++)
      assert.ok(relLum(ramp[i]) < relLum(ramp[i - 1]),
        name + ' step ' + i + ' is not darker than ' + (i - 1) +
        ' - a sequential scale that doubles back is not a scale');
});

test('the wash is a tint and the ink is ink - they are not the same ramp', () => {
  // every wash step is lighter than every ink step: the tint must never be
  // mistakeable for the text, at any pairing of rungs
  const darkestWash = Math.min(...WASH.map(relLum));
  const lightestInk = Math.max(...INK.map(relLum));
  assert.ok(darkestWash > lightestInk,
    'the darkest wash must still be lighter than the lightest ink');
});

// ---------------------------------------------------------------------------
// 4. colour is never the only cue
// ---------------------------------------------------------------------------

test('the weight rises with the rung, so the ramp survives greyscale', () => {
  for (let i = 1; i < WEIGHT.length; i++)
    assert.ok(WEIGHT[i] >= WEIGHT[i - 1], 'weight must not fall as the rung rises');
  assert.ok(WEIGHT[WEIGHT.length - 1] > WEIGHT[0], 'and it must actually rise');
});

test('every render helper prints the word next to the colour', () => {
  // if any of these ever emits a bare swatch, the reading has become
  // colour-only and the page is unusable to a colour-blind manager
  // the INK, not the markup: a bar's width and a rung's class are attributes and
  // are allowed to carry digits, but nothing the manager can read may
  const ink = html => html.replace(/<[^>]*>/g, ' ');
  for (const [v, band] of [[78, 'Great'], [114, 'Immortal']])
    for (const helper of ['bar', 'miniBar', 'sdot', 'meter']) {
      const html = call(helper, v, 'Batting');
      assert.match(html, new RegExp(band), helper + ' must print the band at ' + v);
      assert.match(html, new RegExp('sg' + call('foSkillIx', v) + '\\b'),
        helper + ' must carry the rung class at ' + v);
      assert.match(html, /\bskg\b/, helper + ' must carry the ink hook the rule needs');
      assert.doesNotMatch(ink(html), /\d/,
        helper + ' must not show a figure at ' + v + ': ' + ink(html).trim());
    }
});

// ---------------------------------------------------------------------------
// 5. open at the top
// ---------------------------------------------------------------------------

test('above ninety-nine has colours of its own, and nothing clamps', () => {
  assert.notEqual(call('foSkillCls', 99), call('foSkillCls', 100), 'Masterful is not Iconic');
  for (const v of [100, 110, 120, 130, 175, 250]) {
    const ink = call('foSkillInk', v);
    assert.match(ink, /^#[0-9A-F]{6}$/, v + ' has a real colour');
  }
  // open at the top: everything from 130 up is the last rung, and it does not
  // fall off the end of the array into undefined
  assert.equal(call('foSkillInk', 130), INK[INK.length - 1]);
  assert.equal(call('foSkillInk', 9999), INK[INK.length - 1]);
  assert.equal(call('foSkillCls', 9999), 'sg' + (INK.length - 1));
});

test('the four rungs above the old ceiling are marked as a tier', () => {
  const css = call('foSkillGradeCss');
  // 100+ is what B2 made possible at all, and it is marked categorically - a
  // gilt rule - rather than by breaking the sequential ramp with a new hue
  for (const i of [10, 11, 12, 13]) assert.match(css, new RegExp('\\.skg\\.sg' + i + '\\b'),
    'rung ' + i + ' takes part in the beyond-ninety-nine rule');
  assert.match(css, /border-bottom:1px solid rgba\(192,138,46/, 'and it is the gilt rule');
});

test('rubbish in does not produce a broken colour', () => {
  for (const v of [null, undefined, NaN, -50, '', 'wicket'])
    assert.equal(call('foSkillInk', v), INK[0], String(v) + ' floors at the bottom rung');
});

// ---------------------------------------------------------------------------
// 6. one definition
// ---------------------------------------------------------------------------

test('the stylesheet is generated from the arrays, so it cannot drift', () => {
  const css = call('foSkillGradeCss');
  for (let i = 0; i < INK.length; i++) {
    assert.ok(css.includes('.skg.sg' + i + '{color:' + INK[i]),
      'rung ' + i + ' ink is in the sheet exactly as the array has it');
    assert.ok(css.includes('.skheat.sg' + i + '{background:' + WASH[i]),
      'rung ' + i + ' wash likewise');
    assert.ok(css.includes('.skfill.sg' + i + '{background:' + FILL[i]),
      'rung ' + i + ' fill likewise');
  }
  // and no rung is missing: fourteen of each
  assert.equal((css.match(/\.skg\.sg\d+\{color:/g) || []).length, INK.length);
});

test('the ink rule outranks a class-plus-tag selector', () => {
  // several surfaces style their word element as `.fo-sq-sknum b` or
  // `.fo-pp-bar em`, which beats a single class. The rule therefore names two
  // classes, and every render site carries both.
  const css = call('foSkillGradeCss');
  assert.match(css, /\.skg\.sg0\{color:/, 'two classes, not one');
  assert.doesNotMatch(css, /(^|\})\.sg0\{/, 'and never the bare single-class form');
});

// ---------------------------------------------------------------------------
// 7. sorting is still numeric
// ---------------------------------------------------------------------------

test('colouring a column did not turn its sort alphabetical', () => {
  // "Awful" < "Brilliant" < "Great" alphabetically, which is nothing like the
  // real order. Sorted on the raw number the order is the ladder's.
  const vals = [95, 5, 72, 34, 108, 51];
  const byNumber = vals.slice().sort((a, b) => b - a);
  assert.deepEqual(byNumber, [108, 95, 72, 51, 34, 5]);
  // the rung index is monotonic in the value, which is what makes a numeric
  // sort and a "sort by grade" the same sort
  const rungs = byNumber.map(v => call('foSkillIx', v));
  assert.deepEqual(rungs, rungs.slice().sort((a, b) => b - a));
  // and the labels alone genuinely would have got it wrong
  const byWord = vals.map(v => call('foSkillLabel', v)).sort();
  assert.notDeepEqual(byWord, byNumber.map(v => call('foSkillLabel', v)));
});
