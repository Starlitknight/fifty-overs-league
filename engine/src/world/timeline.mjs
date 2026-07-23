// ===========================================================================
//  The Living World — deterministic timeline core (Phase 0)
//
//  The whole bot world is a PURE FUNCTION of (worldSeed, day). Given a seed and
//  a global day index this module yields the season, the phase, every region
//  league's fixtures and table, the Champions Cup (groups + knockouts), and how
//  the world has aged — identically for every player, with no server and no
//  live simulation. Match RESULTS are injected (a callback), so this scaffolding
//  is testable in pure Node now and plugs into the real match engine later.
//
//  Calendar (30-day season): 28 match days ALTERNATE league / Champions Cup
//  (league on even days, cup on odd), then a 2-day break (rollover: ageing).
//  → 14 league rounds + 14 cup days + 2 break.
//
//  Champions Cup: 20 teams = the PREVIOUS season's 19 league winners + Thorne
//  (season 0 seeds the 19 bosses). Four groups of five, single round-robin, top
//  two advance → QF → SF → 3rd place → final. Thorne beats every AI team in
//  every cup match (groups included); only a human can end his reign.
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
export function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function stream(seed, ...parts) { return rng(hash32(seed + "|" + parts.join("|"))); }
function shuffle(arr, rnd) {   // deterministic Fisher-Yates
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---- the 19 nations (ids/names/bosses mirror FO_CX_REGIONS) + Thorne ---------
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
export const THORNE = { id: THORNE_ID, name: "Thorne's Invincible XI", strength: 999, human: false, kind: "thorne" };

// ---- calendar ---------------------------------------------------------------
export const LEAGUE_SIZE = 8;                       // boss + up to 7 humans/bots
export const LEAGUE_ROUNDS = 2 * (LEAGUE_SIZE - 1); // 14 (double round-robin)
export const MATCH_DAYS = 28;                       // 14 league + 14 cup, alternating
export const BREAK_DAYS = 2;
export const SEASON_DAYS = MATCH_DAYS + BREAK_DAYS; // 30
export const CUP_SLOTS = MATCH_DAYS / 2;            // 14
// which cup stage each of the 14 cup days carries; 9 match-rounds + 5 hype/rest
// days, the final on the last cup day so it climaxes the season.
export const CUP_STAGES = ["g0", "g1", "g2", "g3", "g4", "rest", "qf", "rest", "sf", "rest", "third", "rest", "rest", "final"];

export function dayState(day) {
  const season = Math.floor(day / SEASON_DAYS);
  const d = day % SEASON_DAYS;
  if (d >= MATCH_DAYS) return { season, dayInSeason: d, phase: "break" };
  if (d % 2 === 0) return { season, dayInSeason: d, phase: "league", round: d / 2 };
  const cupSlot = (d - 1) / 2;
  return { season, dayInSeason: d, phase: "cup", cupSlot, stage: CUP_STAGES[cupSlot] };
}

// ---- team & player generation (deterministic per seed+season) ---------------
const ROLES = ["opener", "opener", "top", "top", "middle", "middle", "allrounder",
  "keeper", "pace", "pace", "spin", "spin", "middle", "allrounder"];

function makePlayer(seed, teamId, i, season) {
  const r = stream(seed, "player", teamId, i, "s" + season);
  return {
    id: teamId + "-p" + i, name: teamId.toUpperCase() + " " + (i + 1),
    role: ROLES[i % ROLES.length], age: 18 + Math.floor(r() * 17), skill: 40 + Math.floor(r() * 55)
  };
}
export function phaseOf(age) {
  if (age <= 21) return "prospect";
  if (age <= 25) return "rising";
  if (age <= 30) return "peak";
  if (age <= 33) return "veteran";
  return "twilight";
}
function teamStrength(roster, bump) {
  const top = roster.map(p => p.skill).sort((a, b) => b - a).slice(0, 11);
  return Math.round((top.reduce((a, b) => a + b, 0) / top.length + bump) * 10) / 10;
}
// bot clubs cycle through a spread of engine archetypes for variety; the boss
// plays his region's signature style.
const BOT_ARCHES = ["balanced", "general", "clutch", "engine", "miser", "results", "community", "talisman"];

function makeTeam(seed, region, kind, name, idx, season) {
  const teamId = region.id + "-" + (kind === "boss" ? "boss" : "b" + idx);
  const roster = [];
  for (let i = 0; i < 14; i++) roster.push(makePlayer(seed, teamId, i, season));
  const archId = kind === "boss" ? region.arch : BOT_ARCHES[idx % BOT_ARCHES.length];
  // `gen` is the deterministic recipe for this team's REAL engine squad: the
  // world-timeline stays engine-free (just strings + a seed); the match adapter
  // materialises the full squad from it on demand.
  const gen = { country: region.name, archId, captId: "general", seed: hash32(teamId + "|s" + season) };
  return { id: teamId, regionId: region.id, kind, name, human: false, strength: teamStrength(roster, kind === "boss" ? 6 : 0), roster, gen };
}

// A region's league for a season: the boss (permanent) + bots to the 8-team size.
export function buildLeague(seed, region, season) {
  const teams = [makeTeam(seed, region, "boss", region.boss + "'s XI", 0, season)];
  for (let i = 1; i < LEAGUE_SIZE; i++) {
    const r = stream(seed, "club", region.id, i, season);
    const suff = ["Rovers", "United", "CC", "Strollers", "Wanderers", "Athletic", "Town", "County"];
    teams.push(makeTeam(seed, region, "bot", region.name + " " + suff[Math.floor(r() * suff.length)], i, season));
  }
  return { regionId: region.id, name: region.name, season, teams };
}
export function buildWorld(seed, season = 0) {
  return { seed, season, leagues: REGIONS.map(rg => buildLeague(seed, rg, season)) };
}

// ---- round-robin schedules (circle method) ----------------------------------
export function circleRounds(ids) {   // single round-robin rounds
  const a = ids.slice();
  if (a.length % 2) a.push(null);      // bye for odd fields
  const n = a.length, half = n / 2, rounds = [];
  const arr = a.slice();
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < half; i++) {
      const x = arr[i], y = arr[n - 1 - i];
      if (x != null && y != null) pairs.push(r % 2 ? [y, x] : [x, y]);
    }
    rounds.push(pairs);
    arr.splice(1, 0, arr.pop());        // rotate, first fixed
  }
  return rounds;
}
export function roundRobin(ids) {       // double (home & away)
  const first = circleRounds(ids);
  return first.concat(first.map(rd => rd.map(([x, y]) => [y, x])));
}

