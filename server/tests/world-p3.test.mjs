// tests/world-p3.test.mjs — P3/P4/P5 proof obligations on a real Postgres.
//   P3: the write surface self-authorizes (boss unclaimable, one club per
//       manager, double-claim rejected) and a claimant's orders genuinely
//       steer the engine (their chosen opener opens).
//   P4: after a full 18-round planet season, the cup window plays the
//       Champions Cup of clubs on the real engine - play-ins through final,
//       idempotently - and crowns a champion in the snapshot.
//   P5: national squads assemble from real club players and the World Cup
//       of nations plays to a champion the same way.
//   Seasons roll: season 2 begins at start_day + 25 in every nation.
// The 18-round planet season is ~1,700 real engine matches; this file runs
// in minutes, not seconds, and that is the point - it is the whole world.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld, countryConfigs } from '../init-world.mjs';
import { makeHost } from '../enginehost.mjs';
import { runAllDue, runCupWindow, rollSeasons, runTick, computeLeague, rebuildHonours, computeRankings, runFriendlies, settleMoney } from '../tick.mjs';
import { evolveCountry, applyLiving, livingPatch } from '../living.mjs';
import { EPOCH, DAY } from '../clock.mjs';

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

test('P3: the boss is unclaimable, one club per manager, no double claims', async () => {
  await assert.rejects(as(U1, `SELECT public.world_claim_club('eng', 0, 'Usurper')`), /never claimable/);
  const ok = await as(U1, `SELECT public.world_claim_club('eng', 1, 'Santosh') AS r`);
  assert.equal(ok.rows[0].r.ok, true);
  assert.equal(ok.rows[0].r.club, 'Yorkshire');
  await assert.rejects(as(U1, `SELECT public.world_claim_club('ire', 2, 'Santosh')`), /already manage/);
  await assert.rejects(as(U2, `SELECT public.world_claim_club('eng', 1, 'Rival')`), /already has a manager/);
  await assert.rejects(pool.query(`SELECT public.world_claim_club('eng', 2, 'Nobody')`), /sign in/);
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
  assert.equal(res.played, 5);
  const m = (await pool.query(
    `SELECT orders, result FROM matches WHERE country_id='eng' AND season_no=1 AND round=1 AND (home_slot=1 OR away_slot=1)`)).rows[0];
  assert.ok(m.orders.Yorkshire, 'the submitted orders were attached to the match');
  const inn = m.result.innings.find(i => i.batTeam === 'Yorkshire');
  assert.ok(inn, 'Yorkshire batted');
  const openers = inn.bat.slice(0, 2).map(b => (b.p && b.p.name) || b.p);
  assert.ok(openers.includes(xi[0]), 'the chosen opener opened: ' + openers.join(', ') + ' vs ' + xi[0]);
});

test('P4+P5: a full planet season, then the cup window crowns two champions', async () => {
  // settle all 18 rounds everywhere (round 1 for eng already played above)
  const allDone = EPOCH + (101 + 18) * DAY + 2 * 3600000;   // day 119, 02:00 - every window closed
  await runAllDue(pool, host, { now: allDone });
  const n = await pool.query('SELECT count(*)::int AS n FROM matches');
  assert.equal(n.rows[0].n, 19 * 90, 'the whole season: 19 nations x 90 matches');

  // before any stage window has closed: nothing plays
  const early = await runCupWindow(pool, host, { now: allDone });
  assert.equal((early.s1.wcl || []).length, 0, 'no cup stage before its window closes');
  const cm0 = await pool.query('SELECT count(*)::int AS n FROM cup_matches');
  assert.equal(cm0.rows[0].n, 0);

  // after the final's window (start_day+22 at 24:00): everything settles in one call
  const cupDone = EPOCH + (101 + 23) * DAY + 1 * 3600000;
  const cups = await runCupWindow(pool, host, { now: cupDone });
  const wcl = cups.s1.wcl.filter(x => !x.skipped), wc = cups.s1.wc.filter(x => !x.skipped);
  assert.deepEqual(wcl.map(x => x.stage), ['pi', 'r16', 'qf', 'sf', 'final']);
  assert.deepEqual(wc.map(x => x.stage), ['r16', 'qf', 'sf', 'final']);
  const cm = await pool.query(`SELECT comp, count(*)::int AS n FROM cup_matches GROUP BY comp ORDER BY comp`);
  assert.deepEqual(cm.rows, [{ comp: 'wc', n: 15 }, { comp: 'wcl', n: 18 }]);

  const cup = (await pool.query(`SELECT body FROM snapshots WHERE key='cup/s1'`)).rows[0].body;
  assert.ok(cup.champion, 'the Champions Cup has a champion: ' + cup.champion);
  assert.equal(cup.stages.final.length, 1);
  const wcs = (await pool.query(`SELECT body FROM snapshots WHERE key='worldcup/s1'`)).rows[0].body;
  assert.ok(wcs.champion && /XI$/.test(wcs.champion), 'the World Cup champion is a national XI: ' + wcs.champion);

  // P5: national squads are real club players
  const nats = (await pool.query(`SELECT body FROM snapshots WHERE key='nats/s1'`)).rows[0].body;
  assert.equal(Object.keys(nats).length, 19);
  assert.equal(nats.eng.squad.length, 15);
  const engPlayers = new Set((await pool.query(`SELECT jsonb_array_elements(squad)->>'name' AS n FROM clubs WHERE country_id='eng'`)).rows.map(r => r.n));
  nats.eng.squad.forEach(nm => assert.ok(engPlayers.has(nm), nm + ' plays in the England league'));

  // idempotency at cup scale
  const again = await runCupWindow(pool, host, { now: cupDone });
  assert.ok(again.s1.wcl.every(x => x.skipped) && again.s1.wc.every(x => x.skipped), 'cup re-run is a no-op');
  const cm2 = await pool.query('SELECT count(*)::int AS n FROM cup_matches');
  assert.equal(cm2.rows[0].n, 33);

  // the honours book remembers season 1 forever
  const H = await rebuildHonours(pool);
  assert.equal(Object.keys(H.seasons.s1.league).length, 19, 'nineteen league champions in the book');
  assert.ok(H.seasons.s1.championsCup, 'the Champions Cup winner is in the book');
  assert.ok(H.seasons.s1.worldCup, 'the World Cup winner is in the book');
});

