// tests/world-market.test.mjs — THE TRANSFER MARKET, proved.
//
// The obligations, in the order a deal meets them:
//   1. a man is worth something sane, and the shape of a side says who is
//      surplus and what a club is short of;
//   2. the umpire puts bot clubs' spare men up, seeded so a re-run lists the
//      same cricketer;
//   3. the sealed bid: an offer under the floor is refused, an offer over
//      the bank is refused, one club has one offer, nobody can read another
//      club's number;
//   4. the hammer: highest at or above the reserve takes him, and a tie is
//      broken by seed rather than by who clicked first;
//   5. the man MOVES - out of one squad, into the other, with the round he
//      arrived stamped on him;
//   6. his CAREER moves with him: a cheque does not erase four hundred runs;
//   7. the money moves, walked out of the record by the books, and settling
//      twice pays once;
//   8. a scout's report is words and bands - never a rival's numbers.
import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { execSync } from 'node:child_process';
import { makePool } from '../db.mjs';
import { migrate } from '../migrate.mjs';
import { initWorld } from '../init-world.mjs';
import { makeHost } from '../enginehost.mjs';
import { runDue } from '../tick.mjs';
import { computeFinance } from '../economy.mjs';
import { evolveCountry, withCarry } from '../living.mjs';
import {
  WINDOW_DAYS, MIN_BID_PCT, SQUAD_FLOOR, valueOf, ageCurve, roleOf,
  surplusRank, needRank, botBid, pickWinner, scoutReport, scoutFee, classOf,
  openBotListings, placeBotBids, closeListings, computeMarket, rebuildMarket,
  openFreeAgents, FREE_AGENT_SLOT, BID_STEP, MARKET_FLOOR
} from '../market.mjs';
import { EPOCH, DAY } from '../clock.mjs';

const DBNAME = 'foworld_market_test';
let pool, host;
const START = 101;
const T0 = EPOCH + 100 * DAY + 12 * 3600000;
const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
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

// ---- the arithmetic, as pure functions ------------------------------------
const man = (name, extra = {}) => ({ name, age: 27, rating: 36000, fee: 60000, wage: 1500,
  formIx: 3, skills: { vsPace: 60, vsSpin: 58, rotation: 55, temperament: 60, power: 50,
    wicket: 40, economy: 40, discipline: 40, moveTurn: 35, variation: 35, stamina: 45,
    fielding: 55, catching: 55, keeping: 8, stumping: 6 }, ...extra });

test('a man is worth what he can still give you', () => {
  const prime = man('prime', { age: 27 });
  const kid = man('kid', { age: 20 });
  const old = man('old', { age: 34 });
  assert.ok(valueOf(kid) > valueOf(prime), 'youth is dearer: there are years in him');
  assert.ok(valueOf(old) < valueOf(prime), 'and a man of thirty-four is cheaper');
  assert.ok(ageCurve(20) > ageCurve(27) && ageCurve(27) > ageCurve(34));
  const hot = man('hot', { formIx: 6 }), cold = man('cold', { formIx: 0 });
  assert.ok(valueOf(hot) > valueOf(cold), 'and form is money');
  assert.ok(valueOf(man('x')) >= 5000, 'nobody is worthless');
});

test('the shape of a side says who is surplus and what it is short of', () => {
  const squad = [];
  for (let i = 0; i < 9; i++) squad.push(man('bat' + i, { rating: 40000 - i * 900 }));
  for (let i = 0; i < 2; i++) squad.push(man('seam' + i, { rating: 35000, bowlType: 'seamFast', bowlTypeFull: 'seamFast' }));
  squad.push(man('keep', { keeper: true, rating: 33000 }));
  squad.push(man('old', { age: 35, rating: 26000, wage: 4200 }));
  const sur = surplusRank(squad);
  assert.equal(sur[0].p.name, 'old', 'the dear old man behind better players goes first');
  const need = needRank(squad);
  assert.ok(need[0].short >= 3, 'and it is badly short of somebody');
  assert.ok(['seam', 'spin', 'allrounder'].includes(need[0].role),
    'a side of ten batsmen wants bowlers, not another batsman');
  assert.equal(need[need.length - 1].role, 'bat', 'batting is the last thing it needs');
  assert.equal(roleOf(squad[10]), 'seam');
  assert.equal(roleOf(squad[11]), 'keeper');
});

