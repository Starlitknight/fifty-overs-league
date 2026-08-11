// test/extras-add-up.test.mjs — A SCORECARD THAT ADDS UP.
//
// The umpire's total has always counted wides, no-balls, byes and leg byes.
// The rows under it counted none of them. So every card in the game printed a
// score the batting could not reach - four runs adrift in a typical innings,
// and nothing on the page to say where they went. A reader who adds a card up
// and finds it short does not conclude that extras exist; he concludes the
// figures are wrong.
//
// Two cards print a total and both now print the extras.
//
// THE FULL CARD reads the four counters off the innings. They are banked with
// the match from now on (enginehost slim), and for every match played before
// that they were never kept - so the figure is derived instead, because extras
// ARE the total less the batting. An old card names the number and not the
// breakdown, which is the honest version of what is known about it.
//
// THE LIVE CARD has no counters to read: it is built from the umpire's running
// commentary, and an over summary carries the score and the two men at the
// crease, never the byes. So it subtracts - and the whole risk lives here,
// because a subtraction is only extras if nobody is missing from it. A book
// the broadcast has not finished, or one whose early overs have been pruned,
// is short of batters, and subtracting then measures the missing men rather
// than the byes. The card has to account for everyone who has been to the
// middle before it will print the line.
import { test } from 'node:test';
import assert from 'node:assert';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const feed = readFileSync(join(ROOT, 'engine', 'src', 'league', '44-feed-match.js'), 'utf8');
const SCI = readFileSync(join(ROOT, 'engine', 'src', 'league', '12-scorecard-analysis.js'), 'utf8');
const HOST = readFileSync(join(ROOT, 'server', 'enginehost.mjs'), 'utf8');

// the same lift the live-card test uses: one function, its own braces
function liftCard() {
  const grab = name => {
    const at = feed.indexOf('function ' + name + '(');
    if (at < 0) throw new Error('missing ' + name);
    let d = 0, q = null, esc = false;
    for (let j = feed.indexOf('{', at); j < feed.length; j++) {
      const c = feed[j];
      if (q) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === q) q = null; continue; }
      if (c === '"' || c === "'" || c === '`') { q = c; continue; }
      if (c === '/' && feed[j + 1] === '/') { j = feed.indexOf('\n', j); continue; }
      if (c === '{') d++; else if (c === '}') { d--; if (!d) return feed.slice(at, j + 1); }
    }
    throw new Error('unbalanced ' + name);
  };
  const ctx = vm.createContext({ Math, String, Number, parseFloat, encodeURIComponent });
  vm.runInContext('function E(s){return String(s==null?"":s);}' +
    'function surname(n){var a=String(n||"").split(" ");return a[a.length-1];}' +
    'function bKey(n){return String(n||"").toLowerCase().replace(/[^a-z]/g,"");}' +
    'function plink(n){return E(n);} function pstar(){return "";} function sStars(){return "";}' +
    'var T={rid:"eng"};', ctx);
  vm.runInContext([grab('parseTop'), grab('howOut'), grab('cardPanel')].join('\n'), ctx);
  return vm.runInContext('cardPanel', ctx);
}
const cardPanel = liftCard();
const M = { home: { name: 'Derbyshire' }, away: { name: 'Mashed Potatoes' } };
const EMPTY = { open: false, bats: [], bowls: [], top: null, close: null };
const B = (nm, r, b, out) => ({ nm, r, b, out });
const gone = { how: 'bowled', bowler: 'N. Wright' };
// six down, two in: eight men to the middle, and the umpire's own score
const SIX_DOWN = {
  team: 'Derbyshire', open: true, close: null, lastNo: '23.4', bowler: 'N. Wright',
  top: { txt: 'End of over 23 (5 runs) - Derbyshire 125/6.' },
  bats: [B('Tom Cole', 16, 17, gone), B('Henry Barker', 26, 23, gone), B('Reuben Whitehead', 1, 1, gone),
         B('Daniel Gibbs', 40, 47, null), B('George Brown', 9, 14, gone), B('Eddie Norris', 6, 10, gone),
         B('Louis Chadwick', 10, 12, gone), B('Archie Wright', 15, 8, null)],
  bowls: [{ nm: 'N. Wright', o: 8, r: 40, w: 3 }], brk: null
};
const exRow = html => {
  const m = /class='fd-sc-r fd-sc-ex'><div class='w'><b>Extras<\/b><\/div><div class='r'>(\d+)</.exec(html);
  return m ? +m[1] : null;
};

