// tests/world-conditions.test.mjs — THE WORLD GETS ITS WEATHER, ITS SOIL,
// ITS ACCENTS AND ITS PECKING ORDER.
//
// Until now the umpire bowled every ball of every match in every nation on a
// 'balanced' pitch under a default sky, every league drew from one identical
// talent pool, and every unmanaged club batted on the engine's one default
// plan. These prove the four systems that replace that:
//   1. CONDITIONS - each nation has a climate, each home club a groundsman,
//      the forecast is deterministic, and the umpire plays the pitch the
//      forecast promised;
//   2. WEATHER REACHES THE CRICKET - the same fixture under a different sky
//      is a different match, and drizzle can cut overs and revise a chase;
//   3. TIERS - a strong cricket nation's league genuinely out-rates a weak
//      one's, while every league stays exactly as competitive INSIDE itself;
//   4. IDENTITY - a bot plays its archetype's cricket, and the same archetype
//      wears a different accent in a different country.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld, countryConfigs, squadFor, TIER_XI_BAND } from '../init-world.mjs';
import { makeHost } from '../enginehost.mjs';
import { runDue } from '../tick.mjs';
import { EPOCH, DAY, dayOfRound } from '../clock.mjs';

const DBNAME = 'foworld_cond_test';
let pool, host;
const START = 101;
const T0 = EPOCH + (START - 1) * DAY + 12 * 3600000;
const atDay = (d, h) => EPOCH + d * DAY + h * 3600000;
const dayOf = r => START + dayOfRound(r);

before(async () => {
  try { execSync('dropdb --if-exists ' + DBNAME); } catch {}
  execSync('createdb ' + DBNAME);
  process.env.PGDATABASE = DBNAME;
  pool = makePool();
  await migrate(pool);
  host = makeHost();
  assert.equal((await initWorld(pool, { now: T0, host })).created, true);
});
after(async () => { await pool.end(); });

test('the forecast is deterministic, national, and tilted by the home groundsman', () => {
  const a = host.condFor('eng', 2, 1, 5), b = host.condFor('eng', 2, 1, 5);
  assert.deepEqual(a, b, 'the same fixture always gets the same conditions');
  assert.notDeepEqual(host.condFor('eng', 2, 1, 6), undefined);

  // climate: over a long run of fixtures England is green-and-cloud country,
  // the subcontinent is turn-and-heat country
  const tally = (rid, slot) => {
    const p = {}, w = {};
    for (let r = 1; r <= 400; r++) {
      const c = host.condFor(rid, slot, 1, r);
      p[c.pitch] = (p[c.pitch] || 0) + 1;
      w[c.weather] = (w[c.weather] || 0) + 1;
    }
    return { p, w };
  };
  const eng = tally('eng', 5), sub = tally('sub', 5);
  assert.ok((eng.p.green || 0) > (sub.p.green || 0) * 3, 'England is far greener than India');
  assert.ok((sub.p.dry || 0) > (eng.p.dry || 0) * 3, 'India turns far more than England');
  assert.ok((eng.w.Drizzle || 0) > 20, 'England carries a real forecast of rain');
  assert.equal(sub.w.Drizzle || 0, 0, 'Indian league days do not drizzle');

  // the groundsman: an express club's own square leans greener than a
  // batting club's in the same country - same climate, different orders to
  // the man with the mower. (Comparing against a ROCK home, whose tilt is
  // toward true batting surfaces, not against slot 5 - the engine room keeps
  // a touch of green itself.)
  const cfg = countryConfigs(host).find(c => c.id === 'eng');
  const express = cfg.clubs.findIndex(c => c.arch === 'express');
  const rock = cfg.clubs.findIndex(c => c.arch === 'rock');
  assert.ok(express >= 0 && rock >= 0, 'England fields both a pace battery and a stonewall');
  const paceHome = tally('eng', express), batHome = tally('eng', rock);
  assert.ok((paceHome.p.green || 0) > (batHome.p.green || 0) * 1.25,
    'the pace battery\'s groundsman leaves the grass on; the stonewall\'s rolls it flat (' +
    (paceHome.p.green || 0) + ' vs ' + (batHome.p.green || 0) + ' green days in 400)');
});

