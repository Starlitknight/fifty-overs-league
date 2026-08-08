/* test/solo-economy.test.mjs — THE OFFLINE CAREER CAN PAY ITS WAGES.
 *
 * WHY THIS FILE EXISTS. The convex wage curve was written for the SERVED
 * world, calibrated to a $26 ticket and a crowd that follows a club's
 * standing. jsDerive is shared with the solo career, which is settled in the
 * browser against entirely different constants - a $9 ticket, a $25,000
 * sponsor, a bank of a million - so the curve silently multiplied an offline
 * club's wage bill by five while its income did not move. A squad that cost
 * $459k a season came to cost $2.43m. Every solo career was bankrupt on the
 * day it was founded, and it shipped, because 280 tests all watched the served
 * world and not one of them settled a solo season.
 *
 * So this holds the offline game to its own arithmetic. It reads the SHIPPED
 * build's own wage rule and the solo economy's own constants, and asserts that
 * a founding squad is affordable against them - which is the single fact the
 * whole offline game rests on and the one nobody was checking.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { makeEngine } from './engine-vm.mjs';

const { ctx } = makeEngine();
const run = (src) => vm.runInContext(src, ctx);

// the solo economy's own figures, from 03-onboarding's FO_FIN and the engine
// it documents: 18 rounds, 9 of them at home, a $9 ticket, a $25,000 sponsor
const ROUNDS = 18, HOME = 9, TICKET = 9, SPONSOR = 25000;

test('a browser playing solo is not on the served world\'s wage curve', () => {
  // __foServedEcon is what the service sets when it loads this engine. A
  // browser never does, and this harness is a browser.
  const served = run('(function(){try{return !!globalThis.__foServedEcon}catch(e){return false}})()');
  assert.equal(served, false, 'the harness stands in for a browser, which is not the served world');
  // rating 42,588 is a real generated cricketer. On the flat rule he is
  // $1,776; on the served curve he is five times that.
  const wage = run('foWageOf(42588,0,1)');
  assert.ok(wage > 1500 && wage < 2200,
    'a solo cricketer is priced by the solo rule, not the served one (got ' + wage + ')');
});

test('a founding solo squad is affordable out of a solo season', () => {
  const bill = run('(function(){var t=GD.teams[0];' +
    'return t.players.reduce(function(s,p){return s+(+p.wage||0)},0)})()');
  const size = run('GD.teams[0].players.length');
  assert.ok(bill > 0 && size >= 11, 'a real squad with real wages (' + size + ' men)');

  // what the club takes in a season: nine home gates plus the sponsor every
  // round. Attendance is the engine's own: supporters x (0.55 + 0.13 x mood).
  const supporters = run('(GD.teams[0].supporters||2600)');
  const crowd = Math.round(supporters * (0.55 + 0.13 * 3));
  const income = crowd * TICKET * HOME + SPONSOR * ROUNDS;
  const wages = bill * ROUNDS;

  const share = wages / income;
  // WHERE 1.4 COMES FROM. The baked squads already run near the line - about
  // 99% of a season's income on wages - and that is the balance the offline
  // game has always shipped with, not something this file is here to argue
  // with. What it is here to catch is the served world's curve arriving in
  // the browser, which took the same bill to roughly FIVE times income. The
  // gap between 99% and 500% is wide enough to sit a guard in without
  // pinning a balance nobody asked me to change.
  assert.ok(share < 1.4,
    'the wage bill has run away: ' + Math.round(share * 100) + '% of income ' +
    '(wages $' + wages.toLocaleString() + ' against income $' + income.toLocaleString() + '). ' +
    'If this fails after a change to foWageOf, the served world\'s curve has ' +
    'reached the offline game again - it is calibrated to a $26 ticket and a ' +
    'crowd that follows standing, and the browser has neither.');
  assert.ok(share > 0.10,
    'and it must not be free either: ' + Math.round(share * 100) + '%');
});

test('the draft budget and the solo bank are the same money', () => {
  // scaling the draft without scaling the bank gave a $6m budget to a club
  // with $1m in it. The draft is solo money; a served club is dealt its
  // fifteen and never drafts.
  const scale = run('FO_DRAFT_SCALE');
  assert.equal(scale, 1, 'the draft is priced in solo money, which did not move');
});

test('a cricketer is worth a season of his wages, on either economy', () => {
  // playerValue sets the asking price and the AI's bids in the solo market.
  // It used to be wage x 34 plus a linear term in rating - a third valuation
  // that drifted the moment the other two stopped being straight lines.
  const v = run('playerValue({wage:1776,rating:42588,age:27,talents:[]})');
  const expected = Math.max(5000, Math.round(1776 * 18 * 2.4 * 1.0 / 500) * 500);
  assert.equal(v, expected, 'a fee is a season of wages times the buyer\'s multiple');
  // and the years left move it the way they move a fee everywhere else
  const young = run('playerValue({wage:1776,rating:42588,age:22,talents:[]})');
  const old = run('playerValue({wage:1776,rating:42588,age:34,talents:[]})');
  assert.ok(young > v && v > old, 'youth is worth more and age is worth less');
});
