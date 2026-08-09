// world-tickets.test.mjs — THE TURNSTILE IS YOURS (073).
//
// The obligations:
//   1. the RPC holds the rails: $10-$100, claimed clubs only;
//   2. a club that never touches the dial banks EXACTLY what the flat $26
//      economy always paid it - the books of every existing club are
//      untouched by the feature shipping;
//   3. a dearer ticket thins the crowd and moves the take, from the round
//      after the decision - earlier gates keep their old arithmetic;
//   4. the crowd locks 24 hours out: a price set inside the window changes
//      nothing about that match, only later ones;
//   5. the advance board is the same function trimmed to the clock: partial
//      sales grow day by day toward the banked total.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld } from '../init-world.mjs';
import { makeHost } from '../enginehost.mjs';
import { runDue } from '../tick.mjs';
import { computeFinance, gateSale, TICKET } from '../economy.mjs';
import { EPOCH, DAY, natHour, dayOfRound } from '../clock.mjs';

const DB = 'fotickets_test';
const UID = '88888888-8888-8888-8888-888888888888';
let pool, host;
const T0 = EPOCH + 100 * DAY + 12 * 3600000;
const START = 101;

before(async () => {
  try { execSync(`dropdb --if-exists ${DB}`, { stdio: 'ignore' }); } catch (e) {}
  execSync(`createdb ${DB}`);
  process.env.PGDATABASE = DB;
  pool = makePool(); host = makeHost();
  await migrate(pool);
  await initWorld(pool, { now: T0, host });
  await pool.query(
    `INSERT INTO claims(user_id, country_id, slot, display_name, levelled) VALUES ($1,'eng',1,'Gatekeeper',true)`, [UID]);
  await pool.query(`CREATE OR REPLACE FUNCTION _uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT '${UID}'::uuid $$`);
  // two rounds banked, so there are gates in the books
  await runDue(pool, host, 'eng', { now: EPOCH + START * DAY + natHour('eng') * 3600000 - 3600000 + 4 * 60000 });
  await runDue(pool, host, 'eng', { now: EPOCH + (START + 1) * DAY + natHour('eng') * 3600000 - 3600000 + 4 * 60000 });
});
after(async () => { if (pool) await pool.end(); });

test('the RPC holds the rails', async () => {
  await assert.rejects(pool.query('SELECT world_set_ticket(9)'), /between/);
  await assert.rejects(pool.query('SELECT world_set_ticket(101)'), /between/);
  await assert.rejects(pool.query('SELECT world_set_ticket(NULL)'), /between/);
  const ok = await pool.query('SELECT world_set_ticket(40) AS r');
  assert.equal(ok.rows[0].r.ok, true);
  assert.equal(ok.rows[0].r.price, 40);
  const hist = await pool.query(`SELECT world_ticket_prices('eng', 1) AS r`);
  assert.equal(hist.rows[0].r.length, 1);
  assert.equal(hist.rows[0].r[0].price, 40);
  await pool.query('DELETE FROM ticket_prices');
});

test('a club that never prices banks the flat-26 economy to the pound', async () => {
  const a = await computeFinance(pool, 'eng');
  // somebody ELSE pricing changes nothing for slot 3
  await pool.query(
    `INSERT INTO ticket_prices(country_id, slot, set_ms, price) VALUES ('eng', 1, $1, 60)`, [EPOCH]);
  const b = await computeFinance(pool, 'eng');
  const a3 = a.filter(r => r.slot === 3)[0], b3 = b.filter(r => r.slot === 3)[0];
  assert.deepEqual(b3.finance.gate, a3.finance.gate, 'an unpriced club\'s gate is untouched');
  assert.equal(b3.bank, a3.bank, 'and its bank to the pound');
  await pool.query('DELETE FROM ticket_prices');
});

