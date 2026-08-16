// world-botfinance.test.mjs — THE BOT'S MONEY SENSE, proved.
//
// botfinance.mjs gives an unmanaged club the sheet of paper a treasurer
// keeps: bank, bill, recurring income, projected end-of-season cash - and a
// POSTURE that market.mjs lets lean on the dials it already had. The
// obligations:
//
//   1. the sheet is a pure function - the same club reads the same posture
//      forever, and it knows nothing a manager could not know;
//   2. the bands mean what they say: the flagship's priced-in squeeze is
//      HEALTHY (a contender rationally runs a deficit), a relegated club
//      holding a top-flight payroll on second-division money is DANGEROUS,
//      and a club in sight of the floor is CRITICAL;
//   3. ambition scales with stature - a big club tolerates more deficit
//      than a small one, and nobody tolerates ruin;
//   4. a healthy club behaves EXACTLY as the founding market did: the same
//      sell chance, the same reserve, the same bid to the dollar;
//   5. a troubled club stops buying and starts shedding: no bids from a
//      dangerous club, a distressed reserve on a critical club's listings;
//   6. an era-1 world is untouched - the layer's law is written against
//      era 2 and the founding economy keeps its founding bots.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld } from '../init-world.mjs';
import { makeHost } from '../enginehost.mjs';
import {
  botFinanceView, ambitionOf, postureOf, botMoney, botPosture, POSTURE_POLICY, POSTURES
} from '../botfinance.mjs';
import {
  botBid, openBotListings, placeBotBids, BOT_SELL_CHANCE, valueOf, SQUAD_FLOOR
} from '../market.mjs';
import { DEBT_LIMIT } from '../economy.mjs';
import { EPOCH, DAY, ROUNDS, seedOf } from '../clock.mjs';

const DB = 'fobotfinance_test';
let pool, host;
const T0 = EPOCH + 100 * DAY + 12 * 3600000;      // era 2: day 100 >= ERA2_DAY
const atDay = (day, hour) => EPOCH + day * DAY + hour * 3600000;

before(async () => {
  try { execSync(`dropdb --if-exists ${DB}`, { stdio: 'ignore' }); } catch (e) {}
  execSync(`createdb ${DB}`);
  process.env.PGDATABASE = DB;
  pool = makePool(); host = makeHost();
  await migrate(pool);
  await initWorld(pool, { now: T0, host });
});
after(async () => { if (pool) await pool.end(); });

// ---- the sheet, as a pure function ----------------------------------------

const CLUB = (over = {}) => ({
  country: 'eng', slot: 12, isBoss: false, div: 2, bank: 1500000, wageBill: 95000,
  seats: 21000, academy: 2, avgAttendance: 9000, roundsLeft: 14, roundsTotal: 14, ...over
});

test('the sheet is deterministic and the bands mean what they say', () => {
  const a = botFinanceView(CLUB());
  assert.deepEqual(a, botFinanceView(CLUB()), 'the same club reads the same sheet');
  // a comfortable second-division club is simply healthy
  assert.equal(postureOf(a, ambitionOf(12, false)), 'healthy');
  // the flagship's deliberate squeeze - a big bill, a big bank, roughly the
  // -15% the economy bench measures - is HEALTHY: a contender's deficit
  const flag = botFinanceView(CLUB({ slot: 0, isBoss: true, div: 1, bank: 3400000,
    wageBill: 449000, seats: 29000, avgAttendance: 24000 }));
  assert.equal(postureOf(flag, ambitionOf(0, true)), 'healthy',
    'the priced-in squeeze is not a panic (margin ' + (100 * flag.margin).toFixed(1) + '%)');
  assert.ok(flag.margin < -0.08 && flag.margin > -0.25, 'and it IS a real squeeze');
  // a relegated club that kept its Division One payroll on Division Two
  // money is headed under - the exact case the layer exists for
  const rel = botFinanceView(CLUB({ slot: 5, div: 2, bank: 800000, wageBill: 300000,
    seats: 24000, avgAttendance: 12000 }));
  assert.ok(['dangerous', 'critical'].includes(postureOf(rel, ambitionOf(5, false))),
    'a top-flight payroll on second-division money is an emergency');
  // and a club already near the floor is critical whatever its ambition
  const deep = botFinanceView(CLUB({ bank: -0.6 * DEBT_LIMIT, wageBill: 260000 }));
  assert.equal(postureOf(deep, ambitionOf(0, true)), 'critical');
});

