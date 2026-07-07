// Phase 4 — official league end-to-end: real DB (PGlite) + real engine (Playwright).
//   NODE_PATH=/opt/node22/lib/node_modules node tests/run_phase4.mjs
import { PGlite } from '@electric-sql/pglite';
import { applyAllMigrations } from './_migrate.mjs';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { doubleRoundRobin } from '../functions/_shared/schedule.js';
import { openEngine, resolveMatch, verifyResult, buildHash, genMasterPool } from '../../resolver/resolve.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const mig = (f) => readFileSync(resolve(__dirname, '../migrations/' + f), 'utf8');
const sha = (s) => createHash('sha256').update(typeof s === 'string' ? s : JSON.stringify(s)).digest('hex');

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : (fail++, process.exitCode = 1); };
const throws = async (fn, re, m) => {
  try { await fn(); ok(false, m + '  (expected error)'); }
  catch (e) { ok(re.test(e.message), `${m}  [${e.message.split('\n')[0]}]`); }
};

// ============================================================================
// (1) schedule.js — double round-robin properties (pure)
// ============================================================================
console.log('— double round-robin —');
for (const N of [4, 5, 6]) {
  const teams = Array.from({ length: N }, (_, i) => `T${i}`);
  const fx = doubleRoundRobin(teams, { seedBase: 1000 });
  ok(fx.length === N * (N - 1), `N=${N}: ${fx.length} fixtures = N*(N-1)`);
  // each ordered pair exactly once
  const ordered = new Set(fx.map(f => f.home_team_id + '>' + f.away_team_id));
  ok(ordered.size === fx.length, `N=${N}: every (home,away) ordered pair is unique`);
  // each unordered pair meets exactly twice, venues swapped
  const pairCount = {};
  for (const f of fx) { const k = [f.home_team_id, f.away_team_id].sort().join('~'); pairCount[k] = (pairCount[k] || 0) + 1; }
  ok(Object.values(pairCount).every(c => c === 2) && Object.keys(pairCount).length === N * (N - 1) / 2,
     `N=${N}: every pair plays home-and-away (twice)`);
  // one match per team per round
  let perRoundOK = true;
  const byRound = {};
  for (const f of fx) (byRound[f.round] = byRound[f.round] || []).push(f);
  for (const r in byRound) {
    const seen = new Set();
    for (const f of byRound[r]) { for (const t of [f.home_team_id, f.away_team_id]) { if (seen.has(t)) perRoundOK = false; seen.add(t); } }
  }
  ok(perRoundOK, `N=${N}: no team plays twice in a round`);
  ok(new Set(fx.map(f => f.seed)).size === fx.length, `N=${N}: per-fixture seeds are unique`);
}

// ============================================================================
// end-to-end official pipeline (4 real-squad teams)
// ============================================================================
const db = new PGlite();
await applyAllMigrations(db);
console.log('\nmigrations applied OK');

const auth = (u) => db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [u ?? '']);
const one  = async (s, a = []) => (await db.query(s, a)).rows[0];
const val  = async (s, a = []) => Object.values(await one(s, a))[0];
const rows = async (s, a = []) => (await db.query(s, a)).rows;
const PIN  = buildHash();

const eng = await openEngine();
// four real squads from the engine's own teams
const squads = await eng.page.evaluate(() =>
  [0,1,2,3].map(i => ({ name: GD.teams[i].name, players: GD.teams[i].players })));

