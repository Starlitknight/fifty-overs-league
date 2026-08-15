// tests/world-nations.test.mjs — THE INTERNATIONAL GAME, proved.
//
// The obligations of the national-teams wave, in the order a season meets
// them:
//   1. the selectors are a pure function of the men, and they will not gut a
//      club: fifteen, a keeper, bowlers, three from any one side at most;
//   2. the squad is named ONCE - a re-run of the window picks nobody new;
//   3. a called-up man genuinely misses his club's round, and the absence
//      rides in the banked living patch so a broadcast fields the same
//      eleven the umpire did;
//   4. a manager's sheet naming him is COVERED, not torn up: the twelfth man
//      bats in his place and the rest of the sheet stands;
//   5. the club is paid for him, in the books' own walk from genesis;
//   6. the nations play each other on the real engine, idempotently, and the
//      caps are real caps that tire the legs and move the form.
// A real Postgres and the real shipped engine throughout.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld } from '../init-world.mjs';
import { makeHost, ENGINE_VERSION } from '../enginehost.mjs';
import { runDue, computeRankings } from '../tick.mjs';
import { computeFinance } from '../economy.mjs';
import { applyLiving, livingPatch } from '../living.mjs';
import {
  SQUAD_SIZE, CLUB_LIMIT, FEE_SENIOR, FEE_U21, U21_AGE, feeFor, isBowler,
  selectSquad, selectionScore, coverSheet, seasonTourPlan, SERIES_LEN, HALF_WINDOWS,
  nextTourOf, natMatchId,
  ensureCallups, absentBySlot, squadPlayers, seasonSquad, runWindows, natSquadNow,
  computeNations, windowsOn, touringOn
} from '../nations.mjs';
import { EPOCH, DAY, WINDOWS, WINDOW_DAYS, INTL_HOUR, isWindowRound, windowDayOfRound, dayOfRound } from '../clock.mjs';

const DBNAME = 'foworld_nations_test';
let pool, host;
const START = 101;                                   // season 1, day 101 = round 1
const T0 = EPOCH + 100 * DAY + 12 * 3600000;
// The tour is played on a REST DAY - day 3 of the season - and the men it takes
// are missing from their clubs' NEXT round, which is round 4.
const WIN_ROUND = WINDOWS[0];                        // round 4
const WIN_DAY = START + WINDOW_DAYS[0];              // world day 104, the rest day
const WIN_ROUND_DAY = START + dayOfRound(WIN_ROUND); // world day 105, when the clubs play it
const U1 = '11111111-1111-4111-8111-111111111111';
// THE PROTAGONIST IS WHOEVER THE CALENDAR SENDS FIRST: the away side of
// season one's first first-half series - the tests follow the fixture list
// rather than assuming England always tours.
const IDS16 = ['afg', 'aus', 'bgd', 'eng', 'ire', 'ned', 'nep',
  'nzl', 'pak', 'rsa', 'sco', 'slk', 'sub', 'usa', 'win', 'zim'];
const P1 = seasonTourPlan(1, IDS16);
const H0 = P1.series.filter(t => t.hIx === 0);
const TC = H0[0].away;                               // the touring protagonist

const atDay = (day, hour) => EPOCH + day * DAY + hour * 3600000;

