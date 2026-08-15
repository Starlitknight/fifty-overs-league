// server/tests/world-ladder.test.mjs — THE LADDER, IN A SECOND.
//
// This exists because of a bad afternoon. Fielding was excluded from
// calibration to stop it flattening the world's fielding scale, which worked -
// and quietly cost a flagship its edge, because a club's whole advantage comes
// through that one function. Nothing noticed until world-p3 played a full
// planet season and reported flagships being relegated in three nations of
// sixteen. Diagnosing and fixing a two-line change then took four nine-minute
// runs of a test that builds a database, applies eighty-four migrations and
// plays several thousand matches, because it was the only thing that looked at
// the ladder at all.
//
// It should never have been. The ladder is decided before a ball is bowled:
// tierOfClub says which tier of the world each seat is, and the generator deals
// its men from that tier's distribution. That needs no database, no season and
// no cricket - so this asks the question directly, over every club on earth, in
// about a second.
//
// It guards BOTH ends of one trade-off, which is the point. Scale the hands too
// little and the ladder dies (nobody can out-field anybody, so standing stops
// meaning anything). Scale them too much and the world's fielding goes flat
// again (the thing the exclusion was there to prevent, and the reason no
// cricketer in the game could save a boundary for a decade). p3 still plays the
// season and still has the last word before anything ships; it is no longer the
// only place the question is asked.
import { test } from 'node:test';
import assert from 'node:assert';
import { makeHost } from '../enginehost.mjs';
import { countryConfigs, squadFor, xiOf, tierOfClub, isFullMember, TIER_XI_BAND } from '../init-world.mjs';

const host = makeHost();
const CFGS = countryConfigs(host);

// every club on earth, dealt exactly as the founding deals it
const WORLD = CFGS.map(cfg => ({
  id: cfg.id,
  clubs: cfg.clubs.map(c => {
    const men = squadFor(host, cfg, c);
    const hands = men.reduce((s, p) => s + ((p.skills || {}).fielding || 0), 0) / Math.max(1, men.length);
    return { slot: c.slot, boss: !!c.boss, div: c.div, name: c.name, xi: xiOf(men),
             tier: tierOfClub(cfg, c), hands, men };
  })
}));

// THE TIER BANDS are init-world's own (TIER_XI_BAND), read rather than
// restated - a band written down twice is a band that goes stale once.
test('the world is dealt, and every seat lands in the tier it was sold', () => {
  assert.equal(WORLD.length, 16, 'sixteen nations');
  WORLD.forEach(n => assert.equal(n.clubs.length, 16, n.id + ' has sixteen clubs'));
  const out = [];
  WORLD.forEach(n => n.clubs.forEach(c => {
    const [lo, hi] = TIER_XI_BAND[c.tier];
    const xi = c.xi / 1000;                       // the card the rating is made of
    if (!(xi >= lo && xi <= hi))
      out.push(n.id + ':' + c.slot + ' ' + c.tier + ' XI ' + xi.toFixed(1) + ' wanted ' + lo + '-' + hi);
  }));
  assert.deepEqual(out, [], 'every club is the club its tier says it is');
});

test('a flagship is the strongest side in its own league', () => {
  const short = [];
  for (const n of WORLD) {
    const boss = n.clubs.find(c => c.boss || c.slot === 0);
    const rivals = n.clubs.filter(c => c !== boss && c.div === 1);
    assert.ok(boss && rivals.length, n.id + ' has a flagship and a first division');
    const best = Math.max(...rivals.map(c => c.xi));
    if (boss.xi <= best) short.push(n.id + ' (' + Math.round(boss.xi) + ' v ' + Math.round(best) + ')');
  }
  assert.deepEqual(short, [], 'flagships out-rate their best divisional rival everywhere');
});

