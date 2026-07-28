// PHASE 1 — decompose an engine season into database rows.
//
// The umpire plays a round in the real engine, then writes what happened as
// ROWS: one per club, one per player, one per result, the ball-by-ball into
// its own table. Pages then read only what they show. This module is pure
// data-shaping - no I/O - so the test suite can prove, on a real
// engine-played season, that the rows it emits make the SQL standings view
// agree with the engine's own league table to the run.

/** One game.results row from an engine result record. */
export function resultRow(leagueId, r) {
  const i1 = r.innings && r.innings[0], i2 = r.innings && r.innings[1];
  if (!i1 || !i2) return null;                       // abandoned / malformed
  const side = {};
  side[i1.batTeam] = { runs: i1.runs | 0, wkts: i1.wkts | 0, balls: i1.legal | 0 };
  side[i2.batTeam] = { runs: i2.runs | 0, wkts: i2.wkts | 0, balls: i2.legal | 0 };
  const h = side[r.home], a = side[r.away];
  if (!h || !a) return null;                         // innings don't name the fixture's clubs
  return {
    league_id: leagueId,
    comp: r.comp || 'league',
    round: typeof r.round === 'number' ? r.round : -1,
    home: r.home, away: r.away,
    winner: (r.result && r.result.winner) || null,
    home_runs: h.runs, home_wkts: h.wkts, home_balls: h.balls,
    away_runs: a.runs, away_wkts: a.wkts, away_balls: a.balls,
    summary: (r.result && r.result.text) || '',
    seed: typeof r.seed === 'number' ? r.seed : null,
    scorecard: { innings: r.innings, toss: r.toss || '', date: r.date || '' },
  };
}

/** game.clubs rows from the engine's team list. */
export function clubRows(leagueId, teams) {
  return (teams || []).map((t) => ({
    league_id: leagueId,
    name: t.name,
    ground: t.ground || '',
    bank: Math.round(t.bank || 0),
  }));
}

/** game.players rows for one club. The whole engine record rides in attrs. */
export function playerRows(clubId, team) {
  return ((team && team.players) || []).map((p) => ({
    club_id: clubId,
    name: p.name,
    role: p.role || '',
    age: p.age | 0,
    rating: p.rating | 0,
    attrs: p,
  }));
}