test('weather reaches the cricket, and drizzle can cut a chase down', () => {
  const cfg = countryConfigs(host).find(c => c.id === 'eng');
  const A = { name: 'A', players: squadFor(host, cfg, cfg.clubs[1], 1) };
  const B = { name: 'B', players: squadFor(host, cfg, cfg.clubs[2], 1) };
  const sunny = host.runMatch(A, B, 'balanced', 4242, null, 'Sunny');
  const cast = host.runMatch(A, B, 'balanced', 4242, null, 'Overcast');
  assert.ok(sunny && cast);
  assert.notEqual(sunny, cast, 'the same fixture under a different sky is a different match');

  // drizzle: somewhere in a handful of seeds, an interruption revises the
  // chase - the engine logs it and caps the overs
  let rained = false;
  for (let s = 1; s <= 12 && !rained; s++) {
    const r = JSON.parse(host.runMatch(A, B, 'balanced', 9000 + s, null, 'Drizzle'));
    const chase = r.innings && r.innings[1];
    if (chase && chase.legal < 300 && r.winner) rained = true;
    if (JSON.stringify(r).indexOf('RAIN at') >= 0) rained = true;
  }
  assert.ok(rained, 'drizzle produced at least one rain-affected chase in twelve matches');
});

test('the umpire plays the pitch the forecast promised, and banks it', async () => {
  await runDue(pool, host, 'eng', { now: atDay(dayOf(3), 23) });
  const rows = (await pool.query(
    `SELECT round, home_slot, pitch FROM matches WHERE country_id='eng' ORDER BY round, id`)).rows;
  assert.ok(rows.length >= 15, 'three rounds banked');
  const kinds = new Set(rows.map(r => r.pitch));
  assert.ok(kinds.size >= 2, 'a real season is not one pitch fifteen times: ' + [...kinds].join(','));
  for (const r of rows) {
    const c = host.condFor('eng', r.home_slot, 1, r.round);
    assert.equal(r.pitch, c.pitch,
      'round ' + r.round + ' at slot ' + r.home_slot + ' played on the forecast pitch');
  }
});

test('a bot plays its archetype; a manager\'s own sheet always wins', async () => {
  const cfg = countryConfigs(host).find(c => c.id === 'eng');
  const bySlot = {}; cfg.clubs.forEach(c => { bySlot[c.slot] = c.arch; });
  const rows = (await pool.query(
    `SELECT home_slot, away_slot, home_name, away_name, orders FROM matches
      WHERE country_id='eng' AND round=1`)).rows;
  const DOC = { blade: 1, finisher: 1, rock: 1, greybeard: 1 };
  let checked = 0;
  for (const m of rows) {
    for (const [slot, name] of [[m.home_slot, m.home_name], [m.away_slot, m.away_name]]) {
      const arch = bySlot[slot];
      if (!DOC[arch]) continue;
      const o = (m.orders || {})[name];
      assert.ok(o && o.phaseIntent, name + ' (' + arch + ') filed its doctrine');
      if (arch === 'rock') assert.equal(o.phaseIntent.pp, -1, 'the stonewall sees off the new ball');
      if (arch === 'blade') assert.equal(o.phaseIntent.pp, 1, 'the cavaliers attack it');
      if (arch === 'finisher') assert.equal(o.phaseIntent.death, 2, 'the finishers keep their powder dry');
      checked++;
    }
  }
  assert.ok(checked >= 3, 'several archetype sheets were actually checked, got ' + checked);
});