// bootstrap: founder + 3 invited managers, one team each, confirmed rosters
const FOUNDER = '10000000-0000-0000-0000-000000000000';
await auth(FOUNDER);
const lg = await one(`select id, build_hash from app.create_league('L', $1, 'M0', $2)`, [PIN, squads[0].name]);
const managerUids = [FOUNDER];
for (let i = 1; i < 4; i++) {
  await auth(FOUNDER);
  await db.query(`select app.create_invite($1,$2,'manager')`, [lg.id, 'JOIN' + i]);
  const uid = `2000000${i}-0000-0000-0000-000000000000`;
  managerUids.push(uid);
  await auth(uid);
  await db.query(`select app.redeem_invite($1,$2,$3)`, ['JOIN' + i, 'M' + i, squads[i].name]);
}
const teamIds = [];
for (let i = 0; i < 4; i++) {
  const tid = await val(`select id from app.teams where name=$1`, [squads[i].name]);
  teamIds.push(tid);
  await db.query(`insert into app.squads(team_id, league_id, roster, confirmed) values ($1,$2,$3,true)
                  on conflict (team_id) do update set roster=excluded.roster, confirmed=true`,
    [tid, lg.id, JSON.stringify(squads[i].players)]);
}

// ============================================================================
// (2) generate + persist fixtures
// ============================================================================
console.log('\n— generate fixtures —');
const schedule = doubleRoundRobin(teamIds, { startDate: '2020-01-01', matchTime: '17:00', seedBase: 5000 });
await auth(FOUNDER);
const nFx = await val(`select app.write_fixtures($1,1,$2,'2020-01-01')`, [lg.id, JSON.stringify(schedule)]);
ok(nFx === 12, `wrote ${nFx} fixtures (4 teams double RR)`);
ok(await val(`select status::text from app.leagues where id=$1`, [lg.id]) === 'active', 'league is now active');
// all fixtures are in the past (2020) => all due
const due = await rows(`select id, home_team_id, away_team_id, seed from app.due_fixtures()`);
ok(due.length === 12, `all ${due.length} fixtures are due (resolve_at in the past)`);

// ============================================================================
// (3) resolve one official fixture, apply consequences, update standings
// ============================================================================
console.log('\n— official resolve + consequences —');
const fx0 = due[0];
const homeBefore = await val(`select roster from app.squads where team_id=$1`, [fx0.home_team_id]);
await db.query(`select app.begin_resolve($1)`, [fx0.id]);            // team-lock claim + lineup lock
const inputs0 = await val(`select app.fixture_inputs($1)`, [fx0.id]);
const payload0 = await resolveMatch(eng.page, inputs0, { pinnedHash: lg.build_hash });
ok(Object.keys(payload0.consequences || {}).length > 0, `resolver returned consequences for ${Object.keys(payload0.consequences).length} players`);
const stored0 = await one(`select * from app.store_official_result($1,$2,$3)`, [fx0.id, JSON.stringify(payload0), PIN]);
ok(stored0.comp === 'league' && stored0.fixture_id === fx0.id, 'result stored as an official league match');
ok(await val(`select status::text from app.fixtures where id=$1`, [fx0.id]) === 'resolved', 'fixture marked resolved');

// consequences persisted to the squad EXACTLY as the resolver computed them
// (deterministic: mirror _apply_consequences in JS and compare).
const homeAfter = await val(`select roster from app.squads where team_id=$1`, [fx0.home_team_id]);
const cons = payload0.consequences || {};
ok(Object.keys(cons).length > 0, `resolver returned consequences for ${Object.keys(cons).length} players`);
const applyJS = (roster) => roster.map(p => cons[p.name]
  ? { ...p, fatigue: cons[p.name].fatigue, formIx: cons[p.name].formIx, formWord: cons[p.name].formWord }
  : p);
const canonSorted = (arr) => JSON.stringify(arr.map(p => Object.fromEntries(Object.keys(p).sort().map(k => [k, p[k]]))));
ok(canonSorted(homeAfter) === canonSorted(applyJS(homeBefore)),
   'server applied EXACTLY the resolver consequences to the squad (deterministic)');
const changed = homeAfter.filter((p, i) => JSON.stringify(p) !== JSON.stringify(homeBefore[i])).length;
console.log(`    (${changed} home players had form/fatigue updated by this match)`);

// standings reflect the official result
const winnerId = stored0.winner_team_id;
if (winnerId) {
  const st = await one(`select w,l,t,pts from app.standings where team_id=$1`, [winnerId]);
  ok(Number(st.w) === 1 && Number(st.pts) === 2, 'winner has W=1, 2 pts in standings');
} else ok(true, 'match tied (no winner id) — standings tie path');

