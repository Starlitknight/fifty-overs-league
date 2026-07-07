// Phase 2 tests — constrained-action API + snake-deal.
//   cd supabase && node tests/run_phase2.mjs        (exit 0 = all pass)
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { snakeDeal, dealReport, bucketAvg } from '../functions/_shared/draft.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = (f) => readFileSync(resolve(__dirname, '../migrations/' + f), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : (fail++, process.exitCode = 1); };
const throws = async (fn, re, m) => {
  try { await fn(); ok(false, m + '  (expected error, got success)'); }
  catch (e) { ok(re.test(e.message), `${m}  [${e.message.split('\n')[0]}]`); }
};

// ---- synthetic but engine-shaped pool -------------------------------------
// Enough distinct-rating players to fill a legal squad with room to overspend.
function mkPlayer(i, { keeper = false, bowl = 'none', fee = 20000, rating = 30000 } = {}) {
  return { name: `P${i}`, age: 25, nat: 'England', hand: 'R', role: 'topOrderBat',
           bowlTypeFull: bowl, keeper, fee, wage: 900, rating,
           skills: { power: 50, keeping: keeper ? 70 : 10 }, talents: [] };
}
// a legal, affordable 11: 1 keeper + 5 bowlers + 5 bats, fees sum to 220k (< 1M)
function legalPool() {
  const ps = [];
  ps.push(mkPlayer(0, { keeper: true, fee: 20000, rating: 40000 }));
  for (let i = 1; i <= 5; i++) ps.push(mkPlayer(i, { bowl: 'seamMedium', fee: 20000, rating: 35000 - i * 100 }));
  for (let i = 6; i <= 12; i++) ps.push(mkPlayer(i, { bowl: 'none', fee: 20000, rating: 30000 - i * 100 }));
  return ps; // 13 players available
}

const db = new PGlite();
await db.exec(sql('0001_init.sql'));
await db.exec(sql('0002_actions.sql'));
console.log('migrations applied OK\n');

const UID = { f: '11111111-1111-1111-1111-111111111111',
              a: '22222222-2222-2222-2222-222222222222',
              b: '33333333-3333-3333-3333-333333333333' };
const auth = (u) => db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [u ?? '']);
const one  = async (s, a = []) => (await db.query(s, a)).rows[0];
const val  = async (s, a = []) => Object.values(await one(s, a))[0];
const HASH = 'e558745ede94e2502d5cccaa829feb42818cbcb1e779664c4b784a851b3f00ff';

// bootstrap league + two managers
await auth(UID.f);
const lg = await one(`select id from app.create_league('L', $1, 'Fred', 'Fred XI')`, [HASH]);
await db.query(`select app.create_invite($1,'JOIN-A','manager')`, [lg.id]);
await auth(UID.a);
const aMid = await val(`select app.redeem_invite('JOIN-A','Alice','Alice XI')`);
await auth(UID.f);
const fMid = await val(`select app.resolve_manager_id($1)`, [lg.id]);

// ===========================================================================
// (d) snake-deal: unique + near-equal buckets
// ===========================================================================
console.log('— snake-deal —');
// The founder generates a master pool sized as a multiple of N (perManager * N),
// so every manager gets an EQUAL-size private bucket. Wide rating spread on purpose.
const mkMaster = (count) => Array.from({ length: count }, (_, i) =>
  mkPlayer(i, { rating: 46000 - i * 500 + (i % 4) * 300 }));