// AND THE MARGIN, WHICH B2 MADE A DISTRIBUTION RATHER THAN A DECREE.
//
// The economy pays a flagship like the best side in the league and the promotion
// race assumes it usually is one, so the margin is load-bearing and always was.
// What changed is that it is no longer GUARANTEED. Every club used to be scaled
// onto a stated rung, so the gap between rung six and rung five was arithmetic
// and a floor of 4% could be asserted per nation. Clubs are now dealt from
// overlapping tier distributions, and a d1a club draws a genuine star roughly
// once in three (FO_TIERS.d1a.star = 0.32). When one does and the flagship does
// not, the gap narrows - and that is the design working, not failing: the whole
// point of the overlap is that a club outside the boss seat can produce a player
// the world wants.
//
// MEASURED over all sixteen nations, generation 1:
//
//     mean 6.33%   median 4.45 cards of best XI
//     slk 3.59%  usa 4.21%  eng 4.70%  ...  zim 9.30%  afg 9.41%
//
// So the mean is asserted where it was, and the per-nation floor is replaced by
// the thing the floor was standing in for: the flagship is still the best side
// in its league everywhere (asserted above), it never falls to within a rounding
// error of its rival, AND where the gap IS thin the cause is the designed one.
// In Sri Lanka the flagship's best man reads 86 and slot one's reads 97; in the
// United States 85 against 89. A nation whose flagship is thin WITHOUT a rival
// star is a generation defect, and that is what fails here now.
test('and it leads by the margin the money and the ladder are priced on', () => {
  const edges = WORLD.map(n => {
    const boss = n.clubs.find(c => c.boss || c.slot === 0);
    const rivals = n.clubs.filter(c => c !== boss && c.div === 1);
    const top = rivals.slice().sort((a, b) => b.xi - a.xi)[0];
    const bestOf = c => Math.max(...c.men.map(p => p.rating || 0));
    return { id: n.id, pct: 100 * (boss.xi / top.xi - 1),
             rivalStar: bestOf(top) > bestOf(boss) };
  });
  const mean = edges.reduce((s, e) => s + e.pct, 0) / edges.length;
  assert.ok(mean >= 5.5, 'the average flagship edge is ' + mean.toFixed(2) + '%');
  // nowhere is it a rounding error: below this the club is not the best side in
  // its league in any sense the promotion race or the sponsor can read
  const worst = edges.reduce((a, b) => a.pct < b.pct ? a : b);
  assert.ok(worst.pct >= 2.5,
    'the thinnest flagship edge on earth is ' + worst.pct.toFixed(2) + '% (' + worst.id + ')');
  // and every thin one is thin because a rival drew a better cricketer, which is
  // the mechanism this world is built to allow
  const unexplained = edges.filter(e => e.pct < 4.5 && !e.rivalStar).map(e => e.id + ' ' + e.pct.toFixed(2) + '%');
  assert.deepEqual(unexplained, [],
    'a thin flagship edge is always a rival with a better man in it, never a flat deal');
  // it must also stay RARE, or the boss seat has stopped meaning anything
  const thin = edges.filter(e => e.pct < 4.5).length;
  assert.ok(thin <= 4, 'and it is rare: ' + thin + ' of 16 nations under 4.5%');
});

