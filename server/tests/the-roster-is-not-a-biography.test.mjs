// tests/the-roster-is-not-a-biography.test.mjs — A SQUAD PAGE DOES NOT
// DOWNLOAD FIFTEEN LIVES.
//
// world_squads is the public card, and it carried every man's milestones with
// it: a roster of sixteen fetched sixteen biographies to draw a table that
// shows none of them. The milestones belong to one screen - his own page - and
// only when somebody opens it, so they moved to world_player_profile.
//
// What this holds: the roster still carries every field the rooms that read it
// actually draw, the story is still reachable a man at a time, and one
// cricketer's life never arrives attached to another's.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { makeHost } from '../enginehost.mjs';
import { initWorld } from '../init-world.mjs';
import { EPOCH, DAY } from '../clock.mjs';

const DB = 'foroster_test';
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

const card = async (c = 'eng', s = 1) => (await pool.query(
  'SELECT players FROM world_squads WHERE country_id=$1 AND slot=$2', [c, s])).rows[0].players;

// ---- THE HOT CARD ----------------------------------------------------------

// EVERY FIELD THE ROOMS DRAW. Taken from the code that reads this view: the
// club dossier's roster (40-club-page), the ratings panel (45-ratings), the
// build-up (51-prematch) and the player card (52-served-truth). If a name
// disappears from here, one of those rooms goes blank.
const DRAWN = ['pid', 'name', 'nat', 'age', 'role', 'hand', 'bowl', 'type', 'bowlType',
  'keeper', 'rating', 'ovr', 'batting', 'bowling', 'fielding', 'keeping',
  'batComp', 'bowlComp', 'wage', 'value', 'talents', 'exp', 'form', 'fatigue', 'career'];

test('the card still carries every field the rooms actually draw', async () => {
  const men = await card();
  assert.ok(men.length >= 11, 'a squad to read: ' + men.length);
  for (const f of DRAWN) {
    assert.ok(f in men[0], 'the roster lost ' + f + ', which some room draws');
  }
});

test('and it no longer carries the biography', async () => {
  const men = await card();
  for (const p of men) {
    assert.ok(!('mile' in p), p.name + ' still arrives with his milestones on the roster');
  }
});

// A ROSTER IS ONE REQUEST. The point of moving the story out is to send less,
// not to send the same amount in twenty pieces: a squad page still gets its
// whole visible roster in a single row.
test('a whole roster still arrives in one row', async () => {
  const rows = (await pool.query(
    "SELECT players FROM world_squads WHERE country_id='eng' AND slot=1")).rows;
  assert.equal(rows.length, 1, 'one row per club, not one per player');
  assert.ok(rows[0].players.length >= 11, 'and every man is in it');
});

// ---- THE COLD CARD ---------------------------------------------------------

test('a man\'s story is reachable one cricketer at a time', async () => {
  const men = await card();
  const him = men.find(p => p.pid) || men[0];
  const rows = (await pool.query(
    'SELECT pid, name, mile, career FROM world_player_profile WHERE pid=$1', [him.pid])).rows;
  assert.equal(rows.length, 1, 'exactly one row for one id');
  assert.equal(rows[0].name, him.name, 'and it is the right man');
  assert.ok(Array.isArray(rows[0].mile), 'his milestones are an array');
  assert.ok(rows[0].career && typeof rows[0].career === 'object', 'and his career is an object');
});

// NOBODY ELSE'S LIFE COMES WITH IT. Asking for one man must return one man -
// the whole reason the profile is keyed by id and not by name, because two
// cricketers at one club can share a name.
test('asking for one man returns one man and no one else', async () => {
  const men = await card();
  const him = men.find(p => p.pid);
  const rows = (await pool.query(
    'SELECT pid FROM world_player_profile WHERE pid=$1', [him.pid])).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].pid, him.pid, 'and he is the man who was asked for');
});

test('a cricketer who has done nothing yet has an empty story, not a missing one', async () => {
  const rows = (await pool.query(
    `SELECT mile, career FROM world_player_profile WHERE jsonb_array_length(mile) = 0 LIMIT 1`)).rows;
  assert.ok(rows.length, 'a world days old has men with no milestones');
  assert.deepEqual(rows[0].mile, [], 'an empty list, never null');
  assert.ok(rows[0].career !== null, 'and a career object, never null');
});

test('every cricketer in the world has a profile row', async () => {
  const men = (await pool.query(
    `SELECT count(*)::int c FROM clubs, jsonb_array_elements(squad) p WHERE p->>'name' IS NOT NULL`)).rows[0].c;
  const prof = (await pool.query('SELECT count(*)::int c FROM world_player_profile')).rows[0].c;
  assert.equal(prof, men, 'one row a cricketer: ' + prof + ' vs ' + men);
});

// ---- AND THE PUBLIC DOOR IS THE SAME DOOR ----------------------------------

test('the profile is readable by the same roles the card is', async () => {
  const grants = (await pool.query(
    `SELECT grantee, table_name FROM information_schema.role_table_grants
      WHERE table_name IN ('world_squads','world_player_profile') AND privilege_type='SELECT'`)).rows;
  const on = t => grants.filter(g => g.table_name === t).map(g => g.grantee).sort();
  // whatever the card is granted to, the profile is granted to as well - no
  // more (nothing new is exposed) and no less (the page can still read it)
  assert.deepEqual(on('world_player_profile'), on('world_squads'),
    'the two cards must be readable by exactly the same roles');
});
