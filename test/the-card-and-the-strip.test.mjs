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
// THE SECOND is a strip that disagreed with the number printed beside it. A
// manager reads a man's overall on the same row as his stars, so the two have
// to be one opinion: ninety is nine stars, and a cricketer maxed at ninety-nine
// is the ten. The strip is the card over ten now, and the composite is the card
// before its own stretch - fitted over the live world, a pure batter's overall
// is 1.328 x his batting composite - 1.9 (n=1,646).
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
// A STRIP IS THE CARD, OVER TEN. The composite a strip is drawn from is the
// card before world_pk_num's own stretch, so putting it back on the card scale
// needs no anchor anybody has to defend.
const cardToComp = (c, bowl) => bowl ? (c + 0.3) / 1.394 : (c + 1.9) / 1.328;

test('a ninety overall is nine stars, and a maxed cricketer is the ten', () => {
  const S = W.foStarsFor;
  [[50, 5], [70, 7], [80, 8], [90, 9], [99, 10]].forEach(function (pair) {
    assert.equal(S.stars(cardToComp(pair[0], false), false), pair[1],
      'a ' + pair[0] + ' overall bats at ' + pair[1] + ' stars');
    assert.equal(S.stars(cardToComp(pair[0], true), true), pair[1],
      'and bowls at ' + pair[1] + ' stars');
  });
});

test('the strip reads the same ladder as the card, both ends', () => {
  const S = W.foStarsFor;
  assert.equal(S.stars(-50), 0, 'it floors at nought');
  assert.equal(S.stars(1000), 10, 'and tops out at ten');
  // and the card it is built on never runs past the card's own ceiling
  assert.ok(S.card(1000, false) <= 99 && S.card(1000, true) <= 99);
  assert.ok(S.card(-50, false) >= 0);
});

// the live world, measured off world_squads: batting composites run median
// 35.0, p95 52.9, best 62.2; bowling median 39.0, p95 59.6, best 75.4
test('an ordinary cricketer sits mid-strip and a great one near the top', () => {
  const S = W.foStarsFor;
  assert.ok(S.stars(35.0) >= 4 && S.stars(35.0) <= 5.5,
    'the median batsman is middling: ' + S.stars(35.0));
  assert.ok(S.stars(39.0, true) >= 4.5 && S.stars(39.0, true) <= 6,
    'and so is the median bowler: ' + S.stars(39.0, true));
  assert.ok(S.stars(62.2) >= 7.5, 'the best batsman alive is up near the top: ' + S.stars(62.2));
  assert.ok(S.stars(75.4, true) >= 9, 'and the best bowler is at it: ' + S.stars(75.4, true));
});

test('the strip separates a country from a county', () => {
  const S = W.foStarsFor;
  // measured on the live world: the England fifteen average a batting
  // composite of 47.4 against Gloucestershire's 30.5
  const country = S.stars(47.4), county = S.stars(30.5);
  assert.ok(country - county >= 1.5,
    'a national side must look like one: ' + country + ' against ' + county);
});

// A CRAFT STRIP RATES THE CRAFT, NOT THE CRICKETER. A bowler rated 90 overall
// is not a nine-star batsman, and he is not a nine-star bowler either: the 90
// is what the whole man is worth, and neither of his two trades on its own is
// worth all of it. The strips answer the narrower question, each from its own
// skills - which is also why they are steady through a match, because a
// composite is built from p.skills and never from the form-and-fatigue numbers
// the engine works a delivery with.
test('a craft strip rates the craft, so a bowler is no batsman', () => {
  const S = W.foStarsFor;
  // a genuine bowler: fine with the ball, a tail-ender with the bat
  const bowler = { bowlType: 'seamFastMedium',
    skills: { vsPace: 18, vsSpin: 16, rotation: 20, temperament: 25, power: 14,
              wicket: 82, economy: 78, discipline: 74, moveTurn: 80, variation: 70, stamina: 72 } };
  const bat = S.stars(S.bat(bowler), false), ball = S.stars(S.bowl(bowler), true);
  assert.ok(ball >= 8, 'he is a fine bowler: ' + ball + ' stars');
  assert.ok(bat <= 3, 'and no batsman at all: ' + bat + ' stars');
  assert.ok(ball - bat >= 5, 'the two strips are nothing like each other');
});

test('a maxed cricketer is the ten, in whichever craft he maxed', () => {
  const S = W.foStarsFor;
  const maxed = {};
  ['vsPace', 'vsSpin', 'rotation', 'temperament', 'power', 'wicket', 'economy',
   'discipline', 'moveTurn', 'variation', 'stamina'].forEach(k => { maxed[k] = 99; });
  const man = { bowlType: 'seamFastMedium', skills: maxed };
  assert.equal(S.stars(S.bat(man), false), 10, 'ninety-nine with the bat is the ten');
  assert.equal(S.stars(S.bowl(man), true), 10, 'and ninety-nine with the ball is too');
});

// THE STRIP IS THE MAN, NOT THE AFTERNOON. Form, fatigue and the conditions
// move what a cricketer does on the day; they must not move what his card says
// he is, or a strip would flicker ball to ball.
test('form and fatigue do not move a single star', () => {
  const S = W.foStarsFor;
  const base = { bowlType: 'seamFastMedium',
    skills: { vsPace: 60, vsSpin: 58, rotation: 55, temperament: 62, power: 50,
              wicket: 64, economy: 60, discipline: 58, moveTurn: 62, variation: 55, stamina: 60 } };
  const onSong = Object.assign({}, base, { bat: 90, threat: 90, control: 90, formIx: 5, fatN: 0 });
  const spent = Object.assign({}, base, { bat: 20, threat: 20, control: 20, formIx: 1, fatN: 90 });
  assert.equal(S.stars(S.bat(onSong)), S.stars(S.bat(spent)), 'the batting strip does not move');
  assert.equal(S.stars(S.bowl(onSong), true), S.stars(S.bowl(spent), true), 'nor the bowling');
});
