#!/usr/bin/env node
/* tools/wage-map.mjs — WHAT A WAGE IS, WHERE THE LAW LIVES, AND WHO READS IT
 *
 * Sections 1, 2, 3, 10 and 18 of the wage-anchor brief.
 *
 *   node tools/wage-map.mjs
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeHost } from '../server/enginehost.mjs';
import { wageFromRating, valueOf, FEE_ROUNDS, FEE_MULT } from '../server/market.mjs';
import { seasonOf, $, mean } from './economy-audit.mjs';
import { foundingSeats, foundingSupport } from '../server/economy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const L = s => console.log(s);
const core = readFileSync(path.join(root, 'engine/src/00-core.js'), 'utf8');
const R50 = +(/const FO_WAGE_R50=FO_WAGE_OVR50\*(\d+)/.exec(core) || [, 1000])[1]
  * +(/const FO_WAGE_OVR50=(\d+)/.exec(core) || [, 50])[1];
const MID = +/const FO_WAGE_MID=(\d+)/.exec(core)[1];
const K = +/const FO_WAGE_K=([\d.]+)/.exec(core)[1];

L('');
L('1. WHAT A WAGE IS IN THIS GAME');
L('='.repeat(86));
L('');
L('   Not A (a persistent contract salary) and not C (an abstract roster-cost');
L('   proxy). It is B: A DYNAMICALLY DERIVED MARKET-RATE SALARY, and the');
L('   architecture is unambiguous about it.');
L('');
L('   server/living.mjs calls host.derive(squad) for every club on every settle');
L('   and copies the derived fields back onto the player row. `wage` is in that');
L('   list beside `rating` and `bat`. The engine\'s jsDerive ends:');
L('');
L('       p.rating = Math.round(foOvr(p) * 1000);');
L('       p.wage   = foWageOf(p.rating, (p.talents||[]).length, 1);');
L('');
L('   So a man\'s wage is a pure function of his CURRENT card, recomputed three');
L('   times an hour. Nothing negotiates it, nothing signs it, and it has no');
L('   term. A cricketer who trains gets a rise the same week; a cricketer who');
L('   declines takes a cut. There is no contract anywhere in the schema.');
L('');
L('   THE ONE PLACE A WAGE IS REMEMBERED is the round it was charged in:');
L('   migration 101 banks the bill per club per round in wage_rounds, and');
L('   economy.mjs charges `billAt[...] ?? c.wages`. That is a LEDGER record of');
L('   what was paid, not a contract - it stops history being restated, and it');
L('   does not stop the next round being charged at a new price.');
L('');
L('   This matters for the whole phase: a wage that re-derives cannot be');
L('   changed "for new signings only". There are no old signings.');
L('');

L('2. THE EXACT FORMULA');
L('='.repeat(86));
L('');
L('   foWageOf(rating, talents, scar) =');
L('       max(400, round( MID x (rating/R50)^K x (1 + 0.06 x talents) x scar / 10) x 10)');
L('');
L('   read from engine/src/00-core.js:');
L('      FO_WAGE_OVR50   50        the median professional, by the ladder\'s meaning');
L('      FO_WAGE_R50     ' + R50 + '     ...as a rating, which is the card x 1000');
L('      FO_WAGE_MID     ' + MID + '      what that median man earns a round');
L('      FO_WAGE_K       ' + K + '       how fast the price of quality climbs');
L('');
L('   what each parameter controls:');
L('      R50    THE MIDPOINT\'S LOCATION on the card scale. Not a level: moving');
L('             it rescales every wage by (old/new)^K without changing any');
L('             ratio. This is the constant that went stale once - see below.');
L('      MID    THE ABSOLUTE LEVEL, and only that. Scaling it scales every wage');
L('             in the world by the same factor and leaves every ratio alone.');
L('      K      THE SHAPE, and only that. It tilts the ladder about OVR 50: a');
L('             man above the median gets cheaper as K falls, a man below it');
L('             gets DEARER. It cannot move the median man at all.');
L('      400    a floor, in dollars, on what any professional is paid.');
L('      0.06   a talent premium, multiplicative - worth more on a better man.');
L('');
L('   the ladder, at the shipped constants:');
L('');
L('      OVR    wage a round   vs median   +5 OVR    +10 OVR');
const wOf = c => Math.max(400, Math.round(MID * Math.pow(c * 1000 / R50, K) / 10) * 10);
for (const c of [20, 30, 40, 50, 60, 70, 80, 90, 95, 100]) {
  const w = wOf(c);
  const p5 = c <= 95 ? ((wOf(c + 5) / w - 1) * 100).toFixed(0) + '%' : '-';
  const p10 = c <= 90 ? ((wOf(c + 10) / w - 1) * 100).toFixed(0) + '%' : '-';
  L('      ' + String(c).padStart(3) + $(w).padStart(15)
    + (w / MID).toFixed(2).padStart(11) + 'x' + p5.padStart(9) + p10.padStart(11));
}
L('');
L('   SECTION 10: a +5 is worth 33% at OVR 50 and 17% at OVR 90; a +10 is 73%');
L('   and 37%. The PREMIUM IN DOLLARS grows with quality while the premium in');
L('   PERCENT shrinks, which is the right shape for a power law and is why a');
L('   star costs a squad rather than a line item. Nothing here demands a linear');
L('   relationship to measured cricket value, and the brief does not ask for one.');
L('');

L('3. WHERE THE LAW LIVES - FOUR COPIES, AND THEY MUST MOVE TOGETHER');
L('='.repeat(86));
L('');
L('   CANONICAL');
L('      engine/src/00-core.js   foWageOf()          the authority');
L('');
L('   MIRRORS, each with the constants written out because they cannot import');
L('      server/market.mjs       wageFromRating()    the umpire\'s valuations');
L('      engine 55-market.js     qsPrice()           what the page promises');
L('      migrations 065 + 098    plpgsql             what MOVES THE MONEY on a');
L('                                                  quicksell');
L('');
L('   Migration 065 says so itself: "THE THREE PLACES THIS SUM LIVES must agree,');
L('   or a manager is quoted one price and paid another... If any of the four');
L('   move, all four move."');
L('');
L('   AND MIGRATIONS ARE IMMUTABLE. 065 and 098 have run in production and');
L('   cannot be edited; a wage change needs a NEW numbered migration to');
L('   redefine the function. That is a cost of any change here, not a blocker.');
L('');
L('   the mirror currently agrees with the engine, checked on REAL dealt men:');
const host = makeHost();
// NOT ON HAND-BUILT ROWS. The first cut of this check passed
// {rating: c*1000, skills: {}} to host.derive and reported all five OVRs
// drifting. They were not: jsDerive RECOMPUTES rating from the skills beneath
// it, an empty skills object is a cricketer with nothing, and every man
// collapsed to the $400 floor. The probe was comparing the floor against the
// mirror. A card cannot be asserted from outside - it is derived - so the
// comparison has to be made on men the generator actually dealt.
const sample = host.derive(host.genSquad('world1|eng|0', 'England', 'rock', 'talisman', 1, 'flagship') || []);
const chk = sample.slice(0, 6);
let agree = 0;
for (const p of chk) {
  const mkt = wageFromRating(p.rating, (p.talents || []).length);
  if (p.wage === mkt) agree++;
  L('      OVR ' + String(Math.round(p.rating / 1000)).padStart(3)
    + '  ' + String((p.talents || []).length) + ' talent(s)'
    + '   engine ' + $(p.wage).padStart(10)
    + '   market.mjs ' + $(mkt).padStart(10) + (p.wage === mkt ? '   agree' : '   DRIFT'));
}
L('   ' + agree + ' of ' + chk.length + ' agree'
  + (agree === chk.length ? ' (tests/world-fee-agrees holds this mirror to the engine)'
    : ' - MIRROR HAS DRIFTED'));
L('');
L('   DOWNSTREAM OF THE WAGE, everything that prices a man:');
L('      market.mjs rawWorth   = wage x ' + FEE_ROUNDS + ' x ' + FEE_MULT
  + ' x ageCurve x form     -> every fee');
L('      quickSellOf           = rawWorth x 0.5                      -> every sale');
L('      botfinance botMoney   = squad wage bill                     -> bot posture');
L('      economy.mjs           = sum of p.wage over squad + youth    -> the ledger');
L('      squadStrength / UI    read the card, not the wage');
L('');

// ---------------------------------------------------------------------------
// 18. PROMOTION AND RELEGATION, UNDER EVERY CANDIDATE.
// ---------------------------------------------------------------------------
L('18. PROMOTION AND RELEGATION UNDER EACH CANDIDATE');
L('='.repeat(86));
L('');
L('   The SAME club, the SAME squad, the SAME following and the SAME finish,');
L('   playing one season in Division One instead of Division Two. Promotion is');
L('   measured BEFORE any discretionary strengthening, which is the guard.');
L('');
L('   ON FOUNDING COORDINATES, which is a different basis from the $1,899,801');
L('   Phase 4 reported: that figure came off the moving pyramid, where a');
L('   promoted club carries the following it has EARNED rather than the one it');
L('   was dealt. The level differs between the two bases; what matters here is');
L('   that the premium does not move with the wage scalar, and it does not on');
L('   either.');
L('');
const SLOT = 8, isBoss = false;
const sq = host.genSquad('world1|eng|' + SLOT, 'England', 'blade', 'general', 1, 'd2a') || [];
const bill = host.derive(sq).reduce((a, p) => a + (p.wage || 0), 0);
L('   slot ' + SLOT + ', dealt bill ' + $(bill) + ' a round');
L('');
L('   scale     in D2        in D1     promotion   relegation');
L('   ' + '-'.repeat(60));
for (const sc of [1.00, 0.95, 0.90, 0.85, 0.80, 0.75]) {
  const common = {
    slot: SLOT, isBoss, country: 'eng', wageRound: Math.round(bill * sc),
    pos: 4, wins: 8, bank0: 0,
    seats: foundingSeats(SLOT, isBoss), support: foundingSupport(SLOT, isBoss)
  };
  const d2 = seasonOf({ ...common, div: 2 }).net;
  const d1 = seasonOf({ ...common, div: 1 }).net;
  L('   ' + sc.toFixed(2).padStart(5) + $(d2).padStart(13) + $(d1).padStart(13)
    + $(d1 - d2).padStart(14) + $(d2 - d1).padStart(13));
}
L('');
L('   Promotion stays positive and relegation stays negative at every candidate,');
L('   and by the SAME amount: the promotion premium is media, sponsor and gate');
L('   against a division cost, and a wage scalar touches none of them. The');
L('   pyramid guard is untouched by anything this phase could do.');
L('');
