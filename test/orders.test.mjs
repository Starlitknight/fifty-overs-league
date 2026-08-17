/* THE ORDERS ARE THE ORDERS.
 *
 * A saved sheet is a manager's whole voice in a match he will not attend.
 * These tests hold the resolver to it: the phase plan, a batter's own
 * instruction, a bowler's field and the toss call all reach real deliveries,
 * for EITHER club - not just the one whose client happens to be running.
 *
 * The other half of the law is silence: a club that saved nothing must play
 * exactly as it always did, which is what the golden masters guard.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeEngine } from './engine-vm.mjs';

const eng = makeEngine();
const side = (seed, nm, arch) => {
  const s = eng.genSquad(seed, 'England', arch || 'balanced', 'general');
  return { name: nm, players: s.players, ground: nm + ' Oval' };
};
const A = side(9001, 'Ashfield'), B = side(9002, 'Brackenby');
const runsOf = (r, nm) => {
  const inn = (r.innings || []).find(x => x && x.batTeam === nm);
  return inn ? inn.runs : -1;
};
const SEEDS = [3101, 3102, 3103, 3104, 3105, 3106];

test('a phase plan changes how the club bats - rate up, wickets up', () => {
  // batting first, with no target to chase, isolates the plan from the
  // captain's own scoreboard sense.
  //
  // EIGHTEEN SEEDS, NOT SIX, and they are this test's own. The wickets
  // half of the claim is a ~+2 wickets/innings effect (measured at N=48:
  // 5.7 defending v 7.9 launching, goW>=defW on 40 of 48 seeds) - but the
  // per-seed draw is deterministic, so a six-seed set that happens to
  // break against it does not average out on re-run, it fails FOREVER.
  // The captaincy-judgement engine re-dealt every innings (the fielding
  // captain's bowling changes moved) and the old six seeds landed 4-2 the
  // wrong way on wickets while the rate half still passed. Eighteen seeds
  // put the aggregate safely past the noise for an effect this size
  // without letting the suite crawl.
  const PLAN_SEEDS = [3101, 3102, 3103, 3104, 3105, 3106, 3107, 3108, 3109,
    3110, 3111, 3112, 3113, 3114, 3115, 3116, 3117, 3118];
  let dR = 0, dB = 0, dW = 0, gR = 0, gB = 0, gW = 0, diffs = 0;
  for (const seed of PLAN_SEEDS) {
    const def = eng.sim(A, B, 'balanced', 'Sunny', seed, { Ashfield: { tossDecision: 'bat', phaseIntent: { pp: -1, mid: -1, death: -1 } } });
    const go = eng.sim(A, B, 'balanced', 'Sunny', seed, { Ashfield: { tossDecision: 'bat', phaseIntent: { pp: 2, mid: 2, death: 2 } } });
    assert.ok(def && go, 'a match failed to complete');
    const d = def.innings[0], g = go.innings[0];
    assert.equal(d.batTeam, 'Ashfield'); assert.equal(g.batTeam, 'Ashfield');
    if (d.runs !== g.runs || d.wkts !== g.wkts) diffs++;
    dR += d.runs; dB += d.legal; dW += d.wkts;
    gR += g.runs; gB += g.legal; gW += g.wkts;
  }
  assert.equal(diffs, PLAN_SEEDS.length, 'the plan left some innings untouched');
  assert.ok(6 * gR / gB > 6 * dR / dB, 'launching scored no faster than shutting up shop');
  assert.ok(gW >= dW, 'launching cost no more wickets than defending');
});

test("the away club's sheet is read too - the resolver has no home team", () => {
  // WHAT "REACHED THE MIDDLE" MEANS. This compared the innings TOTAL and
  // nothing else, on one seed - so a plan that changed every ball of the
  // innings and happened to arrive at the same score read as a plan that was
  // never heard. (The extras calibration produced exactly that coincidence:
  // 234 both ways, off two completely different innings.) The question is
  // whether the sheet altered the cricket, so the innings itself is what is
  // compared, and over several seeds rather than one.
  let heard = 0;
  for (const seed of [4242, 4243, 4244]) {
    const flat = eng.sim(A, B, 'balanced', 'Sunny', seed);
    const away = eng.sim(A, B, 'balanced', 'Sunny', seed, { Brackenby: { phaseIntent: { pp: 2, mid: 2, death: 2 } } });
    assert.ok(flat && away, 'a match failed to complete');
    const inn = r => (r.innings || []).find(x => x && x.batTeam === 'Brackenby');
    if (JSON.stringify(inn(flat)) !== JSON.stringify(inn(away))) heard++;
  }
  assert.equal(heard, 3, "Brackenby's own plan never reached the middle");
});

test("a batter's own instruction reaches his deliveries", () => {
  // The man told to launch must be a man who actually BATS. This used to
  // instruct A.players[0] and assume he opened - but the batting order is
  // form-adjusted per seed, and in some innings he walks in at seven and
  // faces a dozen balls, or the top order bats through and he never comes
  // in at all. An instruction to a man in the pavilion is a no-op, and the
  // test was reading that no-op as a broken order path. So each seed asks
  // the base innings who faced the most deliveries, and instructs HIM.
  const plan = { tossDecision: 'bat', phaseIntent: { pp: 0, mid: 0, death: 1 } };
  let diffs = 0;
  for (const seed of SEEDS) {
    const base = eng.sim(A, B, 'balanced', 'Sunny', seed, { Ashfield: plan });
    assert.ok(base);
    const faced = (base.innings[0].bat || [])
      .map(x => ({ name: (x.p || x).name, b: x.b || 0 }))
      .sort((p, q) => q.b - p.b)[0];
    assert.ok(faced && faced.b >= 20, 'somebody faced a real innings');
    const told = eng.sim(A, B, 'balanced', 'Sunny', seed,
      { Ashfield: { tossDecision: 'bat', phaseIntent: plan.phaseIntent, manBat: { [faced.name]: 2 } } });
    assert.ok(told);
    // HIS LINE, NOT THE TEAM TOTAL. The total is a weak proxy and it lied: two
    // different innings can land on the same score, and twice in six seeds they
    // did - 284 against 284, 129 against 129 - while the instructed man had in
    // fact gone from 97 off 110 to 46 off 43, and from 37 off 44 to nought
    // first ball. The order reached him perfectly; the assertion could not see
    // it, because the rest of the innings made the difference back. So the test
    // now reads the man it instructed, which is what it always claimed to.
    const lineOf = r => {
      const b = (r.innings[0].bat || []).find(x => ((x.p || x).name) === faced.name);
      return b ? (b.r | 0) + '/' + (b.b | 0) + '/' + (b.out || '') : 'absent';
    };
    if (lineOf(base) !== lineOf(told)) diffs++;
  }
  assert.equal(diffs, SEEDS.length, 'a launch order did not reach the man it named');
});

test("a bowler's own field reaches his overs", () => {
  // THE TEAM TOTAL IS A WEAK PROXY, and this test was the last place still
  // trusting it - the same mistake the launch-order test above documents at
  // length. Two genuinely different innings can land on the same score, and on
  // one seed that is a coin flip; it duly came up heads once the engine's
  // wicket rate moved. The full scorecard cannot coincide, so read that, and
  // read several seeds so the assertion is about the order reaching the field
  // rather than about one afternoon.
  const att = {}, def = {};
  B.players.forEach(p => { if (p.bowlType) { att[p.name] = 'att'; def[p.name] = 'def'; } });
  assert.ok(Object.keys(att).length >= 4, 'test squad has no bowlers');
  // AND IT IS ASHFIELD'S INNINGS, whichever of the two it is. innings[0] is
  // whoever batted first and the toss moves with the seed, so on a seed where
  // Brackenby batted first this was comparing Brackenby's own batting against
  // itself - an innings the Brackenby field order cannot touch - and calling the
  // identical result a failure.
  const card = r => {
    const inn = (r.innings || []).find(i => i && i.batTeam === 'Ashfield') || r.innings[0];
    return (inn.bat || []).map(x => ((x.p || x).name) + ':' + (x.r | 0) + '/' + (x.b | 0)).join('|');
  };
  let diffs = 0;
  for (const seed of [6060, 6061, 6062]) {
    const a = eng.sim(A, B, 'balanced', 'Sunny', seed, { Brackenby: { manBowl: att } });
    const d = eng.sim(A, B, 'balanced', 'Sunny', seed, { Brackenby: { manBowl: def } });
    assert.ok(a && d);
    if (card(a) !== card(d)) diffs++;
  }
  assert.equal(diffs, 3, 'attacking and defensive fields produced the same innings');
});

test('the toss decision on the sheet is the decision taken', () => {
  for (const seed of [7001, 7002, 7003]) {
    const bat = eng.sim(A, B, 'balanced', 'Sunny', seed, { Ashfield: { tossDecision: 'bat' } });
    const bowl = eng.sim(A, B, 'balanced', 'Sunny', seed, { Ashfield: { tossDecision: 'bowl' } });
    assert.equal(bat.batFirstTeam, 'Ashfield', 'chose to bat and did not bat');
    assert.equal(bowl.batFirstTeam, 'Brackenby', 'chose to bowl and batted anyway');
  }
});

test('a club with no sheet plays exactly as it always did', () => {
  const seed = 8080;
  const bare = eng.sim(A, B, 'balanced', 'Sunny', seed);
  const empty = eng.sim(A, B, 'balanced', 'Sunny', seed, { Ashfield: { xi: [] } });
  assert.equal(runsOf(bare, 'Ashfield'), runsOf(empty, 'Ashfield'));
  assert.equal(runsOf(bare, 'Brackenby'), runsOf(empty, 'Brackenby'));
});
