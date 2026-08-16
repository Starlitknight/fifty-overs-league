// world-wage-cutover.test.mjs — THE 101 CUTOVER: HISTORY FREEZES, TO THE
// DOLLAR, AND NOTHING CAN EVER REPRICE IT AGAIN.
//
// The first cut of migration 101 banked bills only for rounds settled AFTER
// it, and let every earlier round fall back to the standing bill - which
// left all pre-101 history permanently mutable: a club with ninety settled
// rounds signing a $30k-a-round man the day after deploy would still have
// been retro-charged 90 x $30k. This suite reproduces that exact bug
// against the SHIPPED cutover (the backfill statement is read out of the
// migration file and executed verbatim, so what is tested is what deploys)
// and holds the three laws of the transition:
//
//   1. the cutover moves no bank by one dollar - the frozen figure IS the
//      figure the old law was charging at that instant;
//   2. no wage event after the cutover - a transfer in, a transfer out,
//      development repricing wages up, decline repricing them down - moves
//      one pre-cutover wage line, one historical wage total, or one bank;
//   3. every round settled after the cutover banks the bill it was played
//      under and is immutable in its turn - including through a tick that
//      crashes between the match rows and the banking and is then healed.
//
// The pre-101 world here is FABRICATED the way the economy suite fabricates
// one: matches written straight into the record with wage_rounds left
// empty, which is byte-for-byte what a production world looks like the
// moment before the migration runs.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld } from '../init-world.mjs';
import { makeHost } from '../enginehost.mjs';
import { computeFinance } from '../economy.mjs';
import { runTick } from '../tick.mjs';
import { EPOCH, DAY, ROUNDS, CYCLE } from '../clock.mjs';

const DB = 'fowagecutover_test';
let pool, host, clubs, schedule;
const T0 = EPOCH + 100 * DAY + 12 * 3600000;         // era 2: day 100
const afterPlay = d => EPOCH + d * DAY + 18 * 3600000;
const NOW = EPOCH + 200 * DAY;                        // well past everything fabricated

// the cutover statement, read out of the migration itself: the test proves
// the SQL that ships, not a test's paraphrase of it
const cutoverSql = () => {
  const mig = readFileSync(join(dirname(fileURLToPath(import.meta.url)),
    '../migrations/101-a-wage-is-paid-on-the-day.sql'), 'utf8');
  const m = /-- CUTOVER-BACKFILL-BEGIN\n([\s\S]*?)\n-- CUTOVER-BACKFILL-END/.exec(mig);
  assert.ok(m, 'the migration carries its cutover backfill between the markers');
  return m[1];
};

const walk = (slots) => computeFinance(pool, 'eng',
  { ledgerSlots: slots || clubs.map(c => c.slot), now: NOW });
const billOf = async slot => Math.round(Number((await pool.query(
  `SELECT coalesce((SELECT sum((p->>'wage')::numeric) FROM jsonb_array_elements(squad) p), 0)
        + coalesce((SELECT sum((y->>'wage')::numeric) FROM jsonb_array_elements(youth) y), 0) AS b
     FROM clubs WHERE country_id='eng' AND slot=$1`, [slot])).rows[0].b));
const wageLines = rows => Object.fromEntries(rows.map(r =>
  [r.slot, (r.ledger || []).filter(l => l.kind === 'wages').map(l => l.amount)]));