test('seasons roll: season 2 begins at start_day + 25 everywhere', async () => {
  const beforeRoll = await rollSeasons(pool, { now: EPOCH + (101 + 23) * DAY });
  assert.equal(beforeRoll.length, 0, 'no rollover before day +25');
  const rolled = await rollSeasons(pool, { now: EPOCH + (101 + 25) * DAY + 3600000 });
  assert.equal(rolled.length, 19);
  const s2 = await pool.query('SELECT count(*)::int AS n, min(start_day) AS d FROM seasons WHERE season_no=2');
  assert.equal(s2.rows[0].n, 19);
  assert.equal(s2.rows[0].d, 126);
  const again = await rollSeasons(pool, { now: EPOCH + (101 + 25) * DAY + 3600000 });
  assert.equal(again.length, 0, 'season 2 already current: nothing further rolls');
  const s2b = await pool.query('SELECT count(*)::int AS n FROM seasons WHERE season_no=2');
  assert.equal(s2b.rows[0].n, 19);
});

test('005: orders lock at the first ball and reveal to spectators', async () => {
  // the latest England season, whatever tests ran before us
  const s = (await pool.query(`SELECT * FROM seasons WHERE country_id='eng' ORDER BY season_no DESC LIMIT 1`)).rows[0];
  const hour = (await pool.query(`SELECT play_hour_utc FROM countries WHERE id='eng'`)).rows[0].play_hour_utc;
  const TEST_ROUND = 9;   // untouched by the season tests either way
  const playMs = EPOCH + (s.start_day + TEST_ROUND - 1) * DAY + hour * 3600000;

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
  // U2 claims Kent (eng slot 7) and names it after their own club
  const ok = await as(U2, `SELECT public.world_claim_club('eng', 7, 'Rival', 'Orange Club') AS r`);
  assert.equal(ok.rows[0].r.club, 'Orange Club');
  const names = (await pool.query(`SELECT slot, name, default_name FROM clubs WHERE country_id='eng' ORDER BY slot`)).rows;
  assert.equal(names.find(n => n.slot === 7).name, 'Orange Club');
  assert.equal(names.find(n => n.slot === 7).default_name, 'Kent');
  assert.equal(names.find(n => n.slot === 3).name, 'Surrey', 'bots keep the counties');
  // taken names bounce, case-insensitively, defaults included
  await assert.rejects(as(U2, `SELECT public.world_rename_club('surrey')`), /already taken/);
  await assert.rejects(as(U2, `SELECT public.world_rename_club('middlesex')`), /already taken/);
  // the record survives any rename: per-slot standings identical before and after
  const before = await computeLeague(pool, 'eng', 1, EPOCH + 130 * DAY);
  await as(U2, `SELECT public.world_rename_club('Tangerine CC')`);
  const after = await computeLeague(pool, 'eng', 1, EPOCH + 130 * DAY);
  const bySlotB = Object.fromEntries(before.table.map(t => [t.slot, t]));
  after.table.forEach(t => {
    assert.equal(t.p, bySlotB[t.slot].p, 'played, slot ' + t.slot);
    assert.equal(t.pts, bySlotB[t.slot].pts, 'points, slot ' + t.slot);
    assert.equal(t.w, bySlotB[t.slot].w, 'wins, slot ' + t.slot);
  });
  assert.equal(after.table.find(t => t.slot === 7).name, 'Tangerine CC', 'the snapshot speaks the current name');
  // releasing the club hands Kent its name back
  await as(U2, `SELECT public.world_release_club()`);
  assert.equal((await pool.query(`SELECT name FROM clubs WHERE country_id='eng' AND slot=7`)).rows[0].name, 'Kent');
});

