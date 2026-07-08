// Admin controls: readiness gate, start-season, reset, remove-own-team.
//   cd supabase && node tests/run_phase10.mjs
import { PGlite } from '@electric-sql/pglite';
import { applyAllMigrations } from './_migrate.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : (fail++, process.exitCode = 1); };
const throws = async (fn, re, m) => { try { await fn(); ok(false, m + ' (expected error)'); } catch (e) { ok(re.test(e.message), `${m}  [${e.message.split('\n')[0]}]`); } };

const db = new PGlite();
await applyAllMigrations(db);
const auth = (u) => db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [u ?? '']);
const one = async (s, a = []) => (await db.query(s, a)).rows[0];
const val = async (s, a = []) => Object.values(await one(s, a))[0];
const HASH = 'e558745ede94e2502d5cccaa829feb42818cbcb1e779664c4b784a851b3f00ff';
const F = '11111111-1111-1111-1111-111111111111', A = '22222222-2222-2222-2222-222222222222';
const legalRoster = () => JSON.stringify(
  [{ name: 'K', keeper: true, bowlTypeFull: 'none', fee: 20000, rating: 40000, skills: {} }]
    .concat([1,2,3,4,5].map(i => ({ name: 'B' + i, keeper: false, bowlTypeFull: 'seamMedium', fee: 20000, rating: 30000, skills: {} })))
    .concat([1,2,3,4,5].map(i => ({ name: 'T' + i, keeper: false, bowlTypeFull: 'none', fee: 20000, rating: 30000, skills: {} }))));

await auth(F);
const lg = await val(`select id from app.create_league('L', $1, 'Admin', 'Admin XI')`, [HASH]);
await db.query(`select app.create_invite($1,'J','manager')`, [lg]);
await auth(A); const aMid = await val(`select app.redeem_invite('J','Al','Al XI')`);
await auth(F); const fMid = await val(`select app.resolve_manager_id($1)`, [lg]);
const fTeam = await val(`select id from app.teams where manager_id=$1`, [fMid]);
const aTeam = await val(`select id from app.teams where manager_id=$1`, [aMid]);

// readiness: 2 teams, 0 drafted → not ready
let rd = await val(`select app.league_readiness($1)`, [lg]);
ok(rd.teams === 2 && rd.drafted === 0 && rd.all_ready === false, 'readiness: 2 teams, 0 drafted, not ready');

const fx = JSON.stringify([{ round: 1, home_team_id: fTeam, away_team_id: aTeam, seed: 5000 }]);
// start_season blocked until all drafted
await throws(() => db.query(`select app.founder_start_season($1,$2,'2020-01-01')`, [lg, fx]),
  /not everyone has drafted/, 'start_season is blocked until all teams have drafted');

// both draft (submit squads)
await auth(F); await db.query(`select app.submit_league_squad($1,$2)`, [lg, legalRoster()]);
await auth(A); await db.query(`select app.submit_league_squad($1,$2)`, [lg, legalRoster()]);
await auth(F);
rd = await val(`select app.league_readiness($1)`, [lg]);
ok(rd.all_ready === true, 'readiness: all_ready once both drafted');

// non-founder cannot start
await auth(A);
await throws(() => db.query(`select app.founder_start_season($1,$2,'2020-01-01')`, [lg, fx]),
  /founder-only/, 'non-founder cannot start the season');
// founder starts → fixtures written
await auth(F);
const n = await val(`select app.founder_start_season($1,$2,'2020-01-01')`, [lg, fx]);
ok(n === 1, 'founder_start_season writes fixtures once everyone is ready');

// reset schedule clears the (unresolved) fixture
const cleared = await val(`select app.founder_reset_schedule($1)`, [lg]);
ok(cleared === 1 && await val(`select count(*)::int from app.fixtures where league_id=$1`, [lg]) === 0,
   'founder_reset_schedule clears upcoming fixtures');

// reset league wipes a demo team
await db.query(`insert into app.members(league_id, auth_uid, role, display_name) values ($1, gen_random_uuid(), 'manager', 'Demo Rivals')`, [lg]);
const demoMid = await val(`select id from app.members where display_name='Demo Rivals'`);
await db.query(`insert into app.teams(league_id, manager_id, name) values ($1,$2,'Demo Rivals')`, [lg, demoMid]);
await db.query(`select app.founder_reset_league($1)`, [lg]);
ok(await val(`select count(*)::int from app.teams where league_id=$1 and name='Demo Rivals'`, [lg]) === 0,
   'founder_reset_league removes the Demo Rivals team');

// remove own team → admin-only
await db.query(`select app.founder_remove_own_team($1)`, [lg]);
ok(await val(`select count(*)::int from app.teams where manager_id=$1`, [fMid]) === 0,
   'founder_remove_own_team makes the founder admin-only');
rd = await val(`select app.league_readiness($1)`, [lg]);
ok(rd.teams === 1, 'after removal only the player team remains');

console.log(`\n${pass} passed, ${fail} failed`);
await db.close();
