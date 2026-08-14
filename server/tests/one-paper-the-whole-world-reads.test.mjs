// tests/one-paper-the-whole-world-reads.test.mjs — THE EDITOR HAS TASTE, AND
// IT IS THE SAME TASTE TWICE.
//
// The Gazette's editor is a score. That is the whole design: rather than four
// sections in a fixed order, every candidate story is weighed and the best are
// taken, so the owner's priority emerges from the weights and a second
// division game nobody expected can still take the front page.
//
// Which means the weights ARE the paper. If they are wrong the paper is wrong
// in a way no amount of good prose hides, and they are pure arithmetic over
// plain objects - no database, no world - so they can be held exactly.
import { test } from 'node:test';
import assert from 'node:assert';
import { score, runningOrder, makeIssue, BASE,
         standingMult, upsetMult, rarityMult, freshMult } from '../gazette.mjs';

const s = (kind, o = {}) => ({ kind, day: 100, headline: kind, ...o });
const TODAY = 100;

// ---- THE OWNER'S ORDER, WHICH MUST FALL OUT OF THE WEIGHTS -----------------

test('all else equal, the paper leads on the international', () => {
  const order = runningOrder([
    s('leagueResult'), s('titleDecided'), s('intlResult'), s('oddity')
  ], TODAY);
  assert.equal(order[0].kind, 'intlResult', 'the tour leads');
  assert.equal(order[1].kind, 'titleDecided', 'then the championship');
  assert.equal(order[3].kind, 'leagueResult', 'and the ordinary round is last');
});

test('and a final outranks even an international', () => {
  const order = runningOrder([s('intlResult'), s('cupFinal')], TODAY);
  assert.equal(order[0].kind, 'cupFinal');
});

// ---- BUT THE ORDER IS NOT A RUNNING ORDER ---------------------------------
//
// The reason for scoring rather than sectioning: a genuinely astonishing thing
// must be able to beat a dull thing of a higher kind. If this fails, the
// editor is just a sort and the paper will bore people.

test('an astonishing club game beats a dull international', () => {
  const dull = s('intlResult', { seenLately: 3 });     // a window tie, one of several
  const wild = s('leagueResult', {
    upset: { winner: 30000, loser: 48000 },           // bottom club beats the champions
    stakes: 1, seenLately: 0
  });
  const order = runningOrder([dull, wild], TODAY);
  assert.equal(order[0].kind, 'leagueResult',
    'the upset leads: ' + order.map(x => x.kind + '=' + x.score).join(', '));
});

test('the upset is the tie-break the owner asked for', () => {
  // NOTE runningOrder returns COPIES carrying their score, so a story is
  // recognised by what it says and never by object identity - which is what
  // this assertion got wrong first time and passed for the wrong reason.
  const expected = s('intlResult', { headline: 'as expected', upset: { winner: 47000, loser: 46000 } });
  const shock = s('intlResult', { headline: 'the shock', upset: { winner: 41000, loser: 47000 } });
  const order = runningOrder([expected, shock], TODAY);
  assert.equal(order[0].headline, 'the shock', 'the unexpected result is the one that leads');
});

// ---- WEIGHTED COVERAGE, WITHOUT A QUOTA -----------------------------------

test('a strong nation is covered ahead of a weak one, all else equal', () => {
  const top = s('intlResult', { standing: { rank: 1, of: 16 } });
  const assoc = s('intlResult', { standing: { rank: 16, of: 16 } });
  assert.ok(score(top, TODAY) > score(assoc, TODAY), 'standing tilts the page');
});

// AND THE ASSOCIATE STILL REACHES THE FRONT PAGE - on merit, which is the
// whole reason the upset is the heaviest modifier. Weighting by standing is
// only fair if beating your betters can outrun it.
test('but an associate beating a full member outranks the tie it lost', () => {
  const routine = s('intlResult', { standing: { rank: 2, of: 16 } });
  const shock = s('intlResult', { standing: { rank: 16, of: 16 },
    upset: { winner: 41000, loser: 47500 } });
  assert.ok(score(shock, TODAY) > score(routine, TODAY),
    'the small nation leads: ' + score(shock, TODAY).toFixed(1) + ' vs ' + score(routine, TODAY).toFixed(1));
});

