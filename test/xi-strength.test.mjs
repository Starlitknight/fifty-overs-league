// test/xi-strength.test.mjs — THE SIDES ARE MARKED ON THE MEN, NOT THE DAY.
//
// A manager wrote in with three internationals at the top of his order and a
// panel telling him his top order was worth 2.2 out of ten. It was: they had
// made four between them off fifteen balls. The panel was marking the
// AFTERNOON while its headline figure - the club rating scale - was marking
// the SIDE, and a reader cannot be expected to hold two meanings in one card.
//
// So the panel marks the side. What is held here is exactly that: the marks
// are a function of the eleven and of nothing else. Zero every run off the
// card and they do not move a decimal. Improve the men and they do.
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { makeEngine } from './engine-vm.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const core = readFileSync(join(ROOT, 'engine', 'src', '00-core.js'), 'utf8');

const eng = makeEngine();
const strength = (innings, nm) => eng.ctx.foXIStrength(innings, nm);
const ROWS = ['top', 'middle', 'tail', 'seam', 'spin', 'field'];
// GD is a script-scoped binding inside the bundle, not a property of window
const setTeams = vm.runInContext('(function (t) { var was = GD.teams; if (t) GD.teams = t; return was; })', eng.ctx);

// one real match, played through the shipped engine
const A = { name: 'Ashgrove', ground: 'The Meadow', players: eng.genSquad(4711, 'England', 'balanced').players };
const B = { name: 'Barrowfield', ground: 'The Oval', players: eng.genSquad(9182, 'England', 'balanced').players };
const CARD = eng.sim(A, B, 'balanced', 'Sunny', 20260812);

test('a real card marks both elevens', () => {
  assert.ok(CARD && CARD.innings && CARD.innings.length === 2, 'the match played');
  for (const nm of [A.name, B.name]) {
    const s = strength(CARD.innings, nm);
    assert.ok(s, nm + ' is marked');
    assert.equal(s.n, 11, nm + ' fielded eleven men');
    assert.ok(s.rating > 0, nm + ' carries a strength: ' + s.rating);
    // and that strength is on the scale the club page and the rankings print
    const printed = eng.ctx.foRate(s.rating);
    assert.ok(printed >= 1000 && printed <= 100000, nm + ' reads on the club scale: ' + printed);
    ROWS.forEach(k => {
      if (s[k] != null) assert.ok(s[k] >= 0 && s[k] <= 99 && s[k] === Math.round(s[k]),
        nm + ' ' + k + ' is a whole skill out of 99: ' + s[k]);
    });
    assert.ok(s.top != null && s.middle != null && s.tail != null, nm + ' has all three batting units');
    assert.ok(s.seam != null || s.spin != null, nm + ' has an attack');
  }
});

test('the marks do not move when the scoreline does', () => {
  const before = strength(CARD.innings, A.name);
  // the same eleven, bowled out for nothing: every run, every ball, every
  // wicket and every catch taken off the card
  const wiped = JSON.parse(JSON.stringify(CARD.innings)).map(inn => {
    inn.runs = 0; inn.wkts = 10; inn.legal = 60;
    (inn.bat || []).forEach(b => { b.r = 0; b.b = 0; b.f4 = 0; b.f6 = 0; b.out = 'b Nobody'; });
    // the same attack, the same overs, and every one of them hit for nothing
    // and taking nothing: who bowled is the lineup, how it went is the day
    Object.keys(inn.bowlers || {}).forEach(k => { inn.bowlers[k].r = 0; inn.bowlers[k].w = 0; });
    inn.fielding = {};
    return inn;
  });
  const after = strength(wiped, A.name);
  assert.ok(after, 'a wiped card still marks the side');
  assert.equal(after.rating, before.rating, 'the strength is the same side');
  ROWS.forEach(k => assert.equal(after[k], before[k],
    k + ' moved with the scoreline: ' + before[k] + ' -> ' + after[k]));
});

test('better men make a better top order', () => {
  const better = JSON.parse(JSON.stringify(CARD.innings));
  const mine = better.filter(i => i.batTeam === A.name)[0];
  mine.bat.slice(0, 3).forEach(b => {
    ['vsPace', 'vsSpin', 'rotation', 'temperament', 'power'].forEach(k => { b.p.skills[k] = 95; });
  });
  const was = strength(CARD.innings, A.name), now = strength(better, A.name);
  assert.ok(now.top > was.top, 'three better batsmen make a better top three (' + was.top + ' -> ' + now.top + ')');
  assert.equal(now.middle, was.middle, 'and leave the middle order alone');
  assert.equal(now.tail, was.tail, 'and the tail');
});

