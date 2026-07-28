// PHASE 1b proof — the umpire's dual write, against real Postgres.
//
// resolver/publish.mjs is what keeps the relational league current: after every
// resolved round it writes the world down as rows. This suite runs that exact
// module — not a reimplementation of it — over a real engine-played season, on
// a real Postgres (PGlite) with every real migration applied. Only the HTTP
// framing is stood in for: a small shim answers the handful of PostgREST calls
// the resolver makes and turns them into SQL.
//
// What it has to prove, because getting these wrong loses a league quietly:
//   - a round's rows land, and the SQL table agrees with the engine
//   - running the same pass twice changes nothing (the umpire re-runs)
//   - a second round only writes the matches that are new
//   - a sold or retired player stops being on the squad
//   - the ball-by-ball is filed against the right match
//   - a missing `game` schema costs nothing but the rows
//
//   cd supabase && NODE_PATH=/opt/node22/lib/node_modules node tests/run_phase1b_publish.mjs
import { PGlite } from '@electric-sql/pglite';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { applyAllMigrations } from './_migrate.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GAME = resolve(__dirname, '../../.build/page.html');

let pass = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) process.exitCode = 1; else pass++; };

const db = new PGlite();
await applyAllMigrations(db);

// ---------------------------------------------------------------------------
// The shim: PostgREST's URL grammar, for the six shapes the resolver uses.
// ---------------------------------------------------------------------------
const BASE = 'https://sb.test';
let missingSchema = null;                 // set to 'game' to play "migration not run"

const lit = (v) => (v && typeof v === 'object' ? JSON.stringify(v) : v);

function where(params, args) {
  const parts = [];
  for (const [k, v] of params) {
    if (k === 'select' || k === 'on_conflict' || k === 'order' || k === 'limit') continue;
    const m = /^(eq|in)\.(.*)$/s.exec(v);
    if (!m) throw new Error('shim: unsupported filter ' + k + '=' + v);
    if (m[1] === 'eq') { args.push(m[2]); parts.push(`"${k}" = $${args.length}`); }
    else {
      const vals = m[2].replace(/^\(|\)$/g, '').split(',').filter(Boolean);
      if (!vals.length) { parts.push('false'); continue; }
      parts.push(`"${k}" in (${vals.map((v2) => { args.push(v2); return '$' + args.length; }).join(',')})`);
    }
  }
  return parts.length ? ' where ' + parts.join(' and ') : '';
}

globalThis.fetch = async (url, opt = {}) => {
  const u = new global.URL(String(url).replace(BASE + '/rest/v1/', BASE + '/'));
  const schema = (opt.headers && (opt.headers['Content-Profile'] || opt.headers['Accept-Profile'])) || 'app';
  const table = u.pathname.replace(/^\//, '');
  if (schema === missingSchema) {
    return new Response(JSON.stringify({ code: 'PGRST106', message: 'The schema must be one of the following: app' }), { status: 406 });
  }
  const params = [...u.searchParams.entries()];
  const sel = u.searchParams.get('select') || '*';
  const method = opt.method || 'GET';
  const args = [];
  try {
    if (method === 'GET') {
      const q = `select ${sel === '*' ? '*' : sel.split(',').map((c) => `"${c}"`).join(',')} from ${schema}.${table}${where(params, args)}`;
      return new Response(JSON.stringify((await db.query(q, args)).rows), { status: 200 });
    }
    if (method === 'DELETE') {
      const w = where(params, args);
      if (!w) return new Response('unfiltered delete refused', { status: 400 });
      await db.query(`delete from ${schema}.${table}${w}`, args);
      return new Response(null, { status: 204 });     // 204 must have no body
    }
    // POST = upsert. PostgREST needs every row to have the same shape; so do we.
    const rows = JSON.parse(opt.body);
    if (!rows.length) return new Response('[]', { status: 200 });
    const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const values = rows.map((r) => '(' + cols.map((c) => {
      args.push(lit(r[c] === undefined ? null : r[c])); return '$' + args.length;
    }).join(',') + ')').join(',');
    const conflict = u.searchParams.get('on_conflict');
    const upd = cols.filter((c) => !(conflict || '').split(',').includes(c));
    const q = `insert into ${schema}.${table} (${cols.map((c) => `"${c}"`).join(',')}) values ${values}` +
      (conflict ? ` on conflict (${conflict.split(',').map((c) => `"${c}"`).join(',')}) do update set ` +
        upd.map((c) => `"${c}" = excluded."${c}"`).join(',') : '') +
      (sel === '*' ? '' : ` returning ${sel.split(',').map((c) => `"${c}"`).join(',')}`);
    const res = await db.query(q, args);
    return new Response(JSON.stringify(res.rows || []), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ message: e.message }), { status: 400 });
  }
};

process.env.SUPABASE_URL = BASE;
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test';
const { publishRows } = await import('../../resolver/publish.mjs');

