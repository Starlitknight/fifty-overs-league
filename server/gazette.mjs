// gazette.mjs — THE PAPER, AND THE EDITOR WHO CHOOSES WHAT GOES IN IT.
//
// One issue a world day, composed here from the served record and read by
// every device. Not a club bulletin: the reader's own side appears only when
// it IS the story, which is the same rule that applies to everybody else's.
//
// THE EDITOR IS A SCORE, NOT A RUNNING ORDER. The obvious build is four
// sections in the owner's stated priority - internationals, then the first
// divisions, then the world, then the oddities - and it is the wrong one. A
// paper laid out that way prints the least interesting international ahead of
// the most astonishing thing that happened all season, and on a day with no
// tour it opens with an empty box. So every candidate story is SCORED and the
// best of them are taken; the priority then emerges from the weights, and a
// second-division game that nobody expected can still take the front page.
// Which is what real back pages do, and the reason anybody reads them.
//
// See docs/GAZETTE.md for the ten decisions this implements.

// ---------------------------------------------------------------------------
// WHAT A STORY IS WORTH
//
// A base by kind, and then the modifiers - which are the whole difference
// between an editor and a sort function. A result is a result; what makes it
// the lead is that nobody saw it coming, or that it settled something, or that
// it had not happened in two years.
// ---------------------------------------------------------------------------
export const BASE = {
  intlResult: 100,          // a tour tie or a World Cup match
  intlFeat: 90,             // a century, a five-for, a first cap for his country
  cupFinal: 130,            // and the days the whole world watches one match
  cupTie: 85,
  titleDecided: 80,         // a first division championship settled
  relegation: 62,
  topClash: 55,             // first and second, played each other
  worldRecord: 75,          // the highest, the best, the biggest chase
  milestone: 45,            // a hundredth cap, a great retiring
  bigTransfer: 40,
  oddity: 35,               // a tie, a ten-wicket win, a side out for 58
  leagueResult: 20          // the ordinary run of play, which fills the scoreboard
};

// A NATION'S STANDING, and a club's, in the same currency. Weighted coverage
// was asked for explicitly: a top-four nation's tour outranks an associate's.
// It is a MULTIPLIER and a gentle one - it tilts the page, it does not own it,
// because the upset below has to be able to beat it.
export function standingMult(rank, of) {
  if (!rank || !of) return 1;
  const share = 1 - (rank - 1) / Math.max(1, of - 1);   // 1 at the top, 0 at the foot
  return 0.72 + 0.56 * share;                            // 0.72 .. 1.28
}

// THE UPSET, WHICH IS THE PAPER'S PERSONALITY.
//
// When two stories score close the paper prints the unexpected one, and this
// is what makes weighting by standing fair rather than merely hierarchical: an
// associate beating a full member reaches the front page on merit and not by
// quota. It is deliberately the heaviest modifier here. A side rated a
// thousand points below winning is worth about as much as the fixture itself.
export function upsetMult(winnerRating, loserRating) {
  const w = +winnerRating || 0, l = +loserRating || 0;
  if (!w || !l || w >= l) return 1;
  // The ceiling is 2.2 and not 1.6 because of what it has to be able to do.
  // An ordinary league result carries a base of 20 against an international's
  // 100, and the design says plainly that a genuinely astonishing club game
  // must be able to take the front page off a dull tour tie. At 1.6 it could
  // not: measured, the shock came out 177.8 against 190 and lost. The whole
  // reason for scoring rather than sectioning is that the exception can win,
  // so the modifier that carries exceptions has to be big enough to carry one.
  return 1 + Math.min(2.2, (l - w) / 4000);              // 1 .. 3.2
}

// RARITY. Once this season beats twice this week. Given as "how many times has
// this kind of thing happened lately" so the caller can count it however the
// record makes cheapest.
export function rarityMult(seenLately) {
  const n = Math.max(0, seenLately | 0);
  return 1 + 0.9 / (1 + n);                              // 1.9 for the first, 1.1 by the ninth
}

