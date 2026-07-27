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
import { initWorld } from '../init-world.mjs';
import { makeHost } from '../enginehost.mjs';
import { runAllDue, runCupWindow, rollSeasons, runTick, computeLeague, rebuildHonours, computeRankings, runFriendlies } from '../tick.mjs';
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
  assert.equal(lg.champion, null, 'no champion until 18 rounds');
  const H = await rebuildHonours(pool);
  assert.deepEqual(H.seasons, {}, 'the honours book stays empty until a season completes');
});

test('010: the world rankings ladder moves with results, zero-sum, rename-proof', async () => {
  const rk = await computeRankings(pool, EPOCH + 102 * DAY);
  assert.equal(rk.clubs.length, 190, 'every club in the world is ranked');
  assert.equal(rk.countries.length, 19, 'every country is ranked');
  // only England's round 1 is banked in this run: exactly ten clubs have played
  const played = rk.clubs.filter(c => c.p > 0);
  assert.equal(played.length, 10);
  played.forEach(c => assert.equal(c.country, 'eng'));
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
  // your own club is not an opponent
  await assert.rejects(as(U1, `SELECT public.world_friendly_challenge('eng', 1)`), /your own club/);
  // a bot club accepts on the spot
  const bot = await as(U1, `SELECT public.world_friendly_challenge('ire', 3) AS r`);
  assert.equal(bot.rows[0].r.status, 'accepted');
  assert.ok(bot.rows[0].r.playAtMs > 0, 'scheduled at the next hour');
  assert.equal(bot.rows[0].r.humanOpponent, false);
  // a human must answer for themselves: U2 (Orange Club, eng slot 2)
  const hum = await as(U1, `SELECT public.world_friendly_challenge('eng', 2) AS r`);
  assert.equal(hum.rows[0].r.status, 'offered');
  assert.equal(hum.rows[0].r.humanOpponent, true);
  await assert.rejects(as(U1, `SELECT public.world_friendly_respond($1, true)`, [hum.rows[0].r.id]), /not yours to answer/);
  const acc = await as(U2, `SELECT public.world_friendly_respond($1, true) AS r`, [hum.rows[0].r.id]);
  assert.equal(acc.rows[0].r.status, 'accepted');
  await assert.rejects(as(U2, `SELECT public.world_friendly_respond($1, true)`, [hum.rows[0].r.id]), /already accepted/);
  // the umpire plays both when their hour strikes - real engine, real result
  const played = await runFriendlies(pool, host, { now: Date.now() + 3 * 3600000 });
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
  const again = await as(U1, `SELECT public.world_friendly_challenge('eng', 2) AS r`);
  const dec = await as(U2, `SELECT public.world_friendly_respond($1, false) AS r`, [again.rows[0].r.id]);
  assert.equal(dec.rows[0].r.status, 'declined');
  const mine = await as(U1, `SELECT public.world_my_friendlies() AS f`);
  const list = mine.rows[0].f;
  assert.ok(list.length >= 3);
  assert.ok(list.some(x => x.status === 'played' && x.text), 'played friendlies carry their result');
  assert.ok(list.some(x => x.status === 'declined'), 'the declined one is on record');
  // friendlies never touch the league record
  const lg = await computeLeague(pool, 'eng', 1, EPOCH + 102 * DAY);
  assert.equal(lg.roundsPlayed, 1, 'league untouched by friendlies');
});
