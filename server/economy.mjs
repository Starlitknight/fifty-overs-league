// economy.mjs — THE BOOKS
//
// A club's money used to be four flat numbers. It is now a ledger, walked
// round by round from the day the world was founded, and every line of it is
// derived from the record: who played whom, who won, where each club stood
// that morning, and how many people fancied going.
//
//   supporters -> a crowd that grows on winning and drifts away on losing
//   mood       -> what those supporters think, from recent form and position
//   the gate   -> attendance x the ticket, split two thirds home, one third away
//   sponsors   -> paid by the round, worth more the higher you finish
//   wages      -> the bill as it stands, every round played
//   the academy-> upkeep by the round, and what its upgrades cost
//   the ground -> seats you paid for, and the ceiling they put on a crowd
//   the bank   -> and interest on it when it is the wrong side of nothing
//
// THE LAW HOLDS: nothing here is incremented imperatively and nothing is
// stored that a re-run could not rebuild. Settle it twice and it settles the
// same figure, which is what lets an offline manager trust it.
import { seedOf, dayOfRound, natHour, EPOCH, DAY, COLTS_DAYS } from './clock.mjs';

export const FOUNDING_BANK = 2500000;
export const FOUNDING_SUPPORT = 12000;
export const FOUNDING_SEATS = 15000;

