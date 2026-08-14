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
  const inns = (f.innings || []).map(i => i.team + ' ' + i.runs + '/' + i.wkts).join(', ');
  const body = [open];
  if (inns) body.push(inns + '.');
  if (f.text) body.push(f.text + '.');
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
  if (f.sort === 'oddity' || f.sort === 'record') return st.headline;
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

export function dateline(worldDay, seasonNo, dayInSeason) {
  return 'Day ' + dayInSeason + ' of season ' + seasonNo + ' · world day ' + worldDay;
}
