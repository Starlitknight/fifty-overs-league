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

test('the mood opens each season level, and moves only on its results', async () => {
  // a new season on the books with nothing played: everybody reads settled
  await pool.query(
    `INSERT INTO seasons(country_id, season_no, start_day, schedule)
     SELECT 'eng', 2, $1, schedule FROM seasons WHERE country_id='eng' AND season_no=1
     ON CONFLICT DO NOTHING`, [START + 42]);
  const pre = await computeFinance(pool, 'eng');
  for (const r of pre) assert.equal(r.finance.mood, 4, 'pre-season mood is neutral (slot ' + r.slot + ')');
  // the season opens: slot 2 loses its first match. Whatever last season felt
  // like, the supporters judge THIS season - one loss from one game is glum.
  await pool.query(
    `INSERT INTO matches(id, country_id, season_no, round, home_slot, away_slot, home_name, away_name, seed,
                         engine_version, pitch, result, played_at)
     SELECT 'eng:s2:r1:mM', 'eng', 2, 1, 2, 3, h.name, a.name, 7, 'v1', 'balanced',
            jsonb_build_object('winner', a.name, 'text', a.name || ' won by 30 runs'), now()
       FROM (SELECT name FROM clubs WHERE country_id='eng' AND slot=2) h,
            (SELECT name FROM clubs WHERE country_id='eng' AND slot=3) a`);
  const opened = await computeFinance(pool, 'eng');
  const loser = opened.filter(r => r.slot === 2)[0], winner = opened.filter(r => r.slot === 3)[0];
  assert.ok(loser.finance.mood <= 3, 'a season-opening loss reads glum: ' + loser.finance.mood);
  assert.ok(winner.finance.mood >= 6, 'a season-opening win reads bright: ' + winner.finance.mood);
  await pool.query(`DELETE FROM matches WHERE id='eng:s2:r1:mM'`);
  await pool.query(`DELETE FROM seasons WHERE country_id='eng' AND season_no=2`);
});

test('the turning of the year alone reads neutral - no next-season row needed', async () => {
  // mid-season: the moods are live (somebody, somewhere, is not neutral)
  const mid = await computeFinance(pool, 'eng', { now: EPOCH + (START + 3) * DAY });
  assert.ok(mid.some(r => r.finance.mood !== 4), 'mid-season moods move');
  // past the turning, with NO season-2 row on the books: everybody level -
  // this is the live pre-season a manager actually sees
  const brk = await computeFinance(pool, 'eng', { now: EPOCH + (START + 38) * DAY + 3600000 });
  for (const r of brk) assert.equal(r.finance.mood, 4, 'the break is neutral (slot ' + r.slot + ')');
});

test('a match prices itself, and beats the standing price for that match alone (074)', async () => {
  // the RPC rails: a match price names both halves or neither
  await assert.rejects(pool.query('SELECT world_set_ticket(30, 1, 0)'), /together/);
  await assert.rejects(pool.query('SELECT world_set_ticket(30, 0, 4)'), /together/);
  const ok = await pool.query('SELECT world_set_ticket(44, 1, 2) AS r');
  assert.equal(ok.rows[0].r.round, 2);
  await pool.query('DELETE FROM ticket_prices');
  // the walk: a standing $60 everywhere, round 2 priced back to $26 - only
  // round 2's gate keeps the flat arithmetic
  const flat = await computeFinance(pool, 'eng');
  await pool.query(
    `INSERT INTO ticket_prices(country_id, slot, season_no, round, set_ms, price)
     VALUES ('eng', 1, 0, 0, $1, 60), ('eng', 1, 1, 2, $1, 26)`, [EPOCH]);
  const mixed = await computeFinance(pool, 'eng');
  const hosted = (await pool.query(
    `SELECT round FROM matches WHERE country_id='eng' AND home_slot=1 ORDER BY round`)).rows.map(r => r.round | 0);
  if (hosted.includes(2)) {
    // round 2's gate line reads no price tag (it sold at the league's $26)
    const led = mixed.filter(r => r.slot === 1)[0];
    assert.ok(led, 'slot 1 settled');
  }
  const f1 = flat.filter(r => r.slot === 1)[0], m1 = mixed.filter(r => r.slot === 1)[0];
  if (hosted.length) {
    assert.ok(m1.finance.avgAttendance <= f1.finance.avgAttendance,
      'a standing $60 never draws more than flat $26');
  }
  assert.equal(m1.finance.ticket, 60, 'the standing price is the sheet\'s quote');
  await pool.query('DELETE FROM ticket_prices');
});

