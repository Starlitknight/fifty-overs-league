/* tools/matchday-endurance.mjs — HOW LONG SHOULD THIS MAN BOWL? ASK THE ENGINE.
 *
 * The match-day coach paints an opening burst of six overs when the new ball
 * bites and three when it does not, the same length for every bowler alive.
 * Before that is replaced by something endurance-aware, the engine has to be
 * asked whether it HAS an endurance-dependent optimal spell length. Inventing
 * one would be inventing a second cricket engine, which is the one thing the
 * coach is not allowed to do.
 *
 * WHAT THE ENGINE ACTUALLY MODELS (00-core.js, read rather than assumed):
 *
 *   1. A FATIGUE TANK, filled per ball bowled (line 3145):
 *          M.fat[bowler] += ((1.85 - stamina/100) / 74) * ageTire * roleW
 *          roleW = 1.08 fast, 1.04 fastMedium, 1.00 otherwise
 *      emptied only at DRINKS (over 25, x0.62) and the innings break (x0.5).
 *      THE TANK DOES NOT DRAIN BY RESTING. This is the big one, and it is the
 *      only term that reads stamina at all.
 *
 *   2. A FATIGUE PENALTY, read per ball (line 1994):
 *          wFe = max(0, (min(1,bowlFat) - 0.12) / 0.88)
 *          W -= 0.32*wFe   dot -= 0.21*wFe   4 += 0.17*wFe   6 += 0.085*wFe
 *
 *   3. A CONTINUOUS-SPELL penalty on ballsThisSpell (line 2002), which does
 *      NOT read stamina and does not begin until 36 balls - SIX overs:
 *          longSpell = clamp01((ballsThisSpell - 36) / 24)
 *          W -= 0.10*longSpell  dot -= 0.09  4 += 0.075  6 += 0.04
 *
 *   4. An AGE-in-spell penalty (line 2004), gated entirely on age > 30 and
 *      beginning at 18 balls - THREE overs:
 *          ageBowlLate = max(0,(age-30)/8) * clamp01((ballsThisSpell-18)/30)
 *          W -= 0.115*...  dot -= 0.055  1 += 0.020  4 += 0.055  6 += 0.025
 *
 * So the engine has TWO different clocks and they answer different questions.
 * Terms 1-2 are about how many balls a man has bowled ALL INNINGS and are
 * endurance-driven; terms 3-4 are about how many balls he has bowled WITHOUT
 * A BREAK and are driven by age, not endurance. Whether that adds up to an
 * endurance-dependent spell length is exactly what this tool measures.
 *
 * METHOD, AND WHY IT IS NOT A REIMPLEMENTATION
 * --------------------------------------------
 * The fatigue trajectory is taken FROM THE ENGINE, not recomputed here. A real
 * match is stepped ball by ball inside the VM with the bowling side's orders
 * forcing one man to bowl a continuous ten-over spell (overs 1,3,5..19 - one
 * end, which is what a continuous spell IS), and M.fat[him] and his spellB are
 * sampled as the engine sets them. Those sampled states are then fed back into
 * ballDist - a pure function - to read off his exact expected wickets and runs
 * in each over of the spell.
 *
 * That split matters. Sampling the trajectory is deterministic, so it costs one
 * match and carries no sampling error at all; and evaluating ballDist on it is
 * exact rather than estimated, so the curves below are the engine's own
 * arithmetic and not a Monte Carlo of it. Nothing here quotes a coefficient.
 *
 *   node tools/matchday-endurance.mjs
 *   node tools/matchday-endurance.mjs --json
 */
import vm from 'node:vm';
import { makeEngine } from '../test/engine-vm.mjs';

const asJson = process.argv.includes('--json');
const eng = makeEngine();
eng.setTuning(true);

const STAMINA = [30, 45, 60, 75, 90];
const TYPES = ['fast', 'fastMedium', 'medium', 'fingerSpin', 'wristSpin'];
const CONDS = [
  { pitch: 'balanced', weather: 'Sunny' },
  { pitch: 'green', weather: 'Overcast' },
  { pitch: 'dry', weather: 'Sunny' },
  { pitch: 'balanced', weather: 'Scorching' }
];

