// no-two-clubs-answer-to-one-name.test.mjs — A CLUB'S NAME IS ITS OWN.
//
// Ten pairs of clubs in the live world share a name with a club in their own
// league - two Galway CCs in Ireland, two Chicago CCs in the States, two
// Deventer CCs and two Groningen CCs in the Netherlands. Every pair is a
// Division One club and a Division Two club from the same town, because a
// county is "<city> CC" and so is the first entry of DIV2_STYLE.
//
// The generator has since been taught to seed Division Two with the names
// Division One holds, so a world founded today has no clash anywhere. The live
// world was founded before that, and nothing renames a club afterwards - so
// the fault survives only in the clubs table, and only a repair can reach it.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { makeHost } from '../enginehost.mjs';
import { initWorld } from '../init-world.mjs';
import { renameTwins } from '../rename-twins.mjs';
import { EPOCH, DAY, natHour } from '../clock.mjs';

const DB = 'fotwins_test';
// the world's clock is anchored to EPOCH, not to a date of our choosing:
// initWorld reckons its start day from it and the fixtures hang off that
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

// a club is managed by a CLAIM, which is how the world says who runs it
const claim = async (rid, slot, who) => {
  const cols = (await pool.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='claims'`)).rows.map(r => r.column_name);
  const has = (k) => cols.includes(k);
  await pool.query(
    `INSERT INTO claims(user_id, country_id, slot, display_name${has('claimed_at') ? ', claimed_at' : ''})
     VALUES (gen_random_uuid(), $1, $2, $3${has('claimed_at') ? ', now()' : ''})`, [rid, slot, who]);
};

const twinsNow = async () => (await pool.query(`
  SELECT country_id, name, count(*)::int AS n, array_agg(slot ORDER BY slot) AS slots
    FROM clubs GROUP BY country_id, name HAVING count(*) > 1
   ORDER BY country_id, name`)).rows;

// THE GUARD IS IN THE GENERATOR NOW, so this is what a world founded this
// morning looks like. If this ever fails, the repair below is treating a
// symptom the dealer has started producing again.
test('a world founded today deals no two clubs one name', async () => {
  const n = (await pool.query('SELECT count(*)::int c FROM clubs')).rows[0].c;
  assert.ok(n > 200, 'a world to measure (' + n + ' clubs)');
  assert.deepEqual(await twinsNow(), []);
});

// EXACTLY WHAT THE LIVE WORLD CARRIES: the Division Two newcomer wearing the
// name the Division One club from its town already had.
const breakIt = async () => {
  const pairs = [['ire', 3, 8], ['usa', 7, 9], ['ned', 6, 9], ['aus', 6, 9]];
  for (const [rid, one, two] of pairs) {
    const nm = (await pool.query(
      'SELECT name FROM clubs WHERE country_id=$1 AND slot=$2', [rid, one])).rows[0].name;
    await pool.query('UPDATE clubs SET name=$3, default_name=$3 WHERE country_id=$1 AND slot=$2',
      [rid, two, nm]);
  }
  return pairs;
};

test('the repair gives the newcomer its own name back', async () => {
  const pairs = await breakIt();
  assert.equal((await twinsNow()).length, pairs.length, 'broken on purpose first');

  const dry = await renameTwins(pool, host, { write: false, quiet: true });
  assert.equal(dry.renamed, pairs.length, 'the dry run finds every one');
  assert.equal((await twinsNow()).length, pairs.length, 'and changes nothing');

  const out = await renameTwins(pool, host, { write: true, quiet: true });
  assert.equal(out.renamed, pairs.length);
  assert.equal(out.stuck, 0, 'and none of them was immovable');
  assert.deepEqual(await twinsNow(), [], 'no name is shared any more');
});

// IT IS THE NEWCOMER THAT STEPS ASIDE. The established club keeps the name it
// has been playing under; the Division Two side takes the one the generator
// would deal it - "Galway Athletic", not "Galway CC 9".
test('the established club keeps its name and the newcomer takes the generator\'s', async () => {
  const row = async (rid, slot) => (await pool.query(
    'SELECT name, default_name FROM clubs WHERE country_id=$1 AND slot=$2', [rid, slot])).rows[0];
  const one = await row('ire', 3), two = await row('ire', 8);
  assert.equal(one.name, 'Galway CC', 'the Division One club is untouched');
  assert.equal(two.name, 'Galway Athletic', 'and the newcomer has a name of its own');
  // the birth name moves with it: a released claim restores default_name
  // (migration 007), which would otherwise hand the clash straight back
  assert.equal(two.default_name, 'Galway Athletic');
});

test('running it again renames nothing', async () => {
  const again = await renameTwins(pool, host, { write: true, quiet: true });
  assert.equal(again.renamed, 0, 'idempotent: there is nothing left to fix');
  assert.deepEqual(await twinsNow(), []);
});

// A MANAGER NAMES HIS OWN CLUB, and the generator has an opinion about that
// seat which is none of its business - eng/8 is Durham to the generator and
// whatever its manager called it to everybody else. A repair that "corrected"
// a managed club would be taking a name off a person.
test('a club somebody manages is never renamed, clash or no clash', async () => {
  const mine = 'Mashed Potatoes';
  await pool.query(
    `UPDATE clubs SET name=$1, default_name=$1 WHERE country_id='eng' AND slot=8`, [mine]);
  await claim('eng', 8, 'Santosh');
  await pool.query(
    `UPDATE clubs SET name=$1, default_name=$1 WHERE country_id='eng' AND slot=9`, [mine]);
  assert.equal((await twinsNow()).length, 1, 'two English clubs now share the manager\'s name');

  const out = await renameTwins(pool, host, { write: true, quiet: true });
  const kept = (await pool.query(
    `SELECT name FROM clubs WHERE country_id='eng' AND slot=8`)).rows[0].name;
  assert.equal(kept, mine, 'the managed club keeps the name its manager gave it');
  assert.equal(out.renamed, 1, 'only the unmanaged one moves');
  assert.deepEqual(await twinsNow(), []);
});

// AND WHEN IT CANNOT FIX A CLASH IT SAYS SO. Two managed clubs of one name is
// a thing only a person can settle; going quiet would let it read as clean.
test('a clash it cannot settle is reported rather than passed over', async () => {
  const both = 'The Same Name';
  await pool.query(`UPDATE clubs SET name=$1 WHERE country_id='aus' AND slot IN (2,3)`, [both]);
  await claim('aus', 2, 'One'); await claim('aus', 3, 'Other');
  const out = await renameTwins(pool, host, { write: true, quiet: true });
  assert.equal(out.renamed, 0, 'neither of them is ours to rename');
  assert.equal(out.stuck, 1, 'and the clash is counted as unsettled');
  assert.equal((await twinsNow()).length, 1, 'it is still there, and still visible');
});

// ---- AND THE RECORD DOES NOT COME OFF WITH THE NAME -------------------------
// This is the part that could actually hurt. A club's results are banked with
// the names AS PLAYED on the day, and the league book is refolded from those
// rows every tick - so a rename could in principle orphan a whole season.
//
// It does not, and this proves it rather than trusting the comment: tick.mjs
// reads each innings back to a SLOT through the match's own home and away
// names first, and only prints the club's CURRENT name at the end. The book
// therefore changes what it calls the club and nothing else about it.
test('a renamed club keeps every match it has played', async () => {
  const { runDue, rebuildSnapshots } = await import('../tick.mjs');
  const bookOf = async () => ((await pool.query(
    `SELECT body FROM snapshots WHERE key='league/ire'`)).rows[0] || {}).body;
  const rowOf = (b, nm) => ((b && b.table) || []).find(t => t.name === nm);

  // run the world forward until Ireland has actually played a round
  let day = START, before = null, played = null;
  for (; day < START + 40; day++) {
    await runDue(pool, host, 'ire', { now: EPOCH + day * DAY + (natHour('ire') + 1) * 3600000 });
    before = await bookOf();
    played = rowOf(before, 'Galway CC');
    if (played && played.p > 0) break;
  }
  assert.ok(played && played.p > 0, 'Galway CC has a record to lose: ' + JSON.stringify(played));
  const slot = played.slot;

  // rename it exactly as the repair would, then refold
  await pool.query(
    `UPDATE clubs SET name='Galway Wanderers', default_name='Galway Wanderers'
      WHERE country_id='ire' AND slot=$1`, [slot]);
  // REFOLD, do not play on: the book is rebuilt from the same matches, so
  // anything that moves below moved because of the rename and nothing else
  await rebuildSnapshots(pool, 'ire', EPOCH + day * DAY + (natHour('ire') + 1) * 3600000);

  const after = await bookOf();
  assert.equal(rowOf(after, 'Galway CC'), undefined, 'the old name is gone from the book');
  const now = rowOf(after, 'Galway Wanderers');
  assert.ok(now, 'and the club is in it under its new one');
  assert.equal(now.slot, slot, 'the same seat');
  assert.equal(now.p, played.p, 'the same matches played');
  assert.equal(now.pts, played.pts, 'the same points');
  assert.equal(now.rf, played.rf, 'and the same runs, to the run');
});
