// ===========================================================================
//  The Living World — deterministic timeline core (Phase 0, slice 1)
//
//  The whole bot world is a PURE FUNCTION of (worldSeed, day). Given a seed and
//  a global day index this module can tell you the season, the phase, every
//  region league's fixtures and standings, the Champions Cup bracket, and how
//  the world has aged — identically for every player, with no server and no
//  live simulation. Match RESULTS are injected (a callback), so this scaffolding
//  is testable in pure Node now and plugs into the real match engine later.
//
//  Design invariants (verified in test/world-timeline.test.mjs):
//   - determinism: same (seed, day) => byte-identical world
//   - each league is a proper double round-robin (home & away)
//   - the Champions Cup field is every league winner + Thorne
//   - Thorne cannot be beaten by AI (he wins every Cup until a human enters)
//   - the world ages each season: players age, decline, and retire
// ===========================================================================

// ---- seeded PRNG (mulberry32) — no Math.random anywhere in the world path ---
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// a stable 32-bit hash so any (seed, ...labels) pair yields its own stream
export function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function stream(seed, ...parts) { return rng(hash32(seed + "|" + parts.join("|"))); }

// ---- the 19 nations + Thorne (ids/names/bosses mirror FO_CX_REGIONS) --------
export const REGIONS = [
  { id: "eng", name: "England", boss: "Sir Giles Pemberley", arch: "master" },
  { id: "ire", name: "Ireland", boss: "Declan Moriarty", arch: "clutch" },
  { id: "ned", name: "Netherlands", boss: "Pieter van Doorn", arch: "general" },
  { id: "win", name: "West Indies", boss: "King Emmanuel", arch: "talisman" },
  { id: "rsa", name: "South Africa", boss: "Morné Steenkamp", arch: "ironman" },
  { id: "zim", name: "Zimbabwe", boss: "Tatenda Gumbo", arch: "younggun" },
  { id: "aus", name: "Australia", boss: "Doug Cazaly", arch: "general" },
  { id: "nzl", name: "New Zealand", boss: "Kane Whitcombe", arch: "clutch" },
  { id: "slk", name: "Sri Lanka", boss: "Chaminda Silva", arch: "talisman" },
  { id: "sub", name: "India", boss: "Vikram Anand", arch: "talisman" },
  { id: "pak", name: "Pakistan", boss: "Shaheen Raza", arch: "talisman" },
  { id: "afg", name: "Afghanistan", boss: "Rashid Zadran", arch: "younggun" },
  { id: "bgd", name: "Bangladesh", boss: "Farhan Chowdhury", arch: "wizard" },
  { id: "nep", name: "Nepal", boss: "Sandeep Rana", arch: "younggun" },
  { id: "sco", name: "Scotland", boss: "Angus MacLeod", arch: "ironman" },
  { id: "wal", name: "Wales", boss: "Gareth Llewellyn", arch: "clutch" },
  { id: "ken", name: "Kenya", boss: "David Otieno", arch: "talisman" },
  { id: "usa", name: "United States", boss: "Tyler Brooks", arch: "general" },
  { id: "can", name: "Canada", boss: "Marcus Dhillon", arch: "clutch" }
];
export const THORNE_ID = "thorne";

// ---- calendar ---------------------------------------------------------------
// One fixture-round resolves per real day. An 8-team double round-robin is 14
// rounds; then the Champions Cup knockout; then a rollover day (ageing).
export const LEAGUE_FLOOR = 8;
export const LEAGUE_ROUNDS = 2 * (LEAGUE_FLOOR - 1);   // 14
export const CUP_DAYS = 5;                             // 20-team knockout w/ byes
export const SEASON_DAYS = LEAGUE_ROUNDS + CUP_DAYS + 1; // +1 rollover day

export function dayState(day) {
  const season = Math.floor(day / SEASON_DAYS);
  const d = day % SEASON_DAYS;
  if (d < LEAGUE_ROUNDS) return { season, dayInSeason: d, phase: "league", round: d };
  if (d < LEAGUE_ROUNDS + CUP_DAYS) return { season, dayInSeason: d, phase: "cup", cupDay: d - LEAGUE_ROUNDS };
  return { season, dayInSeason: d, phase: "rollover" };
}