test('the batting order is cut one-to-four, five-to-eight, nine down', () => {
  assert.deepEqual(eng.ctx.FO_BAT_CUT, { top: [0, 4], middle: [4, 8], tail: [8, 11] },
    'the cut From the Pavilion marks a side on');
  // and DELIBERATELY not the engine's own club marking, which cuts 3 / 7 the
  // way a scorer adds up an innings. That is a different quantity - what the
  // afternoon was worth, which the world rankings stand on - and the two are
  // never printed beside each other.
  assert.match(core, /const g\s*=\s*i<3\?'top':\(i<7\?'mid':'tail'\)/,
    'the engine still cuts 3 / 7 for its own marking');
});

test('the attack is the men who bowled, with the overs they sent down', () => {
  const s = strength(CARD.innings, A.name);
  const theirs = CARD.innings.filter(i => i.bowlTeam === A.name)[0];
  const used = Object.keys(theirs.bowlers).filter(k => theirs.bowlers[k].b > 0);
  const isSpin = p => !['fast', 'fastMedium', 'medium'].includes(String(p.bowlType));
  const grp = spin => used.map(k => theirs.bowlers[k]).filter(x => isSpin(x.p) === spin);
  const balls = xs => xs.reduce((n, x) => n + (x.b | 0), 0);
  assert.equal(s.seamOv, Math.round(balls(grp(false)) / 6), 'the seam overs are the seam overs');
  assert.equal(s.spinOv, Math.round(balls(grp(true)) / 6), 'and the spin overs the spin overs');
  assert.equal((s.seamOv || 0) + (s.spinOv || 0), Math.round(balls(used.map(k => theirs.bowlers[k])) / 6),
    'and together they are the innings they bowled');

  // A MAN WHO NEVER GOT A BOWL IS NO PART OF THE ATTACK. Take a seamer's overs
  // off the card and the seam mark is the mean of the ones who are left.
  const dropped = grp(false)[0].p.name;
  const without = JSON.parse(JSON.stringify(CARD.innings));
  delete without.filter(i => i.bowlTeam === A.name)[0].bowlers[dropped];
  const now = strength(without, A.name);
  assert.notEqual(now.seamOv, s.seamOv, 'his overs go with him');
  assert.ok(now.seam != null && now.seam !== s.seam,
    'and so does his skill (' + s.seam + ' -> ' + now.seam + ')');
  assert.equal(now.spin, s.spin, 'the spinners are untouched');
  assert.equal(now.top, s.top, 'and so is the batting');
});

test('a card with no men on it is left unmarked rather than marked wrongly', () => {
  const bare = [{ batTeam: 'A', bowlTeam: 'B', bat: [{ p: { name: 'Someone' }, r: 40, b: 30 }],
    bowlers: {}, fielding: {} },
    { batTeam: 'B', bowlTeam: 'A', bat: [], bowlers: {}, fielding: {} }];
  assert.equal(strength(bare, 'A'), null, 'one nameless man is no eleven');
  assert.equal(strength(bare, 'C'), null, 'a side that never batted is not marked');
});

