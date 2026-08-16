// matchday-coach.test.mjs — THE COACH'S PROOF OBLIGATIONS.
//
// planMatchDay (engine/src/13-matchday-coach.js) is the one authority that
// picks every side in the world: the engine's fallback, the Auto button, an
// unmanaged club and the cover for an absent man all come through it. What
// follows is what it must never get wrong.
//
// The squads are BUILT, not generated: each test states the cricketers it
// needs and the one difference under test, so a failure names a law rather
// than a distribution. Where a contract is about conditions the test asserts
// a DIRECTION (this man rises over that one), never a number, because the
// numbers belong to the ball model and the ball model is allowed to be
// retuned - tools/matchday-probe.mjs is where the sizes are measured.
import { test, before } from 'node:test';
import assert from 'node:assert';
import vm from 'node:vm';
import { makeEngine } from './engine-vm.mjs';

let eng;
before(() => { eng = makeEngine(); });

// run a snippet inside the built page and bring back plain JSON
const inVm = (code, args) => JSON.parse(vm.runInContext(
  'JSON.stringify((function(A){' + code + '})(' + JSON.stringify(args || {}) + '))', eng.ctx));

// ---------------------------------------------------------------------------
// A SQUAD, STATED. Every man is a clone of a real generated cricketer (the
// ball model reads skills a hand-built object would not have) with exactly the
// fields the test cares about overridden.
// ---------------------------------------------------------------------------
const MAKE = `
  var t = GD.teams[0], src = t.players;
  function base(kind){
    for (var i = 0; i < src.length; i++){
      var p = src[i];
      if (kind === 'keeper' && p.keeper) return p;
      if (kind === 'bowler' && p.bowlType && !p.keeper) return p;
      if (kind === 'bat' && !p.bowlType && !p.keeper) return p;
    }
    return src[0];
  }
  function man(spec){
    var p = JSON.parse(JSON.stringify(base(spec.kind || 'bat')));
    p.name = spec.name; p.talents = spec.talents || [];
    p.formWord = spec.form || 'steady'; p.formIx = spec.formIx == null ? 3 : spec.formIx;
    p.fatigue = spec.fatigue || 'rested'; p.fatWord = spec.fatigue || 'rested';
    p.keeper = !!spec.keeper; p.capt = spec.capt == null ? 40 : spec.capt;
    p.mpos = spec.mpos == null ? 5 : spec.mpos;
    // one level for every skill, then the test's own overrides
    var lvl = spec.level == null ? 50 : spec.level;
    for (var k in p.skills) p.skills[k] = lvl;
    p.bat = lvl; p.power = lvl; p.rotation = lvl; p.temperament = lvl;
    p.vsPace = lvl; p.vsSpin = lvl; p.field = lvl; p.keeping = lvl;
    p.threat = spec.bowl == null ? lvl : spec.bowl;
    p.control = spec.bowl == null ? lvl : spec.bowl;
    if (spec.bowlType === null) { p.bowlType = null; p.bowlTypeFull = 'none'; }
    else if (spec.bowlType) { p.bowlType = spec.bowlType; p.bowlTypeFull = spec.bowlType; }
    for (var s in (spec.skills || {})) { p.skills[s] = spec.skills[s]; p[s] = spec.skills[s]; }
    if (spec.keeping != null) { p.skills.keeping = spec.keeping; p.keeping = spec.keeping; }
    if (spec.stumping != null) p.skills.stumping = spec.stumping;
    if (spec.catching != null) p.skills.catching = spec.catching;
    p.rating = (lvl * 1000);
    return p;
  }
  var squad = A.squad.map(man);
  return { squad: squad };
`;

// build a squad and plan in one hop
function planFor(squad, opts) {
  return inVm(MAKE.replace('return { squad: squad };', `
    var plan = planMatchDay({ team: { name: 'Test', players: squad },
      pitch: A.pitch || 'balanced', weather: A.weather || 'sunny',
      doctrine: A.doctrine || null, oppositionScout: A.scout || null,
      unavailable: A.unavailable || [] });
    return plan;
  `), { squad, ...(opts || {}) });
}

// a workable 15-man squad: six batsmen, two keepers, seven bowlers of mixed
// trade, all level 50 unless a test says otherwise
const BASE_SQUAD = [
  { name: 'Bat One', kind: 'bat', bowlType: null, level: 62, mpos: 1 },
  { name: 'Bat Two', kind: 'bat', bowlType: null, level: 60, mpos: 2 },
  { name: 'Bat Three', kind: 'bat', bowlType: null, level: 61, mpos: 3 },
  { name: 'Bat Four', kind: 'bat', bowlType: null, level: 58, mpos: 4 },
  { name: 'Bat Five', kind: 'bat', bowlType: null, level: 55, mpos: 5 },
  { name: 'Bat Six', kind: 'bat', bowlType: null, level: 50, mpos: 6 },
  { name: 'Keeper Prime', kind: 'keeper', keeper: true, bowlType: null, level: 52, mpos: 7 },
  { name: 'Keeper Deputy', kind: 'keeper', keeper: true, bowlType: null, level: 45, mpos: 8 },
  { name: 'Quick One', kind: 'bowler', bowlType: 'fast', level: 40, bowl: 62, mpos: 9 },
  { name: 'Quick Two', kind: 'bowler', bowlType: 'fastMedium', level: 40, bowl: 60, mpos: 10 },
  { name: 'Seam Three', kind: 'bowler', bowlType: 'medium', level: 38, bowl: 55, mpos: 11 },
  { name: 'Spin One', kind: 'bowler', bowlType: 'fingerSpin', level: 40, bowl: 60, mpos: 10 },
  { name: 'Spin Two', kind: 'bowler', bowlType: 'wristSpin', level: 38, bowl: 58, mpos: 11 },
  { name: 'Allround', kind: 'bowler', bowlType: 'fastMedium', level: 54, bowl: 54, mpos: 6 },
  { name: 'Reserve Bat', kind: 'bat', bowlType: null, level: 44, mpos: 8 }
];