// ---------------------------------------------------------------------------
// The harness lives inside the VM so that the match it steps is the real one.
// ---------------------------------------------------------------------------
vm.runInContext(`
// A SQUAD CARRYING ONE TEST BOWLER, everything else held. jsDerive is the
// engine's own mapping and it is strict about two things that cost an hour
// here: bowlType is DERIVED from bowlTypeFull through a fixed token table
// (seamFast, seamFastMedium, seamMedium, fingerSpin, wristSpin - writing
// 'fast' into bowlTypeFull silently yields a man who does not bowl at all),
// and keeper is DERIVED from role, so a keeper is un-made by changing his
// role and not by clearing the flag.
var __ENDT = { fast: 'seamFast', fastMedium: 'seamFastMedium', medium: 'seamMedium',
               fingerSpin: 'fingerSpin', wristSpin: 'wristSpin' };
globalThis.__endSquad = function (baseIx, bowlType, stamina, age) {
  var t = JSON.parse(JSON.stringify(GD.teams[baseIx]));
  var x = JSON.parse(JSON.stringify(t.players[0]));
  x.name = 'TESTMAN';
  x.age = age;
  x.role = 'bowler';
  x.bowlTypeFull = __ENDT[bowlType] || bowlType;
  x.talents = [];                       // a talent is a confound, not a control
  // every skill held at the world's middle so the ONLY thing that separates
  // one cell from the next is stamina (and, where swept, age)
  var hold = { wicket: 60, economy: 60, discipline: 60, moveTurn: 60, variation: 60,
               power: 30, rotation: 30, temperament: 40, vsPace: 30, vsSpin: 30,
               catching: 50, fielding: 50, stumping: 10, keeping: 10 };
  for (var k in hold) x.skills[k] = hold[k];
  x.skills.stamina = stamina;
  jsDerive(x);
  t.players.push(x);
  t.name = 'ENDUR' + baseIx;
  return t;
};
// ...and the eleven he plays in, filed as a manager's sheet so that pickXI
// honours it outright and the coach never gets a say. Eleven men, a keeper and
// five bowling options, with TESTMAN first among the bowlers.
globalThis.__endXI = function (t) {
  var picked = ['TESTMAN'], seen = { TESTMAN: 1 };
  var ps = t.players.filter(function (p) { return p.name !== 'TESTMAN'; });
  var kp = ps.filter(function (p) { return p.keeper; })[0];
  if (kp) { picked.push(kp.name); seen[kp.name] = 1; }
  ps.filter(function (p) { return p.bowlType && !seen[p.name]; })
    .sort(function (a, b) { return (b.threat + b.control) - (a.threat + a.control); })
    .slice(0, 4).forEach(function (p) { picked.push(p.name); seen[p.name] = 1; });
  ps.filter(function (p) { return !seen[p.name]; })
    .sort(function (a, b) { return (b.bat || 0) - (a.bat || 0); })
    .forEach(function (p) { if (picked.length < 11) { picked.push(p.name); seen[p.name] = 1; } });
  return JSON.stringify(picked);
};
// THE FATIGUE TRAJECTORY, TAKEN FROM THE ENGINE RATHER THAN RECOMPUTED.
//
// A real match is stepped ball by ball with TESTMAN pushed on through the
// ordersMap channel, and M.fat[him] is sampled against HIS OWN cumulative ball
// count as the engine sets it. Sampling against his balls rather than against
// the over number is what makes this robust: the in-match captain will happily
// give him overs the plan never asked for, and it does not matter in the
// slightest, because what is wanted here is the tank's level at ball N and the
// engine fills the tank per ball bowled however those balls were come by.
//
// Spell POSITION is not sampled and must not be - it is contaminated by the
// captain for exactly the same reason. It is supplied by the caller instead,
// where "a continuous spell" simply means ballsThisSpell = 6 x overs, which is
// what the words mean and not a coefficient anybody has chosen.
globalThis.__endTrace = function (bowlT, batT, pitch, weather, seed, xiJson) {
  onMatchEnd = function () {};
  M = newMatch(bowlT, batT, pitch, (seed >>> 0) || 1);
  M.meta = { home: bowlT.name, away: batT.name, pitch: pitch, weather: weather, comp: 'end', isUser: false };
  M.isUserMatch = false;
  var compiled = new Array(51).fill(null);
  for (var i = 0; i < 25; i++) compiled[i * 2] = 'TESTMAN';   // compiled is 0-indexed
  M.ordersMap = {};
  M.ordersMap[bowlT.name] = { xi: JSON.parse(xiJson), compiled: compiled };
  App.tossState = { stage: 'x' };
  applyToss(false);            // the OTHER side bats first, so TESTMAN bowls innings 1
  var byBall = {}, g = 0;
  while (M && !M.done && g++ < 4000) {
    autoPick(); stepBall();
    var inn = M.innings[0];
    if (!inn) continue;
    var rec = inn.bowlers && inn.bowlers['TESTMAN'];
    if (!rec) continue;
    if (byBall[rec.b] == null) byBall[rec.b] = M.fat['TESTMAN'] || 0;
  }
  return JSON.stringify(byBall);
};
// read a man's expected wickets and runs per over out of ballDist at a GIVEN
// fatigue and spell position. Pure - this is arithmetic, not a simulation.
globalThis.__endEval = function (bowlT, batT, pitch, weather, over, fat, spellB) {
  var bowl = null, i;
  for (i = 0; i < bowlT.players.length; i++) if (bowlT.players[i].name === 'TESTMAN') bowl = bowlT.players[i];
  // a median opposing batsman: the middle man of the batting side by rating
  var bs = batT.players.slice().sort(function (a, b) { return (b.rating || 0) - (a.rating || 0); });
  var bat = bs[Math.floor(bs.length / 2)];
  var ph = over <= 10 ? 'pp' : (over <= 40 ? 'mid' : 'death');
  var ctx = { weather: String(weather).toLowerCase(), bowlFat: fat, batFat: 0,
              ballsThisSpell: spellB, bballs: spellB, pship: 30, wkts: 2, since: 20,
              fieldAvg: 50, keeperQuality: 50, keeperCatch: 50, keeperStump: 50 };
  var w = 0, r = 0;
  for (var b = 0; b < 6; b++) {
    var d = ballDist(bat, bowl, ph, 24, 0, 0, pitch, 'bal', over, ctx);
    w += (d.wC || 0) + (d.wB || 0) + (d.wLBW || 0) + (d.wRO || 0) + (d.wST || 0);
    r += (d['1'] || 0) + 2 * (d['2'] || 0) + 3 * (d['3'] || 0) + 4 * (d['4'] || 0) + 6 * (d['6'] || 0)
       + (d.wide || 0) + (d.noball || 0);
  }
  return JSON.stringify({ w: w, r: r });
};
`, eng.ctx);

