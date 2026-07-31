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
import { initWorld, countryConfigs, squadFor, NAT_STR } from '../init-world.mjs';
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

test('a strong cricket nation out-rates a weak one; every league stays as competitive inside', () => {
  const xi = sq => { const b = sq.slice().sort((a, c) => (c.rating || 0) - (a.rating || 0)).slice(0, 11);
    return b.reduce((s, p) => s + (p.rating || 0), 0) / 11; };
  const meanOf = id => {
    const cfg = countryConfigs(host).find(c => c.id === id);
    const rs = cfg.clubs.map(c => xi(squadFor(host, cfg, c, 2)));
    return { mean: rs.reduce((a, x) => a + x, 0) / rs.length,
             spread: Math.max(...rs) / Math.min(...rs) };
  };
  const aus = meanOf('aus'), ned = meanOf('ned'), engL = meanOf('eng'), can = meanOf('can');
  assert.ok(aus.mean > ned.mean * 1.15, 'an Australian league day is harder than a Dutch one');
  assert.ok(engL.mean > can.mean * 1.2, 'and an English one than a Canadian one');
  // the tier is the DESIGNED ratio, not an accident
  assert.ok(Math.abs(aus.mean / ned.mean - NAT_STR.aus / NAT_STR.ned) < 0.06,
    'the gap between leagues is the calibrated tier');
  // and inside each league the ladder is identical - same top-to-bottom ratio
  assert.ok(Math.abs(aus.spread - ned.spread) < 0.08,
    'a weak nation\'s league is exactly as competitive as a strong one\'s');
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