// A BIG CLUB IS BIG BEFORE IT IS GOOD, AND THAT IS WHERE THE GOOD COMES FROM.
//
// The world differentiated STRENGTH and left WEALTH flat. Every one of the 256
// clubs was founded on the same 2.5m, the same 12,000 supporters and the same
// 15,000 seats - while the flagship's dealt squad already cost 22% more in
// wages than the weakest club's out of that identical income. The ladder was
// asserted by the generator and funded by nobody, which is why a flagship had
// no reason to be strong beyond the fact that the code said so.
//
// Stature is what a club IS: the crowd it draws, the ground it fills and the
// capital its board carries. It is derived, not stored - a club's seat in the
// league is already in the row, and slot 0 is a nation's flagship the same way
// it always was. So a bigger club is founded with more money and more people,
// earns more every matchday, and can carry the wage bill of a better squad.
// The strength ladder stops being a decree and becomes a consequence.
export function stature(slot, isBoss) {
  if (isBoss || (slot | 0) === 0) return 1;          // the nation's flagship
  const s = slot | 0;
  if (s <= 7) return 0.86 - 0.035 * (s - 1);          // the rest of division one
  return 0.62 - 0.022 * (s - 8);                      // division two
}
// THE MONEY LADDER HAS TO BE AS STEEP AS THE STRENGTH LADDER.
//
// This is the half of the thought that 012 left undone. It made a flagship
// richer than a bottom club - but only by 37%, while the generator gives that
// flagship a squad whose mean rating is 60% higher. That was survivable only
// because a wage was a straight line in rating: 60% better cost 60% more.
//
// It is not a straight line any more. Quality is priced on a curve, because
// two of a good cricketer is not one great one and a game where it is has no
// decisions in it. The moment wages bend, a 1.37x income against a 1.6x squad
// is a flagship that cannot pay - measured, at 155% of its income - and the
// best club in every nation goes into administration in its first season for
// no reason except that two ladders were built to different gradients.
//
// So the crowd, the ground and the sponsor now climb with stature the way the
// wage bill climbs with rating. A flagship draws roughly two and a half times
// the following of a bottom club rather than a third more, and the pyramid
// pays for the squads it deals.
export function foundingBank(slot, isBoss) {
  // AND THE CAPITAL IS SIZED FOR THE BILL IT HAS TO CARRY. A founding bank
  // was set when a squad cost a fifth of what it costs now; leaving it there
  // meant a club spent its first season solvent but illiquid - earning a fair
  // surplus and still unable to put up a stand, which p3's ledger test caught
  // as a strong club 400k short of 3,000 seats. The ongoing share is right
  // (slot one runs at 73% of income); it was the money in the drawer on day
  // one that was still priced in the old world.
  return Math.round(FOUNDING_BANK * (0.80 + 0.95 * econStature(slot, isBoss)) / 1000) * 1000;
}
export function foundingSeats(slot, isBoss) {
  // THE GROUND IS NOT THE LEVER, AND MAKING IT ONE COSTS A CLUB ITS FUTURE.
  // Steepening this with the crowd looked consistent and was measured to be
  // useless: a full house never happens - at every slot the crowd a club can
  // draw is below the seats it already has, so capacity is a ceiling nobody
  // touches and support alone decides the gate. What the bigger ground DID do
  // was break building. seatBlockPrice indexes the next thousand off a
  // constant 15,000, so a flagship founded on 38,000 was charged as though it
  // had already built twenty-three blocks: $2.94m for its first expansion,
  // more than it could hold. p3's ledger test caught it as a club unable to
  // afford a stand. The ground goes back to what it was; the crowd, the
  // sponsor and the bank carry the standing.
  return Math.round(FOUNDING_SEATS * (1 + 0.95 * econStature(slot, isBoss)) / 1000) * 1000;
}
export function foundingSupport(slot, isBoss) {
  return Math.round(FOUNDING_SUPPORT * (0.40 + 1.62 * Math.pow(econStature(slot, isBoss), 1.45)));
}
// WHAT A CLUB EARNS FOLLOWS WHAT IT MUST PAY, AND PAY STOPS FALLING.
//
// stature() is two things at once: the generator's strength input, and the
// economy's wealth input. They are not the same curve, and measuring showed
// how far apart: mean squad rating over four nations runs 36,064 at the
// flagship down to 25,773 by slot four - and then STOPS, sitting between
// 23,000 and 24,300 for every slot from six to fifteen. The generator has a
// floor on how bad a professional gets. The income ladder had none, so it
// kept descending past the point the squads did, and the bottom club was
// asked to pay a slot-eight wage bill on slot-fifteen money: 115% of income,
// bankrupt for being poor rather than for being weak.
//
// So the economic ladder floors where the strength ladder floors. Above it,
// wealth still climbs steeply with standing; below it, two clubs with the
// same squad have the same means to keep it.
export function econStature(slot, isBoss) {
  return Math.max(0.62, stature(slot, isBoss));
}
export const MAX_SEATS = 45000;
export const TICKET = 26;                    // the league's price, and every bot club's
// ---------------------------------------------------------------------------
// THE TURNSTILE IS YOURS (073). The home club prices its own gate, $10-$100,
// and the crowd answers: demand scales by (26/price)^1.4 times an
// affordability cliff with its knee at $62, so a modest premium thins the
// crowd and a gouged one empties the ground. The skill is the price that
// JUST fills the stands - and it moves with the mood, the visitor and the
// weather.
//
// A GATE IS SOLD IN ADVANCE. Six daily tranches, accelerating toward the
// match, the last of them 24 hours before the first ball - after which the
// crowd is locked, because no sale day remains for a late price to touch.
// Each tranche sells at the price in force on ITS day, so a mid-week price
// change moves only the days still to come. Nothing about this is stored:
// tickets sold so far is a pure function of the dated prices, the demand
// and the clock, which is why the board a manager watches can never
// disagree with the gate the umpire banks.
// ---------------------------------------------------------------------------
// DIVISION TWO PLAYS TO THINNER STANDS, as a rule of the world and not only
// as a consequence of smaller support: the same club, the same mood, draws
// four-fifths of the crowd the top flight would bring through its gates.
export const DIV2_CROWD = 0.8;
export const TICKET_MIN = 10, TICKET_MAX = 100;
// THE BROADCAST VAN PAYS BY THE HEAD. The turnout recalibration thinned the
// stands by about a quarter, and the wage curve was priced against the old
// gates - so the income that does not depend on a full house arrives with
// it: the league's broadcaster pays the host $7.50 a head. At the default
// ticket this restores the old matchday income almost exactly; what changed
// is where it comes from, and that a sold-out house is now an occasion.
export const BROADCAST_PER_HEAD = 7.5;
export const TICKET_ELASTICITY = 1.4;
// THE AFFORDABILITY CLIFF. A crowd has a reference price; past it they do
// not grumble and pay, they stay home. The logistic knee sits at $62 and is
// normalised at $26, so the league price is exactly itself and everything
// below ~$45 barely feels the cliff - while $80 leaves the die-hards alone
// in the ground and $100 is an empty stand and a ruined gate.
export const TICKET_KNEE = 62, TICKET_KNEE_W = 9;
const cliffAt = p => 1 / (1 + Math.exp((p - TICKET_KNEE) / TICKET_KNEE_W));
export const TICKET_LOCK_MS = 24 * 3600000;
export const SALES_FRACS = [0.10, 0.12, 0.15, 0.18, 0.22, 0.23];
export function priceMult(price) {
  const p = Math.max(1, price);
  return Math.pow(TICKET / p, TICKET_ELASTICITY) * (cliffAt(p) / cliffAt(TICKET));
}
// the price a club's dated decisions put in force at a moment; $26 before
// any decision, and for every club that never touches the dial
export function priceAtMs(prices, ms) {
  let p = TICKET;
  if (prices) for (let i = 0; i < prices.length; i++) { if (prices[i].at <= ms) p = prices[i].price; else break; }
  return p;
}
// the whole sale, one pure function. demand = the crowd that would come at
// $26; seats cap it; matchMs places the sale days; prices are the club's
// dated decisions. Pass nowMs to trim to sale days already past - the same
// function then prints the advance board for a future match. The 600
// die-hards who walk up whatever the price only join a banked gate.
export function gateSale(demand, seats, matchMs, prices, nowMs) {
  const lockAt = matchMs - TICKET_LOCK_MS;
  let sold = 0, take = 0, flat = null, allFlat = true;
  for (let k = 0; k < SALES_FRACS.length; k++) {
    const at = lockAt - (SALES_FRACS.length - 1 - k) * 86400000;
    if (nowMs != null && at > nowMs) break;
    const p = priceAtMs(prices, at);
    if (flat == null) flat = p; else if (p !== flat) allFlat = false;
    let n = demand * SALES_FRACS[k] * priceMult(p);
    if (sold + n > seats) n = seats - sold;
    if (n <= 0) continue;
    sold += n; take += n * p;
  }
  const priceEnd = priceAtMs(prices, lockAt);
  if (nowMs == null && sold < 600) { take += (600 - sold) * priceEnd; sold = 600; flat = flat == null ? priceEnd : flat; }
  sold = Math.round(sold);
  // a flat-priced sale takes exactly sold x price - the same arithmetic the
  // books used for a decade of $26 gates, to the pound
  take = allFlat && flat != null ? sold * flat : Math.round(take);
  return { sold, take, lockAt, price: priceEnd };
}
export const HOME_CUT = 2 / 3;               // the old two-thirds, one-third split
export const DEBT_ROUND = 0.03;              // what an overdraft costs a round
// THE HARD CAP. A club may not sink further than two and a half million into
// the red. Founding capital varies with a club's standing; the hole does NOT.
// One depth for everybody, so a rich club's bigger bank buys it a longer fall
// and not a deeper one, and ruin costs the same wherever you sit. Reach that
// floor and the club is in ADMINISTRATION: the losses below the line are
// written off - there is no deeper hole to dig - but the sponsor halves his
// cheque while the club is under, and nothing gets built. It is a floor with
// a price, not a forgiveness.
export const DEBT_LIMIT = 2500000;
export const ADMIN_SPONSOR = 0.5;
// ---------------------------------------------------------------------------
// THE ACADEMY'S BILL (docs/ACADEMY.md)
//
// An academy is meant to be a real rival to the transfer market for the same
// money, so it costs like one. Three separate charges, all of them knowable a
// season in advance:
//
//   upkeep   - by the round, steeply by level. A level five academy costs
//              about a season's gate to run; a level one is a rounding error.
//   building - a lump per step, and the steps get steeper, so a club that
//              overbuilds and is then relegated carries a stone.
//   the boys - their wages, every round, exactly as a professional's. Fifteen
//              of them is about what a senior staff costs, which is the brake
//              on signing everybody.
// ---------------------------------------------------------------------------
// THE LADDER RUNS TO TEN (058). One to five are UNTOUCHED, and have to be:
// the walk below charges upkeep at the level a club holds and the founding
// bank is reduced by every pound it ever spent building, so moving a rung
// anybody has already stood on rewrites banks that were settled seasons ago.
// Six to ten are new ground, priced against what a club actually banks. A
// founding club clears about 138k a round - roughly 150k of gate and sponsor
// against a 22k wage bill - and a strong one with a full ground four times
// that. So:
//   BUILDING is the project. Twenty-five million to climb from five to ten,
//   on top of the six the first four rungs cost: three or four seasons of a
//   good club's whole surplus, and out of reach of anyone else for ever.
//   UPKEEP is the brake, and the harsher of the two. A level ten academy
//   costs 190k a round - MORE than a founding club makes in a round, and a
//   third of what a great one does. Overbuild and it is not a slow season,
//   it is administration.
export const ACADEMY_MAX = 10;
const UPKEEP_BY_LEVEL = [0, 6000, 14000, 26000, 44000, 70000, 90000, 112000, 136000, 162000, 190000];
export function academyUpkeep(level) {
  return UPKEEP_BY_LEVEL[Math.max(1, Math.min(ACADEMY_MAX, +level || 2))];
}
// what it costs to go from level n to level n+1
export const ACADEMY_BUILD = [0, 400000, 900000, 1800000, 3200000,
                              3600000, 4200000, 4900000, 5700000, 6600000];
