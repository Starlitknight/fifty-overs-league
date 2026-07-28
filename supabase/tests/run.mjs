// Phase 1 tests — run the migration in PGlite (real Postgres) and exercise the
// identity seam, invite redeem, founder gating, RLS deny-by-default, standings.
//
//   cd supabase && node tests/run.mjs        (exit 0 = all pass)
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { applyAllMigrations } from './_migrate.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : (fail++, process.exitCode = 1); };
// assert a call throws, and its message matches `re`
const throws = async (fn, re, m) => {
  try { await fn(); ok(false, m + '  (expected error, got success)'); }
  catch (e) { ok(re.test(e.message), `${m}  [${e.message.split('\n')[0]}]`); }
};

const db = new PGlite();
await applyAllMigrations(db);
console.log('migrations applied OK\n');

// helpers ------------------------------------------------------------------
const UID = { founder: '11111111-1111-1111-1111-111111111111',
              alice:   '22222222-2222-2222-2222-222222222222',
              bob:     '33333333-3333-3333-3333-333333333333',
              carol:   '44444444-4444-4444-4444-444444444444' };
const auth   = (uid) => db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? '']);
const logout = () => auth('');
const one    = async (sql, args=[]) => (await db.query(sql, args)).rows[0];
const val    = async (sql, args=[]) => Object.values(await one(sql, args))[0];

const BUILD_HASH = 'e558745ede94e2502d5cccaa829feb42818cbcb1e779664c4b784a851b3f00ff';

// === bootstrap: founder creates a league ==================================
await auth(UID.founder);
const lg = await one(
  `select id, name, status::text as status, build_hash
   from app.create_league('Chat Division 1', $1, 'Founder Fred', 'Fred XI')`,
  [BUILD_HASH]);
ok(lg && lg.name === 'Chat Division 1' && lg.build_hash === BUILD_HASH && lg.status === 'setup',
   'create_league inserts a league pinned to the build hash');
const founderMid = await val(`select app.resolve_manager_id($1)`, [lg.id]);
ok(!!founderMid, 'founder gets a manager_id via resolve_manager_id');
ok(await val(`select role::text from app.members where id=$1`, [founderMid]) === 'founder',
   'founder membership has role=founder');
ok(await val(`select count(*)::int from app.teams where manager_id=$1`, [founderMid]) === 1,
   'founder team was created');

// === identity seam edge cases ============================================
await logout();
await throws(() => db.query(`select app.resolve_manager_id($1)`, [lg.id]),
  /not authenticated/, 'resolve_manager_id with no JWT raises not-authenticated');
await auth(UID.bob);
await throws(() => db.query(`select app.resolve_manager_id($1)`, [lg.id]),
  /not a member/, 'resolve_manager_id for a non-member raises not-a-member');

// === founder mints an invite; non-founder cannot =========================
await auth(UID.founder);
const inv = await one(`select code, role::text as role from app.create_invite($1, 'JOIN-ALICE', 'manager')`, [lg.id]);
ok(inv && inv.code === 'JOIN-ALICE' && inv.role === 'manager',
   'create_invite returns the minted invite composite');
const invRow = await one(`select code, role::text as role, redeemed_uid from app.invites where code='JOIN-ALICE'`);
ok(invRow && invRow.code === 'JOIN-ALICE' && invRow.redeemed_uid === null,
   'founder mints an unredeemed invite code');

// === REQUIRED: redeemed invite maps to a manager =========================
await auth(UID.alice);
const aliceMid = await val(
  `select app.redeem_invite('JOIN-ALICE', 'Alice A', 'Alice XI')`);
ok(!!aliceMid, 'redeem_invite returns a manager_id');
const resolved = await val(`select app.resolve_manager_id($1)`, [lg.id]);
ok(resolved === aliceMid,
   'REQUIRED: resolve_manager_id(alice) === the manager_id returned by redeem_invite');
ok(await val(`select role::text from app.members where id=$1`, [aliceMid]) === 'manager',
   'redeemed member has role=manager');
ok(await val(`select count(*)::int from app.teams where manager_id=$1`, [aliceMid]) === 1,
   'redeeming created Alice a team');
ok(await val(`select redeemed_by from app.invites where code='JOIN-ALICE'`) === aliceMid,
   'invite is bound to the redeeming manager');

// redeem guards
await auth(UID.carol);
await throws(() => db.query(`select app.redeem_invite('JOIN-ALICE','Carol C')`),
  /already redeemed/, 'a used invite cannot be redeemed again');
