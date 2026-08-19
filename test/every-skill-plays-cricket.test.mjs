// test/every-skill-plays-cricket.test.mjs — NO DEAD DISPLAYED SKILLS.
//
// A card that says "Variation 92" is a promise. Before this the promise was
// empty for three whole attributes: discipline, moveTurn and variation were on
// every bowler in the world and were read by NOTHING - sweeping each from 40 to
// 90 moved the ball distribution by exactly 0.000 on every bucket. Power was
// worse in a subtler way: it was read, but through a softening that had
// saturated by 70, so six-hitting at power 70, 85 and 95 came out 6.38%, 6.41%,
// 6.41% and the top third of the scale was decoration.
//
// These tests hold every match attribute to two things:
//
//   1. IT MOVES THE RIGHT NUMBER IN ITS OWN CONTEXT. Not "it moves something" -
//      the specific outcome bucket that attribute is supposed to own.
//   2. IT IS STILL MOVING AT THE TOP. 85 to 95 must buy something, or the scale
//      has a dead zone in it wherever the world's best players live.
//
// They read ballDist DIRECTLY rather than playing matches. ballDist is a pure
// function of its arguments, so these numbers are exact rather than sampled -
// which is what lets a test assert a monotone sweep at all. A Monte Carlo
// equivalent would need thousands of matches per step and would still be noisy.
import { test } from 'node:test';
import assert from 'node:assert';
import vm from 'node:vm';
import { makeEngine } from './engine-vm.mjs';

const eng = makeEngine();
eng.setTuning(true);

vm.runInContext(`
globalThis.__skMake = function (spec) {
  var p = { name: 'probe', age: 28, hand: 'R', nat: 'XXX',
    role: spec.role || 'middleOrderBat', bowlTypeFull: spec.bowlTypeFull || 'none',
    exp: spec.exp == null ? 55 : spec.exp, formIx: spec.formIx,
    formWord: spec.formWord, fatigue: spec.fatigue || 'rested',
    capt: 50, talents: spec.talents || [],
    skills: { vsPace: 55, vsSpin: 55, power: 55, rotation: 55, temperament: 55,
      wicket: 55, economy: 55, discipline: 55, moveTurn: 55, variation: 55,
      stamina: 55, fielding: 55, catching: 55, keeping: 55, stumping: 55 } };
  for (var k in (spec.skills || {})) p.skills[k] = spec.skills[k];
  jsDerive(p); return p;
};
globalThis.__skDist = function (bat, bowl, o) {
  o = o || {};
  var over = o.over == null ? 25 : o.over;
  var ph = over < 10 ? 'pp' : (over >= 40 ? 'death' : 'mid');
  M = { inns: 0, pitch: o.pitch || 'balanced', rand: function () { return 0.5; } };
  var d = ballDist(bat, bowl, ph, o.faced == null ? 30 : o.faced, o.intent || 0,
    o.rrDef || 0, o.pitch || 'balanced', 'bal', over, {
      weather: o.weather || 'sunny', pship: o.pship || 0, chase: !!o.chase,
      bballs: 12, ballsThisSpell: 0, wkts: o.wkts || 0,
      ballsLeft: o.ballsLeft == null ? 150 : o.ballsLeft, reqRate: o.reqRate || 0,
      fieldAvg: 0, keeperQuality: o.keeperQuality || 0,
      keeperStump: o.keeperStump == null ? null : o.keeperStump,
      keeperCatch: o.keeperCatch == null ? null : o.keeperCatch,
      rocketArms: 0, lightningKeeper: false,
      mixed: false, batFat: o.batFat || 0, bowlFat: o.bowlFat || 0,
      captBowl: o.captBowl == null ? 50 : o.captBowl,
      captBat: o.captBat == null ? 50 : o.captBat, freeHit: false, homeSide: null });
  M = null; return JSON.stringify(d);
};
`, eng.ctx);
const mk = vm.runInContext('__skMake', eng.ctx);
const dist = vm.runInContext('__skDist', eng.ctx);