test('ambition climbs the ladder and never excuses ruin', () => {
  const flag = ambitionOf(0, true), d1 = ambitionOf(4, false), d2 = ambitionOf(13, false);
  assert.ok(flag < d1 && d1 < d2, 'the bigger the club, the deeper the tolerated deficit');
  assert.ok(flag >= -0.19 && d2 <= -0.02, 'the band is bounded at both ends');
  // tolerance is about MARGIN only: a projected end below half the floor is
  // critical for the most ambitious club in the world
  const ruin = botFinanceView(CLUB({ slot: 0, isBoss: true, div: 1, bank: -2000000, wageBill: 500000 }));
  assert.equal(postureOf(ruin, ambitionOf(0, true)), 'critical');
});

test('a healthy club is the founding market, to the dollar', () => {
  assert.equal(POSTURE_POLICY.healthy.sell, BOT_SELL_CHANCE, 'the founding sell coin');
  assert.equal(POSTURE_POLICY.healthy.reserve, 0.80, 'the founding reserve');
  const man = (n, e = {}) => ({ name: n, age: 27, rating: 36000, wage: 1500, ...e });
  const thin = [man('a'), man('b', { keeper: true })];
  const target = man('quick', { bowlType: 'seamFast', bowlTypeFull: 'seamFast', rating: 39000 });
  const L = { id: 1, asking: 60000, buyerKey: 'eng:3' };
  const bare = botBid(L, thin, 5000000, target);
  assert.ok(bare > 0);
  assert.equal(bare, botBid(L, thin, 5000000, target,
    { policy: POSTURE_POLICY.healthy, perRoundIncome: 400000 }),
    'a healthy money sense changes nothing the founding market decided');
});

test('the postures move the dials the way the policy table says', () => {
  const man = (n, e = {}) => ({ name: n, age: 27, rating: 36000, wage: 1500, ...e });
  const thin = [man('a'), man('b', { keeper: true })];
  const target = man('quick', { bowlType: 'seamFast', bowlTypeFull: 'seamFast', rating: 39000 });
  const L = { id: 1, asking: 60000, buyerKey: 'eng:3' };
  // dangerous and critical clubs buy nobody, however rich the moment
  for (const p of ['dangerous', 'critical']) {
    assert.equal(botBid(L, thin, 9000000, target, { policy: POSTURE_POLICY[p] }), 0, p + ' buys nobody');
  }
  // a tight club fills holes only: an upgrade on a full line is declined...
  const stocked = [];
  for (let i = 0; i < 7; i++) stocked.push(man('bat' + i, { rating: 34000 }));
  for (let i = 0; i < 5; i++) stocked.push(man('seam' + i, { rating: 33000, bowlType: 'seamFast', bowlTypeFull: 'seamFast' }));
  for (let i = 0; i < 3; i++) stocked.push(man('spin' + i, { rating: 33000, bowlType: 'spin', bowlTypeFull: 'legSpin' }));
  const upgrade = man('star', { rating: 45000, bowlType: 'seamFast', bowlTypeFull: 'seamFast' });
  assert.ok(botBid({ ...L, id: 2 }, stocked, 9000000, upgrade) > 0, 'the founding market buys the upgrade');
  assert.equal(botBid({ ...L, id: 2 }, stocked, 9000000, upgrade,
    { policy: POSTURE_POLICY.tight, perRoundIncome: 900000 }), 0, 'a tight club defers the luxury');
  // ...and a hole is still filled, but never past the wage guard
  const okBid = botBid(L, thin, 5000000, target, { policy: POSTURE_POLICY.tight, perRoundIncome: 400000 });
  assert.ok(okBid > 0, 'a real hole is still a real need');
  const dear = man('dear', { bowlType: 'seamFast', bowlTypeFull: 'seamFast', rating: 39000, wage: 390000 });
  assert.equal(botBid(L, thin, 5000000, dear, { policy: POSTURE_POLICY.tight, perRoundIncome: 400000 }), 0,
    'a wage that tips the bill past income is refused');
});

test('every posture the market can read has a policy', () => {
  for (const p of POSTURES) {
    const pol = POSTURE_POLICY[p];
    assert.ok(pol && pol.sell > 0 && pol.sell <= 1 && pol.reserve >= 0.5 && pol.reserve <= 0.8 && pol.listings >= 2);
  }
  // trouble only ever sheds harder and accepts less - the ordering IS the policy
  assert.ok(POSTURE_POLICY.healthy.sell < POSTURE_POLICY.tight.sell);
  assert.ok(POSTURE_POLICY.tight.sell < POSTURE_POLICY.dangerous.sell);
  assert.ok(POSTURE_POLICY.dangerous.sell < POSTURE_POLICY.critical.sell);
  assert.ok(POSTURE_POLICY.healthy.reserve > POSTURE_POLICY.dangerous.reserve);
  assert.ok(POSTURE_POLICY.dangerous.reserve > POSTURE_POLICY.critical.reserve);
});

