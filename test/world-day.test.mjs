// Living World — Phase 0 slice 3: the day cursor + the Wire.
// Uses a fast deterministic stub result so we exercise the CURSOR logic
// (scheduling, standings, bracket, idempotency) without the engine.
import { test } from "node:test";
import assert from "node:assert/strict";
import { THORNE_ID, dayState, SEASON_DAYS, rng, hash32 } from "../engine/src/world/timeline.mjs";
import { newWorldState, advanceTo, viewDay, leagueStandings } from "../engine/src/world/day.mjs";
import { wireForDay } from "../engine/src/world/wire.mjs";

// stronger side usually wins, with a small seeded upset chance so tables spread
const stub = (h, a, ctx) => {
  const r = rng(hash32("m|" + h.id + "|" + a.id + "|" + (ctx.round ?? ctx.stage ?? "x")))();
  const p = 0.5 + ((h.strength - a.strength) / 40) * 0.5;
  return { winner: r < p ? h.id : a.id };
};

test("advancing a league day resolves every region's round into the tables", () => {
  const s = newWorldState(2026);
  advanceTo(s, 0, stub);                    // day 0 = league round 0
  const eng = leagueStandings(s, 0, "eng");
  assert.equal(eng.length, 8);
  const played = eng.reduce((n, r) => n + r.P, 0);
  assert.equal(played, 8);                  // 4 matches on round 0 => 8 team-appearances
  const v = viewDay(s, 0);
  assert.equal(v.phase, "league");
  assert.equal(v.fixtures.filter(f => f.regionId === "eng").length, 4);
});

test("the cursor is idempotent and deterministic", () => {
  const a = newWorldState(7); advanceTo(a, 26, stub);   // a full league season
  const b = newWorldState(7); advanceTo(b, 10, stub); advanceTo(b, 26, stub);
  assert.deepEqual(leagueStandings(a, 0, "eng"), leagueStandings(b, 0, "eng"));
  // re-advancing to an already-resolved day changes nothing
  const before = JSON.stringify(leagueStandings(a, 0, "eng"));
  advanceTo(a, 26, stub);
  assert.equal(JSON.stringify(leagueStandings(a, 0, "eng")), before);
});

test("a full league season fills every table (14 rounds, 56 games each)", () => {
  const s = newWorldState(9); advanceTo(s, 26, stub);   // day 26 = last league round
  const eng = leagueStandings(s, 0, "eng");
  assert.ok(eng.every(r => r.P === 14));
  assert.equal(eng.reduce((n, r) => n + r.P, 0), 8 * 14);
});

test("the Champions Cup resolves through the cursor and Thorne reigns", () => {
  const s = newWorldState(42);
  advanceTo(s, SEASON_DAYS - 1, stub);      // through the whole season incl. the final
  const cup = s.cups[0];
  assert.equal(cup.field.length, 20);
  assert.equal(cup.qualifiers.flat().length, 8);         // top 2 of four groups
  assert.equal(cup.champion, THORNE_ID);                 // Thorne wins
  assert.notEqual(cup.runnerUp, THORNE_ID);
  assert.notEqual(cup.third, cup.champion);
  assert.deepEqual(s.championsLog[0], { season: 0, champion: THORNE_ID, runnerUp: cup.runnerUp, third: cup.third });
});

test("the cursor runs multiple seasons; next Cup seeds from last season's winners", () => {
  const s = newWorldState(3);
  advanceTo(s, SEASON_DAYS * 2 - 1, stub);   // two full seasons
  assert.equal(s.championsLog.length, 2);
  assert.equal(s.cups[1].field.length, 20);
  // season 1's cup entrants are season 0's league winners (+ Thorne)
  const s0winners = new Set(Object.keys(s.leagues).filter(k => k.startsWith("0:")).map(k => leagueStandings(s, 0, k.split(":")[1])[0].id));
  const s1entrants = new Set(s.cups[1].field.filter(t => t.id !== THORNE_ID).map(t => t.id));
  for (const w of s0winners) assert.ok(s1entrants.has(w), "winner " + w + " should be in next Cup");
});

test("the Wire mines headlines from a day's real results", () => {
  const s = newWorldState(2026);
  advanceTo(s, SEASON_DAYS - 1, stub);
  const lg = wireForDay(s, 0);               // a league day
  assert.equal(lg.phase, "league");
  assert.ok(lg.headlines.length >= 1);
  assert.ok(lg.headlines.every(h => typeof h.headline === "string" && h.art));
  const fin = wireForDay(s, 27);             // the Champions Cup final day
  assert.equal(fin.phase, "cup");
  assert.ok(/Thorne|Champions|Crown/i.test(fin.headlines[0].headline), "final headline: " + fin.headlines[0].headline);
});