const WK = ['wC', 'wB', 'wLBW', 'wRO', 'wST'];
function d(batSpec, bowlSpec, opts) {
  const e = JSON.parse(dist(mk(batSpec), mk(bowlSpec), opts));
  const g = k => e[k] || 0;
  return {
    dot: g('dot'), one: g('1'), two: g('2'), four: g('4'), six: g('6'),
    wkt: WK.reduce((a, k) => a + g(k), 0), st: g('wST'), ct: g('wC'), lb: g('legbye'),
    wide: g('wide'), noball: g('noball'), bye: g('bye'),
    extras: g('wide') + g('noball') + g('bye') + g('legbye'),
    rpo: 6 * (g('1') + 2 * g('2') + 3 * g('3') + 4 * g('4') + 6 * g('6') +
      g('wide') + g('noball')) / Math.max(1e-9, 1 - g('wide') - g('noball'))
  };
}

const STEPS = [30, 50, 70, 85, 95];
// A SWEEP IS MONOTONE OR IT IS A BUG. `dir` is +1 if more of the skill should
// raise the metric and -1 if it should lower it. The last step - 85 to 95 - is
// asserted SEPARATELY and with a real margin, because that is exactly where
// every previous version of this engine went quiet.
function sweep(label, metric, dir, make, opts, topFloor) {
  const vals = STEPS.map(v => metric(d(make(v).bat, make(v).bowl, opts)));
  for (let i = 1; i < vals.length; i++)
    assert.ok(dir * (vals[i] - vals[i - 1]) > 0,
      label + ': ' + STEPS[i - 1] + '->' + STEPS[i] + ' moved the wrong way or not at all (' +
      vals.map(x => x.toFixed(4)).join(', ') + ')');
  const top = Math.abs(vals[4] - vals[3]) / Math.max(1e-9, Math.abs(vals[3]));
  assert.ok(top > (topFloor == null ? 0.01 : topFloor),
    label + ': 85 to 95 bought only ' + (top * 100).toFixed(2) + '% - the top of the scale is dead (' +
    vals.map(x => x.toFixed(4)).join(', ') + ')');
  return vals;
}

// AND THE SAME QUESTION ASKED FAIRLY. A sweep against a FIXED opponent answers
// "what does this skill do", but its top step answers something else: at 95
// against a fixed 55 the contest is forty points wide and the bounded response
// has already spent 95% of itself, so the marginal return is small BY DESIGN -
// that bound is the thing that stopped a level-25 side being bowled out for 65
// every match. Reading it as saturation would be reading the low-end fix as a
// high-end defect.
//
// The question that actually matters is whether a 95 plays different cricket
// from an 85 AGAINST HIS OWN STANDARD, which is where the world's best players
// meet each other. That is what this asks.
function matched(label, metric, mk2, opts) {
  const a = metric(d(mk2(85).bat, mk2(85).bowl, opts));
  const b = metric(d(mk2(95).bat, mk2(95).bowl, opts));
  const rel = Math.abs(b - a) / Math.max(1e-9, Math.abs(a));
  assert.ok(rel > 0.04, label + ': at a matched standard 85 and 95 play the same cricket (' +
    a.toFixed(4) + ' v ' + b.toFixed(4) + ') - the high end is dead');
}

const bat = sk => ({ bat: { skills: sk }, bowl: { bowlTypeFull: 'seamFastMedium' } });
const bowl = (sk, ty) => ({ bat: {}, bowl: { bowlTypeFull: ty || 'seamFastMedium', skills: sk } });

// ---- BATTING --------------------------------------------------------------

test('vsPace decides how a man does against pace', () => {
  sweep('vsPace/wicket', m => m.wkt, -1, v => bat({ vsPace: v }));
  sweep('vsPace/rpo', m => m.rpo, +1, v => bat({ vsPace: v }));
});

