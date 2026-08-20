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
//   1. A LEAN IS FREE - AND B2 CHANGED WHAT MAKES IT FREE. It used to be free
//      by arithmetic: bat weighed vsPace and vsSpin equally and rating weighed
//      wicket and economy equally, so a symmetric lean cancelled to the pound.
//      The canonical weights are MEASURED now, and the engine does not value
//      those pairs equally - it bowls more pace than spin, and a wicket is worth
//      more than an economy point - so a symmetric lean genuinely does move what
//      a man is worth. Making the weights lie about that to protect the old
//      identity would be paying for style with a false card.
//
//      So the freedom moved to where it always actually lived: the generator
//      LEANS A MAN AND THEN FITS HIM TO HIS MARK. Shape is chosen first, level
//      is set afterwards, and the fit is a similarity transform that leaves
//      every ratio between his attributes where the lean put it. The invariant
//      that survives is stronger than the one it replaces, because it holds for
//      ANY archetype offset and not only for a symmetric pair: a style-only
//      transformation preserves canonical value and changes cricket.
//   2. THE LADDER NEVER MOVES. Every club still lands inside its own TIER's
//      band of canonical overalls.
//   3. ONE MAN IN FIVE IS A SPECIALIST, and the rest lean gently.
//   4. A COUNTRY IS A KIND OF CRICKET: a seam land's own seamers out-bowl its
//      own spinners, a spin land's the reverse - and the two clubs are still
//      worth exactly the same, because shape is not strength.
//   5. TWO CLUBS ARE TWO CLUBS, even side by side in the same league.
import { test, before } from 'node:test';
import assert from 'node:assert';
import { makeHost } from '../enginehost.mjs';
import { countryConfigs, squadFor, tierOfClub, TIER_XI_BAND } from '../init-world.mjs';

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