for (const N of [3, 4, 5]) {
  const master = mkMaster(15 * N);                 // 15 players per manager
  const buckets = snakeDeal(master, N);
  const rep = dealReport(buckets);
  ok(rep.allUnique && rep.uniquePlayers === master.length,
     `N=${N}: every player dealt exactly once (${rep.uniquePlayers}/${master.length}, sizes ${rep.sizes})`);
  ok(rep.sizeSpread === 0, `N=${N}: equal-size buckets`);
  ok(rep.avgSpreadPct < 0.01,
     `N=${N}: bucket avg ratings within a few points of equal (avgs ${rep.avgs}, spread ${rep.avgSpread}, ${(rep.avgSpreadPct*100).toFixed(3)}%)`);
}
// And uneven pools still stay disjoint + size-balanced (avg tension is expected):
{
  const rep = dealReport(snakeDeal(mkMaster(44), 5));
  ok(rep.allUnique && rep.sizeSpread <= 1,
     `uneven pool (44/5): still unique + sizes within 1 (sizes ${rep.sizes})`);
}

// persist Fred + Alice buckets from a 2-way deal, then use them below.
const twoBuckets = snakeDeal(legalPool().concat(
  Array.from({ length: 8 }, (_, i) => mkPlayer(100 + i, { fee: 20000, rating: 25000 - i * 50 }))), 2);
await auth(UID.f);
await db.query(`select app.lock_managers($1)`, [lg.id]);
await db.query(`select app.write_draft_pool($1,$2,$3)`, [lg.id, fMid, JSON.stringify(twoBuckets[0])]);
await db.query(`select app.write_draft_pool($1,$2,$3)`, [lg.id, aMid, JSON.stringify(twoBuckets[1])]);
ok(await val(`select count(*)::int from app.draft_pools where league_id=$1`, [lg.id]) === 2,
   'two private draft buckets persisted');

// ===========================================================================
// (a) cannot sign a player outside your pool
// ===========================================================================
console.log('\n— sign_player validations —');
// give Fred a KNOWN legal pool so we control fees/keeper/bowlers
const fredPool = legalPool();
await db.query(`select app.write_draft_pool($1,$2,$3)`, [lg.id, fMid, JSON.stringify(fredPool)]);
await auth(UID.f);
// a name that exists only in Alice's bucket, not Fred's
const aliceOnly = twoBuckets[1].find(p => !fredPool.some(q => q.name === p.name)).name;
await throws(() => db.query(`select app.sign_player($1,$2)`, [lg.id, aliceOnly]),
  /not in your draft pool/, '(a) signing a player outside your pool is rejected');
// signing one from Fred's own pool works
await db.query(`select app.sign_player($1,'P0')`, [lg.id]);   // the keeper
ok(await val(`select budget_spent from app.squads s join app.teams t on t.id=s.team_id
              where t.manager_id=$1`, [fMid]) === 20000, 'signing from your pool debits the fee');

// ===========================================================================
// (b) cannot overspend
// ===========================================================================
// shrink the budget so the next signing blows it, to test the guard directly
await db.query(`update app.leagues set draft_budget = 30000 where id=$1`, [lg.id]);
await throws(() => db.query(`select app.sign_player($1,'P1')`, [lg.id]),
  /over budget/, '(b) a signing that exceeds the budget is rejected');
await db.query(`update app.leagues set draft_budget = 1000000 where id=$1`, [lg.id]);

// ===========================================================================
// confirm_squad legality (reuse the game's rule)
// ===========================================================================
console.log('\n— confirm_squad legality —');
await throws(() => db.query(`select app.confirm_squad($1)`, [lg.id]),
  /illegal squad.*players/, 'confirm rejects a <11 squad with a reason');
// sign a full legal 11 (P0 keeper already signed; add P1..P5 bowlers, P6..P10 bats)
for (const nm of ['P1','P2','P3','P4','P5','P6','P7','P8','P9','P10'])
  await db.query(`select app.sign_player($1,$2)`, [lg.id, nm]);
const okSquad = await one(`select confirmed from app.confirm_squad($1)`, [lg.id]);
ok(okSquad.confirmed === true, 'a legal squad (>=11, keeper, >=5 bowlers, in budget) confirms');
// after confirm, signing is disabled
await throws(() => db.query(`select app.sign_player($1,'P11')`, [lg.id]),
  /already confirmed/, 'signing is disabled once the squad is confirmed');