test('a bot club bids for what it needs and never past its bank', () => {
  const thin = [man('a'), man('b', { keeper: true })];      // short of everything
  const target = man('quick', { bowlType: 'seamFast', bowlTypeFull: 'seamFast', rating: 39000 });
  const L = { id: 1, asking: 60000, buyerKey: 'eng:3' };
  assert.ok(botBid(L, thin, 5000000, target) > 0, 'a club short of seamers goes after one');
  assert.equal(botBid(L, thin, 40000, target), 0, 'but not with forty thousand in the bank');
  const full = [];
  for (let i = 0; i < 18; i++) full.push(man('f' + i, { rating: 44000 }));
  assert.equal(botBid(L, full, 9000000, target), 0, 'and a full staff buys nobody');
  // the same auction, twice: the same number
  assert.equal(botBid(L, thin, 5000000, target), botBid(L, thin, 5000000, target));
});

test('the hammer: highest over the reserve, and a tie is not a race', () => {
  const L = { id: 42, reserve: 50000 };
  assert.equal(pickWinner(L, [{ country_id: 'eng', slot: 1, amount: 40000 }]), null,
    'under the reserve he does not go');
  const w = pickWinner(L, [
    { country_id: 'eng', slot: 1, amount: 60000 },
    { country_id: 'aus', slot: 4, amount: 75000 },
    { country_id: 'ire', slot: 2, amount: 51000 }]);
  assert.equal(w.country_id, 'aus');
  const tied = [{ country_id: 'eng', slot: 1, amount: 70000 }, { country_id: 'zim', slot: 8, amount: 70000 }];
  const a = pickWinner(L, tied), b = pickWinner(L, tied.slice().reverse());
  assert.equal(a.country_id, b.country_id, 'the same tie breaks the same way, whatever the row order');
});

test('a scout gives you words and bands, never his numbers', () => {
  const p = man('target', { talents: ['anchor', 'safeHands'], btLabel: 'Right arm fast',
    bowlType: 'seamFast', bowlTypeFull: 'seamFast', expWord: 'reliable', fatWord: 'rested' });
  const free = scoutReport(p, false);
  assert.equal(free.paid, false);
  assert.ok(free.impression && typeof free.impression === 'string');
  assert.equal(free.batting, undefined, 'an unpaid look gets no numbers at all');
  const paid = scoutReport(p, true);
  assert.ok(/^\d+-\d+$/.test(paid.batting), 'a paid look gets a band');
  assert.ok(/^\d+-\d+$/.test(paid.bowling));
  const j = JSON.stringify(paid);
  assert.ok(!/"vsPace"|"wicket"|"skills"/.test(j), 'and never the skill values themselves');
  assert.ok(scoutFee(p) >= 4000);
  assert.ok(classOf(60000).length && classOf(1000).length);
});

// ---- the world, trading ---------------------------------------------------
before(async () => {
  try { execSync('dropdb --if-exists ' + DBNAME); } catch {}
  execSync('createdb ' + DBNAME);
  process.env.PGDATABASE = DBNAME;
  pool = makePool();
  await migrate(pool);
  host = makeHost();
  assert.equal((await initWorld(pool, { now: T0, host })).created, true);
  await runDue(pool, host, 'eng', { now: atDay(START + 1, 23) });   // two rounds of cricket
});
after(async () => { await pool.end(); });