// THE PROPERTY, STATED AS THE PIPELINE STATES IT: lean him, put him back on his
// own level, and he is the same class of cricketer playing a different game.
//
// The tolerance is a card, not a pound. foFitToLevel bisects to about a
// thousandth of a level and then rounds every attribute to an integer, so the
// landing is exact to a fraction of an OVR and cannot be exact to the pound -
// and a wage is a cube of the card, which magnifies that rounding. One point of
// card is the honest resolution of this operation; a lean that moved a man a
// whole rung of the ladder would be a hidden buff and would fail here.
test('a style-only change is free: shape moves, canonical value does not', () => {
  const LEANS = [3, 8, 15, 22];
  const men = world[0].clubs[0].men.filter(bats).slice(0, 8);
  assert.ok(men.length >= 3, 'found batters to test');
  let checked = 0, shaped = 0;
  for (const p of men) {
    const was = host.playerValue(p);
    for (const n of LEANS) {
      const q = JSON.parse(JSON.stringify(p));
      q.skills.vsPace += n; q.skills.vsSpin -= n;
      // the archetype operation, exactly as the generator performs it: shape
      // first, then back onto the level he was already on
      const [r] = host.fitToLevel([q], was.level);
      const now = host.playerValue(r);
      assert.ok(Math.abs(now.ovr - was.ovr) <= 1,
        p.name + ': a lean of ' + n + ' moved his card from ' +
        was.ovr.toFixed(2) + ' to ' + now.ovr.toFixed(2));
      checked++;
      // AND IT REALLY IS A DIFFERENT CRICKETER. A "value-neutral" transform that
      // quietly undid the lean would pass the line above and be worthless.
      //
      // What survives a similarity transform is the RATIO, not the difference:
      // the fit multiplies every batting skill by one factor, so a man leaned to
      // 105/79 and then scaled down to pay for it comes out 99/75 - the same
      // cricketer, at the same level. Asserting on the difference would be
      // asserting that the fit did not happen.
      //
      // WHERE THE SCALE HAS ROOM. A skill caps at 99 (FO_SKILL_CEIL), so a man
      // already reading 97 against pace cannot be leaned another fifteen points
      // toward it - he is clamped, and his ratio comes out short of what was
      // asked for. That is the top of the ladder being the top of the ladder,
      // not the transform failing, and the line above shows his VALUE survived
      // it. So the shape is checked on the men who had somewhere to go.
      if (p.skills.vsPace + n <= 96 && p.skills.vsSpin - n >= 20) {
        const ratioWant = (p.skills.vsPace + n) / (p.skills.vsSpin - n);
        const ratioGot = r.skills.vsPace / r.skills.vsSpin;
        assert.ok(Math.abs(ratioGot / ratioWant - 1) < 0.06,
          p.name + ': the fit changed his shape as well as his level (wanted a ' +
          ratioWant.toFixed(2) + ' pace-to-spin man, got ' + ratioGot.toFixed(2) + ')');
        assert.ok(r.skills.vsPace - r.skills.vsSpin > p.skills.vsPace - p.skills.vsSpin,
          p.name + ': the lean of ' + n + ' did not survive the fit');
        shaped++;
      }
    }
  }
  assert.ok(checked >= 12, 'a real sample of leans (' + checked + ')');
  assert.ok(shaped >= 4, 'and a real sample with room to lean into (' + shaped + ')');
  // and the same for a bowler's trade: strike bowler against stock bowler
  const bowlers = world[0].clubs[0].men.filter(p => isSeam(p) || isSpin(p)).slice(0, 4);
  assert.ok(bowlers.length >= 2, 'found bowlers to test');
  for (const p of bowlers) {
    const was = host.playerValue(p);
    const q = JSON.parse(JSON.stringify(p));
    q.skills.wicket += 12; q.skills.economy -= 12;
    const [r] = host.fitToLevel([q], was.level);
    const now = host.playerValue(r);
    assert.ok(Math.abs(now.ovr - was.ovr) <= 1,
      p.name + ': strike-vs-stock moved his card from ' +
      was.ovr.toFixed(2) + ' to ' + now.ovr.toFixed(2));
    if (p.skills.wicket + 12 <= 96 && p.skills.economy - 12 >= 20) {
      const rWant = (p.skills.wicket + 12) / (p.skills.economy - 12);
      const rGot = r.skills.wicket / r.skills.economy;
      assert.ok(Math.abs(rGot / rWant - 1) < 0.06,
        p.name + ': the fit changed his trade as well as his level (wanted ' +
        rWant.toFixed(2) + ', got ' + rGot.toFixed(2) + ')');
    }
  }
});

// AND THE RAW DERIVE IS HONEST ABOUT THE OTHER HALF OF IT. A lean that is NOT
// recentred must move the card, because the engine really does not value the
// two sides of a pair equally - it faces more pace than spin, and a wicket is
// worth more than an economy point. This is the assertion the old "free to the
// pound" identity would fail, and it is here so that nobody can restore the
// identity by flattening the measured weights: doing so would break this.
// AND IT IS ASKED BELOW THE KNEE, WHICH IS WHERE THE CLAIM LIVES. The lean has
// to stay inside the range where the latent transform is the identity, or this
// stops being a test of the WEIGHTS and becomes a test of the transform's
// diminishing returns - and those really can outweigh the 0.185-against-0.145
// asymmetry. Measured on a man already at vsPace 99, +22 buys only fourteen
// effective points while -22 costs a full twenty-two, and his card falls. That
// is the engine telling the truth about itself; it is not what this file is
// about, so the batsman chosen is one with room to lean.
test('and an un-recentred lean is not free, because the engine is not symmetric', () => {
  const KNEE = 99, STEP = 22;
  const p = world[0].clubs[0].men.filter(bats)
    .find(x => x.skills.vsPace + STEP <= KNEE && x.skills.vsSpin - STEP >= 10)
    || world.flatMap(w => w.clubs).flatMap(c => c.men).filter(bats)
        .find(x => x.skills.vsPace + STEP <= KNEE && x.skills.vsSpin - STEP >= 10);
  assert.ok(p, 'a batsman with room to lean either way');
  const was = host.playerValue(p);
  const q = JSON.parse(JSON.stringify(p));
  q.skills.vsPace += STEP; q.skills.vsSpin -= STEP;
  const now = host.playerValue(q);
  assert.ok(now.level > was.level,
    'facing pace is worth more than facing spin, and the card says so (' +
    was.level.toFixed(2) + ' -> ' + now.level.toFixed(2) + ')');
});

