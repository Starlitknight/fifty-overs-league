// enginehost.mjs — ONE ENGINE, TWO HOSTS (BLUEPRINT law 3). Loads the exact
// shipped build through test/engine-vm.mjs (proven bit-identical to the
// browser) and exposes deterministic squad generation + match execution.
// No forked logic: everything cricket happens inside the shipped engine.
import vm from 'node:vm';
import { makeEngine } from '../test/engine-vm.mjs';

// bumps ONLY with a new calibration golden. v2: diminishing returns on skill
// far from average (skill_soft) + rpo recalibration + designed league ladder -
// the change that capped favourites near reality's ~88% instead of 99.8%.
export const ENGINE_VERSION = 'v3';

export function makeHost() {
  const eng = makeEngine();
  eng.setTuning(true);
  vm.runInContext(`
// THIS IS THE SERVED WORLD, so the served world's money applies. foWageOf
// prices quality on a curve calibrated to THIS economy's income; a browser
// playing a solo career never sets this and keeps its own flat wages, which
// its $9 ticket and $25,000 sponsor are calibrated to.
globalThis.__foServedEcon = true;
globalThis.__svcGenSquad = function (seed, country, arch, capt, strength, tier) {
  // strength is the club's standing in its league: the flagship's is the highest
  // in the nation, and the rest spread below it. Omitted means the one shared
  // budget every human manager founds on.
  // capt is vestigial - a club has no pre-set captain and the generator no
  // longer takes one. It stays in THIS wrapper's signature only because
  // callers pass strength positionally after it; nothing reads it.
  var g = __foGenArchetypeSquad(seed, country, arch, null,
    (typeof strength === 'number' && strength > 0) ? strength : 1, tier || null);
  return JSON.stringify((g && g.players) || []);
};
// ONE ROUND IN THE NETS, run by the SHIPPED engine's own numbers.
// The programme weights, the threshold curve and jsDerive all live in the
// build the phones run, so the umpire's training and the training a manager
// reads about can never be two different games. Deterministic: no dice, only
// the plan, the man's age, his ceiling and how tired he is.
// The RATE is the one thing outside the engine that moves the needle: a
// club's academy, which is a building the manager paid for. It arrives as a
// plain multiplier so the arithmetic below stays the shipped engine's own.
globalThis.__svcTrain = function (playersJson, planJson, rate, xiJson) {
  var players = JSON.parse(playersJson), plan = JSON.parse(planJson || '{}');
  var RATE = (typeof rate === 'number' && isFinite(rate) && rate > 0) ? rate : 1;
  // THE MATCH-DAY RULE (051), the way Battrick has always run it: on a round
  // where an XI took the field, the eleven who played bank the full session
  // and the men left out train at half pace. xi is the banked teamsheet for
  // that round; null (every round banked before 051, every rest day, every
  // club that filed no sheet) means the whole squad trains in full - so
  // history replays exactly as it always did.
  var xiSet = null;
  try {
    var XI = xiJson ? JSON.parse(xiJson) : null;
    if (XI && XI.length) { xiSet = {}; XI.forEach(function (n) { xiSet[n] = 1; }); }
  } catch (eXi) {}
  var PROGS = (typeof FO_TRAIN_PROGS !== 'undefined' && FO_TRAIN_PROGS) || (window && window.FO_TRAIN_PROGS) || {};
  var LADDER = ['rested','revived','energetic','passable','satisfactory','moderate','weary','listless','exhausted','shattered','clinically dead'];
  var FATF = [0.35,0.45,0.55,0.68,0.78,0.86,0.93,0.97,1.00,1.02,1.04];
  var paceT = { seamFast:1, seamFastMedium:1, seamMedium:1, partTimeSeam:1 };
  var spinT = { wristSpin:1, fingerSpin:1, partTimeSpin:1 };
  var defaultProg = function (p) {
    if (p.keeper || p.role === 'wicketkeeper') return 'Keeping';
    if (p.role === 'allRounder') return 'All-rounder';
    if (paceT[p.bowlTypeFull]) return 'New-ball seam';
    if (spinT[p.bowlTypeFull]) return 'Spin bowling';
    return p.role === 'middleOrderBat' ? 'Finishing' : 'Batting';
  };
  var potFactor = function (p) {
    var v = ((p.talent === 'gifted' || (p.talents || []).length >= 2) ? 2 : 0)
          // THE RATING TERM IS A NEAR-UNIVERSAL +1, AND IS LEFT THAT WAY ON
          // PURPOSE. 3,600 was never a discriminating threshold - the old
          // scale's floor was above 15,000 - and under B2 it is a card of 3.6,
          // so every professional and all but the very worst colt clears it. It
          // is a legacy constant that does nothing, and the reason it stays is
          // that the nets are REPLAYED from the record on every settle: moving
          // this threshold to somewhere it discriminates would re-rate every
          // training session every cricketer has ever had, which is a rewrite of
          // the world's history to fix a term that has never once changed an
          // outcome. If potential is ever to be a real input to training it
          // needs its own design and its own migration, not a quietly edited
          // number here.
          + (p.age <= 20 ? 2 : p.age <= 24 ? 1 : 0) + ((p.rating > 3600) ? 1 : 0);
    return v >= 4 ? 1.30 : v >= 3 ? 1.15 : v >= 1 ? 1 : 0.80;
  };
  // THE SHIPPED CURVE IF THE BUILD WILL EXPORT IT, for the same reason
  // skillThreshold is read rather than restated: the umpire develops every
  // unmanaged club in the world, and a second copy of this is a world that
  // grows at one rate and reports another. The literal is the pre-ageing curve,
  // kept only for a build too old to have the export.
  var ageFactor = (typeof window !== 'undefined' && window.foTrainAgeFactor)
    || function (a) { return a <= 20 ? 1.35 : a <= 24 ? 1.15 : a <= 29 ? 0.90 : a <= 32 ? 0.55 : 0.25; };
  var fresh = function (p) {
    var w = String((p.fatWord || p.fatigue || 'rested')).toLowerCase();
    var ix = LADDER.indexOf(w); if (ix < 0) ix = 0;
    return FATF[Math.max(0, Math.min(10, 10 - ix))];
  };
  // THE COST OF A POINT, and it is the SHIPPED engine's if the shipped engine
  // will tell us. skillThreshold grew a geometric tail above the latent knee
  // when the 99 ceiling came off (see 00-core.js), and a server that kept the
  // old straight line would develop the world at a different price from the
  // phone that shows it. The local formula is the pre-tail one, kept only for
  // a build too old to export the function.
  var engThresh = (typeof window !== 'undefined' && window.foSkillThreshold) || null;
  var thresh = engThresh || function (v) { return 80 + (+v || 0) * 1.5; };
  var LATMAX = (typeof window !== 'undefined' && window.FO_LATENT_MAX) || 250;
  // TRAINING v2 RIDES UNDER "__v2" - a key no player is named. Its unit
  // intensities scale the session: light banks less, intensive banks more.
  // Plans banked before v2 carry no __v2 and replay exactly as they always
  // did, so history is never re-rated.
  var V2 = (plan && plan.__v2) || null;
  var INT_F = { light: 0.6, normal: 1, high: 1.3, intensive: 1.6 };
  var unitKey = function (p) {
    if (p.keeper || p.role === 'wicketkeeper') return 'wk';
    if (p.role === 'allRounder') return 'ar';
    var bt = p.bowlTypeFull || p.bowlType || '';
    if (/spin|wrist|finger/i.test(String(bt))) return 'spin';
    if (bt && !/none/i.test(String(bt))) return 'seam';
    return 'bat';
  };
  var intensityOf = function (p) {
    if (!V2 || !V2.units) return 1;
    var u = V2.units[unitKey(p)];
    return (u && INT_F[u.i]) || 1;
  };
  // THE PLAN ENTRY, old shape or new. A bare programme name is every plan
  // ever banked; { p, f } is one with a focus. The reader and the focus
  // arithmetic both belong to the shipped engine (00-core.js), so the umpire
  // and the phone can never price a focus two different ways.
  var ENT = (typeof FO_PLAN_ENTRY !== 'undefined' && FO_PLAN_ENTRY) || (window && window.FO_PLAN_ENTRY);
  var FOC = (typeof FO_TRAIN_FOCUS !== 'undefined' && FO_TRAIN_FOCUS) || (window && window.FO_TRAIN_FOCUS);
  var readEntry = (typeof ENT === 'function') ? ENT : function (v) {
    return typeof v === 'string' ? { p: v, f: null }
      : (v && typeof v === 'object' && typeof v.p === 'string')
        ? { p: v.p, f: (typeof v.f === 'string' && v.f) ? v.f : null } : null;
  };
  var focusWeights = (typeof FOC === 'function') ? FOC : function (pg, f) {
    var w0 = PROGS[pg]; if (!w0) return null;
    if (!f || w0[f] === undefined) return w0;
    var o = {}; for (var k in w0) o[k] = w0[k];
    o[f] = w0[f] * 2; return o;
  };
  var gains = [];
  // WHAT EACH MAN ACTUALLY WORKED, reported rather than inferred. A plan need
  // not name every man - an unmanaged club files nothing at all - and the
  // engine falls back to the programme his trade implies. Anything outside
  // wanting to know what a round consisted of has to be TOLD, or it grows a
  // second copy of defaultProg and the two drift.
  var worked = {};
  players.forEach(function (p) {
    var ent = readEntry(plan[p.name]) || { p: defaultProg(p), f: null };
    var prog = ent.p;
    worked[p.name] = { p: prog, f: (ent.f && PROGS[prog] && PROGS[prog][ent.f] !== undefined) ? ent.f : null };
    if (prog === 'Rest' || !PROGS[prog]) return;
    var pts = 24 * ageFactor(p.age || 27) * potFactor(p) * fresh(p) * RATE * intensityOf(p)
            * (xiSet ? (xiSet[p.name] ? 1 : 0.5) : 1)
            // THE HIDDEN RATE (068): a boy's seeded growth multiplier, set by
            // the replay on the crew copy only - absent on every senior and
            // on every crew built before the rate existed, so history replays
            // exactly as it always did
            * ((+p.__ypot > 0) ? +p.__ypot : 1);
    if (prog === 'All-rounder') pts *= 0.85;
    var w = focusWeights(prog, ent.f) || PROGS[prog], total = 0;
    for (var k in w) total += w[k];
    if (!total) return;
    p.trainProgress = p.trainProgress || {};
    for (var sk in w) {
      if (!p.skills || p.skills[sk] === undefined) continue;
      p.trainProgress[sk] = (p.trainProgress[sk] || 0) + pts * w[sk] / total;
      var th = thresh(p.skills[sk]);
      while (p.trainProgress[sk] >= th && p.skills[sk] < LATMAX) {
        p.trainProgress[sk] -= th;
        p.skills[sk]++;
        jsDerive(p);
        gains.push({ name: p.name, skill: sk, to: p.skills[sk] });
        th = thresh(p.skills[sk]);
      }
    }
  });
  return JSON.stringify({ players: players, gains: gains, worked: worked });
};
// WHAT A DAY WAS WORTH, by the shipped client's own arithmetic. server/
// ratings.mjs carries a port of this because the living layer needs it
// without a VM; the tests hold the two to the same answer on real innings,
// so a manager's form and his ratings page can never tell two stories.
globalThis.__svcFantasy = function (inningsJson) {
  return JSON.stringify(window.foFantasyPoints(JSON.parse(inningsJson)));
};
// the shipped game's own MATCH RATING for one side of one card - six units on
// the club rating scale. Reached through window.teamRatings, which is the
// PATCHED function (the overlay that refuses to mark the hands of a side that
// never fielded), so a test comparing the server's port against this is
// comparing it against what a manager actually reads.
globalThis.__svcTeamRatings = function (resultJson, teamName) {
  var r = JSON.parse(resultJson), out = window.teamRatings(r, teamName), flat = {};
  for (var k in out) flat[k] = Array.isArray(out[k]) ? out[k][0] : out[k];
  return JSON.stringify(flat);
};
// refresh every derived rating from the skills beneath them, by the shipped
// engine's own mapping - the one place bat, threat, control and wage are made
globalThis.__svcDerive = function (playersJson) {
  var ps = JSON.parse(playersJson);
  ps.forEach(function (p) { try { jsDerive(p); } catch (e) {} });
  return JSON.stringify(ps);
};
// A YEAR ON A SQUAD. The ageing curve lives in the shipped engine beside the
// latent model it operates on (foAgeDecline, 00-core.js), because a career's
// shape is a fact about cricketers rather than a fact about the umpire - and
// because a second implementation on this side would be a second opinion about
// when a fast bowler loses his pace.
//
// The AGE ITSELF is not touched here. youth.mjs owns the rollover: it decides
// who has had a birthday, who retires and who walks out of the academy, and it
// hands the survivors here to find out what the year cost them.
globalThis.__svcAgeDecline = function (playersJson) {
  var ps = JSON.parse(playersJson);
  ps.forEach(function (p) { try { foAgeDecline(p); } catch (e) {} });
  return JSON.stringify(ps);
};
// PLACE A REAL CRICKETER AT A CHOSEN OVERALL, keeping his shape. The canonical
// level is linear in a man's skills, so foFitToLevel is a similarity transform:
// it moves him up or down the ladder and leaves every ratio between his
// attributes where the archetype put it. This is how a parity suite gets a
// power hitter at 20 and the same power hitter at 95 without hand-writing a
// skill row, which would only ever prove that ONE invented cricketer agrees.
globalThis.__svcFitOvr = function (playersJson, ovr) {
  var ps = JSON.parse(playersJson);
  ps.forEach(function (p) {
    try { window.foFitToLevel(p, window.foLevelForOvr(ovr)); } catch (e) {}
  });
  return JSON.stringify(ps);
};
// the card's overall rating, straight from the shipped engine - the served
// club pages compute this in SQL (migration 016) and the tests hold the two
// to the same answer
// A CLUB SOMEBODY HAS JUST CLAIMED, LAID ON THE NEWCOMER'S CURVE.
//
// The men are the club's own - same names, same ages, same careers, same
// archetypes - and the ONLY thing that changes is how good they are. This is
// the identical function the generator lays a founded squad with, seeded off
// the club so a levelling is deterministic and, run twice, lands on the same
// world. The alternative was a second implementation on this side of the wire,
// which is how a founded newcomer and a claimed newcomer came to be dealt by
// two different mechanisms in the first place.
globalThis.__svcLayOnTier = function (playersJson, tier, seed) {
  var ps = JSON.parse(playersJson);
  if (!ps.length) return playersJson;
  window.foLayOnTierSeeded(ps, tier, seed || 'lay', function (p) { jsDerive(p); });
  return JSON.stringify(ps);
};
// A MAN PUT BACK ON THE LEVEL HE WAS ALREADY ON, after his shape has changed.
//
// This is what makes a STYLE change free. An archetype offset, a lean toward
// pace, a season's development that went into power rather than rotation - all
// of them move a cricketer's raw attributes, and the canonical weights are not
// equal, so any of them also moves what he is worth unless something puts him
// back. The generator has always done exactly this (it leans a man, then fits
// him to his tier's mark), and stating it as one function is what lets
// everything else in the game - youth, the nets, a save migration - be honest
// about which of the two things it is doing: changing WHO he is, or changing HOW
// GOOD he is. It must never do both by accident.
globalThis.__svcFitLevel = function (playersJson, level) {
  var ps = JSON.parse(playersJson);
  ps.forEach(function (p) { try { window.foFitToLevel(p, level); } catch (e) {} });
  return JSON.stringify(ps);
};
globalThis.__svcOvr = function (playersJson) {
  var ps = JSON.parse(playersJson);
  return JSON.stringify(ps.map(function (p) {
    try { return window.foPkOvr(p); } catch (e) { return null; }
  }));
};
// THE STAR COMPOSITES the Roster rates a man on, straight from the shipped
// orders room. A rival's page cannot see the raw skills these are built from
// (016 draws that line on purpose), so the number itself is published and the
// two are held to the same answer here - exactly as the card rating is.
globalThis.__svcStarComp = function (playersJson) {
  var ps = JSON.parse(playersJson);
  var sf = window.foStarsFor || null;
  return JSON.stringify(ps.map(function (p) {
    try {
      return { bat: sf ? sf.bat(p) : null, bowl: (sf && p.bowlType) ? sf.bowl(p) : null };
    } catch (e) { return null; }
  }));
};
globalThis.__svcRun = function (homeJson, awayJson, pitch, seed, ordersJson, weather, neutral) {
  var home = JSON.parse(homeJson), away = JSON.parse(awayJson);
  onMatchEnd = function () {};
  M = newMatch(home, away, pitch, (seed >>> 0) || 1);
  // weather rides into the same meta the client's own matches use - Overcast
  // swings, Drizzle can cut overs and revise the chase by DLS, heat tires
  // A NEUTRAL TIE HAS NO HOME SIDE. The engine gives the home side a small
  // edge (FO_HOME_EDGE), and a cup staged at a neutral ground must not hand it
  // to whichever side the draw happened to write down first.
  M.meta = { home: home.name, away: away.name, pitch: pitch, weather: weather || 'Sunny',
             comp: 'world', isUser: false, neutral: !!neutral };
  // a claimed club's submitted orders ride in keyed by club name; the
  // engine's ordersFor/pickXI consult M.ordersMap before anything else
  M.isUserMatch = false; M.ordersMap = ordersJson ? JSON.parse(ordersJson) : {};
  App.tossState = { stage: 'x' };
  applyToss(aiTossDecision());
  var g = 0;
  while (M && !M.done && g++ < 4000) { autoPick(); stepBall(); }
  if (!M || !M.done) return null;
  // the card as it is banked. Boundaries and the hands ride along because the
  // ratings page and a player's FORM are both scored off them - a match played
  // before this carried them simply rates without them, which is honest.
  // WHAT WAS GIVEN AWAY. The umpire's total has always counted wides,
  // no-balls, byes and leg byes; the rows under it never did. So every card
  // in the game printed a total the batters could not add up to - four runs
  // adrift in a typical innings, and nobody could see where they went. The
  // four counters are the engine's own (inn.extras), and they ride with the
  // card. A match banked before this simply has none, and a scorecard can
  // still say what the extras came to by subtracting the batting from the
  // total - which is exactly what the number means.
  var slim = function (inn) {
    if (!inn) return null;
    var ex = inn.extras || null;
    return { batTeam: inn.batTeam, bowlTeam: inn.bowlTeam, runs: inn.runs, wkts: inn.wkts, legal: inn.legal,
      extras: ex ? { wd: ex.wd | 0, nb: ex.nb | 0, b: ex.b | 0, lb: ex.lb | 0 } : null,
      bat: (inn.bat || []).map(function (b) {
        return { p: b.p, r: b.r, b: b.b, f4: b.f4 || 0, f6: b.f6 || 0, out: b.out };
      }),
      // AND WHO BUILT IT WITH WHOM. The report has drawn a partnership ladder
      // for as long as it has had a Charts tab, and it has never once had
      // anything to draw: the engine keeps inn.pships and this is where the
      // card is trimmed for banking, and pships was not on the list. So the
      // section quietly rendered nothing on every league match ever played.
      // Eleven small rows a side - the cheapest thing on the card, and the one
      // that says how an innings was actually built.
      pships: (inn.pships || []).map(function (q) {
        return { w: q.w | 0, runs: q.runs | 0, balls: q.balls | 0, pair: q.pair };
      }),
      // and WHEN each of them ended. Third and last of the same omission: the
      // live card computes its own fall of wickets as the innings happens, so
      // nobody noticed that a card read back off the record has never had one.
      fow: (inn.fow || []).map(function (q) {
        return { sc: q.sc | 0, w: q.w | 0, who: q.who, ov: q.ov };
      }),
      // WHO ACTUALLY PLAYED. A card names the men who did something - batted,
      // bowled, held a catch - and the record was built from exactly those, so
      // a cricketer picked in the eleven who was not needed with the bat, did
      // not get an over and had nothing come to him had no evidence he had ever
      // been on the field. His career read nought matches and his story read
      // "nothing on his sheet yet" while his club played on around him. The
      // engine has always known both elevens; this is where they were thrown
      // away. Names only - the card carries the men's figures already.
      xi: (inn.xi || []).map(function (q) { return (q && q.name) || q; }),
      bxi: (inn.bxi || []).map(function (q) { return (q && q.name) || q; }),
      bowlers: inn.bowlers, fielding: inn.fielding || {} };
  };
  // canonical result: fixed key order, no floats beyond engine output.
  // tal is what the men LEARNED in this match - name -> talent -> triggers -
  // and it belongs in the card rather than beside it. Talent progress is
  // derived from the record on every settle, so if it lived in a side table
  // with a retention window it would evaporate; the card is the only thing
  // that keeps forever. Cards banked before this simply have no tal, which
  // folds to no progress, which is the truth about them.
  return JSON.stringify({
    winner: M.result ? M.result.winner : null,
    text: M.result ? M.result.text : '',
    mom: M.result ? M.result.mom : null,
    innings: [slim(M.innings[0]), slim(M.innings[1])],
    worm: M.worm,
    tal: M._tal || {}
  });
};
// THE COMMENTARY OF THE MATCH JUST PLAYED. __svcRun leaves the finished match
// in M; this reads its ball-by-ball out without re-running a single delivery
// and without touching the canonical result - the log is banked BESIDE the
// card (match_logs, kept for the season - 066), never inside it, so nothing about the
// canonical shape or the golden-master replays moves an inch.
// THE THRESHOLDS, read off the shipped engine rather than copied beside it.
// The umpire folds talent progress out of the record and has to know when a
// man has crossed; if this were a second table it would drift from the one the
// ball loop actually uses, and a page would promise a talent the engine never
// gave him.
globalThis.__svcTalT = function () { return JSON.stringify(FO_TAL_T); };
globalThis.__svcTalElig = function (pJson, t) { return foTalElig(JSON.parse(pJson), t) ? 1 : 0; };
globalThis.__svcLastLog = function () {
  try { return JSON.stringify((typeof M !== 'undefined' && M && M.log) || []); }
  catch (e) { return '[]'; }
};
// the fixture's conditions, from the planet's ONE table - the same function a
// phone calls to print the forecast, so the umpire can never play a different
// pitch than the fixtures page promised
globalThis.__svcCond = function (rid, slot, seasonNo, round) {
  return JSON.stringify(window.__foPlanet.condOf(rid, slot, seasonNo, round));
};
globalThis.__svcDoctrine = function (rid, slot) {
  return JSON.stringify(window.__foPlanet.doctrineOf(rid, slot));
};
globalThis.__svcWorldCfg = function () {
  // the world's shape read from the SHIPPED build itself — regions, club
  // names and national hours come from the same code the phones run, so the
  // served world and the client planet can never drift apart
  // sixteen nations, straight off the shipped table - the three that left the
  // top table are struck from it, so there is nothing here to filter
  var regions = (window.__foCxAPI.regions() || []).filter(function (r) { return !r.final; });
  return JSON.stringify(regions.map(function (r) {
    var boss = null; (r.clubs || []).forEach(function (c) { if (c.boss) boss = c; });
    return {
      id: r.id, name: r.nm, nat: (r.nats && r.nats[0]) || r.nm,
      arch: r.arch || 'rock', capt: (boss && boss.capt) || 'talisman',
      hour: window.__foPlanet.natHour(r.id),
      // arch, str and division come from the planet's own table
      // (27-living-planet.js), so the identity and the standing a phone shows
      // and the squad the umpire generates are read off ONE source
      sides: window.__foPlanet.sidesOf(r.id).map(function (s) {
        return { slot: s.slot, name: s.name, city: s.city, boss: !!s.boss, arch: s.arch, str: s.str, div: s.div };
      })
    };
  }));
};`, eng.ctx);
  const gen = vm.runInContext('__svcGenSquad', eng.ctx);
  const run = vm.runInContext('__svcRun', eng.ctx);
  const lastLog = vm.runInContext('__svcLastLog', eng.ctx);
  const talT = vm.runInContext('__svcTalT', eng.ctx);
  const talElig = vm.runInContext('__svcTalElig', eng.ctx);
  const cfg = vm.runInContext('__svcWorldCfg', eng.ctx);
  const cond = vm.runInContext('__svcCond', eng.ctx);
  const doct = vm.runInContext('__svcDoctrine', eng.ctx);
  const train = vm.runInContext('__svcTrain', eng.ctx);
  const der = vm.runInContext('__svcDerive', eng.ctx);
  const aged = vm.runInContext('__svcAgeDecline', eng.ctx);
  const ovr = vm.runInContext('__svcOvr', eng.ctx);
  const scomp = vm.runInContext('__svcStarComp', eng.ctx);
  const pval = vm.runInContext('(function(j){return JSON.stringify(window.foPlayerValue(JSON.parse(j)))})', eng.ctx);
  const fit = vm.runInContext('__svcFitOvr', eng.ctx);
  const lay = vm.runInContext('__svcLayOnTier', eng.ctx);
  const fitL = vm.runInContext('__svcFitLevel', eng.ctx);
  const lbl = vm.runInContext('window.foOvrLabel', eng.ctx);
  const sts = vm.runInContext('window.foStars', eng.ctx);
  const fan = vm.runInContext('__svcFantasy', eng.ctx);
  const tmr = vm.runInContext('__svcTeamRatings', eng.ctx);
  return {
    genSquad(seed, country, arch, capt, strength, tier) { return JSON.parse(gen(seed, country, arch, capt, strength, tier)); },
    // one round in the nets for a whole squad, by the shipped engine's numbers,
    // at the rate the club's academy buys (1 = a level-two academy)
    trainRound(players, plan, rate, xi) {
      return JSON.parse(train(JSON.stringify(players), JSON.stringify(plan || {}), rate,
        (Array.isArray(xi) && xi.length) ? JSON.stringify(xi) : null));
    },
    // THE PROGRAMME TABLE THE UMPIRE ACTUALLY WORKS FROM. Read out of the
    // shipped engine rather than restated here, so nothing on this side can
    // hold a second opinion of what a session is made of - and so a test can
    // check the ARITHMETIC of a focus instead of memorising one programme's
    // fractions, which go stale the moment a programme gains a skill.
    trainProgs() {
      try { return JSON.parse(JSON.stringify(vm.runInContext('window.FO_TRAIN_PROGS', eng.ctx))); }
      catch (e) { return null; }
    },
    // recompute bat/threat/control/rating/wage from skills, engine's own map
    derive(players) { return JSON.parse(der(JSON.stringify(players))); },
    // a year's decline on a squad, by the engine's per-attribute ageing curve.
    // The caller has already put the year on them; this says what it cost.
    ageDecline(players) { return JSON.parse(aged(JSON.stringify(players))); },
    // a measurement handle, not a setting: scales every ageing rate inside this
    // VM so an audit can bisect the decline against the world's stationarity.
    // Nothing in the product calls it.
    tuneAgeing(f) {
      vm.runInContext('(function(f){var C=window.foAgeDecay;for(var k in C)C[k].rate*=f;})(' + (+f) + ')', eng.ctx);
    },
    // the 0-99 card rating the club pages show, per player
    pkOvr(players) { return JSON.parse(ovr(JSON.stringify(players))); },
    // the batting and bowling composites the ten-star strip is drawn from
    starComp(players) { return JSON.parse(scomp(JSON.stringify(players))); },
    // ---- B2 canonical player model, straight off the shipped engine --------
    // The umpire, the audits and the tests all read the SAME functions the
    // phones run. Nothing on this side of the wire holds a second opinion about
    // how good a cricketer is.
    playerValue(p) { return JSON.parse(pval(JSON.stringify(p))); },
    // real cricketers moved to a chosen overall with their shape intact, which
    // is what lets a parity suite walk the whole length of the scale
    fitToOvr(players, ovr) { return JSON.parse(fit(JSON.stringify(players), ovr)); },
    // an existing squad laid on a tier's own curve of overalls - the generator's
    // own laying, run on men who already have names and careers
    layOnTier(players, tier, seed) { return JSON.parse(lay(JSON.stringify(players), tier, seed)); },
    // and a man put back on a canonical LEVEL he already had, which is how a
    // change of shape is kept from becoming a change of quality
    fitToLevel(players, level) { return JSON.parse(fitL(JSON.stringify(players), level)); },
    ovrLabel(v) { return lbl(v); },
    // where a man of this age stands relative to his own peak, off the engine's
    // own career phase table - the audits need it to tell an older world from a
    // poorer one
    agePhase(age) { return vm.runInContext('window.foAgePhase', eng.ctx)(age); },
    stars(v) { return sts(v); },
    // the client's own fantasy points for a set of innings
    fantasy(innings) { return JSON.parse(fan(JSON.stringify(innings))); },
    // the client's own match rating for one side of a banked card
    teamRatings(result, teamName) { return JSON.parse(tmr(JSON.stringify(result), teamName)); },
    // returns the canonical result JSON STRING — stored verbatim, compared verbatim
    runMatch(homeTeam, awayTeam, pitch, seed, ordersMap, weather, neutral) {
      return run(JSON.stringify(homeTeam), JSON.stringify(awayTeam), pitch, seed,
        ordersMap ? JSON.stringify(ordersMap) : null, weather || 'Sunny', !!neutral);
    },
    // how many triggers each talent takes to earn, straight off the engine
    talThresholds() { return JSON.parse(talT()); },
    // and whether a given man could ever develop a given talent
    talElig(player, t) { return !!talElig(JSON.stringify(player), t); },
    // the ball-by-ball of the match runMatch JUST played, read from the vm's
    // finished state - no re-simulation, no change to the canonical card
    lastMatchLog() { return JSON.parse(lastLog()); },
    // what the sky and the square will do for a given fixture - deterministic,
    // published in advance, identical on every device and on the umpire
    condFor(rid, slot, seasonNo, round) { return JSON.parse(cond(rid, slot, seasonNo, round)); },
    // the sheet an unmanaged club's identity writes - the theatre reads the
    // very same table, so a replayed broadcast files the same doctrine
    doctrineFor(rid, slot) { return JSON.parse(doct(rid, slot)); },
    // the 19 nations as the shipped client defines them
    worldConfig() { return JSON.parse(cfg()); }
  };
}
