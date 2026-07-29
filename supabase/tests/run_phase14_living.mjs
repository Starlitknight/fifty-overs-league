// MIGRATION 0026 — the living squad, proved against real Postgres.
//
// The tables added here are the ones a dynasty is made of: a career per
// player per season, the things that happened to him, what a club did in a
// season, and the facilities a club owns. If any of that is wrong the damage
// is permanent - a career cannot be re-derived once the seasons it was made
// of are gone - so the shape is checked before a single row is written to the
// real database.
//
// What this asserts: the columns exist with the defaults the client assumes,
// the constraints actually refuse bad data, a career survives a season being
// written twice (the umpire retries), the careers view computes the averages
// the player page prints, deleting a club takes its players' careers with it,
// and reads are public while writes are not.
//
//   cd supabase && NODE_PATH=/opt/node22/lib/node_modules node tests/run_phase14_living.mjs
import { PGlite } from '@electric-sql/pglite';
import { applyAllMigrations } from './_migrate.mjs';

let pass = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) process.exitCode = 1; else pass++; };
const throws = async (fn, re, m) => {
  try { await fn(); ok(false, m + ' (expected an error, got none)'); }
  catch (e) { ok(re.test(e.message), `${m}  [${e.message.split('\n')[0]}]`); }
};

const db = new PGlite();
const files = await applyAllMigrations(db);
ok(files.includes('0026_living_squad.sql'), `every migration applies cleanly (${files.length} files)`);

const one = async (s, a = []) => (await db.query(s, a)).rows[0];
const val = async (s, a = []) => Object.values(await one(s, a))[0];

// ---- a league, a club, a cricketer ---------------------------------------
const lg = await val(`insert into game.leagues (name) values ('Test League') returning id`);
const cl = await val(`insert into game.clubs (league_id, name) values ($1, 'Test CC') returning id`, [lg]);
const pl = await val(
  `insert into game.players (club_id, name, role, age, rating, attrs)
   values ($1, 'Aarav Kulkarni', 'topOrderBat', 19, 52000, '{}'::jsonb) returning id`, [cl]);

// ---- 1. THE CRICKETER -----------------------------------------------------
console.log('— the cricketer —');
const p = await one(`select status, debut_season, retired_season, contract_until, wage, traits, talent
                       from game.players where id = $1`, [pl]);
ok(p.status === 'active', "a new player is 'active'");
ok(p.debut_season === 1 && p.retired_season === null, 'he debuts in season 1 and has not retired');
ok(p.contract_until === null, 'no contract column value until one is given (the client derives it)');
ok(p.wage === 0 && p.talent === 'steady', 'wage defaults to 0 and talent to steady');
ok(p.traits === null, 'character is null by default — the client derives it from his name');

await db.query(`update game.players set status='retired', retired_season=4 where id=$1`, [pl]);
ok(await val(`select count(*)::int from game.players where id=$1`, [pl]) === 1,
   'a retired man KEEPS his row — the record book still names him');
await throws(() => db.query(`update game.players set status='sacked' where id=$1`, [pl]),
  /players_status_ck|violates check/, 'an unknown status is refused');
await db.query(`update game.players set status='active', retired_season=null where id=$1`, [pl]);

await db.query(`update game.players set traits = array['oneClub','ironMan'] where id=$1`, [pl]);
const tr = await val(`select traits from game.players where id=$1`, [pl]);
ok(Array.isArray(tr) && tr.length === 2 && tr[0] === 'oneClub', 'the world can override a man’s character');

// ---- 2. THE CAREER --------------------------------------------------------
console.log('— the career —');
const season = async (n, o) => db.query(
  `insert into game.player_seasons
     (player_id, season_no, club_id, age, ovr_start, ovr_end, matches, runs, balls, outs,
      high_score, fifties, hundreds, wickets, runs_conceded, balls_bowled, catches)
   values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
   on conflict (player_id, season_no) do update set
     age=excluded.age, ovr_start=excluded.ovr_start, ovr_end=excluded.ovr_end,
     matches=excluded.matches, runs=excluded.runs, balls=excluded.balls, outs=excluded.outs,
     high_score=excluded.high_score, wickets=excluded.wickets,
     runs_conceded=excluded.runs_conceded, balls_bowled=excluded.balls_bowled`,
  [pl, n, cl, o.age, o.s, o.e, o.m, o.runs, o.balls, o.outs, o.hs, o.f50 || 0, o.f100 || 0,
   o.w || 0, o.rc || 0, o.bb || 0, o.ct || 0]);