before(async () => {
  try { execSync(`dropdb --if-exists ${DB}`, { stdio: 'ignore' }); } catch (e) {}
  execSync(`createdb ${DB}`);
  process.env.PGDATABASE = DB;
  pool = makePool(); host = makeHost();
  await migrate(pool);                     // 101 runs here, against an empty record
  await initWorld(pool, { now: T0, host });
  clubs = (await pool.query(
    `SELECT slot, name FROM clubs WHERE country_id='eng' ORDER BY slot`)).rows;
  const sea = (await pool.query(
    `SELECT start_day, schedule, divisions FROM seasons WHERE country_id='eng' AND season_no=1`)).rows[0];
  schedule = sea.schedule;
  // THE PRE-101 WORLD: two summers of cricket and not one banked bill.
  // Season 1 whole (fourteen rounds and the playoffs), season 2's first four.
  let n = 0;
  const put = (sn, round, h, a) => pool.query(
    `INSERT INTO matches(id, country_id, season_no, round, home_slot, away_slot, seed,
                         engine_version, pitch, orders, result, home_name, away_name)
     VALUES ($1,'eng',$2,$3,$4,$5,$6,'test','fair','{}'::jsonb,$7::jsonb,$8,$9)`,
    ['cut-' + (n++), sn, round, h, a, 3000 + n,
     JSON.stringify({ winner: clubs[Math.min(h, a)].name }), clubs[h].name, clubs[a].name]);
  for (let round = 1; round <= ROUNDS; round++) {
    for (const dv of ['1', '2']) {
      for (const [h, a] of schedule[dv][round - 1]) await put(1, round, h, a);
    }
  }
  for (const dv of ['1', '2']) {
    const mem = sea.divisions[dv].map(Number).sort((x, y) => x - y);
    await put(1, 15, mem[0], mem[3]); await put(1, 15, mem[1], mem[2]);
    await put(1, 16, mem[0], mem[1]);
  }
  await pool.query(
    `INSERT INTO seasons(country_id, season_no, start_day, schedule, divisions)
     VALUES ('eng', 2, $1, $2, $3) ON CONFLICT DO NOTHING`,
    [sea.start_day + CYCLE, JSON.stringify(sea.schedule), JSON.stringify(sea.divisions)]);
  for (let round = 1; round <= 4; round++) {
    for (const dv of ['1', '2']) {
      for (const [h, a] of schedule[dv][round - 1]) await put(2, round, h, a);
    }
  }
});
after(async () => { if (pool) await pool.end(); });

// shared across the tests below, in order
let preBank, preWages, preLines, atCutBill, roundsPlayed;

test('the cutover freezes history at the figure the old law was charging - no bank moves a dollar', async () => {
  assert.equal((await pool.query(`SELECT count(*)::int AS n FROM wage_rounds WHERE country_id='eng'`)).rows[0].n,
    0, 'this is a genuinely pre-101 world: two summers played, nothing banked');
  const beforeRows = await walk();
  preBank = Object.fromEntries(beforeRows.map(r => [r.slot, r.bank]));
  preWages = Object.fromEntries(beforeRows.map(r => [r.slot, r.finance.wages]));
  preLines = wageLines(beforeRows);
  roundsPlayed = Object.fromEntries(beforeRows.map(r => [r.slot, r.finance.rounds]));
  atCutBill = Object.fromEntries(await Promise.all(
    clubs.map(async c => [c.slot, await billOf(c.slot)])));
  // THE TRANSITION: the migration's own statement, verbatim
  await pool.query(cutoverSql());
  const banked = (await pool.query(
    `SELECT count(*)::int AS n, count(DISTINCT (season_no, round))::int AS r
       FROM wage_rounds WHERE country_id='eng'`)).rows[0];
  assert.ok(banked.n > 0, 'the freeze wrote history');
  for (const c of clubs) {
    const mine = (await pool.query(
      `SELECT count(*)::int AS n, min(bill)::bigint AS lo, max(bill)::bigint AS hi
         FROM wage_rounds WHERE country_id='eng' AND slot=$1`, [c.slot])).rows[0];
    assert.equal(mine.n, roundsPlayed[c.slot], 'slot ' + c.slot + ': one frozen row per round the walk charges');
    assert.equal(Number(mine.lo), atCutBill[c.slot], 'frozen at the standing bill');
    assert.equal(Number(mine.hi), atCutBill[c.slot]);
  }
  const afterRows = await walk();
  for (const r of afterRows) {
    assert.equal(r.bank, preBank[r.slot], 'slot ' + r.slot + ': the treasury did not move a dollar');
    assert.equal(r.finance.wages, preWages[r.slot], 'slot ' + r.slot + ': the historical wage total is identical');
  }
  assert.deepEqual(wageLines(afterRows), preLines, 'every wage line on every ledger is byte-identical');
});