async function as(user, sql, params, nowMs) {
  const c = await pool.connect();
  try {
    await c.query(`SELECT set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: user })]);
    if (nowMs != null) await c.query(`SELECT set_config('world.now_ms', $1, false)`, [String(nowMs)]);
    return await c.query(sql, params);
  } finally {
    await c.query(`SELECT set_config('request.jwt.claims', '', false)`).catch(() => {});
    await c.query(`SELECT set_config('world.now_ms', '', false)`).catch(() => {});
    c.release();
  }
}

// ---- the selectors, as pure arithmetic ------------------------------------
const man = (name, slot, extra = {}) => ({ name, slot, age: 27, rating: 30000, formIx: 3, ...extra });

test('the selectors: fifteen, a keeper, bowlers, and never more than three from a club', () => {
  const men = [];
  for (let slot = 0; slot < 10; slot++) {
    for (let i = 0; i < 15; i++) {
      men.push(man('c' + slot + 'p' + i, slot, {
        rating: 40000 - slot * 10 - i,                 // club 0 is the strongest, top to bottom
        bowlType: i % 3 === 0 ? 'seamFast' : '',
        keeper: i === 14
      }));
    }
  }
  const xv = selectSquad(men);
  assert.equal(xv.length, SQUAD_SIZE);
  assert.equal(new Set(xv.map(p => p.name)).size, SQUAD_SIZE, 'no man picked twice');
  assert.ok(xv.some(p => p.keeper), 'a nation without a keeper has no team');
  assert.ok(xv.filter(isBowler).length >= 5, 'a side that cannot bowl fifty overs is not a side');
  const per = {};
  xv.forEach(p => { per[p.slot] = (per[p.slot] || 0) + 1; });
  Object.values(per).forEach(n => assert.ok(n <= CLUB_LIMIT, 'no club loses more than ' + CLUB_LIMIT));
  // and it is a pure function: the same men, shuffled, give the same fifteen
  const again = selectSquad(men.slice().reverse());
  assert.deepEqual(again.map(p => p.name).sort(), xv.map(p => p.name).sort());
});

test('a thin club is not thinned further: the floor beats the limit', () => {
  const men = [];
  for (let slot = 0; slot < 10; slot++) {
    // club 0 has been ravaged by retirements and is down to thirteen
    const n = slot === 0 ? 13 : 15;
    for (let i = 0; i < n; i++) {
      men.push(man('c' + slot + 'p' + i, slot, {
        rating: slot === 0 ? 60000 - i : 40000 - i,          // and yet it holds the best men in the land
        bowlType: i % 3 === 0 ? 'seamFast' : '', keeper: i === n - 1
      }));
    }
  }
  const per = {};
  selectSquad(men).forEach(p => { per[p.slot] = (per[p.slot] || 0) + 1; });
  assert.equal(per[0], 1, 'thirteen men, twelve stay: the country may have one of them');
  assert.ok(Object.keys(per).length > 1, 'and the rest of the fifteen comes from everywhere else');
});

test('the selectors read form, not just the card', () => {
  const flat = man('steady', 1, { rating: 30000, formIx: 3 });
  const hot = man('in nick', 2, { rating: 29000, formIx: 6 });
  const cold = man('out of nick', 3, { rating: 30500, formIx: 0 });
  assert.ok(selectionScore(hot) > selectionScore(flat), 'form lifts a man');
  assert.ok(selectionScore(cold) < selectionScore(flat), 'and it drops one');
});

test('the fee is the board rate, and a boy is cheaper', () => {
  assert.equal(feeFor(27), FEE_SENIOR);
  assert.equal(feeFor(U21_AGE), FEE_SENIOR);
  assert.equal(feeFor(U21_AGE - 1), FEE_U21);
  assert.equal(FEE_SENIOR, 50000);
  assert.equal(FEE_U21, 20000);
});

test('the tour calendar: four three-game series a season, half the world touring, half at rest', () => {
  const p1 = seasonTourPlan(1, IDS16), p2 = seasonTourPlan(1, IDS16.slice().reverse());
  assert.deepEqual(p1, p2, 'the calendar is a function of the season, not of the row order');
  assert.equal(p1.series.length, 4, 'four tours a season');
  assert.equal(p1.series.filter(t => t.hIx === 0).length, 2, 'two in the first half of the season');
  assert.equal(p1.series.filter(t => t.hIx === 1).length, 2, 'and two in the second');
  for (const t of p1.series) {
    assert.deepEqual(t.windows, HALF_WINDOWS[t.hIx], 'a series is three games over its half\'s three tour days');
    assert.equal(t.windows.length, SERIES_LEN);
    assert.equal(t.host, t.home, 'the second nation of a pair hosts: A tour of B');
  }
  const touring = p1.series.flatMap(t => t.teams);
  assert.equal(touring.length, 8, 'eight nations tour');
  assert.equal(new Set(touring).size, 8, 'each of them once');
  assert.equal(p1.resting.length, 8, 'and eight rest the season entirely');
  assert.deepEqual(touring.concat(p1.resting).sort(), IDS16.slice().sort(), 'together they are the world');

  // THE ROTATION: next season the resting eight tour and the tourists rest,
  // so every nation tours exactly once per two playable seasons
  const p2s = seasonTourPlan(2, IDS16);
  assert.deepEqual(p2s.series.flatMap(t => t.teams).sort(), p1.resting.slice().sort(),
    'season two sends the resting half on the road');
  assert.deepEqual(p2s.resting.slice().sort(), touring.slice().sort(),
    'and rests the half that toured');
  // a new cycle is a new draw
  assert.notDeepEqual(seasonTourPlan(3, IDS16).series, p1.series,
    'cycle two deals different matchups - the flavour changes by the season');
  // the World Cup year suspends the rotation rather than skipping anybody
  assert.equal(seasonTourPlan(4, IDS16).series.length, 0, 'no bilateral tours in a World Cup year');
  const s5 = seasonTourPlan(5, IDS16).series.flatMap(t => t.teams).sort();
  assert.deepEqual(s5, seasonTourPlan(3, IDS16).resting.slice().sort(),
    'season five resumes where the cycle left off');
  // every nation can be told its next tour, seasons ahead, offline
  for (const id of IDS16) {
    const nt = nextTourOf(id, 1, IDS16);
    assert.ok(nt && nt.seasonNo <= 2, id + ' tours within the first cycle');
  }
  // an odd world rests its odd man out - nobody is ever half-scheduled
  const odd = seasonTourPlan(1, IDS16.concat(['oma']));
  const all = odd.series.flatMap(t => t.teams);
  assert.equal(all.length % 2, 0, 'every series has two whole nations');
  assert.equal(all.length + odd.resting.length, 17, 'and the world still adds up');
});

// ---- the twelfth man ------------------------------------------------------
function sheetWorld() {
  const squad = [];
  for (let i = 0; i < 15; i++) {
    squad.push(man('p' + i, 1, { rating: 40000 - i * 100, bowlType: i < 6 ? 'seamFast' : '' }));
  }
  const xi = squad.slice(0, 11).map(p => p.name);
  const orders = {
    xi, batOrder: xi, bat: xi, captain: xi[0], keeper: xi[10],
    spells: { north: [{ bowler: 'p0', first: 1, n: 5, field: 'att' }], south: [{ bowler: 'p1', first: 2, n: 5, field: 'att' }] }
  };
  return { squad, orders };
}

test('the twelfth man: a sheet naming a called-up man is covered, not torn up', () => {
  const { squad, orders } = sheetWorld();
  const gone = [squad[3]];                             // a bowler, third in the order
  const present = squad.filter(p => p.name !== gone[0].name);
  const out = coverSheet(orders, present, gone);
  assert.ok(out, 'the sheet survives');
  assert.equal(out.xi.length, 11);
  assert.ok(!out.xi.includes('p3'), 'the absentee is off the sheet');
  assert.equal(out.xi[3], 'p11', 'and the best available bowler bats in his place');
  assert.deepEqual(out.xi.filter(n => n !== 'p11'), orders.xi.filter(n => n !== 'p3'),
    'every other name stands exactly where the manager put it');
  assert.equal(out.captain, orders.captain, 'the captain is untouched');
});

test('the twelfth man takes the missing bowler\'s overs, and the captaincy if it was his', () => {
  const { squad, orders } = sheetWorld();
  const gone = [squad[0]];                             // the captain, and the opening bowler
  const out = coverSheet(orders, squad.slice(1), gone);
  assert.ok(out);
  assert.equal(out.captain, 'p11', 'somebody has to lead');
  assert.equal(out.spells.north[0].bowler, 'p11', 'and somebody has to bowl the new ball');
  assert.equal(out.spells.south[0].bowler, 'p1', 'the other end is undisturbed');
});

test('a sheet that cannot be made legal is handed back to the engine', () => {
  const { squad, orders } = sheetWorld();
  // every bowler in the country is away: no eleven of these men is legal
  const gone = squad.filter(isBowler);
  const present = squad.filter(p => !isBowler(p));
  assert.equal(coverSheet(orders, present, gone), null);
  // and a sheet nobody has taken a man from is returned untouched
  assert.equal(coverSheet(orders, squad, []), orders);
});

test('the living patch carries absence, and applyLiving takes the man off the sheet', () => {
  const { squad } = sheetWorld();
  const patch = livingPatch(squad, new Set(['p3', 'p7']));
  assert.equal(patch.p3.a, true);
  assert.equal(patch.p7.a, true);
  assert.equal(patch.p0.a, undefined);
  const rebuilt = applyLiving(squad.map(p => ({ ...p })), patch);
  assert.equal(rebuilt.length, 13);
  assert.ok(!rebuilt.some(p => p.name === 'p3' || p.name === 'p7'));
});

// ---- the world, played ----------------------------------------------------
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

test('a window falls on a rest day, and robs the round that follows', async () => {
  assert.deepEqual(WINDOWS, [3, 5, 7, 9, 11, 13], 'the rounds the six windows rob');
  assert.deepEqual(WINDOW_DAYS, [2, 5, 9, 12, 16, 19], 'the Wednesdays and Saturdays the tours are played on');
  assert.ok(isWindowRound(WIN_ROUND) && !isWindowRound(WIN_ROUND + 1));
  // no club plays on a window day: that is the point of putting it on the rest
  assert.equal(dayOfRound(WIN_ROUND), WINDOW_DAYS[0] + 1, 'the round is the day after the tour');
  assert.equal(windowDayOfRound(WIN_ROUND), WINDOW_DAYS[0]);
  const w = await windowsOn(pool, WIN_DAY);
  assert.equal(w.length, 16, 'the whole planet is in the window on the same day');
  assert.ok(w.every(x => x.round === WIN_ROUND));
  assert.equal((await windowsOn(pool, WIN_DAY + 1)).length, 0);
});

test('the window: the selectors name a squad, it is banked, and the club loses those men', async () => {
  // three quiet rounds first, so the selectors have some form to read
  await runDue(pool, host, TC, { now: atDay(WIN_DAY - 1, 23) });
  const first = await ensureCallups(pool, TC, 1, WIN_ROUND);
  assert.equal(first.length, SQUAD_SIZE);
  assert.equal(new Set(first.map(r => r.player)).size, SQUAD_SIZE);
  const per = {};
  first.forEach(r => { per[r.slot] = (per[r.slot] || 0) + 1; });
  Object.values(per).forEach(n => assert.ok(n <= CLUB_LIMIT));
  // NAMED ONCE. Asking again gives the same fifteen in the same order, even
  // though a whole round of cricket happens between the two calls.
  const again = await ensureCallups(pool, TC, 1, WIN_ROUND);
  assert.deepEqual(again.map(r => r.player), first.map(r => r.player));

  // THE SHEET. A manager files an eleven that names one of the called-up men;
  // the umpire has to cover him rather than throw the sheet away.
  // seated directly: the claim DOORS only open onto Division Two now (proved
  // in world-conditions), but the cover-sheet law must hold for any managed
  // club - here the club the selectors took their TOP pick from, so the
  // sheet is guaranteed to name a wanted man.
  const claimSlot = first[0].slot;
  await pool.query(
    `INSERT INTO claims(user_id, display_name, country_id, slot) VALUES ($1,'Santosh',$2,$3)`, [U1, TC, claimSlot]);
  const squad = (await pool.query(`SELECT squad FROM clubs WHERE country_id=$1 AND slot=$2`, [TC, claimSlot])).rows[0].squad;
  const takenHere = first.filter(r => r.slot === claimSlot).map(r => r.player);
  assert.ok(takenHere.length >= 1, 'the selectors took at least one man from this club');
  const bowlers = squad.filter(isBowler).map(p => p.name);
  const rest = squad.filter(p => !isBowler(p)).map(p => p.name);
  const xi = Array.from(new Set([...takenHere, ...bowlers, ...rest])).slice(0, 11);
  assert.ok(xi.includes(takenHere[0]), 'the sheet names a man his country wants');
  const sub = await as(U1, `SELECT public.world_submit_orders($1, $2::jsonb) AS r`,
    [WIN_ROUND, JSON.stringify({ xi, batOrder: xi, bat: xi, captain: xi[0] })], atDay(WIN_DAY, 1));
  assert.equal(sub.rows[0].r.ok, true);

  const ran = await runDue(pool, host, TC, { now: atDay(WIN_ROUND_DAY, 23) });
  assert.equal(ran[ran.length - 1].round, WIN_ROUND);

  // THE MEN ARE NOT THERE. Nobody the selectors took appears on his own
  // club's card that round. Checked club by club, because two cricketers in
  // one league can carry the same name and only one of them was called up.
  const ms = (await pool.query(
    `SELECT id, home_slot, away_slot, home_name, away_name, result, living
       FROM matches WHERE country_id=$2 AND season_no=1 AND round=$1`, [WIN_ROUND, TC])).rows;
  assert.equal(ms.length, 8);
  const awayAt = new Map();
  first.forEach(r => {
    if (!awayAt.has(r.slot)) awayAt.set(r.slot, new Set());
    awayAt.get(r.slot).add(r.player);
  });
  for (const m of ms) {
    const slotOf = nm => nm === m.home_name ? m.home_slot : nm === m.away_name ? m.away_slot : null;
    for (const inn of (m.result.innings || [])) {
      if (!inn) continue;
      const batting = awayAt.get(slotOf(inn.batTeam)) || new Set();
      const bowling = awayAt.get(slotOf(inn.bowlTeam)) || new Set();
      (inn.bat || []).forEach(b => {
        const nm = (b.p && b.p.name) || b.p;
        assert.ok(!batting.has(nm), nm + ' was with his country and cannot also bat for his club');
      });
      Object.keys(inn.bowlers || {}).forEach(nm =>
        assert.ok(!bowling.has(nm), nm + ' was with his country and cannot also bowl for his club'));
    }
  }

  // AND THE BROADCAST KNOWS. Absence rides in the banked living patch, so a
  // phone rebuilding the squads from their world seeds drops the same men.
  let marked = 0;
  for (const m of ms) {
    for (const club of Object.keys(m.living || {})) {
      const slot = club === m.home_name ? m.home_slot : m.away_slot;
      const gone = awayAt.get(slot) || new Set();
      for (const [nm, v] of Object.entries(m.living[club])) {
        if (v && v.a) { marked++; assert.ok(gone.has(nm), nm + ' is marked away and was'); }
      }
      for (const nm of gone) assert.ok(m.living[club][nm] && m.living[club][nm].a, nm + ' is marked away');
    }
  }
  assert.equal(marked, SQUAD_SIZE, 'every absentee is marked in the patch, once');

  // THE SHEET WAS COVERED. Yorkshire's banked orders are the manager's, with
  // the missing man replaced - not empty, and not the original.
  const mine = ms.find(m => m.home_slot === claimSlot || m.away_slot === claimSlot);
  const club = (await pool.query(`SELECT name FROM clubs WHERE country_id=$1 AND slot=$2`, [TC, claimSlot])).rows[0].name;
  const filed = (await pool.query(`SELECT orders FROM matches WHERE id=$1`, [mine.id])).rows[0].orders[club];
  assert.ok(filed, 'the sheet was still filed');
  assert.equal(filed.xi.length, 11);
  // EVERY man his country took, not just the first. The selectors may take up
  // to CLUB_LIMIT from one club, and this is the club they took their TOP pick
  // from, so more than one of them can be on the sheet - as happens here. The
  // law is that each one is covered and nobody else is touched, which is a
  // count the sheet itself decides rather than a fixed ten.
  const tookFromXi = xi.filter(n => takenHere.includes(n));
  assert.ok(tookFromXi.length >= 1, 'the sheet named at least one wanted man');
  assert.ok(!filed.xi.some(n => takenHere.includes(n)), 'without any man his country took');
  assert.equal(filed.xi.filter(n => xi.includes(n)).length, 11 - tookFromXi.length,
    'and every other name exactly as written');
});

test('the club is paid for the men it lost, in the books own walk', async () => {
  const rows = (await pool.query(
    `SELECT slot, sum(fee)::int AS paid, count(*)::int AS men FROM callups
      WHERE country_id=$1 AND season_no=1 GROUP BY slot`, [TC])).rows;
  const owed = Object.fromEntries(rows.map(r => [r.slot, r]));
  const fin = await computeFinance(pool, TC);
  let any = 0;
  for (const f of fin) {
    const due = owed[f.slot];
    assert.equal(f.finance.compensation, due ? due.paid : 0, 'club ' + f.slot + ' is paid exactly the board rate');
    assert.equal(f.finance.capsAway, due ? due.men : 0);
    if (due) any++;
  }
  assert.ok(any >= 5, 'the window reached most of the league');
  // settling twice cannot pay twice: the books derive, they never increment
  const again = await computeFinance(pool, TC);
  assert.deepEqual(again.map(f => f.bank), fin.map(f => f.bank));
});

test('the round orders reveal who is away, per club, to any watcher', async () => {
  // asked on the day the CLUBS play the window round - the day after the tour.
  // Orders stay sealed until an hour before the first ball, and that ball is
  // bowled a day later than it used to be.
  const r = await as(U1, `SELECT public.world_round_orders($2, $1) AS j`, [WIN_ROUND, TC], atDay(WIN_ROUND_DAY, 23));
  const j = r.rows[0].j;
  assert.equal(j.window, true);
  const flat = Object.values(j.away).flatMap(o => Object.keys(o));
  assert.equal(flat.length, SQUAD_SIZE);
  // and the living state the theatre reads carries the same absence
  const marked = Object.values(j.living).flatMap(o => Object.entries(o).filter(([, v]) => v && v.a).map(([n]) => n));
  assert.equal(marked.length, SQUAD_SIZE);
  const r2 = await as(U1, `SELECT public.world_round_orders($2, $1) AS j`, [WIN_ROUND + 1, TC], atDay(START + dayOfRound(WIN_ROUND + 1), 23));
  assert.equal(r2.rows[0].j.window, false, 'an ordinary round takes nobody');
  assert.deepEqual(r2.rows[0].j.away, {});
});

test('the nations play each other, on the real engine, once', async () => {
  const now = atDay(WIN_DAY, 23);
  // the rest of the planet reaches its window too
  for (const c of (await pool.query(`SELECT id FROM countries WHERE id <> $1 ORDER BY id`, [TC])).rows) {
    await runDue(pool, host, c.id, { now });
  }
  const played = await runWindows(pool, host, ENGINE_VERSION, { now });
  assert.equal(played.length, 2, 'the opening tour day plays game one of both first-half series');
  assert.equal(played[0], natMatchId(WIN_DAY, 0));
  // and they are the ties the calendar promised, a season in advance -
  // sorted by away side for stable ids
  const promised = H0.slice().sort((a, b) => (a.teams[0] < b.teams[0] ? -1 : 1));
  // idempotent: the same call again plays nothing and breaks nothing
  assert.deepEqual(await runWindows(pool, host, ENGINE_VERSION, { now }), []);
  const ms = (await pool.query('SELECT * FROM nat_matches ORDER BY id')).rows;
  assert.equal(ms.length, 2);
  for (let i = 0; i < 2; i++) {
    assert.equal(ms[i].a_country, promised[i].away, 'the away side is the touring side');
    assert.equal(ms[i].b_country, promised[i].home, 'and the home side is the host');
  }
  for (const m of ms) {
    assert.equal(m.engine_version, ENGINE_VERSION);
    assert.ok(m.result.innings[0].runs > 0, 'a real innings was played');
    assert.deepEqual(JSON.parse(m.result_canonical), m.result, 'the canonical string is the result');
    assert.ok(m.a_name.endsWith(' XI') && m.b_name.endsWith(' XI'));
  }
  // the men who played are the men who were named
  const eng = ms.find(m => m.a_country === TC || m.b_country === TC);
  const named = new Set((await squadPlayers(pool, TC, 1, WIN_ROUND)).map(p => p.name));
  const side = eng.a_country === TC ? eng.a_name : eng.b_name;
  for (const inn of eng.result.innings) {
    if (inn.batTeam !== side) continue;
    (inn.bat || []).forEach(b => assert.ok(named.has((b.p && b.p.name) || b.p), 'only the named fifteen played'));
  }
});

// A TOUR IS WATCHABLE. Every league round and every friendly has banked its
// ball-by-ball beside its card since 045, and that log IS the broadcast: the
// phone reveals one delivery every eighteen seconds from the hour it was
// played. An international was the one competition in the world that banked a
// result and threw the afternoon away, so the live scores page could never say
// more than that the sides were out in the middle.
test('the umpire keeps the afternoon, so a tour can be watched', async () => {
  const ms = (await pool.query('SELECT id, a_country, b_country FROM nat_matches ORDER BY id')).rows;
  assert.ok(ms.length, 'there are tours to watch');
  for (const m of ms) {
    const row = (await pool.query(
      'SELECT country_id, jsonb_array_length(log) n FROM match_logs WHERE match_id=$1', [m.id])).rows[0];
    assert.ok(row, m.id + ' has its commentary banked');
    assert.equal(row.country_id, m.b_country, 'filed under the host, which is the pair the reader asks with');
    assert.ok(row.n > 300, m.id + ' kept a whole afternoon of it: ' + row.n + ' lines');
    // and the reader hands it over to anybody who asks for that pair
    const served = (await pool.query('SELECT world_match_log($1,$2) l', [m.b_country, m.id])).rows[0].l;
    assert.ok(served && served.log && served.log.length === row.n, 'served whole');
    // the deliveries are there, which is what the eighteen-second clock counts
    const balls = served.log.filter(e => e && e.no && !e._top && !e.intro);
    assert.ok(balls.length > 200, 'and it is deliveries, not only prose: ' + balls.length);
    // asked for under the wrong country it is not somebody else's to read
    const wrong = (await pool.query('SELECT world_match_log($1,$2) l', [m.a_country, m.id])).rows[0].l;
    assert.equal(wrong.log, null, 'and only under the country it was filed with');
  }
});

// AND A TOUR IS READABLE AFTERWARDS. The card was the one thing the umpire
// kept back: an international could be watched from the first ball to the last
// and then had nowhere to go - no scorecard, no partnerships, no man of the
// match - because world_nat_match answered with everything about the fixture
// except what happened in it. It serves the card now, under the same law the
// league card lives by (087, after 047): sealed while the broadcast is still
// reading the afternoon out, open the moment it shows the last ball.
test('a tour publishes its fixture and the hour it was bowled, always', async () => {
  const ms = (await pool.query('SELECT id, world_day FROM nat_matches ORDER BY id')).rows;
  assert.ok(ms.length, 'there are tours to read');
  const epoch = Number((await pool.query('SELECT epoch_ms FROM worlds WHERE id=1')).rows[0].epoch_ms);
  for (const m of ms) {
    const j = (await pool.query('SELECT world_nat_match($1) j', [m.id])).rows[0].j;
    assert.ok(j, m.id + ' answers');
    assert.ok(j.a && j.b && j.aCountry && j.bCountry, 'both sides are named');
    // the FIXTURE is always public - it is how the broadcast is addressed -
    // and the VERDICT waits for the window, exactly as a league round's does
    assert.equal(!!j.text, !j.live, 'the verdict answers once the window has shut, and not before');
    // the hour the umpire played it, which is what the seal is measured from
    assert.equal(Number(j.playAtMs), epoch + Number(m.world_day) * 86400000 + 18 * 3600000,
      'the tour hour is published so the reader can pace it');
  }
});

// The seal is arithmetic on the world clock, not a flag, so the only way to
// stand on either side of it is to move the tour's day and put it back.
test('the card opens when the broadcast has shown its last ball, and not before', async () => {
  const m = (await pool.query('SELECT id, world_day FROM nat_matches ORDER BY id LIMIT 1')).rows[0];
  const epoch = Number((await pool.query('SELECT epoch_ms FROM worlds WHERE id=1')).rows[0].epoch_ms);
  const today = Math.floor((Date.now() - epoch) / 86400000);
  const ask = async () => (await pool.query('SELECT world_nat_match($1) j', [m.id])).rows[0].j;
  const move = d => pool.query('UPDATE nat_matches SET world_day=$2 WHERE id=$1', [m.id, d]);
  try {
    // tomorrow: the umpire has not walked out, never mind finished
    await move(today + 1);
    let j = await ask();
    assert.equal(j.card, null, 'a tour still to come has no card to read');
    assert.equal(j.text, null, 'nor a verdict - it is banked early so it can be watched');
    assert.ok(j.a && j.b, 'though the fixture itself answers - that is the door into the broadcast');
    assert.equal(j.live, true, 'and it says so');

    // the day before yesterday: the afternoon was read out long ago
    await move(today - 2);
    j = await ask();
    assert.ok(j.card && j.card.innings && j.card.innings.length,
      'a tour whose reveal has run hands over the innings');
    assert.equal(j.card.text, j.text, 'and the card is the same match as the verdict');
    assert.ok(j.card.winner, 'with the umpire\'s own winner on it');
  } finally {
    await move(m.world_day);
  }
});

// THE WHOLE POINT OF BANKING EARLY. A league round is played an hour before
// its first ball, and that early bank IS the broadcast - the phone reveals the
// umpire's own book one delivery every eighteen seconds from the hour. A tour
// used to be played only once its window had already SHUT, so the ball-by-ball
// did not exist until the match was over: a manager who opened an international
// at the hour found a preview saying "scheduled" and no way in, and by the time
// there was anything to watch the result was already on the scores page.
test('a tour is on the shelf while it is being played, with its result sealed', async () => {
  const m = (await pool.query('SELECT id, world_day FROM nat_matches ORDER BY id LIMIT 1')).rows[0];
  const epoch = Number((await pool.query('SELECT epoch_ms FROM worlds WHERE id=1')).rows[0].epoch_ms);
  const today = Math.floor((Date.now() - epoch) / 86400000);
  const move = d => pool.query('UPDATE nat_matches SET world_day=$2 WHERE id=$1', [m.id, d]);
  try {
    // STAND THE TOUR ON A DAY WHOSE WINDOW IS STILL OPEN. A window shuts three
    // hours after the tour hour, and "today" is only open if the clock has not
    // passed that - so a run late enough in the world day would put the match
    // on the shelf and fail on the truth. The day is chosen against the clock
    // rather than assumed, and the test reads the same at any hour.
    const intoDay = (Date.now() - epoch) % 86400000;
    const day = intoDay < 21 * 3600000 ? today : today + 1;
    await move(day);
    const j = (await pool.query('SELECT world_nat_match($1) j', [m.id])).rows[0].j;
    assert.ok(j.a && j.b, 'the fixture is named');
    assert.equal(j.live, true, 'and it is live');
    assert.equal(j.text, null, 'the verdict is sealed');
    // AND THE BALL-BY-BALL IS THERE, which is the thing that was missing: the
    // reveal has something to read out from the very first ball
    const log = (await pool.query('SELECT world_match_log($1,$2) l', [j.bCountry, m.id])).rows[0].l;
    assert.ok(log && log.log && log.log.length > 300,
      'the umpire\'s whole afternoon is banked and readable while it is on air');
    const balls = log.log.filter(e => e && e.no && !e._top && !e.intro);
    assert.ok(balls.length > 200, 'and it is deliveries, which is what the eighteen-second clock counts');
    // the list is equally discreet
    const row = (await pool.query(
      'SELECT winner, text, live FROM world_nat_matches WHERE id=$1', [m.id])).rows[0];
    assert.equal(row.live, true, 'the list says it is live');
    assert.equal(row.winner, null, 'and gives away neither the winner');
    assert.equal(row.text, null, 'nor the verdict');
  } finally {
    await move(m.world_day);
  }
});

test('a cap is a real cap: its own book, and it is felt at the club', async () => {
  const eng = (await pool.query(
    `SELECT * FROM nat_matches WHERE a_country=$1 OR b_country=$1 LIMIT 1`, [TC])).rows[0];
  const side = eng.a_country === TC ? eng.a_name : eng.b_name;
  const scorers = new Set();
  for (const inn of eng.result.innings) {
    if (inn.batTeam === side) (inn.bat || []).forEach(b => { if ((b.r || 0) > 0) scorers.add((b.p && b.p.name) || b.p); });
  }
  assert.ok(scorers.size, 'somebody scored for their country');
  const squads = (await pool.query(`SELECT slot, squad FROM clubs WHERE country_id=$1`, [TC])).rows;
  const men = squads.flatMap(c => c.squad || []);
  // A MAN'S BOOKS LIVE ON HIS OWN CARD (094) - both of them, the one his club
  // keeps and the one his country does - so this reads them where they are.
  // What is being asserted has not moved: a cap is written back onto the man,
  // onto nobody who was not there, and it does not swell his club career.
  const books = new Map((await pool.query(
    'SELECT pid, career, intl FROM player_history WHERE pid = ANY($1::text[])',
    [men.map(p => p.pid).filter(Boolean)])).rows.map(r => [r.pid, r]));
  const bookOf = p => books.get(p.pid) || { career: {}, intl: {} };
  const capped = men.filter(p => bookOf(p).intl && bookOf(p).intl.m);
  assert.ok(capped.length >= 10, 'the caps are written back onto the men');
  assert.ok(capped.length <= SQUAD_SIZE, 'and onto nobody who was not there');
  for (const p of capped) {
    const b = bookOf(p);
    assert.equal(b.intl.m, 1, 'one tour, one cap');
    assert.ok(!b.career || !b.career.m || b.career.m <= 5, 'and it did not swell his club career');
  }
  const scorer = capped.find(p => scorers.has(p.name));
  assert.ok(scorer && bookOf(scorer).intl.runs > 0, 'his runs for his country are on his own book');
});

test('the ladder and the room read the international game', async () => {
  const rk = await computeRankings(pool, Date.now());
  const played = rk.countries.filter(c => c.natP > 0);
  assert.equal(played.length, 4, 'game one of two series: four nations carry a record');
  // THE LADDER IS STRENGTH; FORM IS THE COLUMN BESIDE IT.
  //
  // This test used to make both claims about natRating, because both were once
  // true of it: the nations table was an average of MATCH MARKS, on the club
  // rating scale, with a 3,500 presumption behind a side that had not toured.
  // It moved off that lens for exactly the reason the club ladder did - a
  // nation's XI has usually played nothing, so every country showed the same
  // neutral base beside its name, and one round of CLUB results was enough to
  // put an associate first in the world and England eleventh.
  //
  // natRating is what the shirt is worth now, and after B2 it is MEASURED
  // rather than declared: the best eleven the country can actually field, three
  // to a club as the selectors cap them, on the same scale as a club's best
  // eleven because it is the same arithmetic. natForm is how a nation has
  // actually been going, and that is the figure the match-mark scale and the
  // presumption belong to.
  //
  // IT USED TO BE A CONSTANT - BASE_XI x nationTeamStr(id), 47,500 down to
  // 41,000 - and that was honest only for as long as badgeUp() scaled a
  // selected side's skills until its XI hit exactly that number. The ranking
  // was reporting a figure the world was being forced to match. B2 retired the
  // badge, because a player must become an international by being good rather
  // than become good by being picked, so the ladder now has to go and look.
  //
  // Which turns the full-member claim below from a tautology into a real
  // result: nothing decrees that England outranks Scotland any more. It comes
  // out of the cricketers the two countries were dealt.
  const squads = (await pool.query(
    `SELECT country_id, slot, squad FROM clubs`)).rows;
  const byCountry = {};
  for (const r of squads) {
    const men = (r.squad || []).filter(p => p && p.rating)
      .sort((a, b) => b.rating - a.rating || (a.name < b.name ? -1 : 1)).slice(0, 3);
    (byCountry[r.country_id] = byCountry[r.country_id] || []).push(...men);
  }
  const bestXi = id => {
    const men = (byCountry[id] || []).sort((a, b) => b.rating - a.rating).slice(0, 11);
    return men.length ? Math.round(men.reduce((t, p) => t + p.rating, 0) / men.length) : 0;
  };
  rk.countries.forEach(c => {
    assert.equal(c.natRating, bestXi(c.id),
      c.id + ' is seated at the eleven it can actually field');
    // rating is the canonical card x 1000, so a national XI lives where a very
    // good club XI lives and above it - never on the match-mark scale
    assert.ok(c.natRating > c.clubRating,
      c.id + ' picks from every club, so its XI beats the mean club: ' +
      c.natRating + ' vs ' + c.clubRating);
  });
  // a full member's shirt outranks an associate's, because a full member's
  // clubs hold better cricketers - not because a table said so
  const fullMin = Math.min(...rk.countries.filter(c => c.full).map(c => c.natRating));
  const assocMax = Math.max(...rk.countries.filter(c => !c.full).map(c => c.natRating));
  assert.ok(fullMin > assocMax, 'the full members sit above the associates: ' + fullMin + ' vs ' + assocMax);
  assert.deepEqual(rk.countries.map(c => c.rank), rk.countries.map((_, i) => i + 1), 'the table is ranked');
  // and the FORM column is the one the cricket moves
  assert.ok(rk.countries.every(c => c.natForm >= 350 && c.natForm <= 6790),
    'every form mark is on the match rating scale');
  assert.ok(played.some(c => c.natForm !== 3500), 'and it moved for the nations that played');
  assert.ok(rk.countries.filter(c => c.natP === 0).every(c => c.natForm === 3500),
    'a nation whose tour is still to come sits on the presumption');

  const na = await computeNations(pool, atDay(WIN_DAY, 23));
  assert.deepEqual(na.windows, WINDOWS);
  assert.equal(na.hourUtc, INTL_HOUR);
  assert.equal(na.seriesLen, SERIES_LEN);
  // THE CALENDAR IS SERVED: the whole season's series, resolved to names, and
  // every nation told its own - so a phone can print "India tour of Australia,
  // games after rounds 9, 11 and 13" without inventing a word of it
  assert.equal(na.calendar.seasonNo, 1);
  assert.equal(na.calendar.series.length, 4);
  assert.equal(na.calendar.resting.length, 8);
  for (const t of na.calendar.series) {
    assert.equal(t.rounds.length, SERIES_LEN, 'a series names its three game rounds');
    assert.ok(t.title.indexOf(' tour of ') > 0, 'and reads like a tour');
  }
  const e = na.nations[TC];
  assert.ok(e.tour, 'the touring nation knows its series');
  assert.deepEqual(e.tour.rounds, HALF_WINDOWS[0].map(w => WINDOWS[w]));
  assert.equal(e.tour.series.played, 1, 'one game of it is banked');
  assert.ok(e.tour.series.verdict, 'and the series score is said in words');
  assert.equal(e.window, WIN_ROUND);
  assert.equal(e.squad.length, SQUAD_SIZE);
  assert.ok(e.squad.every(m => m.club && m.fee > 0), 'every man names his club and his fee');
  // the men who FLEW are the ones the caps book answers for. (This used to
  // count capped men in the STANDING squad and lean on the selectors keeping
  // most of the touring party - true when every match was played in identical
  // conditions, but real weather and real pitches churn form and therefore
  // selection. The tour party is the invariant: the eleven-plus who took the
  // field are capped, and somebody who carried the drinks is not.)
  assert.ok(e.tourSquad.filter(m => m.caps === 1).length >= 11,
    'the eleven who played have a cap');
  assert.ok(e.tourSquad.some(m => !m.caps),
    'and a squad man who watched does not');
  assert.ok(e.caps.length, 'the caps book is populated');
  assert.ok(Object.keys(e.record || {}).length >= e.caps.length,
    'and the same book is keyed by name, for a page that wants one man');
  const top = e.caps[0];
  assert.deepEqual(e.record[top.name], top, 'the two agree exactly');
  assert.equal(e.tours.length, 1);
  assert.equal(e.compensation.reduce((s, c) => s + c.paid, 0),
    e.tourSquad.reduce((s, m) => s + (m.fee || 0), 0),
    'what the board paid the clubs is exactly what the touring party cost');

  // A RESTING NATION is told so, and told when its cricket comes
  const eng = na.nations.eng;
  assert.equal(eng.tour, null, 'England rest in season one');
  assert.ok(eng.nextTour && eng.nextTour.seasonNo === 2, 'and know their season-two series');
  assert.ok(eng.nextTour.title.indexOf('England') > 0, 'by name');
});

test('the World Cup side is the side as it stands', async () => {
  // IT USED TO BE THE SIDE THAT TOURED, because a squad was only ever named at
  // a window and the last window's fifteen was the only current thing there
  // was. The selectors sit between every round now, so by the World Cup they
  // have met many times since the last tour - on the form the tour itself
  // produced, among others. The side that goes is the side they last named.
  const wc = await seasonSquad(pool, 'eng', 1);
  const now = await natSquadNow(pool, 'eng', 1);
  assert.deepEqual(wc.map(p => p.name), now.squad.map(m => m.name),
    'the men their selectors last named are the men who go to the World Cup');

  // and it is still a REAL banked selection, not a fresh pick at draw time:
  // every man is on a club's books and the fifteen can take the field
  assert.equal(wc.length, SQUAD_SIZE);
  assert.ok(wc.some(p => p.keeper), 'somebody keeps wicket');
  assert.ok(wc.filter(isBowler).length >= 5, 'and five men can bowl');

  // the tour squad is still exactly what it was - naming a side afterwards
  // does not rewrite who actually flew
  const toured = (await squadPlayers(pool, TC, 1, WIN_ROUND)).map(p => p.name);
  assert.equal(toured.length, SQUAD_SIZE, 'the window squad is untouched');
});

test('an ordinary round takes nobody, even from a nation mid-tour', async () => {
  const none = await absentBySlot(pool, TC, 1, WIN_ROUND + 1);
  assert.equal(none.size, 0);
  assert.deepEqual(await ensureCallups(pool, TC, 1, WIN_ROUND + 1), [],
    'round four is not a window round: the tourists are home between games');
});

test('a window that is not yours takes nobody: the calendar spares the rest of the world', async () => {
  const firstHalf = new Set(H0.flatMap(t => t.teams));
  assert.ok(firstHalf.has(TC), 'the protagonist opens the season on the road');
  assert.equal(await touringOn(pool, TC, 1, WIN_ROUND), true);
  assert.equal(await touringOn(pool, TC, 1, WINDOWS[1]), true, 'game two is his window too');
  assert.equal(await touringOn(pool, TC, 1, WINDOWS[3]), false, 'the second half is not');
  // every nation NOT in a first-half series keeps all its men at home
  const spared = IDS16.filter(id => !firstHalf.has(id));
  assert.equal(spared.length, 12, 'twelve nations are spared the opening window');
  for (const id of spared.slice(0, 3)) {
    assert.equal(await touringOn(pool, id, 1, WIN_ROUND), false);
    assert.deepEqual(await ensureCallups(pool, id, 1, WIN_ROUND), [],
      id + ' is not touring and calls nobody up');
  }
  const named0 = (await pool.query(
    `SELECT DISTINCT country_id FROM callups WHERE round=$1`, [WIN_ROUND])).rows.map(r => r.country_id).sort();
  assert.deepEqual(named0, Array.from(firstHalf).sort(),
    'the only call-ups in the world are the four touring nations\'');
  // the law still holds where it can be observed: a round that is NOT a
  // window round takes nobody from anybody
  const named = (await pool.query(
    'SELECT count(*)::int AS n FROM callups WHERE round=$1', [WIN_ROUND + 1])).rows[0].n;
  assert.equal(named, 0, 'a non-window round has no call-ups anywhere');
  const paid = (await pool.query(
    'SELECT coalesce(sum(fee),0)::int AS f FROM callups WHERE round=$1', [WIN_ROUND + 1])).rows[0].f;
  assert.equal(paid, 0, 'and nobody was paid for a week that never happened');
});
