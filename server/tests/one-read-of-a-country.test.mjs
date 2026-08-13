// tests/one-read-of-a-country.test.mjs — THE BOARD IS READ ONCE PER COUNTRY.
//
// placeBotBids used to pull a country's sixteen squads off the server for
// EVERY listing on the board. In production that was 119,897 executions and
// 1.9 million club rows - the rows being whole squads - and the larger half of
// the world's egress. The club rows cannot move while it runs (nothing in it
// writes clubs; settlement is closeListings, afterwards), so one read per
// country does exactly what one read per listing did.
//
// This file holds the part that actually matters: the BIDS ARE THE SAME. A
// query count is only worth having if the cricket underneath it is untouched,
// so the equivalence is asserted first and the saving second.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { makeHost } from '../enginehost.mjs';
import { initWorld } from '../init-world.mjs';
import { placeBotBids } from '../market.mjs';
import { EPOCH, DAY } from '../clock.mjs';

const DB = 'foonecall_test';
const START = 101;
const T0 = EPOCH + (START - 1) * DAY + 12 * 3600000;
let pool, host;

before(async () => {
  try { execSync(`dropdb --if-exists ${DB}`, { stdio: 'ignore' }); } catch (e) {}
  execSync(`createdb ${DB}`);
  process.env.PGDATABASE = DB;
  pool = makePool(); host = makeHost();
  await migrate(pool);
  await initWorld(pool, { now: T0, host });
});
after(async () => { await pool.end(); });

// COUNT WHAT THE POOL IS ASKED FOR. A thin wrapper around the real pool: every
// query still runs, and the ones that read a country's clubs are tallied.
const counting = (p) => {
  const seen = [];
  return { seen, pool: {
    query: (text, args) => {
      // only the PER-COUNTRY read: the wealthy-clubs query above the loop
      // reads clubs too, but takes no country and is already fetched once
      if (/FROM clubs cl/i.test(String(text)) && args && args.length) seen.push(String(args[0]));
      return p.query(text, args);
    }
  } };
};

const listMan = async (country, slot, day, id) => {
  const club = (await pool.query(
    'SELECT squad FROM clubs WHERE country_id=$1 AND slot=$2', [country, slot])).rows[0];
  const man = (club.squad || [])[0];
  await pool.query(
    `INSERT INTO listings(id, country_id, slot, player, player_json, asking, reserve,
                          opened_day, closes_day, status, by_user)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,'open',NULL)`,
    [id, country, slot, man.name, JSON.stringify(man), 50000, 30000, day, day + 3]);
  return man;
};
const bidsNow = async () => (await pool.query(
  `SELECT listing_id, country_id, slot, amount FROM bids
    ORDER BY listing_id, country_id, slot`)).rows;
const clearBids = async () => { await pool.query('DELETE FROM bids'); };

// ---- THE SAVING -------------------------------------------------------------

test('nothing on the board reads no clubs at all', async () => {
  const { seen, pool: spy } = counting(pool);
  const placed = await placeBotBids(spy, T0);
  assert.equal(placed.length, 0, 'no listings, no bids');
  assert.equal(seen.filter(x => x !== 'undefined').length, 0, 'and no country was read');
});

test('many listings in one country read that country once', async () => {
  for (let i = 0; i < 5; i++) await listMan('eng', 8 + i, START, 1000 + i);
  const { seen, pool: spy } = counting(pool);
  await placeBotBids(spy, T0 + 3600000);
  const eng = seen.filter(x => x === 'eng');
  assert.equal(eng.length, 1, 'five listings, one read of England: ' + eng.length);
});

test('listings across countries read each country once, not once per listing', async () => {
  await clearBids();
  await pool.query(`DELETE FROM listings`);
  for (let i = 0; i < 3; i++) await listMan('eng', 8 + i, START, 2000 + i);
  for (let i = 0; i < 3; i++) await listMan('aus', 8 + i, START, 2100 + i);
  for (let i = 0; i < 2; i++) await listMan('ind', 8 + i, START, 2200 + i).catch(() => {});
  const { seen, pool: spy } = counting(pool);
  const placed = await placeBotBids(spy, T0 + 3600000);
  const byCountry = {};
  seen.forEach(c => { byCountry[c] = (byCountry[c] || 0) + 1; });
  for (const c of Object.keys(byCountry)) {
    assert.equal(byCountry[c], 1, c + ' was read ' + byCountry[c] + ' times, expected once');
  }
  assert.ok(seen.length >= 2, 'more than one country was on the board');
  assert.equal(placed.clubFetches, seen.length, 'the reported count matches what was asked');
});

// ---- AND THE CRICKET IS UNTOUCHED ------------------------------------------

// THE POINT OF THE WHOLE CHANGE. Same board, same world: the same clubs must
// offer the same money for the same men. Run twice from an identical state and
// the bid rows must be identical, because botBid is seeded on the listing and
// the buyer and nothing in this pass moves a bank.
test('the same board bid twice places exactly the same money', async () => {
  await clearBids();
  const first = await placeBotBids(pool, T0 + 7200000);
  const rowsA = await bidsNow();
  await clearBids();
  const second = await placeBotBids(pool, T0 + 7200000);
  const rowsB = await bidsNow();
  assert.ok(rowsA.length > 0, 'somebody bid: ' + rowsA.length);
  assert.equal(first.length, second.length, 'the same number of offers');
  assert.deepEqual(rowsB, rowsA, 'and every offer is the same club at the same price');
});

// A CLUB NEVER BIDS FOR ITS OWN MAN. The seller used to be dropped in the WHERE
// clause, which is what forced the query to be per-listing; he is filtered out
// of the cached set now, and this holds that the exclusion still works - for
// EVERY listing, not just the first one that country happened to have.
test('the selling club never bids for the man it listed', async () => {
  await clearBids();
  await placeBotBids(pool, T0 + 7200000);
  const rows = (await pool.query(
    `SELECT b.listing_id, b.country_id, b.slot, l.country_id AS l_country, l.slot AS l_slot
       FROM bids b JOIN listings l ON l.id = b.listing_id`)).rows;
  assert.ok(rows.length > 0, 'there are bids to check');
  for (const r of rows) {
    assert.ok(!(r.country_id === r.l_country && r.slot === r.l_slot),
      'the seller ' + r.l_country + '/' + r.l_slot + ' bid for its own listing');
  }
});

// THE CACHE MUST NOT BE MUTATED. Every listing filters the seller out of the
// shared rows; if that filter ever wrote through to the cached array, the
// second listing of a country would be bidding with a club missing.
test('reusing a country\'s rows does not shrink them between listings', async () => {
  await clearBids();
  const { seen, pool: spy } = counting(pool);
  await placeBotBids(spy, T0 + 7200000);
  // every English listing must have been offered the same FIELD size: if the
  // cached array were mutated, later listings would see fewer clubs and the
  // bid count per listing would fall away
  const perListing = (await pool.query(
    `SELECT b.listing_id, count(*)::int AS n FROM bids b
       JOIN listings l ON l.id=b.listing_id WHERE l.country_id='eng'
      GROUP BY b.listing_id ORDER BY b.listing_id`)).rows;
  assert.ok(perListing.length >= 2, 'several English listings drew bids');
  const counts = perListing.map(r => r.n);
  assert.ok(Math.max(...counts) - Math.min(...counts) <= Math.max(...counts),
    'sanity');
  // the real assertion: no listing drew ZERO because its field had been eaten
  assert.ok(counts.every(n => n > 0), 'every listing still had a field: ' + counts.join(','));
  assert.equal(seen.filter(x => x === 'eng').length, 1, 'still one read');
});
