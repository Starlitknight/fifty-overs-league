/* tools/realism-lib.mjs — THE PLAYER-REALISM AUDIT'S ONE HARNESS.
 *
 * The player-realism audit (docs/player-realism-audit/) asks the same three
 * questions of five different subsystems: what does one delivery look like
 * (ballDist is pure, so that answer is EXACT), what does a whole match do
 * about it (sampled, paired seeds), and what would the captain / the field
 * actually decide (the decision functions called directly). Five probes each
 * building their own VM players, runners and tallies would be five slightly
 * different experiments pretending to be one audit — so the harness lives
 * here once and the probes only name their questions.
 *
 * IT CHANGES NOTHING. Every number is read out of the built index.html in a
 * VM, exactly the way tools/ball-probe.mjs and tools/attribute-value.mjs
 * read theirs. The engine is not patched, tuned or monkeyed with; the only
 * additions to the context are reader functions with a __pr prefix.
 *
 * The XI is the same ordinary side attribute-value.mjs measures with — five
 * front-line bats, a keeper at six, five bowlers with a real tail — because
 * an effect measured on a plausible side is worth more than one measured on
 * eleven clones. Every knob the audit sweeps (experience, temperament,
 * captaincy, stamina, age, fielding, catching, the gloves, pre-match
 * fatigue, talents) is an explicit override on that side, so a sweep of one
 * thing is a sweep of one thing.
 */
import vm from 'node:vm';
import { makeEngine } from '../test/engine-vm.mjs';

export function makeHarness() {
  const eng = makeEngine();
  eng.setTuning(true);
  vm.runInContext(VMCODE, eng.ctx);
  const g = k => vm.runInContext(k, eng.ctx);
  return {
    ctx: eng.ctx,
    mk: g('__prMake'),
    side: g('__prSide'),
    run: (a, b, seed, opts) => JSON.parse(g('__prRun')(a, b, seed, opts || {})),
    dist: (bat, bowl, opts) => JSON.parse(g('__prDist')(bat, bowl, opts || {})),
    pickBowler: (spec) => JSON.parse(g('__prPickBowler')(spec)),
    fatLaws: (spec) => JSON.parse(g('__prFatLaws')(spec)),
    intent: g('__bpIntentR')
  };
}

