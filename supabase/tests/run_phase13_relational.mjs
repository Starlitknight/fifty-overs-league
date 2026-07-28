// PHASE 1 proof — the relational spine tells the same story as the engine.
//
// Plays a real season in the real engine (headless), decomposes it into rows
// with resolver/rows.mjs, applies every migration to PGlite (real Postgres),
// inserts the rows, and demands that game.standings - the SQL view the new
// standings page will read - matches the engine's own leagueRows() exactly:
// same clubs in the same order, same P/W/L/T/points, net run rate to 1e-6.
//
//   cd supabase && NODE_PATH=/opt/node22/lib/node_modules node tests/run_phase13_relational.mjs
import { PGlite } from '@electric-sql/pglite';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { applyAllMigrations } from './_migrate.mjs';
import { resultRow, clubRows, playerRows } from '../../resolver/rows.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GAME = resolve(__dirname, '../../.build/page.html');

let pass = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) process.exitCode = 1; else pass++; };

// ---- 1. a real season --------------------------------------------------
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));
await page.goto('file://' + GAME, { waitUntil: 'load' });
const world = await page.evaluate(() => {
  econInit(); App.teamIx = 0; App.season = null; seasonInit(); App.round = 1; App.seasonNo = 1;
  App.cup = { stage: 0, alive: null, results: [], out: false }; App.results = [];
  try { mpInit(); } catch (e) {}
  for (let i = 0; i < 6; i++) completeRound();
  const slim = snapshot(false);
  return {
    teams: slim.teams.map((t) => ({ name: t.name, ground: t.ground, bank: t.bank, players: t.players })),
    results: slim.results,
    table: leagueRows('league').map((x) => ({ nm: x.nm, p: x.p, w: x.w, l: x.l, t: x.t, pts: x.pts, nrr: x.nrr })),
  };
});
await browser.close();
ok(world.results.length > 20, `engine played a season: ${world.results.length} results, ${world.teams.length} clubs`);

// ---- 2. rows into real Postgres ---------------------------------------
const db = new PGlite();
const files = await applyAllMigrations(db);
ok(files.includes('0024_relational_league.sql') && files.includes('0025_league_seasons.sql'),
  `migrations applied (${files.length}, incl. 0024 + 0025)`);

const lg = (await db.query(`insert into game.leagues (name) values ('Test League') returning id`)).rows[0].id;

for (const c of clubRows(lg, world.teams)) {
  const cid = (await db.query(
    `insert into game.clubs (league_id, name, ground, bank) values ($1,$2,$3,$4) returning id`,
    [c.league_id, c.name, c.ground, c.bank])).rows[0].id;
  const team = world.teams.find((t) => t.name === c.name);
  for (const p of playerRows(cid, team)) {
    await db.query(`insert into game.players (club_id, name, role, age, rating, attrs) values ($1,$2,$3,$4,$5,$6)`,
      [p.club_id, p.name, p.role, p.age, p.rating, JSON.stringify(p.attrs)]);
  }
}

const insertResult = (row) => db.query(
  `insert into game.results (league_id, comp, season_no, round, home, away, winner,
     home_runs, home_wkts, home_balls, away_runs, away_wkts, away_balls, summary, seed, scorecard)
   values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
  [row.league_id, row.comp, row.season_no, row.round, row.home, row.away, row.winner,
   row.home_runs, row.home_wkts, row.home_balls, row.away_runs, row.away_wkts, row.away_balls,
   row.summary, row.seed, JSON.stringify(row.scorecard)]);

let inserted = 0, skipped = 0;
const rows = [];
for (const r of world.results) {
  const row = resultRow(lg, r);
  if (!row) { skipped++; continue; }
  await insertResult(row);
  rows.push(row);
  inserted++;
}
ok(inserted === world.results.length && skipped === 0, `every result decomposed cleanly (${inserted} inserted, ${skipped} skipped)`);
ok(rows.every((r) => r.season_no === 1), 'every result carries the season it was played in');

const nPlayers = (await db.query(`select count(*)::int n from game.players`)).rows[0].n;
ok(nPlayers >= world.teams.length * 11, `players stored as rows (${nPlayers})`);

// ---- 3. the view must agree with the engine ----------------------------
const sql = (await db.query(
  `select club, p, w, l, t, pts, nrr from game.standings
    where league_id = $1 and season_no = 1
    order by pts desc, nrr desc, club`, [lg])).rows;

// the engine sorts pts then nrr; make club name the tiebreak on both sides so
// exact-equal rows cannot flip the comparison
const eng = world.table.slice().sort((a, b) => b.pts - a.pts || b.nrr - a.nrr || a.nm.localeCompare(b.nm));
const sqlSorted = sql.slice().sort((a, b) => b.pts - a.pts || b.nrr - a.nrr || a.club.localeCompare(b.club));

ok(sqlSorted.length === eng.length, `same number of clubs in the table (${sqlSorted.length})`);
let agree = true;
for (let i = 0; i < eng.length; i++) {
  const e = eng[i], s = sqlSorted[i];
  const rowOk = s && s.club === e.nm && s.p === e.p && s.w === e.w && s.l === e.l &&
    s.t === e.t && s.pts === e.pts && Math.abs(Number(s.nrr) - e.nrr) < 1e-6;
  if (!rowOk) {
    agree = false;
    console.log('  mismatch at', i, 'engine:', JSON.stringify(e), 'sql:', JSON.stringify(s));
  }
}
ok(agree, 'game.standings matches the engine leagueRows exactly (P/W/L/T/pts, nrr to 1e-6)');

// ---- 4. a new season starts from zero ----------------------------------
// Replay the same season's matches as season 2. Nothing about season 1's table
// may move, and season 2 must read exactly the same - which is only true if the
// view separates seasons rather than summing every result ever played.
for (const row of rows) await insertResult(Object.assign({}, row, { season_no: 2 }));
await db.query(`update game.leagues set season_no = 2 where id = $1`, [lg]);

const again = (await db.query(
  `select club, p, w, l, t, pts, nrr from game.standings
    where league_id = $1 and season_no = 1 order by pts desc, nrr desc, club`, [lg])).rows;
ok(JSON.stringify(again) === JSON.stringify(sql), "season 1's table is untouched by season 2's results");

const s2 = (await db.query(
  `select club, p, w, l, t, pts from game.standings
    where league_id = $1 and season_no = 2 order by pts desc, nrr desc, club`, [lg])).rows;
ok(s2.length === sql.length && s2.every((r, i) => r.p === sql[i].p && r.pts === sql[i].pts),
  `season 2 has its own table of ${s2.length} clubs`);

// ---- 5. what a standings page would actually transfer ------------------
const bytes = JSON.stringify(sql).length;
ok(bytes < 4096, `the standings payload is ${bytes} bytes (the snapshot was ~900,000)`);

console.log(`\n${pass} checks passed`);