test('power buys boundaries, and nothing else', () => {
  const opts = { over: 46, intent: 2, faced: 30 };
  sweep('power/six', m => m.six, +1, v => bat({ power: v }), opts);
  sweep('power/four', m => m.four, +1, v => bat({ power: v }), opts);
  // and it must NOT buy survival - a power hitter is not harder to get out
  const lo = d(bat(({ power: 30 })).bat, bat({ power: 30 }).bowl, opts);
  const hi = d(bat(({ power: 95 })).bat, bat({ power: 95 }).bowl, opts);
  assert.ok(hi.wkt <= lo.wkt * 1.02,
    'power made him harder to dismiss: ' + lo.wkt.toFixed(4) + ' -> ' + hi.wkt.toFixed(4));
});

test('rotation beats the dot ball, and does not clear the rope', () => {
  sweep('rotation/dot', m => m.dot, -1, v => bat({ rotation: v }));
  sweep('rotation/ones', m => m.one, +1, v => bat({ rotation: v }));
});

test('temperament matters far more under pressure than in a quiet over', () => {
  const calm = { faced: 30, over: 25 };
  const hard = { faced: 6, over: 43, chase: true, reqRate: 10.5, rrDef: 1.0,
    wkts: 6, ballsLeft: 42 };
  sweep('temperament/wicket in a chase', m => m.wkt, -1, v => bat({ temperament: v }), hard);
  const span = o => {
    const lo = d(bat({ temperament: 30 }).bat, bat({ temperament: 30 }).bowl, o).wkt;
    const hi = d(bat({ temperament: 95 }).bat, bat({ temperament: 95 }).bowl, o).wkt;
    return lo / hi;
  };
  const q = span(calm), h = span(hard);
  assert.ok(h > q * 1.35,
    'nerve is worth ' + h.toFixed(2) + 'x under pressure against ' + q.toFixed(2) +
    'x in a routine over - it is behaving like a flat batting bonus');
  // ...but a poor-tempered man is still a real cricketer in a quiet over
  assert.ok(q < 2.2, 'temperament dominates ordinary cricket: ' + q.toFixed(2) + 'x');
});

// ---- BOWLING --------------------------------------------------------------

test('wicket skill takes wickets, at the top of the scale as well', () => {
  // monotone against an ordinary batsman...
  sweep('wicket', m => m.wkt, +1, v => bowl({ wicket: v }), {}, 0.005);
  // ...and a genuinely different bowler against a batsman of his own standard.
  // NOTE what is held and what moves: the BATSMAN is fixed at 88 and only the
  // bowler climbs. Raising both together is a different question with a
  // different answer - the contest between them does not move at all, by
  // construction, and only the standard of the cricket does. That is the
  // architecture working, not a dead zone, and a test that confused the two
  // would fail forever for the best possible reason.
  matched('wicket v an equal', m => m.wkt, v => ({
    bat: { skills: { vsPace: 88, vsSpin: 88, power: 60, rotation: 60, temperament: 60 } },
    bowl: { bowlTypeFull: 'seamFastMedium', skills: { wicket: v, economy: 55 } }
  }), {});
});

test('economy suppresses runs, and is not a second wicket skill', () => {
  sweep('economy/dot', m => m.dot, +1, v => bowl({ economy: v }));
  sweep('economy/rpo', m => m.rpo, -1, v => bowl({ economy: v }));
  const lo = d(bowl({ economy: 30 }).bat, bowl({ economy: 30 }).bowl, {});
  const hi = d(bowl({ economy: 95 }).bat, bowl({ economy: 95 }).bowl, {});
  assert.ok(hi.wkt < lo.wkt * 1.10,
    'economy is taking wickets like threat: ' + lo.wkt.toFixed(4) + ' -> ' + hi.wkt.toFixed(4));
});