const mkSquad = vm.runInContext('__endSquad', eng.ctx);
const mkXI = vm.runInContext('__endXI', eng.ctx);
const trace = vm.runInContext('__endTrace', eng.ctx);
const evalAt = vm.runInContext('__endEval', eng.ctx);

// the batting opposition is held fixed everywhere
const batT = mkSquad(1, 'medium', 60, 27);

function curve(bowlType, stamina, cond, age) {
  const bowlT = mkSquad(0, bowlType, stamina, age == null ? 27 : age);
  const byBall = JSON.parse(trace(bowlT, batT, cond.pitch, cond.weather, 4242, mkXI(bowlT)));
  const rows = [];
  for (let k = 1; k <= 10; k++) {
    const balls = 6 * k;
    // the tank at the end of his kth over. If the sampled match never reached
    // that many balls the cell is simply not reported - an unmeasured number
    // is worse than a missing one.
    const fat = byBall[balls] != null ? byBall[balls] : byBall[String(balls)];
    if (fat == null) break;
    const e = JSON.parse(evalAt(bowlT, batT, cond.pitch, cond.weather, 2 * k - 1, fat, balls));
    rows.push({ over: k, fat: fat, spellB: balls, w: e.w, r: e.r, cost: e.r - e.w * 25 });
  }
  return rows;
}

