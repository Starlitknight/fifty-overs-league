// test/finance-week.test.mjs — THE BOOKS A WEEK AT A TIME.
//
// The Sheet totalled the season from the founding. That answers "how has it
// gone" and never "can I afford him on Friday" - and the second is the
// question a manager actually opens this page with. So the books are a week:
// what came in, what went out, what is still promised, and the balance those
// three leave him standing on.
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
  assert.match(code, /var avail = bank - pjBuy;/,
    'the bank less the bids you would have to honour - a sale that has not fallen is not money');
  assert.match(code, /var projBal = bank \+ \(projecting \? \(pjSell - pjBuy\) : 0\);/,
    'the projected balance says so on its face, and only while the week is live');
  // the leading bid is read off the board, against the club's own name
  assert.match(code, /if \(String\(b\.high_club \|\| ""\) === String\(cl9\.club \|\| ""\)\) pjBuy \+= Number\(b\.high\) \|\| 0;/,
    'you lead a bid when the board says the high bid is yours');
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
