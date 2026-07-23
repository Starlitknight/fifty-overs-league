// Living World — Phase 0: the deterministic timeline core.
// Locks the invariants the whole shared world rests on.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REGIONS, THORNE_ID, SEASON_DAYS, MATCH_DAYS, LEAGUE_ROUNDS, LEAGUE_SIZE,
  dayState, buildWorld, buildLeague, roundRobin, circleRounds, playLeague,
  cupField, drawGroups, playCup, seasonCup, ageRoster, phaseOf
} from "../engine/src/world/timeline.mjs";

// a deterministic, injectable "match": the stronger side wins, else a tie.
const byStrength = (h, a) => ({ winner: h.strength === a.strength ? null : (h.strength > a.strength ? h.id : a.id) });

test("world build is deterministic (same seed => identical)", () => {
  assert.equal(JSON.stringify(buildWorld(12345)), JSON.stringify(buildWorld(12345)));
  assert.notEqual(JSON.stringify(buildWorld(12345)), JSON.stringify(buildWorld(999)));
});

test("19 leagues, each fixed at 8 with exactly one permanent boss", () => {
  const w = buildWorld(7);
  assert.equal(w.leagues.length, 19);
  for (const lg of w.leagues) {
    assert.equal(lg.teams.length, LEAGUE_SIZE);
    assert.equal(lg.teams.filter(t => t.kind === "boss").length, 1);
  }
});

test("the calendar alternates league / cup over a 30-day season", () => {
  assert.equal(SEASON_DAYS, 30);
  assert.equal(MATCH_DAYS, 28);
  const phases = Array.from({ length: 30 }, (_, d) => dayState(d).phase);
  // even match days league, odd match days cup, last two break
  for (let d = 0; d < 28; d++) assert.equal(phases[d], d % 2 === 0 ? "league" : "cup");
  assert.equal(phases[28], "break");
  assert.equal(phases[29], "break");
  // 14 league rounds + 14 cup slots
  assert.equal(phases.filter(p => p === "league").length, 14);
  assert.equal(phases.filter(p => p === "cup").length, 14);
  assert.equal(dayState(0).round, 0);
  assert.equal(dayState(26).round, 13);          // last league round
  assert.equal(dayState(SEASON_DAYS).season, 1); // next season begins
});

test("the cup calendar ends on the final and carries all 9 rounds", () => {
  const stages = Array.from({ length: 14 }, (_, s) => dayState(1 + s * 2).stage);
  assert.equal(stages[0], "g0");
  assert.equal(stages[13], "final");             // final on the last cup day
  assert.deepEqual(stages.filter(s => s.startsWith("g")), ["g0", "g1", "g2", "g3", "g4"]);
  assert.ok(["qf", "sf", "third", "final"].every(k => stages.includes(k)));
});

test("league is a proper double round-robin (home & away)", () => {
  const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const rounds = roundRobin(ids);
  assert.equal(rounds.length, LEAGUE_ROUNDS);
  const seen = new Map(); let games = 0;
  for (const rd of rounds) for (const [h, a] of rd) { games++; const k = h + ">" + a; seen.set(k, (seen.get(k) || 0) + 1); assert.equal(seen.get(k), 1); }
  assert.equal(games, ids.length * (ids.length - 1));  // 56
});

test("a group is a single round-robin of five (10 matches, 5 rounds)", () => {
  const rounds = circleRounds(["a", "b", "c", "d", "e"]);
  assert.equal(rounds.length, 5);
  const games = rounds.reduce((n, rd) => n + rd.length, 0);
  assert.equal(games, 10);                        // C(5,2)
});

test("cup field is last season's 19 winners + Thorne; season 0 = the bosses", () => {
  const f0 = cupField(7, 0, byStrength);
  assert.equal(f0.length, 20);
  assert.equal(f0[0].id, THORNE_ID);
  assert.ok(f0.slice(1).every(t => t.id.endsWith("-boss")));   // season 0 = bosses
  const f1 = cupField(7, 1, byStrength);
  assert.equal(f1.length, 20);
  assert.equal(new Set(f1.map(t => t.id)).size, 20);           // 20 distinct entrants
});

test("the cup draws four groups of five, deterministically", () => {
  const field = cupField(3, 0, byStrength);
  const g1 = drawGroups(field, 3, 0), g2 = drawGroups(field, 3, 0);
  assert.equal(g1.length, 4);
  assert.ok(g1.every(g => g.length === 5));
  assert.equal(g1.flat().length, 20);
  assert.equal(new Set(g1.flat().map(t => t.id)).size, 20);    // no team in two groups
  assert.equal(JSON.stringify(g1), JSON.stringify(g2));        // deterministic draw
});

test("Thorne beats every AI team and wins every Cup", () => {
  for (const seed of [1, 2, 3, 99, 12345]) {
    const cup = seasonCup(seed, 0, byStrength);
    assert.equal(cup.champion, THORNE_ID, "Thorne must win at seed " + seed);
    // and 20 distinct teams reached the groups, top 2 each advanced to 8
    assert.equal(cup.groups.length, 4);
    assert.ok(cup.groups.every(g => g.length === 5));
  }
});

test("a human, however, CAN end Thorne's reign", () => {
  const field = cupField(5, 1, byStrength);
  const hero = field.find(t => t.id !== THORNE_ID);
  hero.human = true; hero.strength = 1000;
  const beat = (a, b) => ({ winner: a.strength >= b.strength ? a.id : b.id });
  const cup = playCup(field, 5, 1, beat);
  assert.equal(cup.champion, hero.id);
});

test("cup yields a champion, runner-up and third, all distinct", () => {
  const cup = seasonCup(42, 0, byStrength);
  assert.equal(cup.champion, THORNE_ID);
  assert.notEqual(cup.runnerUp, cup.champion);
  assert.notEqual(cup.third, cup.champion);
  assert.notEqual(cup.third, cup.runnerUp);
});

test("the world ages: players get older, veterans retire, youth arrive", () => {
  const team = buildLeague(7, REGIONS[0], 0).teams[0];
  const before = team.roster.length;
  let roster = team.roster;
  for (let s = 1; s <= 10; s++) roster = ageRoster(roster, 7, team.id, s);
  assert.equal(roster.length, before);                    // squad renews, never balloons/vanishes
  assert.ok(roster.every(p => p.age < 38));
  assert.ok(roster.some(p => phaseOf(p.age) === "prospect" || phaseOf(p.age) === "rising"));
  // determinism
  assert.equal(JSON.stringify(ageRoster(team.roster, 7, team.id, 1)), JSON.stringify(ageRoster(team.roster, 7, team.id, 1)));
});
