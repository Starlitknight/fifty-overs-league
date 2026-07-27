// report.mjs — THE WORLD REGISTER, read-only.
// A world nobody can look at is a world nobody can debug. This prints what
// the service actually holds - every nation, its ten clubs, who manages
// them, and what its published table says - so a question like "where has
// my club gone?" has an answer that is evidence rather than a guess.
// It writes nothing. Run it from the world-report workflow.
import { makePool } from './db.mjs';

const pool = makePool();
const only = (process.env.ONLY || '').trim();

const cs = (await pool.query(
  only ? 'SELECT id, name FROM countries WHERE id = $1' : 'SELECT id, name FROM countries ORDER BY id',
  only ? [only] : [])).rows;

const claims = (await pool.query(
  'SELECT country_id, slot, display_name FROM claims')).rows;
const claimAt = {};
for (const c of claims) claimAt[c.country_id + ':' + c.slot] = c.display_name;

for (const c of cs) {
  const clubs = (await pool.query(
    'SELECT slot, name, default_name, ground, is_boss FROM clubs WHERE country_id=$1 ORDER BY slot', [c.id])).rows;
  const snap = (await pool.query(
    `SELECT body FROM snapshots WHERE key=$1`, ['league/' + c.id])).rows[0];
  const inTable = {};
  for (const r of ((snap && snap.body.table) || [])) inTable[r.slot] = r.name;
  console.log('\n=== ' + c.name + ' (' + c.id + ') ' +
    (snap ? 'season ' + snap.body.seasonNo + ', ' + snap.body.roundsPlayed + '/' + snap.body.rounds + ' rounds'
          : 'NO PUBLISHED TABLE'));
  for (const k of clubs) {
    const mgr = claimAt[c.id + ':' + k.slot];
    const served = inTable[k.slot];
    const flag = served === undefined ? '  MISSING FROM TABLE'
      : served !== k.name ? '  TABLE SAYS "' + served + '"' : '';
    // the founding name matters too: it is what a club falls back to when a
    // manager releases it, and the name validator guards against it as well
    const born = k.default_name && k.default_name !== k.name ? '  (founded as "' + k.default_name + '")' : '';
    console.log('  ' + k.slot + '  ' + k.name.padEnd(28) +
      (k.is_boss ? ' [flagship]' : mgr ? ' [' + mgr + ']' : ' [bot]') + born + flag);
  }
  const extra = Object.keys(inTable).filter(s => !clubs.some(k => String(k.slot) === String(s)));
  if (extra.length) console.log('  !! table carries slots with no club row: ' + extra.join(', '));
}

const orphan = claims.filter(c => !cs.some(x => x.id === c.country_id));
if (orphan.length) console.log('\n!! claims in unknown countries: ' + JSON.stringify(orphan));
console.log('\n' + claims.length + ' claimed club(s) across the world');

await pool.end();
