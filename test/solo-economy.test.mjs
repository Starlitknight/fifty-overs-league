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

// a solo season: eighteen rounds, nine of them at home
const ROUNDS = 18, HOME = 9;

// EVERY FIGURE HERE IS THE GAME'S OWN. This used to carry its own copy of the
// income rule - a $9 ticket and a $25,000 sponsor, written into the test - and
// when the ticket became a decision and the sponsor started following the
// club's standing, the copy went on passing while describing an economy that
// no longer existed. A guard that models the thing it is guarding is not a
// guard. It asks foGateOf, foSponsorOf, foGroundCost and foAcadCost.
function books() {
  const raw = run(`JSON.stringify(GD.teams.map(function(t){return {
    name:t.name, seats:t.seats, supporters:t.supporters, mood:t.mood,
    ticket:foTicketOf(t), fair:foFairPrice(t), crowd:foGateCrowd(t),
    gate:foGateOf(t), sponsor:foSponsorOf(t),
    wage:t.players.reduce(function(s,p){return s+(+p.wage||0)},0),
    ground:foGroundCost(t), acad:foAcadCost(t.acadY)+foAcadCost(t.acadS),
    men:t.players.length }}))`);
  return JSON.parse(raw).map(t => {
    const income = t.gate * HOME + t.sponsor * ROUNDS;
    const costs = (t.wage + t.ground + t.acad) * ROUNDS;
    return { ...t, income, costs, gateShare: t.gate * HOME / income,
             wageShare: t.wage * ROUNDS / income, share: costs / income };
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

test('the ticket is a decision, not a constant', () => {
  const t = 'GD.teams[0]';
  const fair = run(`foFairPrice(${t})`);
  // THE CROWD ARGUES BACK. Cheap fills the ground, dear empties it, and there
  // is a price in between where the money peaks - if there were not, there
  // would be nothing to decide and the old hardcoded $9 would have been as
  // good an answer as any.
  let best = 0, bestGate = 0, prices = [];
  for (let p = 4; p <= 30; p++) {
    const g = run(`foGateOf(${t},${p})`);
    prices.push([p, run(`foGateCrowd(${t},${p})`), g]);
    if (g > bestGate) { bestGate = g; best = p; }
  }
  assert.ok(best > 4 && best < 30, 'the best price is an interior one, not an end stop (got $' + best + ')');
  assert.ok(best > fair, 'the money peaks just ABOVE what the crowd calls fair, so there is something to find');
  assert.ok(best < fair * 1.35, 'but not so far above that the answer is always "charge the maximum"');
  // the crowd only ever shrinks as the price rises, and never exceeds the seats
  const seats = run(`+${t}.seats`);
  for (let i = 1; i < prices.length; i++) {
    assert.ok(prices[i][1] <= prices[i - 1][1], 'a dearer ticket never brings MORE people ($' + prices[i][0] + ')');
    assert.ok(prices[i][1] <= seats, 'never more people than seats');
  }
  assert.equal(prices[prices.length - 1][1], 0, 'at thirty dollars a head nobody comes');

  // AND THE FAIR PRICE IS A FACT ABOUT THE CLUB, not a constant either: a side
  // winning things can charge for it.
  const before = run(`(function(){${t}.mood=1;return foFairPrice(${t})})()`);
  const after = run(`(function(){${t}.mood=5;return foFairPrice(${t})})()`);
  assert.ok(after > before * 1.2, 'a happy crowd will pay more (' + before + ' then ' + after + ')');
  run(`${t}.mood=3`);

  // and charging over the odds costs supporters, so the best gate this round
  // and the best gate this season are not the same price
  assert.equal(run(`(function(){${t}.ticket=Math.round(foFairPrice(${t}));return foTicketDrift(${t})})()`), 1,
    'a fair price keeps your following');
  const greedy = run(`(function(){${t}.ticket=Math.round(foFairPrice(${t})*1.6);return foTicketDrift(${t})})()`);
  assert.ok(greedy < 1 && greedy >= 0.92, 'gouging bleeds the base, but never faster than 8% a match');
  run(`${t}.ticket=0`);
});

test('the crowd is the club\'s biggest earner, not the sponsor', () => {
  // A $25,000 standing order every round, whoever you were and however you
  // were doing, was 69% of a cricket club's income. The gate was 31%. That is
  // backwards for a sport whose clubs live on who turns up, and it is why the
  // ticket could be a constant without anybody noticing.
  const all = books();
  for (const t of all) {
    assert.ok(t.gateShare > 0.5,
      t.name + ': the gate is only ' + Math.round(t.gateShare * 100) + '% of income; the crowd should be the club');
  }
  // and the sponsor follows the club's standing, so winning pays twice
  const lo = run('(function(){GD.teams[0].mood=0;return foSponsorOf(GD.teams[0])})()');
  const hi = run('(function(){GD.teams[0].mood=6;return foSponsorOf(GD.teams[0])})()');
  run('GD.teams[0].mood=3');
  assert.ok(hi > lo * 2, 'a sponsor buys a shirt because of who is wearing it (' + lo + ' then ' + hi + ')');
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
