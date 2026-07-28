// Commissioner power: founder_delete_team removes any team + its club/packets.
//   cd supabase && node tests/run_phase12.mjs
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

await auth(F);
const lg = await val(`select id from app.create_league('L', $1, 'Fred', 'Fred XI')`, [HASH]);
await db.query(`select app.create_invite($1,'J','manager')`, [lg]);
await auth(A); const aMid = await val(`select app.redeem_invite('J','Al','Al XI')`);
await auth(F); const fMid = await val(`select app.resolve_manager_id($1)`, [lg]);
const aTeam = await val(`select id from app.teams where manager_id=$1`, [aMid]);

// give Al a drafted club + a packet
await auth(A);
await db.query(`select app.push_club($1,$2,1)`, [lg, JSON.stringify({ name: 'Al XI', players: [] })]);
await db.query(`select app.push_packet($1,0,$2)`, [lg, JSON.stringify({ fo_packet: 1, teamIx: 1, round: 0, orders: {} })]);
ok(await val(`select count(*)::int from app.league_clubs where manager_id=$1`, [aMid]) === 1, 'Al has a drafted club');

// non-founder cannot delete a team
await throws(() => db.query(`select app.founder_delete_team($1,$2)`, [lg, aTeam]),
  /founder-only/, 'a non-founder cannot delete a team');

// founder deletes Al's team outright
await auth(F);
await db.query(`select app.founder_delete_team($1,$2)`, [lg, aTeam]);
ok(await val(`select count(*)::int from app.teams where id=$1`, [aTeam]) === 0, 'the team row is gone');
ok(await val(`select count(*)::int from app.league_clubs where manager_id=$1`, [aMid]) === 0, "the team's drafted club is gone");
ok(await val(`select count(*)::int from app.league_packets where manager_id=$1`, [aMid]) === 0, "the team's order packets are gone");
ok(await val(`select count(*)::int from app.squads where team_id=$1`, [aTeam]) === 0, "the team's squad cascaded away");
// the member remains (can be re-invited / re-draft)
ok(await val(`select count(*)::int from app.members where id=$1`, [aMid]) === 1, 'the member row remains');

// deleting a non-existent / wrong-league team errors
await throws(() => db.query(`select app.founder_delete_team($1, gen_random_uuid())`, [lg]),
  /no such team/, 'deleting an unknown team errors');

// founder can delete their OWN team too (full power)
const fTeam = await val(`select id from app.teams where manager_id=$1`, [fMid]);
await db.query(`select app.founder_delete_team($1,$2)`, [lg, fTeam]);
ok(await val(`select count(*)::int from app.teams where league_id=$1`, [lg]) === 0, 'founder can delete their own team too');

console.log(`\n${pass} passed, ${fail} failed`);
await db.close();
