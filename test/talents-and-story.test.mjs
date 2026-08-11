// test/talents-and-story.test.mjs — TWO THINGS A PAGE COULD NOT SAY.
//
// THE TALENT FILTER answered from a word list. "Bouncer" is a talent, and it
// is also an ordinary short ball, so "A sharp bouncer at the badge" - a ball
// on which nothing whatever fired - passed the Ability triggers filter five
// times an innings. Worse, having matched on a loose word, the page had no
// name to put in the bracket beside it, so the reader was shown a plain row
// under a heading that promised a talent. The stamp the engine writes is the
// truth; where a log predates it, the engine's OWN SENTENCE names which one,
// and the filter and the bracket now read the same two things in the same
// order, so a ball the filter shows always has a name to wear.
//
// THE STORY SO FAR was a heading with nothing under it. It read a book the
// chronicle writes as a match is watched on this device, so in the served
// world - where the umpire plays every round while nobody is looking - it was
// empty for every cricketer alive, and the card printed its stand-in line,
// "Next match · League debut", to men with hundreds of appearances behind
// them. His moments come off the record now (living.mjs folds them), and the
// rail's Next assignment card, which was the only other thing on the page
// promising a fixture, is gone with it.
import { test } from 'node:test';
import assert from 'node:assert';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CORE = readFileSync(join(ROOT, 'engine', 'src', '00-core.js'), 'utf8');
const PP = readFileSync(join(ROOT, 'engine', 'src', 'league', '41-player-page.js'), 'utf8');
const LIVING = readFileSync(join(ROOT, 'server', 'living.mjs'), 'utf8');

function grab(src, name) {
  const at = src.indexOf('function ' + name + '(');
  assert.ok(at > 0, name + ' should exist');
  let d = 0, q = null, esc = false;
  for (let j = src.indexOf('{', at); j < src.length; j++) {
    const c = src[j];
    if (q) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '/' && src[j + 1] === '/') { j = src.indexOf('\n', j); continue; }
    if (c === '{') d++; else if (c === '}') { d--; if (!d) return src.slice(at, j + 1); }
  }
  assert.fail(name + ' has no closing brace');
}
function table(src, head) {
  const at = src.indexOf(head);
  assert.ok(at > 0, head + ' should exist');
  return src.slice(at, src.indexOf('];', at) + 2);
}

const ctx = vm.createContext({ console });
vm.runInContext([
  'function isWkt(o){return /^w/.test(String(o||""))&&o!=="wide"}',
  table(CORE, 'const FO_TAL_SAY='),
  CORE.slice(CORE.indexOf('const FO_FLD_TAG='), CORE.indexOf('};', CORE.indexOf('const FO_FLD_TAG=')) + 2),
  grab(CORE, 'foTalSaid'), grab(CORE, 'foIsTalentText'),
  grab(CORE, 'foBallTag'), grab(CORE, 'foBallTagKind'), grab(CORE, 'foCommPass')
].join('\n'), ctx);
const talSaid = vm.runInContext('foTalSaid', ctx);
const ballTag = vm.runInContext('foBallTag', ctx);
const tagKind = vm.runInContext('foBallTagKind', ctx);
const pass = vm.runInContext('foCommPass', ctx);

// ---- the talent bracket ----------------------------------------------------
test('a talent that fires is stamped on the ball it fired on', () => {
  // the eight that announce themselves in the wicket and boundary branches
  ['Partnership Breaker', 'New Ball Specialist', 'Golden Arm', 'Mystery Ball',
   'Bouncer', 'Six Machine', 'Finisher', 'Lightning Hands'].forEach(function (t) {
    assert.ok(CORE.indexOf("M._talEv='" + t + "'") > 0, t + ' is stamped where it fires');
  });
  // and the ninth, which shouted its name in the sentence for a long time and
  // was never stamped, so no filter and no bracket could see it
  assert.ok(CORE.indexOf("if(isRocket)M._talEv='Rocket Arm'") > 0,
    'Rocket Arm is stamped where the fielding branch fires it');
});

test('the sentence table is the engine own words, and it names all nine', () => {
  const SAYS = {
    'Wright to Cole : WICKET. The PARTNERSHIP BREAKER strikes - the stand of 61 is broken!': 'Partnership Breaker',
    'Wright to Cole : WICKET. The New Ball Specialist makes the cherry talk!': 'New Ball Specialist',
    'Wright to Cole : WICKET. Golden Arm! First spell overs and he strikes again.': 'Golden Arm',
    'Wright to Cole : WICKET. The Mystery Ball completely deceives the newcomer!': 'Mystery Ball',
    'Wright to Cole : WICKET. Softened up by the short stuff - the Bouncer talent tells.': 'Bouncer',
    'Ogden to Dunn : Into the stand. The SIX MACHINE delivers!': 'Six Machine',
    'Ogden to Dunn : FOUR. Finisher’s instinct at the death.': 'Finisher',
    'Dijk to Meer : Lightning Hands from A. Bakker - the bails are gone in a blur.': 'Lightning Hands',
    'Wright to Cole : Rocket Arm! J. Foster attacks the ball at third man and keeps it to one.': 'Rocket Arm'
  };
  Object.keys(SAYS).forEach(function (txt) {
    assert.equal(talSaid(txt), SAYS[txt], 'the engine said: ' + txt.slice(-40));
  });
});

