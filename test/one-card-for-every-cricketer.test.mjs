// test/one-card-for-every-cricketer.test.mjs — A PLAYER PAGE IS A PLAYER PAGE,
// whoever the cricketer plays for.
//
// The game had two of them, and which one a man opened in was decided by the
// LINK rather than by who he was. A player's address is written in two
// dialects - "?c=&s=&n=" from the feed, the market, a club page, the stats
// centre; a bare "?n=" from a scorecard, the orders, the gazette - and the
// page forked on which one it got. So one Essex batsman opened in the full
// card and the next in a thinner one, with no rule a reader could see.
//
// The bare form was worse than inconsistent. It resolved through the local
// index only, so every cricketer on earth who was not yours dead-ended on
// "No club on the books carries that name" - measured against the live world
// before this was fixed:
//
//   #/player?c=eng&s=0&n=Reuben Ainsworth  -> a card
//   #/player?n=Reuben Ainsworth            -> no such man
//
// There is one builder now, and the club in the address is a hint about WHERE
// TO LOOK rather than a different page. Everything a rival's man is shown
// comes through __foCardToPlayer - the same door this device's own adopted
// squad arrives by - so the rooms below read him without knowing where he came
// from, and the ones that would be a trespass stay gated on whether he is
// yours.
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { makeEngine } from './engine-vm.mjs';

const eng = makeEngine();
const W = eng.ctx.window || eng.ctx;

// a cricketer exactly as world_squads publishes him: the public card, no
// facets - this is Ellis Lowe of Essex, off the live world
const CARD = {
  age: 28, exp: 'expert', nat: 'England', ovr: 94, pid: 'g1rm9pn4-6',
  bowl: 'Does not bowl', form: 'strong', hand: 'L', name: 'Ellis Lowe',
  role: 'wicketkeeper', type: 'none', wage: 1897, value: 102500, keeper: true,
  rating: 45864, batting: 56, bowling: 2, fielding: 57, keeping: 84,
  talents: ['busyRunner'], fatigue: 'energetic',
  mile: [{ d: 7, k: 'debut', r: 1, s: 1, txt: 'Made his league debut', intl: false },
         { d: 7, k: 'fifty', r: 1, s: 1, txt: 'Maiden league fifty: 75 off 86', intl: false }],
  career: { m: 2, hs: 75, inns: 2, runs: 77, wkts: 0, balls: 97, h50: 1, f4: 4, f6: 1 }
};

test('a served card becomes a player the whole page can read', () => {
  const p = W.__foCardToPlayer(CARD);
  assert.ok(p, 'the card converts');
  // the hero
  assert.equal(p.name, 'Ellis Lowe');
  assert.equal(p.hand, 'L');
  assert.equal(p.btLabel, 'Does not bowl', 'the eyebrow can say what he bowls');
  assert.equal(p.formWord, 'strong');
  assert.equal(p.expWord, 'expert');
  assert.equal(p.fatigue, 'energetic');
  assert.equal(p.wage, 1897);
  assert.equal(p.value, 102500);
  // the rooms
  assert.ok(p.skills && p.skills.vsPace > 0, 'the scout row has figures to draw');
  assert.equal(p.career.m, 2, 'and the record table has a league book');
  assert.deepEqual(p.talents, ['busyRunner'], 'and the talents room knows what he has');
});

// THE TWO THINGS THAT WERE DROPPED ON THE WAY THROUGH. The Story room reads a
// man's milestones and nothing else, so a rival's page opened on "nothing on
// his sheet yet" for a cricketer with three; and the international star is
// matched by id, so an unstarred card was an England player wearing no mark.
test('his id and his milestones survive the crossing', () => {
  const p = W.__foCardToPlayer(CARD);
  assert.equal(p.pid, 'g1rm9pn4-6', 'the id is how two men of one name are told apart');
  assert.equal((p.mile || []).length, 2, 'and his moments are his story');
  assert.equal(p.mile[1].txt, 'Maiden league fifty: 75 off 86');
  // and the card is a copy, not the world's own array
  p.mile.push({ txt: 'not his' });
  assert.equal(CARD.mile.length, 2, 'the served row is not written through');
});

test('an engine player passes through untouched, facets and all', () => {
  const real = { name: 'Someone Real', skills: { vsPace: 71, vsSpin: 64 } };
  assert.equal(W.__foCardToPlayer(real), real, 'a man who already has facets is not re-made');
  assert.equal(W.__foCardToPlayer(null), null);
  assert.equal(W.__foCardToPlayer({}), null, 'and a nameless card is nobody');
});

// The published figures are the world's word and must come back exactly - a
// card man standing beside a full one in the same table cannot disagree with
// himself by a point.
test('the published figures are reproduced to the number', () => {
  const p = W.__foCardToPlayer(CARD);
  const sk = p.skills;
  const bat = Math.round(.25 * sk.vsPace + .25 * sk.vsSpin + .2 * sk.rotation +
                         .15 * sk.temperament + .15 * sk.power);
  const field = Math.round((sk.fielding + sk.catching) / 2);
  const keep = Math.round((sk.keeping + sk.stumping + sk.catching) / 3);
  assert.equal(bat, CARD.batting, 'his batting is his batting');
  assert.equal(field, CARD.fielding, 'his fielding is his fielding');
  assert.equal(keep, CARD.keeping, 'and the gloves are the gloves');
  assert.equal(p.field, sk.fielding, 'and the number the ball engine fields with is set');
});

// ---- and only one builder ships ---------------------------------------------
// The second renderer is gone rather than left unreachable: a page nobody
// routes to is a page nobody maintains, and it was two hundred lines of a
// cricketer's card drifting quietly out of step with the real one.
test('the shipped game has one player card and one only', () => {
  const src = readFileSync(new URL('../engine/src/league/41-player-page.js', import.meta.url), 'utf8');
  assert.equal(/\bbuildCard\b/.test(src), false, 'the rival-only renderer is deleted, not orphaned');
  assert.equal(/\bCARD_TAB\b/.test(src), false, 'and so is the tab state it kept');
  assert.equal((src.match(/fo-pp-tabs'>/g) || []).length, 1, 'one tab bar is written');
  // the club in the address is read whichever dialect wrote it
  assert.match(src, /qp\("r"\)\s*\|\|\s*qp\("c"\)/,
    'both dialects name the same country, so both are read');
});
