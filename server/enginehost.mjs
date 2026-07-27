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
globalThis.__svcRun = function (homeJson, awayJson, pitch, seed) {
  var home = JSON.parse(homeJson), away = JSON.parse(awayJson);
  onMatchEnd = function () {};
  M = newMatch(home, away, pitch, (seed >>> 0) || 1);
  M.meta = { home: home.name, away: away.name, pitch: pitch, weather: 'Sunny', comp: 'world', isUser: false };
  M.isUserMatch = false; M.ordersMap = {};
  App.tossState = { stage: 'x' };
  applyToss(aiTossDecision());
  var g = 0;
  while (M && !M.done && g++ < 4000) { autoPick(); stepBall(); }
  if (!M || !M.done) return null;
  var slim = function (inn) {
    if (!inn) return null;
    return { batTeam: inn.batTeam, bowlTeam: inn.bowlTeam, runs: inn.runs, wkts: inn.wkts, legal: inn.legal,
      bat: (inn.bat || []).map(function (b) { return { p: b.p, r: b.r, b: b.b, out: b.out }; }),
      bowlers: inn.bowlers };
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
  return {
    genSquad(seed, country, arch, capt) { return JSON.parse(gen(seed, country, arch, capt)); },
    // returns the canonical result JSON STRING — stored verbatim, compared verbatim
    runMatch(homeTeam, awayTeam, pitch, seed) {
      return run(JSON.stringify(homeTeam), JSON.stringify(awayTeam), pitch, seed);
    },
    // the 19 nations as the shipped client defines them
    worldConfig() { return JSON.parse(cfg()); }
  };
}