test('no wage event can reprice frozen history: in, out, development, decline', async () => {
  const SLOT = 2;
  const original = (await pool.query(
    `SELECT squad FROM clubs WHERE country_id='eng' AND slot=$1`, [SLOT])).rows[0].squad;
  const scenarios = [
    ['a transfer IN raising the bill', sq => sq.concat([{ name: 'Cutover Signing', wage: 30000, rating: 40000, age: 26 }])],
    ['a transfer OUT lowering the bill', sq => sq.slice(1)],
    ['development repricing wages up', sq => sq.map(p => ({ ...p, wage: Math.round((p.wage || 0) * 1.15) }))],
    ['decline repricing wages down', sq => sq.map(p => ({ ...p, wage: Math.round((p.wage || 0) * 0.8) }))]
  ];
  for (const [label, mutate] of scenarios) {
    await pool.query(`UPDATE clubs SET squad=$2::jsonb WHERE country_id='eng' AND slot=$1`,
      [SLOT, JSON.stringify(mutate(original))]);
    const rows = await walk([SLOT]);
    const mine = rows.find(r => r.slot === SLOT);
    // the exact figures recorded before the cutover, untouched by the event:
    // not one line, not the total, not the bank - and no N x delta anywhere
    assert.deepEqual((mine.ledger || []).filter(l => l.kind === 'wages').map(l => l.amount),
      preLines[SLOT], label + ': every pre-cutover wage line is unchanged');
    assert.equal(mine.finance.wages, preWages[SLOT], label + ': the historical wage total is unchanged');
    assert.equal(mine.bank, preBank[SLOT], label + ': the bank does not move for recomputed history');
    // and the walk is idempotent under the event
    const again = await walk([SLOT]);
    assert.deepEqual(again.find(r => r.slot === SLOT).ledger, mine.ledger, label + ': settling twice settles the same');
    await pool.query(`UPDATE clubs SET squad=$2::jsonb WHERE country_id='eng' AND slot=$1`,
      [SLOT, JSON.stringify(original)]);
  }
});

