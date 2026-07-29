/* test/match-open.test.mjs — a finished match can always be opened.
 *
 * Every screen that lists cricket already played should let you tap it and
 * read what happened. Most could not, because each one worked the match's
 * index out for itself: three near-identical searches, and several screens
 * that printed text you could click all day with nothing behind it.
 *
 * foMatchIx is the single lookup they now share, so it has to cope with every
 * shape a page might be holding: a local result, a served world row (whose
 * rounds count from one where the engine counts from zero), a line out of a
 * player's career written as "Home v Away", or a bare index. And it has to say
 * -1 rather than guess when this device holds no card for the match, so a
 * caller can print plain text instead of a dead link.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEngine } from './engine-vm.mjs';
import vm from 'node:vm';

const { ctx } = makeEngine();
const ev = (s) => vm.runInContext(s, ctx);

/* a season's worth of results in the shape the engine writes them */
const RESULTS = [
  { ix: 0, round: 0, date: 'Sat, 4 Jul', home: 'Somerset', away: 'Lancashire', comp: 'league', result: { winner: 'Somerset', text: 'Somerset win by 40 runs' } },
  { ix: 1, round: 0, date: 'Sat, 4 Jul', home: 'Warwickshire', away: 'Essex', comp: 'league', result: { winner: 'Essex', text: 'Essex win by 5 wickets' } },
  { ix: 2, round: 1, date: 'Sat, 11 Jul', home: 'Essex', away: 'Somerset', comp: 'league', result: { winner: null, text: 'Match tied' } },
  { ix: 3, round: 1, date: 'Sat, 11 Jul', home: 'Lancashire', away: 'Warwickshire', comp: 'league', result: { winner: 'Lancashire', text: 'Lancashire win by 2 runs' } },
  // the same fixture again, a season later: the newest meeting is the one a
  // manager means when no round or date narrows it
  { ix: 4, round: 0, seasonNo: 2, date: 'Sat, 3 Jul', home: 'Somerset', away: 'Lancashire', comp: 'league', result: { winner: 'Lancashire', text: 'Lancashire win by 7 wickets' } },
];
ev(`App.results = ${JSON.stringify(RESULTS)};`);
const ix = (o) => ev(`foMatchIx(${JSON.stringify(o)})`);
const href = (o) => ev(`foMatchHref(${JSON.stringify(o)})`);

test('the lookup and the link helper ship', () => {
  assert.equal(ev('typeof foMatchIx'), 'function');
  assert.equal(ev('typeof foMatchHref'), 'function');
});

test('a local result knows its own index', () => {
  assert.equal(ix(RESULTS[1]), 1);
  assert.equal(ix(RESULTS[3]), 3);
  assert.equal(href(RESULTS[3]), '#/report?i=3');
});

test('a bare index is accepted, and a nonsense one is refused', () => {
  assert.equal(ix(2), 2);
  assert.equal(ix(0), 0);
  assert.equal(ix(99), -1);
  assert.equal(ix(-1), -1);
});

test('two clubs and a round find the match — the served feed’s shape', () => {
  assert.equal(ix({ home: 'Warwickshire', away: 'Essex', round: 0 }), 1);
  assert.equal(ix({ home: 'Essex', away: 'Somerset', round: 1 }), 2);
  // the round has to be right: this pairing exists, but not in round 3
  assert.equal(ix({ home: 'Essex', away: 'Somerset', round: 3 }), -1);
});

test('home and away are not interchangeable', () => {
  // "Essex v Somerset" and "Somerset v Essex" are different fixtures, and
  // opening the wrong one would show the wrong ground, toss and crowd
  assert.equal(ix({ home: 'Essex', away: 'Somerset' }), 2);
  assert.equal(ix({ home: 'Somerset', away: 'Essex' }), -1);
});

test('"Home v Away" from a player’s career resolves too', () => {
  assert.equal(ix({ teams: 'Warwickshire v Essex' }), 1);
  assert.equal(ix({ teams: 'Lancashire v Warwickshire', date: 'Sat, 11 Jul' }), 3);
  assert.equal(ix({ teams: 'Not A Club v Nor This' }), -1);
});

test('the newest meeting wins when nothing narrows it', () => {
  assert.equal(ix({ home: 'Somerset', away: 'Lancashire' }), 4, 'should find the later season');
  assert.equal(ix({ home: 'Somerset', away: 'Lancashire', seasonNo: 2 }), 4);
  // season 1 has no seasonNo on its rows, which the engine treats as season 1
  assert.equal(ix({ home: 'Somerset', away: 'Lancashire', seasonNo: 1 }), 0);
  assert.equal(ix({ home: 'Somerset', away: 'Lancashire', date: 'Sat, 4 Jul' }), 0);
});

test('a match this device never played is refused, not guessed', () => {
  // world cricket from another nation's league: the row is real, the card is
  // not on this device, and the page must render plain text instead of a link
  assert.equal(ix({ home: 'Karachi', away: 'Lahore', round: 2 }), -1);
  assert.equal(href({ home: 'Karachi', away: 'Lahore', round: 2 }), '');
});

test('rubbish in does not throw', () => {
  for (const bad of [null, undefined, {}, { home: 'Somerset' }, { away: 'Essex' }, { teams: '' }, { teams: 'no separator' }, 'x', []]) {
    assert.equal(ix(bad), -1, `${JSON.stringify(bad)} should be -1`);
    assert.equal(href(bad), '');
  }
});

test('an empty career does not throw', () => {
  ev('App.results = [];');
  assert.equal(ix({ home: 'Somerset', away: 'Lancashire' }), -1);
  assert.equal(ix(0), -1);
  assert.equal(href(0), '');
  ev(`App.results = ${JSON.stringify(RESULTS)};`);
});

/* The front door's form beads are also links now, but foHomeForm lives
 * inside its module's closure and is not reachable from here. That wiring is
 * proved in the browser instead (scratchpad results-probe.mjs), which clicks
 * a bead and asserts it lands on the match report. */
