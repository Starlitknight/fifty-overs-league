// Follow-ups — season rollover (engine aging) + timezone-correct fixtures.
//   NODE_PATH=/opt/node22/lib/node_modules node tests/run_phase7.mjs
import { PGlite } from '@electric-sql/pglite';
import { applyAllMigrations } from './_migrate.mjs';
import { doubleRoundRobin } from '../functions/_shared/schedule.js';
import { openEngine, ageSquad } from '../../resolver/resolve.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : (fail++, process.exitCode = 1); };
const throws = async (fn, re, m) => {
  try { await fn(); ok(false, m + '  (expected error)'); }
  catch (e) { ok(re.test(e.message), `${m}  [${e.message.split('\n')[0]}]`); }
};

const db = new PGlite();
await applyAllMigrations(db);
const auth = (u) => db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [u ?? '']);
const one  = async (s, a = []) => (await db.query(s, a)).rows[0];
const val  = async (s, a = []) => Object.values(await one(s, a))[0];
const HASH = 'e558745ede94e2502d5cccaa829feb42818cbcb1e779664c4b784a851b3f00ff';
const F = '11111111-1111-1111-1111-111111111111', A = '22222222-2222-2222-2222-222222222222';

// ============================================================================
// timezone-correct resolve_at
// ============================================================================
console.log('— timezone-aware fixtures —');
await auth(F);
const lgNY = await one(
  `select id from app.create_league('NY','${HASH}','Fred','Fred XI')`);
await db.query(`update app.leagues set tz='America/New_York', match_time='17:00' where id=$1`, [lgNY.id]);
await db.query(`select app.create_invite($1,'J','manager')`, [lgNY.id]);
await auth(A); await db.query(`select app.redeem_invite('J','Al','Al XI')`);
await auth(F);
const teams = (await db.query(`select id from app.teams where league_id=$1 order by created_at`, [lgNY.id])).rows.map(r => r.id);
const sched = doubleRoundRobin(teams, { seedBase: 5000 });   // round 1 only for 2 teams
await db.query(`select app.write_fixtures($1,1,$2,'2020-06-01')`, [lgNY.id, JSON.stringify(sched)]);
const ra = await val(`select resolve_at from app.fixtures where league_id=$1 and round=1 limit 1`, [lgNY.id]);
// 2020-06-01 17:00 America/New_York (EDT = UTC-4) => 21:00 UTC
ok(new Date(ra).toISOString() === '2020-06-01T21:00:00.000Z',
   `NY league 17:00 EDT resolves to 21:00 UTC (got ${new Date(ra).toISOString()})`);

// a UTC league: 17:00 UTC stays 17:00 UTC
await auth(F);
const lgUTC = await one(`select id from app.create_league('U','${HASH}','G','G XI')`);
await db.query(`select app.create_invite($1,'JU','manager')`, [lgUTC.id]);
await auth(A); await db.query(`select app.redeem_invite('JU','H','H XI')`);
await auth(F);
const t2 = (await db.query(`select id from app.teams where league_id=$1 order by created_at`, [lgUTC.id])).rows.map(r => r.id);
await db.query(`select app.write_fixtures($1,1,$2,'2020-06-01')`, [lgUTC.id, JSON.stringify(doubleRoundRobin(t2))]);
const raU = await val(`select resolve_at from app.fixtures where league_id=$1 and round=1 limit 1`, [lgUTC.id]);
ok(new Date(raU).toISOString() === '2020-06-01T17:00:00.000Z',
   `UTC league 17:00 stays 17:00 UTC (got ${new Date(raU).toISOString()})`);

// ============================================================================
// season rollover — engine aging model
// ============================================================================
console.log('\n— season rollover (engine aging) —');
const eng = await openEngine();
const baseSquad = await eng.page.evaluate(() => GD.teams[0].players.map(p => JSON.parse(JSON.stringify(p))));

// craft ages: a 20yo (ages fine), a 31yo (declines), a 34yo (retires at 35)
const squad = baseSquad.slice(0, 12).map((p, i) => ({ ...p, age: i === 0 ? 20 : i === 1 ? 31 : i === 2 ? 34 : 26 }));
const young = squad[0], decliner = squad[1], oldie = squad[2];

const aged = await ageSquad(eng.page, squad, 2, 'team-key-A');
ok(aged.players.every(p => squad.find(s => s.name === p.name).age + 1 === p.age || p.retired),
   'every surviving player aged by exactly one year');
ok(aged.retired.includes(oldie.name),
   `the 34yo retired at 35 (${oldie.name})`);
ok(!aged.players.some(p => p.name === oldie.name),
   'a retired player is removed from the roster');
const youngAfter = aged.players.find(p => p.name === young.name);
ok(youngAfter && youngAfter.age === 21 && youngAfter.fatigue === 'rested' && youngAfter.formIx === 3,
   'a 20yo ages to 21 with a fresh-season reset (rested, steady form)');
const declinerAfter = aged.players.find(p => p.name === decliner.name);
const declined = declinerAfter && (declinerAfter.skills.power < decliner.skills.power ||
                                   declinerAfter.skills.stamina < decliner.skills.stamina);
ok(declined, 'a 31yo declined in physical skills (power/stamina)');

// determinism: same (seasonNo, teamKey) => identical result
const aged2 = await ageSquad(eng.page, squad, 2, 'team-key-A');
ok(JSON.stringify(aged) === JSON.stringify(aged2), 'aging is deterministic per (seasonNo, teamKey)');
const agedDiffKey = await ageSquad(eng.page, squad, 2, 'team-key-B');
ok(JSON.stringify(aged) !== JSON.stringify(agedDiffKey) || aged.retired.length === 0,
   'a different team key gives an independent (generally different) roll');
await eng.close();

// ============================================================================
// founder_advance_season persists aged rosters + bumps the season
// ============================================================================
console.log('\n— founder_advance_season —');
await auth(F);
const lg = await one(`select id, season_no from app.create_league('S','${HASH}','Fred','Fred XI')`);
await db.query(`select app.create_invite($1,'JS','manager')`, [lg.id]);
await auth(A); const aMid = await val(`select app.redeem_invite('JS','Al','Al XI')`);
await auth(F); const fMid = await val(`select app.resolve_manager_id($1)`, [lg.id]);
const fTeam = await val(`select id from app.teams where manager_id=$1`, [fMid]);
const aTeam = await val(`select id from app.teams where manager_id=$1`, [aMid]);
for (const tid of [fTeam, aTeam])
  await db.query(`insert into app.squads(team_id, league_id, roster, confirmed) values ($1,$2,'[]',true)
                  on conflict (team_id) do update set roster='[]'`, [tid, lg.id]);

const agedPayload = [
  { team_id: fTeam, roster: aged.players },
  { team_id: aTeam, roster: aged.players.slice(0, 5) },
];
// non-founder cannot advance the season
await auth(A);
await throws(() => db.query(`select app.founder_advance_season($1,$2)`, [lg.id, JSON.stringify(agedPayload)]),
  /founder-only/, 'non-founder cannot advance the season');
await auth(F);
const n = await val(`select app.founder_advance_season($1,$2)`, [lg.id, JSON.stringify(agedPayload)]);
ok(n === 2, 'aged rosters written for both squads');
ok(await val(`select jsonb_array_length(roster) from app.squads where team_id=$1`, [fTeam]) === aged.players.length,
   'the founder squad now holds the aged roster');
ok(Number(await val(`select season_no from app.leagues where id=$1`, [lg.id])) === 2,
   'league season_no advanced to 2');

console.log(`\n${pass} passed, ${fail} failed`);
await db.close();