test('the production transition, numerically: N frozen rounds, then a signing, then a new round', async () => {
  // the reviewer's own example, off this world's real figures. Before the
  // signing: N rounds frozen at B0; bank X; historical wages Y = N x B0.
  const SLOT = 3;
  const N = roundsPlayed[SLOT], B0 = atCutBill[SLOT];
  const X = preBank[SLOT], Y = preWages[SLOT];
  assert.equal(Y, N * B0, 'the frozen history is exactly N rounds at the cutover bill');
  // sign a player: the standing bill rises by 30,000
  const sq = (await pool.query(
    `SELECT squad FROM clubs WHERE country_id='eng' AND slot=$1`, [SLOT])).rows[0].squad;
  await pool.query(`UPDATE clubs SET squad=$2::jsonb WHERE country_id='eng' AND slot=$1`,
    [SLOT, JSON.stringify(sq.concat([{ name: 'Marquee Man', wage: 30000, rating: 42000, age: 25 }]))]);
  const B1 = await billOf(SLOT);
  assert.equal(B1, B0 + 30000);
  // recompute WITHOUT settling another round: history still Y, bank still X
  const mid = (await walk([SLOT])).find(r => r.slot === SLOT);
  assert.equal(mid.finance.wages, Y, 'historical wages still = Y after the signing');
  assert.equal(mid.bank, X, 'the bank changes by ZERO merely because old history recomputed');
  // the next settled round: match rows land and the umpire banks the bill in
  // force - emulated here with the identical arithmetic the tick uses
  const opp = 4;
  await pool.query(
    `INSERT INTO matches(id, country_id, season_no, round, home_slot, away_slot, seed,
                         engine_version, pitch, orders, result, home_name, away_name)
     VALUES ('cut-new-1','eng',2,5,$1,$2,7777,'test','fair','{}'::jsonb,$3::jsonb,$4,$5)`,
    [SLOT, opp, JSON.stringify({ winner: clubs[SLOT].name }), clubs[SLOT].name, clubs[opp].name]);
  await pool.query(
    `INSERT INTO wage_rounds(country_id, slot, season_no, round, bill)
     SELECT c.country_id, c.slot, 2, 5,
            round(coalesce((SELECT sum((p->>'wage')::numeric) FROM jsonb_array_elements(c.squad) p), 0)
                + coalesce((SELECT sum((y->>'wage')::numeric) FROM jsonb_array_elements(c.youth) y), 0))::bigint
       FROM clubs c WHERE c.country_id='eng' AND c.slot IN ($1, $2)
     ON CONFLICT (country_id, slot, season_no, round) DO NOTHING`, [SLOT, opp]);
  const rows1 = await walk([SLOT]);
  const w1 = (rows1.find(r => r.slot === SLOT).ledger || []).filter(l => l.kind === 'wages');
  assert.equal(-w1[w1.length - 1].amount, B1, 'the new round is charged at the new bill, +$' + B1);
  assert.equal(rows1.find(r => r.slot === SLOT).finance.wages, Y + B1);
  // and that round is immutable in its turn: another signing cannot touch it
  await pool.query(`UPDATE clubs SET squad=$2::jsonb WHERE country_id='eng' AND slot=$1`,
    [SLOT, JSON.stringify(sq.concat([
      { name: 'Marquee Man', wage: 30000, rating: 42000, age: 25 },
      { name: 'Second Signing', wage: 45000, rating: 43000, age: 24 }]))]);
  const B2 = await billOf(SLOT);
  const rows2 = await walk([SLOT]);
  const w2 = (rows2.find(r => r.slot === SLOT).ledger || []).filter(l => l.kind === 'wages');
  assert.equal(-w2[w2.length - 1].amount, B1, 'the settled round keeps the bill it was played under');
  assert.equal(rows2.find(r => r.slot === SLOT).finance.wages, Y + B1);
  // a further round banks ITS own bill
  await pool.query(
    `INSERT INTO matches(id, country_id, season_no, round, home_slot, away_slot, seed,
                         engine_version, pitch, orders, result, home_name, away_name)
     VALUES ('cut-new-2','eng',2,6,$1,$2,7778,'test','fair','{}'::jsonb,$3::jsonb,$4,$5)`,
    [SLOT, opp, JSON.stringify({ winner: clubs[SLOT].name }), clubs[SLOT].name, clubs[opp].name]);
  await pool.query(
    `INSERT INTO wage_rounds(country_id, slot, season_no, round, bill)
     SELECT c.country_id, c.slot, 2, 6,
            round(coalesce((SELECT sum((p->>'wage')::numeric) FROM jsonb_array_elements(c.squad) p), 0)
                + coalesce((SELECT sum((y->>'wage')::numeric) FROM jsonb_array_elements(c.youth) y), 0))::bigint
       FROM clubs c WHERE c.country_id='eng' AND c.slot IN ($1, $2)
     ON CONFLICT (country_id, slot, season_no, round) DO NOTHING`, [SLOT, opp]);
  const rows3 = await walk([SLOT]);
  const w3 = (rows3.find(r => r.slot === SLOT).ledger || []).filter(l => l.kind === 'wages');
  assert.equal(-w3[w3.length - 1].amount, B2, 'the round after banks the bill in force by then');
  assert.equal(-w3[w3.length - 2].amount, B1, 'and its predecessor still stands');
});