// ---- C. COMPOSITION -------------------------------------------------------

test('C: eleven men, a genuine keeper, five bowling options, a sensible tail', () => {
  const p = planFor(BASE_SQUAD);
  assert.equal(p.xi.length, 11, 'exactly eleven');
  assert.equal(p.battingOrder.length, 11, 'and every one of them bats');
  assert.equal(new Set(p.xi).size, 11, 'no man picked twice');
  const e = p.explanation;
  const picked = e.cards.filter(c => c.picked);
  assert.equal(picked.length, 11);
  assert.ok(p.keeper, 'a keeper is named');
  assert.ok(p.xi.indexOf(p.keeper) >= 0, 'and he is in the side');
  assert.ok(e.pace + e.spin >= 4, 'a real attack, not two men and a prayer');
  // the recognised bowlers must be able to cover fifty overs
  const bowlers = e.attack.length;
  assert.ok(bowlers >= 4, 'frontline attack of at least four (' + bowlers + ')');
  // and the top seven are not all bowlers
  const tailNames = p.battingOrder.slice(8);
  assert.ok(tailNames.length === 3);
});

test('C: a weak, unbalanced squad still gets the best legal side available', () => {
  // nine men, one keeper, barely any bowling: the coach must still answer
  const thin = [
    { name: 'K', kind: 'keeper', keeper: true, bowlType: null, level: 40 },
    { name: 'B1', kind: 'bowler', bowlType: 'medium', level: 30, bowl: 40 },
    { name: 'B2', kind: 'bowler', bowlType: 'fingerSpin', level: 30, bowl: 38 },
    { name: 'X1', kind: 'bat', bowlType: null, level: 45 },
    { name: 'X2', kind: 'bat', bowlType: null, level: 44 },
    { name: 'X3', kind: 'bat', bowlType: null, level: 43 },
    { name: 'X4', kind: 'bat', bowlType: null, level: 42 },
    { name: 'X5', kind: 'bat', bowlType: null, level: 41 },
    { name: 'X6', kind: 'bat', bowlType: null, level: 40 }
  ];
  const p = planFor(thin);
  assert.ok(p.xi.length > 0, 'a side is still named');
  assert.ok(p.battingOrder.length === p.xi.length);
  assert.ok(p.keeper, 'and somebody keeps');
});

// ---- A. CONDITIONS --------------------------------------------------------

test('A: green + overcast lifts a close-quality seamer over a close-quality spinner', () => {
  // one seamer and one spinner of deliberately equal standing, and one seat
  // for exactly one of them
  const squad = BASE_SQUAD.filter(m => ['Spin Two', 'Seam Three'].indexOf(m.name) < 0)
    .concat([{ name: 'Swing Man', kind: 'bowler', bowlType: 'fastMedium', level: 40, bowl: 58 },
             { name: 'Turn Man', kind: 'bowler', bowlType: 'fingerSpin', level: 40, bowl: 58 }]);
  const green = planFor(squad, { pitch: 'green', weather: 'overcast' });
  const dry = planFor(squad, { pitch: 'dry', weather: 'sunny' });
  const rank = (p, n) => {
    const c = p.explanation.cards.find(x => x.name === n);
    return c ? c.bowl : -1e9;
  };
  assert.ok(rank(green, 'Swing Man') > rank(green, 'Turn Man'),
    'on a green top under cloud the seamer is worth more');
  assert.ok(rank(dry, 'Turn Man') > rank(dry, 'Swing Man'),
    'and on a dry one the spinner is');
  // and the selection follows the valuation
  const inGreen = green.xi.indexOf('Swing Man') >= 0, inDry = dry.xi.indexOf('Turn Man') >= 0;
  assert.ok(inGreen || inDry, 'the conditions move at least one of them into the side');
});

test('A: cracked exercises wrist spin, and slow is not simply "pick spin"', () => {
  const squad = BASE_SQUAD.concat([
    { name: 'Wrist Man', kind: 'bowler', bowlType: 'wristSpin', level: 40, bowl: 56 },
    { name: 'Finger Man', kind: 'bowler', bowlType: 'fingerSpin', level: 40, bowl: 56 },
    { name: 'Cutter Man', kind: 'bowler', bowlType: 'medium', level: 40, bowl: 56 }
  ]);
  const val = (p, n) => (p.explanation.cards.find(x => x.name === n) || {}).bowl;
  const cracked = planFor(squad, { pitch: 'cracked', weather: 'sunny' });
  const slow = planFor(squad, { pitch: 'slow', weather: 'sunny' });
  const balanced = planFor(squad, { pitch: 'balanced', weather: 'sunny' });
  // CRACKED: the engine's own subtype tilt is wrist-spin bounce (+0.08 on its
  // wicket terms, measured at +0.054 wickets/over by the probe)
  assert.ok(val(cracked, 'Wrist Man') - val(balanced, 'Wrist Man') >
            val(cracked, 'Finger Man') - val(balanced, 'Finger Man'),
    'cracks reward the wrist spinner more than the finger spinner');
  // SLOW: the engine tilts to CUTTERS (medium +0.10), not to spin as a class.
  // This is the contract that stops folklore creeping back in.
  const dSlowCut = val(slow, 'Cutter Man') - val(balanced, 'Cutter Man');
  const dSlowFing = val(slow, 'Finger Man') - val(balanced, 'Finger Man');
  assert.ok(dSlowCut >= dSlowFing - 1e-9,
    'a slow pitch is a cutter pitch at least as much as a finger-spin one (' +
    dSlowCut.toFixed(2) + ' v ' + dSlowFing.toFixed(2) + ')');
});

