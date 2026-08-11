// test/finance-week.test.mjs — THE BOOKS A WEEK AT A TIME.
//
// The Sheet totalled the season from the founding. That answers "how has it
// gone" and never "can I afford him on Friday" - and the second is the
// question a manager actually opens this page with. So the books are a week:
// what came in, what went out, what is still promised - and above all of it,
// on its own plate, the one figure he came for: what he can spend today.
//
// Two rules hold the page honest. Every SETTLED figure is the umpire's own
// ledger entry, filtered to the week rather than counted again, so this page
// and the statement can never disagree. And the two forward-looking lines -
// a man of yours out to bid, a bid of yours leading - are marked as
// projections, kept out of a week that is already over, and never folded
// into available funds on the side that would flatter it.
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIN = readFileSync(join(ROOT, 'engine', 'src', 'league', '43-finance.js'), 'utf8');
const code = FIN.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');

test('a week is a filter over the ledger, not a second set of books', () => {
  assert.match(code, /var wkLines = \(FTX\.lines \|\| \[\]\)\.filter\(function \(l\) \{/,
    'the week is drawn from the statement the umpire writes');
  assert.match(code, /return t >= shownWk\.from && t < shownWk\.to;/, 'by the instant each entry happened');
  // and the window is the world's own week: day 0 is a Monday and the season
  // is forty-two days, so the weekday is the day index modulo seven
  assert.match(code, /var mon = d - \(\(d % 7\) \+ 7\) % 7;/, 'back to the world\'s Monday');
  assert.match(code, /from: PL\.EPOCH \+ mon \* PL\.DAY, to: PL\.EPOCH \+ \(mon \+ 7\) \* PL\.DAY/);
});

test('every settled line names a kind the umpire actually writes', () => {
  // the ledger's own vocabulary (036 and after) - a heading that names a kind
  // nothing writes is a row that reads zero for ever
  const STK = FIN.slice(FIN.indexOf('var STK = {'), FIN.indexOf('};', FIN.indexOf('var STK = {')));
  const kinds = [...code.matchAll(/sumKind\(\[([^\]]+)\]/g)]
    .flatMap(m => [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]));
  assert.ok(kinds.length >= 12, 'the page reads a dozen kinds or more (' + kinds.length + ')');
  kinds.forEach(k => assert.ok(STK.indexOf('"' + k + '"') > -1 || STK.indexOf(k + ':') > -1,
    '"' + k + '" is a kind the statement knows how to head'));
});

test('a projection is money that has not moved, and is marked as such', () => {
  assert.match(code, /\["Player sales &middot; out to bid", pjSell, true\]/, 'a man of yours with a bid on him');
  assert.match(code, /\["Player purchases &middot; leading bid", pjBuy, true\]/, 'and a bid of yours in front');
  assert.match(code, /r\[2\] \? " pj" : ""/, 'the row wears the projection class');
  assert.match(FIN, /\.fo-wk-row\.pj u:after\{content:'projected'/, 'and the class says the word');
  // a settled week has nothing in flight
  assert.match(code, /var keep = function \(r\) \{ return projecting \|\| !r\[2\]; \};/,
    'the projections are dropped from a week that is over');
  assert.match(code, /if \(!projecting\) \{ pjSell = 0; pjBuy = 0; \}/, 'and zeroed before they can be summed');
});

test('available funds counts what you owe, never what you hope for', () => {
  assert.match(code, /var avail = bank - owed;/,
    'the bank less the bids you would have to honour - a sale that has not fallen is not money');
  // and what is owed is read BEFORE a settled week zeroes the projections: the
  // ledger below belongs to a week, the plate above it belongs to today, and a
  // plate that changed when the reader looked at last week would be a lie
  assert.match(code, /var owed = pjBuy;\n\s*if \(!projecting\) \{ pjSell = 0; pjBuy = 0; \}/,
    'the bids you lead are owed on both tabs');
  // the leading bid is read off the board, against the club's own name
  assert.match(code, /if \(String\(b\.high_club \|\| ""\) === String\(cl9\.club \|\| ""\)\) pjBuy \+= Number\(b\.high\) \|\| 0;/,
    'you lead a bid when the board says the high bid is yours');
});

// THE PLATE CARRIES ONE FIGURE. It used to carry three: a projected overall
// balance in the big type, and under a divider a projected weekly balance
// beside available funds. Three numbers in a row is three numbers a reader has
// to rank before he can act, and two of them were projections - money that had
// not moved - printed in the position that reads as fact. What a manager opens
// this page to find is what he can spend, so that is the only thing on it.
test('the plate is available balance and nothing else', () => {
  // the markup, not the stylesheet above it - both name these classes
  const at = code.indexOf("<section class='fo-wk-hero'>");
  const hero = code.slice(at, code.indexOf("<div class='fo-wk-band'>", at));
  assert.match(hero, /<span class='lbl'>Available balance<\/span>/, 'named plainly');
  assert.match(hero, /<b class='big num'>" \+ MFull\(avail\) \+ "<\/b>/, 'in the big type, and it is the available figure');
  // one big figure, and no second number smuggled in beside it
  assert.equal((hero.match(/class='big/g) || []).length, 1, 'exactly one figure wears the big type');
  ['MFull(projBal', 'M(wkNet', 'fo-wk-pair', 'fo-wk-rule'].forEach(gone =>
    assert.ok(code.indexOf(gone) < 0, gone + ' is gone from the page'));
  ['Projected overall balance', 'Projected weekly balance', "Balance at the week's end", "The week's balance"]
    .forEach(gone => assert.ok(code.indexOf(gone) < 0, '"' + gone + '" is not printed anywhere'));
  // and the dead skin went with the markup
  ['.fo-wk-pair', '.fo-wk-rule', '.lbl.warm'].forEach(sel =>
    assert.ok(FIN.indexOf(sel) < 0, sel + ' has no rules left'));
  // the week is still told, just underneath: the two totals and the ledgers
  assert.match(code, /<div class='fo-wk-band'>/, 'income and expenses still stand under the plate');
});

test('the page a reader was given is the page that is gone', () => {
  assert.ok(!/fo-tre-cols/.test(code), 'the two season columns are gone');
  assert.ok(!/fo-tre-desk/.test(code), 'and the desk that hung under them');
  // what survived is what the room still owns: the academy is bought out of
  // the books, so its lever stays; the ground and the ticket moved to #/ground
  assert.match(code, /id='fo-fin-acad'/, 'the academy is still bought here');
  assert.ok(!/id='fo-tk-set'/.test(code.slice(code.indexOf("var html2 = \"<div class='fo-wk'>"))),
    'and the ticket dial is not, because it belongs to the ground');
});
