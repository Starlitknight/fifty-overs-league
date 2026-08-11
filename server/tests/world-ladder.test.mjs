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
// countryConfigs says how strong each seat is meant to be and calibrate() makes
// it so. That needs no database, no season and no cricket - so this asks the
// question directly, over every club on earth, in about a second.
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
import { countryConfigs, squadFor, xiOf, BASE_XI, NAT_STR } from '../init-world.mjs';

const host = makeHost();
const CFGS = countryConfigs(host);

// every club on earth, dealt and calibrated exactly as the founding deals it
const WORLD = CFGS.map(cfg => ({
  id: cfg.id,
  clubs: cfg.clubs.map(c => {
    const men = squadFor(host, cfg, c);
    const hands = men.reduce((s, p) => s + ((p.skills || {}).fielding || 0), 0) / Math.max(1, men.length);
    return { slot: c.slot, boss: !!c.boss, div: c.div, name: c.name, xi: xiOf(men), hands, men };
  })
}));

test('the world is dealt, and every seat lands on the rung it was sold', () => {
  assert.equal(WORLD.length, 16, 'sixteen nations');
  WORLD.forEach(n => assert.equal(n.clubs.length, 16, n.id + ' has sixteen clubs'));
  // calibration exists to put a squad on a number; if it misses, nothing below
  // this line means anything
  WORLD.forEach(n => n.clubs.forEach(c => {
    assert.ok(c.xi > 1000, n.id + ':' + c.slot + ' was calibrated (' + Math.round(c.xi) + ')');
  }));
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

test('and it leads by the margin the money and the ladder are priced on', () => {
  // the economy pays a flagship like the best side in the league and the
  // promotion race assumes it usually is one. Six per cent is the design
  // figure; four is the floor at which the rest of the world stops making
  // sense, and it is what the exclusion had eaten into.
  const edges = WORLD.map(n => {
    const boss = n.clubs.find(c => c.boss || c.slot === 0);
    const rivals = n.clubs.filter(c => c !== boss && c.div === 1);
    return { id: n.id, pct: 100 * (boss.xi / Math.max(...rivals.map(c => c.xi)) - 1) };
  });
  const worst = edges.reduce((a, b) => a.pct < b.pct ? a : b);
  const mean = edges.reduce((s, e) => s + e.pct, 0) / edges.length;
  assert.ok(worst.pct >= 4, 'the thinnest flagship edge on earth is ' + worst.pct.toFixed(2) + '% (' + worst.id + ')');
  assert.ok(mean >= 5.5, 'and the average is ' + mean.toFixed(2) + '%');
});

test('the pyramid runs the right way down, in every nation', () => {
  for (const n of WORLD) {
    const d1 = n.clubs.filter(c => c.div === 1), d2 = n.clubs.filter(c => c.div === 2);
    const m = a => a.reduce((s, c) => s + c.xi, 0) / a.length;
    assert.ok(m(d1) > m(d2),
      n.id + ': division one out-rates division two (' + Math.round(m(d1)) + ' v ' + Math.round(m(d2)) + ')');
    // and a nation's whole ladder answers to its standing in the world
    const want = BASE_XI * (NAT_STR[n.id] || 1);
    assert.ok(Math.abs(m(n.clubs) / want - 1) < 0.35,
      n.id + ' sits near its own rung: ' + Math.round(m(n.clubs)) + ' against ' + Math.round(want));
  }
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
