// test/report-agreement.test.mjs — A REPLAY IS THE SAME MATCH OR IT IS NOT.
//
// The World Service does not publish ball-by-ball, so a report rebuilds the
// match from the seed and shows the reconstruction only if it AGREES with the
// banked result. The check compared the umpire's sentence and nothing else,
// and a sentence is a margin rather than a match: "Derbyshire win by 62 runs"
// is true of 279 v 217 and equally true of 246 v 184. A manager read a report
// of the first when the record holds the second - both 62-run wins, one of
// them never played.
//
// Held here: the scoreline the snapshot publishes beside the verdict is part
// of the check, and a replay that missed it by a single run is refused.
import { test } from 'node:test';
import assert from 'node:assert';
import { makeEngine } from './engine-vm.mjs';

const eng = makeEngine();
const agrees = (out, row) => eng.ctx.foMrAgrees(out, row);

// the fixture as the World Service published it
const ROW = {
  id: 'eng:s1:r2:h8a14', round: 2, home: 'Mashed Potatoes', away: 'Derbyshire',
  hs: { r: 184, w: 10, ov: '41.3' }, as: { r: 246, w: 10, ov: '45.1' },
  winner: 'Derbyshire', text: 'Derbyshire win by 62 runs'
};
const card = (hr, hw, hb, ar, aw, ab, text) => ({
  result: { text: text || ROW.text, winner: 'Derbyshire' },
  innings: [
    { batTeam: 'Derbyshire', bowlTeam: 'Mashed Potatoes', runs: ar, wkts: aw, legal: ab },
    { batTeam: 'Mashed Potatoes', bowlTeam: 'Derbyshire', runs: hr, wkts: hw, legal: hb }
  ]
});
// 41.3 overs = 249 balls, 45.1 = 271
const TRUE_MATCH = card(184, 10, 249, 246, 10, 271);

test('the match that was actually played agrees', () => {
  assert.equal(agrees(TRUE_MATCH, ROW), true);
});

test('a different afternoon with the same margin is refused', () => {
  // the replay a manager was shown: 279 for 7 against 217 all out. Sixty-two
  // runs, the same verdict to the word, and not this match.
  const other = card(217, 10, 261, 279, 7, 300);
  assert.equal(String(other.result.text), String(ROW.text), 'the sentences are identical');
  assert.equal(agrees(other, ROW), false, 'and the scorelines are not');
});

test('one run out is out', () => {
  assert.equal(agrees(card(184, 10, 249, 247, 10, 271), ROW), false, 'a run adrift');
  assert.equal(agrees(card(184, 9, 249, 246, 10, 271), ROW), false, 'a wicket adrift');
  assert.equal(agrees(card(184, 10, 250, 246, 10, 271), ROW), false, 'a ball adrift');
});

test('a different verdict is still refused, scorelines or not', () => {
  assert.equal(agrees(card(184, 10, 249, 246, 10, 271, 'Derbyshire win by 5 wickets'), ROW), false);
});

test('a snapshot with no scorelines falls back to the verdict alone', () => {
  const old = { home: ROW.home, away: ROW.away, text: ROW.text };
  assert.equal(agrees(card(217, 10, 261, 279, 7, 300), old), true,
    'it is all there is, and it is what the check has always done');
  assert.equal(agrees(card(217, 10, 261, 279, 7, 300, 'Derbyshire win by 9 runs'), old), false);
});

test('a replay missing one of the sides is refused', () => {
  const half = { result: { text: ROW.text }, innings: [TRUE_MATCH.innings[0]] };
  assert.equal(agrees(half, ROW), false);
  assert.equal(agrees(null, ROW), false);
  assert.equal(agrees(TRUE_MATCH, null), false);
});
