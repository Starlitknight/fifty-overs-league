// enginehost.mjs — ONE ENGINE, TWO HOSTS (BLUEPRINT law 3). Loads the exact
// shipped build through test/engine-vm.mjs (proven bit-identical to the
// browser) and exposes deterministic squad generation + match execution.
// No forked logic: everything cricket happens inside the shipped engine.
import vm from 'node:vm';
import { makeEngine } from '../test/engine-vm.mjs';

// bumps ONLY with a new calibration golden. v2: diminishing returns on skill
// far from average (skill_soft) + rpo recalibration + designed league ladder -
// the change that capped favourites near reality's ~88% instead of 99.8%.
export const ENGINE_VERSION = 'v2';

export function makeHost() {
  const eng = makeEngine();
  eng.setTuning(true);
  vm.runInContext(`
globalThis.__svcGenSquad = function (seed, country, arch, capt, strength) {
  // strength is the club's standing in its league: the flagship's is the highest
  // in the nation, and the rest spread below it. Omitted means the one shared
  // budget every human manager founds on.
  var g = __foGenArchetypeSquad(seed, country, arch, capt || 'general', null,
    (typeof strength === 'number' && strength > 0) ? strength : 1);
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
globalThis.__svcTrain = function (playersJson, planJson, rate) {
  var players = JSON.parse(playersJson), plan = JSON.parse(planJson || '{}');
  var RATE = (typeof rate === 'number' && isFinite(rate) && rate > 0) ? rate : 1;
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
          + (p.age <= 20 ? 2 : p.age <= 24 ? 1 : 0) + ((p.rating > 3600) ? 1 : 0);
    return v >= 4 ? 1.30 : v >= 3 ? 1.15 : v >= 1 ? 1 : 0.80;
  };
  var ageFactor = function (a) { return a <= 20 ? 1.35 : a <= 24 ? 1.15 : a <= 29 ? 0.90 : a <= 32 ? 0.55 : 0.25; };
  var fresh = function (p) {
    var w = String((p.fatWord || p.fatigue || 'rested')).toLowerCase();
    var ix = LADDER.indexOf(w); if (ix < 0) ix = 0;
    return FATF[Math.max(0, Math.min(10, 10 - ix))];
  };
  var thresh = function (v) { return 80 + (+v || 0) * 1.5; };
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
  var gains = [];
  players.forEach(function (p) {
    var prog = plan[p.name] || defaultProg(p);
    if (prog === 'Rest' || !PROGS[prog]) return;
    var pts = 24 * ageFactor(p.age || 27) * potFactor(p) * fresh(p) * RATE * intensityOf(p);
    if (prog === 'All-rounder') pts *= 0.85;
    var w = PROGS[prog], total = 0;
    for (var k in w) total += w[k];
    if (!total) return;
    p.trainProgress = p.trainProgress || {};
    for (var sk in w) {
      if (!p.skills || p.skills[sk] === undefined) continue;
      p.trainProgress[sk] = (p.trainProgress[sk] || 0) + pts * w[sk] / total;
      var th = thresh(p.skills[sk]);
      while (p.trainProgress[sk] >= th && p.skills[sk] < 96) {
        p.trainProgress[sk] -= th;
        p.skills[sk]++;
        jsDerive(p);
        gains.push({ name: p.name, skill: sk, to: p.skills[sk] });
        th = thresh(p.skills[sk]);
      }
    }
  });
  return JSON.stringify({ players: players, gains: gains });
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
// the card's overall rating, straight from the shipped engine - the served
// club pages compute this in SQL (migration 016) and the tests hold the two
// to the same answer
globalThis.__svcOvr = function (playersJson) {
  var ps = JSON.parse(playersJson);
  return JSON.stringify(ps.map(function (p) {
    try { return window.foPkOvr(p); } catch (e) { return null; }
  }));
};
globalThis.__svcRun = function (homeJson, awayJson, pitch, seed, ordersJson, weather) {
  var home = JSON.parse(homeJson), away = JSON.parse(awayJson);
  onMatchEnd = function () {};
  M = newMatch(home, away, pitch, (seed >>> 0) || 1);
  // weather rides into the same meta the client's own matches use - Overcast
  // swings, Drizzle can cut overs and revise the chase by DLS, heat tires
  M.meta = { home: home.name, away: away.name, pitch: pitch, weather: weather || 'Sunny', comp: 'world', isUser: false };
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
  var slim = function (inn) {
    if (!inn) return null;
    return { batTeam: inn.batTeam, bowlTeam: inn.bowlTeam, runs: inn.runs, wkts: inn.wkts, legal: inn.legal,
      bat: (inn.bat || []).map(function (b) {
        return { p: b.p, r: b.r, b: b.b, f4: b.f4 || 0, f6: b.f6 || 0, out: b.out };
      }),
      bowlers: inn.bowlers, fielding: inn.fielding || {} };
  };
  // canonical result: fixed key order, no floats beyond engine output
  return JSON.stringify({
    winner: M.result ? M.result.winner : null,
    text: M.result ? M.result.text : '',
    mom: M.result ? M.result.mom : null,
    innings: [slim(M.innings[0]), slim(M.innings[1])],
    worm: M.worm
  });
};
// THE COMMENTARY OF THE MATCH JUST PLAYED. __svcRun leaves the finished match
// in M; this reads its ball-by-ball out without re-running a single delivery
// and without touching the canonical result - the log is banked BESIDE the
// card (match_logs, kept a week), never inside it, so nothing about the
// canonical shape or the golden-master replays moves an inch.
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
  // sixteen nations: the same cut the planet makes (wal/ken/can left the top
  // table) - sidesOf below already refuses to know them, but the region list
  // itself must agree or the server would found ghost leagues
  var CUT = { wal: 1, ken: 1, can: 1 };
  var regions = (window.__foCxAPI.regions() || []).filter(function (r) { return !r.final && !CUT[r.id]; });
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
  const cfg = vm.runInContext('__svcWorldCfg', eng.ctx);
  const cond = vm.runInContext('__svcCond', eng.ctx);
  const doct = vm.runInContext('__svcDoctrine', eng.ctx);
  const train = vm.runInContext('__svcTrain', eng.ctx);
  const der = vm.runInContext('__svcDerive', eng.ctx);
  const ovr = vm.runInContext('__svcOvr', eng.ctx);
  const fan = vm.runInContext('__svcFantasy', eng.ctx);
  const tmr = vm.runInContext('__svcTeamRatings', eng.ctx);
  return {
    genSquad(seed, country, arch, capt, strength) { return JSON.parse(gen(seed, country, arch, capt, strength)); },
    // one round in the nets for a whole squad, by the shipped engine's numbers,
    // at the rate the club's academy buys (1 = a level-two academy)
    trainRound(players, plan, rate) { return JSON.parse(train(JSON.stringify(players), JSON.stringify(plan || {}), rate)); },
    // recompute bat/threat/control/rating/wage from skills, engine's own map
    derive(players) { return JSON.parse(der(JSON.stringify(players))); },
    // the 0-99 card rating the club pages show, per player
    pkOvr(players) { return JSON.parse(ovr(JSON.stringify(players))); },
    // the client's own fantasy points for a set of innings
    fantasy(innings) { return JSON.parse(fan(JSON.stringify(innings))); },
    // the client's own match rating for one side of a banked card
    teamRatings(result, teamName) { return JSON.parse(tmr(JSON.stringify(result), teamName)); },
    // returns the canonical result JSON STRING — stored verbatim, compared verbatim
    runMatch(homeTeam, awayTeam, pitch, seed, ordersMap, weather) {
      return run(JSON.stringify(homeTeam), JSON.stringify(awayTeam), pitch, seed,
        ordersMap ? JSON.stringify(ordersMap) : null, weather || 'Sunny');
    },
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
