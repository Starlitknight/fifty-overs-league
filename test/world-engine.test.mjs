// Living World — Phase 0 slice: the bot world plays REAL matches.
// Proves the timeline's world teams resolve through the actual match engine,
// deterministically, and that squad strength shows up on the scoreboard.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeEngine } from "./engine-vm.mjs";
import { buildLeague, roundRobin, REGIONS } from "../engine/src/world/timeline.mjs";
import { makeWorldResultFn, materialiseSquad } from "../engine/src/world/match.mjs";

// one shared engine host (loads the shipped game once, ~1-2s)
const E = makeEngine();

test("a world team materialises into a real engine squad", () => {
  const team = buildLeague(7, REGIONS[0], 0).teams[0];   // England boss
  const sq = materialiseSquad(E, team);
  assert.ok(sq && sq.players.length >= 11);
  const p = sq.players[0];
  for (const k of ["bat", "threat", "control", "field", "skills"]) assert.ok(k in p, "player missing " + k);
});

test("two world teams play a REAL full match with a true scorecard", () => {
  const lg = buildLeague(7, REGIONS[0], 0);
  const res = makeWorldResultFn(E);
  const r = res(lg.teams[0], lg.teams[1], { round: 0 });
  assert.ok(r.result && typeof r.result.text === "string");
  assert.equal(r.innings.length, 2);
  for (const inn of r.innings) {
    assert.ok(inn.runs >= 40 && inn.runs <= 500, "innings runs plausible: " + inn.runs);
    assert.ok(inn.legal > 0);
  }
  assert.ok([lg.teams[0].id, lg.teams[1].id, null].includes(r.winner));
});

test("the real match is deterministic (same teams+slot => identical)", () => {
  const lg = buildLeague(3, REGIONS[6], 0);   // Australia
  const a = makeWorldResultFn(E)(lg.teams[0], lg.teams[3], { round: 2 });
  const b = makeWorldResultFn(E)(lg.teams[0], lg.teams[3], { round: 2 });
  assert.deepEqual(a.innings, b.innings);
  assert.equal(a.winner, b.winner);
  assert.equal(a.result.text, b.result.text);
});

test("squad strength shows up on the scoreboard: a strong side dominates a weak one", () => {
  const lg = buildLeague(11, REGIONS[9], 0);  // India
  const strong = { ...lg.teams[1], strength: 84 };
  const weak = { ...lg.teams[2], strength: 42 };
  const res = makeWorldResultFn(E);
  let strongWins = 0, n = 16;   // cricket is high-variance; a real sample settles it
  for (let i = 0; i < n; i++) if (res(strong, weak, { round: i }).winner === strong.id) strongWins++;
  assert.ok(strongWins >= 12, "a much stronger side should win the clear majority, won " + strongWins + "/" + n);
});

test("end-to-end: a full league round resolves through the real engine", () => {
  const lg = buildLeague(21, REGIONS[0], 0);
  const res = makeWorldResultFn(E);
  const round0 = roundRobin(lg.teams.map(t => t.id))[0];   // 4 fixtures
  const ids = new Set(lg.teams.map(t => t.id));
  let played = 0;
  for (const [hId, aId] of round0) {
    const h = lg.teams.find(t => t.id === hId), a = lg.teams.find(t => t.id === aId);
    const r = res(h, a, { round: 0 });
    assert.ok(r.result, "fixture produced a result");
    assert.ok(r.winner === null || ids.has(r.winner));
    played++;
  }
  assert.equal(played, 4);
});