test('the panel prints the strength and never the day', () => {
  const html = eng.ctx.foRatingsPanelHTML(CARD.innings, CARD.result);
  assert.ok(html, 'the panel renders');
  assert.match(html, /Match ratings/, 'the panel is named the way the game names the tab');
  assert.match(html, /The day&rsquo;s points/, 'the day still has its points underneath');
  [A.name, B.name].forEach(nm => assert.ok(html.indexOf(nm) >= 0, nm + ' is on the panel'));
  // IT IS ONE TABLE READ ACROSS, not two stacks of cards: every row carries
  // both sides, so a manager never has to scroll to find the other number
  const rows = html.split("class='fo-rat-row").slice(1);
  assert.ok(rows.length >= 4, 'the table has rows: ' + rows.length);
  rows.forEach((r, i) => {
    const cells = (r.split('</div>')[0].match(/<[bi] class=|<i>/g) || []).length;
    assert.equal(cells, 2, 'row ' + i + ' carries both sides, not ' + cells);
  });
  assert.match(html, /fo-rat-row hd'><span><\/span><i>/, 'the two clubs head their own columns');
  assert.match(html, /fo-rat-row ft'><span>Overall/, 'the overall sits at the foot');
  assert.match(html, /Bowling - Seam<\/span><b[^>]*>\d+<em>\(\d+\)<\/em>/,
    'the seam mark carries the overs that half of the attack bowled');
  // and the better of the two is said in the ink rather than left to be worked out
  assert.match(html, /class='up'/, 'somebody wins a line');
  assert.match(html, /class='dn'/, 'and somebody loses it');
  const missing = [A.name, B.name].some(nm => ROWS.some(k => strength(CARD.innings, nm)[k] == null));
  if (missing) assert.match(html, /class='none'>&ndash;/,
    'a department nobody fills shows a dash rather than vanishing');
});

// ---------------------------------------------------------------------------
// THE ARCHIVE. A save slims every result past the last two down to the basics
// of each man, and the fifteen skills the marking is built from were the first
// thing to go - so a match a fortnight old came back with no sides on it at
// all, only the day's points, under a heading promising two.
// ---------------------------------------------------------------------------
test('a slimmed card still knows what the two sides were worth', () => {
  const slim = JSON.parse(JSON.stringify(CARD.innings)).map(inn => {
    inn.bat = inn.bat.map(b => Object.assign({}, b, { p: eng.ctx.foSlimPlayer(b.p) }));
    Object.keys(inn.bowlers || {}).forEach(k => { inn.bowlers[k].p = eng.ctx.foSlimPlayer(inn.bowlers[k].p); });
    return inn;
  });
  // the save really has taken the skills away
  assert.ok(!slim[0].bat[0].p.skills, 'the slimmed man carries no skill block');
  const was = strength(CARD.innings, A.name), now = strength(slim, A.name);
  assert.ok(now, 'the slimmed card still marks the side');
  assert.equal(now.rating, was.rating, 'the same strength');
  ROWS.forEach(k => assert.equal(now[k], was[k],
    k + ' was lost in the archive: ' + was[k] + ' -> ' + now[k]));
});

test('a save slimmed before the aggregates were kept reads the men off the roster', () => {
  // the old archive shape: a name and a rating, no skills and no aggregates
  const older = JSON.parse(JSON.stringify(CARD.innings)).map(inn => {
    inn.bat = inn.bat.map(b => Object.assign({}, b, {
      p: { name: b.p.name, keeper: !!b.p.keeper, bowlType: b.p.bowlType, role: b.p.role, rating: b.p.rating }
    }));
    Object.keys(inn.bowlers || {}).forEach(k => {
      const q = inn.bowlers[k].p; inn.bowlers[k].p = { name: q.name, bowlType: q.bowlType };
    });
    return inn;
  });
  const was = strength(CARD.innings, A.name);
  const bare = strength(older, A.name);
  assert.ok(bare, 'the ratings the archive did keep still say what the side was worth');
  assert.equal(bare.rating, was.rating);
  ROWS.forEach(k => assert.equal(bare[k], null, k + ' cannot be had from a name and a rating'));
  // put the eleven on a roster the way a saved game carries them, and the
  // departments come back off the men themselves
  const prev = setTeams([{ name: A.name, players: A.players }]);
  try {
    const now = strength(older, A.name);
    assert.equal(now.rating, was.rating, "the card's own rating is kept, not the roster's");
    ROWS.forEach(k => assert.equal(now[k], was[k], k + ' read off the roster: ' + was[k] + ' -> ' + now[k]));
  } finally { setTeams(prev); }
});

test('and a card that never carried the men says nothing rather than nothing much', () => {
  // a card rebuilt from the commentary names the men and knows no more
  const named = JSON.parse(JSON.stringify(CARD.innings)).map(inn => {
    inn.bat = inn.bat.map(b => ({ p: { name: b.p.name }, r: b.r, b: b.b, f4: b.f4, f6: b.f6, out: b.out }));
    Object.keys(inn.bowlers || {}).forEach(k => { inn.bowlers[k].p = { name: k }; });
    return inn;
  });
  assert.equal(strength(named, A.name), null, 'no marks to be had');
  const html = eng.ctx.foRatingsPanelHTML(named, CARD.result);
  assert.ok(!/The two sides/.test(html), 'and the panel does not promise two sides it cannot show');
  assert.match(html, /The day&rsquo;s points/, 'the points are still worth printing');
});

test("the reader's own club takes the left-hand column", () => {
  const other = eng.ctx.foRatingsPanelHTML(CARD.innings, CARD.result);
  const order = h => ((h.split("class='fo-rat-row hd'")[1] || '').split('</div>')[0]
    .match(/<i>([^<]+)<\/i>/g) || []).map(x => x.replace(/<\/?i>/g, ''));
  const asCard = order(other);
  assert.equal(asCard.length, 2, 'two column headings');
  // claim the side the card happens to list second
  const prev = setTeams([{ name: asCard[1], players: [] }]);
  try {
    const flipped = order(eng.ctx.foRatingsPanelHTML(CARD.innings, CARD.result));
    assert.deepEqual(flipped, [asCard[1], asCard[0]], 'my club leads');
  } finally { setTeams(prev); }
});