test('a tick that crashes between the cricket and the banking heals to ONE authoritative bill', async () => {
  // the real umpire, the real crash: Australia's round one dies after two
  // matches - match rows banked, wage rows and money not yet touched
  await assert.rejects(
    runTick(pool, host, 'aus', 101, { now: afterPlay(101), failAfter: 2 }),
    /injected-crash/);
  assert.equal((await pool.query(
    `SELECT count(*)::int AS n FROM wage_rounds WHERE country_id='aus'`)).rows[0].n, 0,
    'the crash landed before the banking: nothing frozen yet');
  // mid-crash, the walk still balances - the played matches charge at the
  // standing bill, exactly the figure the heal is about to make permanent
  const midCrash = await computeFinance(pool, 'aus', { now: afterPlay(101) });
  assert.ok(midCrash.length === 16, 'the books still open mid-crash');
  // a transfer lands between the crash and the heal: the healed banking must
  // freeze the bill as it stands AT THE HEAL - one authority, no dispute
  const sq5 = (await pool.query(
    `SELECT squad FROM clubs WHERE country_id='aus' AND slot=5`)).rows[0].squad;
  await pool.query(`UPDATE clubs SET squad=$1::jsonb WHERE country_id='aus' AND slot=5`,
    [JSON.stringify(sq5.concat([{ name: 'Heal Window Man', wage: 7770, rating: 38000, age: 27 }]))]);
  const res = await runTick(pool, host, 'aus', 101, { now: afterPlay(101) });
  assert.equal(res.skipped, false, 'the heal replays the gap');
  // the authoritative figure is the bill as the heal's own fold left it -
  // the banking runs AFTER evolveCountry on purpose, so what freezes is the
  // bill the settle would charge, nets and derived wages included. Read it
  // off the row the fold wrote, not off this test's arithmetic.
  const healedSquad = (await pool.query(
    `SELECT squad FROM clubs WHERE country_id='aus' AND slot=5`)).rows[0].squad;
  assert.ok(healedSquad.some(p => p && p.name === 'Heal Window Man'),
    'the transfer that landed in the heal window is on the healed row');
  const healBill = Math.round(Number((await pool.query(
    `SELECT coalesce((SELECT sum((p->>'wage')::numeric) FROM jsonb_array_elements(squad) p), 0)
          + coalesce((SELECT sum((y->>'wage')::numeric) FROM jsonb_array_elements(youth) y), 0) AS b
       FROM clubs WHERE country_id='aus' AND slot=5`)).rows[0].b));
  const rows = (await pool.query(
    `SELECT slot, count(*)::int AS n FROM wage_rounds
      WHERE country_id='aus' AND season_no=1 AND round=1 GROUP BY slot ORDER BY slot`)).rows;
  assert.equal(rows.length, 16, 'every club has its round-one bill');
  for (const r of rows) assert.equal(r.n, 1, 'slot ' + r.slot + ': exactly one row, no duplicates');
  const frozen = Number((await pool.query(
    `SELECT bill FROM wage_rounds WHERE country_id='aus' AND slot=5 AND season_no=1 AND round=1`)).rows[0].bill);
  assert.equal(frozen, healBill, 'the healed banking froze the bill as the heal found it');
  // re-running the done tick is a no-op on the frozen bills
  const again = await runTick(pool, host, 'aus', 101, { now: afterPlay(101) });
  assert.equal(again.skipped, true);
  assert.equal(Number((await pool.query(
    `SELECT bill FROM wage_rounds WHERE country_id='aus' AND slot=5 AND season_no=1 AND round=1`)).rows[0].bill),
    frozen, 'a done tick re-run revises nothing');
  // and the round is immutable from here: another signing moves no history
  await pool.query(`UPDATE clubs SET squad=$1::jsonb WHERE country_id='aus' AND slot=5`,
    [JSON.stringify(sq5.concat([
      { name: 'Heal Window Man', wage: 7770, rating: 38000, age: 27 },
      { name: 'After Heal Man', wage: 50000, rating: 42000, age: 26 }]))]);
  const after5 = (await computeFinance(pool, 'aus',
    { ledgerSlots: [5], now: afterPlay(101) })).find(r => r.slot === 5);
  const wl = (after5.ledger || []).filter(l => l.kind === 'wages');
  assert.equal(-wl[0].amount, frozen, 'round one keeps its healed bill whatever the squad does next');
});
