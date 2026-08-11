// test/end-of-over-and-nations.test.mjs — TWO ROWS THAT SAID NOTHING.
//
// THE END OF AN OVER was printed as one more line of commentary: a bullet
// where the ball number goes and the umpire's sentence beside it. The one row
// a reader uses to find where the match has actually got to looked exactly
// like the six that preceded it. It is a band now, and the second line of it -
// the men at the crease and the bowler's figures - is the umpire's own
// over-summary, which the page has carried in the log all along and never
// printed.
//
// THE NATIONS TABLE ranked the world on match marks. A national XI has usually
// played nothing, so every country showed the same neutral base beside its
// name, and the order was one round of club results - which put Afghanistan,
// an associate, first in the world and England eleventh. The world deals every
// country a rung; the table reads the rung now, and the marks are form.
import { test } from 'node:test';
import assert from 'node:assert';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rep = readFileSync(join(ROOT, 'engine', 'src', 'league', '14-match-report.js'), 'utf8');
const rk = readFileSync(join(ROOT, 'engine', 'src', 'league', '39-rankings.js'), 'utf8');
const tick = readFileSync(join(ROOT, 'server', 'tick.mjs'), 'utf8');

function liftCommentary() {
  const at = rep.indexOf('function foMrCommentary(');
  let d = 0, q = null, esc = false, end = -1;
  for (let j = rep.indexOf('{', at); j < rep.length; j++) {
    const c = rep[j];
    if (q) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '/' && rep[j + 1] === '/') { j = rep.indexOf('\n', j); continue; }
    if (c === '{') d++; else if (c === '}') { d--; if (!d) { end = j + 1; break; } }
  }
  const ctx = vm.createContext({ Math, String, Number, window: {} });
  vm.runInContext('function E(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;");}' +
    'function foMrNone(a){return a;} function foMrMend(s){return s;}' +
    'var FO_MR_MARK={"\\u2605":1,"\\u2691":1,"\\u25b6":1};' +
    'function foMrIsKey(L){var o=String(L.out||"");return !!FO_MR_MARK[o];}' +
    'var FO_MR_FILTERS=[["all","Every ball"]];' +
    'function foCommPass(){return true;} function foBallTag(){return null;} function foBallTagKind(){return null;}', ctx);
  vm.runInContext(rep.slice(at, end), ctx);
  return vm.runInContext('foMrCommentary', ctx);
}
const comm = liftCommentary();
const LOG = [
  { no: '1.1', out: 'dot', inn: 0, txt: 'Ogden to Cole : Length, shaping away late.' },
  { no: '', out: '•', inn: 0, _top: true,
    txt: 'End of over 1 (5 runs) - Derbyshire 5/0. Noah Wright 1-5-0.',
    oversumTop: '<strong>T. Cole</strong> 4 (5b), <strong>N. Wright (rfm)</strong> 1-5-0' },
  { no: '0.6', out: '1', inn: 0, txt: 'Wright to Cole : nudged for one.' }
];
const html = comm({ log: LOG, ix: 0 }, { text: '' }, 'all', t => '#/report?t=' + t);

test('the end of an over is a band, not another ball', () => {
  assert.match(html, /<div class='fo-mr-eov'>/, 'it gets a row type of its own');
  // and it is NOT rendered as a ball row as well
  assert.equal((html.match(/fo-mr-ball/g) || []).length, 2, 'only the two deliveries are ball rows');
});

test('the band says the over, its cost, the score and the rate', () => {
  assert.match(html, /<b>End of over 1<\/b><span>5 runs<\/span>/);
  assert.match(html, /<b>Derbyshire<\/b><em>5\/0<\/em>/);
  assert.match(html, /<i>RR 5\.00<\/i>/, 'the rate is the score over the overs, not a guess');
});

test('the second line is the umpire own over-summary, printed at last', () => {
  assert.match(html, /<div class='w'><strong>T\. Cole<\/strong> 4 \(5b\), <strong>N\. Wright \(rfm\)<\/strong> 1-5-0<\/div>/,
    'the men at the crease and the bowler, exactly as the umpire wrote them');
});

test('an over the umpire did not print plainly still reads as a line', () => {
  const odd = comm({ log: [{ no: '', out: '•', inn: 0, _top: true, txt: 'End of over 3.' }], ix: 0 },
    { text: '' }, 'all', t => '#');
  assert.ok(!/fo-mr-eov/.test(odd), 'a print it cannot parse is not forced into the band');
  assert.match(odd, /fo-mr-ball/, 'it falls back to an ordinary row rather than vanishing');
});

// ---- the nations ----------------------------------------------------------
test('a nation is ranked on the rung the world deals it', () => {
  assert.match(tick, /natRating: Math\.round\(BASE_XI \* nationTeamStr\(c\.id\)\)/,
    'what the shirt is worth is the rung the selectors XI is calibrated to');
  assert.match(tick, /clubRating: clubStrength/, 'and a league is worth its clubs best elevens');
  assert.match(tick, /\.sort\(\(a, b\) => b\.natRating - a\.natRating \|\| b\.clubRating - a\.clubRating/,
    'the order is strength, then league strength');
  assert.match(tick, /full: isFullMember\(c\.id\)/, 'and the table can say which kind of member it is');
});

test('the match marks are still served, as form', () => {
  assert.match(tick, /natForm: strengthRating\(N\[c\.id\]\.hist\)/);
  assert.match(tick, /clubForm: strengthRating\(marks\)/);
  // the old keys are gone from the ranking, so nothing can read a mark as a rung
  assert.ok(!/clubRating: strengthRating\(marks\)/.test(tick), 'a mark is not a strength');
  assert.ok(!/natRating: strengthRating\(/.test(tick), 'and neither is an XI mark');
});

test('the page prints a rung on the strength scale, not the day scale', () => {
  assert.match(rk, /rkStr\(\{ strength: n\.natRating \}\)/, 'the XI figure is a strength');
  assert.match(rk, /rkStr\(\{ strength: n\.clubRating \}\)/, 'and so is the league figure');
  assert.ok(!/fmtDay\(n\.natRating\)/.test(rk), 'neither goes through the day-mark scale any more');
});

// A NAME, A FIGURE, AND NOTHING ARGUING WITH THEM. Every row carried a badge
// beside the club - YOU, FLAGSHIP, a star with the titles on it - and the
// nations table wore FULL MEMBER or ASSOCIATE. On a phone the badges won: the
// names truncated to make room for them.
test('a ranking row is a name and a figure, with no badge between', () => {
  assert.match(rk, /"<b>" \+ E\(c\.name\) \+ "<\/b>"/, 'a club row is its name');
  assert.match(rk, /"<b>" \+ E\(n\.name\) \+ "<\/b>"/, 'and so is a nation row');
  // the file may still NARRATE the badges - this note does - so read the code
  // the page runs, not the prose around it
  const code = rk.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  ['YOU<\/em>', 'FLAGSHIP', 'FULL MEMBER', 'ASSOCIATE', 'honourStar'].forEach(function (chip) {
    assert.ok(!new RegExp(chip).test(code), 'no row wears "' + chip + '" any more');
  });
});
