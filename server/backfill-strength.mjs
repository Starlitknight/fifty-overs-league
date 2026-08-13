// backfill-strength.mjs — GIVE EVERY CLUB THE NUMBER ITS ELEVEN IS WORTH.
//
// Migration 092 adds clubs.best_xi_strength and every write path fills it in
// from now on, but a club dealt before that has NULL and computeRankings has
// to work it out from the squad each tick. This walks the world once and
// settles them, so the fallback goes quiet and stays quiet.
//
// IDEMPOTENT BY CONSTRUCTION. The value is a pure function of the squad -
// squadStrength() in ratings.mjs, the same function the ranking has always
// used - so a second run computes what the first run computed and writes the
// same integer. There is no accumulation and no ordering: run it as often as
// you like, on a world mid-season, with the tick running alongside.
//
// It does NOT touch clubs.squad, so it cannot damage a cricketer. The worst a
// bad run can do is store a number the next squad write immediately corrects.
//
//   node backfill-strength.mjs            # report only, writes nothing
//   node backfill-strength.mjs --write    # settle them
//
// By default it only fills rows that are NULL. --all recomputes every club,
// which is what to reach for if squadStrength itself is ever changed.
import { makePool } from './db.mjs';
import { squadStrength } from './ratings.mjs';

export async function backfillStrength(pool, { write = false, all = false, quiet = false } = {}) {
  const rows = (await pool.query(
    `SELECT country_id, slot, name, squad, best_xi_strength
       FROM clubs ${all ? '' : 'WHERE best_xi_strength IS NULL'}
      ORDER BY country_id, slot`)).rows;
  let changed = 0, same = 0;
  for (const c of rows) {
    const want = squadStrength(Array.isArray(c.squad) ? c.squad : []);
    if (c.best_xi_strength === want) { same++; continue; }
    changed++;
    if (!quiet) {
      console.log('  ' + c.country_id + '/' + String(c.slot).padStart(2) + '  ' +
        String(c.name || '').padEnd(24) + '  ' +
        (c.best_xi_strength == null ? 'none' : String(c.best_xi_strength)) + ' -> ' + want);
    }
    if (write) {
      await pool.query(
        'UPDATE clubs SET best_xi_strength=$3 WHERE country_id=$1 AND slot=$2',
        [c.country_id, c.slot, want]);
    }
  }
  if (!quiet) {
    console.log((write ? 'settled ' : 'would settle ') + changed + ' club(s); ' +
      same + ' already correct; ' + rows.length + ' examined');
  }
  return { examined: rows.length, changed, same, wrote: write ? changed : 0 };
}

if (import.meta.url === 'file://' + process.argv[1]) {
  const write = process.argv.includes('--write');
  const all = process.argv.includes('--all');
  const pool = makePool();
  backfillStrength(pool, { write, all })
    .then(() => pool.end())
    .catch(e => { console.error('backfill-strength failed:', e.message); pool.end(); process.exit(1); });
}