const out = { staminaSweep: {}, ageSweep: {}, restCheck: null };

if (!asJson) {
  console.log('=== MATCH-DAY ENDURANCE PROBE: the shipped engine, measured ===');
  console.log('one forced continuous 10-over spell; fatigue trajectory sampled FROM the engine,');
  console.log('then ballDist evaluated exactly at each sampled state. cost = runs - 25 x wickets.\n');
}

for (const cond of CONDS) {
  const key = cond.pitch + '/' + cond.weather;
  out.staminaSweep[key] = {};
  if (!asJson) console.log('--- ' + key + ' ---');
  for (const t of TYPES) {
    out.staminaSweep[key][t] = {};
    if (!asJson) {
      console.log('  ' + t);
      console.log('    stamina   ' + Array.from({ length: 10 }, (_, i) => String(i + 1).padStart(7)).join(''));
    }
    for (const st of STAMINA) {
      const rows = curve(t, st, cond);
      out.staminaSweep[key][t][st] = rows;
      if (!asJson) {
        console.log('    ' + String(st).padStart(7) + '   ' +
          rows.map(r => r.cost.toFixed(2).padStart(7)).join(''));
      }
    }
    if (!asJson) {
      // the fatigue the engine actually put in the tank, extremes only
      const lo = curve(t, 30, cond), hi = curve(t, 90, cond);
      console.log('    fat st30  ' + lo.map(r => r.fat.toFixed(3).padStart(7)).join(''));
      console.log('    fat st90  ' + hi.map(r => r.fat.toFixed(3).padStart(7)).join(''));
      console.log('    wkts/over st30 ' + lo.map(r => r.w.toFixed(3).padStart(6)).join('') );
      console.log('    wkts/over st90 ' + hi.map(r => r.w.toFixed(3).padStart(6)).join('') );
    }
  }
  if (!asJson) console.log('');
}

// ---- AGE, WHICH IS THE ONE THING THE SPELL-LENGTH TERMS DO READ -------------
if (!asJson) console.log('--- AGE IN A LONG SPELL (balanced/Sunny, fast, stamina 60) ---');
for (const age of [24, 28, 32, 36]) {
  const rows = curve('fast', 60, CONDS[0], age);
  out.ageSweep[age] = rows;
  if (!asJson) console.log('  age ' + String(age).padStart(2) + '  cost ' +
    rows.map(r => r.cost.toFixed(2).padStart(7)).join(''));
}

// ---- DOES RESTING HIM HELP? ------------------------------------------------
// The tank drains only at drinks and the innings break, so the same man bowling
// his sixth over after a rest carries the same fatigue he would have carried
// without one - only ballsThisSpell is reset. This prices that difference at
// the engine's own numbers rather than asserting it.
if (!asJson) console.log('\n--- WHAT A REST IS WORTH (balanced/Sunny, fast, age 27) ---');
out.restCheck = {};
for (const st of STAMINA) {
  const rows = curve('fast', st, CONDS[0]);
  const r7 = rows[6];                       // his seventh over, spell unbroken
  if (!r7) continue;
  const bowlT = mkSquad(0, 'fast', st, 27);
  // same fatigue, but ballsThisSpell reset to zero: a fresh spell, tired man
  const rested = JSON.parse(evalAt(bowlT, batT, 'balanced', 'Sunny', 13, r7.fat, 0));
  const restedCost = rested.r - rested.w * 25;
  out.restCheck[st] = { unbroken: r7.cost, rested: restedCost, gain: r7.cost - restedCost, fat: r7.fat };
  if (!asJson) console.log('  stamina ' + String(st).padStart(2) +
    '  7th over unbroken ' + r7.cost.toFixed(2) +
    '   same man, spell restarted ' + restedCost.toFixed(2) +
    '   a rest is worth ' + (r7.cost - restedCost).toFixed(2) + ' runs');
}

