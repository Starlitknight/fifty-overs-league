// reseed-squads.mjs — REDEAL THE WORLD'S CRICKETERS, AND START THE SUMMER AGAIN.
//
// Two jobs, in this order, run from the world-reseed workflow behind a typed
// confirmation:
//
//   1. EVERY BOT CLUB IS GIVEN A NEW SQUAD, by the rules the world now keeps:
//      the identity its league describes and the standing its place in that
//      league earns - which means every flagship comes out the strongest side
//      in its own country. The squad comes from squadFor() in init-world.mjs,
//      the same call that founds a club on day one, so a club reseeded today
//      is built exactly as a club founded today would be.
//
//      NEW MEN, NOT THE SAME MEN AGAIN. squadFor()'s seed carries the world's
//      GENERATION, and this script bumps it before it deals. That is not a
//      detail: while the seed was the constant 'world1|<country>|<slot>' this
//      script re-derived each club from its position and handed back the very
//      fifteen it already had, so a manager could redeal the world and watch
//      nothing change. The generation is the difference between rebuilding a
//      club and reprinting it.
//
//   2. THE SEASON GOES BACK TO ROUND ONE. Every ball anybody has bowled is
//      cleared and the first round is re-dated to today, because a table half
//      played by the old squads is not a table at all.
//
// WHAT IS NEVER TOUCHED. A club a human has claimed keeps its squad: those men
// have been trained, bought and sold by somebody, and a redeal would take that
// away. Claims themselves, accounts and club names all survive - it is the same
// world, with its cricketers redealt and its season restarted, not a new one.
// RESEED_CLAIMED=YES-INCLUDING-MINE overrides that if the owner truly wants a
// clean sweep.
//
// MONEY NEEDS NO CLEARING. The books are derived from the record by
// economy.mjs, so wiping the record IS wiping the ledger; every club walks
// forward from its founding bank again on the next tick.
import { makePool } from './db.mjs';
import { makeHost } from './enginehost.mjs';
import { countryConfigs, squadFor, HUMAN_STR, foundingDivisions } from './init-world.mjs';
import { EPOCH, dayIx, scheduleOf, seasonSchedules } from './clock.mjs';

const confirm = (process.env.CONFIRM || '').trim();
if (confirm !== 'YES-RESEED') {
  console.error('refusing: set CONFIRM=YES-RESEED (this redeals every bot squad and restarts the season)');
  process.exit(1);
}
const alsoClaimed = (process.env.RESEED_CLAIMED || '').trim() === 'YES-INCLUDING-MINE';
const dry = (process.env.DRY_RUN || '').trim() === 'YES';

// THE PLAY RECORD: everything a season writes, and nothing a world IS. Named
// explicitly rather than swept by pattern, and checked against the live schema
// below - if a later migration adds a table that holds play, this script fails
// loudly instead of quietly leaving half a season behind.
const PLAY_TABLES = [
  'matches', 'cup_matches', 'nat_matches', 'youth_matches', 'comp_matches',
  'ticks', 'orders', 'callups', 'nat_squad', 'nat_squads', 'friendlies',
  'listings', 'bids', 'scouted', 'training_rounds', 'snapshots', 'match_logs',
  'comps', 'comp_clubs',
  // the club statement. Every line in it is rewritten from the finance walk
  // each time the money settles, so it is play, not world: wipe it with the
  // season and the next settle writes it back from the matches that remain.
  'ledger',
  // and the squads named for the Colts Cup: they name BOYS, and a redeal
  // deals new ones, so a squad that survived the redeal would name men who no
  // longer exist
  'colts_squads',
  // the academy. The candidates are laid out fresh every tick and the trips
  // and the spending belong to the season that was played, so all three go
  // with it - a redealt world has never scouted anybody.
  'academy_candidates', 'academy_scouts', 'academy_spend'
];
// the world itself: its countries, its clubs, who has claimed them, the
// calendar, and the migration ledger. These are not play and are left alone.
const WORLD_TABLES = ['countries', 'clubs', 'claims', 'seasons', 'worlds', 'schema_migrations'];

const pool = makePool();

// ---- guard: has the schema grown a table this script does not know about? ----
const live = (await pool.query(
  `SELECT table_name FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'
    ORDER BY table_name`)).rows.map(r => r.table_name);
const known = new Set(PLAY_TABLES.concat(WORLD_TABLES));
const unknown = live.filter(t => !known.has(t));
if (unknown.length) {
  console.error('refusing: this schema has tables I was not taught about: ' + unknown.join(', '));
  console.error('add each one to PLAY_TABLES or WORLD_TABLES in reseed-squads.mjs and run again.');
  process.exit(1);
}
const present = PLAY_TABLES.filter(t => live.includes(t));

// ---- 1. the squads ----------------------------------------------------------
const host = makeHost();
const cfgs = countryConfigs(host);
const claims = (await pool.query('SELECT country_id, slot FROM claims')).rows;
const claimed = new Set(claims.map(c => c.country_id + ':' + c.slot));