// prove the keeper + bowler rules independently: Alice builds an 11 with NO keeper
console.log('  · keeper/bowler rules');
await db.query(`update app.draft_pools set players=$2 where league_id=$1 and manager_id=$3`,
  [lg.id, JSON.stringify(Array.from({length:12},(_,i)=>mkPlayer(200+i,{bowl:i<6?'seamMedium':'none',fee:1000,rating:20000}))), aMid]);
await auth(UID.a);
for (let i = 0; i < 11; i++) await db.query(`select app.sign_player($1,$2)`, [lg.id, 'P' + (200 + i)]);
await throws(() => db.query(`select app.confirm_squad($1)`, [lg.id]),
  /no wicketkeeper/, 'confirm rejects an 11 with no keeper');

// ===========================================================================
// (c) cannot submit orders after lock
// ===========================================================================
console.log('\n— submit_orders lock —');
await auth(UID.f);
const fredTeam = await val(`select id from app.teams where manager_id=$1`, [fMid]);
const aliceTeam = await val(`select id from app.teams where manager_id=$1`, [aMid]);
// a fixture that already kicked off (lock = resolve_at in the past)
const pastFix = await val(
  `insert into app.fixtures(league_id, round, home_team_id, away_team_id, ground, pitch, weather, seed, resolve_at)
   values ($1,1,$2,$3,'G','balanced','Sunny',1, now() - interval '1 minute') returning id`,
  [lg.id, fredTeam, aliceTeam]);
await throws(() => db.query(`select app.submit_orders($1,$2,null,$3)`, [lg.id, pastFix, '{}']),
  /orders locked/, '(c) submitting orders after the lock time is rejected');
// a fixture in the future accepts orders
const futFix = await val(
  `insert into app.fixtures(league_id, round, home_team_id, away_team_id, ground, pitch, weather, seed, resolve_at)
   values ($1,2,$2,$3,'G','balanced','Sunny',2, now() + interval '2 hours') returning id`,
  [lg.id, fredTeam, aliceTeam]);
const ordRow = await one(
  `select last_used, captain from app.submit_orders($1,$2,null,$3)`,
  [lg.id, futFix, JSON.stringify({ captain: 'P0', batOrder: ['P0','P1'], phaseIntent: { pp: 1, mid: 1, death: 2 } })]);
ok(ordRow.last_used === true && ordRow.captain === 'P0',
   'submitting before lock succeeds and marks last_used');

// ===========================================================================
// availability window at challenge acceptance
// ===========================================================================
console.log('\n— accept_challenge availability window —');
// Fred already has futFix at now+2h. A friendly whose kickoff is inside that
// window must be rejected on accept; one comfortably outside must be accepted.
await auth(UID.f);
const clash = await val(
  `select id from app.issue_challenge($1,$2,'balanced','Sunny',7, now() + interval '2 hours')`,
  [lg.id, aliceTeam]);       // Fred(from) already booked at now+2h => clash
const clear = await val(
  `select id from app.issue_challenge($1,$2,'balanced','Sunny',8, now() + interval '10 hours')`,
  [lg.id, aliceTeam]);
await auth(UID.a); // Alice is the challenged team, she accepts
await throws(() => db.query(`select app.accept_challenge($1,$2)`, [lg.id, clash]),
  /already booked/, 'accepting a friendly overlapping an official match is rejected');
const acc = await one(`select status from app.accept_challenge($1,$2)`, [lg.id, clear]);
ok(acc.status === 'accepted', 'accepting a non-overlapping friendly succeeds');
// issuing with <1h kickoff is rejected
await auth(UID.f);
await throws(() => db.query(`select app.issue_challenge($1,$2,'balanced','Sunny',9, now() + interval '10 minutes')`, [lg.id, aliceTeam]),
  /at least 1 hour/, 'issuing a challenge <1h out is rejected');

console.log(`\n${pass} passed, ${fail} failed`);
await db.close();