test('discipline decides how often the intended ball arrives', () => {
  sweep('discipline/extras', m => m.extras, -1, v => bowl({ discipline: v }));
  sweep('discipline/wides', m => m.wide, -1, v => bowl({ discipline: v }));
  sweep('discipline/noballs', m => m.noball, -1, v => bowl({ discipline: v }));
  // and a tired bowler's discipline is the first thing to go
  const fresh = d(bowl({ discipline: 55 }).bat, bowl({ discipline: 55 }).bowl, { bowlFat: 0 });
  const spent = d(bowl({ discipline: 55 }).bat, bowl({ discipline: 55 }).bowl, { bowlFat: 0.9 });
  assert.ok(spent.extras > fresh.extras * 1.10,
    'fatigue did not touch his execution: ' + fresh.extras.toFixed(4) + ' -> ' + spent.extras.toFixed(4));
});

test('the no-ball is a fast bowler\'s mistake, not everybody\'s', () => {
  // it used to be IDENTICAL for every bowler alive, so the wild dangerous quick
  // could not exist and neither could the metronomic spinner
  const q = d({}, { bowlTypeFull: 'seamFast', skills: { discipline: 25 } }, {}).noball;
  const s = d({}, { bowlTypeFull: 'fingerSpin', skills: { discipline: 90 } }, {}).noball;
  assert.ok(q > s * 3, 'a wild quick oversteps no more than a disciplined spinner: ' +
    q.toFixed(5) + ' v ' + s.toFixed(5));
});

test('movement is worth what the conditions pay for it', () => {
  const helpful = { over: 4, pitch: 'green', weather: 'overcast', faced: 20 };
  const barren = { over: 25, pitch: 'flat', weather: 'sunny', faced: 20 };
  sweep('moveTurn on a green top', m => m.wkt, +1, v => bowl({ moveTurn: v }), helpful);
  const lo = d({}, { bowlTypeFull: 'seamFastMedium', skills: { moveTurn: 30 } }, barren).wkt;
  const hi = d({}, { bowlTypeFull: 'seamFastMedium', skills: { moveTurn: 95 } }, barren).wkt;
  assert.ok(hi < lo * 1.06,
    'a big mover is cashing in on a flat deck in the sunshine - he is not a specialist, ' +
    'he is just a better bowler: ' + lo.toFixed(4) + ' -> ' + hi.toFixed(4));
  // and turn is the spinner's half of the same idea
  sweep('moveTurn on a worn deck', m => m.wkt, +1,
    v => ({ bat: {}, bowl: { bowlTypeFull: 'fingerSpin', skills: { moveTurn: v } } }),
    { over: 35, pitch: 'dry', faced: 20 });
});

test('deception is worth most against a man who has worked you out', () => {
  const set = { faced: 70, pship: 80, over: 30 };
  sweep('variation against a set batsman', m => m.wkt, +1, v => bowl({ variation: v }), set);
  // the opposite shape to every other term: it does almost nothing to a man who
  // has just walked in, because he has nothing to be deceived out of
  const fresh = { faced: 1, pship: 0, over: 30 };
  const lo = d({}, { bowlTypeFull: 'seamFastMedium', skills: { variation: 30 } }, fresh).wkt;
  const hi = d({}, { bowlTypeFull: 'seamFastMedium', skills: { variation: 95 } }, fresh).wkt;
  assert.ok(Math.abs(hi - lo) < lo * 0.03,
    'variation is beating a brand-new batsman, which is not what deception is');
});

// ---- THE THINGS THAT ARE NOT SKILLS --------------------------------------

