// Living World — Phase 0 slice 1: the deterministic timeline core.
// Proves the invariants the whole shared world rests on.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REGIONS, THORNE_ID, SEASON_DAYS, LEAGUE_ROUNDS, LEAGUE_FLOOR,
  dayState, buildWorld, buildLeague, roundRobin, playLeague,
  championsCupField, playCup, ageRoster, phaseOf
} from "../engine/src/world/timeline.mjs";

// a deterministic, injectable "match": the stronger side wins, ties on a dead
// heat. No RNG, so the whole world is reproducible from the seed alone.
const byStrength = (h, a) => ({ winner: h.strength === a.strength ? null : (h.strength > a.strength ? h.id : a.id) });

test("world is deterministic: same seed => identical build", () => {
  const a = JSON.stringify(buildWorld(12345, 0));
  const b = JSON.stringify(buildWorld(12345, 0));
  assert.equal(a, b);
  assert.notEqual(a, JSON.stringify(buildWorld(999, 0)));
});

test("there are 19 region leagues, each at the team floor with one boss", () => {
  const w = buildWorld(7, 0);
  assert.equal(w.leagues.length, 19);
  assert.equal(REGIONS.length, 19);
  for (const lg of w.leagues) {
    assert.equal(lg.teams.length, LEAGUE_FLOOR);
    assert.equal(lg.teams.filter(t => t.kind === "boss").length, 1);
  }
});

test("each league is a proper double round-robin (home & away)", () => {
  const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const rounds = roundRobin(ids);
  assert.equal(rounds.length, LEAGUE_ROUNDS);           // 2*(8-1)
  // every ordered pair (home,away) appears exactly once => each unordered pair
  // is played twice with venues reversed
  const seen = new Map();
  let games = 0;
  for (const rd of rounds) for (const [h, a] of rd) {
    games++;
    const k = h + ">" + a;
    seen.set(k, (seen.get(k) || 0) + 1);
    assert.equal(seen.get(k), 1, "duplicate fixture " + k);
  }
  assert.equal(games, ids.length * (ids.length - 1));   // 56
  for (const h of ids) for (const a of ids) if (h !== a) assert.ok(seen.has(h + ">" + a), "missing " + h + ">" + a);
});

test("a league resolves to a full table and a single winner", () => {
  const lg = buildLeague(7, REGIONS[0], 0);
  const { standings, winner } = playLeague(lg, byStrength);
  assert.equal(standings.length, LEAGUE_FLOOR);
  const totalP = standings.reduce((n, r) => n + r.P, 0);
  assert.equal(totalP, LEAGUE_FLOOR * (LEAGUE_FLOOR - 1) * 2 / 1); // each game adds 2 P... check below
  // each of the 56 games contributes to two teams' P
  assert.equal(totalP, 56 * 2);
  assert.equal(standings[0].id, winner);
});

test("the calendar maps days to league / cup / rollover phases", () => {
  assert.deepEqual(dayState(0), { season: 0, dayInSeason: 0, phase: "league", round: 0 });
  assert.equal(dayState(LEAGUE_ROUNDS - 1).phase, "league");
  assert.equal(dayState(LEAGUE_ROUNDS).phase, "cup");
  assert.equal(dayState(SEASON_DAYS - 1).phase, "rollover");
  assert.equal(dayState(SEASON_DAYS).season, 1);        // next season begins
  assert.equal(dayState(SEASON_DAYS).phase, "league");
});

test("Champions Cup field is every league winner plus Thorne", () => {
  const w = buildWorld(42, 0);
  const field = championsCupField(w, byStrength);
  assert.equal(field.length, 20);                       // 19 winners + Thorne
  assert.equal(field[0].id, THORNE_ID);                 // Thorne seeded first
  assert.equal(field.filter(t => t.id === THORNE_ID).length, 1);
});

test("Thorne cannot be beaten by AI — he wins every Cup", () => {
  for (const seed of [1, 2, 3, 99, 12345]) {
    const w = buildWorld(seed, 0);
    const field = championsCupField(w, byStrength);
    const { champion } = playCup(field, byStrength);
    assert.equal(champion, THORNE_ID, "Thorne must win at seed " + seed);
  }
});

test("a human, however, CAN end Thorne's reign", () => {
  const w = buildWorld(5, 0);
  const field = championsCupField(w, byStrength);
  // promote the top non-Thorne seed to a superhuman human side
  field[1].human = true; field[1].strength = 1000;
  const beatThorne = (a, b) => ({ winner: a.strength >= b.strength ? a.id : b.id });
  const { champion } = playCup(field, beatThorne);
  assert.equal(champion, field[1].id);
});

test("the world ages: players get older, veterans retire, youth arrive", () => {
  const lg = buildLeague(7, REGIONS[0], 0);
  const team = lg.teams[0];
  const before = team.roster.length;
  let roster = team.roster;
  // age ten seasons; the squad must renew, never vanish or balloon
  for (let s = 1; s <= 10; s++) roster = ageRoster(roster, 7, team.id, s);
  assert.equal(roster.length, before, "squad size holds through renewal");
  // no one is impossibly old, and the cohort has turned over
  assert.ok(roster.every(p => p.age < 38));
  assert.ok(roster.some(p => phaseOf(p.age) === "prospect" || phaseOf(p.age) === "rising"));
});

test("ageing is deterministic", () => {
  const lg = buildLeague(7, REGIONS[0], 0);
  const r1 = JSON.stringify(ageRoster(lg.teams[0].roster, 7, lg.teams[0].id, 1));
  const r2 = JSON.stringify(ageRoster(lg.teams[0].roster, 7, lg.teams[0].id, 1));
  assert.equal(r1, r2);
});