// ---------------------------------------------------------------------------
// A real season, played by the real engine, one round at a time.
// ---------------------------------------------------------------------------
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page.goto('file://' + GAME, { waitUntil: 'load' });
const snap3 = await page.evaluate(() => {
  econInit(); App.teamIx = 0; App.season = null; seasonInit(); App.round = 1; App.seasonNo = 1;
  App.cup = { stage: 0, alive: null, results: [], out: false }; App.results = [];
  try { mpInit(); } catch (e) {}
  for (let i = 0; i < 3; i++) completeRound();
  return snapshot(false);
});
// the next round is CONTINUED from the published snapshot, exactly as the
// umpire does it - a fresh playthrough would draw a different schedule and the
// two worlds would share no fixtures at all
const snap4 = await page.evaluate((s) => {
  window.restoreFrom(s);
  if (typeof window.mpInit === 'function') window.mpInit();
  completeRound();
  return snapshot(false);
}, snap3);
await browser.close();

// the league the umpire is advancing, in the schema it already had
const lg = (await db.query(
  `insert into app.leagues (name, founder_uid, build_hash) values ('Proof League', gen_random_uuid(), 'x') returning id`)).rows[0].id;
const mem = (await db.query(
  `insert into app.members (league_id, auth_uid, display_name) values ($1, gen_random_uuid(), 'Boss') returning id, auth_uid`, [lg])).rows[0];
await db.query(`insert into app.teams (league_id, manager_id, name) values ($1,$2,$3)`,
  [lg, mem.id, snap3.teams[0].name]);

// ---- 1. the first pass -----------------------------------------------------
const r1 = await publishRows(lg, 'Proof League', snap3);
ok(r1 && r1.clubs === snap3.teams.length, `first pass wrote ${r1 && r1.clubs} clubs`);
ok(r1.results > 0 && r1.results === (await db.query(`select count(*)::int n from game.results`)).rows[0].n,
  `first pass wrote ${r1.results} results`);
ok((await db.query(`select count(*)::int n from game.players`)).rows[0].n === r1.players,
  `first pass wrote ${r1.players} players`);
ok((await db.query(`select manager_uid from game.clubs where league_id=$1 and name=$2`, [lg, snap3.teams[0].name])).rows[0].manager_uid === mem.auth_uid,
  "the human's club carries its owner");
ok(r1.logs > 0 && (await db.query(`select count(*)::int n from game.match_logs`)).rows[0].n === r1.logs,
  `the ball-by-ball of the last ${r1.logs} match(es) is filed`);
ok((await db.query(
  `select count(*)::int n from game.match_logs m join game.results r on r.id = m.result_id
    where r.league_id = $1`, [lg])).rows[0].n === r1.logs, 'every log points at a real match');

// ---- 2. the table agrees with the engine -----------------------------------
const engTable = await (async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + GAME, { waitUntil: 'load' });
  const t = await p.evaluate((s) => { window.restoreFrom(s); return leagueRows('league').map((x) => ({ nm: x.nm, p: x.p, pts: x.pts, nrr: x.nrr })); }, snap3);
  await b.close(); return t;
})();
const sqlTable = (await db.query(
  `select club, p, pts, nrr from game.standings where league_id=$1 and season_no=1`, [lg])).rows;
const byName = Object.fromEntries(sqlTable.map((r) => [r.club, r]));
ok(engTable.every((e) => byName[e.nm] && byName[e.nm].p === e.p && byName[e.nm].pts === e.pts &&
  Math.abs(Number(byName[e.nm].nrr) - e.nrr) < 1e-6),
  'the rows the umpire wrote reproduce the engine table exactly');

// ---- 3. running the same pass again must change nothing --------------------
const before = (await db.query(`select
  (select count(*) from game.results) r, (select count(*) from game.players) p,
  (select count(*) from game.clubs) c, (select count(*) from game.match_logs) m`)).rows[0];
const r1b = await publishRows(lg, 'Proof League', snap3);
const after = (await db.query(`select
  (select count(*) from game.results) r, (select count(*) from game.players) p,
  (select count(*) from game.clubs) c, (select count(*) from game.match_logs) m`)).rows[0];
ok(JSON.stringify(before) === JSON.stringify(after) && r1b.results === 0,
  're-running the same round writes no new rows (the umpire retries safely)');

// ---- 4. the next round writes only what is new -----------------------------
const r2 = await publishRows(lg, 'Proof League', snap4);
const nRes = (await db.query(`select count(*)::int n from game.results`)).rows[0].n;
ok(r2.results > 0 && r2.results < r1.results && nRes === r1.results + r2.results,
  `round four added only its own ${r2.results} matches (table now ${nRes})`);

// ---- 5. a player who leaves stops being on the squad -----------------------
const club0 = (await db.query(`select id, name from game.clubs where league_id=$1 order by name limit 1`, [lg])).rows[0];
const gone = snap4.teams.find((t) => t.name === club0.name).players.pop();
const r3 = await publishRows(lg, 'Proof League', snap4);
ok((await db.query(`select count(*)::int n from game.players where club_id=$1 and name=$2`, [club0.id, gone.name])).rows[0].n === 0,
  `a released player (${gone.name}) is off the squad`);
ok(r3.players === r2.players - 1, `the squad is one smaller (${r3.players})`);

// ---- 6. no relational spine, no harm ---------------------------------------
missingSchema = 'game';
const r4 = await publishRows(lg, 'Proof League', snap4);
ok(r4 === null, 'with the game schema absent the write reports nothing and throws nothing');
missingSchema = null;

console.log(`\n${pass} checks passed`);
