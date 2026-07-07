// Phase 3 END-TO-END friendly loop: real DB (PGlite) + real engine (Playwright).
//   issue → accept → edit-until-lock → SERVER lock (+ no-show autofill) →
//   resolver runs __resolveMatch → store result → deterministic replay verify.
//
//   NODE_PATH=/opt/node22/lib/node_modules node tests/run_phase3.mjs
import { PGlite } from '@electric-sql/pglite';
import { applyAllMigrations } from './_migrate.mjs';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { openEngine, resolveMatch, buildHash } from '../../resolver/resolve.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const mig = (f) => readFileSync(resolve(__dirname, '../migrations/' + f), 'utf8');
const sha = (s) => createHash('sha256').update(s).digest('hex');

let pass = 0, fail = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); c ? pass++ : (fail++, process.exitCode = 1); };
const throws = async (fn, re, m) => {
  try { await fn(); ok(false, m + '  (expected error)'); }
  catch (e) { ok(re.test(e.message), `${m}  [${e.message.split('\n')[0]}]`); }
};

const db = new PGlite();
await applyAllMigrations(db);
console.log('migrations applied OK');

const UID = { f: '11111111-1111-1111-1111-111111111111', a: '22222222-2222-2222-2222-222222222222' };
const auth = (u) => db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [u ?? '']);
const one  = async (s, a = []) => (await db.query(s, a)).rows[0];
const val  = async (s, a = []) => Object.values(await one(s, a))[0];
const PIN  = buildHash();

// ---- open the real engine, pull two real squads from GD.teams ----
const eng = await openEngine();
ok(eng.hash === PIN, `resolver build hash matches file (${PIN.slice(0,12)}…)`);
const squads = await eng.page.evaluate(() => ([
  { name: GD.teams[0].name, players: GD.teams[0].players },
  { name: GD.teams[1].name, players: GD.teams[1].players },
]));

// ---- bootstrap league + two managers, seed confirmed squads ----
await auth(UID.f);
const lg = await one(`select id, build_hash from app.create_league('L', $1, 'Fred', $2)`, [PIN, squads[0].name]);
await db.query(`select app.create_invite($1,'JOIN-A','manager')`, [lg.id]);
await auth(UID.a);
const aMid = await val(`select app.redeem_invite('JOIN-A','Alice',$1)`, [squads[1].name]);
await auth(UID.f);
const fMid = await val(`select app.resolve_manager_id($1)`, [lg.id]);
const fTeam = await val(`select id from app.teams where manager_id=$1`, [fMid]);
const aTeam = await val(`select id from app.teams where manager_id=$1`, [aMid]);
// seed each team's server-owned roster with a real engine squad, mark confirmed
for (const [team, sq] of [[fTeam, squads[0]], [aTeam, squads[1]]]) {
  await db.query(`insert into app.squads(team_id, league_id, roster, confirmed)
                  values ($1,$2,$3,true)
                  on conflict (team_id) do update set roster=excluded.roster, confirmed=true`,
    [team, lg.id, JSON.stringify(sq.players)]);
}

// =========================================================================
// (1) issue → accept
// =========================================================================
console.log('\n— challenge → accept —');
await auth(UID.f);
const ch = await val(
  `select id from app.issue_challenge($1,$2,'green','Chilly',73501, now() + interval '1 hour')`,
  [lg.id, aTeam]);
await auth(UID.a);
const accepted = await one(`select status from app.accept_challenge($1,$2)`, [lg.id, ch]);
ok(accepted.status === 'accepted', 'challenge accepted');

// =========================================================================
// (2) edit-until-lock: BOTH submit orders before lock; after lock, rejected
// =========================================================================
console.log('\n— edit-until-lock —');
const fKeeper = squads[0].players.find(p => p.keeper)?.name ?? squads[0].players[0].name;
const aKeeper = squads[1].players.find(p => p.keeper)?.name ?? squads[1].players[0].name;
await auth(UID.f);
await db.query(`select app.submit_orders($1,null,$2,$3)`, [lg.id, ch,
  JSON.stringify({ keeper: fKeeper, phaseIntent: { pp: 1, mid: 1, death: 2 } })]);
await auth(UID.a);
await db.query(`select app.submit_orders($1,null,$2,$3)`, [lg.id, ch,
  JSON.stringify({ keeper: aKeeper, phaseIntent: { pp: 0, mid: 0, death: 1 } })]);
ok(await val(`select count(*)::int from app.orders where challenge_id=$1`, [ch]) === 2,
   'both sides submitted orders before lock');

// advance the clock: kickoff now in the past so the lock window has passed
await db.query(`update app.challenges set kickoff_at = now() - interval '1 minute' where id=$1`, [ch]);
await throws(() => db.query(`select app.submit_orders($1,null,$2,$3)`, [lg.id, ch, '{}']),
  /orders locked/, 'editing orders after kickoff-5min is rejected by the server');