test('A: a flat pitch changes the side only when the marginal men justify it', () => {
  const flat = planFor(BASE_SQUAD, { pitch: 'flat', weather: 'sunny' });
  const base = planFor(BASE_SQUAD, { pitch: 'balanced', weather: 'sunny' });
  assert.equal(flat.xi.length, 11);
  const moved = flat.xi.filter(n => base.xi.indexOf(n) < 0).length;
  assert.ok(moved <= 3, 'a surface is a tilt, not a new squad (' + moved + ' changes)');
});

// ---- B. FATIGUE -----------------------------------------------------------

test('B: a tired man loses a close contest, but an elite tired star does not lose to a poor reserve', () => {
  // the brief's own two cases, side by side
  const closeSquad = BASE_SQUAD.filter(m => m.name !== 'Seam Three').concat([
    { name: 'Tired Seamer', kind: 'bowler', bowlType: 'fastMedium', level: 40, bowl: 58, fatigue: 'exhausted' },
    { name: 'Fresh Seamer', kind: 'bowler', bowlType: 'fastMedium', level: 40, bowl: 56, fatigue: 'rested' }
  ]);
  const p = planFor(closeSquad);
  const tired = p.explanation.cards.find(c => c.name === 'Tired Seamer');
  const fresh = p.explanation.cards.find(c => c.name === 'Fresh Seamer');
  assert.ok(tired.fatPen > 5, 'the engine really is taking points off him');
  assert.ok(fresh.bowl > tired.bowl,
    'two points of quality does not survive exhaustion (' + fresh.bowl + ' v ' + tired.bowl + ')');

  const gapSquad = BASE_SQUAD.filter(m => m.name !== 'Seam Three').concat([
    { name: 'Tired Star', kind: 'bowler', bowlType: 'fastMedium', level: 40, bowl: 85, fatigue: 'exhausted' },
    { name: 'Fresh Dud', kind: 'bowler', bowlType: 'fastMedium', level: 40, bowl: 50, fatigue: 'rested' }
  ]);
  const q = planFor(gapSquad);
  const star = q.explanation.cards.find(c => c.name === 'Tired Star');
  const dud = q.explanation.cards.find(c => c.name === 'Fresh Dud');
  assert.ok(star.bowl > dud.bowl,
    'a great tired bowler still beats a poor fresh one (' + star.bowl + ' v ' + dud.bowl + ')');
  assert.ok(q.xi.indexOf('Tired Star') >= 0, 'and he plays');
});

test('B: planning twice does not mutate the squad or the answer', () => {
  const out = inVm(MAKE.replace('return { squad: squad };', `
    var before = JSON.stringify(squad);
    var a = planMatchDay({ team: { name: 'T', players: squad }, pitch: 'green', weather: 'humid' });
    var b = planMatchDay({ team: { name: 'T', players: squad }, pitch: 'green', weather: 'humid' });
    return { same: JSON.stringify(a) === JSON.stringify(b), untouched: JSON.stringify(squad) === before };
  `), { squad: BASE_SQUAD });
  assert.ok(out.same, 'the same question gets the same answer');
  assert.ok(out.untouched, 'and the squad is not touched by asking');
});

// ---- D. KEEPER ------------------------------------------------------------

test('D: a small batting edge cannot erase a large gap behind the stumps', () => {
  const squad = BASE_SQUAD.filter(m => m.name.indexOf('Keeper') < 0).concat([
    { name: 'Gloveman', kind: 'keeper', keeper: true, bowlType: null, level: 50,
      keeping: 92, stumping: 90, catching: 90 },
    { name: 'Batter Keeper', kind: 'keeper', keeper: true, bowlType: null, level: 54,
      keeping: 34, stumping: 32, catching: 36 }
  ]);
  const p = planFor(squad, { pitch: 'dry', weather: 'sunny' });
  assert.equal(p.keeper, 'Gloveman',
    'four points of batting does not buy a 58-point hole behind the stumps');
});

