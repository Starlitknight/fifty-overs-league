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
// A STRIP IS A CARD FOR ONE TRADE (B2).
//
// This file used to convert a card into a composite through the two straight
// lines the ladder was fitted with - x1.328 - 1.9 for batting, x1.394 - 0.3 for
// bowling - because a composite lived on the raw skill scale and a card did not,
// and something had to bridge them. Both regressions were fitted against a world
// that has since been redistributed twice.
//
// There is nothing to bridge now. A trade strip is the canonical level for that
// ONE role put through the canonical curve, so it is already a card, and the
// ladder is the same foStars() the card uses. Which gives the identity these
// tests are really about: for a specialist the strip and the card are the SAME
// NUMBER, and the only cricketer allowed to differ is the all-rounder, whose
// card carries a two-sidedness premium neither of his trades earns alone.
test('a strip is the card over ten, and a maxed cricketer is the ten', () => {
  const S = W.foStarsFor;
  [[50, 5], [70, 7], [80, 8], [90, 9], [100, 10]].forEach(function (pair) {
    assert.equal(S.stars(pair[0], false), pair[1],
      'a ' + pair[0] + ' trade card bats at ' + pair[1] + ' stars');
    assert.equal(S.stars(pair[0], true), pair[1],
      'and bowls at ' + pair[1] + ' stars');
  });
});

test('the strip reads the same ladder as the card, both ends', () => {
  const S = W.foStarsFor;
  assert.equal(S.stars(-50), 0, 'it floors at nought');
  assert.equal(S.stars(1000), 10, 'and tops out at ten');
  // the canonical scale runs 0-100, and the strip is on it
  assert.ok(S.card(1000, false) <= 100 && S.card(1000, true) <= 100);
  assert.ok(S.card(-50, false) >= 0);
});

// THE IDENTITY, on real cricketers rather than on numbers a test chose: a
// specialist's trade strip IS his card. This is the claim that the two fitted
// regressions could only ever approximate, and it is the reason they are gone.
test('a specialist wears his own card on his own strip', () => {
  const S = W.foStarsFor;
  let bats = 0, bowls = 0;
  for (let s = 1; s <= 12; s++) {
    for (const p of eng.genSquad(6100 + s, 'England', s % 2 ? 'rock' : 'express').players || []) {
      const card = W.foOvr(p), keeps = !!(p.keeper || p.role === 'wicketkeeper');
      const bowler = !!(p.bowlType && p.bowlType !== 'none');
      if (p.role === 'allRounder' || keeps) continue;
      if (!bowler) {
        bats++;
        assert.equal(S.stars(S.bat(p), false), W.foStars(card),
          p.name + ' bats at his card: strip ' + S.stars(S.bat(p), false) +
          ' vs card ' + W.foStars(card));
      } else {
        bowls++;
        assert.equal(S.stars(S.bowl(p), true), W.foStars(card),
          p.name + ' bowls at his card: strip ' + S.stars(S.bowl(p), true) +
          ' vs card ' + W.foStars(card));
      }
    }
  }
  assert.ok(bats > 40 && bowls > 20, 'both kinds were actually walked (' + bats + '/' + bowls + ')');
});

// and the strip spreads the world out rather than bunching it. Two ladders
// before this failed from opposite ends - one put ten at 92, which nothing
// alive could reach, so the best batsman in the world wore six stars; the
// clamp that replaced it put the median batsman a whole star below his own
// card. The world's cards run p5 33, median 50, p95 62 off the generator.
test('an ordinary cricketer sits mid-strip and a great one near the top', () => {
  const S = W.foStarsFor;
  assert.ok(S.stars(50) >= 4.5 && S.stars(50) <= 5.5,
    'the median cricketer is middling: ' + S.stars(50));
  assert.ok(S.stars(33) >= 3 && S.stars(33) <= 3.5, 'a weak one is low: ' + S.stars(33));
  assert.ok(S.stars(85) >= 8.5, 'a great one is up near the top: ' + S.stars(85));
  assert.ok(S.stars(95, true) >= 9.5, 'and a generational one is at it: ' + S.stars(95, true));
});