test('the live card names the extras, and they are the score less the batting', () => {
  // 16+26+1+40+9+6+10+15 = 123 against the umpire's 125
  const html = cardPanel([SIX_DOWN, EMPTY], M, false);
  assert.equal(exRow(html), 2, 'two runs the batters never made');
  // and the total the card ends on is still the umpire's own
  assert.match(html, /<div class='fd-sc-t'><span>6 wickets[^<]*<\/span><b>125<\/b>/);
});

test('an innings that gave away nothing says so, rather than saying nothing', () => {
  const level = Object.assign({}, SIX_DOWN, {
    top: { txt: 'End of over 23 (5 runs) - Derbyshire 123/6.' } });
  assert.equal(exRow(cardPanel([level, EMPTY], M, false)), 0, 'a nought is a fact about the innings');
});

test('a card missing a batter prints no extras at all', () => {
  // THE FAILURE THIS GUARDS. Six down means eight men have been in; a card
  // holding four of them would report the other four's runs as extras.
  const partial = Object.assign({}, SIX_DOWN, { bats: SIX_DOWN.bats.slice(0, 4) });
  assert.equal(exRow(cardPanel([partial, EMPTY], M, false)), null,
    'a missing line is better than a wrong number');
  // nor mid-over, when a new man is on the card with no tally published yet
  const fresh = Object.assign({}, SIX_DOWN, {
    bats: SIX_DOWN.bats.slice(0, 7).concat([B('Archie Wright', null, null, null)]) });
  assert.equal(exRow(cardPanel([fresh, EMPTY], M, false)), null, 'nor before his first summary');
});

test('all out is ten men, not twelve', () => {
  // the two-at-the-crease allowance is wrong once the side is bowled out, and
  // demanding twelve names would silence the line on every completed innings
  const allOut = {
    team: 'Derbyshire', open: false, close: { runs: 160, wkts: 10 }, lastNo: '41.2',
    top: { txt: 'End of over 41 (3 runs) - Derbyshire 160/10.' },
    bats: Array.from({ length: 10 }, (_, i) => B('Man ' + i, 15, 20, gone)),
    bowls: [{ nm: 'N. Wright', o: 9, r: 40, w: 4 }], brk: null
  };
  assert.equal(exRow(cardPanel([allOut, EMPTY], M, true)), 10, '160 less 150');
});

test('the full card reads the counters when it has them and derives when it does not', () => {
  const code = SCI.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  assert.match(code, /var ex = inn\.extras \|\| null;/, 'the breakdown, if the card was banked with one');
  assert.match(code, /var batN = \(inn\.bat \|\| \[\]\)\.reduce\(function \(t, b\) \{ return t \+ \(Number\(b\.r\) \|\| 0\); \}, 0\);/);
  assert.match(code, /var exN = ex \? \(ex\.wd \+ ex\.nb \+ ex\.b \+ ex\.lb\) : Math\.max\(0, \(Number\(inn\.runs\) \|\| 0\) - batN\);/,
    'and the same subtraction when it was not');
  // the breakdown is printed only when it is known - a row reading
  // "(b 0, lb 0, w 0, nb 0)" beside a figure of 4 is a card arguing with itself
  assert.match(code, /\(ex \? " <span>\(b " \+ ex\.b \+ ", lb " \+ ex\.lb \+ ", w " \+ ex\.wd \+ ", nb " \+ ex\.nb \+ "\)<\/span>" : ""\)/);
});

test('the umpire banks the four counters with the card from now on', () => {
  assert.match(HOST, /var ex = inn\.extras \|\| null;/);
  assert.match(HOST, /extras: ex \? \{ wd: ex\.wd \| 0, nb: ex\.nb \| 0, b: ex\.b \| 0, lb: ex\.lb \| 0 \} : null,/,
    'the engine\'s own four, and null for an engine that kept none');
  // they are a fact about the innings, not about the batters - the card's own
  // shape stays exactly as it was otherwise
  assert.match(HOST, /return \{ p: b\.p, r: b\.r, b: b\.b, f4: b\.f4 \|\| 0, f6: b\.f6 \|\| 0, out: b\.out \};/);
});