const VMCODE = `
// A CRICKETER MADE TO ORDER — every skill defaults to 55 (the ordinary side's
// level) so a sweep of one attribute moves one attribute.
globalThis.__prMake = function (spec) {
  var p = {
    name: spec.name || 'probe', age: spec.age == null ? 27 : spec.age,
    hand: spec.hand || 'R', nat: 'XXX', role: spec.role || 'middleOrderBat',
    bowlTypeFull: spec.bowlTypeFull || 'none',
    exp: spec.exp == null ? 55 : spec.exp,
    formIx: 3,
    fatigue: spec.fatigue || 'rested',
    capt: spec.capt == null ? 40 : spec.capt,
    talents: spec.talents || [],
    skills: {
      vsPace: 55, vsSpin: 55, power: 52, rotation: 55, temperament: 54,
      wicket: 55, economy: 55, discipline: 55, moveTurn: 55, variation: 55,
      stamina: 55, fielding: 55, catching: 55, keeping: 55, stumping: 55
    }
  };
  for (var k in (spec.skills || {})) p.skills[k] = spec.skills[k];
  jsDerive(p);
  if (spec.mpos != null) p.mpos = spec.mpos;
  return p;
};

// THE ORDINARY SIDE, with every audit knob an explicit override.
//   o.all        applied to every man: {exp, capt, age, stamina, fielding,
//                catching, fatigue, temperament}
//   o.slots      array of {slot, ...spec-fields, skills:{}} — per-man edits,
//                applied after o.all so a named man can differ from his side
//   o.sixth      true = the No.5 bat becomes a sixth bowling option
//                (part-time seam at the level given, default 46)
globalThis.__prSide = function (name, o) {
  o = o || {};
  var men = [], i;
  var BAT = [60, 58, 61, 57, 55];
  var mk = function (nm, pos, role, bt, sk, extra) {
    var spec = { name: nm, mpos: pos, role: role, bowlTypeFull: bt, skills: sk || {} };
    if (extra) for (var k in extra) spec[k] = extra[k];
    if (o.all) {
      if (o.all.exp != null) spec.exp = o.all.exp;
      if (o.all.capt != null) spec.capt = o.all.capt;
      if (o.all.age != null) spec.age = o.all.age;
      if (o.all.fatigue != null) spec.fatigue = o.all.fatigue;
      spec.skills = spec.skills || {};
      if (o.all.stamina != null) spec.skills.stamina = o.all.stamina;
      if (o.all.fielding != null) spec.skills.fielding = o.all.fielding;
      if (o.all.catching != null) spec.skills.catching = o.all.catching;
      if (o.all.temperament != null) spec.skills.temperament = o.all.temperament;
    }
    return __prMake(spec);
  };
  for (i = 0; i < 5; i++) {
    var bt5 = (o.sixth && i === 4) ? 'partTimeSeam' : 'none';
    var sk = { vsPace: BAT[i], vsSpin: BAT[i], rotation: BAT[i], power: BAT[i] - 6 };
    if (o.sixth && i === 4) { var L6 = o.sixthLevel == null ? 46 : o.sixthLevel;
      sk.wicket = L6; sk.economy = L6; sk.discipline = L6; sk.moveTurn = L6; sk.variation = L6; }
    men.push(mk(name + '-bat' + i, i + 1, i < 2 ? 'opener' : 'middleOrderBat', bt5, sk));
  }
  men.push(mk(name + '-wk', 6, 'wicketkeeper', 'none',
    { vsPace: 54, vsSpin: 54, rotation: 54, keeping: 74, stumping: 72, catching: 70 }));
  var TY = o.bowlTypes || ['seamFastMedium', 'seamFast', 'seamMedium', 'fingerSpin', 'wristSpin'];
  var TAIL = [44, 32, 26, 21, 16];
  for (i = 0; i < 5; i++)
    men.push(mk(name + '-bowl' + i, 7 + i, TY[i], TY[i],
      { vsPace: TAIL[i], vsSpin: TAIL[i], rotation: TAIL[i], power: TAIL[i] }));
  (o.slots || []).forEach(function (ov) {
    var p = men[ov.slot]; if (!p) return;
    var spec = { name: p.name, mpos: p.mpos, role: p.role, bowlTypeFull: p.bowlTypeFull,
      age: ov.age != null ? ov.age : p.age, exp: ov.exp != null ? ov.exp : p.exp,
      capt: ov.capt != null ? ov.capt : p.capt,
      fatigue: ov.fatigue != null ? ov.fatigue : p.fatigue,
      talents: ov.talents != null ? ov.talents : p.talents, skills: {} };
    if (ov.bowlTypeFull != null) spec.bowlTypeFull = ov.bowlTypeFull;
    if (ov.role != null) spec.role = ov.role;
    for (var k in p.skills) spec.skills[k] = p.skills[k];
    for (var k2 in (ov.skills || {})) spec.skills[k2] = ov.skills[k2];
    men[ov.slot] = __prMake(spec);
  });
  return { name: name, ground: name + ' Park', players: men };
};

// ONE MATCH, WATCHED CLOSELY. Beyond the scoreline the audit needs what no
// scorecard keeps: every fielding contest as it resolved (save, misfield,
// drop, clean catch, the chance that beat everybody), who bowled every over,
// how deep each spell ran, and where the fatigue tank stood while it did.
// M._fldEv / M._fieldingEvent are read after every ball — the engine already
// stamps them for the commentary — and everything else is read off the
// innings records the engine keeps anyway.
globalThis.__prRun = function (ta, tb, seed, opts) {
  opts = opts || {};
  onMatchEnd = function () {};
  M = newMatch(ta, tb, opts.pitch || 'balanced', (seed >>> 0) || 1);
  M.meta = { home: ta.name, away: tb.name, pitch: M.pitch,
             weather: opts.weather || 'Sunny', comp: 'cal', isUser: false, neutral: true };
  M.isUserMatch = false; M.ordersMap = {};
  // a filed bowling plan for side A (the engine's "user bowls" path reads
  // ordersFor + UI.usePlan): opts.ordersA = { compiled: [over -> name] }
  if (opts.ordersA) M.ordersMap[ta.name] = opts.ordersA;
  UI.usePlan = !!opts.ordersA;
  App.tossState = { stage: 'x' };
  applyToss(aiTossDecision());
  var g = 0;
  var fld = [ {}, {} ];           // per innings (of the BOWLING side's work)
  var bump = function (ix, k) { fld[ix][k] = (fld[ix][k] || 0) + 1; };
  var overBowl = [ [], [] ];      // over number -> bowler name
  var cumRuns = [ [], [] ];       // over number -> cumulative runs at its end
  var lastLegal = [ 0, 0 ];       // extras leave inn.legal still - only a ball
                                  // that advanced it may stamp the over ledgers,
                                  // or a wide first-up writes into the PREVIOUS over
  var spellMax = [ {}, {} ];      // bowler -> longest consecutive-spell balls
  var fatPeak = {};               // name -> max in-match fatigue seen
  var trace = [];                 // optional per-over fatigue of one name
  while (M && !M.done && g++ < 4000) {
    autoPick();
    // the innings this ball belongs to is the one BEFORE the step — a wicket
    // that ends the innings must not book its catch to the innings after it
    var ix = M.inns > 1 ? 1 : M.inns;
    stepBall();
    if (!M || !M.innings) break;
    var inn = M.innings[ix];
    if (!inn) continue;
    var ev = M._fldEv;
    if (ev && ev.k) bump(ix, ev.k === 'save' ? ('save' + (ev.d || 0)) : ev.k);
    if (!ev && M._fieldingEvent && M._fieldingEvent.indexOf('can only watch') >= 0) bump(ix, 'beat');
    if (inn.legal > lastLegal[ix]) {
      lastLegal[ix] = inn.legal;
      if (inn.legal % 6 === 0) cumRuns[ix][inn.legal / 6 - 1] = inn.runs;
      if (inn.curBowlerName) {
        overBowl[ix][Math.floor((inn.legal - 1) / 6)] = inn.curBowlerName;
        var br = inn.bowlers[inn.curBowlerName];
        if (br) { var sm = spellMax[ix];
          if ((br.spellB || 0) > (sm[inn.curBowlerName] || 0)) sm[inn.curBowlerName] = br.spellB; }
      }
    }
    for (var nm in M.fat) if ((M.fat[nm] || 0) > (fatPeak[nm] || 0)) fatPeak[nm] = M.fat[nm];
    if (opts.traceFat && inn.legal % 6 === 0)
      trace.push({ inns: ix, over: inn.legal / 6, fat: M.fat[opts.traceFat] || 0,
                   faced: inn.faced[opts.traceFat] || 0 });
  }
  if (!M || !M.done) return JSON.stringify(null);
  var packInn = function (inn, ix) {
    if (!inn) return null;
    var bowlers = {};
    for (var nm in inn.bowlers) { var r = inn.bowlers[nm];
      bowlers[nm] = { b: r.b, r: r.r, w: r.w, maxSpell: spellMax[ix][nm] || 0 }; }
    return { batTeam: inn.batTeam, runs: inn.runs, wkts: inn.wkts, legal: inn.legal,
      extras: inn.extras, fld: fld[ix], overBowl: overBowl[ix], cumRuns: cumRuns[ix],
      ph_r: inn.ph_r, ph_b: inn.ph_b, bowlers: bowlers,
      bat: inn.bat.map(function (b) { return { nm: b.p.name, r: b.r, b: b.b, out: b.out }; }),
      fielding: inn.fielding };
  };
  var out = { winner: M.result ? M.result.winner : null,
    i1: packInn(M.innings[0], 0), i2: packInn(M.innings[1], 1),
    fatPeak: fatPeak, fatEnd: M.fat };
  if (opts.traceFat) out.trace = trace;
  return JSON.stringify(out);
};

// ONE DELIVERY, EXACTLY — ball-probe's reader with the audit's extra context
// (since, wkts, std defaulted to 0 = ordinary standard) so pressure states
// can be posed precisely.
globalThis.__prDist = function (batSpec, bowlSpec, o) {
  o = o || {};
  var bat = __prMake(batSpec || {}), bowl = __prMake(bowlSpec || {});
  var over = o.over == null ? 25 : o.over;
  var ph = o.ph || (over < 10 ? 'pp' : (over >= 40 ? 'death' : 'mid'));
  var ctx = {
    weather: o.weather || 'sunny', pship: o.pship || 0, chase: !!o.chase,
    bballs: o.bballs == null ? 12 : o.bballs,
    ballsThisSpell: o.ballsThisSpell || 0,
    wkts: o.wkts || 0, since: o.since == null ? 20 : o.since,
    std: o.std == null ? 0 : o.std,
    ballsLeft: o.ballsLeft == null ? Math.max(0, 300 - over * 6) : o.ballsLeft,
    reqRate: o.reqRate || 0,
    fieldAvg: o.fieldAvg || 0, keeperQuality: o.keeperQuality || 0,
    keeperStump: o.keeperStump == null ? null : o.keeperStump,
    keeperCatch: o.keeperCatch == null ? null : o.keeperCatch,
    rocketArms: o.rocketArms || 0, lightningKeeper: !!o.lightningKeeper,
    mixed: !!o.mixed,
    batFat: o.batFat || 0, bowlFat: o.bowlFat || 0,
    captBowl: o.captBowl == null ? 50 : o.captBowl,
    captBat: o.captBat == null ? 50 : o.captBat,
    freeHit: false, homeSide: null
  };
  M = { inns: o.inns || 0, pitch: o.pitch || 'balanced', rand: function () { return 0.5; } };
  var d = ballDist(bat, bowl, ph, o.faced || 0, o.intent || 0, o.rrDef || 0,
                   o.pitch || 'balanced', o.field || 'bal', over, ctx);
  M = null;
  return JSON.stringify(d);
};

// WHAT WOULD THE CAPTAIN DO — aiPickBowler called on a posed innings state.
//   spec: { side (a __prSide result), over, pitch, weather, captBowl, pship,
//           used: {name: ballsBowled}, spellB: {name: balls}, fat: {name: f},
//           lastBowler, seedKey }
// Returns the scored ranking (deterministic) and the pick for this seedKey.
globalThis.__prPickBowler = function (spec) {
  var bxi = spec.side.players.map(function (p) { return withForm(p); });
  var inn = { bxi: bxi, bowlers: {}, lastBowler: spec.lastBowler || null,
    pshipR: spec.pship || 0, captBowl: spec.captBowl == null ? 50 : spec.captBowl,
    bowlTeam: spec.side.name, legal: (spec.over || 0) * 6 };
  var used = spec.used || {};
  for (var nm in used) inn.bowlers[nm] = { p: null, r: 0, w: 0, b: used[nm],
    spellB: (spec.spellB || {})[nm] || 0 };
  M = { pitch: spec.pitch || 'balanced', fat: spec.fat || {},
        meta: { weather: spec.weather || 'Sunny' },
        seedKey: String(spec.seedKey == null ? 1 : spec.seedKey),
        target: null, inns: 0, rand: function () { return 0.5; } };
  var av = availableBowlers(inn);
  // the ranking aiPickBowler itself would sort by, reproduced by calling it
  // at captaincy 99 (>=92 always returns the top of its own ranking) with
  // successive front-runners removed — the engine's own order, not a copy
  var rank = [];
  var pool = { name: spec.side.name, players: null };
  var left = av.slice();
  while (left.length) {
    var inn2 = { bxi: left.concat(bxi.filter(function (p) { return !p.bowlType; })),
      bowlers: inn.bowlers, lastBowler: inn.lastBowler, pshipR: inn.pshipR,
      captBowl: 99, bowlTeam: inn.bowlTeam, legal: inn.legal };
    var best = aiPickBowler(inn2, spec.over || 0);
    rank.push(best.name);
    left = left.filter(function (p) { return p.name !== best.name; });
  }
  var pick = aiPickBowler(inn, spec.over || 0);
  M = null;
  return JSON.stringify({ rank: rank, pick: pick.name,
    available: av.map(function (p) { return p.name; }) });
};

// THE FATIGUE LAWS, READ STRAIGHT OFF THE ENGINE — the pre-match penalty and
// starting load for a fatigue word, and the per-ball accrual for a stamina /
// age / trade, so the audit can quote the exact arithmetic it then measures.
globalThis.__prFatLaws = function (spec) {
  var p = __prMake(spec || {});
  var stB = foSkE(p, 'stamina') || 50;
  var ageT = foAgeTireFactor(p);
  var roleW = (p.bowlType === 'fast' ? 1.08 : (p.bowlType === 'fastMedium' ? 1.04 : 1.0));
  var roleB = p.keeper ? 1.04 : 1.0;
  return JSON.stringify({
    fatigueIndex: foFatigueIndex(p),
    penalty: foFatiguePenalty(p),
    load: foFatigueLoad(p),
    ageTire: ageT,
    perBallBat: ((1.75 - stB / 100) / 120) * ageT * roleB,
    perBallBowl: ((1.85 - stB / 100) / 74) * ageT * roleW
  });
};

// aiIntent on a posed innings — ball-probe's reader, kept here so every probe
// imports one harness.
globalThis.__bpIntentR = function (o) {
  var faced = o.setFaced == null ? 30 : o.setFaced;
  var inn = {
    legal: (o.over || 0) * 6, wkts: o.wkts || 0, runs: o.runs || 0,
    since: o.since == null ? 20 : o.since, batTeam: 'BAT',
    striker: 0, bat: [{ p: { name: 'S' } }], faced: { S: faced }
  };
  M = { target: o.target || null, inns: o.target ? 1 : 0,
        pitch: o.pitch || 'balanced', rand: function () { return 0.5; } };
  var v = aiIntent(inn);
  M = null;
  return v;
};
`;