// THE LADDER, AS A TIER RATHER THAN AS A RUNG. There is no target to miss any
// more: a club is not pushed at a number, its men are dealt from a distribution.
// So the question is not "how far off its rung is it" but "is it the club its
// tier says it is", and the answer is a BAND, because a tier that produced the
// same club every time would be the flat world this file exists to prevent.
test('every club still lands inside its own tier', () => {
  const out = [];
  for (const { cfg, clubs } of world) {
    for (const { club, men } of clubs) {
      const tier = tierOfClub(cfg, club);
      const [lo, hi] = TIER_XI_BAND[tier];
      const ovrs = host.pkOvr(men).slice().sort((a, b) => b - a).slice(0, 11);
      const xi = ovrs.reduce((s, v) => s + v, 0) / ovrs.length;
      if (xi < lo || xi > hi)
        out.push(cfg.id + ':' + club.name + ' (' + tier + ' XI ' + xi.toFixed(1) + ', wanted ' + lo + '-' + hi + ')');
    }
  }
  assert.deepEqual(out, [], 'every club sits inside its tier');
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
  // AND THE TWO ARE WORTH THE SAME. England and India are both full members, so
  // the same seat is the same TIER in both; if the craft had leaked into
  // strength, one country's clubs would out-rate the other's from the identical
  // distribution. The comparison is between the two whole leagues rather than
  // between two single clubs, because a tier is a spread and two draws from one
  // spread are allowed to differ - what may not differ is where the spread sits.
  const at = id => world.find(w => w.cfg.id === id);
  const leagueMean = w => {
    const xis = w.clubs.map(({ men }) => {
      const o = host.pkOvr(men).slice().sort((a, b) => b - a).slice(0, 11);
      return o.reduce((s, v) => s + v, 0) / o.length;
    });
    return xis.reduce((a, b) => a + b, 0) / xis.length;
  };
  const eM = leagueMean(at('eng')), iM = leagueMean(at('sub'));
  assert.ok(Math.abs(eM - iM) < 2,
    'a seam league and a spin league are worth the same: England ' +
    eM.toFixed(1) + ' v India ' + iM.toFixed(1));
});

