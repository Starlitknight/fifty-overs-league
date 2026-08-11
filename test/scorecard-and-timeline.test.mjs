// test/scorecard-and-timeline.test.mjs — A CARD THAT FITS, A RIBBON THAT FITS.
//
// TWO ROOMS THAT RAN OFF THE EDGE OF THEMSELVES.
//
// The live scorecard was a five-column table. A man's name wrapped onto two
// lines and his dismissal onto two more, so a batter took ~90px of a phone and
// an innings ran past three screens. It is a card now: one row a man, his
// dismissal in the small print beneath his name, and three tight columns of
// figures. What colour there is has a job - indigo for a man at the crease,
// bronze for a hundred, green for the bowler in his spell.
//
// The club's story was a flex row with a fixed 110px gap. Eight marks needed
// 770px of gap before a single word was set, and a flex item cannot shrink
// below its own longest word, so a club with a long history pushed its last
// seasons off the right of the card and off the page with them. The marks
// share the width now, one track each.
import { test } from 'node:test';
import assert from 'node:assert';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const L = join(dirname(fileURLToPath(import.meta.url)), '..', 'engine', 'src', 'league');
const feed = readFileSync(join(L, '44-feed-match.js'), 'utf8');
const club = readFileSync(join(L, '40-club-page.js'), 'utf8');

// ---- the card -------------------------------------------------------------
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
  };
  const ctx = vm.createContext({ Math, String, Number, parseFloat, encodeURIComponent });
  vm.runInContext('function E(s){return String(s==null?"":s);}' +
    'function surname(n){var a=String(n||"").split(" ");return a[a.length-1];}' +
    'function bKey(n){return String(n||"").toLowerCase().replace(/[^a-z]/g,"");}' +
    'function plink(n){return E(n);} function pstar(){return "";} function sStars(){return "";}' +
    'var T={rid:"eng"};', ctx);
  vm.runInContext([grab('parseTop'), grab('howOut'), grab('fdEngineXI'), grab('fdYetToBat'), grab('cardPanel')].join('\n'), ctx);
  return vm.runInContext('cardPanel', ctx);
}
const cardPanel = liftCard();
const B = (nm, r, b, out) => ({ nm, r, b, out });
const INN = {
  team: 'Derbyshire', open: true, close: null, lastNo: '48.2', bowler: 'Nathan Wright',
  top: { txt: 'End of over 48 (7 runs) - Derbyshire 279/7.' },
  bats: [B('Tom Cole', 28, 51, { how: 'caught', bowler: 'Nathan Wright', fld: 'Ben Cole' }),
         B('Eddie Norris', 108, 99, null),
         B('Louis Chadwick', 21, 32, { how: 'bowled', bowler: 'Tom Radcliffe' }),
         B('Joe Hollins', 1, 2, null)],
  bowls: [{ nm: 'Nathan Wright', o: 10, r: 52, w: 3 }, { nm: 'Will Mercer', o: 10, r: 49, w: 1 }],
  brk: null
};
const M = { home: { name: 'Derbyshire' }, away: { name: 'Mashed Potatoes' } };
const html = cardPanel([INN, { open: false, bats: [], bowls: [], top: null, close: null }], M, false);