// A FULL MEMBER'S LEAGUE IS HARDER THAN AN ASSOCIATE'S, AND B2 CHANGED HOW.
//
// It used to be a RATIO, and the assertion said so: aus.mean / ned.mean had to
// equal NAT_STR.aus / NAT_STR.ned to within six points, because every club in
// the world was one baked squad scaled by its nation's multiplier. There is no
// multiplier now. An associate's clubs are dealt one TIER lower (tierOfClub),
// which is a different and much larger statement: a Dutch flagship is dealt the
// distribution an English d1a club is dealt, top to bottom, star chance
// included. So the ratio the old assertion demanded is not what the world is
// built to produce, and holding the world to it would mean putting the
// multiplier back.
//
// What survives is the pair of facts the ratio was standing in for, and they are
// asserted on the cricketers themselves: an Australian league day is genuinely
// harder than a Dutch one, and a weak nation's own league is exactly as
// competitive INSIDE ITSELF as a strong one's - which is the property that keeps
// every domestic season worth playing.
test('a strong cricket nation out-rates a weak one; every league stays as competitive inside', () => {
  const xiCard = sq => {
    const o = host.pkOvr(sq).slice().sort((a, b) => b - a).slice(0, 11);
    return o.reduce((s, v) => s + v, 0) / o.length;
  };
  const meanOf = id => {
    const cfg = countryConfigs(host).find(c => c.id === id);
    const rs = cfg.clubs.map(c => xiCard(squadFor(host, cfg, c, 2)));
    return { mean: rs.reduce((a, x) => a + x, 0) / rs.length,
             spread: Math.max(...rs) - Math.min(...rs) };
  };
  const aus = meanOf('aus'), ned = meanOf('ned'), engL = meanOf('eng'), nep = meanOf('nep');
  // a tier of the world, measured in cards of best XI. Bounded on both sides:
  // too small and the distinction stops meaning anything, too large and an
  // associate stops being able to field a professional side at all.
  for (const [big, small, what] of [[aus, ned, 'Australia over the Netherlands'],
                                    [engL, nep, 'England over Nepal']]) {
    const gap = big.mean - small.mean;
    assert.ok(gap >= 4, what + ': the gap is only ' + gap.toFixed(1) + ' cards');
    assert.ok(gap <= 12, what + ': the gap is ' + gap.toFixed(1) + ' cards, which is more than a tier');
  }
  // and inside each league the ladder is the same shape - the same spread from
  // its best club to its worst, because both are dealt from six tiers of one
  // ladder with only the starting rung moved
  assert.ok(Math.abs(aus.spread - ned.spread) < 6,
    'a weak nation\'s league is as competitive as a strong one\'s (spread ' +
    aus.spread.toFixed(1) + ' v ' + ned.spread.toFixed(1) + ')');
});

test('the same archetype wears a different accent in a different country', () => {
  const spinKinds = (id) => {
    const cfg = countryConfigs(host).find(c => c.id === id);
    const club = cfg.clubs.find(c => c.arch === 'wizard');
    if (!club) return null;
    const sq = squadFor(host, cfg, club, 2);
    return sq.filter(p => p.bowlTypeFull === 'wristSpin' || p.bowlTypeFull === 'fingerSpin')
      .map(p => p.bowlTypeFull);
  };
  const india = spinKinds('sub'), afghan = spinKinds('afg');
  assert.ok(india && india.length >= 3, 'an Indian spin circus carries real spinners');
  assert.ok(afghan && afghan.length >= 3, 'so does an Afghan one');
  assert.ok(india.filter(k => k === 'fingerSpin').length > india.length / 2,
    'India\'s circus is built on finger spin: ' + india.join(','));
  assert.ok(afghan.filter(k => k === 'wristSpin').length > afghan.length / 2,
    'Afghanistan\'s on wrist spin: ' + afghan.join(','));
});

