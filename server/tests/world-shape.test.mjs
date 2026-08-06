// world-shape.test.mjs — NO TWO CRICKETERS, AND NO TWO COUNTRIES, ARE THE SAME.
//
// The generator used to draw a batter's vsPace and vsSpin from one mean, so a
// man rated 42 read 42 against seam and 42 against spin. foGenSkills calls it
// "a tight batting cluster" and meant it kindly. The cost was that the ball
// engine's whole matchup system - it adjusts a batter's effective bat by
// 0.8 x (his skill against THIS bowling type - 50), every delivery - was
// being fed the same number twice and could never do anything. Nobody had a
// weakness worth bowling at and no captain ever had a reason to change ends.
//
// Now every man leans, and where he learned decides which way. What must
// stay true while he does:
//
//   1. A LEAN IS FREE. bat weighs vsPace and vsSpin equally and rating
//      weighs wicket and economy equally, so moving a pair apart by the same
//      amount either side leaves rating and wage untouched to the pound.
//   2. THE LADDER NEVER MOVES. Every club still calibrates onto its own rung.
//   3. ONE MAN IN FIVE IS A SPECIALIST, and the rest lean gently.
//   4. A COUNTRY IS A KIND OF CRICKET: a seam land's own seamers out-bowl its
//      own spinners, a spin land's the reverse - and the two clubs are still
//      worth exactly the same, because shape is not strength.
//   5. TWO CLUBS ARE TWO CLUBS, even side by side in the same league.
import { test, before } from 'node:test';
import assert from 'node:assert';
import { makeHost } from '../enginehost.mjs';
import { countryConfigs, squadFor, NAT_STR, BASE_XI } from '../init-world.mjs';

let host, world;
const PACE_LANDS = ['England', 'Australia', 'South Africa', 'New Zealand', 'West Indies'];
const SPIN_LANDS = ['India', 'Sri Lanka', 'Pakistan', 'Afghanistan', 'Bangladesh', 'Nepal'];
const isSeam = p => /seam/.test(p.bowlTypeFull || '');
const isSpin = p => /[Ss]pin/.test(p.bowlTypeFull || '');
const bats = p => !p.bowlTypeFull || p.bowlTypeFull === 'none';
const xiOf = men => {
  const s = men.slice().sort((a, b) => b.rating - a.rating).slice(0, 11);
  return s.reduce((t, p) => t + p.rating, 0) / 11;
};

before(() => {
  host = makeHost();
  world = countryConfigs(host).map(cfg => ({
    cfg, clubs: cfg.clubs.map(club => ({ club, men: squadFor(host, cfg, club, 1) }))
  }));
});

test('a lean costs nothing: rating and wage survive it to the pound', () => {
  // The invariant the whole design rests on, asserted against the engine's
  // own mapping rather than trusted. Take a real generated man, move his
  // pace/spin pair apart by any amount, re-derive, and he must be worth the
  // same money as before - otherwise specialisation is a hidden buff and the
  // strength ladder is a lie.
  const men = world[0].clubs[0].men.filter(bats).slice(0, 6);
  assert.ok(men.length >= 3, 'found batters to test');
  for (const p of men) {
    for (const n of [3, 8, 15, 22]) {
      const q = JSON.parse(JSON.stringify(p));
      q.skills.vsPace += n; q.skills.vsSpin -= n;
      const [d] = host.derive([q]);
      assert.equal(d.rating, p.rating, p.name + ': a lean of ' + n + ' moved his rating');
      assert.equal(d.wage, p.wage, p.name + ': a lean of ' + n + ' moved his wage');
    }
  }
  // and the same for a bowler's trade
  const bowlers = world[0].clubs[0].men.filter(p => isSeam(p) || isSpin(p)).slice(0, 4);
  for (const p of bowlers) {
    const q = JSON.parse(JSON.stringify(p));
    q.skills.wicket += 12; q.skills.economy -= 12;
    const [d] = host.derive([q]);
    assert.equal(d.rating, p.rating, p.name + ': strike-vs-stock moved his rating');
  }
});

test('every club still lands on its own rung', () => {
  let worst = 0, worstName = '';
  for (const { cfg, clubs } of world) {
    for (const { club, men } of clubs) {
      const target = BASE_XI * (NAT_STR[cfg.id] || 1) * club.str;
      const err = Math.abs(xiOf(men) - target) / target;
      if (err > worst) { worst = err; worstName = cfg.id + ':' + club.name; }
    }
  }
  assert.ok(worst < 0.02, 'the calibration ladder is intact (worst ' +
    (100 * worst).toFixed(2) + '% at ' + worstName + ')');
});