// ---- resolving a round-robin table via an injected result function ----------
// resultFn(homeTeam, awayTeam, ctx) => { winner: teamId | null(tie) }
function tableFrom(teams) {
  const t = {};
  teams.forEach(x => { t[x.id] = { id: x.id, name: x.name, P: 0, W: 0, L: 0, T: 0, pts: 0, strength: x.strength }; });
  return t;
}
function record(table, hId, aId, winner) {
  const h = table[hId], a = table[aId]; h.P++; a.P++;
  if (winner === hId) { h.W++; a.L++; h.pts += 2; }
  else if (winner === aId) { a.W++; h.L++; a.pts += 2; }
  else { h.T++; a.T++; h.pts++; a.pts++; }
}
const rank = (x, y) => y.pts - x.pts || y.W - x.W || y.strength - x.strength || (x.id < y.id ? -1 : 1);

export function playLeague(league, resultFn) {
  const table = tableFrom(league.teams);
  const byId = Object.fromEntries(league.teams.map(t => [t.id, t]));
  roundRobin(league.teams.map(t => t.id)).forEach((rd, ri) => rd.forEach(([h, a]) =>
    record(table, h, a, resultFn(byId[h], byId[a], { competition: "league", regionId: league.regionId, round: ri }).winner)));
  const standings = Object.values(table).sort(rank);
  return { standings, winner: standings[0].id, winnerTeam: byId[standings[0].id] };
}