// THE WORLD MOVES TO A NEW GENERATION BEFORE A CARD IS DEALT. The squad seed
// used to be the constant 'world1|<country>|<slot>', so this script called the
// generator with the same arguments it was called with on day one and dealt
// every club THE SAME FIFTEEN MEN BACK. A redeal that cannot produce a new man
// is not a redeal. The generation goes into the seed, so bumping it here is
// what makes the cricketers below people nobody has ever seen.
const genFrom = (await pool.query('SELECT generation FROM worlds WHERE id=1')).rows[0];
const gen = ((genFrom && genFrom.generation) | 0 || 1) + 1;
if (!dry) await pool.query('UPDATE worlds SET generation=$1 WHERE id=1', [gen]);
console.log('world generation ' + (gen - 1) + ' → ' + gen +
  (dry ? ' (dry run: not written)' : '') + ' - every squad dealt below is new');

let redealt = 0, kept = 0;
const report = [];
for (const cfg of cfgs) {
  const have = (await pool.query(
    'SELECT slot, name, is_boss FROM clubs WHERE country_id=$1 ORDER BY slot', [cfg.id])).rows;
  if (!have.length) { console.log(cfg.id + ': not founded here, skipping'); continue; }
  const line = [];
  for (const club of cfg.clubs) {
    const row = have.find(h => h.slot === club.slot);
    if (!row) continue;
    if (claimed.has(cfg.id + ':' + club.slot) && !alsoClaimed) {
      kept++; line.push(club.slot + ':' + row.name + ' (claimed, kept)');
      continue;
    }
    // A CLAIMED CLUB IS A PERSON'S CLUB: dealt to the standard newcomer rung,
    // so two managers who joined on the same day hold the same class of squad
    // whatever seats the auto-claim gave them. Bots keep the seat's rung.
    const isClaimed = claimed.has(cfg.id + ':' + club.slot);
    const players = squadFor(host, cfg, club, gen, isClaimed ? HUMAN_STR : null);
    if (!dry) {
      // the book of the nets (058) is a cache of the REPLAY, and these are
      // different men: it is cleared with the squad rather than left to be
      // served against a club that no longer has anyone it describes. The
      // next settle rebuilds it whole from the record, as it always does.
      await pool.query(
        'UPDATE clubs SET squad=$3, nets_history=NULL, nets_report=NULL WHERE country_id=$1 AND slot=$2',
        [cfg.id, club.slot, JSON.stringify(players)]);
    }
    redealt++;
    const best = players.slice().sort((a, b) => (b.rating || 0) - (a.rating || 0));
    const xi = Math.round(best.slice(0, 11).reduce((s, p) => s + (p.rating || 0), 0) / 11);
    line.push((club.boss ? '*' : '') + club.slot + ':' + row.name + ' [' + club.arch + ' ' + club.str + '] ' + xi.toLocaleString());
  }
  report.push({ id: cfg.id, line });
}
report.forEach(r => { console.log('\n' + r.id); r.line.forEach(l => console.log('   ' + l)); });
console.log('\nsquads redealt: ' + redealt + '   left alone (claimed): ' + kept);
// SAY IT PLAINLY. A manager who reseeds the world and then finds his own eleven
// unchanged has every reason to think the game is showing him a stale page. It
// is not: his club was spared on purpose, and only this line says so.
if (kept) {
  console.log('\n' + kept + ' club' + (kept === 1 ? '' : 's') + ' kept ' +
    (kept === 1 ? 'its' : 'their') + ' squad because a human has claimed ' +
    (kept === 1 ? 'it' : 'them') + '. Those managers will see the SAME men as');
  console.log('before this run - trained, bought and sold by them, and not the world\'s to take away.');
  console.log('To redeal those too, run again with RESEED_CLAIMED=YES-INCLUDING-MINE.');
}

// ---- 2. the season ----------------------------------------------------------
// A SEASON OPENS ON A MONDAY. The five-week calendar's whole promise is that
// di % 7 is the weekday - Sunday is cup day, Wednesday is international day -
// and that only holds when start_day sits on a week boundary. So the restart
// is dated to the NEXT Monday (day 0 was Monday 3 August 2026); a reseed run
// mid-week costs at most six quiet days, and the world opens on its rhythm.
const today = Math.max(0, dayIx(Date.now()));
const startDay = today + ((7 - (today % 7)) % 7);
if (dry) {
  console.log('\nDRY RUN: would clear ' + present.join(', ') +
    ' and restart every season at world day ' + startDay);
} else {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    for (const t of present) await c.query('DELETE FROM ' + t);
    const cs = (await c.query('SELECT id FROM countries ORDER BY id')).rows;
    for (const row of cs) {
      // one season per country again, numbered 1, opening on the Monday, with
      // the founding division map: div 1 = slots 0-7, div 2 = slots 8-15
      const cfgR = cfgs.find(x => x.id === row.id);
      const divs = cfgR ? foundingDivisions(cfgR) : { 1: [0, 1, 2, 3, 4, 5, 6, 7], 2: [8, 9, 10, 11, 12, 13, 14, 15] };
      await c.query('DELETE FROM seasons WHERE country_id=$1', [row.id]);
      await c.query('INSERT INTO seasons(country_id, season_no, start_day, schedule, divisions) VALUES ($1,1,$2,$3,$4)',
        [row.id, startDay, JSON.stringify(seasonSchedules(row.id, 1, divs)), JSON.stringify(divs)]);
    }
    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  console.log('\ncleared: ' + present.join(', '));
  console.log('every league restarts at season 1, round 1, on world day ' + startDay +
    ' (' + new Date(EPOCH + startDay * 86400000).toISOString().slice(0, 10) + ')');
  console.log('the next hourly tick plays the opening round.');
}

await pool.end();
