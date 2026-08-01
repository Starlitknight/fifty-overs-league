// admin.mjs — THE OWNER'S HAND. A club is christened once, when it is
// founded, and no manager can rename it afterwards: the name goes into the
// register, the fixtures, the Cup draws and the honours board, and a league
// whose names move under it is a league with no memory. So this is now the
// ONLY door a name can change through - for the rare case a name should
// never have been taken. It obeys the same rules the founding does: the
// shared validator, no flagship, no name another club in that league already
// wears. It republishes the nation's table afterwards, so the world speaks
// the new name immediately instead of at the next round.
//
// Run from the world-admin workflow, which requires a typed confirmation.
import { makePool } from './db.mjs';
import { ensureSnapshots } from './tick.mjs';

const country = (process.env.COUNTRY || '').trim();
const slot = parseInt(process.env.SLOT || '', 10);
const name = (process.env.NEW_NAME || '').trim();

if (!country || !Number.isInteger(slot) || !name) {
  console.error('need COUNTRY, SLOT and NEW_NAME');
  process.exit(1);
}
if (slot === 0) {
  console.error('the flagship is never renamed by hand - it is the standing measure of its league');
  process.exit(1);
}

const pool = makePool();
const club = (await pool.query(
  'SELECT slot, name FROM clubs WHERE country_id=$1 AND slot=$2', [country, slot])).rows[0];
if (!club) { console.error('no club at ' + country + ':' + slot); process.exit(1); }

const mgr = (await pool.query(
  'SELECT display_name FROM claims WHERE country_id=$1 AND slot=$2', [country, slot])).rows[0];

// the same validator the manager's own rename runs through
const ok = (await pool.query('SELECT club_name_ok($1,$2,$3) AS nm', [country, slot, name])).rows[0].nm;
await pool.query('UPDATE clubs SET name=$3 WHERE country_id=$1 AND slot=$2', [country, slot, ok]);

console.log('renamed ' + country + ':' + slot + '  "' + club.name + '" -> "' + ok + '"' +
  (mgr ? '  (manager: ' + mgr.display_name + ')' : '  (unmanaged)'));

// the served table carries names; republish so no device waits for a round
const filled = await ensureSnapshots(pool);
console.log(filled.length ? 'republished: ' + filled.join(', ') : 'tables already current');

const after = (await pool.query(
  `SELECT body FROM snapshots WHERE key=$1`, ['league/' + country])).rows[0];
if (after) {
  console.log('\nthe ' + country + ' table now reads:');
  (after.body.table || []).forEach((r, i) => console.log('  ' + (i + 1) + '  ' + r.name + '  ' + r.pts + ' pts'));
}

await pool.end();