// ---- the Champions Cup field: last season's winners + Thorne ----------------
// season 0 seeds the 19 bosses; season N seeds season (N-1)'s league winners.
export function cupField(seed, season, resultFn) {
  const entrants = REGIONS.map(rg => {
    if (season === 0) {
      const lg = buildLeague(seed, rg, 0);
      const boss = lg.teams.find(t => t.kind === "boss");
      return { id: boss.id, name: boss.name, strength: boss.strength, human: false, regionId: rg.id };
    }
    const w = playLeague(buildLeague(seed, rg, season - 1), resultFn).winnerTeam;
    return { id: w.id, name: w.name, strength: w.strength, human: !!w.human, regionId: rg.id };
  });
  return [THORNE, ...entrants];   // 20 teams
}

// Thorne beats every AI side; only a human result stands against him.
function cupResult(resultFn) {
  return (a, b, ctx) => {
    if (a.id === THORNE_ID && !b.human) return { winner: a.id };
    if (b.id === THORNE_ID && !a.human) return { winner: b.id };
    return resultFn(a, b, ctx);
  };
}

// ---- the Champions Cup: groups -> knockout ----------------------------------
export function drawGroups(field, seed, season) {
  const order = shuffle(field, stream(seed, "cupdraw", season));
  return [0, 1, 2, 3].map(g => order.filter((_, i) => i % 4 === g));  // 4 groups of 5
}
function playGroup(teams, resFn) {
  const table = tableFrom(teams);
  const byId = Object.fromEntries(teams.map(t => [t.id, t]));
  circleRounds(teams.map(t => t.id)).forEach((rd, ri) => rd.forEach(([h, a]) =>
    record(table, h, a, resFn(byId[h], byId[a], { competition: "cup-group", round: ri }).winner)));
  const standings = Object.values(table).sort(rank);
  return { standings, teams: byId };
}
function ko(a, b, resFn, stage) {   // one knockout tie -> winner & loser teams
  const res = resFn(a, b, { competition: "cup", stage });
  return res.winner === a.id ? { win: a, lose: b } : { win: b, lose: a };
}

export function playCup(field, seed, season, resultFn) {
  const resFn = cupResult(resultFn);
  const groups = drawGroups(field, seed, season);
  const gres = groups.map(g => playGroup(g, resFn));
  const adv = gres.map(r => r.standings.slice(0, 2).map(s => r.teams[s.id]));  // [ [W,R] per group ]
  const [A, B, C, D] = adv;
  // cross-group QF so group-mates can't meet before the final
  const qf = [ko(A[0], B[1], resFn, "qf"), ko(C[0], D[1], resFn, "qf"),
              ko(B[0], A[1], resFn, "qf"), ko(D[0], C[1], resFn, "qf")];
  const sf = [ko(qf[0].win, qf[1].win, resFn, "sf"), ko(qf[2].win, qf[3].win, resFn, "sf")];
  const third = ko(sf[0].lose, sf[1].lose, resFn, "third");
  const final = ko(sf[0].win, sf[1].win, resFn, "final");
  return {
    groups: gres.map(r => r.standings),
    champion: final.win.id, runnerUp: final.lose.id, third: third.win.id,
    bracket: { qf, sf, third, final }
  };
}

// convenience: play a whole season's Cup straight from (seed, season)
export function seasonCup(seed, season, resultFn) {
  return playCup(cupField(seed, season, resultFn), seed, season, resultFn);
}

// ---- ageing: the whole world grows old at each rollover ---------------------
export function ageRoster(roster, seed, teamId, season) {
  const kept = []; let youthN = 0;
  for (const p of roster) {
    const age = p.age + 1;
    const retireAge = (p.role === "keeper" || p.role === "spin") ? 37 : 35;
    if (age >= retireAge) { youthN++; continue; }
    const decline = age > 30 ? (age - 30) * 1.4 : 0;
    kept.push({ ...p, age, skill: Math.max(20, Math.round((p.skill - decline) * 10) / 10) });
  }
  for (let i = 0; i < youthN; i++) {
    const r = stream(seed, "youth", teamId, season, i);
    kept.push({ id: teamId + "-y" + season + "-" + i, name: teamId.toUpperCase() + " youth", role: ROLES[Math.floor(r() * ROLES.length)], age: 18 + Math.floor(r() * 3), skill: 42 + Math.floor(r() * 40) });
  }
  return kept;
}