// FRESHNESS. Yesterday leads. Older cricket can still make the paper - a
// record set three days ago is still a record - but it stops leading it.
export function freshMult(daysOld) {
  const d = Math.max(0, daysOld | 0);
  return Math.pow(0.55, d);
}

// STAKES. A decider outranks a dead rubber. 0 = nothing rides on it, 1 = the
// title, the series or survival turned on this afternoon.
export function stakesMult(stakes) {
  return 1 + 0.8 * Math.max(0, Math.min(1, +stakes || 0));
}

// MAGNITUDE, for the records only: how far past the old mark. A total that
// beats the record by one is a record; one that beats it by sixty is a story.
export function magnitudeMult(over, typical) {
  if (!typical) return 1;
  return 1 + Math.min(0.9, Math.max(0, +over || 0) / typical);
}

// ---------------------------------------------------------------------------
// THE DESK. Every candidate arrives as a plain object and leaves with a score.
//
//   { kind, day, headline, body, facts, standing:{rank,of},
//     upset:{winner,loser}, stakes, seenLately, over, typical }
//
// Nothing here reads the database. That is deliberate: the editor is a pure
// function of the facts it is handed, so it can be tested exhaustively without
// a world, and two runs over one record choose the same paper.
// ---------------------------------------------------------------------------
export function score(story, today) {
  const base = BASE[story.kind] || 10;
  const st = story.standing || {};
  return base
    * standingMult(st.rank, st.of)
    * upsetMult(story.upset && story.upset.winner, story.upset && story.upset.loser)
    * rarityMult(story.seenLately)
    * freshMult((today | 0) - (story.day | 0))
    * stakesMult(story.stakes)
    * magnitudeMult(story.over, story.typical);
}

// AND THE ORDER OF THE PAPER. Sorted by what a story is worth, with ties
// broken by something STABLE - the kind, then the headline - because a paper
// whose running order depends on which row Postgres handed back first is a
// paper that prints differently on two identical records, and the whole claim
// of this file is that it does not.
export function runningOrder(stories, today) {
  return (stories || [])
    .filter(s => s && s.kind)
    .map(s => ({ ...s, score: +score(s, today).toFixed(4) }))
    .sort((a, b) =>
      b.score - a.score ||
      (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0) ||
      (a.headline < b.headline ? -1 : a.headline > b.headline ? 1 : 0));
}

// ---------------------------------------------------------------------------
// THE SHAPE OF AN ISSUE
//
// A front page of finite size and back pages behind it - which is the point of
// scoring at all. Ten to fourteen stories, about three phone screens.
//
// AND THE FRONT PAGE CHANGES CHARACTER FOR A FINAL. The Champions Cup final
// and the World Cup final are the two days a season when the whole world is
// watching one match, and a paper that prints them in the same shape as a
// Tuesday wastes the occasion. When a final is in the running order at all, it
// leads and the page says so, so the client can lay it out differently.
// ---------------------------------------------------------------------------
export const FRONT_BRIEFS = 6;
export const BACK_STORIES = 6;

export function makeIssue(stories, today, extras = {}) {
  const ranked = runningOrder(stories, today);
  const final = ranked.find(s => s.kind === 'cupFinal') || null;
  // a final leads whatever else the arithmetic said; nothing else jumps
  const ordered = final ? [final, ...ranked.filter(s => s !== final)] : ranked;
  return {
    day: today | 0,
    tournament: !!final,                       // the client's cue for the other layout
    lead: ordered[0] || null,
    second: ordered[1] || null,
    briefs: ordered.slice(2, 2 + FRONT_BRIEFS),
    back: ordered.slice(2 + FRONT_BRIEFS, 2 + FRONT_BRIEFS + BACK_STORIES),
    scoreboard: extras.scoreboard || [],       // yesterday's results in full
    table: extras.table || null,               // the league most worth printing
    numbers: extras.numbers || [],             // records and milestones
    comment: extras.comment || null,
    // A PAPER THAT PRINTS NOTHING SAYS SO. A country that failed to settle, a
    // tick that died halfway - the honest answer is a thin edition that admits
    // it, never a blank page pretending the world stood still.
    thin: !ordered.length
  };
}