// ---- team & player generation (deterministic per seed+season) ---------------
const ROLES = ["opener", "opener", "top", "top", "middle", "middle", "allrounder",
  "keeper", "pace", "pace", "spin", "spin", "middle", "allrounder"];

function makePlayer(seed, teamId, i, season) {
  const r = stream(seed, "player", teamId, i, "s" + season);
  const role = ROLES[i % ROLES.length];
  // ages spread across a career; season shifts the cohort so the world ages
  const baseAge = 18 + Math.floor(r() * 17);            // 18..34
  const skill = 40 + Math.floor(r() * 55);              // 40..94
  return { id: teamId + "-p" + i, name: teamId.toUpperCase() + " " + (i + 1), role, age: baseAge, skill };
}

// career phase from age (prospect -> rising -> peak -> veteran -> twilight)
export function phaseOf(age) {
  if (age <= 21) return "prospect";
  if (age <= 25) return "rising";
  if (age <= 30) return "peak";
  if (age <= 33) return "veteran";
  return "twilight";
}

function makeTeam(seed, region, kind, name, idx, season) {
  const teamId = region.id + "-" + (kind === "boss" ? "boss" : "b" + idx);
  const roster = [];
  const n = 14;
  for (let i = 0; i < n; i++) roster.push(makePlayer(seed, teamId, i, season));
  // team strength = mean of the top XI skills, with a boss/style bump
  const top = roster.map(p => p.skill).sort((a, b) => b - a).slice(0, 11);
  let strength = top.reduce((a, b) => a + b, 0) / top.length;
  if (kind === "boss") strength += 6;   // the boss club is strong even league-nerfed
  return { id: teamId, regionId: region.id, kind, name, strength: Math.round(strength * 10) / 10, roster };
}

// Build a region's league for a given season: the boss club + bots to the floor.
export function buildLeague(seed, region, season) {
  const teams = [makeTeam(seed, region, "boss", region.boss + "'s XI", 0, season)];
  for (let i = 1; i < LEAGUE_FLOOR; i++) {
    teams.push(makeTeam(seed, region, "bot", region.name + " " + toClubName(seed, region, i), i, season));
  }
  return { regionId: region.id, name: region.name, season, teams };
}
function toClubName(seed, region, i) {
  const suff = ["Rovers", "United", "CC", "Strollers", "Wanderers", "Athletic", "Town", "County"];
  const r = stream(seed, "club", region.id, i);
  return suff[Math.floor(r() * suff.length)];
}

// Build the whole world for a season (19 leagues).
export function buildWorld(seed, season = 0) {
  return { seed, season, leagues: REGIONS.map(rg => buildLeague(seed, rg, season)) };
}

// ---- double round-robin fixtures (circle method) ----------------------------
export function roundRobin(teamIds) {
  const ids = teamIds.slice();
  if (ids.length % 2) ids.push(null);          // bye
  const n = ids.length, half = n / 2, rounds = [];
  const arr = ids.slice();
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < half; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      if (a != null && b != null) pairs.push(r % 2 ? [b, a] : [a, b]); // alternate home/away
    }
    rounds.push(pairs);
    arr.splice(1, 0, arr.pop());               // rotate, first fixed
  }
  // second leg: same pairings, venues reversed (home & away)
  const second = rounds.map(rd => rd.map(([a, b]) => [b, a]));
  return rounds.concat(second);
}

// ---- resolving a league via an injected result function --------------------
// resultFn(homeTeam, awayTeam, ctx) => { winner: teamId | null(tie) }
export function playLeague(league, resultFn) {
  const table = {};
  league.teams.forEach(t => { table[t.id] = { id: t.id, name: t.name, P: 0, W: 0, L: 0, T: 0, pts: 0, strength: t.strength }; });
  const byId = Object.fromEntries(league.teams.map(t => [t.id, t]));
  const rounds = roundRobin(league.teams.map(t => t.id));
  rounds.forEach((rd, ri) => rd.forEach(([hId, aId]) => {
    const res = resultFn(byId[hId], byId[aId], { competition: "league", regionId: league.regionId, round: ri });
    const h = table[hId], a = table[aId];
    h.P++; a.P++;
    if (res.winner === hId) { h.W++; a.L++; h.pts += 2; }
    else if (res.winner === aId) { a.W++; h.L++; a.pts += 2; }
    else { h.T++; a.T++; h.pts++; a.pts++; }
  }));
  const standings = Object.values(table).sort((x, y) =>
    y.pts - x.pts || y.W - x.W || y.strength - x.strength || (x.id < y.id ? -1 : 1));
  return { standings, winner: standings[0].id, rounds };
}