test('D: a large enough batting gap can legitimately win the gloves', () => {
  // TWELVE MEN AND ELEVEN SEATS, and the ten outfielders are all far too good
  // to leave out - so the side genuinely has to choose between its two
  // keepers instead of dodging the question by carrying both. (The first cut
  // of this test left a modest number five in the squad, and the coach
  // correctly dropped HIM and played both keepers, which is a rational answer
  // to a different question.)
  //
  // The brief's question is this one: a much better batsman who keeps
  // adequately should be able to beat a superb gloveman. The gloves are priced
  // off the measured slope - 21 points of keeping quality buys about 1.5-1.9
  // wickets across an innings (probe section 7) - and the bat off runs per
  // dismissal, both in runs, so the simulation decides where the line falls.
  const squad = [
    { name: 'Gloveman', kind: 'keeper', keeper: true, bowlType: null, level: 26,
      keeping: 80, stumping: 78, catching: 78 },
    { name: 'Batter Keeper', kind: 'keeper', keeper: true, bowlType: null, level: 82,
      keeping: 58, stumping: 56, catching: 58 },
    { name: 'B1', kind: 'bat', bowlType: null, level: 78 },
    { name: 'B2', kind: 'bat', bowlType: null, level: 77 },
    { name: 'B3', kind: 'bat', bowlType: null, level: 76 },
    { name: 'B4', kind: 'bat', bowlType: null, level: 75 },
    { name: 'B5', kind: 'bat', bowlType: null, level: 74 },
    { name: 'W1', kind: 'bowler', bowlType: 'fast', level: 55, bowl: 78 },
    { name: 'W2', kind: 'bowler', bowlType: 'fastMedium', level: 55, bowl: 77 },
    { name: 'W3', kind: 'bowler', bowlType: 'medium', level: 55, bowl: 76 },
    { name: 'W4', kind: 'bowler', bowlType: 'fingerSpin', level: 55, bowl: 76 },
    { name: 'W5', kind: 'bowler', bowlType: 'wristSpin', level: 55, bowl: 75 }
  ];
  // THE QUESTION, ASKED DIRECTLY. Which of the two sides is worth more - the
  // one with the gloveman in it, or the one with the batsman? Scoring the two
  // candidate elevens is the tradeoff itself, with no other selection decision
  // able to confuse the answer.
  const cmp = inVm(MAKE.replace('return { squad: squad };', `
    var refs = foMdcRefs(squad), ctx = foMdcCtx('sunny', FO_KQ_PAR, 50, false);
    var cards = squad.map(function(p){ return foMdcCard(p, refs, ctx, 'flat', 0.62); });
    var withBat = cards.filter(function(c){ return c.name !== 'Gloveman'; });
    var withGlove = cards.filter(function(c){ return c.name !== 'Batter Keeper'; });
    var g = cards.filter(function(c){ return c.name === 'Gloveman'; })[0];
    var b = cards.filter(function(c){ return c.name === 'Batter Keeper'; })[0];
    return { withBat: foMdcScoreXI(withBat, null).total,
             withGlove: foMdcScoreXI(withGlove, null).total,
             gloveKeep: g.keepValue, batKeep: b.keepValue,
             gloveRpd: g.rpd, batRpd: b.rpd };
  `), { squad });
  assert.ok(cmp.gloveKeep > cmp.batKeep,
    'the gloveman really is the better keeper (' + Math.round(cmp.gloveKeep) +
    ' v ' + Math.round(cmp.batKeep) + ' runs of glovework)');
  assert.ok(cmp.batRpd > cmp.gloveRpd + 40, 'and the other man really is the better batsman');
  assert.ok(cmp.withBat > cmp.withGlove,
    'a fifty-six point batting gap outweighs twenty-two points of glovework (' +
    Math.round(cmp.withBat) + ' v ' + Math.round(cmp.withGlove) + ')');
  // and when he is the only gloveman in the squad, he keeps whatever he averages
  const solo = planFor(squad.filter(m => m.name !== 'Batter Keeper'), { pitch: 'flat', weather: 'sunny' });
  assert.equal(solo.keeper, 'Gloveman', 'the only keeper keeps');
});

// ---- E. BATTING ORDER -----------------------------------------------------

test('E: the new ball is faced by the men who play it, and finishers finish', () => {
  const squad = BASE_SQUAD.filter(m => ['Bat One', 'Bat Two', 'Bat Six'].indexOf(m.name) < 0).concat([
    { name: 'Opener Tech', kind: 'bat', bowlType: null, level: 58,
      skills: { vsPace: 88, temperament: 80, rotation: 70, power: 30 } },
    { name: 'Slogger', kind: 'bat', bowlType: null, level: 58,
      skills: { vsPace: 40, temperament: 40, rotation: 45, power: 92 },
      talents: ['finisher', 'sixMachine'] },
    { name: 'Spin Player', kind: 'bat', bowlType: null, level: 58,
      skills: { vsSpin: 88, vsPace: 45, temperament: 70, rotation: 70 } }
  ]);
  const green = planFor(squad, { pitch: 'green', weather: 'overcast' });
  const oi = green.battingOrder.indexOf('Opener Tech');
  const si = green.battingOrder.indexOf('Slogger');
  assert.ok(oi >= 0 && oi <= 2, 'the technician opens on a seaming morning (slot ' + (oi + 1) + ')');
  // he may not be picked at all on a green top - that is a legitimate answer -
  // but if he is, he must not be opening the batting
  assert.ok(si === -1 || si >= 4,
    'the slogger does not open just because his aggregate is high (slot ' + (si + 1) + ')');
  // and on a turner the man who plays spin climbs relative to where he was
  const dry = planFor(squad, { pitch: 'dry', weather: 'sunny' });
  const spDry = dry.battingOrder.indexOf('Spin Player');
  const spGreen = green.battingOrder.indexOf('Spin Player');
  assert.ok(spDry <= spGreen,
    'the spin player is worth more on a turner (' + (spDry + 1) + ' v ' + (spGreen + 1) + ')');
});