test('a short ball is not the Bouncer talent, however the word reads', () => {
  const shortBall = { no: '3.2', out: 'dot', tal: null,
    txt: 'Ogden to Lowe : A sharp bouncer at the badge - Lowe ducks under it.' };
  assert.equal(talSaid(shortBall.txt), null, 'nothing fired on it');
  assert.equal(pass(shortBall, 'talents'), false, 'so the Talents filter does not offer it');
  assert.equal(ballTag(shortBall), null, 'and nothing claims a bracket on it');
  // the old reading, which is what put it there
  assert.ok(!/SIX MACHINE\|Finisher\|PARTNERSHIP/.test(CORE),
    'the loose word list is gone from the source, not merely unused');
});

test('the bracket reads the stamp first and the sentence second', () => {
  const stamped = { no: '1.1', out: 'wC', tal: 'Golden Arm', txt: 'Wright to Cole : WICKET - bowled him.' };
  assert.equal(ballTag(stamped), 'Golden Arm', 'the stamp wins where there is one');
  // a log banked before the stamp existed carries no tal key at all
  const old = { no: '2.2', out: '6', txt: 'Ogden to Dunn : Into the stand. The SIX MACHINE delivers!' };
  assert.equal(ballTag(old), 'Six Machine', 'and the sentence rescues the rest');
  assert.equal(tagKind(old), 'tal', 'a talent tag reads as the man own, not as fielding');
  // fielding still answers from its own stamp, and is not a talent
  const fld = { no: '4.4', out: '1', tal: null, fld: { k: 'fumble' }, txt: 'Wright to Cole : fumbled at cover.' };
  assert.equal(ballTag(fld), 'fumble');
  assert.equal(tagKind(fld), 'fld');
});

test('the filter and the bracket can never disagree', () => {
  const LOG = [
    { no: '1.1', out: 'dot', tal: null, txt: 'Ogden to Lowe : A sharp bouncer at the badge - he ducks.' },
    { no: '1.2', out: 'wC', tal: 'Bouncer', txt: 'Ogden to Lowe : WICKET. Softened up by the short stuff - the Bouncer talent tells.' },
    { no: '1.3', out: '6', txt: 'Ogden to Dunn : Into the stand. The SIX MACHINE delivers!' },
    { no: '1.4', out: '1', txt: 'Wright to Cole : Rocket Arm! J. Foster attacks the ball and keeps it to one.' },
    { no: '1.5', out: 'dot', tal: null, txt: 'Wright to Cole : left well alone.' }
  ];
  const shown = LOG.filter(function (L) { return pass(L, 'talents'); });
  assert.equal(shown.length, 3, 'three balls really had a talent fire on them');
  shown.forEach(function (L) {
    assert.ok(ballTag(L), 'ball ' + L.no + ' is shown under Talents with no name to print');
  });
});

// ---- the story so far ------------------------------------------------------
test('the page no longer promises a fixture it was not asked for', () => {
  assert.ok(!/Next assignment/.test(PP), 'the rail card is gone');
  assert.ok(!/nextFixtureFor/.test(PP), 'and so is the lookup that fed it');
  assert.ok(!/fo-pp-nx\{/.test(PP), 'and its skin, so nothing is left styling nothing');
  assert.ok(!/Next match<\/u>League debut/.test(PP),
    'and the story no longer invents a debut for a man who has played two hundred times');
});

test('a man story is read off his record, not off this device', () => {
  assert.match(PP, /\(p\.mile \|\| \[\]\)\.forEach/, 'the served moments are the first book it reads');
  assert.match(PP, /\(p\._career \|\| \[\]\)\.forEach/, 'a match watched here still writes its own');
  assert.match(PP, /__foPops\.forPlayer\(p\.name\)/, 'and the nets log is the third');
  // one clock, so the three interleave rather than stacking
  assert.match(PP, /out\.sort\(function \(a, b\) \{ return b\.ord - a\.ord; \}\)/, 'newest first, on one key');
});

test('the fold writes a moment only where it is already deciding one', () => {
  assert.match(LIVING, /if \(c\.m === 1\) mile\('debut'/, 'the first cap');
  assert.match(LIVING, /L\.hs > c\.hs\) mile\('hs'/, 'a new highest score, before the record moves');
  assert.match(LIVING, /mile\('bb', 'Achieved his best '/, 'a new best set of figures');
  assert.match(LIVING, /mile\('hundred'/, 'and the maidens');
  assert.match(LIVING, /mile\('fifty'/);
  assert.match(LIVING, /mile\('fivefor'/);
  // it rides in the squad blob beside the record it came from
  assert.match(LIVING, /if \(all\.length\) q\.mile = all\.slice\(-60\); else delete q\.mile;/,
    'a man with nothing to say carries no empty list');
  // and the deals come off the board that already has them
  assert.match(LIVING, /FROM listings WHERE status = 'sold'/, 'the transfers are read, not recorded twice');
});
