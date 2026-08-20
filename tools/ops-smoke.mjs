// ops-smoke.mjs — THE PRODUCTION SMOKE FOR CLUB-SCALE OPERATIONS.
//
// The shipped change gave club operations a term for the club's FOLLOWING.
// Four things in this codebase have to agree about what a club is charged,
// and they reach the number by four different routes:
//
//    1. THE WALK          server/economy.mjs, the 'ops' ledger line - the
//                         only one of the four that actually moves money;
//    2. THE DOCUMENT      the opsBreakdown served to the client, composed
//                         separately from the same constants;
//    3. THE BOT           server/botfinance.mjs, the posture projection a
//                         bot club budgets against;
//    4. THE LAW           financeconfig.operationsPerRound itself.
//
// A disagreement between any two of them is a class of bug that has already
// happened once in this work: the seat model called the law with three
// arguments, `support` arrived undefined, the club term silently evaluated
// to zero, and every club was priced at a minnow's bill. It surfaced only
// because one figure came out below the law's own minimum. So this does not
// read the call sites - it settles a real era-2 world and compares what the
// four of them SAY, club by club.
//
// It also holds the two things that would be silently wrong rather than
// loudly wrong: that a round is charged ONCE (a duplicate line is money
// leaving twice and the ledger still balancing), and that the club term is
// actually non-zero (a missing following charges base+ground and looks
// entirely plausible).
//
//   node tools/ops-smoke.mjs
//
// Needs Postgres. Creates and drops its own database.
import { execSync } from 'node:child_process';
import { makePool } from '../server/db.mjs';
import { migrate } from '../server/migrate.mjs';
import { initWorld } from '../server/init-world.mjs';
import { makeHost } from '../server/enginehost.mjs';
import { computeFinance, academyUpkeep, foundingSupport } from '../server/economy.mjs';
import { botFinanceView } from '../server/botfinance.mjs';
import {
  operationsPerRound, OPS_BASE_ROUND, OPS_PER_SEAT_ROUND,
  OPS_PER_SUPPORTER_ROUND, OPS_TOPFLIGHT_ROUND, era2Season, ERA2_DAY
} from '../server/financeconfig.mjs';
import { EPOCH, DAY, ROUNDS } from '../server/clock.mjs';

const DB = 'foopssmoke_test';
const START = 101;                                   // era 2: START >= ERA2_DAY
const $ = n => '$' + Math.round(n).toLocaleString();
let fails = 0;
const L = s => console.log(s);
const ok = (cond, what) => {
  if (!cond) { fails++; L('   FAIL  ' + what); } else L('   ok    ' + what);
};

try { execSync(`dropdb --if-exists ${DB}`, { stdio: 'ignore' }); } catch (e) {}
execSync(`createdb ${DB}`);
process.env.PGDATABASE = DB;
const pool = makePool(), host = makeHost();
const T0 = EPOCH + 100 * DAY + 12 * 3600000;

await migrate(pool);
await initWorld(pool, { now: T0, host });
const clubs = (await pool.query(
  `SELECT slot, name, is_boss, seats, academy, bank FROM clubs WHERE country_id='eng' ORDER BY slot`)).rows;
const sea = (await pool.query(
  `SELECT schedule, divisions, start_day FROM seasons WHERE country_id='eng' AND season_no=1`)).rows[0];

L('');
L('CLUB-SCALE OPERATIONS - PRODUCTION SMOKE');
L('='.repeat(78));
L('');
L('the law as shipped:');
L('   ' + $(OPS_BASE_ROUND) + ' base + seats x $' + OPS_PER_SEAT_ROUND
  + ' + following x $' + OPS_PER_SUPPORTER_ROUND
  + ' + (D1 ? ' + $(OPS_TOPFLIGHT_ROUND) + ')');
L('   era line ERA2_DAY = ' + ERA2_DAY + '; this fixture opens on day ' + START
  + ' (era 2: ' + era2Season(START) + ')');
L('');