// ---- the Champions Cup: league winners + Thorne, Thorne unbeatable ----------
// A single-elimination bracket padded with byes to the next power of two, top
// seeds getting the byes. Thorne is seeded #1 and cannot lose to an AI team.
export function championsCupField(world, resultFn) {
  // seed by league-winning team strength; Thorne first, always.
  const winners = world.leagues.map(lg => {
    const { winner, standings } = playLeague(lg, resultFn);
    const t = lg.teams.find(x => x.id === winner);
    return { id: winner, name: t.name, strength: t.strength, human: false };
  });
  winners.sort((a, b) => b.strength - a.strength);
  const thorne = { id: THORNE_ID, name: "Thorne's Invincible XI", strength: 999, human: false };
  return [thorne, ...winners];
}

export function playCup(field, resultFn) {
  // pad to power of two with byes; top seeds (index 0..) get the byes
  let size = 1; while (size < field.length) size *= 2;
  const byes = size - field.length;
  let alive = field.slice();
  // give byes: the top `byes` seeds skip round 1 by pairing against a null
  const bracket = [];
  const roundLog = [];
  // simple sequential pairing after seeding (good enough for the deterministic
  // spine; true snake-seeding comes with the bracket-art phase)
  let round = alive.slice();
  // insert byes as nulls interleaved so top seeds advance free
  const padded = [];
  for (let i = 0; i < round.length; i++) {
    padded.push(round[i]);
    if (i < byes) padded.push(null);      // top `byes` seeds get a null opponent
  }
  round = padded;
  let rNo = 0;
  while (round.length > 1) {
    const next = [];
    const pairs = [];
    for (let i = 0; i < round.length; i += 2) {
      const a = round[i], b = round[i + 1] ?? null;
      pairs.push([a && a.id, b && b.id]);
      if (!a) { next.push(b); continue; }
      if (!b) { next.push(a); continue; }   // bye
      // Thorne is unbeatable by AI
      let winner;
      if (a.id === THORNE_ID && !b.human) winner = a;
      else if (b.id === THORNE_ID && !a.human) winner = b;
      else { const res = resultFn(a, b, { competition: "cup", round: rNo }); winner = res.winner === a.id ? a : b; }
      next.push(winner);
    }
    roundLog.push({ round: rNo, pairs });
    round = next; rNo++;
  }
  const champion = round[0];
  return { champion: champion.id, rounds: roundLog };
}

// ---- ageing: the whole world grows old at each rollover ---------------------
// Returns a NEW roster: age +1, retire the old, replace retirees with a youth.
export function ageRoster(roster, seed, teamId, season) {
  const kept = [];
  let youthN = 0;
  for (const p of roster) {
    const age = p.age + 1;
    // retirement: outfielders 35+, a soft chance 34+; keepers/spinners linger
    const retireAge = (p.role === "keeper" || p.role === "spin") ? 37 : 35;
    if (age >= retireAge) { youthN++; continue; }
    // decline past the peak
    const decline = age > 30 ? (age - 30) * 1.4 : 0;
    kept.push({ ...p, age, skill: Math.max(20, Math.round((p.skill - decline) * 10) / 10) });
  }
  // promote fresh prospects for every retiree
  for (let i = 0; i < youthN; i++) {
    const r = stream(seed, "youth", teamId, season, i);
    kept.push({ id: teamId + "-y" + season + "-" + i, name: teamId.toUpperCase() + " youth", role: ROLES[Math.floor(r() * ROLES.length)], age: 18 + Math.floor(r() * 3), skill: 42 + Math.floor(r() * 40) });
  }
  return kept;
}