test('an era-1 world keeps its founding bots', () => {
  const row = { country_id: 'sco', slot: 5, bank: -2000000, squad: [{ wage: 900000 }] };
  assert.equal(botPosture(row, { era2: false }), 'healthy',
    'the layer never reaches into a world settled under the founding law');
});

// ---- and against a real founded world -------------------------------------

test('a critical bot shops its surplus at a distressed reserve, and buys nobody', async () => {
  // sink one unmanaged Zimbabwe club to the edge of the floor - deep enough
  // that even a modest second-division surplus cannot walk it back over the
  // critical line inside a season. Zimbabwe is out of the way of the other
  // suites' fixtures; slot 15 is nobody's boss.
  await pool.query(`UPDATE clubs SET bank=$1 WHERE country_id='zim' AND slot=15`, [-2300000]);
  const row = (await pool.query(
    `SELECT country_id, slot, is_boss, bank, seats, academy, squad, youth, finance
       FROM clubs WHERE country_id='zim' AND slot=15`)).rows[0];
  assert.equal(botPosture(row, { country: 'zim', era2: true, div: 2, roundsLeft: 14, roundsTotal: 14 }),
    'critical', 'the bank says critical');
  // walk the listing coin until it lands: with the critical sell chance of
  // 0.85 the first few rounds are all but certain to shed somebody
  let listed = [];
  for (let r = 1; r <= 6 && !listed.length; r++) {
    listed = (await openBotListings(pool, 'zim', 1, r, atDay(101 + r, 6)))
      .filter(l => l.slot === 15);
  }
  assert.ok(listed.length, 'a critical club puts a man up within a handful of rounds');
  const L = (await pool.query(`SELECT * FROM listings WHERE country_id='zim' AND slot=15 ORDER BY id DESC LIMIT 1`)).rows[0];
  assert.equal(Number(L.reserve), Math.round(Number(L.asking) * POSTURE_POLICY.critical.reserve),
    'the reserve is the distressed share of the ask');
  // and when the bots go shopping, the critical club's chequebook stays shut
  await placeBotBids(pool, atDay(102, 7));
  const mine = (await pool.query(
    `SELECT count(*)::int AS n FROM bids WHERE country_id='zim' AND slot=15`)).rows[0].n;
  assert.equal(mine, 0, 'a club shedding payroll does not bid on anybody');
});

test('every listing decision agrees with its club\'s own posture, on the seeded coin', async () => {
  // England is untouched: each club's listing decision in season 1 must be
  // exactly its posture's coin on the founding seed - a healthy club on the
  // founding 22%, never anything looser, and nobody listing off-coin
  const ROWS = (await pool.query(
    `SELECT country_id, slot, is_boss, bank, seats, academy, squad, youth, finance
       FROM clubs WHERE country_id='eng' ORDER BY slot`)).rows;
  const divs = (await pool.query(
    `SELECT divisions FROM seasons WHERE country_id='eng' AND season_no=1`)).rows[0].divisions;
  const divOf = {};
  for (const s of divs['2'] || []) divOf[Number(s)] = 2;
  for (let r = 1; r <= 4; r++) {
    const opened = await openBotListings(pool, 'eng', 1, r, atDay(101 + r, 6));
    for (const c of ROWS) {
      const posture = botPosture(c, { country: 'eng', era2: true, div: divOf[c.slot] || 1,
        roundsLeft: ROUNDS - r + 1, roundsTotal: ROUNDS });
      const flip = seedOf('list|eng|' + c.slot + '|s1|r' + r) / 4294967296;
      const did = opened.some(o => o.slot === c.slot);
      if (did) {
        assert.ok(flip <= POSTURE_POLICY[posture].sell && (c.squad || []).length > SQUAD_FLOOR,
          'slot ' + c.slot + ' round ' + r + ' (' + posture + ') listed only on its own coin');
      }
      // and a fresh, solvent world holds no panicking bots at all
      assert.notEqual(posture, 'critical', 'slot ' + c.slot + ': a founded club is not in crisis');
    }
  }
});