test('two clubs are two clubs, even in the same league', () => {
  // A house style is drawn per club, so neighbours are not copies. Read the
  // batting lean of each club: if every club drew its country's style the
  // spread inside a league would be nil.
  const leanOf = men => {
    const b = men.filter(bats);
    return b.reduce((t, p) => t + (p.skills.vsPace - p.skills.vsSpin), 0) / b.length;
  };
  const sdOf = a => { const m = a.reduce((x, y) => x + y, 0) / a.length;
    return Math.sqrt(a.reduce((t, v) => t + (v - m) * (v - m), 0) / a.length); };
  const eng = world.find(w => w.cfg.id === 'eng').clubs.map(c => leanOf(c.men));
  assert.ok(sdOf(eng) > 2, 'English clubs do not all play the same way (spread '
    + sdOf(eng).toFixed(1) + ')');

  // AND THE HOUSE STYLE ITSELF, ASKED WHERE IT CAN ACTUALLY BE SEEN.
  //
  // This used to ask that ONE of England's sixteen came out fractionally the
  // spin side of nil. That is not the property; it is a coin the property
  // tosses, and the coin was measured. England is the most pace-leaning
  // country in the world (club mean +7.0, next is West Indies at +5.7), so its
  // clubs are the least likely of anybody's to cross zero, and the assertion
  // passed at -2.4 and failed at +0.3 on two worlds whose club-to-club spread
  // is the same to three per cent (5.14 against 5.33 over all 256 clubs).
  //
  // Worse, the lean CANNOT SEE THE HOUSE STYLE AT ALL, which was proved by
  // deleting it: build a world where every club takes its country's tilt
  // exactly and the club-to-club spread of batting lean is 5.10 against the
  // real 5.33 - inside the noise. The per-club tilt swings a club's expected
  // lean by about 5 points across its whole range while the eight-man sampling
  // error alone is 3.4, so a statistic built on it is mostly draw noise and
  // was always going to turn over on a re-deal.
  //
  // The house style is not small, though - it is just not in that number. A
  // club is built to one of ten ARCHETYPES (Kent are misers, Lancashire play
  // express pace, Hampshire keep wicket) and that is a large, stable signal:
  // profile two clubs of the SAME LEAGUE by their squad's own attribute ratios
  // and two built to different archetypes sit about 59% further apart than two
  // built to the same one. Measured 1.586 here, 1.587 on the shipped build and
  // 1.570 with the generation change alone - three differently dealt worlds
  // agreeing to a per cent, where the old statistic disagreed by its own sign.
  const P = ['vsPace', 'vsSpin', 'power', 'rotation', 'temperament', 'wicket', 'economy',
    'discipline', 'moveTurn', 'variation', 'stamina', 'fielding', 'catching', 'keeping', 'stumping'];
  const profiles = [];
  for (const { cfg, clubs } of world) for (const { club, men } of clubs) {
    const m = P.map(k => {
      let t = 0, c = 0;
      for (const p of men) if (p.skills[k] != null) { t += p.skills[k]; c++; }
      return c ? t / c : 0;
    });
    // in RATIOS to the squad's own mean, so a strong club and a weak one built
    // the same way read the same and this is style and not strength
    const base = m.reduce((a, b) => a + b, 0) / m.length;
    profiles.push({ nat: cfg.id, arch: club.arch, v: m.map(x => x / base) });
  }
  // EVERY PAIR HERE IS TWO CLUBS OF THE SAME COUNTRY, which is what the title
  // of this test says and is the difference between a real assertion and one
  // that cannot fail. Compare across countries and giving every English club
  // one house style still leaves it passing, because an English club and an
  // Indian one differ for reasons that have nothing to do with either club.
  const gap = (a, b) => Math.sqrt(a.v.reduce((t, x, i) => t + (x - b.v[i]) * (x - b.v[i]), 0));
  let same = 0, sameN = 0, diff = 0, diffN = 0, mostInOne = 0;
  for (const { cfg } of world) {
    const mine = profiles.filter(p => p.nat === cfg.id);
    mostInOne = Math.max(mostInOne, new Set(mine.map(p => p.arch)).size);
    for (let i = 0; i < mine.length; i++) for (let j = i + 1; j < mine.length; j++) {
      const d = gap(mine[i], mine[j]);
      if (mine[i].arch === mine[j].arch) { same += d; sameN++; } else { diff += d; diffN++; }
    }
  }
  assert.ok(mostInOne >= 5, 'a league is not one club sixteen times over - its clubs are built to '
    + mostInOne + ' different house styles');
  assert.ok(sameN > 0 && diffN > 0, 'there are both kinds of pair to compare inside a league ('
    + sameN + ' same-style, ' + diffN + ' different)');
  const ratio = (diff / diffN) / (same / sameN);
  assert.ok(ratio > 1.20, 'two clubs of one league built to different house styles are further '
    + 'apart than two built to the same one (' + ratio.toFixed(3) + 'x over '
    + profiles.length + ' clubs)');
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
