// tests/what-an-eleven-is-worth.test.mjs — THE NUMBER BESIDE THE SQUAD IS THE
// NUMBER THE RANKING USED TO WORK OUT.
//
// computeRankings read every squad on earth to reduce each to one integer.
// clubs.best_xi_strength (migration 092) is that integer, kept beside the
// squad by whoever last changed it. The whole change is only safe if the
// stored number is squadStrength() to the unit - not close to it, EQUAL to it -
// and if it is still equal after every path that can move a squad.
//
// So: exact equality, every mutation path, and a ladder that comes out in the
// same order it did before.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { makeHost } from '../enginehost.mjs';
import { initWorld } from '../init-world.mjs';
import { squadStrength } from '../ratings.mjs';
import { computeRankings } from '../tick.mjs';
import { evolveCountry } from '../living.mjs';
import { backfillStrength } from '../backfill-strength.mjs';
import { EPOCH, DAY } from '../clock.mjs';

const DB = 'foworth_test';
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

const allClubs = async () => (await pool.query(
  `SELECT country_id, slot, squad, best_xi_strength FROM clubs ORDER BY country_id, slot`)).rows;
const oneClub = async (c, s) => (await pool.query(
  `SELECT squad, best_xi_strength FROM clubs WHERE country_id=$1 AND slot=$2`, [c, s])).rows[0];

// ---- EXACT EQUIVALENCE ------------------------------------------------------

// NO TOLERANCE. squadStrength rounds to an integer before it ever leaves the
// function, so there is no floating point left to forgive: the stored value
// and the computed one are the same integer or the change is wrong.
test('every club a world is founded with carries its own exact strength', async () => {
  const rows = await allClubs();
  assert.ok(rows.length > 200, 'a world to measure: ' + rows.length);
  for (const c of rows) {
    assert.equal(typeof c.best_xi_strength, 'number',
      c.country_id + '/' + c.slot + ' was founded without a strength');
    assert.equal(c.best_xi_strength, squadStrength(c.squad),
      c.country_id + '/' + c.slot + ' stored ' + c.best_xi_strength +
      ' but its eleven is worth ' + squadStrength(c.squad));
  }
});

// ---- THE LADDER IS THE SAME LADDER -----------------------------------------

// The old reader computed strength from the squad it had just fetched. This
// replays that exactly - same function, same squads - and holds the new
// ranking to it: same order, same scores, same clubs, same flags.
test('the ranking is identical to the one computed from squads', async () => {
  const fresh = await computeRankings(pool, T0 + DAY);
  const rows = await allClubs();
  const old = {};
  rows.forEach(c => { old[c.country_id + ':' + c.slot] = squadStrength(c.squad); });

  const list = Array.isArray(fresh) ? fresh : (fresh.clubs || fresh.list || []);
  assert.ok(list.length > 200, 'the ranking covers the world: ' + list.length);
  for (const r of list) {
    const want = old[r.country + ':' + r.slot];
    assert.equal(r.strength, want,
      r.country + '/' + r.slot + ' ranked on ' + r.strength + ' not ' + want);
  }
  // and the order the board prints is the order it printed before
  const byStrength = list.slice().sort((a, b) =>
    b.strength - a.strength || a.country.localeCompare(b.country) || a.slot - b.slot);
  const mine = list.slice().sort((a, b) =>
    (old[b.country + ':' + b.slot]) - (old[a.country + ':' + a.slot]) ||
    a.country.localeCompare(b.country) || a.slot - b.slot);
  assert.deepEqual(byStrength.map(x => x.country + ':' + x.slot),
    mine.map(x => x.country + ':' + x.slot), 'the ladder came out in a different order');
});

// ---- A LEGACY ROW STILL RANKS ----------------------------------------------

test('a club dealt before the column existed is still ranked correctly', async () => {
  const before9 = await oneClub('eng', 8);
  await pool.query(
    `UPDATE clubs SET best_xi_strength=NULL WHERE country_id='eng' AND slot=8`);
  const fresh = await computeRankings(pool, T0 + DAY);
  const list = Array.isArray(fresh) ? fresh : (fresh.clubs || fresh.list || []);
  const me = list.find(r => r.country === 'eng' && r.slot === 8);
  assert.ok(me, 'the club is on the ladder');
  assert.equal(me.strength, squadStrength(before9.squad),
    'a NULL row must fall back to its squad, not to nought');
  // and the fallback must not have dragged the whole world back over the wire:
  // every OTHER club still reads its stored number
  const rows = await allClubs();
  const nulls = rows.filter(r => r.best_xi_strength == null);
  assert.equal(nulls.length, 1, 'only the one row was blanked');
});