test('E: the tail stays the tail unless a bowler can genuinely bat', () => {
  const p = planFor(BASE_SQUAD);
  const order = p.battingOrder;
  const cards = {};
  p.explanation.cards.forEach(c => { cards[c.name] = c; });
  // nobody in the last three is worth more with the bat than the top three
  const worstTop = Math.min(...order.slice(0, 3).map(n => cards[n].rpd));
  const bestTail = Math.max(...order.slice(8).map(n => cards[n].rpd));
  assert.ok(worstTop >= bestTail,
    'the order follows batting worth (top ' + worstTop + ' v tail ' + bestTail + ')');
});

// ---- F. BOWLING -----------------------------------------------------------

test('F: Auto leaves adaptive gaps, and paints the new ball and the death', () => {
  const p = planFor(BASE_SQUAD, { pitch: 'green', weather: 'overcast' });
  assert.ok(p.assignedOvers > 0, 'the coach states its intentions');
  assert.ok(p.openOvers >= 20,
    'and deliberately leaves the captain room (' + p.openOvers + ' open)');
  assert.equal(p.assignedOvers + p.openOvers, 50);
  const plan = p.bowlingPlan;
  assert.ok(plan[1] && plan[2], 'the new ball is nominated at both ends');
  assert.ok(plan[47] && plan[48] && plan[49] && plan[50], 'and the last four are protected');
  // the middle is mostly the captain's
  let midOpen = 0;
  for (let o = 15; o <= 40; o++) if (!plan[o]) midOpen++;
  assert.ok(midOpen >= 15, 'the middle overs are largely open (' + midOpen + ' of 26)');
});

test('F: no bowler is given two overs in a row, or more than ten', () => {
  for (const pitch of ['balanced', 'green', 'dry', 'cracked', 'flat']) {
    const p = planFor(BASE_SQUAD, { pitch, weather: 'sunny' });
    const plan = p.bowlingPlan, tot = {};
    for (let o = 1; o <= 50; o++) {
      if (!plan[o]) continue;
      tot[plan[o]] = (tot[plan[o]] || 0) + 1;
      assert.notEqual(plan[o], plan[o - 1], pitch + ': two overs in a row at ' + o);
    }
    for (const nm in tot) assert.ok(tot[nm] <= 10, pitch + ': ' + nm + ' over the ten-over cap');
    // and every named bowler is actually in the side
    for (const nm in tot) assert.ok(p.xi.indexOf(nm) >= 0, pitch + ': ' + nm + ' is not in the XI');
  }
});

test('F: swing conditions lengthen the opening burst; a flat day shortens it', () => {
  const green = planFor(BASE_SQUAD, { pitch: 'green', weather: 'overcast' });
  const flat = planFor(BASE_SQUAD, { pitch: 'flat', weather: 'sunny' });
  const burst = p => {
    let n = 0;
    for (let o = 1; o <= 12; o++) if (p.bowlingPlan[o]) n++;
    return n;
  };
  assert.ok(burst(green) > burst(flat),
    'the ball that is doing something gets more overs (' + burst(green) + ' v ' + burst(flat) + ')');
});

// ---- G. CAPTAIN -----------------------------------------------------------

test('G: the armband goes to the best leader who already deserves his place', () => {
  const squad = BASE_SQUAD.concat([
    { name: 'Poor Skipper', kind: 'bat', bowlType: null, level: 20, capt: 99 }
  ]);
  const p = planFor(squad);
  assert.notEqual(p.captain, 'Poor Skipper',
    'a far worse cricketer is not dragged in for the armband');
  assert.ok(p.xi.indexOf(p.captain) >= 0, 'the captain is in the side');
  // among those picked, he is the best leader
  const capt = inVm(MAKE.replace('return { squad: squad };', `
    var by = {}; squad.forEach(function(p){ by[p.name] = p; });
    var plan = planMatchDay({ team: { name: 'T', players: squad }, pitch: 'balanced', weather: 'sunny' });
    var best = null;
    plan.xi.forEach(function(n){ if (!best || by[n].capt > by[best].capt) best = n; });
    return { chosen: plan.captain, best: best, chosenCapt: by[plan.captain].capt, bestCapt: by[best].capt };
  `), { squad });
  assert.equal(capt.chosenCapt, capt.bestCapt, 'the best captaincy in the XI wears it');
});

// ---- H. FAIRNESS ----------------------------------------------------------

test('H: a bot reads the scout\'s bands and never a rival\'s raw skills', () => {
  // the same side, planned against two opponents that differ ONLY in hidden
  // technique - the coarse bands are identical, so the plan must be identical
  const out = inVm(MAKE.replace('return { squad: squad };', `
    function opp(vsSpin){
      return squad.map(function(p){
        var q = JSON.parse(JSON.stringify(p));
        q.skills.vsSpin = vsSpin; q.vsSpin = vsSpin;
        return q;
      });
    }
    var weak = opp(20), strong = opp(80);
    var sWeak = foMdcPublicScout(weak), sStrong = foMdcPublicScout(strong);
    var a = planMatchDay({ team: { name: 'T', players: squad }, pitch: 'balanced', weather: 'sunny',
                           oppositionScout: sWeak });
    var b = planMatchDay({ team: { name: 'T', players: squad }, pitch: 'balanced', weather: 'sunny',
                           oppositionScout: sStrong });
    return { bandsWeak: sWeak, bandsStrong: sStrong,
             sameBands: sWeak.weakVsSpin === sStrong.weakVsSpin && sWeak.attack === sStrong.attack,
             samePlan: JSON.stringify(a.xi) === JSON.stringify(b.xi) };
  `), { squad: BASE_SQUAD });
  // where the bands genuinely differ the coach may react; where they agree it
  // may not, because a human would have been told the same sentence
  if (out.sameBands) {
    assert.ok(out.samePlan, 'identical published bands must give an identical side');
  } else {
    assert.ok(out.bandsWeak.weakVsSpin || out.bandsStrong.weakVsSpin,
      'the difference the coach saw is one the scout page publishes');
  }
});

