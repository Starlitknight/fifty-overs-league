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
 * @param opts    { startDate: 'YYYY-MM-DD', matchTime: 'HH:MM', seedBase, tzSuffix }
 * @returns       [{ round, home_team_id, away_team_id, seed, resolve_at }]
 */
export function doubleRoundRobin(teams, opts = {}) {
  if (teams.length < 2) throw new Error("need at least 2 teams");
  const { startDate = "2026-07-04", matchTime = "17:00", seedBase = 5000, tzSuffix = "Z" } = opts;
  const first = singleRoundRobin(teams);
  // second leg: same pairings, venue reversed
  const second = first.map((pairs) => pairs.map(([h, a]) => [a, h]));
  const allRounds = [...first, ...second];

  const out = [];
  let mi = 0;
  const base = new Date(`${startDate}T00:00:00Z`);
  for (let r = 0; r < allRounds.length; r++) {
    const day = new Date(base);
    day.setUTCDate(base.getUTCDate() + r);
    const dateStr = day.toISOString().slice(0, 10);
    for (const [home, away] of allRounds[r]) {
      out.push({
        round: r + 1,
        home_team_id: home,
        away_team_id: away,
        seed: seedBase + mi,             // unique per fixture
        resolve_at: `${dateStr}T${matchTime}:00${tzSuffix}`,
      });
      mi++;
    }
  }
  return out;
}
