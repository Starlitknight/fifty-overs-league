// gazette-prose.mjs — THE WORDS.
//
// The paper is the same for everybody, which means there is no personalisation
// to carry a dull sentence. A club bulletin is interesting even when badly
// written, because it is about YOUR side; a world paper is only interesting if
// it is well written. So the prose is the expensive half of this feature and
// this is the file that will keep growing.
//
// SEEDED, NEVER RANDOM. Every choice is keyed on the world day and the story's
// own facts, so the same record prints the same paper - which is the promise
// the whole design rests on. Math.random would break it silently, on one
// device, once.
//
// The pools are deliberately plain. Cricket writing goes wrong when it strains,
// and a hundred sober sentences read better on the four hundredth morning than
// twenty florid ones.

function h32(s) {
  let h = 2166136261 >>> 0;
  s = String(s);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
const pick = (pool, seed) => pool[h32(seed) % pool.length];

// ---- HEADLINES -------------------------------------------------------------
//
// A headline states the result. It does not editorialise, because the story
// underneath it is about to, and a paper that shouts twice is a tabloid.

const WIN_VERB = ['beat', 'see off', 'get the better of', 'account for', 'overcome'];
const NARROW = ['edge', 'squeeze past', 'hold off', 'pip', 'scrape past'];
const CRUSH = ['crush', 'sweep aside', 'dismantle', 'rout', 'brush aside'];

export function headline(st) {
  const f = st.facts || {};
  const seed = (st.day | 0) + '|' + (f.sort || st.kind) + '|' + (st.headline || '');
  if (f.sort === 'intlFeat' || f.sort === 'clubFeat') {
    return f.feat === 'fiveFor'
      ? f.man + ' takes ' + f.wkts + ' for ' + f.conc
      : f.man + "'s " + f.runs;
  }
  if (f.sort === 'oddity') {
    if (f.why === 'tie') return 'Tied';
    if (f.why === 'tenWicket') return 'Ten wickets';
    return f.team + ' all out for ' + f.runs;
  }
  if (f.sort === 'record') return f.team + ' pile up ' + f.runs;
  const w = f.winner, a = f.a || f.home, b = f.b || f.away;
  if (!w) return a + ' and ' + b + ' share it';
  const loser = w === a ? b : a;
  const tight = (st.stakes || 0) >= 0.9, easy = (st.stakes || 0) <= 0.2;
  const verb = pick(tight ? NARROW : easy ? CRUSH : WIN_VERB, seed);
  return w + ' ' + verb + ' ' + loser;
}

// ---- THE LEAD --------------------------------------------------------------
//
// A real report says what happened, then what turned it, then what it means.
// These are the three sentences; the facts fill them.

const OPEN_INTL = [
  'There was a proper international at stake here, and it was settled the hard way.',
  'The two sides met with a series in the balance, and by the close only one of them was smiling.',
  'It had the shape of a contest from the first over, and it kept it to the last.'
];
const OPEN_SHOCK = [
  'Nobody had this one down, which is rather the point of playing it.',
  'The form book was on the table before play and in the bin by tea.',
  'On paper it was a formality. Paper does not bat.'
];
const OPEN_TIGHT = [
  'It came down to the closing overs, as the best of them tend to.',
  'Two sides spent fifty overs failing to get away from one another.',
  'There was almost nothing in it, and what there was arrived late.'
];
const OPEN_FLAT = [
  'This was settled long before the end, and settled thoroughly.',
  'One side found its length early and the other never solved it.',
  'A comfortable afternoon, of the kind that says more about the winner than the margin does.'
];

const CLOSE = [
  'The table will show a result. Those who watched will remember rather more.',
  'A day that will be argued about, which is the highest thing you can say of a game of cricket.',
  'On to the next, with the standings a little less certain than they were.',
  'It goes in the book as it stands, and the book is not always the whole of it.'
];

const OPEN_COLLAPSE = [
  'There are afternoons when a batting order simply does not turn up, and this was one of them.',
  'Nobody could account for it afterwards, which is usually the way of these things.',
  'It took barely half the overs, and none of them were comfortable to watch.'
];
const OPEN_FEAT = [
  'One man decided this was going to be his afternoon, and nobody could talk him out of it.',
  'There are innings you remember the shape of long after you have forgotten the result.',
  'It was the sort of spell that makes a captain look clever for doing nothing at all.'
];
const OPEN_RECORD = [
  'The record books were open before the end, which does not happen often.',
  'Some totals are scores. This one is a line in a book that will outlast everybody who saw it.',
  'It stopped being a contest some way out and became an exhibition.'
];

// ---- THE DECK --------------------------------------------------------------
//
// One line of italic under the headline, and it is THE NUMBERS - never a
// second, smaller headline. That division is the whole reason it exists: with
// the scoreline sitting in the deck, the report underneath no longer has to
// recite "Khulna CC 270/8, Dhaka CC 265/10" mid-paragraph, which was the
// sentence that made the front page read like a printout rather than a paper.
//
// Purely factual by construction. There is no phrase pool here and there must
// never be one: a deck that editorialises is competing with the headline above
// it and the lead below it, and all three lose.
const scoreOf = (i) => i.team + ' ' + i.runs + (i.wkts >= 10 ? ' all out' : ' for ' + i.wkts);
export function deck(st) {
  const f = st.facts || {};
  if (f.sort === 'intlFeat' || f.sort === 'clubFeat')
    return f.feat === 'fiveFor'
      ? f.wkts + ' for ' + f.conc + '.'
      : f.runs + (f.balls ? ' from ' + f.balls + ' balls' : '') + '.';
  if (f.sort === 'record') return f.team + ' ' + f.runs + ' for ' + f.wkts + '.';
  if (f.sort === 'oddity') return (f.text || st.headline || '') + '.';
  const inns = (f.innings || []).filter(i => i && i.team).map(scoreOf).join('; ');
  return inns ? inns + '.' : (f.text ? f.text + '.' : '');
}

// ---- WHAT TURNED IT --------------------------------------------------------
//
// The middle sentence of a three-act report, and the one the paper did not have.
// Every line here has to be true of its whole branch without knowing a single
// further fact - no overs, no names, no partnerships - because the desk does not
// pass any, and a report that guesses at detail is worse than one that is short.
//
// AND IT SAYS WHAT THE RESULT COST, never what kind of game it was. That is
// the opener's job two sentences earlier, and the first draft of these pools
// did it a second time: "Nobody had this one down" was followed by "this is the
// result nobody would have written down", and "Paper does not bat" by "none of
// them bats". Two pools picked independently WILL collide eventually, so the
// fix is not better wording - it is giving the two sentences different jobs.
const TURN_TIGHT = [
  'Two points changed hands on a margin that would not have survived one dropped catch.',
  'The losing side will spend far longer on this one than the winners will.',
  'A game this close is worth exactly what a comfortable one is worth, which is the cruelty of a league.'
];
const TURN_FLAT = [
  'The table is the only place a win like this looks the same as a hard-earned one.',
  'There will be a selection meeting somewhere this evening, and it will not be a short one.',
  'Nobody learns a great deal from an afternoon like this except the side that lost it.'
];
const TURN_SHOCK = [
  'Whatever the ratings make of it overnight, the two points have already been paid out.',
  'Leagues are decided by afternoons like this one, and not by the ones everybody calls correctly.',
  'Both sets of supporters will read the table twice this evening and get the same answer.'
];

// ---- HOW IT WAS WON --------------------------------------------------------
//
// One more true sentence, and it is derived rather than chosen: whether the
// winners batted first tells you whether this was a total defended or a target
// chased, and those are different games to watch and different games to win.
// The innings arrive in batting order, so the first team named IS the side that
// batted first - no extra fact needed from the desk.
//
// It exists because the almanack treatment sets the lead in one book measure,
// and three sentences in a 38-em measure is a paragraph with a hole in it. The
// honest way to fill a measure is another true sentence; the dishonest way is
// an invented detail, and a report that guesses at overs or partnerships will
// eventually guess wrong in a way a reader can check.
const DEFENDED = [
  'It was a total defended rather than a target chased, which is the harder of the two and the less admired.',
  'The runs went on the board first and then had to be protected, which is a longer afternoon than the scorecard suggests.',
  'Batting first and winning is the version of this that requires the bowlers to finish the argument.'
];
const CHASED = [
  'The chase was the whole of it: a target set, and then the slow business of finding out whether it was enough.',
  'They batted second knowing the number, which helps until the moment it stops helping.',
  'A target is a different pressure from a total, and this one was carried rather than set.'
];

// A STORY IS NOT ALWAYS A MATCH. This wrote match prose for everything, so a
// side bowled out for 62 was reported as "a comfortable afternoon, of the kind
// that says more about the winner than the margin does" - a sentence about a
// game, laid over a batting order falling down the stairs. Caught by reading an
// actual issue; every test passed, because none of them read the words.
export function lead(st) {
  const f = st.facts || {}, seed = (st.day | 0) + '|lead|' + (st.headline || '');
  if (f.sort === 'oddity') {
    const body = [pick(OPEN_COLLAPSE, seed)];
    if (f.why === 'collapse') body.push(f.team + ' were all out for ' + f.runs + '.');
    else if (f.text) body.push(f.text + '.');
    body.push(pick(CLOSE, seed + '|close'));
    return body.join(' ');
  }
  if (f.sort === 'record') {
    return [pick(OPEN_RECORD, seed), f.team + ' ' + f.runs + '/' + f.wkts + '.',
            pick(CLOSE, seed + '|close')].join(' ');
  }
  if (f.sort === 'intlFeat' || f.sort === 'clubFeat') {
    const what = f.feat === 'fiveFor'
      ? f.man + ' finished with ' + f.wkts + ' for ' + f.conc + '.'
      : f.man + ' made ' + f.runs + (f.balls ? ' from ' + f.balls + ' balls' : '') + '.';
    return [pick(OPEN_FEAT, seed), what, pick(CLOSE, seed + '|close')].join(' ');
  }
  const shock = (st.upset && st.upset.loser - st.upset.winner) > 2500;
  const tight = (st.stakes || 0) >= 0.8;
  const open = shock ? pick(OPEN_SHOCK, seed)
    : st.kind === 'intlResult' ? pick(OPEN_INTL, seed)
    : tight ? pick(OPEN_TIGHT, seed) : pick(OPEN_FLAT, seed);
  // THE SCORELINE IS NOT IN HERE ANY MORE. It used to be the second sentence -
  // "Khulna CC 270/8, Dhaka CC 265/10." dropped into the middle of a report -
  // and it is the single line that made the page read like a printout. It lives
  // in the deck now, where a newspaper puts it, and this says what happened
  // instead of what the numbers were.
  const body = [open];
  if (f.text) body.push(f.text + '.');
  // only when the innings are there AND they name a winner among them; a story
  // with one innings, or none, has nothing to say about how it was won
  const first = (f.innings || [])[0];
  if (first && first.team && f.winner)
    body.push(pick(first.team === f.winner ? DEFENDED : CHASED, seed + '|how'));
  body.push(pick(shock ? TURN_SHOCK : tight ? TURN_TIGHT : TURN_FLAT, seed + '|turn'));
  body.push(pick(CLOSE, seed + '|close'));
  return body.join(' ');
}

// ---- IN BRIEF --------------------------------------------------------------
// One line, no adjectives. The wire, not the report.

export function brief(st) {
  const f = st.facts || {};
  if (f.sort === 'intlFeat' || f.sort === 'clubFeat')
    return f.feat === 'fiveFor'
      ? f.man + ' ' + f.wkts + '-' + f.conc
      : f.man + ' ' + f.runs + (f.balls ? ' off ' + f.balls : '');
  // AN ODDITY'S HEADLINE DOES NOT EXPLAIN ITSELF. "Ten wickets" and "Tied" say
  // what happened and not to whom, and the almanack sets a brief UNDER its
  // headline as the line that explains it - so returning the headline again
  // left the page repeating itself and then falling back to the kicker, which
  // is how two entries both came out captioned "Out of the ordinary".
  if (f.sort === 'oddity') return f.text && f.text !== st.headline ? f.text : st.headline;
  if (f.sort === 'record') return st.headline;
  return f.text || st.headline;
}

// ---- COMMENT ---------------------------------------------------------------
// One pundit line under the fold, on the day's shape rather than one match.

const COMMENT = [
  'Three days of cricket and the table has barely moved. That is a league finding its level, not a dull one.',
  'The gap between the best sides and the rest looks wider this week than last. Whether that lasts is the season.',
  'A reminder that a good bowling attack travels and a good batting order does not always.',
  'The tail wagged twice in three days. Selectors will have noticed; captains certainly did.',
  'Form is a rumour until a side proves it twice. Two of them have now.'
];
export function comment(day) { return pick(COMMENT, 'comment|' + day); }

// ---- THE MASTHEAD ----------------------------------------------------------

// `seasonNo` here is the season's PUBLIC NAME (clock.seasonName), not the
// seasons row's index. The paper printed the index once - "Day 12 of season 1"
// under an app header reading SEASON 137 - and it read like a second world
// running alongside the first. There is only one world; this is what it calls
// today.
export function dateline(worldDay, seasonNo, dayInSeason) {
  return 'Day ' + dayInSeason + ' of season ' + seasonNo + ' · world day ' + worldDay;
}