test('a batter is one row, not a table cell that wraps four times', () => {
  assert.ok(!/<table/.test(html), 'the card is not a table any more');
  assert.equal((html.match(/class='fd-sc-r/g) || []).length, 4, 'one row a man');
  assert.match(html, /<div class='w'><b>Tom Cole/, 'his name leads the row');
  assert.match(html, /<i>c Cole b Wright<\/i>/, 'his dismissal is the small print beneath it');
});

test('the two men not out are marked at the crease while the innings is live', () => {
  const on = html.match(/class='fd-sc-r on/g) || [];
  assert.equal(on.length, 2, 'exactly the two not-out men');
  assert.match(html, /not out &middot; at the crease/, 'and the row says so in words too');
  // a closed innings has nobody at the crease
  const shut = cardPanel([Object.assign({}, INN, { close: { runs: 279, wkts: 7 }, open: false }),
    { open: false, bats: [], bowls: [], top: null, close: null }], M, true);
  assert.ok(!/fd-sc-r on/.test(shut), 'stumps: nobody is at the crease');
  assert.ok(!/LIVE/.test(shut), 'and it is not live');
});

test('a hundred and the bowler in his spell are marked from real state', () => {
  assert.match(html, /class='fd-sc-r on ton'/, 'the centurion carries the milestone mark');
  assert.equal((html.match(/class='fd-sc-b on'/g) || []).length, 1, 'one bowler is in his spell');
  assert.match(html, /class='fd-sc-b on'><b>Nathan Wright/, 'and it is the one who bowled the last ball');
});

test('the head carries the score, the overs and the run rate', () => {
  assert.match(html, /<em>279\/7<\/em>/);
  assert.match(html, /48\.2 overs &middot; RR 5\.7[0-9]/, 'the rate is runs over overs, not a guess');
  assert.match(html, /7 wickets &middot; 48\.2 overs<\/span><b>279<\/b>/, 'and the foot totals it');
});

// A MAN'S NAME IS THE ONE THING ON HIS ROW THAT CANNOT BE ABBREVIATED, and it
// was the only thing being cut. The ten-star strip carried flex-basis:100%,
// written for the crease box where the strip belongs on a line of its own
// under the name. A card row does not wrap, so on a column thirteen hundred
// pixels wide the strip claimed all of it and the anchor beside it shrank to
// its minimum: "Reuben Whiteh...", "F. Ogden (rf...", with an acre of white
// space to the right of both.
test('the star strip takes what it needs, not the whole row', () => {
  assert.match(feed, /"\.fo-fd \.fd-sc-r \.ss,\.fo-fd \.fd-sc-b \.ss\{flex:0 0 auto;margin-top:0\}"/,
    'the strip stops claiming the line in a card row');
  assert.match(feed, /"\.fo-fd \.fd-sc-r \.w b,\.fo-fd \.fd-sc-b b\{flex-wrap:wrap\}"/,
    'and where the two really will not fit, the strip wraps rather than eating him');
  // the crease box keeps the rule the basis was written for
  assert.match(feed, /"\.fo-fd \.ss\{display:block;flex-basis:100%;margin-top:1px\}"/);
  // the clipping itself stays: a name long enough to break the grid still
  // ellipses rather than pushing the figures off the card
  assert.match(feed, /"\.fo-fd \.fd-sc-r \.w b>a,\.fo-fd \.fd-sc-b b>a\{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\}"/);
});

test('the bowling figures are headed, in the same grid they are printed in', () => {
  assert.match(html, /<div class='fd-sc-c bwl'><span>Bowling<\/span><span>O<\/span><span title='maiden overs'>M<\/span><span>R<\/span><span>W<\/span><span title='wides and no-balls charged to him'>Ex<\/span><span>Econ<\/span><\/div>/,
    'the figures a real card carries - overs, maidens, runs, wickets, extras, economy - each one named');
  // the head and the rows are one grid declaration, so a column added to one
  // can never sit over a different column in the other
  assert.match(feed, /"\.fo-fd \.fd-sc-b,\.fo-fd \.fd-sc-c\.bwl\{display:grid;grid-template-columns:minmax\(0,1fr\) 28px 24px 32px 22px 26px 40px;/);
  assert.ok(!/fd-sc-bh/.test(feed), 'the unlabelled caption it replaced is gone, CSS and all');
});

// ---- the ribbon -----------------------------------------------------------
test('the club story shares its width instead of running off the card', () => {
  assert.match(club, /grid-auto-flow:column;" \+\s*"grid-auto-columns:minmax\(0,1fr\)/,
    'one track a mark, however many there are');
  assert.ok(!/\.fo-cd-tl \.tl\{[^"]*gap:110px/.test(club), 'the fixed 110px gap is gone');
  assert.ok(!/\.fo-cd-tl \.m\{[^"]*max-width:200px/.test(club),
    'and the cap that stopped a mark shrinking with it');
  assert.match(club, /\.fo-cd-tl \.m\{[^"]*min-width:0/, 'a mark may shrink below its longest word');
  assert.match(club, /overflow-x:auto/, 'and if it still cannot fit, the lane scrolls');
});

test('the thread between the marks knows how many there are', () => {
  assert.match(club, /left:calc\(50% \/ var\(--n,1\)\);right:calc\(50% \/ var\(--n,1\)\)/,
    'it runs from the first dot to the last');
  assert.match(club, /<div class='tl' style='--n:" \+ tlShown\.length \+ "'>/,
    'and the count is the number of marks actually drawn');
});