// ---------------------------------------------------------------------------
// SHARED ARITHMETIC — the summaries every probe reports. Paired seeds: the
// variant and its control play the same fixture list, and the statistic is
// the mean of the per-seed DIFFERENCES, whose standard error is honest about
// the pairing.
// ---------------------------------------------------------------------------
export function summary(xs) {
  const n = xs.length;
  if (!n) return { n: 0, mean: 0, se: 0 };
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  const va = xs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / Math.max(1, n - 1);
  return { n, mean, se: Math.sqrt(va / n) };
}

export function per50(runs, balls) { return balls > 0 ? runs * 300 / balls : 0; }

// The outcome bundle of one delivery distribution, in cricket units.
export function distStats(d) {
  const g = k => d[k] || 0;
  const wkt = ['wC', 'wB', 'wLBW', 'wRO', 'wST'].reduce((a, k) => a + g(k), 0);
  const wide = g('wide'), nb = g('noball');
  const offBat = g('1') + 2 * g('2') + 3 * g('3') + 4 * g('4') + 6 * g('6');
  const runs = offBat + wide + nb + g('bye') * 1.6 + g('legbye') * 1.35;
  const legal = Math.max(1e-9, 1 - wide - nb);
  return {
    dot: g('dot') * 100, one: g('1') * 100, two: g('2') * 100,
    four: g('4') * 100, six: g('6') * 100, wkt: wkt * 100,
    bnd: (g('4') + g('6')) * 100,
    rot: (g('1') + g('2') + g('3')) * 100,
    wRO: g('wRO') * 100, wST: g('wST') * 100, wC: g('wC') * 100,
    bye: g('bye') * 100, extras: (wide + nb + g('bye') + g('legbye')) * 100,
    rpo: 6 * runs / legal,
    bpw: wkt > 0 ? legal / wkt : Infinity
  };
}

export const arg = (k, d) => {
  const hit = process.argv.find(a => a.startsWith('--' + k + '='));
  return hit ? hit.split('=')[1] : d;
};
export const has = k => process.argv.includes('--' + k);