test('form reaches the ball model off the WORD, not only off the index', () => {
  // THE BUG THIS EXISTS FOR: withForm() read `p.formIx ?? 3`, and every squad
  // that arrives from the world service - and every squad baked into this build
  // - carries formWord and no formIx at all. So a card could say a man was in
  // EXCELLENT form while the engine bowled at him as though he were in none.
  const sh = vm.runInContext('foFormShift', eng.ctx);
  const ix = vm.runInContext('foFormIx', eng.ctx);
  assert.strictEqual(ix({ formWord: 'excellent' }), 6, 'the word did not translate');
  assert.strictEqual(ix({ formWord: 'abysmal' }), 0, 'the word did not translate');
  assert.strictEqual(ix({}), 3, 'a man with no form at all is steady');
  assert.strictEqual(ix({ formIx: 5, formWord: 'abysmal' }), 5, 'the index wins when it exists');
  assert.ok(sh({ formWord: 'excellent' }) > 0 && sh({ formWord: 'abysmal' }) < 0,
    'form runs both ways');
  // and it is a RUN, not a rebirth: the whole ladder is worth about ten skill
  // points, so a great player in terrible form is a great player having a bad run
  const span = sh({ formWord: 'excellent' }) - sh({ formWord: 'abysmal' });
  assert.ok(span > 4 && span < 16, 'the form ladder is worth ' + span.toFixed(1) + ' skill points');
});

test('experience is knowledge, temperament is composure - and they are not the same attribute', () => {
  // THIS TEST USED TO ASSERT THE OPPOSITE, and its old title said so:
  // "experience is composure under pressure". Player Realism 2C ended that
  // synonymy - the audit had found experience and temperament reading the
  // SAME pressure ramp (expUse = exp_base + pressureBase against tmpUse =
  // tmp_base + pressureBase), which made experience a quarter-strength
  // temperament to two decimal places: the shipped exp/tmp ratio was 0.27,
  // 0.27, 0.31, 0.21, 0.23, 0.22 across six wildly different game states,
  // and a constant ratio across all states IS one trigger with two
  // coefficients. The old assertion here (h > q * 1.5) was the codification
  // of that bug: it demanded experience be pressure-scaled, which is to say
  // it demanded experience be a temperament.
  //
  // Experience is now KNOWLEDGE - what he knows in a becalmed over, what
  // seeing the bowling adds, what a phase demands, a bowler's craft against
  // a set batter - and none of it reads pressureBase. Temperament keeps the
  // situation to itself. So the guarantee to hold is the SEPARATION, in
  // log-odds. Measured on the frozen constants: experience 0.095 quiet /
  // 0.113 hard (ratio 1.19 - flat, as knowledge should be), temperament
  // 0.103 quiet / 0.838 hard (ratio 8.1 - concentrated, as nerve should be),
  // and the two are COMPARABLE in a calm over at 0.92 against the shipped
  // law's 0.27, where temperament was nearly four times experience in every
  // state alike.
  //
  // An earlier cut of this test asserted experience must strictly BEAT
  // temperament in a dead over. That held at tmpFloor 0.10 and stopped
  // holding at the 0.20 the phase finally froze (chosen because 0.10 moved
  // weak-league cricket the phase was not asked to move - see the FO_ET
  // comment). Strict dominance was never the requirement; being the same
  // order of magnitude in the calm, and wildly different in the storm, is.
  const quiet = { faced: 30, over: 25 };
  const hard = { faced: 6, over: 43, chase: true, reqRate: 10.5, rrDef: 1.0, wkts: 6, ballsLeft: 42 };
  const lgOf = (o, lo, hi) => {
    const a = d(lo, { bowlTypeFull: 'seamFastMedium' }, o).wkt;
    const b = d(hi, { bowlTypeFull: 'seamFastMedium' }, o).wkt;
    return Math.log(a / (1 - a)) - Math.log(b / (1 - b));
  };
  const eq = lgOf(quiet, { exp: 10 }, { exp: 99 });
  const eh = lgOf(hard, { exp: 10 }, { exp: 99 });
  const tq = lgOf(quiet, { skills: { temperament: 10 } }, { skills: { temperament: 99 } });
  const th = lgOf(hard, { skills: { temperament: 10 } }, { skills: { temperament: 99 } });
  assert.ok(eq > 0 && eh > 0 && tq > 0 && th > 0, 'the weaker man is not the one surviving');
  assert.ok(eq > 0.04,
    'experience moves a routine delivery by ' + eq.toFixed(3) + ' logit - knowledge must be worth something when nothing is at stake');
  assert.ok(eq < 0.30,
    'experience moves a routine delivery by ' + eq.toFixed(3) + ' logit - too much for a secondary attribute');
  assert.ok(eh / eq < 2.5,
    'experience is ' + (eh / eq).toFixed(1) + 'x more valuable under pressure - it has become a temperament again');
  assert.ok(th / tq > 5,
    'temperament is only ' + (th / tq).toFixed(1) + 'x more valuable under pressure - nerve must be pressure-specific');
  assert.ok(eq > tq * 0.6,
    'in a dead over knowledge (' + eq.toFixed(3) + ') is dwarfed by nerve (' + tq.toFixed(3) +
    ') - on the shipped law that ratio was 0.27 and experience was a weak temperament');
});