// ---- THE QUESTION AUTO ACTUALLY ASKS ---------------------------------------
//
// A NOTE ON A MEASUREMENT THAT DOES NOT WORK, kept because the next person
// will reach for it. The obvious framing is "at which over does he become
// worse than the man who would replace him?", measured against an IDENTICAL
// FRESH bowler. Run that and every cell answers 1 or 2, in every condition, at
// every stamina - because the tank never drains, so a man who has bowled at
// all is strictly worse than his own fresh clone forever. It is a true
// statement about nothing: a side does not have unlimited fresh clones, it has
// four other bowlers of DIFFERENT quality, and an over taken off your best man
// is an over given to someone worse.
//
// The real question is narrower, and it is the only one Auto decides: HOLDING
// HIS TOTAL ALLOCATION FIXED at six overs, is it cheaper to bowl them straight
// through or to break them into two spells of three? Total fatigue is
// identical either way - the engine fills the tank per ball bowled and does
// not care how they were spaced - so the entire difference is the
// spell-continuity terms, which is exactly what a burst length controls.
out.burstShape = {};
if (!asJson) {
  console.log('\n--- SIX OVERS STRAIGHT THROUGH, OR TWO SPELLS OF THREE? ---');
  console.log('same man, same six overs, same total fatigue. The gap is the whole of what');
  console.log('an opening-burst length is worth. Positive = splitting is cheaper.\n');
  console.log('                      ' + STAMINA.map(s => ('st' + s).padStart(8)).join(''));
}
for (const age of [24, 28, 32, 36]) {
  out.burstShape[age] = {};
  for (const t of ['fast', 'fingerSpin']) {
    const line = [];
    for (const st of STAMINA) {
      const bowlT = mkSquad(0, t, st, age);
      const byBall = JSON.parse(trace(bowlT, batT, 'balanced', 'Sunny', 4242, mkXI(bowlT)));
      let straight = 0, split = 0;
      for (let k = 1; k <= 6; k++) {
        const fat = byBall[6 * k] != null ? byBall[6 * k] : byBall[String(6 * k)];
        if (fat == null) { straight = split = NaN; break; }
        const ov = 2 * k - 1;
        // unbroken: ballsThisSpell keeps climbing
        const a = JSON.parse(evalAt(bowlT, batT, 'balanced', 'Sunny', ov, fat, 6 * k));
        straight += a.r - a.w * 25;
        // split 3+3: the counter restarts at his fourth over
        const sb = k <= 3 ? 6 * k : 6 * (k - 3);
        const b = JSON.parse(evalAt(bowlT, batT, 'balanced', 'Sunny', ov, fat, sb));
        split += b.r - b.w * 25;
      }
      out.burstShape[age][t] = out.burstShape[age][t] || {};
      out.burstShape[age][t][st] = { straight: straight, split: split, gain: straight - split };
      line.push((straight - split).toFixed(2).padStart(8));
    }
    if (!asJson) console.log('  age ' + String(age).padStart(2) + ' ' + t.padEnd(11) + ' ' + line.join(''));
  }
}

// ---- AND THE SAME QUESTION FOR AGE, which is what the in-spell terms read ---
out.restByAge = {};
if (!asJson) console.log('\n--- WHAT A REST IS WORTH, BY AGE (balanced/Sunny, fast, stamina 60) ---');
for (const age of [24, 28, 32, 36]) {
  const rows = curve('fast', 60, CONDS[0], age);
  const bowlT = mkSquad(0, 'fast', 60, age);
  const r7 = rows[6];
  if (!r7) continue;
  const rested = JSON.parse(evalAt(bowlT, batT, 'balanced', 'Sunny', 13, r7.fat, 0));
  const restedCost = rested.r - rested.w * 25;
  out.restByAge[age] = { unbroken: r7.cost, rested: restedCost, gain: r7.cost - restedCost };
  if (!asJson) console.log('  age ' + String(age).padStart(2) +
    '  7th over unbroken ' + r7.cost.toFixed(2) +
    '   spell restarted ' + restedCost.toFixed(2) +
    '   a rest is worth ' + (r7.cost - restedCost).toFixed(2) + ' runs');
}

if (asJson) console.log(JSON.stringify(out, null, 2));