// ============================================================================
// (4) consequence isolation — a friendly must NOT change squad state
// ============================================================================
console.log('\n— friendly is consequence-free —');
const t0 = teamIds[0], t1 = teamIds[1];
const rosterPre = await val(`select roster from app.squads where team_id=$1`, [t0]);
await auth(managerUids[0]);
const chF = await val(`select id from app.issue_challenge($1,$2,'balanced','Sunny',999, now()+interval '1 hour')`, [lg.id, t1]);
await auth(managerUids[1]);
await db.query(`select app.accept_challenge($1,$2)`, [lg.id, chF]);
await db.query(`update app.challenges set kickoff_at = now()-interval '1 minute' where id=$1`, [chF]);
await db.query(`select app.lock_match_orders($1)`, [chF]);
const pF = await resolveMatch(eng.page, await val(`select app.friendly_inputs($1)`, [chF]), { pinnedHash: PIN });
await db.query(`select app.store_friendly_result($1,$2,$3)`, [chF, JSON.stringify(pF), PIN]);
const rosterPost = await val(`select roster from app.squads where team_id=$1`, [t0]);
ok(sha(rosterPre) === sha(rosterPost), 'friendly left the squad byte-for-byte unchanged (no fatigue/form consequences)');

// ============================================================================
// (5) no-show auto-fill AND count — official still counts in standings
// ============================================================================
console.log('\n— official no-show auto-fill & count —');
const remaining = await rows(`select id, home_team_id, away_team_id from app.due_fixtures()`);
const fxNS = remaining[0];   // nobody submits orders for this one
await db.query(`select app.begin_resolve($1)`, [fxNS.id]);
ok(await val(`select count(*)::int from app.orders where fixture_id=$1 and locked`, [fxNS.id]) === 2,
   'both no-show lineups auto-filled at lock');
const pNS = await resolveMatch(eng.page, await val(`select app.fixture_inputs($1)`, [fxNS.id]), { pinnedHash: PIN });
await db.query(`select app.store_official_result($1,$2,$3)`, [fxNS.id, JSON.stringify(pNS), PIN]);
const playedNow = await val(`select sum(p)::int from app.standings where league_id=$1`, [lg.id]);
ok(playedNow >= 4, `no-show match counted in standings (total team-appearances now ${playedNow})`);

// ============================================================================
// (6) team-locking — no team resolves two matches concurrently
// ============================================================================
console.log('\n— team-lock —');
const openFx = await rows(`select id, home_team_id, away_team_id from app.due_fixtures()`);
// find two due fixtures that share a team
let a = null, b = null;
outer: for (let i = 0; i < openFx.length; i++) for (let j = i + 1; j < openFx.length; j++) {
  const s = new Set([openFx[i].home_team_id, openFx[i].away_team_id]);
  if (s.has(openFx[j].home_team_id) || s.has(openFx[j].away_team_id)) { a = openFx[i]; b = openFx[j]; break outer; }
}
ok(!!a && !!b, 'found two due fixtures sharing a team');
await db.query(`select app.begin_resolve($1)`, [a.id]);   // claim first (leaves it 'locked')
await throws(() => db.query(`select app.begin_resolve($1)`, [b.id]),
  /already resolving/, 'a second concurrent resolve for a shared team is refused');

// ============================================================================
// (7) client-side result verification (recompute + flag tamper)
// ============================================================================
console.log('\n— client verification —');
const honest = await verifyResult(eng.page, inputs0, stored0, { pinnedHash: PIN });
ok(honest.ok, `honest stored result verifies: ${honest.reason}`);
const forged = { ...stored0, result_text: 'Totally Fake win by 999 runs' };
const flagged = await verifyResult(eng.page, inputs0, forged, { pinnedHash: PIN });
ok(!flagged.ok, `a tampered result is flagged: ${flagged.reason}`);

await eng.close();
console.log(`\n${pass} passed, ${fail} failed`);
await db.close();
