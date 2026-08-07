// tests/world-schema-path.test.mjs — THE WORLD IN ITS OWN SCHEMA, READ FROM
// PUBLIC. This is production's shape and nothing else in the suite had it.
//
// The World Service pins search_path = world, public on every connection
// (server/db.mjs), so its tables and functions live in `world`. The browser
// does NOT come that way: PostgREST answers out of the public profile, so a
// public read view is running with `world` nowhere on its path. Anything a
// view's function reaches for by unqualified name at RUNTIME - and plpgsql
// resolves every name in a body at runtime - has to be findable from public
// or the whole dossier 404s.
//
// It did. A helper function added beside world_pk_num landed in `world`,
// world_pk_num went on calling it by bare name, and every request for another
// club's squad came back "function world_js_round(double precision) does not
// exist" while every server-side test passed, because the rest of the suite
// runs entirely in public - the one arrangement where the two schemas are the
// same schema and the bug cannot happen.
//
// So this file founds a world the way the service founds one, then reads it
// back the way a browser reads it, with search_path reset to public alone.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import pg from 'pg';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';

const DBNAME = 'foworld_schema_path_test';
const SCHEMA = 'world';
let pool;

// the browser's side of the wire: a connection with public and nothing else,
// which is what PostgREST gives a request on the public profile
function browserClient() {
  return new pg.Client({
    host: process.env.PGHOST || '/var/run/postgresql',
    database: DBNAME,
    user: process.env.PGUSER || process.env.USER || 'root'
  });
}

before(async () => {
  try { execSync('dropdb --if-exists ' + DBNAME); } catch {}
  execSync('createdb ' + DBNAME);
  process.env.PGDATABASE = DBNAME;
  // makePool is what the service itself calls, so the pinning under test is
  // the real pinning and not a copy of it that could drift
  process.env.WORLD_SCHEMA = SCHEMA;
  pool = makePool();
  await migrate(pool);
});
after(async () => { delete process.env.WORLD_SCHEMA; await pool.end(); });

test('a public read view works with the world schema off the path', async () => {
  // the world's own tables really did land in `world` and not in public
  const where = (await pool.query(
    `SELECT schemaname FROM pg_tables WHERE tablename='clubs'`)).rows.map(r => r.schemaname);
  assert.deepEqual(where, [SCHEMA], 'the service founded its tables in its own schema');

  // one club, one cricketer - enough for the card function to have work to do
  const man = {
    name: 'Boundary Case', role: 'opener', age: 27, hand: 'R', nat: 'England',
    rating: 34000, wage: 1500, keeper: false, bowlType: null, talents: [],
    skills: { vsPace: 61, vsSpin: 58, rotation: 55, temperament: 60, power: 57,
              wicket: 12, economy: 14, discipline: 16, moveTurn: 11, variation: 9,
              stamina: 40, keeping: 8, catching: 44, stumping: 6, fielding: 49 }
  };
  await pool.query(
    `INSERT INTO countries(id, name, play_hour_utc) VALUES ('eng','England',17)`);
  await pool.query(
    `INSERT INTO clubs(country_id, slot, name, default_name, ground, is_boss, squad, youth)
     VALUES ('eng', 3, 'Essex', 'Essex', 'Chelmsford', false, $1::jsonb, '[]'::jsonb)`,
    [JSON.stringify([man])]);

  // NOW READ IT AS THE BROWSER DOES: a fresh connection whose search_path is
  // public and nothing else, exactly like PostgREST on the public profile.
  const browser = browserClient();
  await browser.connect();
  try {
    await browser.query(`SET search_path TO public`);
    const row = (await browser.query(
      `SELECT players, wage_bill, team_batting, team_bowling, team_fielding
         FROM public.world_squads WHERE country_id='eng' AND slot=3`)).rows[0];
    assert.ok(row, 'the squad view answered at all');
    assert.equal(row.players.length, 1, 'and it carries the club\'s cricketer');
    assert.ok(row.players[0].ovr > 0, 'with a card rating the function actually computed');
    assert.equal(row.players[0].name, 'Boundary Case');

    // every public read surface the dossier and the league pages lean on,
    // proven reachable from a bare public path rather than assumed
    for (const view of ['world_clubs', 'world_squads', 'world_snapshots', 'world_comps']) {
      await assert.doesNotReject(
        browser.query(`SELECT * FROM public.${view} LIMIT 1`),
        view + ' is readable with the world schema off the path');
    }
  } finally { await browser.end(); }
});

test('the card function reaches for nothing it cannot see from public', async () => {
  // the direct statement of the rule, so a future helper trips here with a
  // message that says what the mistake was rather than a 404 on a live page
  const browser = browserClient();
  await browser.connect();
  try {
    await browser.query(`SET search_path TO public`);
    // qualified with the schema it actually lives in, called from a path that
    // does NOT include that schema - which is exactly PostgREST's position
    // when it runs a public view whose body binds to world.world_pk_num
    const r = (await browser.query(
      `SELECT ${SCHEMA}.world_pk_num($1::jsonb) AS num`,
      [JSON.stringify({ role: 'opener', skills: { vsPace: 61, vsSpin: 58, rotation: 55, temperament: 60, power: 57 } })])).rows[0];
    assert.ok(Number(r.num.ovr) > 0, 'world_pk_num is self-contained: no sibling it cannot resolve');
  } finally { await browser.end(); }
});