test('SUPERSEDED: experience is composure under pressure, not years-served skill', { skip: 'replaced by the 2C separation test above - see Player Realism Phase 2C' }, () => {
  // MEASURED IN LOG-ODDS, deliberately. A ratio of wicket probabilities is not
  // the effect - it is the effect divided by a base rate that is itself five
  // times higher in a chase, so a term that genuinely doubles under pressure
  // reads as though it shrank. The model is additive in log-odds; that is where
  // the question has an answer.
  const quiet = { faced: 30, over: 25 };
  const hard = { faced: 6, over: 43, chase: true, reqRate: 10.5, rrDef: 1.0, wkts: 6, ballsLeft: 42 };
  const lg = o => {
    const a = d({ exp: 10 }, { bowlTypeFull: 'seamFastMedium' }, o).wkt;
    const b = d({ exp: 99 }, { bowlTypeFull: 'seamFastMedium' }, o).wkt;
    return Math.log(a / (1 - a)) - Math.log(b / (1 - b));
  };
  const q = lg(quiet), h = lg(hard);
  assert.ok(q > 0 && h > 0, 'the inexperienced man is not the one getting out');
  assert.ok(h > q * 1.5,
    'experience is worth ' + h.toFixed(3) + ' of wicket logit under pressure against ' +
    q.toFixed(3) + ' in a dead over - it is a flat skill bonus wearing a hat');
  assert.ok(q < 0.30,
    'experience alone moves a routine delivery by ' + q.toFixed(3) + ' logit - too much for composure');
});

test('captaincy does not make a bowler bowl better', () => {
  // it used to be a flat per-ball bonus to both sides - a captain who improved
  // his bowlers by standing at slip. What a captain actually does is CHOOSE,
  // and that lives in aiPickBowler(), which is tested by the fact that a side
  // under a poor captain uses its attack worse rather than bowls worse.
  //
  // What is left here must be presence, not execution. The whole 1-to-99 span
  // of captaincy has to be worth less than four points of relative skill, or it
  // is a second, secret skill on everybody's card.
  const poor = d({}, { bowlTypeFull: 'seamFastMedium' }, { captBowl: 1, captBat: 1 });
  const great = d({}, { bowlTypeFull: 'seamFastMedium' }, { captBowl: 99, captBat: 99 });
  const dDot = Math.abs(great.dot - poor.dot), dWkt = Math.abs(great.wkt - poor.wkt);
  assert.ok(dDot > 0, 'captaincy does nothing at all on the field');
  const cal = JSON.parse(vm.runInContext('JSON.stringify(GD.cal)', eng.ctx));
  const fourPoints = 4 * cal.rel_wkt;    // four skill points of contest, in logit
  const captLogit = Math.abs(Math.log(great.wkt / (1 - great.wkt)) - Math.log(poor.wkt / (1 - poor.wkt)));
  assert.ok(captLogit < fourPoints,
    'the whole captaincy scale is worth ' + captLogit.toFixed(4) +
    ' of wicket logit, against ' + fourPoints.toFixed(4) + ' for four points of skill');
});

