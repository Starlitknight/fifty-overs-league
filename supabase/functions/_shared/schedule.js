// Double round-robin fixture generator (circle method). Every ordered pair
// (A home vs B) plays exactly once, so each unordered pair meets twice with the
// venue swapped; one match per team per round. Per-fixture deterministic seeds
// and resolve_at timestamps at the league match time on successive days.
//
// Plain JS: runs in Node tests and Deno Edge Functions.

const BYE = "__BYE__";

/** Single round-robin as an array of rounds; each round is [[home,away],...]. */
function singleRoundRobin(teams) {
  const arr = [...teams];
  if (arr.length % 2 === 1) arr.push(BYE);       // odd => one team rests each round
  const m = arr.length;
  const fixed = arr[0];
  let rot = arr.slice(1);
  const rounds = [];
  for (let r = 0; r < m - 1; r++) {
    const row = [fixed, ...rot];
    const pairs = [];
    for (let i = 0; i < m / 2; i++) {
      const a = row[i], b = row[m - 1 - i];
      if (a === BYE || b === BYE) continue;
      // alternate venue by round so home/away stays balanced across the season
      pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    rot = [rot[rot.length - 1], ...rot.slice(0, rot.length - 1)];  // rotate
  }
  return rounds;
}

/**
 * @param teams   array of team ids
 * @param opts    { seedBase }
 * @returns       [{ round, home_team_id, away_team_id, seed }]
 * resolve_at is NOT set here — it is server-owned and computed by write_fixtures
 * from the league's match_time and tz on start_date + (round-1) days.
 */
export function doubleRoundRobin(teams, opts = {}) {
  if (teams.length < 2) throw new Error("need at least 2 teams");
  const { seedBase = 5000 } = opts;
  const first = singleRoundRobin(teams);
  const second = first.map((pairs) => pairs.map(([h, a]) => [a, h]));  // venue reversed
  const allRounds = [...first, ...second];

  const out = [];
  let mi = 0;
  for (let r = 0; r < allRounds.length; r++) {
    for (const [home, away] of allRounds[r]) {
      out.push({ round: r + 1, home_team_id: home, away_team_id: away, seed: seedBase + mi });
      mi++;
    }
  }
  return out;
}