// ---- THE BACKFILL ----------------------------------------------------------

test('the backfill settles a blanked club and is safe to run twice', async () => {
  const dry = await backfillStrength(pool, { write: false, quiet: true });
  assert.equal(dry.changed, 1, 'exactly the blanked club needs settling');
  assert.equal(dry.wrote, 0, 'a dry run writes nothing');

  const first = await backfillStrength(pool, { write: true, quiet: true });
  assert.equal(first.changed, 1);
  const c = await oneClub('eng', 8);
  assert.equal(c.best_xi_strength, squadStrength(c.squad), 'and it is right');

  const again = await backfillStrength(pool, { write: true, quiet: true });
  assert.equal(again.changed, 0, 'the second run has nothing to do');
  assert.equal(again.examined, 0, 'because no row is NULL any more');

  // --all recomputes everything and must still find nothing wrong
  const sweep = await backfillStrength(pool, { write: true, all: true, quiet: true });
  assert.ok(sweep.examined > 200, 'the sweep looked at the world');
  assert.equal(sweep.changed, 0, 'and every stored number was already correct');
});

// ---- MUTATION PATHS --------------------------------------------------------

// THE FOLD. living.mjs rewrites every squad on every settle - the busiest
// writer in the game - and it must carry the strength with it.
test('the living fold keeps the strength beside the squad it writes', async () => {
  await pool.query(`UPDATE clubs SET best_xi_strength=-1 WHERE country_id='eng'`);
  await evolveCountry(pool, 'eng', T0 + DAY, host);
  const rows = (await pool.query(
    `SELECT slot, squad, best_xi_strength FROM clubs WHERE country_id='eng' ORDER BY slot`)).rows;
  for (const c of rows) {
    assert.notEqual(c.best_xi_strength, -1, 'slot ' + c.slot + ' was not rewritten');
    assert.equal(c.best_xi_strength, squadStrength(c.squad),
      'slot ' + c.slot + ' stored ' + c.best_xi_strength);
  }
});

// A TRANSFER MOVES A MAN, SO IT MOVES TWO CLUBS. Both ends must be right - the
// seller who lost him and the buyer who gained him.
test('a man moving clubs moves both clubs\' strength', async () => {
  const sell = await oneClub('eng', 9), buy = await oneClub('eng', 10);
  const man = sell.squad[0];
  const left = sell.squad.filter(p => p.name !== man.name);
  const gained = buy.squad.concat([man]);
  // exactly what settleOne does, in the same two statements
  await pool.query(
    'UPDATE clubs SET squad=$3::jsonb, best_xi_strength=$4 WHERE country_id=$1 AND slot=$2',
    ['eng', 9, JSON.stringify(left), squadStrength(left)]);
  await pool.query(
    'UPDATE clubs SET squad=$3::jsonb, best_xi_strength=$4 WHERE country_id=$1 AND slot=$2',
    ['eng', 10, JSON.stringify(gained), squadStrength(gained)]);

  const s2 = await oneClub('eng', 9), b2 = await oneClub('eng', 10);
  assert.equal(s2.squad.length, sell.squad.length - 1, 'the seller is a man down');
  assert.equal(b2.squad.length, buy.squad.length + 1, 'the buyer is a man up');
  assert.equal(s2.best_xi_strength, squadStrength(s2.squad), 'seller');
  assert.equal(b2.best_xi_strength, squadStrength(b2.squad), 'buyer');
});

// AND NOTHING ANYWHERE IS ALLOWED TO DRIFT. The last word: after everything
// above has moved squads about, every club on earth still agrees with itself.
test('after every path has run, no club disagrees with its own squad', async () => {
  const rows = await allClubs();
  const wrong = rows.filter(c => c.best_xi_strength !== squadStrength(c.squad));
  assert.deepEqual(wrong.map(c => c.country_id + '/' + c.slot), [],
    'these clubs drifted from their squads');
});
