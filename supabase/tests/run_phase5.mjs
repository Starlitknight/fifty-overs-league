// Phase 5 — founder tools + league_table view (PGlite only).
//   cd supabase && node tests/run_phase5.mjs
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const mig = (f) => readFileSync(resolve(__dirname, '../migrations/' + f), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : (fail++, process.exitCode = 1); };
const throws = async (fn, re, m) => {
  try { await fn(); ok(false, m + '  (expected error)'); }
  catch (e) { ok(re.test(e.message), `${m}  [${e.message.split('\n')[0]}]`); }
};

const db = new PGlite();
for (const f of ['0001_init.sql','0002_actions.sql','0003_friendly.sql','0004_official.sql','0005_scheduler.sql','0006_founder_views.sql'])
  await db.exec(mig(f));
console.log('all 6 migrations applied OK\n');

const auth = (u) => db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [u ?? '']);
const one  = async (s, a = []) => (await db.query(s, a)).rows[0];
const val  = async (s, a = []) => Object.values(await one(s, a))[0];
const rows = async (s, a = []) => (await db.query(s, a)).rows;
const HASH = 'e558745ede94e2502d5cccaa829feb42818cbcb1e779664c4b784a851b3f00ff';
const F = '11111111-1111-1111-1111-111111111111', A = '22222222-2222-2222-2222-222222222222';

await auth(F);
const lg = await val(`select id from app.create_league('L', $1, 'Fred', 'Fred XI')`, [HASH]);
await db.query(`select app.create_invite($1,'J','manager')`, [lg]);
await auth(A);
const aMid = await val(`select app.redeem_invite('J','Alice','Alice XI')`);
await auth(F);
const fMid = await val(`select app.resolve_manager_id($1)`, [lg]);
const fTeam = await val(`select id from app.teams where manager_id=$1`, [fMid]);
const aTeam = await val(`select id from app.teams where manager_id=$1`, [aMid]);

// league_table: teams with no results still appear, ordered
console.log('— league_table —');
let table = await rows(`select * from app.league_table($1)`, [lg]);
ok(table.length === 2 && table.every(r => Number(r.p) === 0),
   'both teams appear with zeros before any result');

// add a fixture + result (Fred beats Alice) and re-check ordering
const fx = await val(
  `insert into app.fixtures(league_id, round, home_team_id, away_team_id, ground, pitch, weather, seed, resolve_at)
   values ($1,1,$2,$3,'G','balanced','Sunny',1, now()) returning id`, [lg, fTeam, aTeam]);
await db.query(
  `insert into app.results(league_id, fixture_id, comp, home_team_id, away_team_id, winner_team_id,
     result_text, home_runs, home_balls, away_runs, away_balls, scorecard, worm, log, seed, pitch, weather, build_hash)
   values ($1,$2,'league',$3,$4,$3,'Fred win by 30',220,300,190,300,'[]','[]','[]',1,'balanced','Sunny',$5)`,
  [lg, fx, fTeam, aTeam, HASH]);
await db.query(`update app.fixtures set status='resolved' where id=$1`, [fx]);  // as store_official_result would
table = await rows(`select * from app.league_table($1)`, [lg]);
ok(table[0].team_id === fTeam && Number(table[0].pts) === 2 && Number(table[0].pos) === 1,
   'winner sorts to the top with 2 pts');
ok(table[1].team_id === aTeam && Number(table[1].pts) === 0,
   'loser is second with 0 pts');

// founder_void_fixture: founder-gated
console.log('\n— founder tools —');
const fx2 = await val(
  `insert into app.fixtures(league_id, round, home_team_id, away_team_id, ground, pitch, weather, seed, resolve_at)
   values ($1,2,$2,$3,'G','balanced','Sunny',2, now()+interval '1 day') returning id`, [lg, aTeam, fTeam]);
await auth(A); // Alice is not founder
await throws(() => db.query(`select app.founder_void_fixture($1,$2)`, [lg, fx2]),
  /founder-only/, 'non-founder cannot void a fixture');
await auth(F);
ok(await val(`select status::text from app.founder_void_fixture($1,$2)`, [lg, fx2]) === 'void',
   'founder voids a scheduled fixture');
await throws(() => db.query(`select app.founder_void_fixture($1,$2)`, [lg, fx]),
  /already resolved/, 'cannot void an already-resolved fixture');

// founder_reschedule_fixture
const fx3 = await val(
  `insert into app.fixtures(league_id, round, home_team_id, away_team_id, ground, pitch, weather, seed, resolve_at)
   values ($1,3,$2,$3,'G','balanced','Sunny',3, now()+interval '1 day') returning id`, [lg, fTeam, aTeam]);
await auth(F);
const newAt = await val(`select resolve_at from app.founder_reschedule_fixture($1,$2, now()+interval '3 days')`, [lg, fx3]);
ok(!!newAt, 'founder reschedules a scheduled fixture');
await auth(A);
await throws(() => db.query(`select app.founder_reschedule_fixture($1,$2, now())`, [lg, fx3]),
  /founder-only/, 'non-founder cannot reschedule');

console.log(`\n${pass} passed, ${fail} failed`);
await db.close();