test('008: signing up auto-claims the first free club; a full country says so', async () => {
  // U2 (released earlier) lands automatically in the first free slot, christened
  const r1 = await as(U2, `SELECT public.world_auto_claim('eng', 'R2', 'Orange Club') AS r`);
  assert.equal(r1.rows[0].r.ok, true);
  assert.equal(r1.rows[0].r.slot, 2);
  assert.equal(r1.rows[0].r.club, 'Orange Club');
  // calling again (any country) hands back the same seat - idempotent
  const r2 = await as(U2, `SELECT public.world_auto_claim('ire', 'R2', 'Second Club') AS r`);
  assert.equal(r2.rows[0].r.existing, true);
  assert.equal(r2.rows[0].r.slot, 2);
  // seven more sign-ups fill England; a clashing name never blocks the seat
  for (let i = 3; i <= 9; i++) {
    const uu = '33333333-3333-4333-8333-3333333333' + String(i).padStart(2, '0');
    const rr = await as(uu, `SELECT public.world_auto_claim('eng', 'M${i}', 'Orange Club') AS r`);
    assert.equal(rr.rows[0].r.ok, true);
    assert.equal(rr.rows[0].r.slot, i);
    assert.notEqual(rr.rows[0].r.club, 'Orange Club', 'a taken name falls back to the county');
  }
  // the tenth manager is told the country is full...
  await assert.rejects(
    as('44444444-4444-4444-8444-444444444444', `SELECT public.world_auto_claim('eng', 'Late', 'Latecomer CC')`),
    /full - every club there already has a manager/);
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
  // the law, not the day: a champion exists exactly when the 18 rounds are
  // done - stated so it holds whether this run has played one round or all
  assert.equal(lg.champion, lg.roundsPlayed >= 18 ? lg.table[0].name : null,
    'a champion at 18 rounds, never a ball before');
  const H = await rebuildHonours(pool);
  const anyComplete = (await pool.query(
    `SELECT 1 FROM matches GROUP BY country_id, season_no HAVING count(*) >= 90 LIMIT 1`)).rowCount;
  if (!anyComplete) assert.deepEqual(H.seasons, {}, 'the honours book stays empty until a season completes');
  else assert.ok(H.seasons.s1 && Object.keys(H.seasons.s1.league).length,
    'a completed season is written into the book');
});

test('010: the world rankings ladder moves with results, zero-sum, rename-proof', async () => {
  const rk = await computeRankings(pool, EPOCH + 102 * DAY);
  assert.equal(rk.clubs.length, 190, 'every club in the world is ranked');
  assert.equal(rk.countries.length, 19, 'every country is ranked');
  // every club that has played is on the ladder; when only England's round 1
  // is banked that is exactly its ten, and this run says so
  const played = rk.clubs.filter(c => c.p > 0);
  assert.ok(played.length >= 10, 'the clubs that have played are ranked: ' + played.length);
  if (played.length === 10) played.forEach(c => assert.equal(c.country, 'eng', 'only England has played'));
  // winners rose, losers fell, ties held
  played.forEach(c => {
    if (c.w === 1 && c.l === 0 && c.t === 0) assert.ok(c.rating > 1000, c.name + ' won and rose');
    if (c.l === 1 && c.w === 0 && c.t === 0) assert.ok(c.rating < 1000, c.name + ' lost and fell');
  });
  // Elo is zero-sum: the world's points are conserved
  const total = rk.clubs.reduce((s, c) => s + c.rating, 0);
  assert.ok(Math.abs(total - 190000) <= 190, 'points conserved (rounding aside): ' + total);
  // ranks are 1..190 and sorted by rating
  assert.equal(rk.clubs[0].rank, 1);
  assert.ok(rk.clubs[0].rating >= rk.clubs[189].rating);
  // ratings key by slot: a rename moves the name, never the points
  const before7 = rk.clubs.find(c => c.country === 'eng' && c.slot === 7);
  await pool.query(`UPDATE clubs SET name='Renamed CC' WHERE country_id='eng' AND slot=7`);
  const rk2 = await computeRankings(pool, EPOCH + 102 * DAY);
  const after7 = rk2.clubs.find(c => c.country === 'eng' && c.slot === 7);
  assert.equal(after7.rating, before7.rating, 'the rating survived the rename');
  assert.equal(after7.name, 'Renamed CC', 'the ladder speaks the current name');
  await pool.query(`UPDATE clubs SET name=default_name WHERE country_id='eng' AND slot=7`);
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
  // a human must answer for themselves: U2 (Orange Club, eng slot 2)
  const hum = await as(U1, `SELECT public.world_friendly_challenge('eng', 2, $1) AS r`, [PLAY]);
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
  const again = await as(U1, `SELECT public.world_friendly_challenge('eng', 2, $1) AS r`, [Date.now() + 4 * 3600000]);
  const dec = await as(U2, `SELECT public.world_friendly_respond($1, false) AS r`, [again.rows[0].r.id]);
  assert.equal(dec.rows[0].r.status, 'declined');
  const mine = await as(U1, `SELECT public.world_my_friendlies() AS f`);
  const list = mine.rows[0].f;
  assert.ok(list.length >= 3);
  assert.ok(list.some(x => x.status === 'played' && x.text), 'played friendlies carry their result');
  assert.ok(list.some(x => x.status === 'declined'), 'the declined one is on record');
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
  const off = await as(U1, `SELECT public.world_friendly_challenge('eng', 3, $1) AS r`, [T2]);
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
  const off = await as(U1, `SELECT public.world_friendly_challenge('eng', 2, $1) AS r`, [Date.now() + 6 * 3600000]);
  await assert.rejects(pool.query(`SELECT public.world_friendly_detail($1)`, [off.rows[0].r.id]), /this friendly is offered/);
  await assert.rejects(pool.query(`SELECT public.world_friendly_detail(999999)`), /no such friendly/);
});