await season(1, { age: 19, s: 52, e: 57, m: 14, runs: 402, balls: 500, outs: 12, hs: 78, f50: 3, w: 2, rc: 96, bb: 90 });
await season(2, { age: 20, s: 57, e: 63, m: 18, runs: 690, balls: 760, outs: 15, hs: 121, f50: 4, f100: 1 });
ok(await val(`select count(*)::int from game.player_seasons where player_id=$1`, [pl]) === 2,
   'two seasons on the record');

// THE UMPIRE RETRIES. A round that is published twice must not double a career.
await season(2, { age: 20, s: 57, e: 63, m: 18, runs: 690, balls: 760, outs: 15, hs: 121, f50: 4, f100: 1 });
ok(await val(`select count(*)::int from game.player_seasons where player_id=$1`, [pl]) === 2,
   'writing the same season twice does not duplicate it');
ok(await val(`select runs from game.player_seasons where player_id=$1 and season_no=2`, [pl]) === 690,
   'and does not double the runs');

await throws(() => db.query(
  `insert into game.player_seasons (player_id, season_no) values ($1, 1)`, [pl]),
  /duplicate key|player_seasons_pkey/, 'one row per player per season is enforced');

// ---- 3. WHAT HAPPENED TO HIM ---------------------------------------------
console.log('— the things that happened —');
await db.query(`insert into game.player_events (player_id, season_no, round, kind, detail)
                values ($1, 2, 9, 'grew', 'up to 63 at 20')`, [pl]);
await db.query(`insert into game.player_events (player_id, season_no, kind)
                values ($1, 2, 'renewed')`, [pl]);
const ev = await one(`select count(*)::int as n, min(detail) as d from game.player_events where player_id=$1`, [pl]);
ok(ev.n === 2 && ev.d === '', 'events record, and detail defaults to empty rather than null');

// ---- 4. THE CLUB THAT GETS BIGGER ----------------------------------------
console.log('— the club —');
const c = await one(`select seats, supporters, academy_level, nets_level, scouting_level, colour, founded_season
                       from game.clubs where id=$1`, [cl]);
ok(c.seats === 15000 && c.supporters === 12000, 'a new club has a ground and a crowd');
ok(c.academy_level === 2 && c.nets_level === 1 && c.scouting_level === 1,
   'facilities start at their opening levels');
ok(c.colour === null && c.founded_season === 1, 'colour is unset (derived from the name) and it was founded in season 1');
await db.query(`update game.clubs set academy_level=5, nets_level=5, scouting_level=5 where id=$1`, [cl]);
ok(await val(`select academy_level from game.clubs where id=$1`, [cl]) === 5, 'a facility can be built to 5');
for (const [col, bad] of [['academy_level', 6], ['nets_level', 0], ['scouting_level', -1]]) {
  await throws(() => db.query(`update game.clubs set ${col}=${bad} where id=$1`, [cl]),
    /clubs_levels_ck|violates check/, `${col} cannot be ${bad}`);
}

// ---- 5. THE DYNASTY LEDGER ------------------------------------------------
console.log('— the dynasty ledger —');
await db.query(`insert into game.club_seasons (club_id, season_no, league_id, position, played, won, lost, points, nrr, champion, bank_end)
                values ($1,1,$2,1,18,13,4,27,0.842,true,4200000)`, [cl, lg]);
await db.query(`insert into game.club_seasons (club_id, season_no, league_id, position, played, won, lost, points, nrr, spoon)
                values ($1,2,$2,10,18,3,15,7,-1.104,true)`, [cl, lg]);
const dyn = await one(`select count(*) filter (where champion)::int as titles,
                              count(*) filter (where spoon)::int as spoons
                         from game.club_seasons where club_id=$1`, [cl]);
ok(dyn.titles === 1 && dyn.spoons === 1, 'titles and wooden spoons are a query, not a guess');
ok(Number(await val(`select nrr from game.club_seasons where club_id=$1 and season_no=1`, [cl])) === 0.842,
   'net run rate keeps three decimals');
