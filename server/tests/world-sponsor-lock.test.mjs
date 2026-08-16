// world-sponsor-lock.test.mjs — THE SPONSOR'S SIGNATURE CANNOT CHASE RESULTS.
//
// The exploit this file forbids: a manager signs CONTENDER, watches the first
// fortnight go wrong, and re-signs SAFE with the guarantee back-paid - or the
// mirror image, a SAFE signer flipping to CONTENDER once the side looks like
// winning. Era 2's sponsor is a close-season contract (migration 100), and
// the close season is the ONLY time the pen works:
//
//   1. while the latest season has no cricket in the record, a pick binds
//      THAT season, and the club may change its mind freely - that is the
//      selection window, and it must genuinely work;
//   2. the moment the season has a match banked - and the umpire banks round
//      one BEFORE its broadcast opens, so there is never a minute where a
//      result is visible and the pen still works - the pick binds the NEXT
//      season, and nothing the RPC can be fed touches the running one;
//   3. the walk pays every season under the deal that was signed for it:
//      re-picking for next summer never moves a dollar already settled.
//
// The enforcement lives in world_set_sponsor itself (SECURITY DEFINER, the
// target season computed server-side from the match record) - the client
// hiding a button is decoration, not law. These tests drive the RPC exactly
// as a hostile client would.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld } from '../init-world.mjs';
import { makeHost } from '../enginehost.mjs';
import { computeFinance } from '../economy.mjs';
import { SPONSOR_PACKAGES } from '../financeconfig.mjs';
import { EPOCH, DAY, ROUNDS, CYCLE } from '../clock.mjs';

const DB = 'fosponsorlock_test';
const UID = '88888888-8888-4888-8888-888888888888';
let pool, host, clubs;
const T0 = EPOCH + 100 * DAY + 12 * 3600000;   // era 2 (day 100 >= 42)
const START = 101;

const pick = async pkg =>
  (await pool.query(`SELECT world_set_sponsor($1) AS r`, [pkg])).rows[0].r;
const rowFor = async season =>
  (await pool.query(
    `SELECT package FROM sponsor_picks WHERE country_id='eng' AND slot=3 AND season_no=$1`,
    [season])).rows[0];

before(async () => {
  try { execSync(`dropdb --if-exists ${DB}`, { stdio: 'ignore' }); } catch (e) {}
  execSync(`createdb ${DB}`);
  process.env.PGDATABASE = DB;
  pool = makePool(); host = makeHost();
  await migrate(pool);
  await initWorld(pool, { now: T0, host });
  await pool.query(
    `INSERT INTO claims(user_id, country_id, slot, display_name, levelled) VALUES ($1,'eng',3,'Signer',true)`, [UID]);
  await pool.query(`CREATE OR REPLACE FUNCTION _uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT '${UID}'::uuid $$`);
  clubs = (await pool.query(
    `SELECT slot, name FROM clubs WHERE country_id='eng' ORDER BY slot`)).rows;
});
after(async () => { if (pool) await pool.end(); });

test('the window is open before a ball is bowled: the pick binds THIS season, freely', async () => {
  const r1 = await pick('contender');
  assert.equal(r1.ok, true);
  assert.equal(r1.season, 1, 'no cricket banked: the pick binds the season in front of us');
  // and the club may change its mind - the window is a window, not one shot
  const r2 = await pick('safe');
  assert.equal(r2.season, 1);
  assert.equal((await rowFor(1)).package, 'safe', 'the later signature replaces the earlier');
});

test('one banked match slams the window: every later pick binds NEXT season', async () => {
  // the umpire banks round one (the prebank runs before the broadcast even
  // opens); from this instant the running season's deal is signed for good
  await pool.query(
    `INSERT INTO matches(id, country_id, season_no, round, home_slot, away_slot, seed,
                         engine_version, pitch, orders, result, home_name, away_name)
     VALUES ('lock-1','eng',1,1,0,1,7,'test','fair','{}'::jsonb,$1::jsonb,$2,$3)`,
    [JSON.stringify({ winner: clubs[0].name }), clubs[0].name, clubs[1].name]);
  const r = await pick('contender');
  assert.equal(r.season, 2, 'a season with cricket keeps its signed deal');
  assert.equal((await rowFor(1)).package, 'safe', 'the running season\'s signature is untouched');
  assert.equal((await rowFor(2)).package, 'contender', 'the new pick waits for next summer');
  // and hammering the RPC with every package changes nothing about season 1
  for (const p of ['safe', 'balanced', 'contender']) {
    const r2 = await pick(p);
    assert.equal(r2.season, 2, 'the target is computed server-side, every time');
  }
  assert.equal((await rowFor(1)).package, 'safe', 'no amount of re-picking reaches a running season');
});

