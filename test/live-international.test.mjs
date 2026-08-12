// test/live-international.test.mjs — A WINDOW IS ITS TIES, NOT A NOTICE.
//
// The live scores page met an international window with one line - "Every full
// member is on tour" - which is true of every window ever played and says
// nothing about this one. Nobody could see who was touring whom, which game of
// the three it was, or what the series stood at.
//
// The nations book already carries all of it: the season's calendar, each
// series, the three window rounds it is played over, and its standing. This
// holds the page's reading of that book.
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { makeEngine } from './engine-vm.mjs';

const eng = makeEngine();
const ties = (nb, round) => eng.ctx.foIntlWindowTies(nb, round);
const card = x => eng.ctx.foIntlTieCardHTML(x);

// the world's own book, exactly as the World Service publishes it
const BOOK = {
  windows: [3, 5, 7, 9, 11, 13],
  calendar: {
    seasonNo: 1,
    series: [
      { away: 'bgd', home: 'rsa', host: 'rsa', teams: ['bgd', 'rsa'],
        names: ['Bangladesh', 'South Africa'], title: 'Bangladesh tour of South Africa',
        rounds: [3, 5, 7], series: { of: 3, played: 0, games: [], verdict: null } },
      { away: 'afg', home: 'sco', host: 'sco', teams: ['afg', 'sco'],
        names: ['Afghanistan', 'Scotland'], title: 'Afghanistan tour of Scotland',
        rounds: [3, 5, 7],
        series: { of: 3, played: 1, verdict: 'Scotland lead the series 1-0',
                  games: [{ id: 'nat:d2:g1', round: 3, winner: 'Scotland XI',
                            text: 'Scotland XI win by 4 wickets (9 balls left)' }] } },
      { away: 'ire', home: 'pak', host: 'pak', teams: ['ire', 'pak'],
        names: ['Ireland', 'Pakistan'], title: 'Ireland tour of Pakistan',
        rounds: [9, 11, 13], series: { of: 3, played: 0, games: [], verdict: null } }
    ]
  }
};

test('a window lists the series being played in it, and no others', () => {
  const r3 = ties(BOOK, 3);
  assert.equal(r3.length, 2, 'two tours are in the third window');
  assert.deepEqual(r3.map(x => x.tie.names[0]).sort(), ['Afghanistan', 'Bangladesh']);
  const r9 = ties(BOOK, 9);
  assert.equal(r9.length, 1, 'and one in the ninth');
  assert.equal(r9[0].tie.names[1], 'Pakistan');
  assert.equal(ties(BOOK, 4).length, 0, 'a round nobody tours in has no ties');
  assert.equal(ties(null, 3).length, 0, 'and a book that has not arrived has none either');
});

test('each tie knows which game of the series this is', () => {
  const r5 = ties(BOOK, 5);
  r5.forEach(x => { assert.equal(x.leg, 2, 'the fifth round is the second game'); assert.equal(x.of, 3); });
  ties(BOOK, 7).forEach(x => assert.equal(x.leg, 3, 'and the seventh is the third'));
});

test('a game that has been filed carries its verdict; one that has not says so', () => {
  const [bgd, afg] = ties(BOOK, 3).sort((a, b) => a.tie.names[0] < b.tie.names[0] ? 1 : -1);
  assert.equal(bgd.done, false, 'Bangladesh have not been filed');
  assert.equal(afg.done, true, 'Scotland have');
  const hBgd = card(bgd), hAfg = card(afg);
  assert.match(hBgd, /Out in the middle/, 'the unplayed tie says it is still out there');
  assert.ok(!/win by/.test(hBgd), 'and claims no result');
  assert.match(hAfg, /Scotland XI win by 4 wickets/, 'the played tie carries the umpire\'s words');
  assert.match(hAfg, /Scotland lead the series 1-0/, 'and the series standing beside it');
  [hBgd, hAfg].forEach(h => assert.match(h, /Game \d of 3/, 'which game of the three'));
  // A TIE THE UMPIRE HAS PLAYED OPENS ITS OWN BROADCAST. He banks the
  // ball-by-ball beside the card now, so the tour is followed the way a league
  // round is - the same reader, the same eighteen seconds a delivery.
  assert.match(hAfg, /href='#\/feed\?nat=nat%3Ad2%3Ag1'/, 'the played tie opens the umpire\'s book');
  assert.match(hBgd, /href='#\/nations'/, 'a tie not yet filed has nothing to watch, so it points at the room');
  assert.ok(hAfg.indexOf('Afghanistan') >= 0 && hAfg.indexOf('Scotland') >= 0, 'both nations are named');
});

test('the notice only stands where there is nothing to list', () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..',
    'engine', 'src', 'league', '45-live-scores.js'), 'utf8');
  assert.match(src, /ties3\.length \? ties3\.map\(intlCard\)\.join\(""\)\s*\n?\s*: stageNotice/,
    'the ties are preferred and the old notice is the fallback');
});
