// tests/world-register.test.mjs — THE TRANSFER REGISTER, AND WHAT SEASON IT IS.
//
// Every club has kept a transfer register since 038: what it has paid out,
// what it has recouped, and the ledger of every deal with the club at the
// other end of it. Nothing linked to it. No tab named it and no card pointed
// at it, so the one page that answers "is this a buying club or a selling
// one" - the question you ask before you deal with somebody - could only be
// reached by typing its address, and in practice never was.
//
// Which is how its Season column went on being wrong. It answered by
// arithmetic - (settled_day / 35) + 1 - and a season is forty-two days
// (clock.mjs, CYCLE). Every deal outside the first thirty-five days of the
// world carried the wrong year, drifting by one for every forty-two that
// passed. The arithmetic was the wrong instrument anyway: seasons are ROWS,
// one per country per year, each with the day it began, and a country keeps
// its own calendar. 080 asks the table.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld } from '../init-world.mjs';
import { makeHost } from '../enginehost.mjs';
import { EPOCH, DAY, CYCLE } from '../clock.mjs';

const DBNAME = 'foworld_register_test';
let pool;
const T0 = EPOCH + 100 * DAY + 12 * 3600000;
const START = 101;                                       // initWorld's start day

async function register(slot, lim) {
  return (await pool.query('SELECT world_club_transfers($1,$2,$3) r', ['eng', slot, lim || 100])).rows[0].r;
}
// a settled deal on a given world day, from slot -> to slot (-1 = the market)
async function deal(day, fromSlot, toSlot, player, fee, age) {
  await pool.query(
    `INSERT INTO listings(country_id, slot, player, player_json, asking, reserve,
       opened_day, closes_day, status, settled_day, fee, buyer_country, buyer_slot)
     VALUES ('eng', $1, $2, $3::jsonb, $4, $4, $5, $5, 'sold', $5, $4, 'eng', $6)`,
    [fromSlot, player, JSON.stringify({ age }), fee, day, toSlot]);
}

before(async () => {
  try { execSync('dropdb --if-exists ' + DBNAME); } catch {}
  execSync('createdb ' + DBNAME);
  process.env.PGDATABASE = DBNAME;
  pool = makePool();
  await migrate(pool);
  await initWorld(pool, { now: T0, host: makeHost() });
  // three more years on the calendar, so a deal has a season to fall in
  for (const n of [2, 3, 4]) {
    await pool.query(
      `INSERT INTO seasons(country_id, season_no, start_day, schedule)
       SELECT 'eng', $1, $2, schedule FROM seasons WHERE country_id='eng' AND season_no=1
       ON CONFLICT DO NOTHING`, [n, START + (n - 1) * CYCLE]);
  }
  // one deal in each of the four seasons, plus one before any of them began
  await deal(START + 3, 0, 1, 'Gerrie Koopman', 171085, 30);          // season 1
  await deal(START + CYCLE + 5, 1, 0, 'Frans Balk', 71830, 28);       // season 2
  await deal(START + 2 * CYCLE + 9, 0, 1, 'Wallace Renfrey', 35000, 20);   // season 3
  await deal(START + 3 * CYCLE + 1, -1, 1, 'Ethan Roche', 1000, 20);  // season 4, off the market
  await deal(START - 4, 0, 1, 'Old Hand', 5000, 33);                  // before season 1
});
after(async () => { await pool.end(); });

test('the season of a deal is the season it fell in, read off the calendar', async () => {
  const r = await register(1);
  const by = {};
  (r.deals || []).forEach(d => { by[d.player] = d.season; });
  assert.equal(by['Gerrie Koopman'], 1);
  assert.equal(by['Frans Balk'], 2);
  assert.equal(by['Wallace Renfrey'], 3);
  assert.equal(by['Ethan Roche'], 4);
  // a day before the first season began has no season to name, and says one
  assert.equal(by['Old Hand'], 1, 'the founding market belongs to season one');
  // and the arithmetic it replaced would have said something else
  assert.notEqual(Math.floor((START + 3 * CYCLE + 1) / 35) + 1, 4,
    'the old (day/35)+1 really did disagree - this test would be vacuous otherwise');
});

test('the register balances: what went out, what came in, and the net of them', async () => {
  const r = await register(1);
  assert.equal(r.ok, true);
  assert.equal(r.transfers, 5, 'five deals touch this club');
  assert.equal(r.bought, 4, 'four in');
  assert.equal(r.sold, 1, 'one out');
  assert.equal(+r.spent, 171085 + 35000 + 1000 + 5000);
  assert.equal(+r.received, 71830);
  assert.equal(+r.net, +r.received - +r.spent);
  assert.equal(+r.avgBuy, Math.round(+r.spent / r.bought));
  assert.equal(+r.avgSell, Math.round(+r.received / r.sold));
});

test('a deal names the club at the other end, and only where there is one', async () => {
  const r = await register(1);
  const by = {};
  (r.deals || []).forEach(d => { by[d.player] = d; });
  assert.equal(by['Gerrie Koopman'].way, 'in');
  assert.equal(by['Gerrie Koopman'].how, 'club');
  assert.ok(by['Gerrie Koopman'].oppName, 'a club deal names the seller');
  assert.equal(by['Gerrie Koopman'].oppSlot, 0);
  assert.equal(by['Frans Balk'].way, 'out', 'the same club sold this one');
  // a man off the open market has no club behind him, and is not given one
  assert.equal(by['Ethan Roche'].how, 'free');
  assert.equal(by['Ethan Roche'].oppName, null);
  assert.equal(by['Ethan Roche'].oppSlot, null);
});

test('the ledger runs newest first and carries the age it was written with', async () => {
  const r = await register(1);
  const ats = (r.deals || []).map(d => +d.at);
  assert.deepEqual(ats, ats.slice().sort((a, b) => b - a), 'newest first');
  const koop = (r.deals || []).filter(d => d.player === 'Gerrie Koopman')[0];
  assert.equal(+koop.age, 30, 'his age on the day, off the card that was sold');
  assert.equal(+koop.fee, 171085);
});

test('a club with no deals has a register, not an error', async () => {
  const r = await register(5);
  assert.equal(r.ok, true);
  assert.equal(r.transfers, 0);
  assert.equal(+r.spent, 0);
  assert.equal(+r.received, 0);
  assert.equal(r.avgBuy, null, 'no average where there is nothing to average');
  assert.deepEqual(r.deals, []);
});
