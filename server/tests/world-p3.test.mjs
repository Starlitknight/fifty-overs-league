// tests/world-p3.test.mjs — P3/P4/P5 proof obligations on a real Postgres.
//   P3: the write surface self-authorizes (boss unclaimable, one club per
//       manager, double-claim rejected) and a claimant's orders genuinely
//       steer the engine (their chosen opener opens).
//   P4: after a full 18-round planet season, the cup window plays the
//       Champions Cup of clubs on the real engine - play-ins through final,
//       idempotently - and crowns a champion in the snapshot.
//   P5: national squads assemble from real club players and the World Cup
//       of nations plays to a champion the same way.
//   Seasons roll: season 2 begins at start_day + 30 in every nation.
// The 18-round planet season is ~1,700 real engine matches; this file runs
// in minutes, not seconds, and that is the point - it is the whole world.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld, countryConfigs, squadFor } from '../init-world.mjs';
import { makeHost } from '../enginehost.mjs';
import { runAllDue, runCupWindow, runFaCup, rollSeasons, runTick, computeLeague, rebuildHonours, computeRankings, runFriendlies, settleMoney } from '../tick.mjs';
import { evolveCountry, applyLiving, livingPatch } from '../living.mjs';
import { SQUAD_CAP, RETIRE_AT, ACADEMY_FLOOR, makeRecruit, ageYouth,
  coltsRoundOf, coltsSquad, playColtsRound, coltRecords } from '../youth.mjs';
import { academyRate } from '../living.mjs';
import { fantasyPoints, unitRatings, matchRatings, teamRatings, matchRating,
         ladderRating, strengthRating, RATING_UNITS, RANK_BASE } from '../ratings.mjs';
import { roundRobin, bracket, roundsOf, closeEnrolment, playComps, computeComp, rebuildComps } from '../comps.mjs';
import { academyUpkeep, academyBuild, TICKET, HOME_CUT, MAX_SEATS, MOOD_WORD, DEBT_LIMIT, weatherOf, moodOf, stadiumCost, seatBlockPrice, computeFinance } from '../economy.mjs';
import { EPOCH, DAY, seedOf, dayOfRound } from '../clock.mjs';

const DBNAME = 'foworld_p3_test';
let pool, host;
const T0 = EPOCH + 100 * DAY + 12 * 3600000;               // day 100; season 1 starts day 101
const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';

async function as(user, sql, params) {
  const c = await pool.connect();
  try {
    await c.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: user })]);
    return await c.query(sql, params);
  } finally {
    await c.query(`SELECT set_config('request.jwt.claims', '', false)`).catch(() => {});
    c.release();
  }
}

before(async () => {
  try { execSync('dropdb --if-exists ' + DBNAME); } catch {}
  execSync('createdb ' + DBNAME);
  process.env.PGDATABASE = DBNAME;
  pool = makePool();
  await migrate(pool);
  host = makeHost();
  const r = await initWorld(pool, { now: T0, host });
  assert.equal(r.created, true);
});
after(async () => { await pool.end(); });

test('P3: the founding seats are the only doors, one club per manager', async () => {
  // the boss and the established counties are simply not for sale
  await assert.rejects(as(U1, `SELECT public.world_claim_club('eng', 0, 'Usurper')`), /not for sale/);
  await assert.rejects(as(U1, `SELECT public.world_claim_club('eng', 1, 'Usurper')`), /not for sale/);
  const ok = await as(U1, `SELECT public.world_claim_club('eng', 9, 'Santosh') AS r`);
  assert.equal(ok.rows[0].r.ok, true);
  assert.equal(ok.rows[0].r.club, 'Somerset');
  await assert.rejects(as(U1, `SELECT public.world_claim_club('ire', 10, 'Santosh')`), /already manage/);
  await assert.rejects(as(U2, `SELECT public.world_claim_club('eng', 9, 'Rival')`), /already has a manager/);
  await assert.rejects(pool.query(`SELECT public.world_claim_club('eng', 10, 'Nobody')`), /sign in/);
  // ...and then the harness re-seats Santosh at Yorkshire DIRECTLY: the rest
  // of this file exercises a managed FIRST-DIVISION club (orders, cover
  // sheets, training, the market) and those laws hold wherever a manager
  // sits - the doors themselves are proved above and in world-conditions.
  await pool.query(`DELETE FROM claims WHERE user_id=$1`, [U1]);
  await pool.query(
    `INSERT INTO claims(user_id, display_name, country_id, slot) VALUES ($1,'Santosh','eng',1)`, [U1]);
  const st = await as(U1, `SELECT public.world_my_status() AS s`);
  assert.equal(st.rows[0].s.claim.club, 'Yorkshire');
  assert.equal(Array.isArray(st.rows[0].s.squad), true);
});