export function academyBuild(from, to) {
  let sum = 0;
  for (let lv = Math.max(1, from); lv < Math.min(ACADEMY_MAX, to); lv++) sum += ACADEMY_BUILD[lv];
  return sum;
}
// THE HEAD COACH IS GONE (056). He was a second building with a different
// name - a number bought upward, a wage line, and no decision in it. The
// academy is the only thing that sets the rate in the nets now, and the
// migration refunded what any club had spent, so nothing here charges for
// him and no statement carries a line for him.

// a trip abroad is paid for whether or not you sign the boy; scouting at home
// costs nothing, so a club with no money can still run an academy
export const SCOUT_FEE_ABROAD = 45000;
// and a senior shirt is the same flat price for every boy in the world
export const PROMOTE_FEE = 250000;
export const MOOD_WORD = ['mutinous', 'restless', 'patient', 'settled', 'pleased', 'delighted', 'ecstatic'];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// THE DAY AT THE GROUND. A pure function of the fixture, so every device
// works out the same weather for the same match without anyone storing it.
// It moves the turnstiles, not the cricket - the pitch is what the engine
// plays on.
const WEATHER = [
  { word: 'fine', mult: 1.00 }, { word: 'warm', mult: 1.09 }, { word: 'grey', mult: 0.94 },
  { word: 'blustery', mult: 0.89 }, { word: 'showery', mult: 0.77 }, { word: 'close', mult: 1.03 }
];
export function weatherOf(matchIdOrSeed) {
  const n = typeof matchIdOrSeed === 'string' && /[^0-9]/.test(matchIdOrSeed)
    ? seedOf(matchIdOrSeed) : Math.abs(Number(matchIdOrSeed) || 0);
  return WEATHER[n % WEATHER.length];
}

// WHAT THE SUPPORTERS THINK, from the last five results and where the club
// stands. Not a counter that drifts - a reading, taken fresh each round.
export function moodOf(last5, pos, clubs) {
  const rate = last5.length ? last5.reduce((s, p) => s + p, 0) / (2 * last5.length) : 0.5;
  const posF = clubs > 1 ? (clubs - pos) / (clubs - 1) : 0.5;
  return clamp(Math.round((rate * 0.65 + posF * 0.35) * 6), 0, 6);
}
// how full a ground gets. A FOLLOWING IS NOT AN ATTENDANCE: on an ordinary
// settled Sunday about three-quarters of the interested crowd actually walks
// up, a mutinous one stays half home, and even an ecstatic one only fills
// the ground when a big visitor or a warm day joins it - so a sold-out
// house is an occasion, not the default, and rarer still in division two.
const moodMult = m => 0.55 + m * 0.065;
// and who is visiting matters - the flagship and the leaders draw a crowd
const drawMult = (opp, oppPos) => (opp.is_boss ? 1.22 : 1) * (oppPos <= 3 ? 1.09 : 1);

