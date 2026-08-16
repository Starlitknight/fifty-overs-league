// reseed-squads.mjs — REDEAL THE WORLD'S CRICKETERS, AND START THE SUMMER AGAIN.
//
// Run from the world-reseed workflow behind a typed confirmation. The men are
// DEALT first and WRITTEN last, and everything that touches the database
// happens inside one transaction, in this order:
//
//   1. the world moves to a new generation;
//   2. every ball anybody bowled is cleared and the seasons restart at round
//      one, because a table half played by the old squads is not a table;
//   3. and only then are the new cricketers put on the books.
//
// CLEARED BEFORE DEALT, AND ALL OR NOTHING. The squads used to be written
// first, as a couple of hundred loose UPDATEs with no transaction near them,
// while only the season reset was atomic. A run killed part-way through left
// the OLD SEASON STILL RUNNING - standings, form and results all intact - over
// a world where half the clubs had new cricketers and half had the old ones,
// with nothing on any page to say which was which. Now a cancelled runner, a
// dropped connection or a thrown error rolls the whole thing back and the
// world is exactly as it was. There is no half-reseeded world to be in.
//
// The generation itself is the slow part and holds no locks: a couple of
// hundred squads go through the engine before the transaction opens.
//
// WHAT THE DEAL IS:
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
import { countryConfigs, squadFor, foundingDivisions } from './init-world.mjs';
import { EPOCH, dayIx, scheduleOf, seasonSchedules } from './clock.mjs';
import { foundingSeats } from './economy.mjs';

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
  'academy_candidates', 'academy_scouts', 'academy_spend',
  // WHAT THE MEN DID, which is play twice over: it is a derivation of the
  // matches this script is about to delete, and it is keyed by the ids of
  // cricketers a redeal replaces. Kept, it would be a table of lives belonging
  // to nobody, and the first settle after the redeal would write the new men's
  // cards beside them anyway. Losing it costs one settle, which is the whole
  // bargain of a derived table.
  'player_history',
  // and where the living fold got to. It describes a record this script is
  // about to delete, held by cricketers it is about to replace - so keeping it
  // would have the first settle after a redeal continue from a country that no
  // longer exists. Dropped, the next settle folds from genesis and marks the
  // new world, which is the whole repair.
  'living_checkpoint',
  // and the morning's paper, which reports cricket this script is about to
  // delete. Kept, the first reader after a redeal would open a front page
  // about matches that never happened in the world he is looking at.
  'gazette',
  // the pitch a manager called for a HOME FIXTURE (083). This is where it
  // parts company with ticket_prices below: a price is a standing policy that
  // outlives any one match, while a call names a season, a round and a slot,
  // and the redeal replaces the cricket those name. A surviving call would be
  // laid over whatever new fixture happened to land in the same seat - with
  // its once-per-match budget already spent on a game that never happened.
  'pitch_calls'
];
// the world itself: its countries, its clubs, who has claimed them, the
// calendar, and the migration ledger. These are not play and are left alone.
//   notif_seen is a PERSON'S state, not the world's: how far through his own
//   news a manager has read. A redeal gives him a new club to read about; it
//   does not un-read what he read yesterday, and wiping it would spring every
//   old notification back into his bell as unread.
//   ticket_prices is a MANAGER'S standing decision about his own gate, like
//   the seats he built - the redeal replaces the cricket, not the club's
//   pricing policy, so it survives.
//   sponsor_picks is the same kind of thing for the sponsor's table (100): a
//   standing choice of contract shape, keyed by season. The redeal replaces
//   the cricket a season held, not the deal a manager preferred, so his pick
//   for the seasons to come survives the way his ticket price does.
const WORLD_TABLES = ['countries', 'clubs', 'claims', 'seasons', 'worlds', 'schema_migrations',
  'notif_seen', 'ticket_prices', 'sponsor_picks'];

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
console.log('world generation ' + (gen - 1) + ' → ' + gen +
  (dry ? ' (dry run: not written)' : '') + ' - every squad dealt below is new');

let redealt = 0, kept = 0;
const report = [];
const deals = [];                    // every squad dealt, none of it written yet
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
    // A CLAIMED CLUB IS A PERSON'S CLUB: dealt the newcomer's own tier, so two
    // managers who joined on the same day hold the same class of squad whatever
    // seats the auto-claim gave them. Bots keep the seat's tier.
    const isClaimed = claimed.has(cfg.id + ':' + club.slot);
    const players = squadFor(host, cfg, club, gen, isClaimed);
    // DEALT NOW, WRITTEN LATER. Generating a world's cricketers is the slow
    // part - a couple of hundred squads through the engine - and it touches
    // no database at all, so it happens out here where a long job holds no
    // locks. Every write waits for the one transaction below.
    deals.push({ country: cfg.id, slot: club.slot, players, seats: foundingSeats(club.slot, !!club.boss) });
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
  // ---------------------------------------------------------------------
  // ONE TRANSACTION, AND THE WORLD IS CLEARED BEFORE IT IS DEALT.
  //
  // The squads used to be written first, one loose UPDATE a club, with no
  // transaction anywhere near them - and only the season reset below was
  // atomic. A run killed part-way through therefore left the OLD SEASON
  // STILL RUNNING, with its standings and its form and its results intact,
  // over a world where half the clubs had been handed new cricketers and
  // half had not. A live competition, corrupted in flight, and no way to
  // tell by looking which half was which.
  //
  // Now every database change this script makes is one transaction, in the
  // order that makes sense on its own terms: wipe what was played, restart
  // the seasons, then deal the men who will play them. Killed at any point
  // - a cancelled runner, a lost connection, a thrown error - Postgres
  // rolls the whole thing back and the world is exactly as it was. There is
  // no half-reseeded world to be in.
  // ---------------------------------------------------------------------
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    // 1. the world moves to a new generation
    await c.query('UPDATE worlds SET generation=$1 WHERE id=1', [gen]);
    // 2. everything anybody played is cleared
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
    // 3. and only then are the new men put on the books. The book of the
    //    nets goes with the old squad: it is a cache of a replay, and these
    //    are different cricketers.
    //    THE GROUND COMES UP TO THE CLUB'S STANDING, and never comes down. A
    //    world founded before stature existed gave all 256 clubs the same
    //    fifteen thousand seats, which is below what every one of them is now
    //    worth; a redeal is the refounding that corrects it. GREATEST is the
    //    whole of the care here - a manager who has already built a stand
    //    keeps every seat he paid for, and seats_paid is left alone so his
    //    statement still says what he spent. Nobody's ground shrinks.
    for (const d of deals) {
      await c.query(
        'UPDATE clubs SET squad=$3, nets_history=NULL, nets_report=NULL, seats=GREATEST(seats, $4)'
        + ' WHERE country_id=$1 AND slot=$2',
        [d.country, d.slot, JSON.stringify(d.players), d.seats]);
    }
    await c.query('COMMIT');
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  console.log('\ncleared: ' + present.join(', '));
  console.log('squads written: ' + deals.length + ' (all in one transaction with the clear)');
  console.log('every league restarts at season 1, round 1, on world day ' + startDay +
    ' (' + new Date(EPOCH + startDay * 86400000).toISOString().slice(0, 10) + ')');
  console.log('the next hourly tick plays the opening round.');
}

await pool.end();