test('the walk pays the season under the deal it was signed for, whatever was picked since', async () => {
  // fabricate the rest of season 1 so the guarantee has its full shape
  let n = 0;
  const sea = (await pool.query(
    `SELECT schedule FROM seasons WHERE country_id='eng' AND season_no=1`)).rows[0];
  for (let round = 1; round <= ROUNDS; round++) {
    for (const dv of ['1', '2']) {
      for (const [h, a] of sea.schedule[dv][round - 1]) {
        await pool.query(
          `INSERT INTO matches(id, country_id, season_no, round, home_slot, away_slot, seed,
                               engine_version, pitch, orders, result, home_name, away_name)
           VALUES ($1,'eng',1,$2,$3,$4,$5,'test','fair','{}'::jsonb,$6::jsonb,$7,$8)
           ON CONFLICT (id) DO NOTHING`,
          ['lock-' + (++n), round, h, a, 900 + n,
           JSON.stringify({ winner: h < a ? clubs[h].name : clubs[a].name }),
           clubs[h].name, clubs[a].name]);
      }
    }
  }
  const rows = await computeFinance(pool, 'eng',
    { ledgerSlots: [3], now: EPOCH + (START + 40) * DAY });
  const f3 = rows.find(r => r.slot === 3).finance;
  assert.equal(f3.sponsorPackage, 'safe', 'season 1 settles under the deal signed before its first ball');
  const led = rows.find(r => r.slot === 3).ledger;
  const G = Math.round(f3.sponsorValue * SPONSOR_PACKAGES.safe.guaranteed);
  assert.equal(led.filter(l => l.kind === 'sponsor').reduce((a, l) => a + l.amount, 0), G,
    'the guarantee is SAFE\'s, though CONTENDER has been picked for season 2 since');
  // settle again: the same dollars - re-picking created no revision anywhere
  const again = await computeFinance(pool, 'eng', { now: EPOCH + (START + 40) * DAY });
  assert.equal(again.find(r => r.slot === 3).bank, rows.find(r => r.slot === 3).bank);
});

test('the next close season opens its own window, and only its own', async () => {
  // season 2 is founded with no cricket: the standing pick (contender) may
  // be rewritten - that is next summer's window doing its job
  const sea1 = (await pool.query(
    `SELECT start_day, divisions, schedule FROM seasons WHERE country_id='eng' AND season_no=1`)).rows[0];
  await pool.query(
    `INSERT INTO seasons(country_id, season_no, start_day, schedule, divisions)
     VALUES ('eng', 2, $1, $2, $3) ON CONFLICT DO NOTHING`,
    [sea1.start_day + CYCLE, JSON.stringify(sea1.schedule), JSON.stringify(sea1.divisions)]);
  const r = await pick('balanced');
  assert.equal(r.season, 2, 'the new season\'s close season signs the new season\'s deal');
  assert.equal((await rowFor(2)).package, 'balanced');
  assert.equal((await rowFor(1)).package, 'safe', 'history never reopens');
  // and one banked match in season 2 slams that window in turn
  await pool.query(
    `INSERT INTO matches(id, country_id, season_no, round, home_slot, away_slot, seed,
                         engine_version, pitch, orders, result, home_name, away_name)
     VALUES ('lock-s2','eng',2,1,0,1,11,'test','fair','{}'::jsonb,$1::jsonb,$2,$3)`,
    [JSON.stringify({ winner: clubs[0].name }), clubs[0].name, clubs[1].name]);
  const r2 = await pick('safe');
  assert.equal(r2.season, 3, 'season 2 is now signed for good');
  assert.equal((await rowFor(2)).package, 'balanced');
});

test('the offers on the table are the only offers', async () => {
  await assert.rejects(pool.query(`SELECT world_set_sponsor('reckless')`),
    /safe, balanced and contender/);
  await assert.rejects(pool.query(`SELECT world_set_sponsor(NULL)`),
    /safe, balanced and contender/);
});