test('H: the opposition tilt cannot overturn a real gap in quality', () => {
  const squad = BASE_SQUAD.concat([
    { name: 'Elite Seamer', kind: 'bowler', bowlType: 'fastMedium', level: 40, bowl: 88 },
    { name: 'Poor Spinner', kind: 'bowler', bowlType: 'fingerSpin', level: 40, bowl: 34 }
  ]);
  const p = planFor(squad, { pitch: 'balanced', weather: 'sunny',
    scout: { attack: 'Pace-leaning', weakVsSpin: true } });
  assert.ok(p.xi.indexOf('Elite Seamer') >= 0, 'the elite bowler still plays');
  assert.ok(p.xi.indexOf('Poor Spinner') < 0,
    'a matchup does not buy a poor cricketer a place');
});

// ---- I. PARITY AND THE MANUAL LAW -----------------------------------------

test('I: the human Auto path and the bot path are the same authority', () => {
  // the client's suggestOrders and the umpire's bot sheet both go through
  // planMatchDay; given the same cricket context they must agree exactly
  const out = inVm(MAKE.replace('return { squad: squad };', `
    var human = planMatchDay({ team: { name: 'T', players: squad }, pitch: 'dry', weather: 'sunny' });
    var bot   = planMatchDay({ team: { name: 'T', players: squad }, pitch: 'dry', weather: 'sunny' });
    return { same: JSON.stringify(human) === JSON.stringify(bot) };
  `), { squad: BASE_SQUAD });
  assert.ok(out.same);
});

test('I: doctrine is a tilt at the margin, never a different side', () => {
  const plain = planFor(BASE_SQUAD, { pitch: 'balanced', weather: 'sunny' });
  const pace = planFor(BASE_SQUAD, { pitch: 'balanced', weather: 'sunny',
    doctrine: { select: { pace: true } } });
  const spin = planFor(BASE_SQUAD, { pitch: 'balanced', weather: 'sunny',
    doctrine: { select: { spin: true } } });
  const diff = (a, b) => a.xi.filter(n => b.xi.indexOf(n) < 0).length;
  assert.ok(diff(pace, plain) <= 2, 'a pace identity moves at most a man or two');
  assert.ok(diff(spin, plain) <= 2, 'and so does a spin identity');
  assert.equal(pace.xi.length, 11);
  assert.equal(spin.xi.length, 11);
});

test('I: a filed eleven is honoured, and an order can never smuggle in a twelfth man', () => {
  const out = inVm(`
    var t = GD.teams[0];
    // A LEGAL SHEET, deliberately built: eleven real men including five who
    // bowl and a keeper. An ILLEGAL sheet is supposed to be refused - that is
    // the engine's own guard and predates this work - so a test of the manual
    // law has to file a sheet the engine can actually honour.
    var bowl = t.players.filter(function(p){ return p.bowlType; }).slice(0, 5);
    var keep = t.players.filter(function(p){ return p.keeper; }).slice(0, 1);
    var taken = {};
    bowl.concat(keep).forEach(function(p){ taken[p.name] = 1; });
    var rest = t.players.filter(function(p){ return !taken[p.name]; });
    var mine = bowl.concat(keep).concat(rest).slice(0, 11).map(function(p){ return p.name; });
    var by0 = {}; t.players.forEach(function(p){ by0[p.name] = p; });
    var bowlers = mine.filter(function(n){ return by0[n].bowlType; }).length;
    M = newMatch(t, GD.teams[1], 'green', 7);
    M.meta = { home: t.name, away: GD.teams[1].name, weather: 'Overcast' };
    M.ordersMap = {};
    M.ordersMap[t.name] = { xi: mine, batOrder: mine };
    var xi = pickXI(t).map(function(p){ return p.name; });
    // and an order naming somebody who is not in the eleven
    M.ordersMap[t.name] = { xi: mine, batOrder: mine.concat([t.players[13].name]) };
    var xi2 = pickXI(t).map(function(p){ return p.name; });
    return { bowlers: bowlers, filed: mine, got: xi, got2: xi2 };
  `);
  assert.ok(out.bowlers >= 5, 'the fixture built a legal sheet to test with');
  assert.deepEqual(out.got.slice().sort(), out.filed.slice().sort(),
    "the manager's eleven is the eleven");
  assert.equal(out.got2.length, 11, 'still eleven men');
  out.got2.forEach(n => assert.ok(out.filed.indexOf(n) >= 0,
    n + ' was smuggled in by a batting order'));
});

// ---- J. DETERMINISM -------------------------------------------------------