// WHAT A CROWD BECOMES. Support drifts toward what the club deserves rather
// than jumping to it, so a good season builds a following and a bad one
// costs you one slowly enough to hurt.
export function supportTarget(mood, pos, clubs, stat) {
  const posF = clubs > 1 ? (clubs - pos) / (clubs - 1) : 0.5;
  // STATURE IS THE FLOOR THE CROWD FALLS BACK TO. Without it a big club that
  // has a bad year converges on exactly the following of a small club having
  // the same bad year, and the difference between the two is erased inside a
  // single season. Form and position still do all the MOVING; what stature
  // sets is where a club is moving around. It is not optional - a caller who
  // omitted it would quietly draw flagship crowds for a bottom club.
  return Math.round((1800 + 13500 * Math.pow(stat, 1.45)) + mood * 2600 + posF * 7000);
}

// WHAT THE NEXT SEATS COST. Building gets dearer the bigger the ground is:
// each further thousand costs more per seat than the last.
export function seatBlockPrice(fromSeats) {
  const block = Math.max(0, Math.floor((fromSeats - FOUNDING_SEATS) / 1000));
  return 1000 * (260 + block * 30);
}
export function stadiumCost(fromSeats, toSeats) {
  let cost = 0;
  for (let s = fromSeats; s < toSeats; s += 1000) cost += seatBlockPrice(s);
  return cost;
}

// the sponsor pays by the round, and reads the table before he signs
// the sponsor reads the table, and reads it harder than he used to: finishing
// top is worth a different order of cheque from finishing mid, which is what
// makes a title race worth money and not only pride
export function sponsorOf(pos, mood, clubs) {
  const posF = clubs > 1 ? (clubs - pos) / (clubs - 1) : 0.5;
  return Math.round(9000 + Math.pow(posF, 1.3) * 62000 + (mood - 3) * 4000);
}

