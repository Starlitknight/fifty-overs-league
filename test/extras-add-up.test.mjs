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

// the same lift the live-card test uses: one function, its own braces.
// `order` is the teamsheet the broadcast would be holding - the card asks for
// it to name the men still to come, and answers with nothing when there is
// none, which is the state every test but one here runs in.
function liftCard(order) {
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
    'var T=' + JSON.stringify({ rid: 'eng', id: 'm1',
      ord: order ? { m1: { Derbyshire: { batOrder: order } } } : undefined }) + ';', ctx);
  vm.runInContext([grab('parseTop'), grab('howOut'), grab('fdEngineXI'), grab('fdYetToBat'), grab('cardPanel')].join('\n'), ctx);
  return vm.runInContext('cardPanel', ctx);
}
const cardPanel = liftCard();
const liftWithOrder = (xi, fn) => fn(liftCard(xi));
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

// AND THE CARD SAYS WHO GAVE THEM AWAY. An innings total of extras answers
// "how many"; a manager reading a bowling card wants "whose". The umpire's
// figure line is overs-runs-wickets and never breaks his runs down, but the
// deliveries do, so the wides and no-balls are counted off the book as they
// go by. Byes are deliberately not counted: a ball the keeper missed is not
// the bowler's, and charging him for it would be a new lie in place of the
// old silence - which is also why this column and the innings extras above it
// are not expected to agree.
test('a bowling card says which bowler gave the extras away', () => {
  const w = { ...SIX_DOWN, bowls: [{ nm: 'N. Wright', o: 8, r: 40, w: 3 }, { nm: 'F. Ogden', o: 8, r: 50, w: 3 }],
    // keyed the way the card keys a bowler (bKey), which the lift stubs
    exBy: { nwright: 5, fogden: 0 } };
  const html = cardPanel([w, EMPTY], M, false);
  const ex = [...html.matchAll(/<span class='ex[^']*'>(\d+)<\/span>/g)].map(m => +m[1]);
  assert.deepEqual(ex, [5, 0], 'his own wides, and a nought for the man who bowled straight');
  // the counting itself: wides and no-balls, by their run value, charged to
  // the bowler who sent them down - and byes left out of it
  const book = feed.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  assert.match(book, /if \(r\.bowlerNm && \(r\.out === "wide" \|\| r\.out === "noball"\)\) \{/);
  assert.match(book, /I\.exBy\[ke\] = \(I\.exBy\[ke\] \|\| 0\) \+ ballRuns\(r\);/);
  // an innings built by hand, or by an older build, simply has no tally
  assert.match(book, /var ex9 = \(I\.exBy && I\.exBy\[bKey\(w9\.nm\)\]\) \|\| 0;/);
});

// WHO IS STILL PADDED UP. A card listing only the men who have been in answers
// "what has happened" and never "what is left" - and the second is the
// question a reader watching a collapse is actually asking.
test('the card names the men still to come, from the order the teamsheets print', () => {
  const XI = ['Tom Cole', 'Henry Barker', 'Reuben Whitehead', 'Daniel Gibbs', 'George Brown',
    'Eddie Norris', 'Louis Chadwick', 'Archie Wright', 'Frank Ogden', 'Nathan Wright', 'Tom Mercer'];
  const withOrd = fn => liftWithOrder(XI, fn);
  const html = withOrd(cp => cp([SIX_DOWN, EMPTY], M, false));
  assert.match(html, /<div class='fd-sc-yet'><span>Yet to bat<\/span>/, 'named while the innings is alive');
  assert.match(html, /Frank Ogden, Nathan Wright, Tom Mercer/, 'the three who have not been in, in order');
  // ...and nobody who has: the umpire abbreviates in his summaries and a
  // teamsheet does not, so the match is by initial and surname
  assert.ok(!/Daniel Gibbs<\/a>, /.test(html.slice(html.indexOf('fd-sc-yet'))), 'not a man already at the crease');
  // once the innings is shut they did not bat, they are not yet to
  const shut = withOrd(cp => cp([{ ...SIX_DOWN, open: false, close: { runs: 125, wkts: 6 } }, EMPTY], M, true));
  assert.match(shut, /<span>Did not bat<\/span>/);
  // and with no sheet and no squad to pick from, the line is simply absent
  assert.ok(!/fd-sc-yet/.test(cardPanel([SIX_DOWN, EMPTY], M, false)), 'never a guess at an eleven');
});

// HOW IT FELL APART. Six down tells a reader the state; it does not tell him
// that five of them went in eleven overs, which is the whole story of a
// collapse. The umpire writes a partnership line at every wicket and the book
// has always kept them - the card simply never printed them.
test('the card prints the fall of wickets, in the game own shorthand', () => {
  const fow = [{ w: 1, score: 24, nm: 'Tom Cole', no: '6.3' },
               { w: 2, score: 58, nm: 'Henry Barker', no: '12.1' },
               { w: 3, score: 59, nm: 'Reuben Whitehead', no: '12.4' }];
  const html = cardPanel([{ ...SIX_DOWN, fow }, EMPTY], M, false);
  const at = html.indexOf("fd-sc-fow");
  assert.ok(at > 0, 'the line is drawn');
  const line = html.slice(at, html.indexOf('</div></div>', at));
  assert.match(line, /<span>Fall of wickets<\/span>/);
  assert.match(line, /<u>1-24<\/u> <s>\(Cole, 6\.3\)<\/s>/, 'the wicket, the score, the man, the ball');
  assert.match(line, /<u>3-59<\/u> <s>\(Whitehead, 12\.4\)<\/s>/, 'and in the order they fell');
  // it sits under the total, where a card has always carried it, and above
  // the bowling that took them
  assert.ok(html.indexOf("fd-sc-t") < at && at < html.indexOf("fd-sc-c bwl"));
  // an innings with nothing down says nothing rather than heading an empty list
  assert.ok(!/fd-sc-fow/.test(cardPanel([SIX_DOWN, EMPTY], M, false)), 'no wickets, no line');
});

test('the umpire banks the four counters with the card from now on', () => {
  assert.match(HOST, /var ex = inn\.extras \|\| null;/);
  assert.match(HOST, /extras: ex \? \{ wd: ex\.wd \| 0, nb: ex\.nb \| 0, b: ex\.b \| 0, lb: ex\.lb \| 0 \} : null,/,
    'the engine\'s own four, and null for an engine that kept none');
  // they are a fact about the innings, not about the batters - the card's own
  // shape stays exactly as it was otherwise
  assert.match(HOST, /return \{ p: b\.p, r: b\.r, b: b\.b, f4: b\.f4 \|\| 0, f6: b\.f6 \|\| 0, out: b\.out \};/);
});
