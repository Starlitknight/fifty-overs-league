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
import { makeEngine } from './engine-vm.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const core = readFileSync(join(ROOT, 'engine', 'src', '00-core.js'), 'utf8');

const eng = makeEngine();
const strength = (innings, nm) => eng.ctx.foXIStrength(innings, nm);
const ROWS = ['top', 'middle', 'tail', 'seam', 'spin', 'field'];

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
    inn.bowlers = {}; inn.fielding = {};
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

test('the batting order is cut where a scorer cuts it', () => {
  assert.deepEqual(eng.ctx.FO_BAT_CUT, { top: [0, 3], middle: [3, 7], tail: [7, 11] });
  // the same cut the engine's own club marking uses, read off the engine itself
  assert.match(core, /const g\s*=\s*i<3\?'top':\(i<7\?'mid':'tail'\)/,
    'the engine still cuts 3 / 7, which is where these boundaries came from');
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
  assert.match(html, /Strength of the XI/, 'the headline is what the side is worth');
  assert.ok(!/Match rating/.test(html), 'and not what the afternoon was worth');
  assert.match(html, /The day&rsquo;s points/, 'the day still has its points underneath');
  [A.name, B.name].forEach(nm => assert.ok(html.indexOf(nm) >= 0, nm + ' is on the panel'));
  // and the two columns line up: a side with no spinner is not a row short,
  // or every department below it reads against the wrong one opposite
  const cols = html.split("class='fo-rat-side'").slice(1);
  assert.equal(cols.length, 2, 'two columns');
  const rows = h => (h.match(/fo-rat-r/g) || []).length;
  assert.equal(rows(cols[0]), rows(cols[1]), 'both columns carry the same departments');
  const missing = [A.name, B.name].some(nm => ROWS.some(k => strength(CARD.innings, nm)[k] == null));
  if (missing) assert.match(html, /class='none'>&ndash;/,
    'a department nobody fills shows a dash rather than vanishing');
});