// ---------------------------------------------------------------------------
// THE WALK. Every round this country has ever played, in order, for every
// club at once - because a club's gate depends on who visited and where the
// visitor stood that morning.
// ---------------------------------------------------------------------------
// THE STATEMENT. The walk below already visits every movement of money this
// country has ever made, in order, and until now it threw the lines away and
// kept only the totals. Ask for a slot's ledger and it hands back the lines
// too: what, when, how much, and the balance the club was left holding.
// Nothing new is stored to make this possible - it is the same walk, and a
// re-run rebuilds the identical statement, which is the whole law of these
// books. Timestamps are the world's own: a round settles at its nation's
// hour on the day it is played, a transfer on the day the envelopes opened.
export async function computeFinance(pool, country, opts = {}) {
  const want = opts.ledgerSlots instanceof Set ? opts.ledgerSlots
    : Array.isArray(opts.ledgerSlots) ? new Set(opts.ledgerSlots) : null;
  const ledger = {};
  const HOUR = natHour(country) * 3600000;
  const line = (slot, at, kind, label, amount, balance) => {
    if (!want || !want.has(slot) || !amount) return;
    (ledger[slot] = ledger[slot] || []).push({
      at: at, kind: kind, label: label,
      amount: Math.round(amount), balance: Math.round(balance)
    });
  };
  const clubs = (await pool.query(
    `SELECT slot, name, is_boss, squad, youth, academy, academy_paid, seats, seats_paid
       FROM clubs WHERE country_id=$1 ORDER BY slot`, [country])).rows;
  if (!clubs.length) return [];
  // EXTRACT IN THE DATABASE: a season of result blobs is tens of megabytes and
  // all the books need from them is who won.
  const ms = (await pool.query(
    `SELECT id, season_no, round, home_slot, away_slot, home_name, away_name, seed,
            result->>'winner' AS winner
       FROM matches WHERE country_id=$1 ORDER BY season_no, round, home_slot`, [country])).rows;
  // WHAT THE BOARD PAYS FOR A MAN'S WEEK. An international window takes a
  // club's best men and pays for them by the head - fifty thousand a senior,
  // twenty for a boy under twenty-one. Derived from the squads as named, so
  // the cheque is walked from genesis with everything else and re-settling
  // can never pay it twice.
  let fees = [];
  try {
    fees = (await pool.query(
      `SELECT season_no, round, slot, sum(fee)::int AS paid, count(*)::int AS men
         FROM callups WHERE country_id=$1 GROUP BY season_no, round, slot`, [country])).rows;
  } catch (eF) { fees = []; }                    // pre-023 database: no windows yet
  // WHAT A SEAT COST, AND SINCE WHEN. Dated decisions; the walk prices every
  // historical tranche at the price in force on its sale day.
  let tpr = [];
  try {
    tpr = (await pool.query(
      `SELECT slot, set_ms, price FROM ticket_prices WHERE country_id=$1 ORDER BY set_ms`,
      [country])).rows;
  } catch (eTp) { tpr = []; }                    // pre-073 database: the league's $26
  const priceRows = {};
  for (const t of tpr) (priceRows[t.slot] = priceRows[t.slot] || []).push({ at: +t.set_ms, price: +t.price });
  const feeAt = {};
  for (const f of fees) feeAt[f.season_no + ':' + f.round + ':' + f.slot] = f;
  // WHAT THE MARKET DID TO THE BANK. A transfer is two clubs' money: the fee
  // out of the buyer, the fee into the seller, on the world day the umpire
  // opened the envelopes - plus what a manager paid his scouts to look. All
  // of it walked out of the record, so re-settling can never pay it twice.
  let deals = [], scouts = [];
  try {
    deals = (await pool.query(
      `SELECT settled_day, country_id AS s_country, slot AS s_slot,
              buyer_country AS b_country, buyer_slot AS b_slot, fee
         FROM listings WHERE status='sold' AND (country_id=$1 OR buyer_country=$1)`, [country])).rows;
    scouts = (await pool.query(
      `SELECT day, slot, sum(paid)::int AS paid FROM scouted WHERE country_id=$1 GROUP BY day, slot`,
      [country])).rows;
  } catch (eD) { deals = []; scouts = []; }      // pre-024 database: no market yet
  const dayMoney = {};                            // 'day:slot' -> { in, out, scout, sold, bought }
  const atDay = (d, slot) => {
    const k = d + ':' + slot;
    return dayMoney[k] = dayMoney[k] || { in: 0, out: 0, scout: 0, sold: 0, bought: 0, acad: [], purse: [] };
  };
  for (const d of deals) {
    if (d.settled_day == null) continue;
    if (d.s_country === country) { const e = atDay(d.settled_day, d.s_slot); e.in += +d.fee || 0; e.sold++; }
    if (d.b_country === country) { const e = atDay(d.settled_day, d.b_slot); e.out += +d.fee || 0; e.bought++; }
  }
  for (const s2 of scouts) atDay(s2.day, s2.slot).scout += +s2.paid || 0;
  // WHAT THE ACADEMY SPENT, AND WHEN. A scouting trip and a senior contract
  // are dated decisions, not standing capital, so they walk with the market
  // rather than being lumped into the founding line the way building is.
  let acad = [];
  try {
    acad = (await pool.query(
      `SELECT world_day AS day, slot, kind, sum(amount)::bigint AS amount
         FROM academy_spend WHERE country_id=$1 GROUP BY world_day, slot, kind`,
      [country])).rows;
  } catch (eA) { acad = []; }                     // pre-040 database: no academy yet
  const ACAD_LABEL = { scouting: 'Scouting trips', contract: 'Senior contracts out of the academy' };
  for (const a of acad) {
    atDay(a.day, a.slot).acad.push({ kind: a.kind, amount: +a.amount || 0 });
  }

  // THE COLTS CUP PURSE. Winners, beaten finalist and the two losing
  // semi-finalists are paid out of the bracket the boys actually played -
  // read off cup_matches, not written down anywhere - so re-running the books
  // pays the same money and paying it twice is impossible. It lands on the
  // day of the final, which is the day it was won.
  let purse = [];
  try {
    purse = (await pool.query(
      `SELECT stage, a, b, result FROM cup_matches
        WHERE comp = $1 AND stage IN ('sf','final')`, ['colts:' + country])).rows;
  } catch (eP) { purse = []; }                    // pre-041 database: no colts cup yet
  const COLTS_PURSE = { winner: 750000, finalist: 300000, semi: 120000 };
  const PURSE_LABEL = {
    winner: 'Colts Cup \u00b7 winners', finalist: 'Colts Cup \u00b7 beaten finalists',
    semi: 'Colts Cup \u00b7 losing semi-finalists' };

  // a transfer settles on a WORLD DAY; the books walk in ROUNDS. The season
  // table is what turns one into the other.
  let starts = [];
  try {
    starts = (await pool.query(
      'SELECT season_no, start_day, divisions FROM seasons WHERE country_id=$1', [country])).rows;
  } catch (eS0) { starts = []; }
  const startOf = Object.fromEntries(starts.map(x => [x.season_no, x.start_day]));
  // who played the second flight, season by season - their gates run thinner
  const div2Of = {};
  for (const t of starts) {
    const d2 = t.divisions && t.divisions['2'];
    if (Array.isArray(d2) && d2.length) div2Of[t.season_no] = new Set(d2.map(Number));
  }
  for (const t of purse) {
    const won = t.result && t.result.winner === t.b.name ? t.b : t.a;
    const lost = won === t.a ? t.b : t.a;
    const day = (startOf[t.season_no] ?? 0) + COLTS_DAYS.final;
    if (t.stage === 'final') {
      atDay(day, won.slot).purse.push({ kind: 'winner', amount: COLTS_PURSE.winner });
      atDay(day, lost.slot).purse.push({ kind: 'finalist', amount: COLTS_PURSE.finalist });
    } else {
      atDay(day, lost.slot).purse.push({ kind: 'semi', amount: COLTS_PURSE.semi });
    }
  }
  const marketDays = Object.keys(dayMoney)
    .map(k => ({ day: +k.split(':')[0], slot: +k.split(':')[1], ...dayMoney[k] }))
    .sort((a, b) => a.day - b.day || a.slot - b.slot);
  let mIx = 0;

  const N = clubs.length;
  const S = {};
  for (const c of clubs) {
    // A BOY IS ON THE WAGE BILL FROM THE DAY HE IS SIGNED. He cannot be picked
    // and he may never be worth a shirt, and he is paid every round regardless -
    // which is the only thing stopping a manager signing every boy he is shown.
    const wages = (c.squad || []).reduce((s, p) => s + (p.wage || 0), 0)
                + (Array.isArray(c.youth) ? c.youth : []).reduce((s, p) => s + ((p && p.wage) || 0), 0);
    S[c.slot] = {
      slot: c.slot, name: c.name, is_boss: c.is_boss, wages,
      academy: c.academy || 2, seats: c.seats || foundingSeats(c.slot, c.is_boss),
      stature: stature(c.slot, c.is_boss),
      // what a manager has already spent is a fact; the books carry it from
      // the founding, so nobody can hide a purchase in an overdraft
      bank: foundingBank(c.slot, c.is_boss) - (+c.academy_paid || 0) - (+c.seats_paid || 0),
      sup: foundingSupport(c.slot, c.is_boss),
      mood: 3, pts: 0, played: 0, form: [], sPts: 0, sPlayed: 0,
      gate: 0, awayCut: 0, bcast: 0, sponsor: 0, wagesPaid: 0, upkeep: 0, interest: 0,
      compensation: 0, capsAway: 0,
      feesIn: 0, feesOut: 0, scouting: 0, soldN: 0, boughtN: 0, academySpend: 0, coltsPurse: 0,
      writtenOff: 0, admin: false, adminRounds: 0,
      atts: [], rounds: 0
    };
    // THE OPENING BALANCE, in the order the bank itself was built. The ground
    // and the academy are running totals in the register with no dates behind
    // them, so they can only be stated as what has been spent to date - the
    // one place this statement cannot say WHEN.
    let b0 = foundingBank(c.slot, c.is_boss);
    line(c.slot, EPOCH + HOUR, 'founding', 'Founding capital from the board', b0, b0);
    if (+c.academy_paid) { b0 -= +c.academy_paid; line(c.slot, EPOCH + HOUR, 'academy', 'Academy building, to date', -(+c.academy_paid), b0); }
    if (+c.seats_paid) { b0 -= +c.seats_paid; line(c.slot, EPOCH + HOUR, 'stadium', 'Stadium building, to date', -(+c.seats_paid), b0); }
  }
  // the table as it stood that morning: 1 is top
  const posMap = () => {
    const order = clubs.map(c => S[c.slot]).sort((a, b) =>
      b.pts - a.pts || b.played - a.played || a.slot - b.slot);
    const m = {}; order.forEach((x, i) => { m[x.slot] = i + 1; });
    return m;
  };
  // and the SEASON'S own table: mood is a supporter's reading of the summer
  // in front of him, not of the club's whole history
  const posMapSeason = () => {
    const order = clubs.map(c => S[c.slot]).sort((a, b) =>
      b.sPts - a.sPts || b.sPlayed - a.sPlayed || a.slot - b.slot);
    const m = {}; order.forEach((x, i) => { m[x.slot] = i + 1; });
    return m;
  };

  // group the matches into rounds, because a whole round settles at once
  const byRound = [];
  for (const m of ms) {
    const k = m.season_no + ':' + m.round;
    const last = byRound[byRound.length - 1];
    if (last && last.k === k) last.ms.push(m); else byRound.push({ k, ms: [m] });
  }

  const drainMarket = upto => {
    while (mIx < marketDays.length && marketDays[mIx].day <= upto) {
      const m = marketDays[mIx++];
      const c = S[m.slot]; if (!c) continue;
      c.feesIn += m.in; c.feesOut += m.out; c.scouting += m.scout;
      c.soldN += m.sold; c.boughtN += m.bought;
      const at = EPOCH + m.day * DAY + HOUR;
      if (m.in) { c.bank += m.in; line(m.slot, at, 'player-sale', 'Player sales \u00b7 ' + (m.sold === 1 ? 'one man out' : m.sold + ' men out'), m.in, c.bank); }
      if (m.out) { c.bank -= m.out; line(m.slot, at, 'player-buy', 'Player purchases \u00b7 ' + (m.bought === 1 ? 'one man in' : m.bought + ' men in'), -m.out, c.bank); }
      if (m.scout) { c.bank -= m.scout; line(m.slot, at, 'scouting', 'Scouting reports', -m.scout, c.bank); }
      for (const a of (m.acad || [])) {
        if (!a.amount) continue;
        c.academySpend += -a.amount;              // held positive: it is a cost
        c.bank += a.amount;                       // the rows are already signed
        line(m.slot, at, a.kind, ACAD_LABEL[a.kind] || 'The academy', a.amount, c.bank);
      }
      for (const pz of (m.purse || [])) {
        if (!pz.amount) continue;
        c.coltsPurse += pz.amount;
        c.bank += pz.amount;
        line(m.slot, at, 'colts-purse', PURSE_LABEL[pz.kind] || 'Colts Cup', pz.amount, c.bank);
      }
      if (c.bank < -DEBT_LIMIT) {
        const off = (-DEBT_LIMIT) - c.bank; c.writtenOff += off; c.bank = -DEBT_LIMIT;
        line(m.slot, at, 'written-off', 'Written off at the floor', off, c.bank);
      }
      c.admin = c.bank <= -DEBT_LIMIT;
    }
  };

  let curSeason = null;
  for (const R of byRound) {
    // THE MOOD RESETS WITH THE SEASON. A new summer opens on a level footing:
    // the form book is blank, the supporters are settled, and everything the
    // mood does from here it does because of THIS season's results. (Support
    // itself still carries - a following built over years does not vanish on
    // opening day; what resets is what those supporters currently think.)
    const sNo9 = R.ms.length ? R.ms[0].season_no : null;
    if (sNo9 !== null && sNo9 !== curSeason) {
      curSeason = sNo9;
      for (const c of clubs) { const t9 = S[c.slot]; t9.form = []; t9.mood = 3; t9.sPts = 0; t9.sPlayed = 0; }
    }
    const pos = posMap();
    // every deal that closed on or before this round's day has already moved
    // the money by the time the gate is counted
    if (R.ms.length) drainMarket((startOf[R.ms[0].season_no] ?? 0) + (dayOfRound(R.ms[0].round) ?? (R.ms[0].round - 1)));
    const takings = {};                                   // slot -> money this round
    const gates = {};                                     // slot -> the lines behind it
    for (const c of clubs) { takings[c.slot] = 0; gates[c.slot] = []; }
    for (const m of R.ms) {
      const H = S[m.home_slot], A = S[m.away_slot];
      if (!H || !A) continue;
      const w = weatherOf(m.seed != null ? m.seed : m.id);
      const dv = div2Of[m.season_no] && div2Of[m.season_no].has(m.home_slot) ? DIV2_CROWD : 1;
      const demand = H.sup * moodMult(H.mood) * drawMult(A, pos[A.slot]) * w.mult * dv;
      const matchMs = EPOCH + ((startOf[m.season_no] ?? 0) +
        (dayOfRound(m.round) ?? (m.round - 1))) * DAY + HOUR;
      const sale = gateSale(demand, H.seats, matchMs, priceRows[H.slot] || null, null);
      const att = sale.sold, gate = sale.take;
      const home = Math.round(gate * HOME_CUT), away = gate - Math.round(gate * HOME_CUT);
      const bc = Math.round(att * BROADCAST_PER_HEAD);
      H.gate += home; H.bcast += bc; H.atts.push(att); H.lastAtt = att; H.lastWeather = w.word;
      A.awayCut += away;
      takings[H.slot] += home + bc; takings[A.slot] += away;
      gates[H.slot].push({ kind: 'gate', label: 'Gate v ' + m.away_name + ' \u00b7 ' + att.toLocaleString('en-US') + ' through the turnstiles' + (sale.price !== TICKET ? ' at $' + sale.price : ''), amount: home });
      gates[H.slot].push({ kind: 'broadcast', label: 'Broadcast fee v ' + m.away_name + ' \u00b7 $7.50 a head', amount: bc });
      gates[A.slot].push({ kind: 'gate-away', label: 'Away share at ' + m.home_name, amount: away });
    }
    // the world moment this round's books are settled: its nation's own hour
    const roundAt = EPOCH + ((startOf[R.ms[0].season_no] ?? 0) +
      (dayOfRound(R.ms[0].round) ?? (R.ms[0].round - 1))) * DAY + HOUR;
    // every club that played takes its sponsor money, pays its men and its
    // academy, and then answers to the bank
    const playing = new Set();
    for (const m of R.ms) { playing.add(m.home_slot); playing.add(m.away_slot); }
    for (const slot of playing) {
      const c = S[slot];
      // a club already under administration signs a distressed deal: the
      // sponsor stays, but for half of what he would otherwise pay
      const sp = Math.round(sponsorOf(pos[slot], c.mood, N) * (c.admin ? ADMIN_SPONSOR : 1));
      const up = academyUpkeep(c.academy);
      const f = feeAt[R.ms[0].season_no + ':' + R.ms[0].round + ':' + slot];
      const comp = f ? f.paid : 0;
      c.sponsor += sp; c.wagesPaid += c.wages; c.upkeep += up; c.rounds++;
      c.compensation += comp; c.capsAway += f ? f.men : 0;
      const wasAdmin = c.admin;
      if (c.admin) c.adminRounds++;
      // the same sum as ever, taken one entry at a time so the running balance
      // the statement prints is the balance the club actually held
      for (const g of gates[slot]) { c.bank += g.amount; line(slot, roundAt, g.kind, g.label, g.amount, c.bank); }
      c.bank += sp;
      line(slot, roundAt, 'sponsor', wasAdmin ? 'Sponsor, on administration terms' : 'Sponsor', sp, c.bank);
      if (comp) { c.bank += comp; line(slot, roundAt, 'compensation', 'International compensation \u00b7 ' + f.men + (f.men === 1 ? ' man' : ' men') + ' away', comp, c.bank); }
      c.bank -= c.wages; line(slot, roundAt, 'wages', 'Player wages', -c.wages, c.bank);
      c.bank -= up; line(slot, roundAt, 'upkeep', 'Academy upkeep \u00b7 level ' + c.academy, -up, c.bank);
      if (c.bank < 0) {
        const i = Math.round(-c.bank * DEBT_ROUND); c.interest += i; c.bank -= i;
        line(slot, roundAt, 'interest', 'Overdraft interest', -i, c.bank);
      }
      // THE FLOOR. Nothing sinks past what the club was founded with; what
      // would have gone deeper is written off, and the club is under.
      if (c.bank < -DEBT_LIMIT) {
        const off = (-DEBT_LIMIT) - c.bank; c.writtenOff += off; c.bank = -DEBT_LIMIT;
        line(slot, roundAt, 'written-off', 'Written off at the floor', off, c.bank);
      }
      c.admin = c.bank <= -DEBT_LIMIT;
    }
    // the result, and what it does to the mood and the crowd
    for (const m of R.ms) {
      const H = S[m.home_slot], A = S[m.away_slot];
      if (!H || !A) continue;
      const wn = m.winner;
      const hp = wn == null ? 1 : wn === m.home_name ? 2 : 0;
      const ap = wn == null ? 1 : wn === m.away_name ? 2 : 0;
      H.pts += hp; A.pts += ap; H.played++; A.played++;
      H.sPts += hp; A.sPts += ap; H.sPlayed++; A.sPlayed++;
      H.form.push(hp); A.form.push(ap);
      if (H.form.length > 5) H.form.shift();
      if (A.form.length > 5) A.form.shift();
    }
    const pos2 = posMap();
    const posS = posMapSeason();
    for (const slot of playing) {
      const c = S[slot];
      c.mood = moodOf(c.form, posS[slot], N);
      const t = supportTarget(c.mood, pos2[slot], N, c.stature);
      c.sup = clamp(Math.round(c.sup + (t - c.sup) * 0.18), 4000, 60000);
    }
  }

  drainMarket(Infinity);        // deals closed since the last round still count

  // between seasons the coming summer has no results to feel anything about,
  // so the sheet reads level until the first ball of the new season
  let maxSeason = 0;
  for (const t of starts) if (+t.season_no > maxSeason) maxSeason = +t.season_no;
  const preSeason = maxSeason > (curSeason || 0);
  const out = clubs.map(c => {
    const s = S[c.slot];
    if (preSeason) s.mood = 3;
    const avg = s.atts.length ? Math.round(s.atts.reduce((a, b) => a + b, 0) / s.atts.length) : 0;
    return {
      slot: c.slot, bank: Math.round(s.bank),
      finance: {
        supporters: s.sup, mood: s.mood, moodWord: MOOD_WORD[s.mood],
        seats: s.seats, lastAttendance: s.lastAtt || 0, lastWeather: s.lastWeather || null,
        // the club's standing price: the latest dated decision, $26 before any
        avgAttendance: avg, ticket: priceAtMs(priceRows[c.slot] || null, Infinity),
        gate: s.gate, awayCut: s.awayCut, broadcast: s.bcast, sponsor: s.sponsor,
        compensation: s.compensation, capsAway: s.capsAway,
        feesIn: s.feesIn, feesOut: s.feesOut, scouting: s.scouting, academySpend: s.academySpend,
        coltsPurse: s.coltsPurse,
        sold: s.soldN, bought: s.boughtN,
        wages: s.wagesPaid, wageBill: s.wages, upkeep: s.upkeep, interest: s.interest,
        academyPaid: +c.academy_paid || 0, seatsPaid: +c.seats_paid || 0,
        writtenOff: s.writtenOff, administration: s.admin, adminRounds: s.adminRounds,
        debtLimit: DEBT_LIMIT,
        // what THIS club's board put in, not the world's flat figure - the
        // ledger identity is checked against it
        founded: foundingBank(s.slot, s.is_boss), rounds: s.rounds,
        // how many of those rounds were at home is exactly how many gates were
        // counted, and it is the only honest divisor for an average gate
        homeMatches: s.atts.length, awayMatches: Math.max(0, s.rounds - s.atts.length),
        nextSeats: s.seats < MAX_SEATS ? s.seats + 1000 : null,
        nextSeatsCost: s.seats < MAX_SEATS ? seatBlockPrice(s.seats) : null,
        // THE PRICE OF THE NEXT LEVEL, quoted by the side that charges it.
        // The books used to quote a ladder of their own invention and the
        // manager found out what a level really cost when the RPC refused him.
        academyLevel: s.academy,
        nextAcademy: s.academy < ACADEMY_MAX ? s.academy + 1 : null,
        nextAcademyCost: s.academy < ACADEMY_MAX ? academyBuild(s.academy, s.academy + 1) : null,
        maxSeats: MAX_SEATS, seatBlock: 1000, homeCut: HOME_CUT
      }
    };
  });
  if (want) out.forEach(r => { r.ledger = ledger[r.slot] || []; });
  return out;
}