test('one batter in five is a marked specialist, and the rest lean gently', () => {
  const gaps = [];
  for (const { clubs } of world) for (const { men } of clubs) {
    for (const p of men) if (bats(p)) gaps.push(Math.abs(p.skills.vsPace - p.skills.vsSpin));
  }
  gaps.sort((a, b) => a - b);
  assert.ok(gaps.length > 800, 'a whole world of batters to read (' + gaps.length + ')');
  const median = gaps[gaps.length >> 1];
  const marked = gaps.filter(g => g >= 15).length / gaps.length;
  assert.ok(median >= 5 && median <= 12, 'the typical man leans gently (median ' + median + ')');
  assert.ok(marked > 0.12 && marked < 0.30,
    'about one in five is a marked specialist (' + (100 * marked).toFixed(0) + '%)');
  // and the flat world is genuinely gone: it is not enough that a few men
  // lean - almost nobody should read the same number twice
  const flat = gaps.filter(g => g <= 2).length / gaps.length;
  assert.ok(flat < 0.15, 'hardly anybody plays pace and spin identically (' +
    (100 * flat).toFixed(0) + '% within 2 points)');
});

test('a country is a kind of cricket, and it is shape and not strength', () => {
  const craft = {};
  for (const { cfg, clubs } of world) {
    const seen = [];
    for (const { men } of clubs) {
      const sm = men.filter(isSeam), sp = men.filter(isSpin);
      if (!sm.length || !sp.length) continue;
      const av = a => a.reduce((t, p) => t + p.skills.wicket + p.skills.economy, 0) / (2 * a.length);
      seen.push(av(sm) - av(sp));
    }
    if (seen.length) craft[cfg.nat] = seen.reduce((a, b) => a + b, 0) / seen.length;
  }
  for (const n of PACE_LANDS) {
    assert.ok(craft[n] > 1.5, n + ' raises seamers: its own seamers out-bowl its own spinners by ' +
      (craft[n] || 0).toFixed(1));
  }
  for (const n of SPIN_LANDS) {
    assert.ok(craft[n] < -1.5, n + ' raises spinners: its own spinners out-bowl its own seamers by ' +
      (-(craft[n] || 0)).toFixed(1));
  }
  // AND THE TWO ARE WORTH THE SAME. England and India both field clubs on the
  // same rung of the same ladder; if the craft had leaked into strength, one
  // country's clubs would out-rate the other's at identical targets.
  const at = id => world.find(w => w.cfg.id === id);
  for (const slot of [0, 8, 12]) {
    const e = at('eng').clubs.find(c => c.club.slot === slot);
    const i = at('sub').clubs.find(c => c.club.slot === slot);
    const eT = BASE_XI * (NAT_STR.eng || 1) * e.club.str;
    const iT = BASE_XI * (NAT_STR.sub || 1) * i.club.str;
    assert.ok(Math.abs(xiOf(e.men) / eT - xiOf(i.men) / iT) < 0.02,
      'slot ' + slot + ': England and India sit on their rungs equally well');
  }
});

test('two clubs are two clubs, even in the same league', () => {
  // A house style is drawn per club, so neighbours are not copies. Read the
  // batting lean of each English club: if every club drew the same style the
  // spread across them would be nil.
  const lean = [];
  for (const { men } of world.find(w => w.cfg.id === 'eng').clubs) {
    const b = men.filter(bats);
    lean.push(b.reduce((t, p) => t + (p.skills.vsPace - p.skills.vsSpin), 0) / b.length);
  }
  const avg = lean.reduce((a, b) => a + b, 0) / lean.length;
  const sd = Math.sqrt(lean.reduce((t, v) => t + (v - avg) * (v - avg), 0) / lean.length);
  assert.ok(sd > 2, 'English clubs do not all play the same way (spread ' + sd.toFixed(1) + ')');
  // and the styles genuinely point different ways rather than all leaning
  // the national way by slightly different amounts
  assert.ok(Math.max(...lean) > 0 && Math.min(...lean) < 0,
    'some English clubs raise pace players and some raise spin players (' +
    lean.map(v => v.toFixed(0)).join(', ') + ')');
  // (namesakes across clubs are allowed by design - the living layer keys its
  // book by slot|name for exactly that reason - so nothing here checks names)
});

test('the ball engine is actually fed the difference', () => {
  // The matchup only means something if a real generated batter reads
  // materially differently against the two trades. Measure the swing the
  // engine would apply: 0.8 x (skill - 50), pace against spin.
  const swings = [];
  for (const { clubs } of world) for (const { men } of clubs) {
    for (const p of men) if (bats(p)) swings.push(0.8 * Math.abs(p.skills.vsPace - p.skills.vsSpin));
  }
  swings.sort((a, b) => a - b);
  const top = swings[Math.floor(swings.length * 0.9)];
  assert.ok(top > 12, 'the best matchups are worth real runs (90th percentile swing ' +
    top.toFixed(1) + ' points of effective batting)');
});
