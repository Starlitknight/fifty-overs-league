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

// AND A FRONT PAGE IS NOT A LEADERBOARD.
//
// Ranking alone is not editing. Read against a real world it gave a lead, a
// second lead and all six briefs to individual feats, because in a low-scoring
// week five-fors score well and there are a dozen of them - a paper reporting
// the twelfth-best bowling figures of the afternoon and no results at all.
//
// So a kind gets a quota. The best two of anything reach the front page and the
// rest queue for the back, which is how a real desk stops one sort of story
// eating the paper. It is applied AFTER ranking, so the best story of a kind is
// never the one dropped - only its imitators.
const MAX_PER_KIND_FRONT = 2;

// The quota is a CEILING THAT RISES ONLY AS FAR AS IT MUST. The first cut of
// this took two of each kind and then filled the rest of the page from whatever
// was left over - which put the ten rejected five-fors straight back on the
// front page, quota and all, and the test caught it. So instead the cap is
// raised a notch at a time until the page is full: on a rich day it never
// leaves two, and on a day with only one kind of story it climbs until the page
// is filled rather than printing gaps.
function spread(ranked, take, cap) {
  let kept = [];
  for (let c = cap; kept.length < take && c <= take; c++) {
    const seen = new Map();
    kept = [];
    for (const s of ranked) {
      const n = (seen.get(s.kind) || 0) + 1;
      seen.set(s.kind, n);
      if (n <= c) kept.push(s);
      if (kept.length >= take) break;
    }
  }
  const inFront = new Set(kept);
  return { kept, rest: ranked.filter(s => !inFront.has(s)) };
}

export function makeIssue(stories, today, extras = {}) {
  const ranked = runningOrder(stories, today);
  const final = ranked.find(s => s.kind === 'cupFinal') || null;
  // a final leads whatever else the arithmetic said; nothing else jumps
  const straight = final ? [final, ...ranked.filter(s => s !== final)] : ranked;
  const front = spread(straight, 2 + FRONT_BRIEFS, MAX_PER_KIND_FRONT);
  const ordered = front.kept.concat(front.rest);
  return {
    day: today | 0,
    tournament: !!final,                       // the client's cue for the other layout
    lead: ordered[0] || null,
    second: ordered[1] || null,
    briefs: ordered.slice(2, 2 + FRONT_BRIEFS),
    back: ordered.slice(2 + FRONT_BRIEFS, 2 + FRONT_BRIEFS + BACK_STORIES),
    // THE FOLIO LINE, which the press writes and this used to drop on the floor:
    // makeIssue was handed a dateline and did not carry it, so every issue came
    // out with a blank masthead. Caught by reading an actual paper rather than
    // by a test - the tests all passed, because none of them read the words.
    dateline: extras.dateline || null,
    // AND THE FOLIO'S OWN NUMBERS, not only the sentence it made from them.
    // The masthead has ears as well as a folio line, and a page that has to
    // parse "Day 5 of season 137" back out of a string to fill them is a page
    // one comma away from printing nothing. `season` is the season's PUBLIC
    // NAME (137), never the seasons row's index (1) - see clock.seasonName.
    season: extras.season == null ? null : extras.season | 0,
    dayInSeason: extras.dayInSeason == null ? null : extras.dayInSeason | 0,
    scoreboard: extras.scoreboard || [],       // yesterday's results in full
    // AND THE NAMES OF THE COUNTRIES THEY WERE PLAYED IN. Every scoreboard row
    // carries a country ID and the page has to head its section with a name. It
    // could ask module 27's planet, which knows all nineteen - but the whole
    // point of the served paper is that the page reads ONE document and needs
    // nothing else in the build to render it. Nineteen short strings is a
    // cheaper price than that coupling.
    nations: extras.nations || {},
    table: extras.table || null,               // the league most worth printing
    numbers: extras.numbers || [],             // records and milestones
    comment: extras.comment || null,
    // A PAPER THAT PRINTS NOTHING SAYS SO. A country that failed to settle, a
    // tick that died halfway - the honest answer is a thin edition that admits
    // it, never a blank page pretending the world stood still.
    thin: !ordered.length
  };
}

