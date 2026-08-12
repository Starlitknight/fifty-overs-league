// test/the-card-and-the-strip.test.mjs — WHAT A SCORECARD SAYS ABOUT WHO DID
// NOT BAT, AND WHAT A STAR STRIP SAYS ABOUT HOW GOOD A MAN IS.
//
// Two reports from an international's card. It listed "undefined" eleven times
// under Did not bat; and a national side - the best fifteen cricketers in a
// whole country - wore the same three and four stars as a second-division
// county pro.
//
// THE FIRST is a shape. An XI is a list of MEN or a list of NAMES depending on
// which book the card came out of: a club's card carries player objects, an
// international's carries the names alone. Reading p.name off a string gives
// undefined, which then passed the "did not bat" test for every man in the XI.
//
// THE SECOND is a ladder that could not be climbed. It put nought at composite
// 15 and ten at 92, and nothing in the game reaches 92: measured across all
// 4,207 cricketers alive, batting composites run p1 3.8, median 35.0, p95
// 52.9, best 62.2, and bowling p1 17.6, median 39.0, p95 59.6, best 75.4. So
// the best batsman in the world wore six stars, the median two and a half, and
// the top four tenths of every strip was dead space. Everybody bunched low on
// the bar, which is exactly why an international and a county pro looked alike.
import { test } from 'node:test';
import assert from 'node:assert';
import { makeEngine } from './engine-vm.mjs';

const eng = makeEngine();
const W = eng.ctx.window || eng.ctx;

// an international innings exactly as world_nat_match serves one: xi is names
const XI = ['Litton Ahmed', 'Rubel Sarkar', 'Afif Rahman', 'Rubel Miah', 'Taskin Ahmed',
  'Mahedi Rahman', 'Nurul Miah', 'Sabbir Sarkar', 'Tamim Ahmed', 'Mehidy Islam', 'Shoriful Islam'];
const intlInnings = {
  batTeam: 'Bangladesh XI', bowlTeam: 'South Africa XI', runs: 279, wkts: 6, legal: 300,
  xi: XI,
  bat: [
    { p: { name: 'Litton Ahmed', skills: {} }, r: 20, b: 30, out: 'c Coetzee b Cloete' },
    { p: { name: 'Mahedi Rahman', skills: {} }, r: 98, b: 90, out: null }
  ],
  bowlers: {}, fow: [], extras: { wd: 7, nb: 0, b: 2, lb: 2 }
};

test('an XI of names still says who did not bat, and never says undefined', () => {
  const html = W.foScorecardCards([intlInnings]) || '';
  assert.ok(html.length > 0, 'the card renders');
  assert.equal((html.match(/undefined/g) || []).length, 0, 'nothing on the card is undefined');
  const m = /Did not bat<\/b><span>([\s\S]*?)<\/span>/.exec(html);
  assert.ok(m, 'the card names the men who did not bat');
  const text = m[1].replace(/<[^>]+>/g, '');
  // the two who batted are not in it; the other nine are
  assert.ok(text.indexOf('Litton Ahmed') < 0, 'a man who batted is not listed');
  assert.ok(text.indexOf('Mahedi Rahman') < 0, 'nor the man who was 98 not out');
  XI.slice(1, 5).forEach(n => assert.ok(text.indexOf(n) >= 0, n + ' is listed'));
});

test('a club XI of player objects reads exactly as it always did', () => {
  const clubInnings = Object.assign({}, intlInnings, { xi: XI.map(n => ({ name: n })) });
  const html = W.foScorecardCards([clubInnings]) || '';
  assert.equal((html.match(/undefined/g) || []).length, 0);
  const m = /Did not bat<\/b><span>([\s\S]*?)<\/span>/.exec(html);
  assert.ok(m && m[1].indexOf('Rubel Sarkar') >= 0);
  assert.ok(m[1].indexOf('Litton Ahmed') < 0);
});

// ---- the strip -------------------------------------------------------------
// The percentiles below are the live world's, measured off world_squads.
const BAT = { p1: 3.8, median: 35.0, p95: 52.9, best: 62.2 };
const BOWL = { p1: 17.6, median: 39.0, p95: 59.6, best: 75.4 };

test('the star ladder spans the world it has to describe', () => {
  const st = W.foStarsFor.stars;
  // the top of the strip is reachable by the men who are actually alive
  assert.ok(st(BAT.best) >= 7, 'the best batsman alive is a seven at least: ' + st(BAT.best));
  assert.ok(st(BOWL.best) >= 8.5, 'and the best bowler is near the top: ' + st(BOWL.best));
  // an ordinary cricketer sits around the middle rather than down in the dust
  assert.ok(st(BAT.median) >= 3.5 && st(BAT.median) <= 5.5,
    'the median batsman is a middling strip: ' + st(BAT.median));
  assert.ok(st(BOWL.median) >= 3.5 && st(BOWL.median) <= 5.5,
    'and so is the median bowler: ' + st(BOWL.median));
  // the bottom is still the bottom
  assert.ok(st(BAT.p1) <= 0.5, 'the worst batsman in the world is no stars: ' + st(BAT.p1));
});

// TEN IS STILL SOMETHING TO EARN. A ladder that hands the best man alive full
// marks has nowhere left to go, and this world trains for a hundred seasons.
test('ten stars is headroom, not the going rate', () => {
  const st = W.foStarsFor.stars;
  assert.ok(st(BAT.best) < 10, 'the best batsman alive has somewhere left to climb');
  assert.ok(st(BOWL.best) < 10, 'and so does the best bowler');
  assert.equal(st(1000), 10, 'the strip still tops out at ten');
  assert.equal(st(-50), 0, 'and floors at nought');
});

test('the strip separates a country from a county', () => {
  const st = W.foStarsFor.stars;
  // measured on the live world: the England fifteen average a batting
  // composite of 47.4 against Gloucestershire's 30.5
  const country = st(47.4), county = st(30.5);
  assert.ok(country - county >= 1.5,
    'a national side must look like one: ' + country + ' against ' + county);
});