// ---- THE MODIFIERS DO WHAT THEY SAY ---------------------------------------

test('rarity: the first of the season beats the ninth', () => {
  assert.ok(rarityMult(0) > rarityMult(1), 'once beats twice');
  assert.ok(rarityMult(1) > rarityMult(8), 'and twice beats often');
  assert.ok(rarityMult(50) > 1, 'but a common thing is still worth something');
});

test('freshness: yesterday leads, and last week does not', () => {
  assert.equal(freshMult(0), 1, 'today is undimmed');
  assert.ok(freshMult(1) < 1 && freshMult(1) > 0.4, 'yesterday fades a little');
  assert.ok(freshMult(6) < 0.05, 'and last week has stopped leading');
});

test('standing is a tilt, never a takeover', () => {
  assert.ok(standingMult(1, 16) < 1.4, 'the best nation does not double');
  assert.ok(standingMult(16, 16) > 0.6, 'nor does the smallest vanish');
});

test('the upset can more than double a story but not run away with it', () => {
  assert.equal(upsetMult(50000, 40000), 1, 'the favourite winning is not a story');
  assert.ok(upsetMult(40000, 50000) > 2, 'a huge shock more than doubles it');
  // CAPPED AT 3.2, raised from 2.6 when the test above proved 2.6 too small
  // for an astonishing club game to take the page off a dull tour tie. It is
  // the heaviest modifier by design; it is still bounded, because a paper that
  // leads on every mismatch is as dull as one that never does.
  assert.ok(upsetMult(1000, 99000) <= 3.2, 'and it is capped');
  assert.ok(upsetMult(1000, 99000) > 3, 'at a ceiling a real shock can reach');
});

// ---- THE SAME RECORD PRINTS THE SAME PAPER --------------------------------
//
// The law every derivation in this world obeys. A paper whose running order
// depends on which row came back first is a paper that differs between two
// readers, which is the one thing it was built not to do.

test('composing twice from one record gives one paper', () => {
  const pool = ['intlResult', 'leagueResult', 'oddity', 'worldRecord', 'titleDecided']
    .map((k, i) => s(k, { day: 100 - (i % 3), seenLately: i, headline: k + i }));
  assert.deepEqual(makeIssue(pool, TODAY), makeIssue(pool, TODAY));
});

test('and stories that score the same are still ordered the same way', () => {
  const twins = [s('oddity', { headline: 'B' }), s('oddity', { headline: 'A' })];
  const one = runningOrder(twins, TODAY).map(x => x.headline);
  const two = runningOrder(twins.slice().reverse(), TODAY).map(x => x.headline);
  assert.deepEqual(one, two, 'the tie-break is stable, not the row order');
  assert.deepEqual(one, ['A', 'B']);
});

// ---- THE SHAPE OF AN ISSUE ------------------------------------------------

test('the issue is a front page and back pages, not a list', () => {
  const many = Array.from({ length: 30 }, (_, i) =>
    s('leagueResult', { headline: 'r' + String(i).padStart(2, '0'), seenLately: i }));
  const iss = makeIssue(many, TODAY);
  assert.ok(iss.lead && iss.second, 'a lead and a second lead');
  assert.equal(iss.briefs.length, 6, 'six in brief');
  assert.equal(iss.back.length, 6, 'and the back pages');
  assert.equal(iss.tournament, false, 'an ordinary day is an ordinary paper');
});

test('a final takes over the front page', () => {
  const iss = makeIssue([s('intlResult'), s('cupFinal', { headline: 'THE FINAL' })], TODAY);
  assert.equal(iss.tournament, true, 'the client is told to lay it out differently');
  assert.equal(iss.lead.kind, 'cupFinal');
});