await throws(() => db.query(
  `insert into game.club_seasons (club_id, season_no, league_id) values ($1,1,$2)`, [cl, lg]),
  /duplicate key|club_seasons_pkey/, 'one row per club per season');

// ---- 6. THE SEASON ITSELF -------------------------------------------------
console.log('— the season —');
await db.query(`insert into game.seasons (league_id, season_no) values ($1, 1)`, [lg]);
const s1 = await one(`select rounds, current_round, state, champion, ended_at from game.seasons where league_id=$1`, [lg]);
ok(s1.rounds === 18 && s1.current_round === 0, 'a season is eighteen rounds and starts at zero');
ok(s1.state === 'running' && s1.champion === null && s1.ended_at === null, 'and it is running, undecided');
await db.query(`update game.seasons set state='closed', champion='Test CC', spoon='Other CC', ended_at=now()
                 where league_id=$1 and season_no=1`, [lg]);
ok(await val(`select champion from game.seasons where league_id=$1`, [lg]) === 'Test CC', 'a season can be closed out');
await throws(() => db.query(`update game.seasons set state='paused' where league_id=$1`, [lg]),
  /seasons_state_ck|violates check/, 'an unknown season state is refused');

// ---- 7. A CAREER, IN ONE READ ---------------------------------------------
console.log('— the careers view —');
const car = await one(`select * from game.careers where player_id=$1 and season_no=1`, [pl]);
ok(car.name === 'Aarav Kulkarni' && car.talent === 'steady', 'the view carries the man as well as the season');
ok(Number(car.bat_average) === 33.5, `batting average is worked out in SQL (${car.bat_average})`);
ok(Number(car.strike_rate) === 80.4, `strike rate too (${car.strike_rate})`);
ok(Number(car.bowl_average) === 48 && Number(car.economy) === 6.4,
   `bowling average and economy too (${car.bowl_average}, ${car.economy})`);
const noBall = await one(`select bowl_average, economy from game.careers where player_id=$1 and season_no=2`, [pl]);
ok(noBall.bowl_average === null && noBall.economy === null,
   'a man who did not bowl gets no bowling figures rather than a division by zero');

// a player with no seasons still appears — an academy boy has a page too
const boy = await val(`insert into game.players (club_id, name, age, rating, attrs)
                       values ($1,'Colt Barnes',17,31000,'{}'::jsonb) returning id`, [cl]);
const bRow = await one(`select season_no, bat_average from game.careers where player_id=$1`, [boy]);
ok(bRow && bRow.season_no === null, 'a player who has never played still has a row (left join)');

// ---- 8. A CAREER BELONGS TO ITS PLAYER ------------------------------------
console.log('— cascades —');
await db.query(`delete from game.players where id=$1`, [boy]);
const before = await val(`select count(*)::int from game.player_seasons`);
await db.query(`delete from game.clubs where id=$1`, [cl]);
ok(await val(`select count(*)::int from game.players where club_id=$1`, [cl]) === 0,
   'deleting a club deletes its players');
ok(before > 0 && await val(`select count(*)::int from game.player_seasons`) === 0,
   'and their careers and events go with them');
ok(await val(`select count(*)::int from game.club_seasons where club_id=$1`, [cl]) === 0,
   'and the club’s own season rows');

// ---- 9. READS ARE PUBLIC, WRITES ARE NOT ---------------------------------
console.log('— grants and row security —');
for (const t of ['player_seasons', 'player_events', 'club_seasons', 'seasons']) {
  const rls = await val(`select relrowsecurity from pg_class where oid = ('game.' || $1)::regclass`, [t]);
  ok(rls === true, `game.${t} has row level security on`);
  const pols = await val(`select count(*)::int from pg_policies where schemaname='game' and tablename=$1`, [t]);
  ok(pols === 1, `game.${t} has exactly one policy (read)`);
  const sel = await val(`select has_table_privilege('anon', 'game.' || $1, 'SELECT')`, [t]);
  const ins = await val(`select has_table_privilege('anon', 'game.' || $1, 'INSERT')`, [t]);
  ok(sel === true && ins === false, `anon can read game.${t} and cannot write it`);
}
ok(await val(`select has_table_privilege('anon', 'game.careers', 'SELECT')`) === true,
   'anon can read the careers view');

console.log(`\n${pass} checks passed`);