test('the strip separates a country from a county', () => {
  const S = W.foStarsFor;
  // an international batting card against a second-division one, on the
  // canonical scale the strip now shares with the card
  const country = S.stars(84), county = S.stars(48);
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
  // a genuine bowler: fine with the ball, a tail-ender with the bat. HE HAS
  // HANDS, which he did not used to need: the canonical model gives fielding
  // 0.45 of an outfielder's mix, so a fixture with no fielding key at all is
  // not a weak cricketer, it is an incomplete one, and it reads three-quarters
  // of a star low for a reason that has nothing to do with what is being tested.
  const bowler = { bowlType: 'seamFastMedium',
    skills: { vsPace: 18, vsSpin: 16, rotation: 20, temperament: 25, power: 14,
              wicket: 82, economy: 78, discipline: 74, moveTurn: 80, variation: 70, stamina: 72,
              fielding: 70, catching: 70 } };
  const bat = S.stars(S.bat(bowler), false), ball = S.stars(S.bowl(bowler), true);
  assert.ok(ball >= 8, 'he is a fine bowler: ' + ball + ' stars');
  assert.ok(bat <= 3, 'and no batsman at all: ' + bat + ' stars');
  assert.ok(ball - bat >= 5, 'the two strips are nothing like each other');
});

test('a maxed cricketer is the ten, in whichever craft he maxed', () => {
  const S = W.foStarsFor;
  const maxed = {};
  // maxed means MAXED - the hands are part of a cricketer, and the canonical
  // model prices them, so a man who is 99 at everything but fielding is not the
  // ten and should not be
  ['vsPace', 'vsSpin', 'rotation', 'temperament', 'power', 'wicket', 'economy',
   'discipline', 'moveTurn', 'variation', 'stamina',
   'fielding', 'catching'].forEach(k => { maxed[k] = 99; });
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

// ---- a talent is set like a named thing -------------------------------------
// The commentary names a talent in the middle of an ordinary sentence - "Rocket
// Arm! Great fielding by ..." - and it read as ordinary prose, which is the one
// thing it is not: it is the reason the ball went the way it did, and the only
// place a manager sees a talent he paid for actually doing something.
test('a talent is marked where the umpire names it', () => {
  const K = W.__foFeedKit;
  const out = K.talTx('Lowe tucks it with soft hands. Rocket Arm! Great fielding by Sebastian Lowe.');
  assert.match(out, /<em class='fd-tal'>Rocket Arm<\/em>/, 'the talent is marked');
  assert.ok(out.indexOf('Sebastian Lowe') >= 0, 'and the rest of the sentence is untouched');
  assert.equal((out.match(/fd-tal/g) || []).length, 1, 'once, not once per word');
});

// HALF THESE NAMES ARE ORDINARY ENGLISH. An umpire who says a batsman "anchors
// the innings" has not named a talent, and a bowler who bowls "a bouncer" has
// not either. The capital is the signal, and it is the engine's own.
test('ordinary English is not mistaken for a talent', () => {
  const K = W.__foFeedKit;
  [
    'He anchors the innings and refuses to be moved.',
    'That is a fine bouncer, and the batter had no answer to it.',
    'A miserly spell from the seamer.',
    'He is the finisher this side has been waiting for, in lower case.'
  ].forEach(line => {
    assert.equal(K.talTx(line).indexOf('fd-tal'), -1, 'not a talent: ' + line);
  });
});

test('the umpire\'s words are escaped before they are marked', () => {
  const K = W.__foFeedKit;
  const out = K.talTx('<script>bad()</script> and the Busy Runner steals two.');
  assert.equal(out.indexOf('<script>'), -1, 'nothing the umpire wrote becomes markup');
  assert.match(out, /&lt;script&gt;/, 'it is shown as the text it is');
  assert.match(out, /<em class='fd-tal'>Busy Runner<\/em>/, 'and the mark is still ours');
});
