#!/usr/bin/env node
/* tools/roster-legality.mjs — WHAT THE ENGINE ACTUALLY REQUIRES OF A SQUAD
 *
 * Sections 1, 3 and 6 of the roster-continuity brief.
 *
 * The brief says the invariant is "at minimum 11 eligible players" and then
 * asks whether practical legality really needs 12, 13 or 15 - and tells me not
 * to guarantee a healthy fifteen if eleven is the true hard minimum. That is a
 * question about the ENGINE, not about taste, so it is answered by handing the
 * shipped engine progressively broken squads and seeing which ones it can play.
 *
 * Each case is a real match through host.runMatch. A case "passes" if the match
 * completes and returns a winner; it fails if the engine throws or returns
 * nothing. Nothing here is a proposal - it is the specification the repair has
 * to meet, measured rather than assumed.
 *
 *   node tools/roster-legality.mjs
 */
import { makeHost } from '../server/enginehost.mjs';

const L = s => console.log(s);
const host = makeHost();

// a real dealt squad to cut down, so every case is made of real cricketers
const full = host.derive(host.genSquad('legal|probe', 'England', 'balanced', 'general', 1, 'd2a') || []);
const opp = host.derive(host.genSquad('legal|opp', 'England', 'balanced', 'general', 1, 'd2a') || []);

const roleOf = p => (p.keeper ? 'keeper'
  : (p.bowlTypeFull && p.bowlTypeFull !== 'none' ? 'bowler' : 'bat'));

// A TIE IS NOT A CRASH, and the first cut of this file could not tell them
// apart. It scored a case as passing only if the result carried a WINNER, so a
// tied match - engine returns winner: null, which is a perfectly good cricket
// outcome - was reported as a failure. That is how a twelve-man side came to be
// listed as crashing in an early sweep when what it had actually done was tie.
// The two outcomes are separated here: only a THROW is a crash.
const tryMatch = (squad, label) => {
  let out = 'crash', why = '';
  try {
    const r = JSON.parse(host.runMatch(
      { name: 'Probe', players: squad }, { name: 'Opp', players: opp },
      'fair', 4242, {}, 'Sunny', false));
    out = r ? (r.winner ? 'PLAYS' : 'PLAYS (tied)') : 'no result';
  } catch (e) { why = e.message.slice(0, 60); out = 'CRASHES'; }
  L('   ' + label.padEnd(46) + out + (why ? '  ' + why : ''));
  return out.startsWith('PLAYS');
};

L('');
L('WHAT THE ENGINE REQUIRES OF A SQUAD');
L('='.repeat(78));
L('');
L('   the dealt squad: ' + full.length + ' men, '
  + full.filter(p => roleOf(p) === 'keeper').length + ' keeper(s), '
  + full.filter(p => roleOf(p) === 'bowler').length + ' bowler(s), '
  + full.filter(p => roleOf(p) === 'bat').length + ' batter(s)');
L('');

L('1. SQUAD SIZE, men removed worst-first');
L('');
const bySize = [...full].sort((a, b) => (b.rating || 0) - (a.rating || 0));
const sizeResults = {};
for (let n = full.length; n >= 6; n--) {
  sizeResults[n] = tryMatch(bySize.slice(0, n), n + ' men');
}
const firstFail = Object.keys(sizeResults).map(Number).sort((a, b) => b - a)
  .find(n => !sizeResults[n]);
L('');
L('   the largest squad that FAILS is ' + (firstFail == null ? 'none' : firstFail + ' men'));
L('');

L('2. ROLE LEGALITY at eleven men');
L('');
// ELEVEN MEN, AND ONLY THE ROLE VARIES. The first cut of this section built a
// bowler-less side by filtering the one dealt squad, which left EIGHT men - so
// it was testing a short side, not a bowler-less one, and duly "failed" for the
// reason section 1 had already established. A role test has to hold the size
// fixed, so the pools below are filled from as many dealt squads as it takes.
const poolOf = pred => {
  const out = [];
  for (let i = 0; i < 12 && out.length < 11; i++) {
    const sq = host.derive(host.genSquad('legal|pool' + i, 'England', 'balanced', 'general', 1, 'd2a') || []);
    for (const p of sq) if (pred(p) && out.length < 11 && !out.some(q => q.name === p.name)) out.push(p);
  }
  return out;
};
const eleven = bySize.slice(0, 11);
const noKeeper = poolOf(p => roleOf(p) !== 'keeper');
const noBowler = poolOf(p => roleOf(p) !== 'bowler');
const onlyBat = poolOf(p => roleOf(p) === 'bat');
tryMatch(eleven, 'eleven, normal shape');
tryMatch(noKeeper, 'eleven, NO keeper (' + noKeeper.length + ' men)');
tryMatch(noBowler, 'eleven, NO specialist bowler (' + noBowler.length + ' men)');
tryMatch(onlyBat, 'eleven, batters only (' + onlyBat.length + ' men)');
L('');

L('3. WHAT THE SHIPPED CODE ALREADY BELIEVES');
L('='.repeat(78));
L('');
L('   market.mjs  SQUAD_FLOOR   13    guards SELLING only, in two places:');
L('                                     :210 a bot will not list below it');
L('                                     :644 a sale will not complete below it');
L('   market.mjs  SQUAD_CEILING 18    nobody hoards beyond this');
L('   youth.mjs   RETIRE_AT     38    and retirement checks NEITHER');
L('');
L('   That asymmetry is the defect in one line: a club cannot SELL its way');
L('   below thirteen, and nothing at all stops it RETIRING its way below');
L('   eleven.');
L('');