await throws(() => db.query(`select app.redeem_invite('NOPE','Carol C')`),
  /invalid invite/, 'an unknown code is rejected');
await auth(UID.alice);
await throws(() => db.query(`select app.redeem_invite('JOIN-ALICE','Alice again')`),
  /already redeemed|already a member/, 'redeeming twice as the same user is rejected');

// === REQUIRED: founder-only action rejects a non-founder =================
await auth(UID.alice); // alice is a manager, not founder
await throws(() => db.query(`select app.create_invite($1,'ALICE-TRIES','manager')`, [lg.id]),
  /founder-only/, 'REQUIRED: non-founder calling create_invite is rejected');
await auth(UID.founder);
await db.query(`select app.create_invite($1,'FOUNDER-OK','manager')`, [lg.id]);
ok(await val(`select count(*)::int from app.invites where code='FOUNDER-OK'`) === 1,
   'founder calling create_invite succeeds');

// === RLS deny-by-default (as the Supabase 'authenticated' role) ==========
await db.exec(`
  do $$ begin
    if not exists (select 1 from pg_roles where rolname='authenticated') then
      create role authenticated nologin;
    end if;
  end $$;
  grant usage on schema app to authenticated;
  grant select, insert, update, delete on all tables in schema app to authenticated;
`);
await db.exec(`set role authenticated`);
await auth(UID.founder);
await throws(() => db.query(`insert into app.members(league_id, auth_uid, role, display_name)
                             values ($1, $2, 'founder', 'hacker')`, [lg.id, UID.bob]),
  /row-level security|permission denied/i,
  'RLS: a direct INSERT into app.members is denied for authenticated');
const visibleLeagues = await val(`select count(*)::int from app.leagues`);
ok(visibleLeagues === 1, 'RLS read policy: founder sees exactly their 1 league');
// alice's private draft pool must not be visible to the founder... seed one first:
await db.exec(`reset role`);
await db.query(`insert into app.draft_pools(league_id, manager_id, players)
                values ($1, $2, '[]'::jsonb)`, [lg.id, aliceMid]);
await db.exec(`set role authenticated`);
await auth(UID.founder);
ok(await val(`select count(*)::int from app.draft_pools`) === 0,
   "RLS: founder cannot see Alice's private draft pool (buckets are private)");
await auth(UID.alice);
ok(await val(`select count(*)::int from app.draft_pools`) === 1,
   'RLS: Alice CAN see her own draft pool');
await db.exec(`reset role`);

// === standings view sanity ===============================================
// Two teams already exist (Fred, Alice). Insert a league result: Fred beats Alice.
const fredTeam  = await val(`select id from app.teams where manager_id=$1`, [founderMid]);
const aliceTeam = await val(`select id from app.teams where manager_id=$1`, [aliceMid]);
const fixtureId = await val(
  `insert into app.fixtures(league_id, round, home_team_id, away_team_id, ground, pitch, weather, seed, resolve_at)
   values ($1, 1, $2, $3, 'Headingley', 'balanced', 'Sunny', 42, now()) returning id`,
  [lg.id, fredTeam, aliceTeam]);
await db.query(
  `insert into app.results(league_id, fixture_id, comp, home_team_id, away_team_id,
       winner_team_id, result_text, home_runs, home_balls, away_runs, away_balls,
       scorecard, worm, log, seed, pitch, weather, build_hash)
   values ($1, $5, 'league', $2, $3, $2,
       'Fred XI win by 40 runs', 250, 300, 210, 300,
       '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 42, 'balanced', 'Sunny', $4)`,
  [lg.id, fredTeam, aliceTeam, BUILD_HASH, fixtureId]);
const fredStand = await one(`select w,l,t,pts,nrr from app.standings where team_id=$1`, [fredTeam]);
const aliceStand = await one(`select w,l,t,pts,nrr from app.standings where team_id=$1`, [aliceTeam]);
ok(Number(fredStand.w) === 1 && Number(fredStand.pts) === 2 && Number(fredStand.nrr) > 0,
   `standings: winner has W=1, 2 pts, +NRR (nrr=${fredStand.nrr})`);
ok(Number(aliceStand.l) === 1 && Number(aliceStand.pts) === 0 && Number(aliceStand.nrr) < 0,
   `standings: loser has L=1, 0 pts, -NRR (nrr=${aliceStand.nrr})`);

console.log(`\n${pass} passed, ${fail} failed`);
await db.close();