test('the umpire puts bot clubs spare men up, and does it the same way twice', async () => {
  // a club sheds a man now and then, not every round, so the board fills over
  // days rather than all at once. Walk a few and it is never empty for long.
  const day = START + 2;
  let first = [], round = 3;
  for (; round <= 8 && !first.length; round++) first = await openBotListings(pool, 'eng', 1, round, atDay(day, 6));
  round--;
  assert.ok(first.length >= 1, 'within a few rounds somebody in England is surplus to requirements');
  for (const L of first) {
    assert.ok(L.asking > 0);
    const c = (await pool.query(
      `SELECT (cu.user_id IS NOT NULL) AS managed FROM clubs cl
         LEFT JOIN claims cu ON cu.country_id=cl.country_id AND cu.slot=cl.slot
        WHERE cl.country_id='eng' AND cl.slot=$1`, [L.slot])).rows[0];
    assert.equal(c.managed, false, 'the umpire never lists a managed club\'s man');
  }
  // named once: running the same round again adds nobody
  const again = await openBotListings(pool, 'eng', 1, round, atDay(day, 9));
  assert.equal(again.length, 0, 'the same round lists the same men, which is to say none more');
  const open = (await pool.query(`SELECT * FROM listings WHERE status='open'`)).rows;
  assert.ok(open.length >= first.length);
  for (const L of open) assert.equal(L.closes_day, L.opened_day + WINDOW_DAYS);
});

test('the open bid: the floor, the bank, and the board must be beaten', async () => {
  // seated directly at a first-division county: the claim DOORS only open
  // onto Division Two now (proved in world-conditions), and the market's laws
  // must hold for any managed club.
  await pool.query(
    `INSERT INTO claims(user_id, display_name, country_id, slot) VALUES ($1,'Santosh','eng',1)`, [U1]);
  const L = (await pool.query(`SELECT * FROM listings WHERE status='open' ORDER BY id LIMIT 1`)).rows[0];
  const low = Math.round(L.asking * MIN_BID_PCT) - 1000;
  await assert.rejects(
    as(U1, `SELECT public.world_market_bid($1, $2)`, [L.id, low], atDay(START + 2, 10)),
    /offer at least/);
  await assert.rejects(
    as(U1, `SELECT public.world_market_bid($1, $2)`, [L.id, 900000000], atDay(START + 2, 10)),
    /bank will not cover/);
  // THE RAISE IS THREE PER CENT OR $500, WHICHEVER IS MORE (054). A flat
  // +5,000 used to clear that because a listing was tens of thousands; a fee
  // is a season of wages now, so an asking price runs into the millions and
  // three per cent of it is tens of thousands on its own. The bid is computed
  // from the law rather than from a number that happened to beat it once.
  // A bid comfortably clear of every floor - the reserve, the asking price and
  // the three-per-cent raise - so what this test is actually about (the floor,
  // the bank and the board) is not decided by arithmetic that moves whenever
  // the fee scale does. It is read back afterwards rather than assumed.
  const first = Math.ceil(L.asking * 1.25);
  const ok = await as(U1, `SELECT public.world_market_bid($1, $2) AS r`,
    [L.id, first], atDay(START + 2, 10));
  assert.equal(ok.rows[0].r.ok, true);
  // the board stands: an offer that does not beat it by the step is refused
  await assert.rejects(
    as(U1, `SELECT public.world_market_bid($1, $2)`, [L.id, first], atDay(START + 2, 11)),
    /offer at least/);
  const high0 = first;
  const pctStep = Math.max(500, Math.ceil(high0 * 0.03));
  if (pctStep > 500) {
    await assert.rejects(
      as(U1, `SELECT public.world_market_bid($1, $2)`, [L.id, high0 + 500], atDay(START + 2, 11)),
      /offer at least/, 'a $500 nibble over a big board is refused - the law wants 3%');
  }
  // raising replaces rather than stacks. The raise has to clear the board this
  // club already holds, which is `first` and not the asking price - a flat
  // asking+9000 was below its own standing bid once a fee became a season of
  // wages, and the umpire rightly refused it.
  const second = Math.ceil(high0 * 1.05);
  await as(U1, `SELECT public.world_market_bid($1, $2)`, [L.id, second], atDay(START + 2, 11));
  const mine = (await pool.query('SELECT * FROM bids WHERE listing_id=$1', [L.id])).rows;
  assert.equal(mine.length, 1);
  assert.equal(mine[0].amount, second);
  // and the board is OPEN by decree: the standing high, its holder, and the
  // reserve are all public - only skills stay the scout's trade
  const board = (await pool.query('SELECT * FROM world_listings WHERE id=$1', [L.id])).rows[0];
  assert.equal(board.offers, 1);
  assert.equal(Number(board.high), second, 'the high bid is on the board');
  assert.ok(board.high_club, 'and so is who holds it');
  // 053: the bidder's ADDRESS is public too, so his name can be a door
  assert.equal(board.high_country, 'eng');
  assert.equal(Number(board.high_slot), 1, 'the leading club\'s seat rides the view');
  assert.equal(Number(board.reserve), L.reserve, 'and the reserve');
  // an offer made in the open stands
  await assert.rejects(as(U1, `SELECT public.world_market_unbid($1)`, [L.id]), /stands/);
});