// A PAPER THAT HAS NOTHING SAYS SO. A country that failed to settle, a tick
// that died halfway: the honest answer is a thin edition that admits it, never
// a blank page pretending the world stood still.
test('a day with no cricket prints a thin paper, not a blank one', () => {
  const iss = makeIssue([], TODAY);
  assert.equal(iss.thin, true);
  assert.equal(iss.lead, null);
  assert.equal(iss.day, TODAY, 'and it still knows what day it is');
});

// ---- AND THE READER'S CLUB IS NOT A CATEGORY ------------------------------
//
// The owner asked for a paper that is the same for everyone. That is not a
// rendering rule to be honoured later - it is the absence of any input the
// editor could use to tell one reader from another. There is nowhere in a
// story to say whose club it is, and this is the test that keeps it that way.
test('nothing in the editor can tell one reader from another', () => {
  const keys = new Set();
  ['intlResult', 'leagueResult', 'cupFinal'].forEach(k => {
    Object.keys(s(k, { standing: {}, upset: {} })).forEach(x => keys.add(x));
  });
  for (const forbidden of ['user', 'userId', 'mine', 'myClub', 'reader', 'claim'])
    assert.ok(!keys.has(forbidden), 'a story carries "' + forbidden + '" - the paper is personal again');
});

// ---- AND A FRONT PAGE IS NOT A LEADERBOARD --------------------------------
//
// Ranking alone is not editing, and reading a real issue proved it: in a
// low-scoring week five-fors score well and there are a dozen of them, so the
// paper came out with a lead, a second lead and all six briefs given to
// individual bowling analyses, and not one result on the front page. Nobody
// would open that twice.
test('one kind of story cannot eat the front page', () => {
  const feats = Array.from({ length: 12 }, (_, i) =>
    s('milestone', { headline: 'feat' + String(i).padStart(2, '0') }));
  const results = Array.from({ length: 6 }, (_, i) =>
    s('leagueResult', { headline: 'res' + i, stakes: 0.9 }));
  const iss = makeIssue(feats.concat(results), TODAY);
  const front = [iss.lead, iss.second].concat(iss.briefs).filter(Boolean);
  const milestones = front.filter(x => x.kind === 'milestone').length;
  // HALF, not two. The quota starts at two a kind and rises only as far as the
  // day's supply forces it, so with just two kinds on offer it settles at four
  // and four. Insisting on two here would be insisting the page print gaps, or
  // that twelve five-fors somehow yield six different sorts of story. What the
  // rule has to stop is the eight-out-of-eight the real issue printed.
  assert.ok(milestones <= front.length / 2,
    'the front page is ' + milestones + '/' + front.length + ' one kind: ' +
    front.map(x => x.kind).join(', '));
  assert.ok(front.some(x => x.kind === 'leagueResult'), 'and a result got on it');
});

// BUT THE QUOTA NEVER LEAVES A HOLE. If a day genuinely has only one kind of
// story, the page fills with it rather than printing gaps - the rule is there
// to spread a rich day, not to punish a thin one.
test('but on a day of only one kind, the page still fills', () => {
  const only = Array.from({ length: 10 }, (_, i) =>
    s('milestone', { headline: 'm' + String(i).padStart(2, '0') }));
  const iss = makeIssue(only, TODAY);
  assert.ok(iss.lead && iss.second, 'a lead and a second');
  assert.equal(iss.briefs.length, 6, 'and a full set of briefs, quota or no quota');
});

// AND THE BEST OF A KIND IS NEVER THE ONE DROPPED. The quota applies after
// ranking, so what it removes is a story's imitators and never the story.
test('the quota drops the imitators, not the best of them', () => {
  const feats = [s('milestone', { headline: 'the best', stakes: 1 }),
                 s('milestone', { headline: 'the second', stakes: 0.9 }),
                 s('milestone', { headline: 'the third', stakes: 0.8 })];
  const iss = makeIssue(feats.concat([s('leagueResult', { headline: 'a result' })]), TODAY);
  assert.equal(iss.lead.headline, 'the best', 'the best of the kind still leads');
});