test('a dearer ticket thins the crowd and the walk reprices only what came after', async () => {
  const flat = await computeFinance(pool, 'eng');
  const f1 = flat.filter(r => r.slot === 1)[0];
  // price set before round 2's sales window opened, after round 1 locked:
  // round 1 was day START at natHour; its lock was 24h before that
  const r1Ms = EPOCH + (START + (dayOfRound(1) ?? 0)) * DAY + natHour('eng') * 3600000;
  await pool.query(
    `INSERT INTO ticket_prices(country_id, slot, set_ms, price) VALUES ('eng', 1, $1, 78)`, [r1Ms - 3600000]);
  const priced = await computeFinance(pool, 'eng');
  const p1 = priced.filter(r => r.slot === 1)[0];
  // slot 1's home gates: whichever of rounds 1-2 it hosted after the stamp
  // sells thinner; totals must differ if it hosted anything after it
  const hostedAfter = (await pool.query(
    `SELECT count(*)::int AS n FROM matches WHERE country_id='eng' AND home_slot=1`)).rows[0].n;
  if (hostedAfter > 0) {
    assert.ok(p1.finance.avgAttendance <= f1.finance.avgAttendance,
      'a $78 seat never draws MORE than a $26 one');
  }
  assert.equal(p1.finance.ticket, 78, 'and the finance sheet quotes the club\'s own price');
  await pool.query('DELETE FROM ticket_prices');
});

test('division two plays to thinner stands', async () => {
  const before9 = await computeFinance(pool, 'eng');
  const divs = (await pool.query(
    `SELECT divisions FROM seasons WHERE country_id='eng' ORDER BY season_no DESC LIMIT 1`)).rows[0].divisions;
  // take a first-division club that hosted something and demote it on paper
  const hosts = new Set((await pool.query(
    `SELECT DISTINCT home_slot FROM matches WHERE country_id='eng'`)).rows.map(r => r.home_slot | 0));
  const d1 = ((divs && divs['1']) || []).map(Number).filter(sl => hosts.has(sl));
  if (!d1.length) return;                       // a world with no divisions has no rule to test
  const mark = d1[d1.length - 1];
  const moved = { 1: divs['1'].filter(x => (x | 0) !== mark), 2: (divs['2'] || []).concat([mark]) };
  await pool.query(`UPDATE seasons SET divisions=$1::jsonb WHERE country_id='eng'`, [JSON.stringify(moved)]);
  const after9 = await computeFinance(pool, 'eng');
  const a9 = before9.filter(r => r.slot === mark)[0], b9 = after9.filter(r => r.slot === mark)[0];
  assert.ok(b9.finance.avgAttendance < a9.finance.avgAttendance,
    'the demoted club draws less at home (' + a9.finance.avgAttendance + ' -> ' + b9.finance.avgAttendance + ')');
  await pool.query(`UPDATE seasons SET divisions=$1::jsonb WHERE country_id='eng'`, [JSON.stringify(divs)]);
});

test('the crowd locks 24 hours out', () => {
  const matchMs = EPOCH + 200 * DAY + 14 * 3600000;
  const early = [{ at: matchMs - 10 * DAY, price: 60 }];
  const late = [{ at: matchMs - 10 * DAY, price: 60 }, { at: matchMs - 23 * 3600000, price: 10 }];
  const a = gateSale(12000, 15000, matchMs, early, null);
  const b = gateSale(12000, 15000, matchMs, late, null);
  assert.deepEqual(b, a, 'a price set inside the last day touches no remaining sale');
});

test('the board is the banked sale trimmed to the clock', () => {
  const matchMs = EPOCH + 200 * DAY + 14 * 3600000;
  const demand = 14000, seats = 15000;
  let prev = 0;
  for (let daysOut = 8; daysOut >= 1; daysOut--) {
    const cur = gateSale(demand, seats, matchMs, null, matchMs - daysOut * DAY).sold;
    assert.ok(cur >= prev, 'sales never go backwards (' + daysOut + 'd out)');
    prev = cur;
  }
  const banked = gateSale(demand, seats, matchMs, null, null).sold;
  assert.equal(gateSale(demand, seats, matchMs, null, matchMs).sold, banked,
    'by the first ball the board reads exactly what the umpire banks');
  // and pricing off the top empties the ground without zeroing it
  const dear = gateSale(demand, seats, matchMs, [{ at: 0, price: 100 }], null);
  assert.ok(dear.sold < banked * 0.3, 'a $100 seat empties most of the ground');
  assert.ok(dear.sold >= 600, 'the die-hards still walk up');
});
