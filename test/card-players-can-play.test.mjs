// test/card-players-can-play.test.mjs — A PLAYER YOU CAN LOOK AT AND A PLAYER
// YOU CAN PLAY ARE NOT THE SAME OBJECT, AND THE DIFFERENCE WAS SILENT.
//
// The world describes a cricketer two ways. world_my_status hands back the
// engine's own player; world_squads publishes the PUBLIC CARD, and
// __foCardToPlayer is the one door a card comes through. It filled in the
// fifteen skill facets faithfully - aggBat, aggBowl and aggField all give back
// the published figures to the number - and stopped there.
//
// But a generated player carries his skills TWICE: the facets, and a handful
// of flattened numbers hung off the player himself - bat, threat, control,
// field - and those are what every delivery is actually resolved against
// (jsDerive, 00-core). Every consumer of a card player up to now read the
// facets, so nobody noticed the other half was missing.
//
// Then the tour preview handed two card-built sides to the match engine to
// play out its win probability, and this happened:
//
//     South Africa XI 1/0 (300)   Bangladesh XI 1/0 (300)   "Match tied"
//
// Fifty overs each, one run, nobody out. Every ball had been resolved against
// undefined and fallen into a dead bucket. Nothing threw, nothing logged, and
// the bar showed a fifth of its matches as ties - a share the same engine puts
// at one per cent with ordinary squads.
//
// The converter completes the player now. This holds it there.
import { test } from 'node:test';
import assert from 'node:assert';
import vm from 'node:vm';
import { makeEngine } from './engine-vm.mjs';

const eng = makeEngine();
const conv = eng.ctx.window.__foCardToPlayer;
const agg = (p, fn) => {
  eng.ctx.__probeP = p;
  return vm.runInContext(fn + '(__probeP)', eng.ctx);
};

// THE CARD THE WORLD PUBLISHES, built off a real generated squad so the
// figures are the ones a club actually has. This is world_squads' own shape.
const cardOf = p => ({
  name: p.name, age: p.age, role: p.role, hand: p.hand, keeper: !!p.keeper,
  batting: Math.round(agg(p, 'aggBat')), bowling: Math.round(agg(p, 'aggBowl')),
  fielding: Math.round(agg(p, 'aggField')), keeping: Math.round(agg(p, 'aggKeep')),
  type: p.bowlTypeFull || 'none', bowl: p.btLabel, rating: p.rating,
  exp: 'average', form: 'steady', ovr: 60, value: p.value || 0, wage: p.wage || 0
});
const partyOf = (seed, country) =>
  eng.genSquad(seed, country, 'balanced').players.slice(0, 15).map(cardOf).map(conv);

test('a card player carries the figures the ball engine reads, not only the facets', () => {
  const men = partyOf(4242, 'England');
  assert.equal(men.length, 15, 'every card converts');
  men.forEach(p => {
    ['bat', 'field', 'threat', 'control', 'bowl', 'power', 'rotation',
     'temperament', 'vsPace', 'vsSpin', 'keeping'].forEach(k => {
      assert.equal(typeof p[k], 'number', p.name + ' has a numeric ' + k);
      assert.ok(isFinite(p[k]), p.name + "'s " + k + ' is a real number, not NaN');
    });
  });
});

test('and they are jsDerive\'s own formulas, not new ones', () => {
  partyOf(909, 'Australia').forEach(p => {
    const s = p.skills;
    assert.equal(p.bat, Math.round(0.32 * s.vsPace + 0.32 * s.vsSpin + 0.16 * s.rotation + 0.20 * s.temperament),
      p.name + ': bat is the world-gen mapping');
    assert.equal(p.threat, p.bowlType ? s.wicket : 0, p.name + ': threat');
    assert.equal(p.control, p.bowlType ? s.economy : 0, p.name + ': control');
    assert.equal(p.bowl, p.bowlType ? Math.round((p.threat + p.control) / 2) : 0, p.name + ': bowl');
    assert.equal(p.field, s.fielding, p.name + ': field');
    assert.ok(!p.bowlType ? p.threat === 0 && p.control === 0 : true,
      p.name + ' does not bowl, so he threatens nothing');
  });
});

test('what the card publishes still outranks anything re-derived', () => {
  // the rating, the gloves and the bowling label are the world's own word;
  // completing the player must not quietly recompute them
  const src = eng.genSquad(77, 'England', 'balanced').players.find(p => p.keeper)
           || eng.genSquad(77, 'England', 'balanced').players[0];
  const c = cardOf(src);
  const p = conv(c);
  assert.equal(p.rating, c.rating, 'the published rating stands');
  assert.equal(p.keeper, c.keeper, 'and whether he keeps');
  assert.equal(p.btLabel, c.bowl, 'and the label the world wrote for his bowling');
});

test('the published aggregates still come back to the number', () => {
  // the whole point of the converter, and completing the player must not move it
  eng.genSquad(31337, 'England', 'balanced').players.slice(0, 11).forEach(src => {
    const c = cardOf(src), p = conv(c);
    assert.equal(Math.round(agg(p, 'aggBat')), c.batting, c.name + ': batting reproduces');
    // only for a man who actually bowls: a non-bowler's bowling figure is not
    // a published figure, it is the absence of one
    if (c.type && c.type !== 'none') {
      assert.equal(Math.round(agg(p, 'aggBowl')), c.bowling, c.name + ': bowling reproduces');
    }
    assert.equal(Math.round(agg(p, 'aggField')), c.fielding, c.name + ': fielding reproduces');
    if (c.keeper) assert.equal(Math.round(agg(p, 'aggKeep')), c.keeping, c.name + ': keeping reproduces');
  });
});

// THE ONE THAT WOULD HAVE CAUGHT IT.
test('two sides built from cards play a real match, not fifty overs of nothing', () => {
  const A = { name: 'Card A XI', players: partyOf(1111, 'England') };
  const B = { name: 'Card B XI', players: partyOf(2222, 'Australia') };
  let dead = 0, ties = 0, played = 0;
  for (let i = 0; i < 30; i++) {
    const r = eng.sim(A, B, 'balanced', 'Sunny', (i * 2654435761) >>> 0 || 1);
    assert.ok(r && r.result && r.innings && r.innings[0], 'sim ' + i + ' returns a match');
    played++;
    if (!r.result.winner) ties++;
    r.innings.filter(Boolean).forEach(inn => {
      // the exact failure: a full fifty overs, a handful of runs, nobody out
      if ((inn.runs | 0) <= 5 && (inn.wkts | 0) === 0 && (inn.legal | 0) >= 300) dead++;
      assert.ok((inn.runs | 0) > 40,
        'an innings of cricket, not ' + inn.runs + '/' + inn.wkts + ' off ' + inn.legal + ' balls');
    });
  }
  assert.equal(played, 30, 'all thirty were played');
  assert.equal(dead, 0, 'no innings resolved every ball against nothing');
  // ordinary squads tie about one time in a hundred; the broken build tied a
  // fifth of the time, which is what made the win-probability bar wrong
  assert.ok(ties <= 3, 'ties stay rare, as they are in cricket: ' + ties + ' of 30');
});