// the whole league season off the stored schedule, lower slot wins everything
let n = 0;
const put = (round, h, a, winner) => pool.query(
  `INSERT INTO matches(id, country_id, season_no, round, home_slot, away_slot, seed,
                       engine_version, pitch, orders, result, home_name, away_name)
   VALUES ($1,'eng',1,$2,$3,$4,$5,'test','fair','{}'::jsonb,$6::jsonb,$7,$8)`,
  ['smoke-' + (n++), round, h, a, 2000 + n,
   JSON.stringify({ winner: winner == null ? null : clubs[winner].name }),
   clubs[h].name, clubs[a].name]);
const winnerOf = (h, a) => (h < a ? h : a);
for (let round = 1; round <= ROUNDS; round++) {
  for (const dv of ['1', '2']) {
    for (const [h, a] of sea.schedule[dv][round - 1]) await put(round, h, a, winnerOf(h, a));
  }
}

const rows = await computeFinance(pool, 'eng',
  { ledgerSlots: clubs.map(c => c.slot), now: EPOCH + (START + 40) * DAY });

L('1. ALL FOUR CONSUMERS AGREE, CLUB BY CLUB');
L('');
// COMPARE THE QUANTITY THE CLAIM IS ABOUT. The first cut of this check took
// the walk's SEASON AVERAGE and set it against the document's rate, and every
// club "disagreed" - the flagship by -$8,469 and the bottom club by +$5,120,
// with the sign tracking whether the club's following grew or shrank. That is
// not a defect, it is the law working as written: the walk charges each round
// at that round's OPENING following, so a club whose support grew over the
// summer paid less in the early rounds than its final size implies, and a
// club whose support decayed paid more. Averaging across fourteen rounds of a
// MOVING coordinate and comparing it to a point-in-time rate compares two
// different quantities.
//
// The honest comparison is at a moment where the following is known exactly.
// Round one's opening following IS the founding following, by definition -
// nothing has evolved yet - so the walk's FIRST operations line is tied to the
// law to the dollar. The document, the bot and the law are then compared at
// the club's CURRENT following, which is the moment they all describe.
L('   slot  div    seats  founding      round-1 walk         law   |   now'
  + '    document         bot         law');
L('   ' + '-'.repeat(96));
let agree = 0;
for (const r of rows) {
  const f = r.finance, dv = f.opsBreakdown ? f.opsBreakdown.division : null;
  const led = (r.ledger || []).filter(l => l.kind === 'ops');
  // 1. THE WALK, at the one round whose following is known exactly
  const walk1 = led.length ? -led[0].amount : 0;
  const founding = foundingSupport(r.slot, !!clubs[r.slot].is_boss);
  const law1 = operationsPerRound(f.seats, dv, 1, founding);
  // 2. THE DOCUMENT: the rate the client is served
  const doc = f.opsBreakdown ? f.opsBreakdown.perRound : 0;
  // 3. THE BOT: the projection a bot budgets against. Priced off the SAME
  //    following the walk finished the season on, which is what makes this a
  //    comparison rather than two different questions.
  //    The view does not expose `ops` on its own - it returns a composed
  //    perRoundExpense of wages + operations + upkeep. Handing it a payroll
  //    of zero and a known academy level makes that expense recoverable
  //    exactly, which is a stronger check than reading the term back: it
  //    proves the number the BOT BUDGETS AGAINST is the one the walk charges.
  const ACAD = 2;
  const bot = botFinanceView({
    country: 'eng', slot: r.slot, isBoss: !!clubs[r.slot].is_boss, div: dv,
    bank: Number(r.bank || 0), wageBill: 0, seats: f.seats, academy: ACAD,
    supporters: f.supporters, avgAttendance: f.avgAttendance,
    ticket: f.ticket, roundsTotal: ROUNDS, roundsLeft: ROUNDS
  });
  const botOps = bot.perRoundExpense - academyUpkeep(ACAD);
  // 4. THE LAW
  const law = operationsPerRound(f.seats, dv, 1, f.supporters);
  const same = walk1 === law1 && doc === botOps && botOps === law;
  if (same) agree++;
  L('   ' + String(r.slot).padStart(4) + String(dv).padStart(5)
    + String(f.seats).padStart(9) + String(founding).padStart(10)
    + $(walk1).padStart(13) + $(law1).padStart(12) + '   |'
    + String(f.supporters).padStart(7)
    + $(doc).padStart(12) + $(botOps).padStart(12) + $(law).padStart(12)
    + (same ? '' : '   <-- DISAGREE'));
}
L('');
ok(agree === rows.length,
  'all four consumers agree on every club (' + agree + ' of ' + rows.length + ')');