// A NATION'S STANDING IS A TIER, NOT A MULTIPLIER (B2).
//
// This used to assert that a nation's mean club rating sat within 35% of
// BASE_XI x NAT_STR - the old ten-point ladder's own arithmetic, anchored at
// 36,000, "the old world's median XI rating". Rating is the canonical card times
// a thousand now, so the world's mean club XI reads about 60,000 and 36,000
// names a quantity that stopped existing: the assertion could only be satisfied
// by dragging the whole world back down onto a dead scale.
//
// What it was PROTECTING is still real and is asserted directly instead. A
// nation's standing in the world shows up as its clubs being dealt one tier
// higher or lower (tierOfClub), so what has to be true is that a full member's
// league genuinely is stronger than an associate's - measured on the cricketers,
// not declared by a constant - and that the pyramid inside every nation points
// the right way up.
test('the pyramid runs the right way down, in every nation', () => {
  const m = a => a.reduce((s, c) => s + c.xi, 0) / a.length;
  for (const n of WORLD) {
    const d1 = n.clubs.filter(c => c.div === 1), d2 = n.clubs.filter(c => c.div === 2);
    assert.ok(m(d1) > m(d2),
      n.id + ': division one out-rates division two (' + Math.round(m(d1)) + ' v ' + Math.round(m(d2)) + ')');
  }
  // and the world's own pyramid: every full member's league above every
  // associate's, which is what "a rung of the ladder" now buys
  const full = WORLD.filter(n => isFullMember(n.id));
  const assoc = WORLD.filter(n => !isFullMember(n.id));
  assert.ok(full.length === 10 && assoc.length === 6, 'ten full members and six associates');
  const weakestFull = Math.min(...full.map(n => m(n.clubs)));
  const strongestAssoc = Math.max(...assoc.map(n => m(n.clubs)));
  assert.ok(weakestFull > strongestAssoc,
    'the weakest full member (' + Math.round(weakestFull) + ') out-rates the strongest associate (' +
    Math.round(strongestAssoc) + ')');
  // by a real margin rather than a rounding one - a tier of the world is worth
  // about six cards of best XI, and half of that is the floor at which the
  // distinction stops meaning anything
  assert.ok(weakestFull - strongestAssoc > 3000,
    'and by a tier rather than by a rounding error: ' +
    Math.round(weakestFull - strongestAssoc));
});

// ---- the trade-off this file was written for --------------------------------

test('standing buys better hands - the half of the trade that died once', () => {
  // THIS IS THE REGRESSION. With the hands held out of calibration altogether
  // every one of these differences is exactly zero, and a flagship's cordon is
  // a bottom club's cordon. Measured across sixteen nations so one nation's
  // deal cannot carry it.
  const gaps = WORLD.map(n => {
    const boss = n.clubs.find(c => c.boss || c.slot === 0);
    const worst = n.clubs.reduce((a, b) => a.xi < b.xi ? a : b);
    return boss.hands - worst.hands;
  });
  const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  assert.ok(mean >= 3,
    'a flagship out-fields its weakest club by ' + mean.toFixed(2) + ' points on average - the hands have stopped answering to standing');
  assert.ok(gaps.filter(g => g > 0).length >= 13,
    'and it holds in ' + gaps.filter(g => g > 0).length + ' of 16 nations');
});

test('and the world still fields on a real scale - the half that died first', () => {
  // THE OTHER SIDE OF IT. Scaling the hands at FULL club factor is what
  // squashed the world into a band of 20 to 56 with a median of 35, which put
  // every good-fielding branch out of reach: for a decade nobody in this game
  // could save a boundary because nobody could be good enough to try.
  const all = WORLD.flatMap(n => n.clubs.flatMap(c =>
    c.men.map(p => (p.skills || {}).fielding || 0))).sort((a, b) => a - b);
  const q = t => all[Math.floor(t * (all.length - 1))];
  assert.ok(all.length > 3000, 'a whole world of hands to measure (' + all.length + ')');
  assert.ok(q(0.5) >= 42 && q(0.5) <= 58, 'the median cricketer is an average fielder: ' + q(0.5));
  assert.ok(q(0.05) <= 32, 'there are genuinely poor ones: p5 ' + q(0.05));
  assert.ok(q(0.95) >= 66, 'and genuinely brilliant ones: p95 ' + q(0.95));
  assert.ok(q(0.95) - q(0.05) >= 34, 'the spread is real, not a rounding band: ' + (q(0.95) - q(0.05)));
  // the ceiling the ground-fielding contest needs to be reachable at all. The
  // bell itself stops at 89 - gg(50,26) is m + 1.5s at its very best - so this
  // asks for a world whose finest fielder is genuinely near the top of what a
  // man can be dealt, not for a number nothing can produce. (Asked for 90 on
  // the first draft of this file and it answered 84 in three seconds, which is
  // rather the point of having it.)
  assert.ok(all[all.length - 1] >= 78,
    'the best fielder alive is ' + all[all.length - 1] + ', against a bell that tops out at 89');
});