// =========================================================================
// (3) SERVER lock
// =========================================================================
console.log('\n— server lock —');
await db.query(`select app.lock_match_orders($1)`, [ch]);
ok(await val(`select count(*)::int from app.orders where challenge_id=$1 and locked`, [ch]) === 2,
   'server locked both lineups');
ok(await val(`select status::text from app.challenges where id=$1`, [ch]) === 'locked',
   'challenge status is locked');

// =========================================================================
// (4) resolver simulates at kickoff, (5) store result
// =========================================================================
console.log('\n— resolve + store —');
const inputs = await val(`select app.friendly_inputs($1)`, [ch]);
const payload = await resolveMatch(eng.page, inputs, { pinnedHash: lg.build_hash });
ok(!!payload.result_text && (payload.winner_team || payload.result_text.match(/tie/i)),
   `resolver produced a result: ${payload.result_text}`);
const stored = await one(`select * from app.store_friendly_result($1,$2,$3)`,
  [ch, JSON.stringify(payload), PIN]);
ok(stored.comp === 'friendly' && stored.challenge_id === ch && stored.build_hash === PIN,
   'result stored as a friendly, tagged with the build hash');
ok(await val(`select status::text from app.challenges where id=$1`, [ch]) === 'resolved',
   'challenge marked resolved');
// winner mapped to an id (not string-parsed), consistent with the text
const winnerName = await (async () => {
  if (!stored.winner_team_id) return null;
  return val(`select name from app.teams where id=$1`, [stored.winner_team_id]);
})();
ok(winnerName === payload.winner_team,
   `winner_team_id maps to the engine winner name (${winnerName})`);

// =========================================================================
// (6) DETERMINISTIC REPLAY: a client re-resolving from the SAME stored server
//     inputs must reproduce the stored result byte-for-byte.
// =========================================================================
console.log('\n— deterministic replay verification —');
const replayInputs = await val(`select app.friendly_inputs($1)`, [ch]); // same locked inputs
const replay = await resolveMatch(eng.page, replayInputs, { pinnedHash: lg.build_hash });
// (i) determinism: a fresh resolve from the same DB-assembled inputs is byte-
//     identical to the resolver's payload (this is the anti-cheat guarantee).
const core = r => JSON.stringify({ result_text: r.result_text, scorecard: r.scorecard, worm: r.worm, log: r.log });
console.log('    payload sha:', sha(core(payload)).slice(0,16), ' replay sha:', sha(core(replay)).slice(0,16));
ok(core(payload) === core(replay),
   'a client re-resolving from the stored server inputs reproduces the result byte-for-byte');
// (ii) storage fidelity: the stored jsonb equals the payload structurally
//      (jsonb canonicalizes key order, so compare order-insensitively).
const sortKeys = (x) => Array.isArray(x) ? x.map(sortKeys)
  : (x && typeof x === 'object')
    ? Object.fromEntries(Object.keys(x).sort().map(k => [k, sortKeys(x[k])]))
    : x;
const canon = (x) => JSON.stringify(sortKeys(x));
ok(canon(stored.scorecard) === canon(payload.scorecard) &&
   canon(stored.worm) === canon(payload.worm) &&
   stored.result_text === payload.result_text,
   'the stored result is structurally identical to what the resolver computed (no corruption on persist)');

// =========================================================================
// (7) no-show auto-fill: a second friendly where the challenged side never sets
//     orders. Lock auto-fills; the match still resolves.
// =========================================================================
console.log('\n— no-show auto-fill —');
await auth(UID.f);
const ch2 = await val(
  `select id from app.issue_challenge($1,$2,'balanced','Sunny',555, now() + interval '1 hour')`,
  [lg.id, aTeam]);
await auth(UID.a);
await db.query(`select app.accept_challenge($1,$2)`, [lg.id, ch2]);
await auth(UID.f);
await db.query(`select app.submit_orders($1,null,$2,$3)`, [lg.id, ch2,
  JSON.stringify({ keeper: fKeeper, phaseIntent: { pp: 2, mid: 2, death: 2 } })]); // only Fred sets orders
await db.query(`update app.challenges set kickoff_at = now() - interval '1 minute' where id=$1`, [ch2]);
await db.query(`select app.lock_match_orders($1)`, [ch2]);
ok(await val(`select count(*)::int from app.orders where challenge_id=$1 and locked`, [ch2]) === 2,
   'no-show side was auto-filled at lock (2 locked lineups)');
const p2 = await resolveMatch(eng.page, await val(`select app.friendly_inputs($1)`, [ch2]), { pinnedHash: PIN });
await db.query(`select app.store_friendly_result($1,$2,$3)`, [ch2, JSON.stringify(p2), PIN]);
ok(!!p2.result_text, `no-show match still resolved: ${p2.result_text}`);

// =========================================================================
// (8) engine-hash abort: a league pinned to a different build must refuse to run
// =========================================================================
await throws(() => resolveMatch(eng.page, inputs, { pinnedHash: 'deadbeef' }),
  /ENGINE HASH MISMATCH/, 'resolver aborts when its build != the league pinned hash');

await eng.close();
console.log(`\n${pass} passed, ${fail} failed`);
await db.close();
