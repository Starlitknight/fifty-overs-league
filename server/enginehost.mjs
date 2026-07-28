// enginehost.mjs — ONE ENGINE, TWO HOSTS (BLUEPRINT law 3). Loads the exact
// shipped build through test/engine-vm.mjs (proven bit-identical to the
// browser) and exposes deterministic squad generation + match execution.
// No forked logic: everything cricket happens inside the shipped engine.
import vm from 'node:vm';
import { makeEngine } from '../test/engine-vm.mjs';

export const ENGINE_VERSION = 'v1';   // bumps ONLY with a new calibration golden

export function makeHost() {
  const eng = makeEngine();
  eng.setTuning(true);
  vm.runInContext(`
globalThis.__svcGenSquad = function (seed, country, arch, capt) {
  var g = __foGenArchetypeSquad(seed, country, arch, capt || 'general');
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
  var gains = [];
  players.forEach(function (p) {
    var prog = plan[p.name] || defaultProg(p);
    if (prog === 'Rest' || !PROGS[prog]) return;
    var pts = 24 * ageFactor(p.age || 27) * potFactor(p) * fresh(p) * RATE;
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
globalThis.__svcRun = function (homeJson, awayJson, pitch, seed, ordersJson) {
  var home = JSON.parse(homeJson), away = JSON.parse(awayJson);
  onMatchEnd = function () {};
  M = newMatch(home, away, pitch, (seed >>> 0) || 1);
  M.meta = { home: home.name, away: away.name, pitch: pitch, weather: 'Sunny', comp: 'world', isUser: false };
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
globalThis.__svcWorldCfg = function () {
  // the world's shape read from the SHIPPED build itself — regions, club
  // names and national hours come from the same code the phones run, so the
  // served world and the client planet can never drift apart
  var regions = (window.__foCxAPI.regions() || []).filter(function (r) { return !r.final; });
  return JSON.stringify(regions.map(function (r) {
    var boss = null; (r.clubs || []).forEach(function (c) { if (c.boss) boss = c; });
    return {
      id: r.id, name: r.nm, nat: (r.nats && r.nats[0]) || r.nm,
      arch: r.arch || 'rock', capt: (boss && boss.capt) || 'talisman',
      hour: window.__foPlanet.natHour(r.id),
      sides: window.__foPlanet.sidesOf(r.id).map(function (s) {
        return { slot: s.slot, name: s.name, city: s.city, boss: !!s.boss };
      })
    };
  }));
};`, eng.ctx);
  const gen = vm.runInContext('__svcGenSquad', eng.ctx);
  const run = vm.runInContext('__svcRun', eng.ctx);
  const cfg = vm.runInContext('__svcWorldCfg', eng.ctx);
  const train = vm.runInContext('__svcTrain', eng.ctx);
  const der = vm.runInContext('__svcDerive', eng.ctx);
  const ovr = vm.runInContext('__svcOvr', eng.ctx);
  const fan = vm.runInContext('__svcFantasy', eng.ctx);
  return {
    genSquad(seed, country, arch, capt) { return JSON.parse(gen(seed, country, arch, capt)); },
    // one round in the nets for a whole squad, by the shipped engine's numbers,
    // at the rate the club's academy buys (1 = a level-two academy)
    trainRound(players, plan, rate) { return JSON.parse(train(JSON.stringify(players), JSON.stringify(plan || {}), rate)); },
    // recompute bat/threat/control/rating/wage from skills, engine's own map
    derive(players) { return JSON.parse(der(JSON.stringify(players))); },
    // the 0-99 card rating the club pages show, per player
    pkOvr(players) { return JSON.parse(ovr(JSON.stringify(players))); },
    // the client's own fantasy points for a set of innings
    fantasy(innings) { return JSON.parse(fan(JSON.stringify(innings))); },
    // returns the canonical result JSON STRING — stored verbatim, compared verbatim
    runMatch(homeTeam, awayTeam, pitch, seed, ordersMap) {
      return run(JSON.stringify(homeTeam), JSON.stringify(awayTeam), pitch, seed,
        ordersMap ? JSON.stringify(ordersMap) : null);
    },
    // the 19 nations as the shipped client defines them
    worldConfig() { return JSON.parse(cfg()); }
  };
}