test("P3: a claimant's orders genuinely steer the engine", async () => {
  // orders: an XI opening with the squad's LAST-rated batter - unmistakable
  const squad = (await pool.query(`SELECT squad FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].squad;
  const names = squad.map(p => p.name);
  const xi = names.slice(-11).reverse();               // deliberately unusual XI + order
  const sub = await as(U1, `SELECT public.world_submit_orders(1, $1::jsonb) AS r`,
    [JSON.stringify({ xi, bat: xi })]);
  assert.equal(sub.rows[0].r.ok, true);
  assert.equal(sub.rows[0].r.round, 1);

  const day1 = 101;
  const afterEng = EPOCH + day1 * DAY + 18 * 3600000;
  const res = await runTick(pool, host, 'eng', day1, { now: afterEng });
  assert.equal(res.played, 8);
  const m = (await pool.query(
    `SELECT orders, result FROM matches WHERE country_id='eng' AND season_no=1 AND round=1 AND (home_slot=1 OR away_slot=1)`)).rows[0];
  assert.ok(m.orders.Yorkshire, 'the submitted orders were attached to the match');
  const inn = m.result.innings.find(i => i.batTeam === 'Yorkshire');
  assert.ok(inn, 'Yorkshire batted');
  const openers = inn.bat.slice(0, 2).map(b => (b.p && b.p.name) || b.p);
  assert.ok(openers.includes(xi[0]), 'the chosen opener opened: ' + openers.join(', ') + ' vs ' + xi[0]);
});

test('P4+P5: a full planet season, then the cup window crowns two champions', async () => {
  // settle the fourteen rounds AND FINALS NIGHT everywhere (round 1 for eng
  // already played above): the playoff final settles on day-in-season 32, so
  // 02:00 on day +33 is past every nation's window - and still short of the
  // FA Cup final on day-in-season 34.
  const allDone = EPOCH + (101 + 33) * DAY + 2 * 3600000;
  await runAllDue(pool, host, { now: allDone });
  const n = await pool.query('SELECT count(*)::int AS n FROM matches');
  assert.equal(n.rows[0].n, 16 * 118,
    'the whole season: 16 nations x (112 league + 6 playoff) matches');

  // every division crowned a champion ON FINALS NIGHT, and the honours read
  // the playoffs, not just the table
  const engBoard = await computeLeague(pool, 'eng', 1, allDone);
  assert.ok(engBoard.champion, 'Division One crowned: ' + engBoard.champion);
  assert.ok(engBoard.champion2, 'Division Two crowned: ' + engBoard.champion2);
  assert.ok(engBoard.shield && engBoard.shield2, 'and both shields are on the board');

  // THE FA CUP has played three of its four Sundays by now (the final's own
  // Sunday evening has not struck at 02:00) - fourteen ties a nation banked
  await runFaCup(pool, host, { now: allDone });
  const fa0 = await pool.query(`SELECT count(*)::int AS n FROM cup_matches WHERE comp LIKE 'fa:%'`);
  assert.equal(fa0.rows[0].n, 16 * 14, 'R16, quarters and semis are banked everywhere');

  // before any Champions Cup stage window has closed: nothing plays
  const early = await runCupWindow(pool, host, { now: allDone });
  assert.equal((early.s1.wcl || []).filter(x => !x.skipped).length, 0, 'no cup stage before its window closes');

  // after the final's window (start_day+41 at 21:00): everything settles in one call
  const cupDone = EPOCH + (101 + 42) * DAY + 1 * 3600000;
  const cups = await runCupWindow(pool, host, { now: cupDone });
  const wcl = cups.s1.wcl.filter(x => !x.skipped);
  assert.deepEqual(wcl.map(x => x.stage), ['g1', 'g2', 'g3', 'qf', 'sf', 'final']);
  // NO WORLD CUP in season 1: it comes round every fourth year
  assert.equal((cups.s1.wc || []).length, 0, 'the World Cup waits for season 4');
  const cm = await pool.query(`SELECT count(*)::int AS n FROM cup_matches WHERE comp='wcl'`);
  assert.equal(cm.rows[0].n, 31, 'four groups of four then the knockout: 24+4+2+1');

  const cup = (await pool.query(`SELECT body FROM snapshots WHERE key='cup/s1'`)).rows[0].body;
  assert.ok(cup.champion, 'the Champions Cup has a champion: ' + cup.champion);
  assert.equal(cup.stages.final.length, 1);

  // ...and by the closing week the FA CUP FINAL has been played at the
  // boss's ground in every nation: fifteen ties each, a winner in the book
  await runFaCup(pool, host, { now: cupDone });
  const fa = await pool.query(`SELECT count(*)::int AS n FROM cup_matches WHERE comp LIKE 'fa:%'`);
  assert.equal(fa.rows[0].n, 16 * 15, 'every nation ran its whole knockout');
  const faEng = (await pool.query(`SELECT body FROM snapshots WHERE key='facup/eng/s1'`)).rows[0].body;
  assert.ok(faEng.champion, 'England has an FA Cup winner: ' + faEng.champion);

  // P5: national squads are real club players
  const nats = (await pool.query(`SELECT body FROM snapshots WHERE key='nats/s1'`)).rows[0].body;
  assert.equal(Object.keys(nats).length, 16);
  assert.equal(nats.eng.squad.length, 15);
  const engPlayers = new Set((await pool.query(`SELECT jsonb_array_elements(squad)->>'name' AS n FROM clubs WHERE country_id='eng'`)).rows.map(r => r.n));
  nats.eng.squad.forEach(nm => assert.ok(engPlayers.has(nm), nm + ' plays in the England league'));

  // idempotency at cup scale
  const again = await runCupWindow(pool, host, { now: cupDone });
  assert.ok(again.s1.wcl.every(x => x.skipped), 'cup re-run is a no-op');
  const cm2 = await pool.query(`SELECT count(*)::int AS n FROM cup_matches WHERE comp='wcl'`);
  assert.equal(cm2.rows[0].n, 31);

  // the honours book remembers season 1 forever
  const H = await rebuildHonours(pool);
  assert.equal(Object.keys(H.seasons.s1.league).length, 16, 'sixteen league champions in the book');
  assert.ok(H.seasons.s1.championsCup, 'the Champions Cup winner is in the book');
});

test('seasons roll at the turning of the year, and the pyramid breathes', async () => {
  const beforeRoll = await rollSeasons(pool, { now: EPOCH + (101 + 37) * DAY });
  assert.equal(beforeRoll.length, 0, 'no rollover before the transition day');
  const rolled = await rollSeasons(pool, { now: EPOCH + (101 + 39) * DAY + 2 * 3600000 });
  assert.equal(rolled.length, 16);
  const s2 = await pool.query('SELECT count(*)::int AS n, min(start_day) AS d FROM seasons WHERE season_no=2');
  assert.equal(s2.rows[0].n, 16);
  assert.equal(s2.rows[0].d, 101 + 42, 'season 2 opens six weeks after season 1');
  // PROMOTION AND RELEGATION happened: season 2's divisions differ from the
  // founding map by exactly two clubs each way, in every nation
  const rows = (await pool.query(`SELECT country_id, divisions FROM seasons WHERE season_no=2 ORDER BY country_id`)).rows;
  for (const r of rows) {
    const d1 = r.divisions['1'], d2 = r.divisions['2'];
    assert.equal(d1.length, 8); assert.equal(d2.length, 8);
    assert.ok(d1.includes(0), 'the boss did not go down in ' + r.country_id);
    const promoted = d1.filter(x => x >= 8), relegated = d2.filter(x => x < 8);
    assert.equal(promoted.length, 2, r.country_id + ' promoted two: ' + promoted.join(','));
    assert.equal(relegated.length, 2, r.country_id + ' relegated two: ' + relegated.join(','));
  }
  const again = await rollSeasons(pool, { now: EPOCH + (101 + 39) * DAY + 2 * 3600000 });
  assert.equal(again.length, 0, 'season 2 already current: nothing further rolls');
  const s2b = await pool.query('SELECT count(*)::int AS n FROM seasons WHERE season_no=2');
  assert.equal(s2b.rows[0].n, 16);
});

test('005: orders lock at the first ball and reveal to spectators', async () => {
  // the latest England season, whatever tests ran before us
  const s = (await pool.query(`SELECT * FROM seasons WHERE country_id='eng' ORDER BY season_no DESC LIMIT 1`)).rows[0];
  const hour = (await pool.query(`SELECT play_hour_utc FROM countries WHERE id='eng'`)).rows[0].play_hour_utc;
  const TEST_ROUND = 9;   // untouched by the season tests either way
  // the day a round is bowled is the calendar's to give: three rounds then a
  // rest day, so round 9 is day-in-season 10, not 8
  const playMs = EPOCH + (s.start_day + dayOfRound(TEST_ROUND)) * DAY + hour * 3600000;

  async function inTxn(nowMs, user, fn) {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      if (user) await c.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: user })]);
      await c.query(`SELECT set_config('world.now_ms', $1, true)`, [String(nowMs)]);
      const r = await fn(c);
      await c.query('COMMIT');
      return r;
    } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
  }

  // more than an hour out: orders go on file, but nobody can read them
  const ok = await inTxn(playMs - 2 * 3600000, U1, c =>
    c.query(`SELECT public.world_submit_orders($1, '{"tossDecision":"bat","captain":"Test Captain"}'::jsonb) AS r`, [TEST_ROUND]));
  assert.equal(ok.rows[0].r.ok, true);
  await assert.rejects(
    inTxn(playMs - 2 * 3600000, null, c => c.query(`SELECT public.world_round_orders('eng', $1)`, [TEST_ROUND])),
    /sealed until an hour before the first ball/);

  // inside the final hour: submissions bounce, the teamsheet is public
  await assert.rejects(
    inTxn(playMs - 30 * 60000, U1, c => c.query(`SELECT public.world_submit_orders($1, '{"tossDecision":"bowl"}'::jsonb) AS r`, [TEST_ROUND])),
    /orders lock an hour before the first ball/);
  const rev = await inTxn(playMs - 30 * 60000, null, c =>
    c.query(`SELECT public.world_round_orders('eng', $1) AS r`, [TEST_ROUND]));
  const body = rev.rows[0].r;
  assert.equal(body.round, TEST_ROUND);
  assert.ok(body.orders.Yorkshire, 'the claimed club\'s sheet is revealed by club name');
  assert.equal(body.orders.Yorkshire.tossDecision, 'bat', 'the locked orders, not the bounced update');
});

test('007: humans christen their clubs, bots keep the counties, records survive renames', async () => {
  // U2 founds at Durham (eng slot 8, a Division Two seat) and names it
  const ok = await as(U2, `SELECT public.world_claim_club('eng', 8, 'Rival', 'Orange Club') AS r`);
  assert.equal(ok.rows[0].r.club, 'Orange Club');
  const names = (await pool.query(`SELECT slot, name, default_name FROM clubs WHERE country_id='eng' ORDER BY slot`)).rows;
  assert.equal(names.find(n => n.slot === 8).name, 'Orange Club');
  assert.equal(names.find(n => n.slot === 8).default_name, 'Durham');
  assert.equal(names.find(n => n.slot === 3).name, 'Surrey', 'bots keep the counties');
  // taken names bounce, case-insensitively, defaults included
  await assert.rejects(as(U2, `SELECT public.world_rename_club('surrey')`), /already taken/);
  await assert.rejects(as(U2, `SELECT public.world_rename_club('middlesex')`), /already taken/);
  // the record survives any rename: per-slot standings identical before and after
  const before = await computeLeague(pool, 'eng', 1, EPOCH + 165 * DAY);
  await as(U2, `SELECT public.world_rename_club('Tangerine CC')`);
  const after = await computeLeague(pool, 'eng', 1, EPOCH + 165 * DAY);
  const bySlotB = Object.fromEntries(before.table.concat(before.table2).map(t => [t.slot, t]));
  after.table.concat(after.table2).forEach(t => {
    assert.equal(t.p, bySlotB[t.slot].p, 'played, slot ' + t.slot);
    assert.equal(t.pts, bySlotB[t.slot].pts, 'points, slot ' + t.slot);
    assert.equal(t.w, bySlotB[t.slot].w, 'wins, slot ' + t.slot);
  });
  assert.equal(after.table2.find(t => t.slot === 8).name, 'Tangerine CC', 'the snapshot speaks the current name');
  // releasing the club hands Durham its name back
  await as(U2, `SELECT public.world_release_club()`);
  assert.equal((await pool.query(`SELECT name FROM clubs WHERE country_id='eng' AND slot=8`)).rows[0].name, 'Durham');
});

test('008: signing up auto-claims the first free club; a full country says so', async () => {
  // U2 (released earlier) lands automatically in the first free slot, christened
  const r1 = await as(U2, `SELECT public.world_auto_claim('eng', 'R2', 'Orange Club') AS r`);
  assert.equal(r1.rows[0].r.ok, true);
  assert.equal(r1.rows[0].r.slot, 8, 'the first free FOUNDING seat - Division Two');
  assert.equal(r1.rows[0].r.club, 'Orange Club');
  // calling again (any country) hands back the same seat - idempotent
  const r2 = await as(U2, `SELECT public.world_auto_claim('ire', 'R2', 'Second Club') AS r`);
  assert.equal(r2.rows[0].r.existing, true);
  assert.equal(r2.rows[0].r.slot, 8);
  // seven more sign-ups fill England's founding seats; a clashing name never
  // blocks the seat
  for (let i = 9; i <= 15; i++) {
    const uu = '33333333-3333-4333-8333-3333333333' + String(i).padStart(2, '0');
    const rr = await as(uu, `SELECT public.world_auto_claim('eng', 'M${i}', 'Orange Club') AS r`);
    assert.equal(rr.rows[0].r.ok, true);
    assert.equal(rr.rows[0].r.slot, i);
    assert.notEqual(rr.rows[0].r.club, 'Orange Club', 'a taken name falls back to the county');
  }
  // the ninth manager is told the country is full...
  await assert.rejects(
    as('44444444-4444-4444-8444-444444444444', `SELECT public.world_auto_claim('eng', 'Late', 'Latecomer CC')`),
    /full - every founding seat already has a manager/);
  // ...and can settle anywhere else
  const el = await as('44444444-4444-4444-8444-444444444444', `SELECT public.world_auto_claim('ire', 'Late', 'Latecomer CC') AS r`);
  assert.equal(el.rows[0].r.ok, true);
  assert.equal(el.rows[0].r.club, 'Latecomer CC');
});

test('009: season leaders come straight from the banked scorecards', async () => {
  const lg = await computeLeague(pool, 'eng', 1, EPOCH + 102 * DAY);
  assert.ok(lg.stats.bat.length >= 3, 'batting leaders exist after round 1');
  assert.ok(lg.stats.bat[0].runs >= lg.stats.bat[1].runs, 'sorted by runs');
  assert.ok(lg.stats.bowl.length >= 3, 'bowling leaders exist');
  assert.ok(lg.stats.bowl[0].wkts >= lg.stats.bowl[1].wkts, 'sorted by wickets');
  const clubNames = new Set((await pool.query(`SELECT name FROM clubs WHERE country_id='eng'`)).rows.map(r => r.name));
  lg.stats.bat.concat(lg.stats.bowl).forEach(x => assert.ok(clubNames.has(x.club), x.club + ' is a real club'));
  // THE CROWN IS WON ON FINALS NIGHT: this run has played the whole season,
  // so both divisions carry champions, each from its own top four (only a
  // finals-night qualifier can win), and the shields are the table-toppers.
  assert.ok(lg.champion, 'Division One is crowned');
  assert.ok(lg.table.slice(0, 4).some(t => t.name === lg.champion), 'by one of the top four');
  assert.ok(lg.champion2 && lg.table2.slice(0, 4).some(t => t.name === lg.champion2), 'Division Two likewise');
  assert.equal(lg.shield, lg.table[0].name, 'the shield belongs to the table');
  const H = await rebuildHonours(pool);
  const anyComplete = (await pool.query(
    `SELECT 1 FROM matches GROUP BY country_id, season_no HAVING count(*) >= 90 LIMIT 1`)).rowCount;
  if (!anyComplete) assert.deepEqual(H.seasons, {}, 'the honours book stays empty until a season completes');
  else assert.ok(H.seasons.s1 && Object.keys(H.seasons.s1.league).length,
    'a completed season is written into the book');
});

test('010: the world rankings ladder stands on the last three match ratings', async () => {
  const rk = await computeRankings(pool, EPOCH + 102 * DAY);
  assert.equal(rk.clubs.length, 256, 'every club in the world is ranked');
  assert.equal(rk.countries.length, 16, 'every country is ranked');
  assert.equal(rk.window, 3, 'the window is three matches');
  // every club that has played is on the ladder; when only England's round 1
  // is banked that is exactly its ten, and this run says so
  const played = rk.clubs.filter(c => c.p > 0);
  assert.ok(played.length >= 10, 'the clubs that have played are ranked: ' + played.length);
  if (played.length === 16) played.forEach(c => assert.equal(c.country, 'eng', 'only England has played'));
  // a club that has not played is presumed ordinary, and says so with an empty form
  const idle = rk.clubs.filter(c => c.p === 0);
  idle.forEach(c => {
    assert.equal(c.rating, RANK_BASE, c.name + ' has played nothing and stands on the middle of the scale');
    assert.deepEqual(c.form, [], c.name + ' has no marks behind it');
  });
  // the figure is exactly the mean of the marks behind it once the unplayed ones
  // are counted as ordinary. NOTE what is deliberately NOT asserted: that a
  // winner outranks a loser. The game's match rating marks how a side PLAYED,
  // not whether it won, so a side can be beaten and still have had the better
  // day - which is the point of ranking on it.
  played.forEach(c => {
    assert.ok(c.form.length && c.form.length <= 3, c.name + ' carries up to three marks');
    const want = +((c.form.reduce((s, x) => s + x, 0) + (3 - c.form.length) * RANK_BASE) / 3).toFixed(1);
    assert.equal(c.rating, want, c.name + ' stands on the mean of its last three');
  });
  // every mark is on the club rating scale, and every match a club played is
  // accounted for in its won-lost-tied
  played.forEach(c => {
    assert.equal(c.w + c.l + c.t, c.p, c.name + ' has an outcome for every match');
    c.form.forEach(v => assert.ok(v >= 350 && v <= 6790, c.name + ' mark on the club scale: ' + v));
  });
  // ranks are 1..190 and sorted by rating
  assert.equal(rk.clubs[0].rank, 1);
  assert.ok(rk.clubs[0].rating >= rk.clubs[189].rating);
  assert.ok(rk.clubs[0].rating > rk.clubs[189].rating, 'the ladder has actually separated');
  // ONLY THE LAST THREE COUNT: the ladder is a form table, so a club is judged
  // on what it has just done and not on everything it ever did
  const busiest = rk.clubs.slice().sort((a, b) => b.p - a.p)[0];
  if (busiest.p > 3) assert.equal(busiest.form.length, 3, 'a long record is still read three matches deep');
  // REBUILT FROM GENESIS, TWICE, THE SAME: nothing about the ladder is stored
  const again = await computeRankings(pool, EPOCH + 102 * DAY);
  assert.deepEqual(again.clubs, rk.clubs, 'the same record gives the same ladder');
  // histories key by slot: a rename moves the name, never the marks
  const before7 = rk.clubs.find(c => c.country === 'eng' && c.slot === 7);
  await pool.query(`UPDATE clubs SET name='Renamed CC' WHERE country_id='eng' AND slot=7`);
  const rk2 = await computeRankings(pool, EPOCH + 102 * DAY);
  const after7 = rk2.clubs.find(c => c.country === 'eng' && c.slot === 7);
  assert.equal(after7.rating, before7.rating, 'the rating survived the rename');
  assert.equal(after7.name, 'Renamed CC', 'the ladder speaks the current name');
  await pool.query(`UPDATE clubs SET name=$1 WHERE country_id='eng' AND slot=7`, [before7.name]);
});

// 010b: THE MATCH RATING ITSELF - the figure the ladder is built from, and the
// one the game has always printed on its Match ratings tab. The important claim
// here is not the arithmetic: it is that the server's port and the SHIPPED
// CLIENT give the same answer, so the ladder and the scorecard can never tell a
// manager two different stories.
test('010b: the umpire and the phone mark a match the same way', async () => {
  const rows = (await pool.query(
    `SELECT home_name, away_name, result FROM matches WHERE country_id='eng' ORDER BY season_no, round LIMIT 5`)).rows;
  assert.ok(rows.length, 'there are cards to mark');

  for (const m of rows) {
    // ONE MARKING, TWO HOSTS, on real innings
    for (const nm of [m.home_name, m.away_name]) {
      assert.deepEqual(teamRatings(m.result, nm), host.teamRatings(m.result, nm),
        'the umpire and the phone mark ' + nm + ' identically');
    }
    const tr = matchRating(m.result);
    const names = Object.keys(tr);
    assert.equal(names.length, 2, 'both sides are marked');
    names.forEach(nm => {
      const x = tr[nm];
      // scale(v) = 70 x clamp(5..97, v), so every unit lands in 350..6790 and so
      // does their mean
      assert.ok(x.rating >= 350 && x.rating <= 6790, nm + ' is on the club rating scale: ' + x.rating);
      assert.ok(x.counted.length >= 1 && x.counted.length <= 6, nm + ' counted ' + x.counted.length + ' units');
      x.counted.forEach(u => assert.ok(RATING_UNITS.indexOf(u) >= 0, u + ' is one of the six units'));
    });
    // LIKE WITH LIKE: both sides are averaged over the SAME units, which is what
    // makes the two figures comparable at all
    assert.deepEqual(tr[names[0]].counted, tr[names[1]].counted, 'both sides counted the same units');
    // and the figure really is the mean of those units
    names.forEach(nm => {
      const x = tr[nm];
      const want = +(x.counted.reduce((s, u) => s + x.units[u], 0) / x.counted.length).toFixed(1);
      assert.equal(x.rating, want, nm + ' is the mean of the counted units');
    });
  }

  // NO HANDS UNTIL YOU HAVE FIELDED: the side batting second in a card that ended
  // in the chase never took the field, so it carries no fielding mark
  const chase = rows.map(m => m.result).find(r => r.innings[1] && r.innings[1].batTeam);
  if (chase) {
    const second = chase.innings[1].batTeam;
    const fielded = chase.innings.some(inn => inn && inn.bowlTeam === second && (inn.legal || 0) > 0);
    if (!fielded) assert.equal(teamRatings(chase, second)['Fielding/Keeping'], null,
      'a side that never fielded has no hands to mark');
  }

  // A BETTER DAY MARKS HIGHER. Two hand-built cards, same shape, one side
  // batting and bowling well and the other badly.
  const card = (aRuns, aBalls, bWkts, bRuns, bBalls) => ({
    winner: 'A', text: 'A win',
    innings: [
      { batTeam: 'A', bowlTeam: 'B', runs: aRuns, wkts: 6, legal: aBalls,
        bat: [{ p: { name: 'a1' }, r: Math.round(aRuns * 0.4), b: Math.round(aBalls * 0.3) },
              { p: { name: 'a2' }, r: Math.round(aRuns * 0.3), b: Math.round(aBalls * 0.3) },
              { p: { name: 'a3' }, r: Math.round(aRuns * 0.2), b: Math.round(aBalls * 0.25) },
              { p: { name: 'a4' }, r: Math.round(aRuns * 0.1), b: Math.round(aBalls * 0.15) }],
        bowlers: { b1: { w: 3, r: 45, b: 60, p: { bowlType: 'fast' } },
                   s1: { w: 3, r: 40, b: 60, p: { bowlType: 'offbreak' } } },
        fielding: { b1: { ct: 2 } } },
      { batTeam: 'B', bowlTeam: 'A', runs: 150, wkts: 10, legal: 240,
        bat: [{ p: { name: 'b1' }, r: 60, b: 70 }, { p: { name: 'b2' }, r: 40, b: 60 },
              { p: { name: 'b3' }, r: 30, b: 60 }, { p: { name: 'b4' }, r: 20, b: 50 }],
        bowlers: { a1: { w: bWkts, r: bRuns, b: bBalls, p: { bowlType: 'fast' } },
                   a2: { w: bWkts, r: bRuns, b: bBalls, p: { bowlType: 'legbreak' } } },
        fielding: { a1: { ct: 3 } } }
    ]
  });
  const good = matchRating(card(320, 300, 5, 60, 120));
  const poor = matchRating(card(140, 300, 1, 110, 120));
  assert.ok(good.A.rating > poor.A.rating,
    'runs and wickets mark above neither (' + good.A.rating + ' v ' + poor.A.rating + ')');

  // THE WINDOW: three marks, and the unplayed ones are the middle of the scale
  assert.equal(ladderRating([]), RANK_BASE);
  assert.equal(ladderRating([4400]), +((4400 + 2 * RANK_BASE) / 3).toFixed(1));
  assert.equal(ladderRating([1000, 2000, 3000, 4500, 3000, 3000]), 3500, 'only the last three are read');
  // AND THE OTHER LENS: strength reads everything, and nothing is still ordinary
  assert.equal(strengthRating([]), RANK_BASE);
  assert.equal(strengthRating([3000, 4000]), 3500, 'strength reads the whole record');
  assert.notEqual(strengthRating([1000, 2000, 3000, 4500, 3000, 3000]),
                  ladderRating([1000, 2000, 3000, 4500, 3000, 3000]),
                  'form and strength are different questions');
});

test('011: friendlies - challenge, accept, and the umpire plays the real match', async () => {
  const PLAY = Date.now() + 3 * 3600000;
  // the league record as it stands BEFORE a ball of friendly cricket is bowled
  const lgBefore = await computeLeague(pool, 'eng', 1, EPOCH + 102 * DAY);
  // your own club is not an opponent, and lineups need their window
  await assert.rejects(as(U1, `SELECT public.world_friendly_challenge('eng', 1, $1)`, [PLAY]), /your own club/);
  await assert.rejects(as(U1, `SELECT public.world_friendly_challenge('ire', 3, $1)`, [Date.now() + 30 * 60000]), /90 minutes/);
  // a bot club accepts on the spot, at the challenger's chosen time
  const bot = await as(U1, `SELECT public.world_friendly_challenge('ire', 3, $1) AS r`, [PLAY]);
  assert.equal(bot.rows[0].r.status, 'accepted');
  assert.equal(bot.rows[0].r.playAtMs, PLAY, 'plays at the chosen time');
  assert.equal(bot.rows[0].r.humanOpponent, false);
  // a human must answer for themselves: U2's founded club, eng slot 8
  const hum = await as(U1, `SELECT public.world_friendly_challenge('eng', 8, $1) AS r`, [PLAY]);
  assert.equal(hum.rows[0].r.status, 'offered');
  assert.equal(hum.rows[0].r.humanOpponent, true);
  await assert.rejects(as(U1, `SELECT public.world_friendly_respond($1, true)`, [hum.rows[0].r.id]), /not yours to answer/);
  const acc = await as(U2, `SELECT public.world_friendly_respond($1, true) AS r`, [hum.rows[0].r.id]);
  assert.equal(acc.rows[0].r.status, 'accepted');
  await assert.rejects(as(U2, `SELECT public.world_friendly_respond($1, true)`, [hum.rows[0].r.id]), /already accepted/);
  // the umpire plays both when their hour strikes - real engine, real result
  const played = await runFriendlies(pool, host, { now: PLAY + 1 });
  assert.equal(played.length, 2, 'both friendlies played');
  const fr = (await pool.query(`SELECT * FROM friendlies WHERE status='played' ORDER BY id`)).rows;
  assert.equal(fr.length, 2);
  fr.forEach(f => {
    assert.ok(f.result.text, 'a real result: ' + f.result.text);
    assert.ok([f.c_name, f.o_name, null].includes(f.result.winner));
  });
  // the challenger's latest orders rode into the friendly (reversed-XI opener)
  const latest = (await pool.query(
    `SELECT orders FROM orders WHERE user_id=$1 ORDER BY submitted_at DESC LIMIT 1`, [U1])).rows[0].orders;
  const yInn = fr[0].result.innings.find(i => i.batTeam === fr[0].c_name);
  if (yInn && latest.xi) {
    const openers = yInn.bat.slice(0, 2).map(b => (b.p && b.p.name) || b.p);
    assert.ok(openers.includes(latest.xi[0]), 'the manager\'s chosen opener opened the friendly');
  }
  // declines are final; the ledger shows everything
  const again = await as(U1, `SELECT public.world_friendly_challenge('eng', 8, $1) AS r`, [Date.now() + 4 * 3600000]);
  const dec = await as(U2, `SELECT public.world_friendly_respond($1, false) AS r`, [again.rows[0].r.id]);
  assert.equal(dec.rows[0].r.status, 'declined');
  const mine = await as(U1, `SELECT public.world_my_friendlies() AS f`);
  const list = mine.rows[0].f;
  assert.ok(list.length >= 3);
  assert.ok(list.some(x => x.status === 'played' && x.text), 'played friendlies carry their result');
  assert.ok(list.some(x => x.status === 'declined'), 'the declined one is on record');
  // the post carries both clubs' coordinates and can be asked for one pair -
  // a club's own dossier reads only the friendlies it is itself involved in
  assert.ok(list.every(x => x.cCountry && x.oCountry && x.cSlot != null && x.oSlot != null),
    'every friendly says which two clubs it is between');
  const vsU2 = (await as(U1, `SELECT public.world_my_friendlies('eng', 8) AS f`)).rows[0].f;
  assert.equal(vsU2.length, 2, 'both eng:8 ties, and nothing else');
  assert.ok(vsU2.every(x => (x.oCountry === 'eng' && x.oSlot === 8) || (x.cCountry === 'eng' && x.cSlot === 8)));
  const vsBot = (await as(U1, `SELECT public.world_my_friendlies('ire', 3) AS f`)).rows[0].f;
  assert.equal(vsBot.length, 1, 'the one tie against the Irish club');
  // friendlies never touch the league record - whatever it was, it still is
  const lgAfter = await computeLeague(pool, 'eng', 1, EPOCH + 102 * DAY);
  assert.equal(lgAfter.roundsPlayed, lgBefore.roundsPlayed, 'league untouched by friendlies');
  assert.equal(lgAfter.results.length, lgBefore.results.length, 'no friendly crept into the results');
  assert.deepEqual(lgAfter.table.map(t => [t.slot, t.p, t.pts]), lgBefore.table.map(t => [t.slot, t.p, t.pts]),
    'not a point, not a match, moved in the table');
});

test('012: friendly lineups - set, tweak, lock at T-1h; unanswered offers die at T-1h', async () => {
  async function pinned(nowMs, user, fn) {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      if (user) await c.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: user })]);
      await c.query(`SELECT set_config('world.now_ms', $1, true)`, [String(nowMs)]);
      const r = await fn(c);
      await c.query('COMMIT');
      return r;
    } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
  }
  const T = Date.now() + 4 * 3600000;
  const fr = await as(U1, `SELECT public.world_friendly_challenge('ire', 4, $1) AS r`, [T]);
  const fid = fr.rows[0].r.id;
  // a lineup just for this friendly: natural order, a different opener than league orders
  const squad = (await pool.query(`SELECT squad FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].squad;
  const xi2 = squad.map(p => p.name).slice(0, 11);
  const setO = await as(U1, `SELECT public.world_friendly_orders($1, $2::jsonb) AS r`, [fid, JSON.stringify({ xi: xi2, bat: xi2 })]);
  assert.equal(setO.rows[0].r.ok, true);
  // only the two managers may touch it
  await assert.rejects(as(U2, `SELECT public.world_friendly_orders($1, '{}'::jsonb)`, [fid]), /not yours/);
  // tweakable before the hour, locked inside it
  const okTweak = await pinned(T - 2 * 3600000, U1, c => c.query(`SELECT public.world_friendly_orders($1, $2::jsonb) AS r`, [fid, JSON.stringify({ xi: xi2, bat: xi2 })]));
  assert.equal(okTweak.rows[0].r.ok, true);
  await assert.rejects(
    pinned(T - 30 * 60000, U1, c => c.query(`SELECT public.world_friendly_orders($1, $2::jsonb)`, [fid, JSON.stringify({ xi: xi2 })])),
    /lock an hour before/);
  // the umpire plays it with the friendly lineup, not the league one
  const played = await runFriendlies(pool, host, { now: T + 1 });
  assert.ok(played.map(Number).includes(Number(fid)));
  const f = (await pool.query(`SELECT * FROM friendlies WHERE id=$1`, [fid])).rows[0];
  const inn = f.result.innings.find(i => i.batTeam === f.c_name);
  const openers = inn.bat.slice(0, 2).map(b => (b.p && b.p.name) || b.p);
  assert.ok(openers.includes(xi2[0]), 'the friendly-specific opener opened: ' + openers.join(', '));
  // an offer nobody answers dies an hour before the match and is never played
  const T2 = Date.now() + 2 * 3600000;
  const off = await as(U1, `SELECT public.world_friendly_challenge('eng', 9, $1) AS r`, [T2]);
  await runFriendlies(pool, host, { now: T2 - 30 * 60000 });
  const dead = (await pool.query(`SELECT status FROM friendlies WHERE id=$1`, [off.rows[0].r.id])).rows[0];
  assert.equal(dead.status, 'expired', 'unaccepted at T-1h: expired');
  const after = await runFriendlies(pool, host, { now: T2 + 3600000 });
  assert.ok(!after.map(Number).includes(Number(off.rows[0].r.id)), 'an expired offer is never played');
});

test('013: the friendly fixture card - sealed to the hour, then public for the theatre', async () => {
  async function pinned(nowMs, user, fn) {
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      if (user) await c.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: user })]);
      await c.query(`SELECT set_config('world.now_ms', $1, true)`, [String(nowMs)]);
      const r = await fn(c);
      await c.query('COMMIT');
      return r;
    } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
  }
  // a bot accepts on the spot; the card stays sealed until an hour out
  const T = Date.now() + 6 * 3600000;
  const fr = await as(U1, `SELECT public.world_friendly_challenge('ire', 5, $1) AS r`, [T]);
  const fid = fr.rows[0].r.id;
  await assert.rejects(
    pinned(T - 2 * 3600000, null, c => c.query(`SELECT public.world_friendly_detail($1)`, [fid])),
    /sealed until an hour before/);
  // the challenger seals a friendly-specific lineup
  const squad = (await pool.query(`SELECT squad FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].squad;
  const xi = squad.map(p => p.name).slice(0, 11);
  await as(U1, `SELECT public.world_friendly_orders($1, $2::jsonb)`, [fid, JSON.stringify({ xi: xi, bat: xi })]);
  // from T-1h anyone - no sign-in required - reads the card the theatre replays from
  const open = await pinned(T - 30 * 60000, null, c => c.query(`SELECT public.world_friendly_detail($1) AS d`, [fid]));
  const d = open.rows[0].d;
  assert.equal(Number(d.id), Number(fid));
  assert.equal(Number(d.playAtMs), T);
  assert.equal(d.home.country, 'eng');
  assert.equal(d.home.slot, 1);
  assert.equal(d.home.name, 'Yorkshire', 'the CURRENT club name keys the card');
  assert.equal(d.away.country, 'ire');
  assert.deepEqual(d.orders[d.home.name].xi, xi, 'the sealed friendly lineup rides under the club name');
  // with no bespoke sheet, the manager's latest league orders ride in - same as the umpire
  const T2 = Date.now() + 7 * 3600000;
  const fr2 = await as(U1, `SELECT public.world_friendly_challenge('ire', 6, $1) AS r`, [T2]);
  const latest = (await pool.query(
    `SELECT orders FROM orders WHERE user_id=$1 ORDER BY submitted_at DESC LIMIT 1`, [U1])).rows[0].orders;
  const open2 = await pinned(T2 - 10 * 60000, null, c => c.query(`SELECT public.world_friendly_detail($1) AS d`, [fr2.rows[0].r.id]));
  const d2 = open2.rows[0].d;
  assert.deepEqual(d2.orders[d2.home.name], latest, 'league orders are the fallback, exactly as played');
  // an unanswered offer has no card, and neither does a ghost
  const off = await as(U1, `SELECT public.world_friendly_challenge('eng', 8, $1) AS r`, [Date.now() + 6 * 3600000]);
  await assert.rejects(pool.query(`SELECT public.world_friendly_detail($1)`, [off.rows[0].r.id]), /this friendly is offered/);
  await assert.rejects(pool.query(`SELECT public.world_friendly_detail(999999)`), /no such friendly/);
});

test('014: the living player - careers, form, tired legs, all from the record', async () => {
  const sq = () => pool.query(`SELECT squad FROM clubs WHERE country_id='eng' AND slot=1`).then(r => r.rows[0].squad);
  const before = await sq();
  assert.ok(before.length >= 11);
  // rounds have been played above, so the men have lives by now
  await evolveCountry(pool, 'eng', EPOCH + 165 * DAY);
  const after = await sq();
  const capped = after.filter(p => p.career && p.career.m > 0);
  assert.ok(capped.length >= 11, 'at least an XI have caps: ' + capped.length);
  const scorer = capped.filter(p => p.career.runs > 0).sort((a, b) => b.career.runs - a.career.runs)[0];
  assert.ok(scorer, 'somebody has scored runs');
  assert.ok(scorer.career.hs > 0 && scorer.career.hs <= scorer.career.runs, 'a best score inside the total');
  const taker = capped.filter(p => p.career.wkts > 0)[0];
  assert.ok(taker && taker.career.bb, 'a wicket-taker carries best figures');
  // experience is earned, never lost, and the baseline is remembered
  const grew = after.filter(p => p.career && p.exp > p.baseExp);
  assert.ok(grew.length > 0, 'playing made somebody wiser');
  after.forEach(p => { assert.ok(p.exp <= 99 && p.exp >= 0, 'exp in range'); });
  // form and fatigue words agree with their numbers, and the whole squad
  // carries the fields the engine actually reads
  after.forEach(p => {
    assert.ok(p.formIx >= 0 && p.formIx <= 6, p.name + ' formIx');
    assert.ok(typeof p.fatWord === 'string' && p.fatigue === p.fatWord, p.name + ' fatigue word');
    assert.ok(p.fatN >= 0 && p.fatN <= 99, p.name + ' fatN');
  });
  // nobody is broken by a season of cricket: rotation is an edge, not a cliff
  assert.ok(after.every(p => p.fatN < 90), 'no one is shattered by league cricket');
  // and it NEVER DRIFTS: recomputing from the same record changes nothing
  await evolveCountry(pool, 'eng', EPOCH + 165 * DAY, host);
  const twice = await sq();
  assert.deepEqual(twice, after, 'evolution is a pure function of the record');
  // a life changes a man's form and his legs; only the nets change his craft,
  // and the nets only ever add - his generated baseline is never lost
  after.forEach(p => {
    assert.ok(p.baseSkills, p.name + ' remembers the cricketer he was made');
    for (const k in p.baseSkills) {
      assert.ok(p.skills[k] >= p.baseSkills[k], p.name + ' never got worse at ' + k);
    }
  });
});

test('015: watched IS recorded - the banked living patch replays the same match', async () => {
  // THE CURRENT ROUND, freshly banked - which is the round a broadcast ever
  // replays. An OLD round is history: newcomer levelling and academy
  // promotions move the clubs table on, and the spectator contract has never
  // been "any match ever" - the theatre fetches the living state per current
  // round and replays tonight's cricket. Season 1 was settled WHOLE by the
  // cup test above (and a claim landed after it banked, so its squads have
  // legitimately moved on) - the fresh cricket lives in the CURRENT season.
  // The test banks three rounds of it itself, guaranteeing the pick was
  // played by the squads the world serves NOW and that the men carried real
  // form and real legs into it, whatever earlier tests did to the calendar.
  const seas = (await pool.query(
    `SELECT season_no, start_day FROM seasons WHERE country_id='eng' ORDER BY season_no DESC LIMIT 1`)).rows[0];
  const maxRound = async () => Number((await pool.query(
    `SELECT coalesce(max(round),0) AS r FROM matches WHERE country_id='eng' AND season_no=$1`,
    [seas.season_no])).rows[0].r);
  const pre = await maxRound();
  let last = pre;
  for (let r = pre + 1; r <= 18 && last < pre + 3; r++) {
    const day = seas.start_day + dayOfRound(r);
    await runTick(pool, host, 'eng', day, { now: EPOCH + day * DAY + 18 * 3600000 });
    last = await maxRound();
  }
  assert.ok(last > pre, 'the current season had cricket left to bank');
  const m = (await pool.query(
    `SELECT id, seed, round, home_name, away_name, home_slot, away_slot, orders, living, result_canonical
       FROM matches WHERE country_id='eng' AND season_no=$1 AND round=$2 AND living IS NOT NULL
       ORDER BY home_slot LIMIT 1`, [seas.season_no, last])).rows[0];
  assert.ok(m, 'a banked match with its living patch');
  assert.ok(m.living[m.home_name] && m.living[m.away_name], 'both squads are in it');
  const anyMan = Object.values(m.living[m.home_name])[0];
  assert.ok(anyMan && anyMan.e != null && anyMan.f != null && anyMan.n != null, 'exp, form and legs');
  // by then the men were genuinely no longer their generated selves
  const moved = Object.values(m.living[m.home_name]).filter(L => L.f !== 3 || L.n > 0);
  assert.ok(moved.length > 0, 'the XI carried real form and real tiredness into it');

  // THE MATCH, not the paperwork: the canonical blob embeds whole player
  // objects, so its bytes carry harmless noise (a database reorders JSON
  // keys; a career rides along). What must agree is every ball of cricket.
  const facts = j => {
    const o = JSON.parse(j);
    return JSON.stringify({ w: o.winner, t: o.text, m: o.mom,
      i: (o.innings || []).map(inn => inn && ({ bt: inn.batTeam, r: inn.runs, w: inn.wkts, l: inn.legal,
        bat: (inn.bat || []).map(b => [(b.p && b.p.name) || b.p, b.r, b.b, b.out]),
        bowl: Object.entries(inn.bowlers || {}).map(([k, v]) => [k, v.w, v.r, v.b]).sort() })) });
  };

  // a spectator does exactly what the phone does: regenerate the squads from
  // the world seed, lay the banked patch over them, run the same seed
  // ...and it asks the ONE thing that says what squad a club has, rather than
  // re-deriving it here. A copy of that call in a test is a copy that goes stale
  // the day the world changes how it seats a club - which is precisely what it
  // did when clubs stopped sharing one archetype and one budget.
  // the squads the phone actually holds are the SERVED squads - the clubs
  // table as the world publishes it. (This used to regenerate them from the
  // world seed, which was the same thing until newcomer levelling: a claimed
  // club's squad is deliberately no longer its seat's deal, and the snapshot
  // a spectator reads reflects that.)
  const squadOf = async slot => (await pool.query(
    `SELECT squad FROM clubs WHERE country_id='eng' AND slot=$1`, [slot])).rows[0].squad;
  // ...and it replays THE MATCH AS PLAYED: the forecast pitch and sky from
  // the planet's one conditions table, and the banked sheets (bot doctrines
  // included) - exactly the inputs a phone's broadcast derives for itself
  const cond = host.condFor('eng', m.home_slot, seas.season_no, m.round);
  const replay = host.runMatch(
    { name: m.home_name, players: applyLiving(await squadOf(m.home_slot), m.living[m.home_name], host) },
    { name: m.away_name, players: applyLiving(await squadOf(m.away_slot), m.living[m.away_name], host) },
    cond.pitch, Number(m.seed), m.orders, cond.weather);
  assert.equal(facts(replay), facts(m.result_canonical), 'the broadcast is the match the world recorded');

  // and the patch is what makes it so: the pristine GENERATED squads, same
  // seed, same orders, play a DIFFERENT match
  const cfg2 = countryConfigs(host).filter(c => c.id === 'eng')[0];
  const pristine = slot => squadFor(host, cfg2, cfg2.clubs.filter(c => c.slot === slot)[0]);
  const naive = host.runMatch({ name: m.home_name, players: pristine(m.home_slot) },
    { name: m.away_name, players: pristine(m.away_slot) }, 'balanced', Number(m.seed), m.orders);
  assert.notEqual(facts(naive), facts(m.result_canonical), 'without the living state it is not the same game');

  // nor would today's squads do: the men have travelled on, the record has not
  const sq = Object.fromEntries((await pool.query(
    `SELECT slot, squad FROM clubs WHERE country_id='eng'`)).rows.map(r => [r.slot, r.squad]));
  const today = host.runMatch({ name: m.home_name, players: sq[m.home_slot] },
    { name: m.away_name, players: sq[m.away_slot] }, 'balanced', Number(m.seed), m.orders);
  assert.notEqual(facts(today), facts(m.result_canonical), 'today\'s men would have played it differently');
  assert.notDeepEqual(livingPatch(sq[m.home_slot]), m.living[m.home_name], 'today\'s men are not that day\'s men');
});

test('016: the nets, the face and the money all belong to the world', async () => {
  // THE NETS. A manager sets what their men work on; the umpire banks the
  // plan in force each round and the squad's craft follows from it.
  const squad = (await pool.query(`SELECT squad FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].squad;
  const pupil = squad.filter(p => (p.age || 30) <= 24)[0] || squad[0];
  const plan = {}; plan[pupil.name] = 'Power hitting';
  const setT = await as(U1, `SELECT public.world_set_training($1::jsonb) AS r`, [JSON.stringify(plan)]);
  assert.equal(setT.rows[0].r.ok, true);
  await assert.rejects(pool.query(`SELECT public.world_set_training('{}'::jsonb)`), /sign in/);
  await assert.rejects(as(U1, `SELECT public.world_set_training('"nonsense"'::jsonb)`), /an object/);
  assert.deepEqual((await pool.query(
    `SELECT training FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].training, plan);

  // play whatever rounds are genuinely still to come - however much cricket
  // this run has behind it - and the plan in force is captured, round by round
  const seas = (await pool.query(
    `SELECT season_no, start_day FROM seasons WHERE country_id='eng' ORDER BY season_no DESC LIMIT 1`)).rows[0];
  const settled = [];
  for (let i = 0; i < 4; i++) {
    const done = Number((await pool.query(
      `SELECT coalesce(max(round),0) AS r FROM matches WHERE country_id=$1 AND season_no=$2`,
      ['eng', seas.season_no])).rows[0].r);
    const next = done + 1;
    if (next > 18) break;
    const day = seas.start_day + dayOfRound(next);
    await runTick(pool, host, 'eng', day, { now: EPOCH + day * DAY + 18 * 3600000 });
    settled.push(next);
  }
  assert.ok(settled.length, 'there was cricket left to play');
  for (const r of settled) {
    const row = (await pool.query(
      `SELECT plan FROM training_rounds WHERE country_id='eng' AND slot=1 AND season_no=$1 AND round=$2`,
      [seas.season_no, r])).rows[0];
    assert.ok(row, 'round ' + r + ' banked the plan in force');
    assert.deepEqual(row.plan, plan, 'the plan in force is what was banked');
  }

  // the work shows: power was trained, so power is what grew
  const now2 = (await pool.query(`SELECT squad FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].squad;
  const after = now2.find(p => p.name === pupil.name);
  assert.ok(after.baseSkills, 'his generated baseline is remembered');
  assert.ok(after.skills.power >= after.baseSkills.power, 'the nets never made him worse');
  assert.ok(after.trainProgress && after.trainProgress.power > 0, 'he has genuinely been working on it');
  // and it never drifts: the same plans replay to the same cricketer
  await evolveCountry(pool, 'eng', EPOCH + 165 * DAY, host);
  const again = (await pool.query(`SELECT squad FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].squad;
  assert.deepEqual(again.find(p => p.name === pupil.name).skills, after.skills, 'training is a pure function of the plans worked');

  // THE FACE. Colours and a motto the world reads, validated by the world.
  const idOk = await as(U1, `SELECT public.world_set_identity('{"colour":"#1E88C7","motto":"Nothing without work","crest":"YO"}'::jsonb) AS r`);
  assert.equal(idOk.rows[0].r.identity.colour, '#1E88C7');
  await assert.rejects(as(U1, `SELECT public.world_set_identity('{"colour":"blue"}'::jsonb)`), /hex/);
  await assert.rejects(as(U1, `SELECT public.world_set_identity($1::jsonb)`,
    [JSON.stringify({ colour: '#123456', motto: 'x'.repeat(61) })]), /60 characters/);
  const seen = (await pool.query(`SELECT identity FROM public.world_clubs WHERE country_id='eng' AND slot=1`)).rows[0];
  assert.equal(seen.identity.motto, 'Nothing without work', 'the whole world can read it');

  // THE MONEY. A treasury the umpire settles and no device can write.
  const money = (await pool.query(
    `SELECT slot, bank FROM clubs WHERE country_id='eng' ORDER BY slot`)).rows;
  assert.equal(money.length, 16);
  money.forEach(m => assert.ok(Number.isFinite(Number(m.bank)), 'club ' + m.slot + ' has a treasury'));
  assert.ok(money.every(m => Number(m.bank) > 0), 'nobody has been bankrupted by a fortnight of cricket');
  // SETTLING TWICE SETTLES THE SAME FIGURE - the same inputs, the same
  // books. The pure-recompute evolve above legitimately moved the squads
  // (a living man's rating follows his record, and his wage follows him),
  // so the idempotency law is proved AROUND a settle of the current state,
  // not across the evolve: settle once to bring the bank to today's men,
  // then prove a second settle changes nothing.
  await settleMoney(pool, 'eng');
  const beforeBank = Number((await pool.query(
    `SELECT bank FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].bank);
  await settleMoney(pool, 'eng');
  const afterBank = Number((await pool.query(
    `SELECT bank FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].bank);
  assert.equal(afterBank, beforeBank, 'settling twice settles the same figure');

  // THE STATEMENT. Every movement the walk made, written down: what, when,
  // how much, and the balance left. It is a derived record, so the proof is
  // that it agrees with the totals beside it and survives a re-settle.
  const led = (await pool.query(
    `SELECT seq, at_ms, kind, label, amount, balance FROM ledger
      WHERE country_id='eng' AND slot=1 ORDER BY seq`)).rows;
  assert.ok(led.length > 10, 'the club has a statement: ' + led.length + ' entries');
  assert.equal(led[0].kind, 'founding', 'it opens with the board\'s money');
  assert.equal(Number(led[0].balance), 2500000);
  // the running balance is exactly the entries walked in order
  let run = 0;
  led.forEach(l => { run += Number(l.amount); assert.equal(Number(l.balance), run, 'entry ' + l.seq + ' leaves the right balance'); });
  assert.equal(run, beforeBank, 'the last balance IS the bank the manager reads');
  // the statement's own arithmetic against the books beside it
  const fin1 = (await pool.query(
    `SELECT finance FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].finance;
  const sum = k => led.filter(l => l.kind === k).reduce((a, l) => a + Number(l.amount), 0);
  assert.equal(sum('gate'), fin1.gate, 'the gate lines add up to the gate');
  assert.equal(sum('gate-away'), fin1.awayCut, 'the away shares add up to the away cut');
  assert.equal(sum('sponsor'), fin1.sponsor, 'the sponsor lines add up to the sponsor');
  assert.equal(-sum('wages'), fin1.wages, 'the wage lines add up to the wage bill paid');
  assert.equal(-sum('upkeep'), fin1.upkeep, 'the upkeep lines add up to the upkeep');
  // every entry is stamped with a real world moment, in order
  assert.ok(led.every(l => Number(l.at_ms) >= Date.UTC(2026, 7, 3)), 'no entry predates the founding');
  for (let i = 1; i < led.length; i++) {
    assert.ok(Number(led[i].at_ms) >= Number(led[i - 1].at_ms), 'entry ' + i + ' does not go back in time');
  }
  // rebuilt whole, never appended: settle again and it is the same statement
  await settleMoney(pool, 'eng');
  const led2 = (await pool.query(
    `SELECT seq, at_ms, kind, amount, balance FROM ledger
      WHERE country_id='eng' AND slot=1 ORDER BY seq`)).rows;
  assert.deepEqual(led2.map(l => [l.seq, String(l.at_ms), l.kind, String(l.amount), String(l.balance)]),
    led.map(l => [l.seq, String(l.at_ms), l.kind, String(l.amount), String(l.balance)]),
    'settling twice writes the identical statement');
  // and a bot club, whom nobody would read, is not written down at all
  const botLed = (await pool.query(
    `SELECT count(*)::int AS n FROM ledger WHERE country_id='eng' AND slot=0`)).rows[0].n;
  assert.equal(botLed, 0, 'the flagship keeps no statement - nobody reads it');
  // the reading function serves your own club and states its own bank
  const stmt = (await as(U1, `SELECT public.world_my_statement(5) AS s`)).rows[0].s;
  assert.equal(stmt.lines.length, 5, 'a page of five');
  assert.equal(stmt.entries, led.length);
  assert.ok(stmt.more, 'and there is more behind it');
  assert.ok(stmt.lines[0].seq > stmt.lines[4].seq, 'newest first, like a statement');
  const older = (await as(U1, `SELECT public.world_my_statement(5, ${stmt.lines[4].seq}) AS s`)).rows[0].s;
  assert.ok(older.lines[0].seq < stmt.lines[4].seq, 'the next page picks up where it left off');

  // your own status carries all three home
  const st = await as(U1, `SELECT public.world_my_status() AS s`);
  const s = st.rows[0].s;
  assert.deepEqual(s.training, plan);
  assert.equal(s.identity.crest, 'YO');
  assert.ok(Number(s.bank) > 0);
});

// THE STATS CENTRE: every man in the league with the columns a scorer keeps,
// each one recomputed off the banked cards rather than counted as it happens.
test('016b: the stats centre adds up to the scorecards it came from', async () => {
  const body = (await pool.query(
    `SELECT body FROM snapshots WHERE key='stats/eng'`)).rows[0].body;
  assert.ok(body && Array.isArray(body.players), 'the stats document exists');
  const P = body.players;
  assert.ok(P.length > 60, 'the whole league, not a top five: ' + P.length);
  const lg = (await pool.query(`SELECT body FROM snapshots WHERE key='league/eng'`)).rows[0].body;
  assert.equal(lg.statsFull, undefined, 'and it does not ride in the league snapshot');
  // the headline five ARE the top of this table, by the same measure
  const byRuns = P.slice().sort((a, b) => b.runs - a.runs || b.hs - a.hs);
  assert.equal(byRuns[0].name, lg.stats.bat[0].name, 'the leading run-scorer agrees');
  assert.equal(byRuns[0].runs, lg.stats.bat[0].runs);
  const byWkts = P.filter(x => x.wkts > 0).sort((a, b) => b.wkts - a.wkts || a.conc - b.conc);
  assert.equal(byWkts[0].name, lg.stats.bowl[0].name, 'the leading wicket-taker agrees');
  // and every column is arithmetic on the two the cards actually carry
  P.forEach(x => {
    if (x.bf) assert.equal(x.sr, Math.round(10000 * x.runs / x.bf) / 100, x.name + ' strike rate');
    if (x.wkts) assert.equal(x.bave, Math.round(100 * x.conc / x.wkts) / 100, x.name + ' bowling average');
    if (x.balls) assert.equal(x.er, Math.round(600 * x.conc / x.balls) / 100, x.name + ' economy');
    assert.ok(x.inns >= x.no, x.name + ': not-outs cannot exceed innings');
    assert.ok(x.hs <= x.runs, x.name + ': a best score cannot beat the aggregate');
    assert.ok(x.m >= 1, x.name + ' played at least one match');
  });
  // the whole league's runs are the whole league's runs
  const cards = (await pool.query(
    `SELECT result FROM matches WHERE country_id='eng' AND season_no=$1`, [body.seasonNo])).rows;
  let runs = 0, wkts = 0, f4 = 0, f6 = 0, mdns = 0;
  for (const c of cards) for (const inn of c.result.innings) {
    if (!inn) continue;
    for (const b of (inn.bat || [])) { runs += b.r || 0; f4 += b.f4 || 0; f6 += b.f6 || 0; }
    for (const k of Object.keys(inn.bowlers || {})) { wkts += inn.bowlers[k].w || 0; mdns += inn.bowlers[k].mdn || 0; }
  }
  const sum = k => P.reduce((a, x) => a + (x[k] || 0), 0);
  assert.equal(sum('runs'), runs, 'every run in the league is in the table');
  assert.equal(sum('wkts'), wkts, 'every wicket too');
  assert.equal(sum('f4'), f4, 'and every four');
  assert.equal(sum('f6'), f6, 'and every six');
  assert.equal(sum('mdns'), mdns, 'and every maiden over');
  // a keeper's catches are told from a fielder's by the dagger, and somebody
  // in this league keeps wicket
  assert.ok(sum('ckt') > 0, 'the gloves have held something: ' + sum('ckt'));
  assert.ok(sum('fkt') > 0, 'and so have the hands in the ring');
});

// EVERY CLUB'S OWN FEED: matches, transfers, challenges and call-ups in the
// order they happened, computed live off the record rather than logged.
test('016c: a club\'s events are the record, in order', async () => {
  const pub = (await pool.query(`SELECT public.world_club_events('eng', 1, 100) AS e`)).rows[0].e;
  assert.equal(pub.ok, true);
  assert.equal(pub.mine, false, 'a signed-out reader holds no club');
  const ev = pub.events;
  assert.ok(ev.length > 5, 'something has happened here: ' + ev.length);
  for (let i = 1; i < ev.length; i++) {
    assert.ok(ev[i].at <= ev[i - 1].at, 'newest first at entry ' + i);
  }
  // every match this club played is in the feed, and named the right opponent
  const played = (await pool.query(
    `SELECT count(*)::int AS n FROM matches
      WHERE country_id='eng' AND (home_slot=1 OR away_slot=1) AND played_at IS NOT NULL`)).rows[0].n;
  const feedMatches = (await pool.query(
    `SELECT jsonb_array_length((public.world_club_events('eng', 1, 500)->'events')) AS n`)).rows[0].n;
  assert.ok(feedMatches >= Math.min(played, 500), 'the matches are all in there');
  const m0 = ev.find(x => x.kind === 'match');
  assert.ok(m0, 'a match event exists');
  assert.ok(m0.oppSlot !== 1, 'a club is never its own opponent');
  assert.equal(typeof m0.won, 'boolean');
  assert.ok(m0.note, 'and it says how it went: ' + m0.note);
  // the private half stays private
  assert.equal(ev.filter(x => x.kind === 'orders' || x.kind === 'scouted').length, 0,
    'teamsheets and scouts are not a rival\'s business');
  const own = (await as(U1, `SELECT public.world_club_events('eng', 1, 200) AS e`)).rows[0].e;
  assert.equal(own.mine, true, 'the manager who holds it is known');
  assert.ok(own.events.some(x => x.kind === 'orders'), 'and he sees his own teamsheets');
  // a club that does not exist is not a page
  await assert.rejects(pool.query(`SELECT public.world_club_events('eng', 99)`), /no such club/);
});

// THE TRANSFER REGISTER: what a club has bought and sold, and what that adds
// up to - summed live off the settled listings rather than kept anywhere.
test('016d: the transfer register sums the deals it lists', async () => {
  const t = (await pool.query(`SELECT public.world_club_transfers('eng', 1, 300) AS t`)).rows[0].t;
  assert.equal(t.ok, true);
  assert.equal(t.transfers, t.bought + t.sold, 'the count is both directions');
  const deals = t.deals;
  assert.equal(deals.length, Math.min(t.transfers, 300), 'every deal is listed');
  for (let i = 1; i < deals.length; i++) {
    assert.ok(deals[i].at <= deals[i - 1].at, 'newest first at row ' + i);
  }
  // the headline figures ARE the rows added up
  const inRows = deals.filter(d => d.way === 'in'), outRows = deals.filter(d => d.way === 'out');
  assert.equal(inRows.length, t.bought);
  assert.equal(outRows.length, t.sold);
  assert.equal(Number(t.spent), inRows.reduce((a, d) => a + Number(d.fee), 0), 'paid out is the buys');
  assert.equal(Number(t.received), outRows.reduce((a, d) => a + Number(d.fee), 0), 'taken in is the sells');
  assert.equal(Number(t.net), Number(t.received) - Number(t.spent), 'net is the difference');
  if (t.bought) assert.equal(Number(t.avgBuy), Math.round(Number(t.spent) / t.bought));
  if (t.sold) assert.equal(Number(t.avgSell), Math.round(Number(t.received) / t.sold));
  // and a deal names the club at the other end of it, never this one
  deals.forEach(d => {
    assert.ok(d.player, 'a deal names its cricketer');
    assert.ok(!(d.oppCountry === 'eng' && d.oppSlot === 1), 'a club never trades with itself');
    assert.ok(d.season >= 1, 'and belongs to a season');
  });
  // it agrees with the books beside it: the same fees the walk counted
  const fin = (await pool.query(
    `SELECT finance FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].finance;
  assert.equal(Number(t.spent), fin.feesOut, 'paid out matches the books');
  assert.equal(Number(t.received), fin.feesIn, 'taken in matches the books');
  await assert.rejects(pool.query(`SELECT public.world_club_transfers('eng', 99)`), /no such club/);
});

// 017: WHAT A RIVAL MAY READ. The club pages show a scout's summary - one
// overall rating a man, his batting, his bowling, his fielding, and the three
// team strengths - computed in SQL so a page costs one small request. Those
// formulas are the ENGINE'S, mirrored; this holds the mirror to the original
// and refuses to let the coaching book through the same door.
test('017: the served club card matches the engine, and hides the coaching book', async () => {
  const squad = (await pool.query(
    `SELECT squad FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].squad;

  const fromEngine = host.pkOvr(squad);
  const fromSql = (await pool.query(
    `SELECT (world_pk_num(x)->>'ovr')::int AS o FROM jsonb_array_elements($1::jsonb) x`,
    [JSON.stringify(squad)])).rows.map(r => r.o);
  assert.deepEqual(fromSql, fromEngine, 'every card rating is the engine\'s own number');

  const card = (await pool.query(
    `SELECT * FROM public.world_squads WHERE country_id='eng' AND slot=1`)).rows[0];
  assert.equal(card.players.length, squad.length);
  assert.ok(Number(card.team_batting) > 0 && Number(card.team_bowling) > 0 && Number(card.team_fielding) > 0,
    'a side has a batting, an attack and a pair of hands');

  // strongest first, so a page can lead with the best man
  const ovrs = card.players.map(p => p.ovr);
  assert.deepEqual(ovrs, ovrs.slice().sort((a, b) => b - a), 'the roster arrives strongest first');
  assert.deepEqual(ovrs.slice().sort((a, b) => b - a), fromEngine.slice().sort((a, b) => b - a),
    'the same fifteen men, no more and no fewer');

  // THE LINE: summaries yes, the fifteen raw skills never
  const leak = JSON.stringify(card.players);
  for (const secret of ['skills', 'baseSkills', 'trainProgress', 'vsPace', 'vsSpin', 'wicket', 'economy',
    'discipline', 'moveTurn', 'variation', 'stamina', 'temperament', 'rotation', 'catching', 'stumping']) {
    assert.ok(leak.indexOf('"' + secret + '"') === -1, secret + ' must not cross the boundary');
  }
  for (const shown of ['ovr', 'batting', 'bowling', 'fielding', 'form', 'fatigue', 'career', 'wage']) {
    assert.ok(leak.indexOf('"' + shown + '"') !== -1, shown + ' is what a scout is allowed');
  }
});

// 018: THE ACADEMY'S MONEY. What the academy IS - scouting, signing, the boys
// who walk at twenty-one - belongs to tests/world-academy.test.mjs, which
// exercises it against docs/ACADEMY.md end to end. What is proved here is the
// only part the books care about: a level is a spent fact, so the treasury
// still recomputes from genesis however many times you settle it.
test('018: the academy is paid for, and it recomputes', async () => {
  // A BOY IS HIS SEED. The same seed makes the same cricketer, always - which
  // is what lets the umpire and the manager agree about who walked in.
  const a = makeRecruit(host, 'England', 'rock', 'good', 'youth|eng|1|s1|r1');
  const b = makeRecruit(host, 'England', 'rock', 'good', 'youth|eng|1|s1|r1');
  assert.deepEqual(a, b, 'the same seed turns out the same young cricketer');
  assert.ok(a.age >= 16 && a.age <= 20, 'a boy is sixteen to twenty');
  assert.equal(a.colt, true);
  // and a tier is a real ladder: more of the man has arrived in a better one
  const jewel = makeRecruit(host, 'England', 'rock', 'jewel', 'youth|eng|1|s1|r1');
  const poor = makeRecruit(host, 'England', 'rock', 'poor', 'youth|eng|1|s1|r1');
  assert.ok(jewel.rating > poor.rating, 'a jewel out-rates a boy who will never make it');

  // EVERY CLUB IN THE WORLD can field a Colts Cup side from the day it is founded
  const clubs = (await pool.query(
    `SELECT slot, academy, youth FROM clubs WHERE country_id='eng' ORDER BY slot`)).rows;
  assert.equal(clubs.length, 16);
  for (const c of clubs) {
    assert.equal(c.academy, 2, 'every club opens with a level-two academy');
    // (this world has already rolled over more than once by now, so some of the
    // fifteen it was founded with have turned twenty-one and walked - that a
    // FRESH world founds every club with fifteen is world-academy's to prove)
    assert.ok(c.youth.length > 0, 'club ' + c.slot + ' still has boys on the books');
    for (const y of c.youth) {
      assert.ok(y.age >= 16 && y.age <= 20, 'a boy on the books is under twenty-one');
      assert.ok(!y.career, 'a boy has no first-class record yet');
    }
  }

  // THE MONEY. An upgrade is a spent fact, so the treasury still recomputes.
  await settleMoney(pool, 'eng');
  const bank0 = Number((await pool.query(`SELECT bank FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].bank);
  const rounds = Number((await pool.query(
    `SELECT count(*) AS n FROM matches WHERE country_id='eng' AND (home_slot=1 OR away_slot=1)`)).rows[0].n);
  assert.ok(bank0 > 300000, 'a season of gate money covers an academy');

  await assert.rejects(pool.query(`SELECT public.world_set_academy(3)`), /sign in/);
  await assert.rejects(as(U1, `SELECT public.world_set_academy(9)`), /1 to 5/);
  await assert.rejects(as(U1, `SELECT public.world_set_academy(1)`), /never sold back/);
  const up = await as(U1, `SELECT public.world_set_academy(4) AS r`);
  assert.equal(up.rows[0].r.academy, 4);
  assert.equal(Number(up.rows[0].r.cost), academyBuild(2, 4), 'the build ladder, and the steps get steeper');
  const paid = (await pool.query(
    `SELECT academy, academy_paid, bank FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0];
  assert.equal(paid.academy, 4);
  assert.equal(Number(paid.academy_paid), academyBuild(2, 4), 'what was spent is remembered');
  assert.equal(Number(paid.bank), bank0 - academyBuild(2, 4), 'and it came straight out of the treasury');

  await settleMoney(pool, 'eng');
  const bank1 = Number((await pool.query(`SELECT bank FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].bank);
  // the upgrade is charged ONCE and the academy is charged EVERY ROUND, at the
  // level the club holds. Read the upkeep the walk actually took rather than
  // recomputing it here: how many rounds a club has settled is the walk's
  // business, and a test that guesses it is a test that breaks on the calendar.
  const fin1 = (await computeFinance(pool, 'eng')).find(f => f.slot === 1).finance;
  assert.equal(fin1.upkeep, fin1.rounds * academyUpkeep(4),
    'every settled round charged the academy the club holds NOW');
  // and that is the point of a walk that recomputes from genesis: buying a
  // level does not only cost the lump, it re-charges every round already
  // played at the dearer rate. So the treasury falls by the building AND by
  // the difference in upkeep across the whole season so far.
  assert.equal(bank1, bank0 - academyBuild(2, 4)
                          - fin1.rounds * (academyUpkeep(4) - academyUpkeep(2)),
    'the upgrade is charged once and the bigger academy for every round settled');
  await settleMoney(pool, 'eng');
  assert.equal(Number((await pool.query(
    `SELECT bank FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].bank), bank1, 'settling twice settles the same figure');

  // THE MANAGER'S TWO CALLS: hand a boy a senior shirt, or let him go. There
  // is no cap on the list any more - the wage bill is the only brake there is.
  const mine = (await pool.query(`SELECT academy, youth FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0];
  assert.ok(mine.youth.length > 0, 'there are boys on the books to make a call about');
  await assert.rejects(pool.query(`SELECT public.world_colt('anyone','promote')`), /sign in/);
  await assert.rejects(as(U1, `SELECT public.world_colt('Nobody At All','promote')`), /no boy of that name/);
  await assert.rejects(as(U1, `SELECT public.world_colt($1,'sell')`, [mine.youth[0].name]), /promote or release/);

  const squadWas = (await pool.query(`SELECT squad FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].squad.length;
  const lad = mine.youth[0].name, gone = mine.youth[1].name;
  assert.equal((await as(U1, `SELECT public.world_colt($1,'promote') AS r`, [lad])).rows[0].r.ok, true);
  assert.equal((await as(U1, `SELECT public.world_colt($1,'release') AS r`, [gone])).rows[0].r.ok, true);
  const after = (await pool.query(`SELECT squad, youth FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0];
  assert.equal(after.squad.length, squadWas + 1, 'the boy who was brought up is a senior');
  assert.ok(after.squad.some(p => p.name === lad && !p.colt), 'and he wears a senior shirt, not a colt\'s');
  assert.equal(after.youth.length, mine.youth.length - 2, 'one promoted, one released');
  assert.ok(!after.youth.some(y => y.name === lad || y.name === gone));

  // and he is handed no nets he was never at: the round he came up is
  // remembered, so a season of another man's training is not worked into him
  const shirt = after.squad.find(p => p.name === lad);
  assert.ok(shirt.joined && shirt.joined.s >= 1 && shirt.joined.r >= 1, 'the world remembers when he came up');
  await evolveCountry(pool, 'eng', EPOCH + 165 * DAY, host);
  const post = (await pool.query(
    `SELECT squad FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].squad.find(p => p.name === lad);
  assert.deepEqual(post.skills, shirt.baseSkills, 'he starts from the cricketer the academy turned out');

  // THE ROLLOVER. A year on every boy, and the one who reaches twenty-one
  // WALKS - he is not handed a shirt behind his manager's back, because a
  // senior contract costs money and is the manager's call to make or to miss.
  // Keyed by season, so a re-run never ages a boy twice.
  await pool.query(`UPDATE clubs SET youth=$1::jsonb WHERE country_id='eng' AND slot=3`,
    [JSON.stringify([{ name: 'Ready Lad', age: 20, wage: 400, colt: true },
                     { name: 'Green Lad', age: 18, wage: 300, colt: true }])]);
  const seniorWas = (await pool.query(`SELECT squad FROM clubs WHERE country_id='eng' AND slot=3`)).rows[0].squad.length;
  const rolled = await ageYouth(pool, 'eng', 4242);
  assert.equal(rolled.skipped, false);
  assert.equal(rolled.promoted, 0, 'the umpire hands out no shirts');
  assert.ok(rolled.released >= 1, 'and the twenty-one-year-old left');
  const bot = (await pool.query(`SELECT squad, youth FROM clubs WHERE country_id='eng' AND slot=3`)).rows[0];
  assert.equal(bot.squad.length, seniorWas, 'the staff is exactly as its manager left it');
  assert.ok(!bot.squad.some(p => p.name === 'Ready Lad'), 'he is gone from the world, not promoted');
  assert.equal(bot.youth.length, 1);
  assert.equal(bot.youth[0].name, 'Green Lad');
  assert.equal(bot.youth[0].age, 19, 'a year on the ones who stay');
  const twice = await ageYouth(pool, 'eng', 4242);
  assert.equal(twice.skipped, true, 'a rollover already worked is never worked again');
  assert.equal((await pool.query(
    `SELECT youth FROM clubs WHERE country_id='eng' AND slot=3`)).rows[0].youth[0].age, 19);

  // THE LINE. A rival sees the building, never the boys inside it.
  const seen = (await pool.query(`SELECT * FROM public.world_clubs WHERE country_id='eng' AND slot=1`)).rows[0];
  assert.equal(seen.academy, 4, 'an academy is a building, and buildings are visible');
  assert.ok(!('youth' in seen), 'who is in it is nobody else\'s business');
  assert.ok(JSON.stringify(seen).indexOf('Green Lad') === -1);

  // A MANAGER IS CALLED WHAT HE CALLS HIMSELF - and the name lives on the claim.
  await assert.rejects(as(U1, `SELECT public.world_set_manager('x')`), /two letters/);
  await assert.rejects(as(U1, `SELECT public.world_set_manager($1)`, ['x'.repeat(25)]), /24 characters/);
  await assert.rejects(as(U1, `SELECT public.world_set_manager('<script>')`), /letters, numbers/);
  const named = await as(U1, `SELECT public.world_set_manager('  Santosh   K  ') AS r`);
  assert.equal(named.rows[0].r.manager, 'Santosh K', 'the spacing is tidied, the name is his');
  assert.equal((await pool.query(
    `SELECT manager FROM public.world_clubs WHERE country_id='eng' AND slot=1`)).rows[0].manager, 'Santosh K',
    'and the whole world reads it');

  // your own status carries the academy home
  const st = (await as(U1, `SELECT public.world_my_status() AS s`)).rows[0].s;
  assert.equal(st.manager, 'Santosh K');
  assert.equal(st.academy, 4);
  assert.equal(st.youth.length, (await pool.query(
    `SELECT youth FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].youth.length,
    'the boys on his books are the boys the world has');
  assert.equal(st.claim.name, 'Santosh K');
});

// 019: THE COLTS CUP, and what an academy buys in the nets. Nine fixtures on
// every second league round, played by the umpire from a side nobody picks -
// the boys plus the youngest professionals - so an offline manager cannot
// lose it. Its own table, its own champion, and not one line of it touching a
// senior first-class record.
test('019: the Colts Cup plays itself, and the academy sets the rate in the nets', async () => {
  const seas = (await pool.query(
    `SELECT season_no FROM seasons WHERE country_id='eng' ORDER BY season_no DESC LIMIT 1`)).rows[0].season_no;

  // the draw: Colts round k is played on league round 2k, up to nine
  assert.equal(coltsRoundOf(2), 1);
  assert.equal(coltsRoundOf(18), 9);
  assert.equal(coltsRoundOf(3), 0, 'odd league rounds have no youth fixture');
  assert.equal(coltsRoundOf(20), 0, 'the cup is nine rounds and stops');

  // a season of league cricket has left a season of youth cricket behind it
  const played = (await pool.query(
    `SELECT season_no, round, count(*)::int AS n FROM youth_matches WHERE country_id='eng'
      GROUP BY season_no, round ORDER BY season_no, round`)).rows;
  assert.ok(played.filter(r => r.season_no === 1).length >= 5,
    'the boys have had a season of fixtures: ' + played.length + ' rounds');
  played.forEach(r => assert.equal(r.n, 8,
    'Colts s' + r.season_no + ' round ' + r.round + ' is a full eight fixtures - both divisions'));
  const lr = (await pool.query(
    `SELECT DISTINCT league_round, round FROM youth_matches WHERE country_id='eng'`)).rows;
  lr.forEach(r => assert.equal(r.league_round, r.round * 2, 'every youth round rode on its league round'));

  // THE SIDE NOBODY PICKS: the boys first, then the youngest men on the staff
  const club = (await pool.query(
    `SELECT slot, name, squad, youth FROM clubs WHERE country_id='eng' AND slot=4`)).rows[0];
  const side = coltsSquad(club);
  assert.ok(side.length >= 11, 'there is always an eleven');
  (club.youth || []).forEach(y => assert.ok(side.some(p => p.name === y.name), 'every colt is in it'));
  const avgSide = side.reduce((s, p) => s + (p.age || 30), 0) / side.length;
  const avgSquad = club.squad.reduce((s, p) => s + (p.age || 30), 0) / club.squad.length;
  assert.ok(avgSide < avgSquad, 'it is a young side (' + avgSide.toFixed(1) + ' v ' + avgSquad.toFixed(1) + ')');
  assert.deepEqual(coltsSquad(club).map(p => p.name), side.map(p => p.name), 'and the same side on every replay');

  // playing the same youth round again plays nothing
  const season = (await pool.query(
    `SELECT * FROM seasons WHERE country_id='eng' AND season_no=$1`, [seas])).rows[0];
  assert.equal(await playColtsRound(pool, host, 'eng', season, 2, seedOf, 'v1'), 0,
    'a youth round already played is never replayed');

  // THE TABLE, from the banked cards alone
  const cup = (await pool.query(`SELECT body FROM snapshots WHERE key='colts/eng'`)).rows[0].body;
  assert.equal(cup.table.length, 16);
  const games = cup.table.reduce((s, r) => s + r.p, 0);
  assert.equal(games, cup.results.length * 2, 'every club-entry in the table is a match somebody played');
  cup.table.forEach(r => assert.equal(r.pts, r.w * 2 + r.t, 'two for a win, one for a tie'));
  assert.ok(cup.runs.length && cup.runs[0].runs > 0, 'somebody is leading the run-scoring');
  assert.deepEqual(cup.table.map(r => r.pts), cup.table.map(r => r.pts).slice().sort((a, b) => b - a),
    'the table is in order');

  // A BOY'S OWN RECORD goes back onto the boy, and stays out of the seniors'
  const withRec = (await pool.query(
    `SELECT youth FROM clubs WHERE country_id='eng'`)).rows
    .flatMap(r => r.youth || []).filter(y => y.colts && y.colts.m > 0);
  assert.ok(withRec.length, 'colts carry what they did in the cup');
  withRec.forEach(y => { assert.ok(y.colts.runs >= 0 && y.colts.hs <= y.colts.runs); });
  // a man who came up out of the academy keeps what he did for the Colts -
  // but it is never mistaken for a first-class career, which the senior
  // record builds from senior matches and nothing else
  const seniors = (await pool.query(`SELECT squad FROM clubs WHERE country_id='eng'`)).rows.flatMap(r => r.squad);
  seniors.forEach(p => assert.ok(!p.colts || p.joined,
    p.name + ' carries a Colts record without ever having been a colt'));
  // ...and the claim in full, which does not depend on WHEN a colt came up: a
  // boy still in the academy has no first-class record at all. Asserting
  // instead that a graduate has not yet played a senior match only held while
  // promotions happened to land after the rounds did.
  const academy = (await pool.query(`SELECT youth FROM clubs WHERE country_id='eng'`)).rows
    .flatMap(r => Array.isArray(r.youth) ? r.youth : []);
  assert.ok(academy.length, 'there are colts on the books');
  academy.forEach(y => assert.ok(!y.career,
    y.name + ' is a colt and cannot carry a first-class record'));
  await coltRecords(pool, 'eng', seas);
  const again = (await pool.query(
    `SELECT youth FROM clubs WHERE country_id='eng'`)).rows.flatMap(r => r.youth || []).filter(y => y.colts);
  assert.equal(again.length, withRec.length, 'recomputing the records writes the same records');

  // WHAT THE ACADEMY BUYS IN THE NETS: level two is the unit, eight per cent a level
  assert.equal(academyRate(2), 1);
  assert.ok(academyRate(5) > academyRate(2) && academyRate(1) < academyRate(2));
  const pupil = JSON.parse(JSON.stringify(club.squad.filter(p => (p.age || 30) <= 24)[0] || club.squad[0]));
  const plan = {}; plan[pupil.name] = 'Fitness';
  const slow = host.trainRound([JSON.parse(JSON.stringify(pupil))], plan, academyRate(1)).players[0];
  const fast = host.trainRound([JSON.parse(JSON.stringify(pupil))], plan, academyRate(5)).players[0];
  const sum = p => Object.keys(p.trainProgress || {}).reduce((s, k) => s + p.trainProgress[k], 0)
                 + Object.keys(p.skills).reduce((s, k) => s + p.skills[k], 0) * 1000;
  assert.ok(sum(fast) > sum(slow), 'a better academy works the same man harder');
  const same = host.trainRound([JSON.parse(JSON.stringify(pupil))], plan).players[0];
  assert.deepEqual(host.trainRound([JSON.parse(JSON.stringify(pupil))], plan, 1).players[0], same,
    'no rate at all is the rate the world was founded at');

  // and the level in force is BANKED with the plan in force, so it replays
  const banked = (await pool.query(
    `SELECT DISTINCT academy FROM training_rounds WHERE country_id='eng' AND slot=1`)).rows;
  assert.ok(banked.length && banked.every(r => r.academy >= 1 && r.academy <= 5),
    'every round remembers the academy that worked it');
});

// 020: THE BOOKS. A club's money stops being four flat numbers and becomes a
// ledger the umpire walks from the founding - a crowd that grows on winning,
// a mood that reads the last five results and the table, a gate split two
// thirds and one third, a sponsor who checks the standings, wages and upkeep
// by the round, and interest on an overdraft. Every line derived; nothing
// incremented; settle it twice and it settles the same.
test('020: the books are a ledger, and they recompute from the record', async () => {
  // THE DAY AT THE GROUND is a pure function of the fixture - nobody stores it
  assert.deepEqual(weatherOf('eng:s1:r1:h1a2'), weatherOf('eng:s1:r1:h1a2'));
  assert.ok(weatherOf(0).word && weatherOf(0).mult > 0);
  const words = new Set(); for (let i = 0; i < 40; i++) words.add(weatherOf(i).word);
  assert.ok(words.size > 1, 'the weather is not always the same day');

  // WHAT THE SUPPORTERS THINK is a reading, not a counter
  assert.equal(moodOf([2, 2, 2, 2, 2], 1, 10), 6, 'winning everything from the top is ecstatic');
  assert.equal(moodOf([0, 0, 0, 0, 0], 10, 10), 0, 'losing everything from the bottom is mutinous');
  assert.ok(moodOf([2, 0, 2, 0, 1], 5, 10) > 0 && moodOf([2, 0, 2, 0, 1], 5, 10) < 6);

  // THE LEDGER ITSELF
  await settleMoney(pool, 'eng');
  const rows = (await pool.query(
    `SELECT slot, bank, seats, finance FROM clubs WHERE country_id='eng' ORDER BY slot`)).rows;
  assert.equal(rows.length, 16);
  for (const r of rows) {
    const f = r.finance;
    assert.ok(f && f.rounds > 0, 'club ' + r.slot + ' has played and been paid');
    assert.ok(f.supporters >= 4000 && f.supporters <= 60000, 'a believable following');
    assert.ok(f.mood >= 0 && f.mood <= 6 && MOOD_WORD[f.mood] === f.moodWord);
    assert.ok(f.lastAttendance > 0 && f.lastAttendance <= r.seats, 'nobody sold more seats than they built');
    assert.ok(f.gate > 0 && f.awayCut > 0, 'money came through the gate at home and away');
    assert.ok(f.sponsor > 0 && f.wages > 0 && f.upkeep > 0);
    // a club that lost men to the international windows was paid for them,
    // and one that lost none was paid nothing
    assert.equal(f.compensation > 0, f.capsAway > 0, 'club ' + r.slot + ': caps away and money in agree');
    assert.equal(f.ticket, TICKET);
  }
  // the bank IS the ledger: founded, plus what came in, less what went out.
  // The international windows are an income line like any other - what the
  // board paid for the men it took, walked from genesis with the rest.
  for (const r of rows) {
    const f = r.finance;
    const expect = f.founded + f.gate + f.awayCut + f.sponsor + (f.compensation || 0)
      + (f.feesIn || 0) + f.writtenOff
      - f.wages - f.upkeep - f.interest - f.academyPaid - f.seatsPaid
      - (f.feesOut || 0) - (f.scouting || 0) - (f.academySpend || 0);
    assert.equal(Number(r.bank), Math.round(expect), 'club ' + r.slot + ': the books add up');
  }
  assert.ok(rows.reduce((s, r) => s + (r.finance.capsAway || 0), 0) > 0,
    'a season of international windows reached this league');
  // and settling twice settles the same figure
  const before = rows.map(r => Number(r.bank));
  await settleMoney(pool, 'eng');
  const after = (await pool.query(
    `SELECT bank FROM clubs WHERE country_id='eng' ORDER BY slot`)).rows.map(r => Number(r.bank));
  assert.deepEqual(after, before, 'the ledger never drifts');

  // WINNING PAYS. The club at the top of the table draws a bigger crowd, is in
  // a better mood and is richer than the club at the bottom.
  const lg = (await pool.query(`SELECT body FROM snapshots WHERE key='league/eng'`)).rows[0].body;
  const top = rows.find(r => r.slot === lg.table[0].slot), bot = rows.find(r => r.slot === lg.table[7].slot);
  assert.ok(top.finance.supporters > bot.finance.supporters,
    'the champions have the bigger following (' + top.finance.supporters + ' v ' + bot.finance.supporters + ')');
  assert.ok(top.finance.mood >= bot.finance.mood, 'and the happier one');

  // THE GATE SPLIT: two thirds to the home club, one third to the visitors
  const cash = await computeFinance(pool, 'eng');
  const totalGate = cash.reduce((s, c) => s + c.finance.gate + c.finance.awayCut, 0);
  const homeShare = cash.reduce((s, c) => s + c.finance.gate, 0);
  assert.ok(Math.abs(homeShare / totalGate - HOME_CUT) < 0.01,
    'the home clubs took two thirds of everything through the turnstiles');

  // BUILDING THE GROUND. The cost curve in SQL is the cost curve in the server.
  for (const [a, b] of [[15000, 16000], [15000, 20000], [20000, 25000], [15000, 45000]]) {
    const sql = Number((await pool.query('SELECT public.world_seat_cost($1,$2) AS c', [a, b])).rows[0].c);
    assert.equal(sql, stadiumCost(a, b), 'seat cost ' + a + '->' + b + ' agrees');
  }
  assert.ok(seatBlockPrice(25000) > seatBlockPrice(15000), 'building gets dearer the bigger you are');

  await assert.rejects(pool.query(`SELECT public.world_set_stadium(16000)`), /sign in/);
  await assert.rejects(as(U1, `SELECT public.world_set_stadium(15500)`), /a thousand at a time/);
  await assert.rejects(as(U1, `SELECT public.world_set_stadium(15000)`), /never taken down/);
  await assert.rejects(as(U1, `SELECT public.world_set_stadium(50000)`), /forty-five thousand/);
  const bank9 = Number((await pool.query(`SELECT bank FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].bank);
  const build = await as(U1, `SELECT public.world_set_stadium(18000) AS r`);
  assert.equal(build.rows[0].r.seats, 18000);
  assert.equal(Number(build.rows[0].r.cost), stadiumCost(15000, 18000));
  const built = (await pool.query(
    `SELECT seats, seats_paid, bank FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0];
  assert.equal(built.seats, 18000);
  assert.equal(Number(built.seats_paid), stadiumCost(15000, 18000), 'what was spent is remembered');
  assert.equal(Number(built.bank), bank9 - stadiumCost(15000, 18000));
  await settleMoney(pool, 'eng');
  const settled = (await pool.query(
    `SELECT bank, finance FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0];
  assert.equal(Number(settled.finance.seatsPaid), stadiumCost(15000, 18000),
    'the ledger carries the stand from the founding, so it cannot be hidden');
  assert.equal(settled.finance.nextSeats, 19000);
  assert.equal(Number(settled.finance.nextSeatsCost), seatBlockPrice(18000));
  await assert.rejects(as(U1, `SELECT public.world_set_stadium(45000)`), /that costs/,
    'no borrowing to build');

  // A GROUND IS A BUILDING, and buildings are visible
  const seen = (await pool.query(
    `SELECT * FROM public.world_clubs WHERE country_id='eng' AND slot=1`)).rows[0];
  assert.equal(seen.seats, 18000);
  assert.ok(!('finance' in seen), 'the books are not');

  // AN OVERDRAFT COSTS. Put an unpayable wage bill on a bot club and the
  // umpire charges it interest, round after round, from the record.
  const before9 = (await pool.query(
    `SELECT squad, finance FROM clubs WHERE country_id='eng' AND slot=9`)).rows[0];
  const solvent = before9.squad;
  const solventSponsor = Number(before9.finance.sponsor);
  const ruinous = solvent.map(p => Object.assign({}, p, { wage: 600000 }));
  await pool.query(`UPDATE clubs SET squad=$1::jsonb WHERE country_id='eng' AND slot=9`,
    [JSON.stringify(ruinous)]);
  await settleMoney(pool, 'eng');
  const broke = (await pool.query(
    `SELECT bank, finance FROM clubs WHERE country_id='eng' AND slot=9`)).rows[0];
  assert.ok(Number(broke.bank) < 0, 'a club that cannot pay its men is in the red');
  assert.ok(broke.finance.interest > 0, 'and the bank charges it for the privilege');
  const red = Number(broke.bank);

  // THE FLOOR. Nothing sinks past what the club was founded with. Below the
  // line the losses are written off - there is no deeper hole - but the club
  // is under, the sponsor halves his cheque, and it builds nothing.
  assert.equal(red, -DEBT_LIMIT, 'the hole stops at the founding money and no further');
  assert.equal(broke.finance.administration, true, 'and the club is in administration');
  assert.ok(broke.finance.writtenOff > 0, 'what fell below the floor was written off');
  assert.ok(broke.finance.adminRounds > 0);
  const healthy = (await pool.query(
    `SELECT finance FROM clubs WHERE country_id='eng' AND slot=8`)).rows[0].finance;
  assert.equal(healthy.administration, false, 'a solvent club is not');
  // THE DISTRESSED DEAL PAYS LESS - and the only honest way to see that is on
  // ONE club's own books. The sponsor reads the TABLE before he signs, so two
  // different clubs earn two different amounts for reasons that have nothing to
  // do with administration; comparing across them only ever worked while every
  // side in the league was a copy of every other. This club's league position is
  // fixed by cards already banked, so settling it solvent and then ruined
  // changes exactly one thing.
  assert.ok(broke.finance.sponsor < solventSponsor,
    'the same club earns less in administration than it did solvent (' +
    broke.finance.sponsor + ' v ' + solventSponsor + ')');
  // and the books still add up with the write-off in them
  assert.equal(red, Math.round(broke.finance.founded + broke.finance.gate + broke.finance.awayCut
    + broke.finance.sponsor + (broke.finance.compensation || 0) + (broke.finance.feesIn || 0)
    + broke.finance.writtenOff
    - broke.finance.wages - broke.finance.upkeep
    - broke.finance.interest - broke.finance.academyPaid - broke.finance.seatsPaid
    - (broke.finance.feesOut || 0) - (broke.finance.scouting || 0)),
    'the ruined books add up too');
  await settleMoney(pool, 'eng');
  assert.equal(Number((await pool.query(
    `SELECT bank FROM clubs WHERE country_id='eng' AND slot=9`)).rows[0].bank), red,
    'even ruin recomputes to the same figure');
  await pool.query(`UPDATE clubs SET squad=$1::jsonb WHERE country_id='eng' AND slot=9`,
    [JSON.stringify(solvent)]);
  await settleMoney(pool, 'eng');

  // A CLUB IN THE RED BUILDS NOTHING, and is told so in English
  await pool.query(`UPDATE clubs SET bank=-40000 WHERE country_id='eng' AND slot=1`);
  await assert.rejects(as(U1, `SELECT public.world_set_stadium(19000)`), /builds nothing/);
  await assert.rejects(as(U1, `SELECT public.world_set_academy(5)`), /builds nothing/);
  await settleMoney(pool, 'eng');

  // your own status carries the books home
  const st = (await as(U1, `SELECT public.world_my_status() AS s`)).rows[0].s;
  assert.equal(st.seats, 18000);
  assert.ok(st.finance && st.finance.supporters > 0 && st.finance.moodWord);
  assert.equal(Number(st.bank), Number((await pool.query(
    `SELECT bank FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].bank));
});

// 021: THE INVITATIONALS. Competitions managers make themselves - a name, a
// shape, and other managers joining. The law holds: once enrolment closes,
// nobody needs to be awake. Empty seats are filled with bot clubs so a half-
// subscribed competition still gets played, a round settles a day on the real
// engine from the squads as they stand, and the umpire crowns it.
test('021: a manager founds a competition and the umpire plays it out', async () => {
  // THE DRAW is arithmetic: a round robin meets everyone once, a bracket halves
  const rr = roundRobin(4);
  assert.equal(rr.length, 3, 'four clubs is three rounds');
  rr.forEach(r => assert.equal(r.length, 2));
  const met = new Set();
  rr.flat().forEach(([a, b]) => met.add(Math.min(a, b) + '-' + Math.max(a, b)));
  assert.equal(met.size, 6, 'every pair exactly once');
  assert.deepEqual(bracket(4), [[0, 3], [1, 2]], 'top seat plays bottom seat inward');
  assert.equal(roundsOf('cup', 8), 3);
  assert.equal(roundsOf('league', 8), 7);

  // FOUNDING ONE
  await assert.rejects(pool.query(`SELECT public.world_comp_found('X','cup',4)`), /sign in/);
  await assert.rejects(as(U1, `SELECT public.world_comp_found('no','cup',4)`), /three letters/);
  await assert.rejects(as(U1, `SELECT public.world_comp_found('The Cup','tournament',4)`), /cup or a round robin/);
  await assert.rejects(as(U1, `SELECT public.world_comp_found('The Cup','cup',6)`), /four clubs or eight/);
  const made = (await as(U1, `SELECT public.world_comp_found('  The   Potato Bowl ','cup',4) AS r`)).rows[0].r;
  assert.equal(made.ok, true);
  assert.equal((await pool.query('SELECT name FROM comps WHERE id=$1', [made.id])).rows[0].name,
    'The Potato Bowl', 'the spacing is tidied');
  const cid = Number(made.id);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM comp_clubs WHERE comp_id=$1', [cid])).rows[0].n, 1,
    'the founder takes the first seat');

  // JOINING, and the rules of the door
  await assert.rejects(as(U1, `SELECT public.world_comp_join($1)`, [cid]), /already in it/);
  await assert.rejects(as(U1, `SELECT public.world_comp_join(999999)`), /no such competition/);
  await assert.rejects(pool.query(`SELECT public.world_comp_join($1)`, [cid]), /sign in/);
  // a second manager takes a seat, which is the whole point of the thing
  assert.equal((await as(U2, `SELECT public.world_comp_join($1) AS r`, [cid])).rows[0].r.seat, 1);

  // ENROLMENT CLOSES and the umpire makes the numbers up
  const day = (await pool.query('SELECT open_until_day FROM comps WHERE id=$1', [cid])).rows[0].open_until_day;
  const closeAt = EPOCH + day * DAY + 6 * 3600000;
  const started = await closeEnrolment(pool, closeAt);
  assert.ok(started.map(Number).includes(cid), 'it started when its window shut');
  const field = (await pool.query(
    'SELECT * FROM comp_clubs WHERE comp_id=$1 ORDER BY seat', [cid])).rows;
  assert.equal(field.length, 4, 'four seats, filled');
  assert.equal(field.filter(f => f.user_id).length, 2, 'two managed clubs and two made up the numbers');
  assert.equal(new Set(field.map(f => f.country_id + ':' + f.slot)).size, 4, 'and no club twice');
  const cp = (await pool.query('SELECT * FROM comps WHERE id=$1', [cid])).rows[0];
  assert.equal(cp.status, 'running');
  assert.equal(cp.rounds, 2, 'four clubs in a cup is semis and a final');
  // closing again changes nothing
  assert.deepEqual(await closeEnrolment(pool, closeAt), []);
  const again = (await pool.query(
    'SELECT country_id, slot FROM comp_clubs WHERE comp_id=$1 ORDER BY seat', [cid])).rows;
  assert.deepEqual(again, field.map(f => ({ country_id: f.country_id, slot: f.slot })),
    'the same seats to the same clubs on a re-run');

  // AND IT IS PLAYED, a round a day, on the real engine
  const d1 = EPOCH + cp.start_day * DAY + 20 * 3600000;
  const r1 = await playComps(pool, host, 'v1', d1);
  assert.equal(r1.length, 2, 'the semi-finals');
  assert.equal((await playComps(pool, host, 'v1', d1)).length, 0, 'a round already played is never replayed');
  const d2 = EPOCH + (cp.start_day + 1) * DAY + 20 * 3600000;
  const r2 = await playComps(pool, host, 'v1', d2);
  assert.equal(r2.length, 1, 'the final');

  const card = await computeComp(pool, cid);
  assert.equal(card.name, 'The Potato Bowl');
  assert.equal(card.results.length, 3);
  assert.ok(card.champion, 'somebody is holding it: ' + card.champion);
  assert.ok(card.clubs.some(c => c.name === card.champion), 'and it is one of the four');
  const semis = card.results.filter(r => r.round === 1).map(r => r.winner).filter(Boolean);
  const fin = card.results.find(r => r.round === 2);
  assert.ok(semis.includes(fin.a) && semis.includes(fin.b),
    'the final is between the two who won their semi-finals');
  assert.equal((await pool.query('SELECT status, champion FROM comps WHERE id=$1', [cid])).rows[0].status, 'done');

  // A ROUND ROBIN keeps a table instead of a bracket
  const lg = (await as(U1, `SELECT public.world_comp_found('The Spud League','league',4) AS r`)).rows[0].r;
  const lid = Number(lg.id);
  const lday = (await pool.query('SELECT open_until_day FROM comps WHERE id=$1', [lid])).rows[0].open_until_day;
  await closeEnrolment(pool, EPOCH + lday * DAY + 6 * 3600000);
  const lcp = (await pool.query('SELECT * FROM comps WHERE id=$1', [lid])).rows[0];
  assert.equal(lcp.rounds, 3);
  await playComps(pool, host, 'v1', EPOCH + (lcp.start_day + 2) * DAY + 20 * 3600000);
  const lcard = await computeComp(pool, lid);
  assert.equal(lcard.results.length, 6, 'three rounds of two');
  assert.equal(lcard.table.reduce((s, t) => s + t.p, 0), 12, 'every club played three');
  lcard.table.forEach(t => assert.equal(t.pts, t.w * 2 + t.t));
  assert.deepEqual(lcard.table.map(t => t.pts), lcard.table.map(t => t.pts).slice().sort((a, b) => b - a));
  assert.equal(lcard.champion, lcard.table[0].name, 'the table decides a league');

  // TWO ON THE GO IS THE LIMIT - a manager runs what he starts. (The two
  // above are finished and done, so they no longer count against him.)
  const gone = (await as(U1, `SELECT public.world_comp_found('The Fold','cup',8) AS r`)).rows[0].r;
  await as(U1, `SELECT public.world_comp_found('The Other Fold','cup',4)`);
  await assert.rejects(as(U1, `SELECT public.world_comp_found('One Too Many','cup',4)`), /before founding another/);

  // LEAVING, while it is still open; the founder leaving folds it
  await assert.rejects(as(U1, `SELECT public.world_comp_leave($1)`, [cid]), /you play it out/);
  assert.equal((await as(U1, `SELECT public.world_comp_leave($1) AS r`, [Number(gone.id)])).rows[0].r.folded, true);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM comps WHERE id=$1', [Number(gone.id)])).rows[0].n, 0);

  // WHAT THE WORLD MAY READ
  const seen = (await pool.query(`SELECT * FROM public.world_comps WHERE id=$1`, [cid])).rows[0];
  assert.equal(seen.name, 'The Potato Bowl');
  assert.equal(Number(seen.entered), 4);
  assert.equal(Number(seen.managed), 2);
  assert.ok(!('founder' in seen), 'who founded it is not a public fact about a person');
  await rebuildComps(pool);
  const snap = (await pool.query(`SELECT body FROM snapshots WHERE key='comps'`)).rows[0].body;
  assert.ok(snap.comps.some(c => Number(c.id) === cid && c.champion), 'the shelf carries the finished card');
});

// 022: MATCH RATINGS, and the points that move a man's form. Both are derived
// from a banked scorecard and nothing else - and they are the SAME points, so
// the ratings page and a player's form can never tell two different stories.
test('022: a card marks itself, and those marks are what move form', async () => {
  const m = (await pool.query(
    `SELECT result FROM matches WHERE country_id='eng' ORDER BY season_no DESC, round DESC LIMIT 1`)).rows[0];
  const innings = m.result.innings.filter(Boolean);
  assert.equal(innings.length, 2);

  // ONE FORMULA, TWO HOSTS: the server's port and the shipped client's own
  // arithmetic agree, line for line, on real innings
  assert.deepEqual(fantasyPoints(innings), host.fantasy(innings),
    'the umpire and the phone score the same day the same way');
  // and on a hand-built card that exercises every clause
  const made = [{ batTeam: 'A', bowlTeam: 'B',
    bat: [{ p: { name: 'Ton' }, r: 104, b: 88, f4: 11, f6: 3, out: 'b Quick' },
          { p: { name: 'Duck' }, r: 0, b: 3, f4: 0, f6: 0, out: 'lbw b Quick' },
          { p: { name: 'Block' }, r: 14, b: 52, f4: 1, f6: 0, out: null }],
    bowlers: { Quick: { w: 5, r: 41, b: 60 }, Dear: { w: 0, r: 78, b: 48 } },
    fielding: { Gloves: { ct: 3, st: 1, ro: 0 } } }];
  assert.deepEqual(fantasyPoints(made), host.fantasy(made), 'and on the awkward cases too');
  const byName = Object.fromEntries(fantasyPoints(made).map(p => [p.n, p.pts]));
  assert.ok(byName.Ton > byName.Block, 'a hundred beats a crawl');
  assert.ok(byName.Duck < 0, 'a duck costs you');
  assert.ok(byName.Quick > byName.Dear, 'five-for beats nought for seventy-eight');
  assert.ok(byName.Gloves > 0, 'the keeper is paid for his hands');

  // THE MARKS, out of ten, for both sides of a real match
  const rat = matchRatings(m.result);
  const sides = Object.keys(rat.sides);
  assert.equal(sides.length, 2);
  for (const nm of sides) {
    const s = rat.sides[nm];
    assert.ok(s.overall > 0 && s.overall <= 10, nm + ' has an overall mark: ' + s.overall);
    ['top', 'middle', 'seam', 'field'].forEach(k => {
      if (s[k] != null) assert.ok(s[k] >= 0 && s[k] <= 10, nm + ' ' + k + ' is out of ten');
    });
  }
  // the side that batted carries batting marks, the side that bowled carries bowling
  const first = m.result.innings[0];
  assert.ok(rat.sides[first.batTeam].top != null, 'the batting side is marked on its batting');
  assert.ok(rat.sides[first.bowlTeam].seam != null || rat.sides[first.bowlTeam].spin != null,
    'the bowling side on its bowling');
  // a great card outmarks a poor one
  const good = unitRatings({ bat: [{ p: {}, r: 120, b: 90 }, { p: {}, r: 80, b: 70 }, { p: {}, r: 40, b: 30 }],
    bowlers: {}, fielding: {}, wkts: 2 });
  const bad = unitRatings({ bat: [{ p: {}, r: 4, b: 20 }, { p: {}, r: 1, b: 9 }, { p: {}, r: 0, b: 2, out: 'b X' }],
    bowlers: {}, fielding: {}, wkts: 9 });
  assert.ok(good.top > bad.top, 'runs are marked above no runs (' + good.top + ' v ' + bad.top + ')');
  assert.ok(good.top <= 10 && bad.top >= 0);

  // FORM IS FED BY THOSE POINTS. Recompute the living layer and a man who has
  // had a good run is in better nick than one who has had a bad one.
  await evolveCountry(pool, 'eng', EPOCH + 165 * DAY, host);
  const squad = (await pool.query(`SELECT squad FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].squad;
  const capped = squad.filter(p => p.career && p.career.m > 0);
  assert.ok(capped.length >= 11);
  capped.forEach(p => assert.ok(p.formIx >= 0 && p.formIx <= 6, p.name + ' has a form reading'));
  assert.ok(new Set(capped.map(p => p.formIx)).size > 1,
    'the squad is not all in identical nick - the points genuinely separate them');
  // and it still never drifts
  const before = squad.map(p => p.formIx);
  await evolveCountry(pool, 'eng', EPOCH + 165 * DAY, host);
  const after = (await pool.query(
    `SELECT squad FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].squad.map(p => p.formIx);
  assert.deepEqual(after, before, 'form is still a pure function of the record');
});

// 023: THE ROLLOVER HAS A CEILING. The academy shipped with a hole in it: the
// umpire promoted every colt who turned twenty-one straight into the senior
// squad with no size check, while the manager doing it by hand was refused
// past twenty - and nothing in the world ever aged or retired a professional.
// Squads only ever grew. A year now does what a year does.
test('023: a year ages everybody, retires the oldest, and a staff is twenty', async () => {
  const seat = async (slot, squad, youth) => pool.query(
    `UPDATE clubs SET squad=$2::jsonb, youth=$3::jsonb WHERE country_id='eng' AND slot=$1`,
    [slot, JSON.stringify(squad), JSON.stringify(youth)]);
  const man = (name, age, rating) => ({ name, age, rating, skills: { power: 40 }, wage: 900 });
  const boy = (name, age, rating) => ({ name, age, rating, colt: true, promise: 70, skills: { power: 30 }, wage: 300 });

  // A PROFESSIONAL AGES, AND AT THIRTY-EIGHT HE IS DONE
  await seat(5, [man('Veteran', 37, 3000), man('Kid', 22, 3000), man('Middle', 30, 3000)], []);
  const r1 = await ageYouth(pool, 'eng', 5101);
  assert.equal(r1.skipped, false);
  assert.ok(r1.retired >= 1, 'somebody hung them up');
  const s5 = (await pool.query(`SELECT squad FROM clubs WHERE country_id='eng' AND slot=5`)).rows[0].squad;
  assert.ok(!s5.some(p => p.name === 'Veteran'), 'the thirty-seven-year-old turned thirty-eight and retired');
  assert.equal(s5.find(p => p.name === 'Kid').age, 23, 'and everybody else is a year older');
  assert.equal(s5.find(p => p.name === 'Middle').age, 31);

  // A BOY WHO REACHES TWENTY-ONE WALKS, however good he is and however much
  // room there is. Nothing is promoted behind the manager's back any more - a
  // senior shirt costs a flat fee and is his decision to make or to miss.
  const full = [];
  for (let i = 0; i < 20; i++) full.push(man('Pro' + i, 26, 2000 + i * 10));
  await seat(6, full, [boy('Better', 20, 5000), boy('Worse', 20, 100)]);
  const r2 = await ageYouth(pool, 'eng', 5102);
  const c6 = (await pool.query(`SELECT squad, youth FROM clubs WHERE country_id='eng' AND slot=6`)).rows[0];
  assert.equal(c6.squad.length, 20, 'the staff is still twenty, not twenty-two');
  assert.ok(!c6.squad.some(p => p.name === 'Better'), 'not even the good one was handed a shirt');
  assert.ok(!c6.squad.some(p => p.name === 'Worse'));
  assert.ok(c6.squad.some(p => p.name === 'Pro0'), 'and no professional was moved aside for a boy');
  assert.equal(c6.youth.length, 0, 'both turned twenty-one and left');
  assert.equal(r2.promoted, 0);
  assert.equal(r2.madeWay, 0);
  // released counts the whole country: every twenty-year-old in England walked
  // on the same day, and these two are among them
  assert.ok(r2.released >= 2, "this club's two, and the rest of the nation's");

  // ROOM UNDER THE CAP CHANGES NOTHING: he still walks
  await seat(7, [man('One', 25, 2000)], [boy('Ready', 20, 50)]);
  const r3 = await ageYouth(pool, 'eng', 5103);
  const c7 = (await pool.query(`SELECT squad, youth FROM clubs WHERE country_id='eng' AND slot=7`)).rows[0];
  assert.equal(c7.squad.length, 1, 'an empty staff is no reason to hand out a shirt');
  assert.equal(c7.youth.length, 0, 'he reached twenty-one and was gone');
  assert.equal(r3.madeWay, 0);
  assert.ok(r3.released >= 1);

  // AND A ROLLOVER ALREADY WORKED IS NEVER WORKED AGAIN
  const again = await ageYouth(pool, 'eng', 5103);
  assert.equal(again.skipped, true);
  const s7b = (await pool.query(`SELECT squad FROM clubs WHERE country_id='eng' AND slot=7`)).rows[0].squad;
  assert.deepEqual(s7b.map(p => p.age), c7.squad.map(p => p.age), 'nobody aged twice');

  // THE WHOLE POINT: season after season, a squad does not run away
  await seat(8, [man('A', 24, 2000), man('B', 25, 2100)], []);
  for (let s = 0; s < 12; s++) {
    await pool.query(`UPDATE clubs SET youth=$1::jsonb WHERE country_id='eng' AND slot=8`,
      [JSON.stringify([boy('Colt' + s + 'a', 20, 4000), boy('Colt' + s + 'b', 20, 4000)])]);
    await ageYouth(pool, 'eng', 5200 + s);
  }
  const s8 = (await pool.query(`SELECT squad FROM clubs WHERE country_id='eng' AND slot=8`)).rows[0].squad;
  assert.ok(s8.length <= 20, 'twelve seasons of intake and the staff is still ' + s8.length + ', not 26');
  assert.ok(s8.every(p => p.age < 38), 'and nobody is still playing at thirty-eight');
});
