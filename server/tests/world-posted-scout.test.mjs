// tests/world-posted-scout.test.mjs — THE HIDDEN RATE AND THE POSTED SCOUT.
//
// The obligations:
//   1. a boy's hidden rate is deterministic, banded sanely, and NEVER on any
//      served surface - not the report, not the signed card;
//   2. the rate genuinely moves the nets: the same boy at twice the rate
//      banks more gains over the same rounds, and a senior is untouched;
//   3. the whisper is words, correlates with the rate when the academy is
//      good, and is vaguer when it is poor;
//   4. the scout POSTING: world_scout_post stores it, a bare world_scout
//      reads it, and world_my_academy serves it.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld } from '../init-world.mjs';
import { makeHost } from '../enginehost.mjs';
import { youthPot, whisperOf, makeRecruit, scoutRecruit, withWhisper } from '../youth.mjs';
import { EPOCH, DAY } from '../clock.mjs';

const DBNAME = 'foworld_postedscout_test';
let pool, host;
const T0 = EPOCH + 100 * DAY + 12 * 3600000;
const START = 101;
const U1 = '31111111-1111-4111-8111-111111111111';

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

before(async () => {
  try { execSync('dropdb --if-exists ' + DBNAME); } catch {}
  execSync('createdb ' + DBNAME);
  process.env.PGDATABASE = DBNAME;
  pool = makePool();
  await migrate(pool);
  host = makeHost();
  await initWorld(pool, { now: T0, host });
});
after(async () => { if (pool) await pool.end(); });

test('the hidden rate: deterministic, sane, and served to nobody', () => {
  const boy = { yseed: 'scout|eng|3|d105|eng|L2', name: 'A Boy', from: 'eng' };
  const p1 = youthPot(boy), p2 = youthPot(boy);
  assert.equal(p1, p2, 'the same boy has the same rate forever');
  assert.ok(p1 >= 0.75 && p1 <= 2.95, 'and the rate lives in its band');
  // across a thousand boys: most ordinary, a real tail, nobody outside
  let hi = 0, lo = 0;
  for (let i = 0; i < 1000; i++) {
    const p = youthPot({ yseed: 'x|' + i });
    assert.ok(p >= 0.75 && p <= 2.95);
    if (p >= 2.0) hi++;
    if (p <= 0.9) lo++;
  }
  assert.ok(hi > 10 && hi < 200, 'late bloomers are rare but real (' + hi + '/1000)');
  assert.ok(lo > 50, 'and some boys are near the finished article (' + lo + '/1000)');
  // the recruit a trip serves carries the seed and the whisper, never the rate
  const got = scoutRecruit(host, { country: 'eng', slot: 3, worldDay: 105, nation: 'eng', level: 3 });
  assert.ok(got && got.recruit.yseed, 'the birth seed rides with him');
  assert.ok(typeof got.recruit.whisper === 'string' && got.recruit.whisper.length > 10, 'the whisper is words');
  assert.ok(!('pot' in got.recruit) && !('__ypot' in got.recruit), 'the rate itself is nowhere on him');
});

test('the rate moves the nets: twice the rate, more gains; seniors untouched', () => {
  const mk = () => {
    const b = makeRecruit(host, 'England', 'balanced', 'average', 'nets|pot|boy');
    return Object.assign({}, b, { age: 17 });
  };
  const run = (ypot, rounds) => {
    let crew = [Object.assign(mk(), ypot ? { __ypot: ypot } : null)];
    let gained = 0;
    for (let r = 0; r < rounds; r++) {
      const res = host.trainRound(crew, {}, 1.0, null);
      gained += (res.gains || []).length;
      crew = res.players.map(p => Object.assign(p, ypot ? { __ypot: ypot } : null));
    }
    return gained;
  };
  const slow = run(null, 30), fast = run(2.5, 30);
  assert.ok(fast > slow, 'a 2.5x boy banks more skill points than a 1x boy (' + fast + ' v ' + slow + ')');
  assert.ok(fast >= slow * 1.5, 'and not marginally more');
});

test('the whisper: words that lean on the truth, harder from a better academy', () => {
  // at level ten the noise is small: boys at the extremes must sort correctly
  let right = 0, n = 0;
  for (let i = 0; i < 400; i++) {
    const pot = youthPot({ yseed: 'w|' + i });
    if (pot < 1.5 && pot > 0.9) continue;                 // judge only the extremes
    const w = whisperOf(pot, 10, 'w|' + i);
    const growth = /grow|talent|clear a shirt|real growth/.test(w);
    n++;
    if ((pot >= 1.5) === growth) right++;
  }
  assert.ok(right / n > 0.8, 'a level-ten whisper is right about the extremes (' + right + '/' + n + ')');
});

test('the posting: stored, read by a bare trip, served on the academy page', async () => {
  await pool.query(
    `INSERT INTO claims(user_id, display_name, country_id, slot) VALUES ($1,'Poster','eng',3)`, [U1]);
  // post the scout to India
  const r1 = await as(U1, `SELECT public.world_scout_post('sub') AS r`, [], T0);
  assert.equal(r1.rows[0].r.ok, true);
  assert.equal(r1.rows[0].r.nation, 'sub');
  // the academy page says where he is
  const ac = await as(U1, `SELECT public.world_my_academy() AS r`, [], T0);
  assert.equal(ac.rows[0].r.scoutNation, 'sub', 'the page knows the posting');
  assert.ok(+ac.rows[0].r.scoutFee > 0, 'and what a report from there costs');
  // a bare trip on a rest day reads the posting: the boy is Indian
  // (rest days from the page itself; day di must be a rest day for eng)
  const restDays = ac.rows[0].r.restDays;
  // walk forward to england's next rest day, measured from the season's own
  // start (di is null before the season begins, and null + 1 is a trap)
  const sd = +(await pool.query(
    `SELECT start_day FROM seasons WHERE country_id='eng' ORDER BY season_no DESC LIMIT 1`)).rows[0].start_day;
  let dd = 0;
  while (!restDays.includes((ac.rows[0].r.day + dd) - sd)) dd++;
  const atRest = T0 + dd * DAY;
  // candidates for that day must exist; the tick lays them out - lay one out
  // directly so the test does not need the whole daily sweep
  const wd = ac.rows[0].r.day + dd;
  const cand = scoutRecruit(host, { country: 'eng', slot: 3, worldDay: wd, nation: 'sub', level: 2 });
  await pool.query(
    `INSERT INTO academy_candidates(country_id, slot, world_day, nation, tier, recruit)
     VALUES ('eng', 3, $1, 'sub', $2, $3::jsonb) ON CONFLICT DO NOTHING`,
    [wd, cand.tier, JSON.stringify(cand.recruit)]);
  const trip = await as(U1, `SELECT public.world_scout(NULL) AS r`, [], atRest);
  assert.equal(trip.rows[0].r.nation, 'sub', 'a bare trip goes where the scout is posted');
  assert.ok(typeof trip.rows[0].r.recruit.whisper === 'string', 'and the report carries the whisper');
  assert.ok(!('skills' in trip.rows[0].r.recruit), 'bands, not the file (050 holds)');
});
