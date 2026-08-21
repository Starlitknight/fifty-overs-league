#!/usr/bin/env node
/* tools/roster-failure-proof.mjs — THE SHIPPED LIFECYCLE, BREAKING A CLUB
 *
 * Section 1 and section 7 of the roster-continuity brief: reproduce the failure
 * on the REAL path before repairing it, and prove old main fails.
 *
 * WHY THIS EXISTS SEPARATELY FROM THE REGRESSION TEST. Run against main's
 * youth.mjs the test file cannot even load - it imports ROSTER_MIN and
 * ensurePlayableSquad, neither of which exists there - so it "fails on main"
 * with a SyntaxError. That is a true statement and a useless one: it shows the
 * test is new, not that the world is broken. This runs main's OWN ageYouth,
 * unmodified, on a real world, and then asks the shipped engine to play the
 * clubs it wrote.
 *
 *   node tools/roster-failure-proof.mjs
 *
 * Needs Postgres. Creates and drops its own database. Prints, and exits 1 if
 * the world it produced is playable - because on main it should NOT be.
 */
import { execSync } from 'node:child_process';
import { makePool } from '../server/db.mjs';
import { migrate } from '../server/migrate.mjs';
import { initWorld } from '../server/init-world.mjs';
import { makeHost } from '../server/enginehost.mjs';
import { ageYouth, RETIRE_AT } from '../server/youth.mjs';
import { botBid } from '../server/market.mjs';
import { POSTURE_POLICY } from '../server/botfinance.mjs';
import { EPOCH, DAY } from '../server/clock.mjs';

const DB = 'forosterproof_test';
const L = s => console.log(s);
const HARD_MIN = 11;                      // measured in tools/roster-legality.mjs

try { execSync(`dropdb --if-exists ${DB}`, { stdio: 'ignore' }); } catch (e) {}
execSync(`createdb ${DB}`);
process.env.PGDATABASE = DB;
const pool = makePool(), host = makeHost();
await migrate(pool);
await initWorld(pool, { now: EPOCH + 100 * DAY + 12 * 3600000, host });

L('');
L('THE SHIPPED LIFECYCLE, TAKING A CLUB BELOW A SIDE');
L('='.repeat(84));
L('');

// ---------------------------------------------------------------------------
// 1. A CLUB THAT IS ABOUT TO LOSE MEN. Twelve professionals, three of them one
//    season from RETIRE_AT. Nothing here is exotic: it is an ordinary ageing
//    squad, and the ages are the only thing set.
// ---------------------------------------------------------------------------
const SLOT = 15;
const row = (await pool.query(
  `SELECT slot, squad, bank FROM clubs WHERE country_id='eng' AND slot=$1`, [SLOT])).rows[0];
const cut = (row.squad || []).slice(0, 12).map((p, i) =>
  ({ ...p, age: i < 3 ? RETIRE_AT - 1 : 26 }));
await pool.query(`UPDATE clubs SET squad=$2::jsonb WHERE country_id='eng' AND slot=$1`,
  [SLOT, JSON.stringify(cut)]);

L('   BEFORE');
L('      club                 eng/' + SLOT);
L('      squad size           ' + cut.length);
L('      men at ' + (RETIRE_AT - 1) + ', retiring   ' + cut.filter(p => p.age === RETIRE_AT - 1).length);
L('');

// ---------------------------------------------------------------------------
// 2. THE MONEY. A distressed club is the case that matters, because a healthy
//    one might buy its way out. Put it under and read the posture the shipped
//    table gives it.
// ---------------------------------------------------------------------------
await pool.query(`UPDATE clubs SET bank=$2 WHERE country_id='eng' AND slot=$1`,
  [SLOT, -2400000]);
const posture = 'critical';
const listing = { id: 1, asking: 100000, buyerKey: 'eng:' + SLOT };
const bid = botBid(listing, cut, -2400000,
  { rating: 40000, wage: 4760, role: 'batter', bowlTypeFull: 'none' },
  { policy: POSTURE_POLICY[posture], perRoundIncome: 200000 });
L('   THE MARKET, for a club in this state');
L('      posture              ' + posture + '  (buys: ' + POSTURE_POLICY[posture].buys + ')');
L('      botBid on a cheap man ' + bid + '   <- it will not sign anybody, at any price');
L('');

// ---------------------------------------------------------------------------
// 3. THE ROLLOVER. main's own ageYouth, unmodified.
// ---------------------------------------------------------------------------
const out = await ageYouth(pool, 'eng', 1, host);
const after = (await pool.query(
  `SELECT squad FROM clubs WHERE country_id='eng' AND slot=$1`, [SLOT])).rows[0];
const size = (after.squad || []).length;
L('   AFTER ageYouth');
L('      retired              ' + out.retired + ' across the country');
L('      squad size           ' + size);
L('      emergency signings   '
  + (out.emergency == null ? 'the field does not exist on this law' : out.emergency));
L('');

// ---------------------------------------------------------------------------
// 4. AND THE MATCH. The whole point: what the world wrote, handed to the engine.
// ---------------------------------------------------------------------------
// A SEASON OF FIXTURES, NOT ONE. Below eleven the engine does not fail every
// time - it fails MOST times. Measured over 192 trials a side of ten crashes
// 65.6% of the time, nine 78.6%, eight 85.9%, while eleven and above crashed
// not once. So a single fixture is a coin weighted three-to-one and proves
// nothing on its own: the first cut of this file ran exactly one, drew the
// surviving quarter, and printed NOT REPRODUCED against a club of nine men.
//
// A club plays fourteen league rounds a season. That is the honest unit.
const opp = host.derive(host.genSquad('proof|opp', 'England', 'balanced', 'general', 1, 'd2a') || []);
const men = host.derive(after.squad);
let crashed = 0, tied = 0, ok = 0, firstErr = '';
const FIXTURES = 14;
for (let i = 0; i < FIXTURES; i++) {
  try {
    const r = JSON.parse(host.runMatch({ name: 'Short', players: men },
      { name: 'Opp', players: opp }, 'fair', 77 + i * 101, {}, 'Sunny', false));
    if (r && r.winner) ok++; else tied++;
  } catch (e) { crashed++; if (!firstErr) firstErr = e.message; }
}
L('   A SEASON OF FIXTURES (' + FIXTURES + ' rounds) FOR THAT SQUAD');
L('      squad handed to engine ' + size + ' men');
L('      played                 ' + ok + '   tied ' + tied);
L('      CRASHED                ' + crashed + ' of ' + FIXTURES
  + (firstErr ? '   ' + firstErr.slice(0, 46) : ''));
L('');
L('='.repeat(84));
const broken = size < HARD_MIN && crashed > 0;
L(broken
  ? 'REPRODUCED: the shipped rollover left eng/' + SLOT + ' with ' + size
    + ' men, and ' + crashed + ' of its\n            ' + FIXTURES
    + ' fixtures cannot be played at all. This is the defect, on the real path.'
  : size >= HARD_MIN
    ? 'NOT REPRODUCED: the club came out with ' + size + ' men - at or above the\n'
      + '                minimum - and every fixture ran. On the repaired law this\n'
      + '                is the CORRECT outcome.'
    : 'NOT REPRODUCED: ' + size + ' men but no crash in ' + FIXTURES + ' fixtures.');
await pool.end();
process.exit(broken ? 0 : 1);