test('a manager lists his own man, and cannot gut his own club', async () => {
  const squad = (await pool.query(`SELECT squad FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].squad;
  const nm = squad[squad.length - 1].name;
  const r = await as(U1, `SELECT public.world_market_list($1, $2) AS r`, [nm, 30000], atDay(START + 2, 12));
  assert.equal(r.rows[0].r.ok, true);
  assert.equal(r.rows[0].r.closes, START + 2 + WINDOW_DAYS);
  await assert.rejects(as(U1, `SELECT public.world_market_list($1, $2)`, ['Nobody At All', 30000]),
    /does not play for you/);
  // he may take him back while nobody wants him
  const lid = r.rows[0].r.id;
  const w = await as(U1, `SELECT public.world_market_withdraw($1) AS r`, [lid], atDay(START + 2, 13));
  assert.equal(w.rows[0].r.ok, true);
  assert.equal((await pool.query('SELECT status FROM listings WHERE id=$1', [lid])).rows[0].status, 'withdrawn');
});

test('the hammer falls: the man moves, his book moves, the money moves', async () => {
  const L = (await pool.query(`SELECT * FROM listings WHERE status='open' ORDER BY id LIMIT 1`)).rows[0];
  const sellerBefore = (await pool.query(
    'SELECT squad FROM clubs WHERE country_id=$1 AND slot=$2', [L.country_id, L.slot])).rows[0].squad;
  const buyerBefore = (await pool.query(
    `SELECT squad FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].squad;
  // give him a record worth carrying
  await evolveCountry(pool, 'eng', atDay(START + 2, 12), host);
  const withBook = (await pool.query(
    'SELECT squad FROM clubs WHERE country_id=$1 AND slot=$2', [L.country_id, L.slot])).rows[0].squad;
  const before = withBook.find(p => p.name === L.player);
  const priorRuns = (before && before.career && before.career.runs) || 0;

  const closeDay = L.closes_day;
  const out = await closeListings(pool, { now: atDay(closeDay, 6) });
  const mine = out.find(x => x.id === L.id);
  assert.ok(mine && mine.sold, 'the window shut and he was sold');
  assert.equal(mine.to, 'eng:1', 'to the only manager bidding');

  const sellerAfter = (await pool.query(
    'SELECT squad FROM clubs WHERE country_id=$1 AND slot=$2', [L.country_id, L.slot])).rows[0].squad;
  const buyerAfter = (await pool.query(
    `SELECT squad FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].squad;
  assert.equal(sellerAfter.length, sellerBefore.length - 1, 'one out');
  assert.equal(buyerAfter.length, buyerBefore.length + 1, 'and one in');
  assert.ok(!sellerAfter.some(p => p.name === L.player));
  const moved = buyerAfter.find(p => p.name === L.player);
  assert.ok(moved, 'he is on his new club\'s books');
  assert.ok(moved.joined && moved.joined.r > 0, 'stamped with the round he arrived');
  assert.equal(moved.from.slot, L.slot, 'and where he came from');
  if (priorRuns > 0) assert.equal(moved.carry.runs, priorRuns, 'his runs travelled with him');

  // and the living layer hands them back on top of whatever he does next
  await evolveCountry(pool, 'eng', atDay(closeDay, 7), host);
  const after = (await pool.query(
    `SELECT squad FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].squad.find(p => p.name === L.player);
  assert.equal((after.career || {}).runs || 0, priorRuns, 'the book is his, at the new ground');
});

test('the books walk the deal, and settling twice pays once', async () => {
  const deal = (await pool.query(
    `SELECT * FROM listings WHERE status='sold' ORDER BY id LIMIT 1`)).rows[0];
  assert.ok(deal, 'there is a deal to account for');
  const fin = await computeFinance(pool, 'eng');
  const buyer = fin.find(f => f.slot === 1);
  const seller = fin.find(f => f.slot === deal.slot);
  assert.equal(buyer.finance.feesOut, deal.fee, 'the buyer paid exactly the fee');
  assert.equal(buyer.finance.bought, 1);
  assert.equal(seller.finance.feesIn, deal.fee, 'and the seller banked exactly the fee');
  assert.equal(seller.finance.sold, 1);
  // the ledger identity still closes with the market in it
  for (const f of fin) {
    const x = f.finance;
    const expect = x.founded + x.gate + x.awayCut + (x.broadcast || 0) + x.sponsor + (x.compensation || 0)
      + (x.media || 0) + (x.prize || 0) + (x.sponsorBonus || 0)
      + (x.feesIn || 0) + x.writtenOff
      - x.wages - (x.ops || 0) - x.upkeep - x.interest - x.academyPaid - x.seatsPaid
      - (x.feesOut || 0) - (x.scouting || 0);
    assert.equal(Number(f.bank), Math.round(expect), 'club ' + f.slot + ': the books add up');
  }
  const again = await computeFinance(pool, 'eng');
  assert.deepEqual(again.map(f => f.bank), fin.map(f => f.bank), 'and they never drift');
});

test('the hammer has a minute hand: exact close, and a late blow moves it back (052)', async () => {
  await pool.query(
    `INSERT INTO claims(user_id, display_name, country_id, slot) VALUES ($1,'Rival','eng',2)`, [U2]);
  const squad = (await pool.query(`SELECT squad FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].squad;
  const nm = squad[squad.length - 1].name;
  const t0 = atDay(START + 3, 9);
  const r = (await as(U1, `SELECT public.world_market_list($1, $2) AS r`, [nm, 10000], t0)).rows[0].r;
  assert.equal(Number(r.closesMs), t0 + 3 * DAY, 'a manager listing shuts exactly three days out, to the minute');
  const lid = r.id, ask = Number(r.asking);
  // a blow landed with nine minutes on the clock moves the hammer back to ten
  const late = t0 + 3 * DAY - 9 * 60000;
  const b = (await as(U2, `SELECT public.world_market_bid($1, $2) AS r`, [lid, ask + 5000], late)).rows[0].r;
  assert.equal(Number(b.closesMs), late + 600000, 'going, going... and ten minutes back on the clock');
  const shut = Number(b.closesMs);
  // once it falls, no blow lands - however good the money
  await assert.rejects(
    as(U2, `SELECT public.world_market_bid($1, $2)`, [lid, ask + 50000], shut + 1),
    /hammer has fallen/);
  // and the umpire settles by the minute hand, not the old day boundary
  const out = await closeListings(pool, { now: shut + 120000 });
  const mine = out.find(x => Number(x.id) === Number(lid));
  assert.ok(mine && mine.sold, 'settled on the umpire\'s next pass');
  const row = (await pool.query(
    `SELECT status, buyer_country, buyer_slot FROM listings WHERE id=$1`, [lid])).rows[0];
  assert.equal(row.status, 'sold');
  assert.equal(row.buyer_country + ':' + row.buyer_slot, 'eng:2', 'to the club that fought the war');
});

test('a scout is paid for, and the report is only for the club that paid', async () => {
  const L = (await pool.query(`SELECT * FROM listings WHERE status='open' ORDER BY id LIMIT 1`)).rows[0]
    || (await openBotListings(pool, 'eng', 1, 5, atDay(START + 4, 6)),
        (await pool.query(`SELECT * FROM listings WHERE status='open' ORDER BY id LIMIT 1`)).rows[0]);
  assert.ok(L, 'there is somebody to look at');
  const r = await as(U1, `SELECT public.world_market_scout($1) AS r`, [L.id], atDay(START + 4, 7));
  assert.equal(r.rows[0].r.paid, true);
  assert.ok(r.rows[0].r.fee >= 4000);
  const paid = (await pool.query('SELECT * FROM scouted WHERE listing_id=$1', [L.id])).rows;
  assert.equal(paid.length, 1);
  // a second look is free - you already have the report
  const r2 = await as(U1, `SELECT public.world_market_scout($1) AS r`, [L.id], atDay(START + 4, 8));
  assert.equal(r2.rows[0].r.again, true);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM scouted WHERE listing_id=$1', [L.id])).rows[0].n, 1);
  // and it is on the manager's own page, not on the board
  const mine = (await as(U1, `SELECT public.world_market_mine() AS m`)).rows[0].m;
  assert.ok((mine.reports || []).some(x => x.id === Number(L.id)));
  const board = await computeMarket(pool);
  const onBoard = board.listings.find(x => Number(x.id) === Number(L.id));
  assert.ok(onBoard && onBoard.scout && onBoard.scout.paid === false, 'the board shows the free impression only');
});

test('bot clubs shop in the open, and the bidding war ends at the caps', async () => {
  await openBotListings(pool, 'eng', 1, 6, atDay(START + 5, 6));
  const placed = await placeBotBids(pool, atDay(START + 5, 7));
  assert.ok(placed.length >= 1, 'somebody in the league fancied somebody');
  for (const b of placed) assert.ok(b.amount > 0);
  // open outcry: rivals leapfrog by the step, each capped by his seeded
  // appetite, so repeated settles CONVERGE rather than repeat
  let rounds = 0, more = placed.length;
  while (more && rounds < 60) { more = (await placeBotBids(pool, atDay(START + 5, 8))).length; rounds++; }
  assert.ok(rounds < 60, 'the war ends: every club reaches its cap');
  const again = await placeBotBids(pool, atDay(START + 5, 9));
  assert.equal(again.length, 0, 'and a settled board re-settles to itself');
});

test('the board is publishable: open prices, open cards (052)', async () => {
  const body = await rebuildMarket(pool);
  assert.ok(body.listings.length >= 0 && Array.isArray(body.deals));
  assert.equal(body.windowDays, WINDOW_DAYS);
  assert.equal(body.step, BID_STEP);
  const j = JSON.stringify(body);
  assert.ok(/"reserve"/.test(j), 'the open board carries the reserve');
  // THE CARD IS OPEN (052): a listed man's full skills ride the board for
  // everyone to read - the fog stays only on the unlisted
  assert.ok(body.listings.length > 0, 'the suite has put names on the board by now');
  for (const L of body.listings) {
    assert.ok(L.man && L.man.name, 'every listing carries the man\'s own card');
    assert.ok(L.man.skills && typeof L.man.skills === 'object', 'and the card is open: skills and all');
    assert.ok(L.closesMs == null || L.closesMs > 0, 'the hammer carries a minute hand where the row has one');
  }
  const bidOn = body.listings.find(x => x.bids > 0);
  if (bidOn) {
    assert.ok(bidOn.high > 0, 'the standing high is on the board');
    assert.ok(bidOn.highClub, 'with the club that holds it');
  }
  const snap = (await pool.query(`SELECT body FROM snapshots WHERE key='market'`)).rows[0];
  assert.ok(snap && snap.body.listings);
});

test('the free-agent trickle: the board never stands shorter than twenty', async () => {
  const d = START + 6;
  const beforeN = (await pool.query(
    `SELECT count(*)::int AS n FROM listings WHERE country_id='eng' AND status='open'`)).rows[0].n;
  const first = await openFreeAgents(pool, host, 'eng', 1, d);
  assert.ok(first.length >= 1, 'men walk onto the board');
  const openN = (await pool.query(
    `SELECT count(*)::int AS n FROM listings WHERE country_id='eng' AND status='open'`)).rows[0].n;
  assert.ok(openN >= MARKET_FLOOR, 'the owner\'s law: at least twenty names stand (' + openN + ')');
  assert.ok(openN >= beforeN, 'and nobody was taken down to make room');
  const again = await openFreeAgents(pool, host, 'eng', 1, d);
  assert.equal(again.length, 0, 'the same day trickles the same men, which is to say none more');
  const rows = (await pool.query(
    `SELECT * FROM listings WHERE slot=$1 AND status='open' ORDER BY id`, [FREE_AGENT_SLOT])).rows;
  assert.ok(rows.length >= first.length);
  // no double names: every free agent on the board is a name the league has
  // never contracted, or a purchase would shadow a man already employed
  for (const L2 of rows) {
    const clash = await pool.query(
      `SELECT 1 FROM clubs, jsonb_array_elements(squad) p
        WHERE country_id='eng' AND p->>'name' = $1 LIMIT 1`, [L2.player]);
    assert.equal(clash.rowCount, 0, L2.player + ' is nobody\'s double');
  }
  for (const L of rows) {
    assert.equal(L.closes_day, L.opened_day + WINDOW_DAYS);
    assert.ok(L.asking >= 5000 && L.reserve <= L.asking, 'priced like anybody else');
  }
  // and the board names him honestly
  const board = (await pool.query('SELECT * FROM world_listings WHERE id=$1', [rows[0].id])).rows[0];
  assert.equal(board.club, 'Free agent');
  // a manager signs him: the hammer moves him in from nowhere
  const L = rows[0];
  const before = (await pool.query(
    `SELECT squad FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].squad;
  await as(U1, `SELECT public.world_market_bid($1,$2)`, [L.id, L.asking + 2000], atDay(d, 10));
  const out = await closeListings(pool, { now: atDay(L.closes_day, 6) });
  const mine = out.find(x => x.id === L.id);
  assert.ok(mine && mine.sold, 'sold to the manager');
  const after = (await pool.query(
    `SELECT squad FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].squad;
  assert.equal(after.length, before.length + 1, 'in from nowhere: no club lost him');
  const him = after.find(p => p.name === L.player);
  assert.ok(him && him.from && him.from.slot === FREE_AGENT_SLOT, 'stamped as a free-agent signing');
});

test('quick-sell and release: a manager\'s own two doors out', async () => {
  const sq0 = (await pool.query(
    `SELECT squad FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].squad;
  const nmQ = sq0[sq0.length - 1].name;
  const r = await as(U1, `SELECT public.world_market_quicksell($1) AS r`, [nmQ], atDay(START + 7, 6));
  assert.equal(r.rows[0].r.ok, true);
  assert.ok(r.rows[0].r.fee >= 3000, 'the bank pays real money');
  const sq1 = (await pool.query(
    `SELECT squad FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].squad;
  assert.equal(sq1.length, sq0.length - 1, 'and he is gone');
  const row = (await pool.query(
    `SELECT * FROM listings WHERE player=$1 AND buyer_country='bank'`, [nmQ])).rows[0];
  assert.ok(row && row.status === 'sold' && Number(row.fee) === r.rows[0].r.fee,
    'recorded as a settled sale to the bank');
  // the books walk the quick-sell like any deal, and the identity closes
  const fin = await computeFinance(pool, 'eng');
  for (const f of fin) {
    const x = f.finance;
    const expect = x.founded + x.gate + x.awayCut + (x.broadcast || 0) + x.sponsor + (x.compensation || 0)
      + (x.media || 0) + (x.prize || 0) + (x.sponsorBonus || 0)
      + (x.feesIn || 0) + x.writtenOff
      - x.wages - (x.ops || 0) - x.upkeep - x.interest - x.academyPaid - x.seatsPaid
      - (x.feesOut || 0) - (x.scouting || 0);
    assert.equal(Number(f.bank), Math.round(expect), 'club ' + f.slot + ': the books add up');
  }
  // release: gone for nothing, remembered as let go
  const nmR = sq1[sq1.length - 1].name;
  const r2 = await as(U1, `SELECT public.world_market_release($1) AS r`, [nmR], atDay(START + 7, 7));
  assert.equal(r2.rows[0].r.ok, true);
  const sq2 = (await pool.query(
    `SELECT squad FROM clubs WHERE country_id='eng' AND slot=1`)).rows[0].squad;
  assert.equal(sq2.length, sq1.length - 1);
  const rel = (await pool.query(
    `SELECT * FROM listings WHERE player=$1 AND buyer_country='released'`, [nmR])).rows[0];
  assert.ok(rel && Number(rel.fee) === 0, 'a release is a fee of nothing');
  // and neither door opens onto another club's man
  await assert.rejects(
    as(U1, `SELECT public.world_market_quicksell($1)`, ['Nobody At All'], atDay(START + 7, 8)),
    /does not play for you/);
});

test('a career carried is a career added, not replaced', () => {
  const carry = { m: 4, runs: 300, balls: 280, hs: 120, wkts: 2, conc: 90, ovb: 60, bb: { w: 2, r: 30 } };
  const here = { m: 2, runs: 50, balls: 60, hs: 40, wkts: 3, conc: 70, ovb: 72, bb: { w: 3, r: 40 } };
  const all = withCarry(here, carry);
  assert.equal(all.m, 6);
  assert.equal(all.runs, 350);
  assert.equal(all.hs, 120, 'his best stays his best');
  assert.equal(all.bb.w, 3, 'and so do his best figures');
  assert.deepEqual(withCarry(here, null), here);
  assert.equal(withCarry(null, carry).runs, 300);
});

test('auto bid: the umpire names the smallest lawful figure (067)', async () => {
  // a fresh listing of the umpire's own, far from the suite's other hammers
  await pool.query(`INSERT INTO claims(user_id, display_name, country_id, slot)
                    VALUES ($1,'Rival','eng',2) ON CONFLICT DO NOTHING`, [U2]);
  const ins = await pool.query(
    `INSERT INTO listings(country_id, slot, player, player_json, asking, reserve, opened_day, closes_day)
     VALUES ('eng', 5, 'Auto Test Man', '{"name":"Auto Test Man","age":26,"rating":30000}'::jsonb,
             1000000, 600000, $1, $2) RETURNING id`, [START + 8, START + 8 + WINDOW_DAYS]);
  const id = ins.rows[0].id;
  const at = atDay(START + 8, 10);
  // 1. a clean board: auto opens at the 55% floor
  const r1 = await as(U2, `SELECT public.world_market_bid($1, NULL) AS r`, [id], at);
  assert.equal(r1.rows[0].r.ok, true);
  assert.equal(+r1.rows[0].r.amount, Math.ceil(1000000 * 0.55), 'auto on a clean board is the opening floor');
  // 2. auto while leading is refused, not raised against yourself
  await assert.rejects(
    as(U2, `SELECT public.world_market_bid($1, NULL)`, [id], at),
    /already lead/);
  // 3. a rival takes the board; auto answers with high + max($500, 3%)
  const rivalBid = 700000;
  await as(U1, `SELECT public.world_market_bid($1, $2)`, [id, rivalBid], at);
  const r2 = await as(U2, `SELECT public.world_market_bid($1, NULL) AS r`, [id], at);
  const want = rivalBid + Math.max(500, Math.ceil(rivalBid * 0.03));
  assert.equal(+r2.rows[0].r.amount, want, 'auto over a standing high is the three-percent law, exactly');
  const board = (await pool.query(
    `SELECT country_id, slot, amount FROM bids WHERE listing_id=$1 ORDER BY amount DESC`, [id])).rows;
  assert.equal(+board[0].amount, want, 'and the board agrees');
});