// ---------------------------------------------------------------------------
// AND THE PRESS RUN. Read the served world, choose the paper, store it.
//
// Called once a world day by the tick. Everything it reads is the record the
// umpire wrote; nothing it reads is a device's local save, which is the whole
// difference between this paper and the one it replaces.
//
// IDEMPOTENT. Printing twice on one record prints the same issue over itself.
// The tick runs three times an hour and only one of those is a new day, so
// this must cost nothing on the other two - it writes only when the issue has
// actually moved.
// ---------------------------------------------------------------------------
export async function printGazette(pool, now, opts = {}) {
  const { dayIx, roundOfDay, CYCLE, worldAnchor, seasonName } = await import('./clock.mjs');
  const desk = await import('./gazette-desk.mjs');
  const prose = await import('./gazette-prose.mjs');
  const today = dayIx(now);

  // WHO IS WHO. The rankings give a nation its rung and a club its best
  // eleven's worth, which is what the upset and standing modifiers weigh.
  let rk = opts.rankings;
  if (!rk) { const t = await import('./tick.mjs'); rk = await t.computeRankings(pool, now); }
  const byCountry = new Map((rk.countries || []).map(c => [c.id, c]));
  const nations = (rk.countries || []).length || 1;
  const rankOf = (id) => byCountry.get(id) || { rank: nations, natRating: 0 };
  rankOf.count = nations;
  const clubsByKey = new Map((rk.clubs || []).map(c => [c.country + ':' + c.slot, c]));

  const seasons = (await pool.query(
    `SELECT country_id, season_no, start_day FROM seasons`)).rows;
  const topSeason = seasons.reduce((a, s) => Math.max(a, s.season_no | 0), 1);

  // the three desks
  const [intl, league, cups] = await Promise.all([
    desk.intlStories(pool, today, rankOf),
    desk.leagueStories(pool, today, clubsByKey, rankOf, seasons),
    desk.cupStories(pool, today, topSeason)
  ]);
  const stories = [...intl, ...league.stories, ...cups];

  // RARITY IS COUNTED, NOT GUESSED. How many of this kind have run lately is
  // exactly what makes the first hundred of the season worth more than the
  // ninth, and the desks cannot know it because each sees only its own rows.
  const seen = new Map();
  for (const s of stories) {
    const k = s.kind + '|' + ((s.facts && s.facts.why) || (s.facts && s.facts.feat) || '');
    seen.set(k, (seen.get(k) || 0) + 1);
  }
  for (const s of stories) {
    if (s.seenLately == null) {
      const k = s.kind + '|' + ((s.facts && s.facts.why) || (s.facts && s.facts.feat) || '');
      s.seenLately = Math.max(0, (seen.get(k) || 1) - 1);
    }
  }

  // and the words, written onto the stories the editor is about to rank
  for (const s of stories) {
    s.headline = prose.headline(s);
    s.brief = prose.brief(s);
  }
  // THE DATE THE WHOLE GAME AGREES ON. Two things were wrong with dating an
  // issue `topSeason` and `today % CYCLE`: the season number was the seasons
  // row's internal index rather than the name every page in the client prints,
  // and the day-in-season ignored that a season opens on its own start_day.
  // Together they put "Day 12 of season 1" on a masthead sitting directly under
  // an app header reading DAY 5 · SEASON 137, which reads as two worlds. There
  // is one world; worldAnchor and seasonName are how the press says so.
  const anch = worldAnchor(seasons, today);
  const folioSeason = anch ? anch.name : seasonName(topSeason);
  const folioDay = anch ? anch.di + 1 : (today % CYCLE) + 1;
  // THE WHOLE DAY, NOT THE FIRST FORTY. `.slice(0, 40)` was harmless while the
  // page printed one undifferentiated list - forty lines is already more than
  // anybody reads. It stopped being harmless the moment the page began printing
  // only the READER'S OWN nation: nineteen leagues bowl about a hundred and
  // fifty matches on a league day, the rows arrive ordered by country, and forty
  // of them covered four countries. Fifteen nations' readers would have opened
  // the paper to an empty results column with no way to tell that from a rest
  // day. It is one jsonb document either way; the extra is about twelve
  // kilobytes and it is the difference between the section working and not.
  // `natNames`, not `nations` - which is already the country COUNT twenty lines
  // above, and redeclaring a const in the same scope is a SyntaxError at module
  // load, so the press would not have started at all. Caught by a test file that
  // does nothing but import the module.
  const natNames = Object.fromEntries((rk.countries || []).map(c => [c.id, c.name]));
  const issue = makeIssue(stories, today, {
    scoreboard: league.scoreboard,
    nations: natNames,
    comment: prose.comment(today),
    season: folioSeason,
    dayInSeason: folioDay,
    dateline: prose.dateline(today, folioSeason, folioDay)
  });
  // THE DECK IS THE NUMBERS AND THE BODY IS THE WORDS - see gazette-prose. Both
  // front-page stories get both; a brief gets neither, because a brief IS a
  // deck.
  for (const st of [issue.lead, issue.second]) {
    if (!st) continue;
    st.body = prose.lead(st);
    st.deck = prose.deck(st);
  }

  const through = { day: today, stories: stories.length,
                    intl: intl.length, league: league.stories.length, cups: cups.length };
  // ONLY WHEN IT HAS MOVED. Same record, same paper, no write - the discipline
  // every other write in this server learned in Phase 3.
  // CANONICAL, NOT SERIALISED. jsonb hands a document back with its keys in
  // Postgres's order, not the order it went in, so a plain stringify compare
  // calls two identical papers different and reprints every tick - which is the
  // trap server/CLAUDE.md warns about, walked into within the hour.
  const canon = v => JSON.stringify(v, (k, val) =>
    (val && typeof val === 'object' && !Array.isArray(val))
      ? Object.keys(val).sort().reduce((o, kk) => { o[kk] = val[kk]; return o; }, {})
      : val);
  const was = (await pool.query('SELECT world_day, issue FROM gazette WHERE id=1')).rows[0];
  const same = was && was.world_day === today && canon(was.issue) === canon(issue);
  if (!same) {
    await pool.query(
      `INSERT INTO gazette(id, world_day, issue, through, printed_at)
       VALUES (1,$1,$2::jsonb,$3::jsonb, now())
       ON CONFLICT (id) DO UPDATE SET world_day=EXCLUDED.world_day,
         issue=EXCLUDED.issue, through=EXCLUDED.through, printed_at=now()`,
      [today, JSON.stringify(issue), JSON.stringify(through)]);
  }
  return { day: today, printed: !same, stories: stories.length,
           lead: issue.lead && issue.lead.headline, thin: issue.thin };
}
