// ===========================================================================
//  The Living World — the day cursor
//
//  Walks the calendar and resolves each day's fixtures into an accumulating
//  world state: 19 league tables + a live Champions Cup (groups -> knockout),
//  season by season. `advanceTo` is idempotent and deterministic, so a fresh
//  client can fast-forward from the epoch to today and land on exactly the
//  world every other player sees, and a persisted server can resolve just the
//  new day. `viewDay` reads out a single day for the UI / the Wire.
//
//  Match results are injected (the real engine in production, a stub in tests),
//  keeping this module pure and fast to test.
// ===========================================================================
import {
  REGIONS, THORNE_ID, SEASON_DAYS, dayState,
  buildLeague, roundRobin, circleRounds, tableFrom, record, rank,
  cupField, drawGroups, cupResult
} from "./timeline.mjs";

export function newWorldState(seed) {
  return { seed, day: -1, leagues: {}, cups: {}, championsLog: [] };
}

// ---- leagues ----------------------------------------------------------------
function leagueKey(season, regionId) { return season + ":" + regionId; }

function ensureLeague(state, season, regionId) {
  const k = leagueKey(season, regionId);
  if (state.leagues[k]) return state.leagues[k];
  const region = REGIONS.find(r => r.id === regionId);
  const league = buildLeague(state.seed, region, season);
  const L = {
    league, table: tableFrom(league.teams),
    schedule: roundRobin(league.teams.map(t => t.id)),  // 14 rounds
    byId: Object.fromEntries(league.teams.map(t => [t.id, t])),
    results: []
  };
  state.leagues[k] = L;
  return L;
}

function resolveLeagueRound(state, season, round, resultFn) {
  for (const region of REGIONS) {
    const L = ensureLeague(state, season, region.id);
    for (const [hId, aId] of L.schedule[round]) {
      const res = resultFn(L.byId[hId], L.byId[aId], { competition: "league", regionId: region.id, round });
      record(L.table, hId, aId, res.winner);
      L.results.push({ round, home: hId, away: aId, winner: res.winner, result: res.result || null });
    }
  }
}

export function leagueStandings(state, season, regionId) {
  const L = state.leagues[leagueKey(season, regionId)];
  return L ? Object.values(L.table).sort(rank) : null;
}

// ---- the Champions Cup ------------------------------------------------------
function ensureCup(state, season, resultFn) {
  if (state.cups[season]) return state.cups[season];
  const field = cupField(state.seed, season, resultFn);   // last season's winners + Thorne
  const groups = drawGroups(field, state.seed, season).map(teams => ({
    teams, table: tableFrom(teams),
    sched: circleRounds(teams.map(t => t.id)),
    byId: Object.fromEntries(teams.map(t => [t.id, t]))
  }));
  const cup = { field, groups, qualifiers: null, bracket: { qf: [], sf: [], third: null, final: null }, champion: null, runnerUp: null, third: null, results: [] };
  state.cups[season] = cup;
  return cup;
}

// resolve one knockout tie with the Thorne guard
function koTie(a, b, resFn, stage) {
  const res = resFn(a, b, { competition: "cup", stage });
  return res.winner === a.id ? { win: a, lose: b } : { win: b, lose: a };
}

function resolveCupStage(state, season, stage, resultFn) {
  const cup = ensureCup(state, season, resultFn);
  const resFn = cupResult(resultFn);   // Thorne unbeatable by AI
  if (stage[0] === "g") {
    const s = +stage.slice(1);
    for (const g of cup.groups) for (const [hId, aId] of (g.sched[s] || [])) {
      const res = resFn(g.byId[hId], g.byId[aId], { competition: "cup-group", round: s });
      record(g.table, hId, aId, res.winner);
      cup.results.push({ stage, home: hId, away: aId, winner: res.winner });
    }
    if (s === 4) {   // groups complete -> top two per group qualify
      const adv = cup.groups.map(g => Object.values(g.table).sort(rank).slice(0, 2).map(r => g.byId[r.id]));
      cup.qualifiers = adv;
    }
    return;
  }
  const [A, B, C, D] = cup.qualifiers;
  if (stage === "qf") {
    cup.bracket.qf = [koTie(A[0], B[1], resFn, "qf"), koTie(C[0], D[1], resFn, "qf"),
                      koTie(B[0], A[1], resFn, "qf"), koTie(D[0], C[1], resFn, "qf")];
  } else if (stage === "sf") {
    const q = cup.bracket.qf;
    cup.bracket.sf = [koTie(q[0].win, q[1].win, resFn, "sf"), koTie(q[2].win, q[3].win, resFn, "sf")];
  } else if (stage === "third") {
    const sf = cup.bracket.sf;
    cup.bracket.third = koTie(sf[0].lose, sf[1].lose, resFn, "third");
    cup.third = cup.bracket.third.win.id;
  } else if (stage === "final") {
    const sf = cup.bracket.sf;
    cup.bracket.final = koTie(sf[0].win, sf[1].win, resFn, "final");
    cup.champion = cup.bracket.final.win.id;
    cup.runnerUp = cup.bracket.final.lose.id;
    state.championsLog.push({ season, champion: cup.champion, runnerUp: cup.runnerUp, third: cup.third });
  }
  cup.results.push({ stage });
}

// ---- the cursor -------------------------------------------------------------
// Resolve every day from state.day+1 up to and including `targetDay`.
export function advanceTo(state, targetDay, resultFn) {
  for (let d = state.day + 1; d <= targetDay; d++) {
    const ds = dayState(d);
    if (ds.phase === "league") resolveLeagueRound(state, ds.season, ds.round, resultFn);
    else if (ds.phase === "cup" && ds.stage !== "rest") resolveCupStage(state, ds.season, ds.stage, resultFn);
    // 'break' + cup 'rest' days: nothing to resolve (the season rolls over
    // simply because the day counter crosses into the next season).
    state.day = d;
  }
  return state;
}

// ---- reading a day out (for the UI and the Wire) ----------------------------
export function viewDay(state, day) {
  const ds = dayState(day);
  const out = { day, ...ds, fixtures: [] };
  if (ds.phase === "league") {
    for (const region of REGIONS) {
      const L = state.leagues[leagueKey(ds.season, region.id)];
      if (!L) continue;
      for (const r of L.results.filter(x => x.round === ds.round)) {
        out.fixtures.push({ competition: "league", regionId: region.id, ...r });
      }
    }
  } else if (ds.phase === "cup" && ds.stage !== "rest") {
    const cup = state.cups[ds.season];
    if (cup) out.fixtures = cup.results.filter(x => x.stage === ds.stage);
  }
  return out;
}