// settle it into the clubs table: the bank a manager reads and the books
// behind it, both rebuilt from the record and never incremented - and, for
// the clubs that have somebody to read it, the statement behind THAT.
export async function settleMoney(pool, country) {
  // a bot club's statement would be read by nobody, so it is not written
  let managed = [];
  try {
    managed = (await pool.query('SELECT slot FROM claims WHERE country_id=$1', [country])).rows.map(r => r.slot | 0);
  } catch (eC) { managed = []; }
  const rows = await computeFinance(pool, country, managed.length ? { ledgerSlots: managed } : {});
  for (const r of rows) {
    await pool.query('UPDATE clubs SET bank=$3, finance=$4::jsonb WHERE country_id=$1 AND slot=$2',
      [country, r.slot, r.bank, JSON.stringify(r.finance)]);
  }
  try { await writeLedgers(pool, country, rows); }
  catch (eL) {}                                  // pre-036 database: no statement yet
  return rows.length;
}

// THE STATEMENT IS REBUILT WHOLE, never appended to - the same law the books
// themselves keep. A re-run can then neither double a line nor lose one, which
// is what makes it safe for the umpire to settle the same day twice.
const LEDGER_CHUNK = 400;
async function writeLedgers(pool, country, rows) {
  for (const r of rows) {
    if (!r.ledger) continue;
    await pool.query('DELETE FROM ledger WHERE country_id=$1 AND slot=$2', [country, r.slot]);
    for (let from = 0; from < r.ledger.length; from += LEDGER_CHUNK) {
      const chunk = r.ledger.slice(from, from + LEDGER_CHUNK);
      const vals = [], args = [country, r.slot];
      chunk.forEach((l, i) => {
        const b = args.length;
        args.push(l.at, l.kind, l.label, l.amount, l.balance);
        vals.push('($1,$2,' + (from + i) + ',$' + (b + 1) + ',$' + (b + 2) + ',$' + (b + 3) + ',$' + (b + 4) + ',$' + (b + 5) + ')');
      });
      await pool.query(
        'INSERT INTO ledger(country_id,slot,seq,at_ms,kind,label,amount,balance) VALUES ' + vals.join(','), args);
    }
  }
}
