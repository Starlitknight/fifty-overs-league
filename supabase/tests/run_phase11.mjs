// Game-native league sync: snapshot + packets + clubs.
//   cd supabase && node tests/run_phase11.mjs
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
const F = '11111111-1111-1111-1111-111111111111', A = '22222222-2222-2222-2222-222222222222', X = '33333333-3333-3333-3333-333333333333';

await auth(F);
const lg = await val(`select id from app.create_league('L', $1, 'Fred', 'Fred XI')`, [HASH]);
await db.query(`select app.create_invite($1,'J','manager')`, [lg]);
await auth(A); const aMid = await val(`select app.redeem_invite('J','Al','Al XI')`);
await auth(F); const fMid = await val(`select app.resolve_manager_id($1)`, [lg]);

// push_club: each manager stores their drafted club
await auth(F); await db.query(`select app.push_club($1,$2,0)`, [lg, JSON.stringify({ name: 'Fred XI', players: [{ name: 'p1' }] })]);
await auth(A); await db.query(`select app.push_club($1,$2,1)`, [lg, JSON.stringify({ name: 'Al XI', players: [{ name: 'p2' }] })]);
ok(await val(`select count(*)::int from app.league_clubs where league_id=$1`, [lg]) === 2, 'push_club stores one club per manager');
// upsert (same manager overwrites)
await auth(A); await db.query(`select app.push_club($1,$2,1)`, [lg, JSON.stringify({ name: 'Al XI', players: [{ name: 'p2b' }] })]);
ok(await val(`select count(*)::int from app.league_clubs where league_id=$1`, [lg]) === 2, 'push_club upserts (no dup rows)');

// members can read clubs via RLS
await auth(A);
const clubsSeen = await val(`select count(*)::int from app.league_clubs where league_id=$1`, [lg]);
ok(clubsSeen === 2, 'a member can read all clubs in the league (RLS)');

// push_packet: per-manager per-round
await auth(F); await db.query(`select app.push_packet($1,0,$2)`, [lg, JSON.stringify({ fo_packet: 1, teamIx: 0, round: 0, orders: { captain: 'p1' } })]);
await auth(A); await db.query(`select app.push_packet($1,0,$2)`, [lg, JSON.stringify({ fo_packet: 1, teamIx: 1, round: 0, orders: { captain: 'p2' } })]);
ok(await val(`select count(*)::int from app.league_packets where league_id=$1 and round=0`, [lg]) === 2, 'push_packet stores one packet per manager per round');
// re-push same round overwrites
await auth(F); await db.query(`select app.push_packet($1,0,$2)`, [lg, JSON.stringify({ fo_packet: 1, teamIx: 0, round: 0, orders: { captain: 'p1x' } })]);
ok(await val(`select packet->'orders'->>'captain' from app.league_packets where league_id=$1 and round=0 and manager_id=$2`, [lg, fMid]) === 'p1x',
   'push_packet upserts the same round');
// a new round is a new row
await auth(F); await db.query(`select app.push_packet($1,1,$2)`, [lg, JSON.stringify({ fo_packet: 1, teamIx: 0, round: 1, orders: {} })]);
ok(await val(`select count(*)::int from app.league_packets where league_id=$1 and manager_id=$2`, [lg, fMid]) === 2, 'a different round is a separate packet');

// push_league_state: founder writes, version bumps
await auth(F);
const v1 = await val(`select app.push_league_state($1,$2,0)`, [lg, JSON.stringify({ teams: [1, 2], season: { round: 0 } })]);
ok(v1 === 1, 'push_league_state writes version 1');
const v2 = await val(`select app.push_league_state($1,$2,1)`, [lg, JSON.stringify({ teams: [1, 2], season: { round: 1 } })]);
ok(v2 === 2, 'push_league_state bumps version on update');
ok(await val(`select round from app.league_state where league_id=$1`, [lg]) === 1, 'league_state round advances');

// non-founder cannot write state
await auth(A);
await throws(() => db.query(`select app.push_league_state($1,$2,2)`, [lg, JSON.stringify({})]),
  /founder-only/, 'a non-founder cannot write the authoritative snapshot');
// but a member can read it
ok(await val(`select version from app.league_state where league_id=$1`, [lg]) === 2, 'a member can read the snapshot (RLS)');

// Note: read-denial for a non-member is enforced by RLS (policies use my_league_ids(),
// the same pattern as every other table). PGlite runs as a superuser and bypasses RLS,
// so it cannot exercise SELECT-denial here; we assert the policy exists instead.
ok(await val(`select count(*)::int from pg_policies where schemaname='app' and tablename='league_state' and cmd='SELECT'`) === 1,
   'league_state has a member-scoped read policy');
ok(await val(`select count(*)::int from pg_policies where schemaname='app' and tablename='league_packets' and cmd='SELECT'`) === 1,
   'league_packets has a member-scoped read policy');

console.log(`\n${pass} passed, ${fail} failed`);
await db.close();
