// test/match-ratings-units.test.mjs — ONE CARD, ONE READING OF IT.
//
// The Match ratings panel prints six bars a side and a club figure underneath,
// off the same scorecard. They cut the batting order in different places: the
// bars took one-to-three, four-to-six, seven-down; the club marking
// (teamRatings, engine/src/00-core.js - the one the world rankings stand on)
// takes one-to-three, four-to-seven, eight-down, the way a scorer does.
//
// So a number seven's seventy was THE TAIL on the bars and THE MIDDLE ORDER in
// the figure beneath it. A side whose seven and eight had made the runs read
// as having the best tail in the league - which is what a manager wrote in to
// ask about, having looked at his tail and found nobody in it who could bat.
//
// Two things are held here: the cut is the scorer's, and the bars' two
// implementations - server/ratings.mjs and the client mirror - still give one
// answer. They are copies of each other by design, and a copy is only safe
// while something checks it.
import { test } from 'node:test';
import assert from 'node:assert';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { unitRatings, BAT_CUT, BAT_PAR } from '../server/ratings.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const core = readFileSync(join(ROOT, 'engine', 'src', '00-core.js'), 'utf8');
const mirror = readFileSync(join(ROOT, 'engine', 'src', 'league', '45-ratings.js'), 'utf8');

// the client's own copy of the bars, lifted out of its module and run bare
function liftClientUnits() {
  const at = mirror.indexOf('window.foUnitRatings = function');
  let d = 0, q = null, esc = false, end = -1;
  for (let j = mirror.indexOf('{', at); j < mirror.length; j++) {
    const c = mirror[j];
    if (q) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '/' && mirror[j + 1] === '/') { j = mirror.indexOf('\n', j); continue; }
    if (c === '{') d++; else if (c === '}') { d--; if (!d) { end = j + 1; break; } }
  }
  const cutAt = mirror.indexOf('window.FO_BAT_CUT =');
  const cutEnd = mirror.indexOf(';', mirror.indexOf('window.FO_BAT_PAR'));
  const ctx = vm.createContext({ window: {}, Math, Object, String });
  vm.runInContext('var clamp10 = function (v) { return Math.max(0, Math.min(10, +v.toFixed(1))); };', ctx);
  vm.runInContext(mirror.slice(cutAt, cutEnd) + ';', ctx);
  vm.runInContext(mirror.slice(at, end) + ';', ctx);
  return { fn: vm.runInContext('window.foUnitRatings', ctx), win: vm.runInContext('window', ctx) };
}

const P = n => ({ name: n, bowlType: 'fastMedium' });
const line = (n, r, b, out) => ({ p: P(n), r: r, b: b, f4: 0, f6: 0, out: out || null });
// a real shape: a quiet top three, a middle order that made nearly all of it
// (including the number seven), and one not-out man at eight
const CARD = {
  batTeam: 'Mashed Potatoes', bowlTeam: 'Glamorgan', runs: 233, wkts: 7, legal: 290,
  bat: [line('Lowe', 14, 20, 'run out'), line('Gibbs', 6, 12, 'b A'), line('Foster', 41, 57, 'b B'),
        line('Larkspur', 2, 12, 'lbw b B'), line('Cole', 88, 95, 'c C b D'), line('Hale', 0, 2, 'c D b B'),
        line('Ogden', 71, 78, 'c B b D'), line('Wright', 7, 7, null)],
  bowlers: {}, fielding: {}
};

test('the batting order is cut where a scorer cuts it', () => {
  assert.deepEqual(BAT_CUT.top, [0, 3], 'one to three');
  assert.deepEqual(BAT_CUT.middle, [3, 7], 'four to seven');
  assert.deepEqual(BAT_CUT.tail, [7, 11], 'eight down');
  // and the same cut the club marking uses, read off the engine itself
  assert.match(core, /const g\s*=\s*i<3\?'top':\(i<7\?'mid':'tail'\)/,
    'the engine still cuts 3 / 7, which is where these boundaries came from');
});

test('a number seven belongs to the middle order, not the tail', () => {
  const u = unitRatings(CARD);
  // Ogden's 71 is the middle order's; the tail is the one man at eight
  assert.ok(u.middle > u.tail,
    'the unit that made 161 of 233 should outmark the one that made 7 (middle ' +
    u.middle + ' v tail ' + u.tail + ')');
  // the tail with only the number eight in it cannot reach the top of the scale
  assert.ok(u.tail < 8, 'seven not out off seven balls is not a ten-out-of-ten tail: ' + u.tail);
});

test('the expectations are the engine own, not a second opinion', () => {
  const pars = /\{top:110,mid:95,tail:25\}/.test(core.replace(/\s+/g, ''));
  assert.ok(pars, 'the engine still expects 110 / 95 / 25 from the three units');
  assert.equal(BAT_PAR.top, 110);
  assert.equal(BAT_PAR.middle, 95);
  assert.equal(BAT_PAR.tail, 25);
});

test('the two copies of the bars still give one answer', () => {
  const { fn, win } = liftClientUnits();
  assert.deepEqual(win.FO_BAT_CUT, BAT_CUT, 'both copies cut the order in the same place');
  assert.deepEqual(win.FO_BAT_PAR, BAT_PAR, 'and expect the same of each unit');
  const a = unitRatings(CARD), b = fn(CARD);
  ['top', 'middle', 'tail', 'field', 'overall'].forEach(k => {
    assert.equal(a[k], b[k], 'server and client disagree about ' + k + ': ' + a[k] + ' v ' + b[k]);
  });
});

test('a unit nobody batted in is not marked at all', () => {
  // two down at the close: there is no middle order and no tail to mark, and
  // an unmarked unit must not drag the side's average down
  const two = Object.assign({}, CARD, { wkts: 2, bat: CARD.bat.slice(0, 3) });
  const u = unitRatings(two);
  assert.equal(u.middle, null, 'nobody batted in the middle order');
  assert.equal(u.tail, null, 'nor in the tail');
  assert.ok(u.overall > 0, 'the side is still marked on what it did do');
});