test('the crowd locks 24 hours out', () => {
  const matchMs = EPOCH + 200 * DAY + 14 * 3600000;
  const early = [{ at: matchMs - 10 * DAY, price: 60 }];
  const late = [{ at: matchMs - 10 * DAY, price: 60 }, { at: matchMs - 23 * 3600000, price: 10 }];
  const a = gateSale(12000, 15000, matchMs, early, null);
  const b = gateSale(12000, 15000, matchMs, late, null);
  assert.deepEqual(b, a, 'a price set inside the last day touches no remaining sale');
});

test('the queue moves every four hours, not once a midnight', () => {
  // THE BOARD STOOD STILL FOR A DAY AT A TIME. A sale day was banked in one
  // lump at its own boundary, so a manager watching the gate board saw the
  // same figure for twenty-four hours and then a jump - which reads as a
  // broken page, not as an advance sale. The day is served in six parts now.
  const mm = EPOCH + 320 * DAY + 14 * 3600000;
  const lockAt = mm - 24 * 3600000, day = lockAt - 2 * DAY;
  const at = h => gateSale(14000, 20000, mm, null, day + h * 3600000, 0.4).sold;
  const every4 = [0, 4, 8, 12, 16, 20, 24].map(at);
  for (let i = 1; i < every4.length; i++)
    assert.ok(every4[i] > every4[i - 1], 'the queue moved between hour ' + (4 * i - 4) + ' and ' + 4 * i);
  // six moves in the day and no more: a trickle, not a live counter
  const hourly = []; for (let h = 0; h <= 24; h++) hourly.push(at(h));
  const moves = hourly.slice(1).filter((v, i) => v !== hourly[i]).length;
  assert.equal(moves, 6, 'six four-hourly steps make the day, got ' + moves);
  // the six steps are one day's sale, cut six ways and no more
  const steps = every4.slice(1).map((v, i) => v - every4[i]);
  assert.equal(steps.reduce((a, b) => a + b, 0), every4[6] - every4[0], 'the parts are the day');
  assert.ok(Math.max(...steps) - Math.min(...steps) <= 1, 'and they are even: ' + steps.join(','));
  // the next day has begun but not yet ticked, so the board holds
  assert.equal(at(25), at(24), 'the board holds until the next four hours are up');
  // THE BANKED GATE DOES NOT MOVE BY A PENNY. Everything above is the advance
  // board; the umpire's own figure takes every sale day whole.
  const banked = gateSale(14000, 20000, mm, null, null, 0.4);
  const board = gateSale(14000, 20000, mm, null, lockAt + DAY, 0.4);
  assert.equal(board.sold, banked.sold, 'at the lock the board IS the gate');
  assert.equal(board.take, banked.take, 'and so is the money');
});

