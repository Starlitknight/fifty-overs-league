// ===========================================================================
//  The Living World — real-engine match binding
//
//  Turns the timeline's lightweight world teams (id, name, `gen` recipe) into
//  REAL matches: it materialises each team's engine-native squad from its `gen`
//  recipe and plays the two sides through the actual match engine, returning a
//  true result the league/cup can score. The engine host is INJECTED (anything
//  exposing genSquad + sim), so this module stays pure and testable.
//
//  In production the host is the shipped engine loaded once in a Node VM
//  (test/engine-vm.mjs::makeEngine today); bot matches run in pure Node in
//  milliseconds, so a whole day of the world is cheap to resolve.
// ===========================================================================
import { hash32 } from "./timeline.mjs";

// The quick-start archetypes are deliberately BALANCED (fair multiplayer), so
// archetype is style, not quality. A team's competitive quality instead comes
// from its `strength` — mapped to a small multiplier on the squad's combat
// ratings. ~62 is par; the spread stays modest so upsets remain possible.
export function strengthMult(strength) {
  const m = 1 + ((strength == null ? 62 : strength) - 62) * 0.006;
  return Math.max(0.88, Math.min(1.18, m));
}
function scaleSquad(base, team) {
  const m = strengthMult(team.strength);
  if (Math.abs(m - 1) < 1e-9) return { name: team.name, players: base.players };
  const players = base.players.map(p => ({
    ...p,
    bat: p.bat != null ? p.bat * m : p.bat,
    threat: p.threat != null ? p.threat * m : p.threat,
    control: p.control != null ? p.control * m : p.control,
    field: p.field != null ? p.field * m : p.field
  }));
  return { name: team.name, players };
}
function genOf(team) {
  return team.gen || { country: "England", archId: "balanced", captId: "general", seed: hash32(team.id) };
}

// Build a result function of the shape the timeline expects:
//   resultFn(homeTeam, awayTeam, ctx) => { winner: teamId|null, result, innings }
// Base squads are cached by their (per-team, per-season) gen seed; the strength
// scaling is applied per match, so a team is generated once per season.
export function makeWorldResultFn(engine, opts = {}) {
  const cache = opts.cache || new Map();
  function baseSquad(team) {
    const g = genOf(team);
    if (cache.has(g.seed)) return cache.get(g.seed);
    const sq = engine.genSquad(g.seed, g.country, g.archId, g.captId);
    const base = (sq && sq.players && sq.players.length) ? { players: sq.players } : null;
    cache.set(g.seed, base);
    return base;
  }
  return function worldResult(home, away, ctx = {}) {
    const bH = baseSquad(home), bA = baseSquad(away);
    if (!bH || !bA) return { winner: null };
    // sim with each side's unique id AS its name, so result.winner (a name)
    // maps back unambiguously even when two clubs share a generated club name
    const tH = scaleSquad(bH, home); tH.name = home.id;
    const tA = scaleSquad(bA, away); tA.name = away.id;
    // deterministic match seed: the pairing + the fixture slot
    const seed = hash32(home.id + "|" + away.id + "|" + (ctx.round ?? ctx.stage ?? "x"));
    const r = engine.sim(tH, tA, ctx.pitch || "balanced", ctx.weather || "Sunny", seed);
    if (!r || !r.result) return { winner: null };            // failed/tie => tie
    const w = r.result.winner;
    const winner = w === home.id ? home.id : (w === away.id ? away.id : null);
    return { winner, result: r.result, innings: r.innings, batFirst: r.batFirstTeam };
  };
}

// Materialise one team's real (strength-scaled) squad — for previews/lineups.
export function materialiseSquad(engine, team) {
  const g = genOf(team);
  const sq = engine.genSquad(g.seed, g.country, g.archId, g.captId);
  return sq && sq.players ? scaleSquad({ players: sq.players }, team) : null;
}