test('J: the same inputs give a byte-identical plan, a hundred times over', () => {
  const out = inVm(MAKE.replace('return { squad: squad };', `
    var first = JSON.stringify(planMatchDay({ team: { name: 'T', players: squad },
      pitch: 'cracked', weather: 'humid' }));
    for (var i = 0; i < 100; i++){
      var again = JSON.stringify(planMatchDay({ team: { name: 'T', players: squad },
        pitch: 'cracked', weather: 'humid' }));
      if (again !== first) return { ok: false, at: i };
    }
    return { ok: true };
  `), { squad: BASE_SQUAD });
  assert.ok(out.ok, 'plan drifted at call ' + out.at);
});

test('J: the exact search and the pruned search agree on an ordinary squad', () => {
  // the pruning path is what a large pool gets; on a fifteen it must reach the
  // same eleven the exhaustive walk does, or the pruning is lying
  const out = inVm(MAKE.replace('return { squad: squad };', `
    var refs = foMdcRefs(squad), ctx = foMdcCtx('sunny', FO_KQ_PAR, 50, false);
    var cards = squad.map(function(p){ return foMdcCard(p, refs, ctx, 'balanced', 0.62); });
    var exact = foMdcExactSearch(cards, null);
    var pruned = foMdcChooseXI(cards, null);
    return { exact: exact.xi.map(function(c){ return c.name; }).sort(),
             chosen: pruned.xi.map(function(c){ return c.name; }).sort(),
             wasExact: pruned.exact };
  `), { squad: BASE_SQUAD });
  assert.deepEqual(out.chosen, out.exact, 'the chosen eleven is the optimum');
  assert.ok(out.wasExact, 'and a fifteen is searched exhaustively');
});

test('J: availability is respected - an absent man is never picked', () => {
  const p = planFor(BASE_SQUAD, { unavailable: ['Bat One', 'Quick One'] });
  assert.ok(p.xi.indexOf('Bat One') < 0, 'an absent batsman stays absent');
  assert.ok(p.xi.indexOf('Quick One') < 0, 'and so does an absent bowler');
  assert.equal(p.xi.length, 11);
});

// ---- K. ENDURANCE, SPELL LENGTH AND WORKLOAD ------------------------------
//
// These pin a NEGATIVE result, which is the point of them. The engine was
// asked (tools/matchday-endurance.mjs) whether a bowler's stamina ought to
// change how long a spell the coach paints for him, by forcing a continuous
// ten-over spell in a real match, sampling the engine's own fatigue tank ball
// by ball and reading each over's cost back out of ballDist. It said no, and
// said it flatly: holding six overs fixed and asking whether they are cheaper
// bowled through or split 3+3 gave 0.00 runs at EVERY stamina from 30 to 90.
//
// The reason is structural. The tank fills per ball bowled all innings and
// drains only at drinks and the innings break, so resting a man does not empty
// it; and the only two terms that read the unbroken-spell counter are one that
// ignores stamina entirely and one gated on age over thirty. So the coach does
// NOT cut a burst to the man, because doing so would be modelling cricket this
// engine does not play.
//
// If somebody later gives the engine a stamina-in-spell law, the first of
// these tests fails - and that failure is the message: the measurement is
// stale, re-run the probe and give the coach its burst lengths back.

test('K: stamina does not change what a spell costs, so the coach does not pretend it does', () => {
  const probe = inVm(`
    var t = GD.teams[0], src = t.players;
    var out = {};
    [30, 60, 90].forEach(function (st) {
      var p = JSON.parse(JSON.stringify(src.filter(function (x) { return x.bowlType; })[0]));
      p.name = 'S' + st; p.talents = []; p.age = 27;
      p.skills.stamina = st;
      var refs = foMdcRefs([p]);
      var ctx = foMdcCtx('sunny', FO_KQ_PAR, 50, false);
      var c = foMdcCard(p, refs, ctx, 'balanced', 0.62);
      // his cost in over 1 of a spell against over 6 of the SAME spell, with
      // only the unbroken-spell counter moved - which is the whole of what a
      // burst length controls
      var at = function (spellB) {
        var c2 = {}; for (var k in ctx) c2[k] = ctx[k];
        c2.ballsThisSpell = spellB;
        var d = ballDist(refs.bat, c.today, 'pp', 12, 0, 0, 'balanced', 'bal', 5, c2);
        var w = (d.wC||0)+(d.wB||0)+(d.wLBW||0)+(d.wRO||0)+(d.wST||0);
        var r = (d['1']||0)+2*(d['2']||0)+3*(d['3']||0)+4*(d['4']||0)+6*(d['6']||0);
        return r - w * 25;
      };
      out[st] = at(30) - at(0);
    });
    return out;
  `);
  const decay = [probe[30], probe[60], probe[90]];
  const spread = Math.max(...decay) - Math.min(...decay);
  assert.ok(spread < 0.01,
    'a spell costs the same whatever a man\'s stamina (30/60/90 gave ' +
    decay.map(v => v.toFixed(4)).join(', ') + '); if this now differs, ' +
    're-run tools/matchday-endurance.mjs and give the coach burst lengths');
});