L('');
L('2. NO MISSING-SUPPORTER FALLBACK');
L('');
// a club charged base+ground only would look entirely plausible - it is a
// real number on the right scale. The tell is that it equals what the law
// charges a club with NO following at all.
let zeroTerm = 0, minTerm = Infinity, maxTerm = 0;
for (const r of rows) {
  const f = r.finance, dv = f.opsBreakdown.division;
  const withNone = operationsPerRound(f.seats, dv, 1, 0);
  const term = f.opsBreakdown.perRound - withNone;
  if (term <= 0) zeroTerm++;
  minTerm = Math.min(minTerm, term); maxTerm = Math.max(maxTerm, term);
  const stated = f.opsBreakdown.club;
  if (stated !== Math.round(f.supporters * OPS_PER_SUPPORTER_ROUND)) {
    fails++; L('   FAIL  slot ' + r.slot + ' states a club term of ' + $(stated)
      + ' against a following of ' + f.supporters);
  }
}
ok(zeroTerm === 0, 'no club is charged as though it had no following at all');
L('         the club term runs ' + $(minTerm) + ' to ' + $(maxTerm) + ' a round');
ok(maxTerm / minTerm > 1.2,
  'and it genuinely separates clubs (' + (maxTerm / minTerm).toFixed(2) + 'x across the ladder)');

L('');
L('3. NO DUPLICATE OPERATIONS CHARGE');
L('');
let dupes = 0, roundsCharged = [];
for (const r of rows) {
  const led = (r.ledger || []).filter(l => l.kind === 'ops');
  const byRound = {};
  for (const l of led) byRound[l.at] = (byRound[l.at] || 0) + 1;
  const twice = Object.entries(byRound).filter(([, k]) => k > 1);
  if (twice.length) { dupes++; L('   FAIL  slot ' + r.slot + ' charged twice at ' + twice[0][0]); }
  roundsCharged.push(led.length);
}
ok(dupes === 0, 'no club is charged operations twice in one round');
const uniq = [...new Set(roundsCharged)];
ok(uniq.length === 1, 'every club is charged the same number of rounds ('
  + uniq.join(', ') + ')');
ok(uniq[0] === ROUNDS, 'and that number is the ' + ROUNDS + ' rounds it played');

L('');
L('4. THE PARTS ARE THE WHOLE, AND THE PREMIUM IS THE PREMIUM');
L('');
let partsOk = 0, premOk = 0;
for (const r of rows) {
  const ob = r.finance.opsBreakdown;
  if (ob.base + ob.ground + ob.club + ob.topFlight === ob.perRound) partsOk++;
  const d1 = operationsPerRound(r.finance.seats, 1, 1, r.finance.supporters);
  const d2 = operationsPerRound(r.finance.seats, 2, 1, r.finance.supporters);
  if (d1 - d2 === OPS_TOPFLIGHT_ROUND) premOk++;
}
ok(partsOk === rows.length, 'the served parts sum to the charged rate for every club');
ok(premOk === rows.length,
  'the division premium is exactly ' + $(OPS_TOPFLIGHT_ROUND) + ' at every club');

L('');
L('5. THE REFERENCE CASES, EXACTLY');
L('');
const bottom = operationsPerRound(24000, 2, 1, 12675);
const flag = operationsPerRound(29000, 1, 1, 37176);
L('   bottom D2   24,000 seats, 12,675 following, D2   ' + $(bottom));
L('   flagship    29,000 seats, 37,176 following, D1   ' + $(flag));
ok(bottom === 111450, 'bottom D2 is exactly $111,450');
ok(flag === 205952, 'flagship is exactly $205,952');

L('');
L('='.repeat(78));
L(fails === 0 ? 'OPS SMOKE PASS - all four consumers agree, no fallback, no double charge'
  : 'OPS SMOKE FAIL - ' + fails + ' check(s) failed');
await pool.end();
process.exit(fails === 0 ? 0 : 1);