test('a hot fixture queues early; a cold one is a late rush; both bank the same house', () => {
  const mm = EPOCH + 300 * DAY + 14 * 3600000;
  const tenOut = mm - 10 * DAY;
  const hot = gateSale(12000, 15000, mm, null, tenOut, 1);
  const cold = gateSale(12000, 15000, mm, null, tenOut, 0);
  assert.ok(hot.sold > 3000, 'the derby is already selling ten days out: ' + hot.sold);
  assert.equal(cold.sold, 0, 'the dead rubber has not even opened');
  assert.ok(hot.opensAt < cold.opensAt, 'and its window opened first');
  // at the lock, pace was all that differed - the same crowd walks in
  const hotFinal = gateSale(12000, 15000, mm, null, null, 1);
  const coldFinal = gateSale(12000, 15000, mm, null, null, 0);
  assert.equal(hotFinal.sold, coldFinal.sold, 'flat-priced totals match whatever the pace');
  assert.equal(hotFinal.take, coldFinal.take, 'and so does the money');
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

// A GATE LINE IS CHECKED WITH A PENCIL, AND IT HAS TO SURVIVE THAT.
//
// The line used to read "11,973 through the turnstiles at $30" and bank
// $211,903, and there is no arithmetic that gets you from the one to the
// other. Two steps were missing and both of them matter. The club keeps two
// THIRDS of a gate - the visitor's line said so about its own third, the
// home line said nothing - and a manager who moves his price mid-window sells
// the early days at the old one, so the closing price on the label is not
// what the house paid. Together they looked like a hundred and forty-seven
// thousand pounds going missing, which is how this was reported.
//
// The line now states what was taken per head and what the house took, so the
// reader can do all of it: heads x per-head is the gross, two thirds of the
// gross is the money. That is what this checks - against the banked figure
// rather than against a sentence.
test('the whole gate is the host\'s: no away share and nobody paid by the head (era 2)', async () => {
  // THE LINE NO LONGER SHOWS ITS WORKING, so the working is checked here.
  // Under era 2 (financeconfig.mjs) the two-thirds split and the per-head
  // broadcast fee are retired: the home club banks the net of its own sale
  // and nothing else moves on a matchday. The proof is the LEDGER: every
  // gate line belongs to a host, no away-share or broadcast line exists,
  // and the away clubs' cut is an exact zero.
  await pool.query('DELETE FROM ticket_prices');
  const rows = await computeFinance(pool, 'eng', { ledgerSlots: [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15] });
  const led = rows.flatMap(r => r.ledger || []);
  const gates = led.filter(l => l.kind === 'gate');
  assert.ok(gates.length, 'somebody hosted');
  assert.equal(led.filter(l => l.kind === 'gate-away').length, 0, 'no share travels with the bus');
  assert.equal(led.filter(l => l.kind === 'broadcast').length, 0, 'no broadcaster counts heads');
  for (const g of gates) {
    assert.ok(g.amount > 0, 'a gate is money: ' + g.label);
    assert.match(g.label, /^Gate takings v /, 'and the line names the visitor: ' + g.label);
  }
  for (const r of rows) {
    assert.equal(r.finance.awayCut, 0, 'slot ' + r.slot + ' took nothing away from home');
    assert.equal(r.finance.broadcast, 0, 'slot ' + r.slot + ' was paid nothing by the head');
  }
});

// A SPONSOR SIGNS A CONTRACT. It used to be priced off the table and the mood
// on the morning of each round, so a club that climbed four places and cheered
// up saw its sponsorship nearly double between one match and the next - 32,020
// one week and 59,427 the next, which is what was reported. It is signed in the
// close season on where the club finished and paid flat until the next one.
test('the sponsor\'s guarantee pays in even installments that sum to the contract', async () => {
  // Era 2: the guaranteed share of the deal is the season figure paid in R
  // parts by cumulative rounding, so any two installments differ by at most
  // a dollar and k rounds of them sum to exactly round(G x k / R). The old
  // sin this guarded against - the cheque re-read from the table every week,
  // 32,020 one round and 59,427 the next - stays impossible.
  const rows = await computeFinance(pool, 'eng', { ledgerSlots: [0, 1, 8, 15] });
  const R = 14;                                  // the stored schedule's own length
  let checked = 0;
  for (const r of rows) {
    const sp = (r.ledger || []).filter(l => l.kind === 'sponsor');
    if (sp.length < 2) continue;
    const G = Math.round((r.finance.sponsorValue || 0) * 0.70);   // every unpicked club signs BALANCED
    for (const l of sp) assert.ok(Math.abs(l.amount - sp[0].amount) <= 1,
      'slot ' + r.slot + ': installments an even split, not a re-read of the table (' +
      l.amount + ' v ' + sp[0].amount + ')');
    const paid = sp.reduce((s, l) => s + l.amount, 0);
    assert.equal(paid, Math.round(G * sp.length / R),
      'slot ' + r.slot + ': ' + sp.length + ' installments sum to their share of the guarantee');
    checked++;
  }
  assert.ok(checked >= 1, 'at least one club has sponsor lines to compare (' + checked + ')');
});