test('014: the living player - careers, form, tired legs, all from the record', async () => {
  const sq = () => pool.query(`SELECT squad FROM clubs WHERE country_id='eng' AND slot=1`).then(r => r.rows[0].squad);
  const before = await sq();
  assert.ok(before.length >= 11);
  // rounds have been played above, so the men have lives by now
  await evolveCountry(pool, 'eng', EPOCH + 130 * DAY);
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
  await evolveCountry(pool, 'eng', EPOCH + 130 * DAY, host);
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
  // give England a few more rounds so the season has genuinely worn the men
  // (already-settled days are no-ops - the umpire never replays a round)
  for (const day of [102, 103, 104]) {
    await runTick(pool, host, 'eng', day, { now: EPOCH + day * DAY + 18 * 3600000 });
  }
  // a LATE match, played by men a whole season of cricket had already worn
  const m = (await pool.query(
    `SELECT id, seed, round, home_name, away_name, home_slot, away_slot, orders, living, result_canonical
       FROM matches WHERE country_id='eng' AND season_no=1 AND living IS NOT NULL
       ORDER BY round DESC, home_slot LIMIT 1`)).rows[0];
  assert.ok(m, 'a banked match with its living patch');
  assert.ok(m.round >= 3, 'late enough that the season has left a mark: round ' + m.round);
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
  const cfg = countryConfigs(host).filter(c => c.id === 'eng')[0];
  const bossSlot = cfg.clubs.filter(c => c.boss)[0].slot;
  const squadOf = slot => host.genSquad('world1|eng|' + slot, cfg.nat, cfg.arch, slot === bossSlot ? cfg.capt : 'general');
  const replay = host.runMatch(
    { name: m.home_name, players: applyLiving(squadOf(m.home_slot), m.living[m.home_name], host) },
    { name: m.away_name, players: applyLiving(squadOf(m.away_slot), m.living[m.away_name], host) },
    'balanced', Number(m.seed), m.orders);
  assert.equal(facts(replay), facts(m.result_canonical), 'the broadcast is the match the world recorded');

  // and the patch is what makes it so: the pristine generated squads, same
  // seed, same orders, play a DIFFERENT match
  const naive = host.runMatch({ name: m.home_name, players: squadOf(m.home_slot) },
    { name: m.away_name, players: squadOf(m.away_slot) }, 'balanced', Number(m.seed), m.orders);
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
    const day = seas.start_day + next - 1;
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
  await evolveCountry(pool, 'eng', EPOCH + 130 * DAY, host);
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
  assert.equal(money.length, 10);
  money.forEach(m => assert.ok(Number.isFinite(Number(m.bank)), 'club ' + m.slot + ' has a treasury'));
  assert.ok(money.every(m => Number(m.bank) > 0), 'nobody has been bankrupted by a fortnight of cricket');
  const beforeBank = Number(money.find(m => m.slot === 1).bank);
  await settleMoney(pool, 'eng');
  const afterBank = Number((await pool.query(
    `SELECT bank FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].bank);
  assert.equal(afterBank, beforeBank, 'settling twice settles the same figure');

  // your own status carries all three home
  const st = await as(U1, `SELECT public.world_my_status() AS s`);
  const s = st.rows[0].s;
  assert.deepEqual(s.training, plan);
  assert.equal(s.identity.crest, 'YO');
  assert.ok(Number(s.bank) > 0);
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