// THE CLAIM PATH, IN CANONICAL TERMS (B2).
//
// This used to check that a claimed club's XI rating landed within 2% of
// BASE_XI x NAT_STR x HUMAN_STR - 25,336 in an associate - because the levelling
// ran calibrate() at exactly that target. Both halves are gone: the target was
// a figure on a rating scale that no longer exists, and the method was the
// four-pass skill scaling B2 retired. A claimed club is now laid on the NEWCOMER
// TIER, through the identical engine function that lays a newly founded one,
// which is the actual product promise - "whatever seat the lottery gave you, you
// start where every newcomer starts" - rather than a number it happened to hit.
test('a fresh claim is levelled to the newcomer rung once - and only once', async () => {
  const xiCard = sq => {
    const o = host.pkOvr(sq).slice().sort((a, b) => b - a).slice(0, 11);
    return o.reduce((s, v) => s + v, 0) / o.length;
  };
  // a newcomer founds in whatever Division Two seat the lottery left open -
  // this claims the one whose dealt squad sits FURTHEST from the newcomer's
  // world, exactly the unfairness the levelling exists to end
  const U = '22222222-2222-4222-8222-222222222222';
  const mid = (TIER_XI_BAND.newcomer[0] + TIER_XI_BAND.newcomer[1]) / 2;
  const seats = (await pool.query(
    `SELECT slot, squad FROM clubs WHERE country_id='sco' AND slot >= 8 ORDER BY slot`)).rows;
  const seat = seats.slice().sort((a, b) =>
    Math.abs(xiCard(b.squad) - mid) - Math.abs(xiCard(a.squad) - mid))[0];
  const before = xiCard(seat.squad);
  assert.ok(before > TIER_XI_BAND.newcomer[1],
    'the seat really was a lottery: its dealt XI reads ' + before.toFixed(1) +
    ', above the newcomer band ' + TIER_XI_BAND.newcomer.join('-'));
  await pool.query(
    `INSERT INTO claims(user_id, display_name, country_id, slot, levelled)
     VALUES ($1,'Newcomer','sco',$2,false)`, [U, seat.slot]);

  await runDue(pool, host, 'sco', { now: atDay(dayOf(1), 23) });
  const club = (await pool.query(
    `SELECT squad FROM clubs WHERE country_id='sco' AND slot=$1`, [seat.slot])).rows[0].squad;
  const afterXi = xiCard(club);
  assert.ok(afterXi >= TIER_XI_BAND.newcomer[0] && afterXi <= TIER_XI_BAND.newcomer[1],
    'the same men, laid on the newcomer curve: XI ' + afterXi.toFixed(1) +
    ' against ' + TIER_XI_BAND.newcomer.join('-'));
  // THE SAME MEN. The board's investment raises the squad; it does not replace
  // it, and a levelling that quietly redealt the club would pass every line
  // above and be the worst possible bug in this path.
  const wasNames = seat.squad.map(p => p.name).sort();
  const nowNames = club.map(p => p.name).sort();
  assert.deepEqual(nowNames, wasNames, 'every man he inherited is still his');
  assert.equal(club.filter(p => p.keeper || p.role === 'wicketkeeper').length,
    seat.squad.filter(p => p.keeper || p.role === 'wicketkeeper').length,
    'and he still has his keepers');
  assert.equal(club.filter(p => p.bowlType && p.bowlType !== 'none').length,
    seat.squad.filter(p => p.bowlType && p.bowlType !== 'none').length,
    'and his attack');
  assert.equal((await pool.query(
    `SELECT levelled FROM claims WHERE country_id='sco' AND slot=$1`, [seat.slot])).rows[0].levelled, true);

  // ONCE. The manager trains a man; the next tick must not undo his work.
  await pool.query(
    `UPDATE clubs SET squad = jsonb_set(squad, '{0,skills,vsPace}', '95') WHERE country_id='sco' AND slot=$1`, [seat.slot]);
  await runDue(pool, host, 'sco', { now: atDay(dayOf(1), 23) });
  const after = (await pool.query(
    `SELECT squad FROM clubs WHERE country_id='sco' AND slot=$1`, [seat.slot])).rows[0].squad;
  assert.equal(after[0].skills.vsPace, 95, 'training survives - the levelling never runs twice');
});

test('both claim doors mark the newcomer for levelling', async () => {
  // nearly every manager arrives through world_auto_claim (signing up IS
  // claiming); the picky ones use world_claim_club. Either door must leave
  // the claim waiting for the umpire's levelling - a door that forgot would
  // quietly reopen the seat lottery for everyone who walked through it.
  const rpc = async (user, sql) => {
    const c = await pool.connect();
    try {
      await c.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: user })]);
      return await c.query(sql);
    } finally {
      await c.query(`SELECT set_config('request.jwt.claims', '', false)`).catch(() => {});
      c.release();
    }
  };
  const picked = await rpc('33333333-3333-4333-8333-333333333333',
    `SELECT public.world_claim_club('ned', 9, 'Chooser') AS r`);
  assert.equal(picked.rows[0].r.ok, true);
  const auto = await rpc('44444444-4444-4444-8444-444444444444',
    `SELECT public.world_auto_claim('ned', 'Walker') AS r`);
  assert.equal(auto.rows[0].r.ok, true);
  const rows = (await pool.query(
    `SELECT slot, levelled FROM claims WHERE country_id='ned' ORDER BY slot`)).rows;
  assert.equal(rows.length, 2, 'both doors seated a manager');
  rows.forEach(r => {
    assert.ok(r.slot >= 8 && r.slot <= 15, 'a manager founds in Division Two, seat ' + r.slot);
    assert.equal(r.levelled, false, 'slot ' + r.slot + ' waits for its levelling');
  });
  // and the established counties are simply not for sale
  await assert.rejects(rpc('55555555-5555-4555-8555-555555555555',
    `SELECT public.world_claim_club('ned', 1, 'Buyer')`), /not for sale/);
});