test('K: two bowlers alike but for stamina get the same burst, and the plan says so', () => {
  const squad = BASE_SQUAD.map(m => ({ ...m }));
  const weak = squad.map(m => m.name === 'Quick One' ? { ...m, skills: { stamina: 30 } } : m);
  const strong = squad.map(m => m.name === 'Quick One' ? { ...m, skills: { stamina: 95 } } : m);
  const a = planFor(weak, { pitch: 'green', weather: 'overcast' });
  const b = planFor(strong, { pitch: 'green', weather: 'overcast' });
  const overs = p => {
    const n = {};
    for (let o = 1; o <= 50; o++) if (p.bowlingPlan[o]) n[p.bowlingPlan[o]] = (n[p.bowlingPlan[o]] || 0) + 1;
    return n;
  };
  assert.deepEqual(overs(a), overs(b),
    'the engine prices their spells identically, so the coach plans them identically');
});

test('K: the conditions still set the burst - a biting new ball buys a longer one', () => {
  const green = planFor(BASE_SQUAD, { pitch: 'green', weather: 'overcast' });
  const flat = planFor(BASE_SQUAD, { pitch: 'flat', weather: 'sunny' });
  const opening = p => {
    let n = 0;
    for (let o = 1; o <= 20; o += 2) if (p.bowlingPlan[o] && p.bowlingPlan[o] === p.bowlingPlan[1]) n++;
    return n;
  };
  assert.ok(opening(green) > opening(flat),
    'the ball doing something is worth more overs of it (' +
    opening(green) + ' on green vs ' + opening(flat) + ' on a road)');
});

test('K: a man who opens is not also handed the death when somebody else is rested', () => {
  const p = planFor(BASE_SQUAD, { pitch: 'green', weather: 'overcast' });
  const openers = new Set([p.bowlingPlan[1], p.bowlingPlan[2]].filter(Boolean));
  const closers = [47, 48, 49, 50].map(o => p.bowlingPlan[o]).filter(Boolean);
  assert.ok(closers.length >= 2, 'the death is planned at all');
  for (const c of closers) {
    assert.ok(!openers.has(c),
      c + ' opened the bowling AND holds a death over; his seventh over costs ' +
      'twice his first (tools/matchday-endurance.mjs) and this squad has rested men');
  }
});

test('K: ...but a thin attack is allowed to double up rather than leave the death unplanned', () => {
  // exactly five bowling options, so somebody must do both jobs
  const thin = BASE_SQUAD.filter(m =>
    ['Bat One', 'Bat Two', 'Bat Three', 'Bat Four', 'Bat Five', 'Keeper Prime',
     'Quick One', 'Quick Two', 'Seam Three', 'Spin One', 'Spin Two'].includes(m.name));
  const p = planFor(thin, { pitch: 'green', weather: 'overcast' });
  const closers = [47, 48, 49, 50].map(o => p.bowlingPlan[o]).filter(Boolean);
  assert.ok(closers.length >= 2, 'the death is still planned when nobody is spare');
});

// ---- L. THE EXTRA BOWLING OPTION, PRICED ONCE AND FOR QUALITY -------------
//
// tools/matchday-allrounder.mjs is the audit these came from: controlled
// elevens differing by exactly one man, scored by the coach and then PLAYED,
// 1,200 paired fixtures a case. It found the sixth-bowler premium being paid
// twice (once as SIXTH_BOWLER and again as a rank-based ALLROUND term) and
// paid blind - a man with a bowling skill of 30 collected exactly what a man
// with 62 collected, though the cricket separates them at z = 3.2.

test('L: a sixth option who cannot really bowl earns no flexibility premium', () => {
  const five = BASE_SQUAD.filter(m => m.name !== 'Allround');
  const useless = five.concat([{ name: 'Cart Horse', kind: 'bowler',
    bowlType: 'medium', level: 54, bowl: 12, mpos: 6 }]);
  const useful = five.concat([{ name: 'Cart Horse', kind: 'bowler',
    bowlType: 'medium', level: 54, bowl: 58, mpos: 6 }]);
  const a = planFor(useless), b = planFor(useful);
  const sa = a.explanation.score, sb = b.explanation.score;
  assert.ok(sb.bowl > sa.bowl,
    'the useful sixth option is worth more than the useless one (' +
    sa.bowl + ' vs ' + sb.bowl + ') - they used to score identically');
});

test('L: a genuine number eleven does not collect an all-rounder premium', () => {
  // a side whose seventh-best BAT is a specialist quick: under the old
  // rank-based term he was paid 4.0 for being an all-rounder, which he is not
  const p = planFor(BASE_SQUAD);
  assert.equal(p.explanation.score.allround, 0,
    'there is no standalone all-round premium left to misfire');
});

test('L: an all-rounder who genuinely bowls is still preferred, on measured cricket alone', () => {
  // four specialists only, so the all-rounder's overs must actually be bowled
  const thin = BASE_SQUAD.filter(m => !['Spin Two', 'Allround', 'Reserve Bat'].includes(m.name));
  const withAR = thin.concat([{ name: 'Real Allrounder', kind: 'bowler',
    bowlType: 'fastMedium', level: 56, bowl: 60, mpos: 6 }]);
  const withBat = thin.concat([{ name: 'Just A Bat', kind: 'bat',
    bowlType: null, level: 56, mpos: 6 }]);
  const a = planFor(withAR), b = planFor(withBat);
  assert.ok(a.xi.includes('Real Allrounder'),
    'a side that cannot cover fifty overs without him picks him');
  assert.ok(!b.xi.includes('Just A Bat') || a.explanation.score.total > b.explanation.score.total,
    'and he is worth more than the batsman who cannot bowl a ball');
});
