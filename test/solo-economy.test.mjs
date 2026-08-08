/* test/solo-economy.test.mjs — THE OFFLINE CAREER CAN PAY ITS BILLS.
 *
 * WHY THIS FILE EXISTS. The convex wage curve was written for the SERVED
 * world, calibrated to a $26 ticket and a crowd that follows a club's
 * standing. jsDerive is shared with the solo career, which is settled in the
 * browser against entirely different constants - a $9 ticket, a $25,000
 * sponsor, a bank of a million - so the curve silently multiplied an offline
 * club's wage bill by five while its income did not move. Every solo career
 * was bankrupt on the day it was founded, and it shipped, because 280 tests
 * all watched the served world and not one of them settled a solo season.
 *
 * WHY IT NOW WATCHES MORE THAN WAGES. The first version of this file guarded
 * the wage bill and nothing else, so it sat there passing at 99% of income
 * while the ACADEMIES quietly took another 44% and the ground 25%. A founding
 * club took $647,964 a season and spent $1,092,078 - 169% - and went under in
 * 41 rounds having signed nobody. A guard that watches one line of three is
 * how that goes unseen, so this one settles the whole stack.
 *
 * It reads the SHIPPED build's own rules - foWageOf, foGroundCost, foAcadCost -
 * and the solo economy's own constants, and asserts that a founding club can
 * carry its squad, its ground and its academies out of one season's income.
 * That is the single fact the whole offline game rests on.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { makeEngine } from './engine-vm.mjs';

const { ctx } = makeEngine();
const run = (src) => vm.runInContext(src, ctx);
// opening the books is what derives the wages, exactly as it does in a browser
run('econInit()');

// the solo economy's own figures, from 03-onboarding's FO_FIN and the engine
// it documents: 18 rounds, 9 of them at home, a $9 ticket, a $25,000 sponsor
const ROUNDS = 18, HOME = 9, TICKET = 9, SPONSOR = 25000;

// every club's books for one season, settled from the shipped rules
function books() {
  const raw = run(`JSON.stringify(GD.teams.map(function(t){return {
    name:t.name, seats:t.seats, supporters:t.supporters, mood:t.mood,
    wage:t.players.reduce(function(s,p){return s+(+p.wage||0)},0),
    ground:foGroundCost(t), acad:foAcadCost(t.acadY)+foAcadCost(t.acadS),
    men:t.players.length }}))`);
  return JSON.parse(raw).map(t => {
    // attendance is the engine's own: supporters x (0.55 + 0.13 x mood), capped by seats
    const att = Math.min(t.seats, Math.round(t.supporters * (0.55 + 0.13 * (t.mood == null ? 3 : t.mood))));
    const income = att * TICKET * HOME + SPONSOR * ROUNDS;
    const costs = (t.wage + t.ground + t.acad) * ROUNDS;
    return { ...t, att, income, costs, wageShare: t.wage * ROUNDS / income, share: costs / income };
  });
}

test('a browser playing solo is not on the served world\'s wage curve', () => {
  // __foServedEcon is what the service sets when it loads this engine. A
  // browser never does, and this harness is a browser.
  const served = run('(function(){try{return !!globalThis.__foServedEcon}catch(e){return false}})()');
  assert.equal(served, false, 'the harness stands in for a browser, which is not the served world');
  // the two curves take the same rating to very different money, because they
  // are calibrated to very different income
  const solo = run('foWageOf(50350,0,1)');
  const servedWage = run('FO_WAGE_MID');
  assert.ok(solo > 0 && solo < servedWage / 4,
    'the solo median is priced in solo money, not served money (got ' + solo + ')');
});

test('the solo curve is convex: twice the cricketer is not twice the price', () => {
  // THE FAULT THIS CURVE EXISTS TO CURE. The solo game was on 200 + rating x
  // 0.037, so the best cricketer in it cost $2,903 and the worst $1,280 - two
  // and a half times the man for two and a third times the money.
  const lo = run('foWageOf(30000,0,1)'), hi = run('foWageOf(60000,0,1)');
  assert.ok(hi / lo > 3.2,
    'double the rating should cost far more than double (got ' + (hi / lo).toFixed(1) + 'x)');
  // and a talent is a premium ON what he already is, worth more on a better man
  const plain = run('foWageOf(60000,0,1)'), gifted = run('foWageOf(60000,2,1)');
  assert.ok(gifted > plain, 'talents are paid for');
});

test('a wage is derived from the man, never remembered', () => {
  // the baked squads shipped a wage per player written into the data, and it
  // had stopped tracking rating at all: 29,200 was paid $1,638 and 50,350 was
  // paid $1,835. There was no rule to move, only a hundred and sixty numbers.
  const bad = run(`(function(){var out=[];GD.teams.forEach(function(t){t.players.forEach(function(p){
    if(!p.rating)return;
    var want=foWageOf(p.rating,(p.talents||[]).length,1);
    if(p.wage!==want)out.push(p.name+' '+p.wage+' != '+want);
  })});return JSON.stringify(out.slice(0,5))})()`);
  assert.deepEqual(JSON.parse(bad), [], 'every wage on the board is the curve\'s own answer');
  // and a better cricketer is always the dearer one - LIKE FOR LIKE. A stored
  // wage was not; the curve is. Talents are compared separately because a
  // talent is a premium, so a gifted man may out-earn a higher-rated plain
  // one, which is the point of paying for one.
  const byTal = {};
  JSON.parse(run(`JSON.stringify(GD.teams.flatMap(function(t){return t.players.map(function(p){
    return [p.rating, p.wage, (p.talents||[]).length]})}))`))
    .forEach(([r, w, n]) => (byTal[n] = byTal[n] || []).push([r, w]));
  for (const n of Object.keys(byTal)) {
    const list = byTal[n].sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < list.length; i++) {
      assert.ok(list[i][1] >= list[i - 1][1],
        n + '-talent wages rise with rating (' + list[i - 1] + ' then ' + list[i] + ')');
    }
  }
});

test('a founding club can carry its whole cost stack out of one season', () => {
  const all = books();
  assert.ok(all.length >= 10 && all.every(t => t.men >= 11), 'real clubs with real squads');

  for (const t of all) {
    // THE WHOLE STACK, not the wage line. This is the assertion the first
    // version of this file was missing: at 169% every club went under in 2.3
    // seasons, and the wage-only guard passed the whole way down.
    assert.ok(t.share < 0.92,
      t.name + ' cannot pay its bills: ' + Math.round(t.share * 100) + '% of income ' +
      '(wages $' + (t.wage * ROUNDS).toLocaleString() +
      ', ground $' + (t.ground * ROUNDS).toLocaleString() +
      ', academies $' + (t.acad * ROUNDS).toLocaleString() +
      ' against income $' + t.income.toLocaleString() + '). ' +
      'A club that cannot bank a surplus can never sign anybody, which is the ' +
      'whole game.');
    assert.ok(t.income > t.costs, t.name + ' runs at a loss before it has bought anyone');
    // and it must not be free either, or there is no decision to make
    assert.ok(t.share > 0.35, t.name + ' is being given the season: ' + Math.round(t.share * 100) + '%');
  }

  // the wage line is still the biggest of the three, as it is in the real sport
  const mean = all.reduce((s, t) => s + t.wageShare, 0) / all.length;
  assert.ok(mean > 0.40 && mean < 0.70,
    'the mean wage bill is ' + Math.round(mean * 100) + '% of income, off its 55% mark');
  for (const t of all) assert.ok(t.wage > t.ground + t.acad, t.name + ': the squad should cost more than the buildings');
});

test('the three bills are each written down exactly once', () => {
  // the ground cost $1/seat in the settler and $1/seat in one display and
  // (acadY+acadS)x2500 in one place and acadCost(level) in another - two
  // rules for one bill, in a file where neither knew about the other. That is
  // how a price drifts. These are the single sources now.
  assert.equal(run('foGroundCost({seats:9000})'), run('FO_SOLO_GROUND') * 9000);
  assert.equal(run('foGroundCost({})'), run('FO_SOLO_GROUND') * 10000, 'a club with no ground still has a ground bill');
  assert.equal(run('foAcadCost(2)'), run('FO_SOLO_ACAD[2]'));
  assert.equal(run('foAcadCost(99)'), run('FO_SOLO_ACAD[5]'), 'the ladder is clamped, not extrapolated');
  assert.equal(run('foAcadCost(0)'), 0, 'no academy, no upkeep');
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
