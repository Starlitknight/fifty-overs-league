// test/chase-and-colour.test.mjs — THE EQUATION ON THE BAR, AND WORK COLOURED
// BY WHAT IT WAS.
//
// Two things a reader was being asked to do in his head.
//
// An over summary in the second innings is read for exactly one reason - how
// far away is this - and it said only what the score was. The target was on a
// line an hour further up the feed and the subtraction was the reader's
// problem. It is written onto the bar now, by the umpire, at the point where
// the target and the ball cap are both known exactly: rain revises both, and
// nothing downstream can see that it happened.
//
// And every surface that shows a fielding tag was working out for itself
// whether the tag was praise or blame, by reading the label back through a
// regex. That is three copies of one fact, and a new kind of event is silently
// neutral until somebody remembers all three. The map that names the event
// says which side of the ledger it belongs on.
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { makeEngine } from './engine-vm.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CORE = readFileSync(join(ROOT, 'engine', 'src', '00-core.js'), 'utf8');
const CHRON = readFileSync(join(ROOT, 'engine', 'src', 'league', '11-chronicle.js'), 'utf8');
const FEED = readFileSync(join(ROOT, 'engine', 'src', 'league', '44-feed-match.js'), 'utf8');

const eng = makeEngine();
const A = eng.genSquad(101, 'England', 'balanced'), B = eng.genSquad(202, 'England', 'balanced');
// a handful of real matches, so the assertions below are about cricket the
// engine actually played rather than a fixture somebody typed
const GAMES = [];
for (let s = 1; s <= 6; s++)
  GAMES.push(eng.sim({ name: 'Alpha', players: A.players }, { name: 'Beta', players: B.players },
    'balanced', 'Sunny', s));

const overBars = g => (g.log || []).filter(L => /^End of over /.test(L.txt || ''));

test('the second innings is told what it needs, every over', () => {
  let checked = 0;
  for (const g of GAMES) {
    const brk = (g.log || []).filter(L => /Target (\d+)\./.test(L.txt || ''))[0];
    assert.ok(brk, 'the innings break declared a target');
    const target = +/Target (\d+)\./.exec(brk.txt)[1];
    const chase = overBars(g).filter(L => L.inn === 1);
    assert.ok(chase.length > 5, 'a chase has over summaries (' + chase.length + ')');
    for (const L of chase) {
      // the innings is over the moment the target is passed, so the last bar of
      // a won chase has nothing left to ask for
      const m = /^End of over (\d+) .*- (.+?) (\d+)\/(\d+)\./.exec(L.txt);
      assert.ok(m, 'the bar still reads as a bar: ' + L.txt);
      const need = /need (\d+) from (\d+) (ball|over)s? \(([0-9.]+) an over\)\./.exec(L.txt);
      if (!need) continue;
      checked++;
      assert.ok(String(L.txt).indexOf(m[2] + ' need ') > 0, 'the side chasing is named');
      // the equation agrees with the score on the same line
      const left = need[3] === 'over' ? +need[2] * 6 : +need[2];
      assert.equal(+need[1], target - (+m[3]),
        'what he needs is the target less the score on the same line');
      assert.ok(+need[1] > 0 && left > 0, 'nobody is asked for nought off nothing');
      assert.equal(left, 300 - +m[1] * 6, 'the balls left are the balls left');
      assert.equal(need[4], (+need[1] / (left / 6)).toFixed(2), 'and the rate is the division of the two');
      // overs while there are plenty, balls once it is worth counting them
      assert.equal(need[3], left > 36 ? 'over' : 'ball');
    }
  }
  assert.ok(checked > 30, 'plenty of overs actually carried the equation (' + checked + ')');
});

test('the first innings is not asked to chase anything', () => {
  for (const g of GAMES)
    for (const L of overBars(g).filter(L => L.inn === 0))
      assert.ok(!/need \d+ from /i.test(L.txt), 'nothing to chase yet: ' + L.txt);
});

test('the umpire says it, so the chronicle stops guessing', () => {
  // the report reconstructed the equation by scraping "Target N." off the
  // innings break and assuming fifty overs - wrong after rain, and now
  // redundant. It stands down when the bar already carries it, and stays for
  // cards banked before it did.
  assert.match(CHRON, /if \(target && L\.inn === 1 && !\/\\bneed \\d\+ from \/i\.test\(txtM\)\)/,
    'the fallback defers to the umpire');
});

test('whether a piece of fielding was good is the engine\'s own answer', () => {
  assert.match(CORE, /const FO_FLD_GOOD=\{save:1,catch:1,stumping:1,runout:1,\n\s*misfield:0,fumble:0,drop:0,stumpMiss:0\};/,
    'one map, both halves of the ledger');
  assert.match(CORE, /function foBallTagGood\(L\)\{/);
  assert.match(CORE, /if\(!k\|\|FO_FLD_GOOD\[k\]==null\)return null;/,
    'a ball that was not a piece of fielding gets no opinion, which is not the same as a bad one');
  // every kind the tag map names has a side; neither map may grow past the other
  const names = s => (CORE.match(new RegExp(s + '=\\{([^}]*)\\}'))[1].match(/(\w+)\s*:/g) || [])
    .map(x => x.replace(/\s*:$/, '')).sort();
  assert.deepEqual(names('FO_FLD_TAG'), names('FO_FLD_GOOD'),
    'the map that names an event and the map that judges it list the same events');
});

test('good work reads green and a mistake reads amber, everywhere it is shown', () => {
  // the report
  assert.match(CHRON, /var g = \(typeof foBallTagGood === "function"\) \? foBallTagGood\(L\) : null;/,
    'the report asks the engine first');
  assert.match(CHRON, /if \(g === 1\) tagCls = " good"; else if \(g === 0\) tagCls = " bad";/);
  assert.match(CHRON, /'<b class="fo-ctag' \+ tagCls \+ '">\[' \+ tag \+ '\]<\/b> '/);
  assert.match(CHRON, /"#ftpcomm \.fo-ctag\.good\{color:#177A57\}"/, 'a catch, a save, a run out: green');
  assert.match(CHRON, /"#ftpcomm \.fo-ctag\.bad\{color:#C2610A\}"/, 'a drop, a fumble, a misfield: amber');
  // a talent tag is the man's own and stays neutral
  assert.match(CHRON, /foBallTagKind\(L\) === "tal"/);
  // the live card
  assert.match(FEED, /"\.fo-fd \.fdtag\.g\{color:#177A57;/, 'the card keeps its green');
  assert.match(FEED, /"\.fo-fd \.fdtag\.b\{color:#B4600A;background:#FDF3E4;border:1px solid #ecd2a6\}"/,
    'and its error tag is amber now');
  assert.ok(!/\.fdtag\.b\{color:#B23230/.test(FEED),
    'a spilled catch no longer wears the colour a wicket wears');
});