test('no delivery anywhere in the domain produces a number that is not a number', () => {
  for (const v of [1, 25, 50, 75, 99]) {
    for (const w of [1, 25, 50, 75, 99]) {
      for (const o of [{}, { over: 0 }, { over: 49, intent: 2 },
        { chase: true, reqRate: 40, rrDef: 6, wkts: 9, ballsLeft: 1 },
        { pitch: 'dry', weather: 'dew later', faced: 200, bowlFat: 1, batFat: 1 }]) {
        const e = JSON.parse(dist(
          mk({ skills: { vsPace: v, vsSpin: v, power: v, rotation: v, temperament: v } }),
          mk({ bowlTypeFull: 'seamFast', skills: { wicket: w, economy: w, discipline: w, moveTurn: w, variation: w } }), o));
        let tot = 0;
        for (const k in e) {
          assert.ok(Number.isFinite(e[k]), k + ' is not finite at ' + v + '/' + w);
          assert.ok(e[k] >= -1e-12 && e[k] <= 1 + 1e-9, k + ' is not a probability at ' + v + '/' + w + ': ' + e[k]);
          tot += e[k];
        }
        assert.ok(Math.abs(tot - 1) < 1e-9, 'the distribution does not sum to one at ' + v + '/' + w);
      }
    }
  }
});

// ---- THE GLOVES ARE THREE SKILLS, NOT ONE -------------------------------

test('a stumping is decided by stumping, and a keeper catch by catching', () => {
  // THE BUG THIS EXISTS FOR: both adjustments used to be written ABOVE the loop
  // that rebuilds every dismissal bucket from scratch, so they were computed on
  // every delivery in the history of this engine and thrown away on every
  // delivery in the history of this engine. The world's finest gloveman
  // converted exactly as many stumpings as its worst. The talents that sit on
  // the same buckets were written below the loop and did work, which is why the
  // glovework looked alive: the talents spoke and the skills did not.
  const st = v => d({}, { bowlTypeFull: 'fingerSpin' },
    { over: 30, pitch: 'dry', keeperQuality: 74, keeperStump: v, keeperCatch: 74 }).st;
  const ct = v => d({}, { bowlTypeFull: 'seamFastMedium' },
    { over: 30, keeperQuality: 74, keeperStump: 74, keeperCatch: v }).ct;
  let last = -1;
  for (const v of [30, 50, 74, 85, 95]) {
    const x = st(v);
    assert.ok(x > last, 'stumping ' + v + ' converts no better than the man below him');
    last = x;
  }
  assert.ok(st(95) > st(30) * 3, 'the whole stumping scale is worth almost nothing');
  last = -1;
  for (const v of [30, 50, 74, 85, 95]) {
    const x = ct(v);
    assert.ok(x > last, 'keeper catching ' + v + ' holds no more than the man below him');
    last = x;
  }
  assert.ok(ct(95) > ct(30) * 1.4, 'the whole keeper-catching scale is worth almost nothing');
});

test('and byes are the blended glovework, which is a different question', () => {
  const by = v => d({}, { bowlTypeFull: 'seamFastMedium' },
    { over: 30, keeperQuality: v, keeperStump: 74, keeperCatch: 74 });
  let last = 1e9;
  for (const v of [30, 50, 74, 85, 95]) {
    const x = by(v).bye;
    assert.ok(x < last, 'a better keeper at ' + v + ' leaks more byes than a worse one');
    last = x;
  }
  // and a keeper's all-round work is not allowed to be a wicket-taking skill
  assert.ok(Math.abs(by(95).wkt - by(30).wkt) < by(30).wkt * 0.35,
    'the blended keeper number is taking wickets on its own');
});
