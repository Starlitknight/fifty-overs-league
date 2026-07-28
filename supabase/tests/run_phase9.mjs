// In-game draft server actions: create_league_team + submit_league_squad.
//   cd supabase && node tests/run_phase9.mjs
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
await auth(A); await db.query(`select app.redeem_invite('J','Al','Al XI')`);

// create_league_team: sets name, country, manager name, and a stable unique seed
await auth(F);
const t1 = await one(`select name, country, draft_seed from app.create_league_team($1,'Kings XI','Fred the Founder','India')`, [lg]);
ok(t1.name === 'Kings XI' && t1.country === 'India' && Number.isInteger(t1.draft_seed) && t1.draft_seed > 0,
   `create_league_team sets name/country + positive seed (seed=${t1.draft_seed})`);
ok(await val(`select display_name from app.members where auth_uid=$1 and league_id=$2`, [F, lg]) === 'Fred the Founder',
   'manager display name is updated');
// seed is stable across calls (same team)
const t1b = await val(`select draft_seed from app.create_league_team($1,'Kings XI','Fred the Founder','India')`, [lg]);
ok(t1b === t1.draft_seed, 'draft_seed is stable for the same team');
// a different team gets a different seed
await auth(A);
const t2seed = await val(`select draft_seed from app.create_league_team($1,'Titans','Al the Boss','Australia')`, [lg]);
ok(t2seed !== t1.draft_seed, 'a different team gets a different seed (unique pools)');

// submit_league_squad: legality enforced
console.log('— submit_league_squad —');
const mk = (i, o = {}) => Object.assign({ name: 'P' + i, role: 'topOrderBat', bowlTypeFull: 'none', keeper: false, fee: 20000, rating: 30000, skills: {} }, o);
const illegal = [mk(1)]; // 1 player
await auth(F);
await throws(() => db.query(`select app.submit_league_squad($1,$2)`, [lg, JSON.stringify(illegal)]),
  /illegal squad.*players/, 'submit rejects a <11 squad');
// a legal 11: keeper + 5 bowlers + 5 bats, fees 220k < 1M
const legal = [mk(0, { keeper: true })].concat(
  [1, 2, 3, 4, 5].map(i => mk(i, { bowlTypeFull: 'seamMedium' })),
  [6, 7, 8, 9, 10].map(i => mk(i)));
const sq = await one(`select confirmed, budget_spent from app.submit_league_squad($1,$2)`, [lg, JSON.stringify(legal)]);
ok(sq.confirmed === true && Number(sq.budget_spent) === 220000,
   'submit accepts a legal 11 and records budget spent');
// no keeper => rejected
const noKeeper = [1,2,3,4,5].map(i=>mk(i,{bowlTypeFull:'seamMedium'})).concat([6,7,8,9,10,11].map(i=>mk(i)));
await throws(() => db.query(`select app.submit_league_squad($1,$2)`, [lg, JSON.stringify(noKeeper)]),
  /no wicketkeeper/, 'submit rejects an 11 with no keeper');

console.log(`\n${pass} passed, ${fail} failed`);
await db.close();
